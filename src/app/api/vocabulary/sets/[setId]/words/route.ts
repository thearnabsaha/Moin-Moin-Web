import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWords, wordBatches } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { enrichWordsWithGemini } from '@/lib/gemini';
import { parseAndCleanWords, normalizeWord, isCorruptedWordData } from '@/lib/word-parser';

export const maxDuration = 60;

// POST /api/vocabulary/sets/[setId]/words - Append words to an existing set
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { setId } = await params;

    const [batch] = await db
      .select()
      .from(wordBatches)
      .where(and(eq(wordBatches.id, setId), eq(wordBatches.userId, session.id)));

    if (!batch) return NextResponse.json({ error: 'Word set not found' }, { status: 404 });

    const body = await req.json();
    const { words: wordsInput } = body;

    if (typeof wordsInput !== 'string' || !wordsInput.trim()) {
      return NextResponse.json({ error: 'Please enter at least one word' }, { status: 400 });
    }

    // Clean and deduplicate input ("repeated words shouldn't come")
    const parsedWords = parseAndCleanWords(wordsInput);
    if (parsedWords.length === 0) {
      return NextResponse.json({ error: 'No valid German words parsed from input' }, { status: 400 });
    }

    // 1. Fetch words currently in THIS specific set to prevent duplicates in this set
    const currentSetWords = await db
      .select({ word: userWords.word })
      .from(userWords)
      .where(and(eq(userWords.batchId, setId), eq(userWords.userId, session.id)));

    const currentSetRoots = new Set(currentSetWords.map((r) => normalizeWord(r.word)));

    // Filter out words that are already in this set
    const newWordsForSet = parsedWords.filter((w) => !currentSetRoots.has(normalizeWord(w)));
    const skippedDuplicateCount = parsedWords.length - newWordsForSet.length;

    if (newWordsForSet.length === 0) {
      return NextResponse.json(
        {
          error: `All ${parsedWords.length} word(s) are already in this set.`,
          skipped: skippedDuplicateCount,
        },
        { status: 400 }
      );
    }

    // 2. Check if user already has high-quality enriched data for these words in their library
    const allUserWords = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, session.id));

    const libraryByRoot = new Map<string, typeof allUserWords[0]>();
    for (const row of allUserWords) {
      const root = normalizeWord(row.word);
      if (!libraryByRoot.has(root) && !isCorruptedWordData(row.word, row.meaning, row.exampleSentence, row.partOfSpeech)) {
        libraryByRoot.set(root, row);
      }
    }

    const wordsToEnrich: string[] = [];
    const reusedData: typeof allUserWords = [];

    for (const w of newWordsForSet) {
      const root = normalizeWord(w);
      const existing = libraryByRoot.get(root);
      if (existing) {
        reusedData.push(existing);
      } else {
        wordsToEnrich.push(w);
      }
    }

    let newlyEnriched: Awaited<ReturnType<typeof enrichWordsWithGemini>> = [];
    if (wordsToEnrich.length > 0) {
      try {
        newlyEnriched = await enrichWordsWithGemini(wordsToEnrich);
      } catch (enrichErr) {
        console.error('Enrichment failed:', enrichErr);
        const msg = enrichErr instanceof Error ? enrichErr.message : 'Unknown error';
        return NextResponse.json({ error: `Enrichment failed: ${msg}` }, { status: 500 });
      }
    }

    // Combine all words ensuring unique roots in the set
    const seenRootsInSet = new Set<string>(currentSetRoots);
    const itemsToInsert: Array<{
      word: string;
      partOfSpeech: string;
      gender: string | null;
      pluralForm: string | null;
      conjugation: Record<string, string> | null;
      meaning: string;
      cefrLevel: string;
      exampleSentence: string | null;
      verbType: string | null;
      auxiliaryType: string | null;
      presentForm: string | null;
      simplePast: string | null;
      perfectForm: string | null;
    }> = [];

    for (const r of reusedData) {
      const root = normalizeWord(r.word);
      if (seenRootsInSet.has(root)) continue;
      seenRootsInSet.add(root);
      itemsToInsert.push({
        word: r.word,
        partOfSpeech: r.partOfSpeech,
        gender: r.partOfSpeech.toLowerCase() === 'noun' ? r.gender : null,
        pluralForm: r.pluralForm,
        conjugation: r.conjugation as Record<string, string> | null,
        meaning: r.meaning,
        cefrLevel: r.cefrLevel,
        exampleSentence: r.exampleSentence,
        verbType: r.verbType,
        auxiliaryType: r.auxiliaryType,
        presentForm: r.presentForm,
        simplePast: r.simplePast,
        perfectForm: r.perfectForm,
      });
    }

    for (const w of newlyEnriched) {
      const root = normalizeWord(w.word);
      if (seenRootsInSet.has(root)) continue;
      seenRootsInSet.add(root);
      itemsToInsert.push({
        word: w.word,
        partOfSpeech: w.part_of_speech,
        gender: w.part_of_speech.toLowerCase() === 'noun' ? (w.gender ?? null) : null,
        pluralForm: w.plural_form ?? null,
        conjugation: (w.conjugation as Record<string, string> | null) ?? null,
        meaning: w.meaning,
        cefrLevel: w.cefr_level ?? 'A1',
        exampleSentence: w.example_sentence ?? null,
        verbType: w.verb_type ?? null,
        auxiliaryType: w.auxiliary_type ?? null,
        presentForm: w.present_form ?? null,
        simplePast: w.simple_past ?? null,
        perfectForm: w.perfect_form ?? null,
      });
    }

    // Insert new words into set
    const insertedWords = [];
    for (const item of itemsToInsert) {
      const [inserted] = await db
        .insert(userWords)
        .values({
          userId: session.id,
          ...item,
          batchId: setId,
          learned: false,
        })
        .returning();
      insertedWords.push(inserted);
    }

    // Update batch word count
    await db
      .update(wordBatches)
      .set({ wordCount: sql`${wordBatches.wordCount} + ${insertedWords.length}` })
      .where(eq(wordBatches.id, setId));

    return NextResponse.json({
      success: true,
      addedWords: insertedWords,
      addedCount: insertedWords.length,
      skippedCount: skippedDuplicateCount,
    });
  } catch (error) {
    console.error('Error adding words to set:', error);
    return NextResponse.json({ error: 'Failed to add words to set' }, { status: 500 });
  }
}

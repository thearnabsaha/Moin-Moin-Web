import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wordBatches, userWords } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { enrichWordsWithGemini } from '@/lib/gemini';
import { parseAndCleanWords, normalizeWord, isCorruptedWordData } from '@/lib/word-parser';
import { lookupWord } from '@/lib/dictionary-data';

export const maxDuration = 60;

// GET /api/vocabulary/sets - List all word sets for user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const [batches, allUserWords] = await Promise.all([
      db
        .select()
        .from(wordBatches)
        .where(eq(wordBatches.userId, session.id))
        .orderBy(desc(wordBatches.createdAt)),
      db
        .select()
        .from(userWords)
        .where(eq(userWords.userId, session.id))
        .orderBy(desc(userWords.createdAt)),
    ]);

    const rowsToHealInDb: Array<{
      id: string;
      meaning: string;
      exampleSentence: string | null;
      partOfSpeech: string;
      gender: string | null;
      presentForm?: string | null;
      simplePast?: string | null;
      perfectForm?: string | null;
      conjugation?: Record<string, string> | null;
    }> = [];

    // Group words by batchId in-memory in 0ms with on-the-fly healing
    const wordsByBatch = new Map<string, typeof allUserWords>();
    for (const word of allUserWords) {
      if (isCorruptedWordData(word.word, word.meaning, word.exampleSentence, word.partOfSpeech)) {
        const clean = normalizeWord(word.word);
        const raw = word.word.trim().toLowerCase();
        const dict = lookupWord(clean) || lookupWord(raw);
        if (dict) {
          word.meaning = dict.meaning;
          if (dict.exampleSentence) word.exampleSentence = dict.exampleSentence;
          if (dict.partOfSpeech) word.partOfSpeech = dict.partOfSpeech;
          if (dict.gender !== undefined) word.gender = dict.partOfSpeech === 'noun' ? dict.gender : null;
          if (dict.presentForm) word.presentForm = dict.presentForm;
          if (dict.simplePast) word.simplePast = dict.simplePast;
          if (dict.perfectForm) word.perfectForm = dict.perfectForm;
          if (dict.conjugation) word.conjugation = dict.conjugation;
          rowsToHealInDb.push({
            id: word.id,
            meaning: dict.meaning,
            exampleSentence: dict.exampleSentence ?? word.exampleSentence,
            partOfSpeech: dict.partOfSpeech || word.partOfSpeech,
            gender: dict.partOfSpeech === 'noun' ? (dict.gender ?? null) : null,
            presentForm: dict.presentForm ?? word.presentForm,
            simplePast: dict.simplePast ?? word.simplePast,
            perfectForm: dict.perfectForm ?? word.perfectForm,
            conjugation: dict.conjugation ?? (word.conjugation as Record<string, string> | null),
          });
        }
      }
      if (word.batchId) {
        const list = wordsByBatch.get(word.batchId) || [];
        list.push(word);
        wordsByBatch.set(word.batchId, list);
      }
    }

    if (rowsToHealInDb.length > 0) {
      Promise.all(
        rowsToHealInDb.map((item) =>
          db
            .update(userWords)
            .set({
              meaning: item.meaning,
              exampleSentence: item.exampleSentence,
              partOfSpeech: item.partOfSpeech,
              gender: item.gender,
              presentForm: item.presentForm,
              simplePast: item.simplePast,
              perfectForm: item.perfectForm,
              conjugation: item.conjugation,
            })
            .where(eq(userWords.id, item.id))
        )
      ).catch((err) => console.error('[GET Sets Auto-heal error]:', err));
    }

    const result = batches.map((b) => {
      const words = wordsByBatch.get(b.id) || [];
      const learnedCount = words.filter((w) => w.learned).length;
      return {
        id: b.id,
        name: b.name,
        wordCount: words.length,
        learnedCount,
        practiceUnlocked: b.practiceUnlocked,
        examUnlocked: b.examUnlocked,
        createdAt: b.createdAt,
        words,
      };
    });

    return NextResponse.json({ sets: result });
  } catch (error) {
    console.error('Error fetching word sets:', error);
    return NextResponse.json({ error: 'Failed to fetch word sets' }, { status: 500 });
  }
}

// POST /api/vocabulary/sets - Create a new word set from comma-separated words
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { name, words: wordsInput } = body;

    const setName = (name && typeof name === 'string' && name.trim().length > 0)
      ? name.trim()
      : `Word Set ${new Date().toLocaleDateString('de-DE')}`;

    if (typeof wordsInput !== 'string' || !wordsInput.trim()) {
      return NextResponse.json({ error: 'Please enter at least one German word' }, { status: 400 });
    }

    // Clean input and deduplicate ("repeated words shouldn't come")
    const parsedWords = parseAndCleanWords(wordsInput);
    if (parsedWords.length === 0) {
      return NextResponse.json({ error: 'No valid German words parsed from input' }, { status: 400 });
    }

    // Check existing vocabulary so we can reuse high-quality data without dropping words
    const existingRows = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, session.id));

    const existingByRoot = new Map<string, typeof existingRows[0]>();
    for (const row of existingRows) {
      const root = normalizeWord(row.word);
      if (!existingByRoot.has(root) && !isCorruptedWordData(row.word, row.meaning, row.exampleSentence, row.partOfSpeech)) {
        existingByRoot.set(root, row);
      }
    }

    const wordsToEnrich: string[] = [];
    const reusedData: typeof existingRows = [];

    for (const w of parsedWords) {
      const root = normalizeWord(w);
      const existing = existingByRoot.get(root);
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

    // Combine all words ensuring unique roots in the new set
    const seenRootsInSet = new Set<string>();
    const allSetItems: Array<{
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
      allSetItems.push({
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
      allSetItems.push({
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

    if (allSetItems.length === 0) {
      return NextResponse.json({ error: 'No valid words to create set' }, { status: 400 });
    }

    // Create Word Batch / Set
    const [batch] = await db
      .insert(wordBatches)
      .values({
        userId: session.id,
        name: setName,
        wordCount: allSetItems.length,
        learnedCount: 0,
      })
      .returning();

    // Insert all words linked to this batchId
    const createdWords = [];
    for (const item of allSetItems) {
      const [inserted] = await db
        .insert(userWords)
        .values({
          userId: session.id,
          ...item,
          batchId: batch.id,
          learned: false,
        })
        .returning();
      createdWords.push(inserted);
    }

    return NextResponse.json({
      success: true,
      set: {
        ...batch,
        words: createdWords,
      },
      addedCount: createdWords.length,
      skippedCount: 0,
    });
  } catch (error) {
    console.error('Error creating word set:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

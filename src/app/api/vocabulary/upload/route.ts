import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userWords, wordBatches } from '@/lib/schema';
import { enrichWordsWithGemini } from '@/lib/gemini';
import { getCurrentUserId } from '@/lib/get-user';
import { parseAndCleanWords, normalizeWord } from '@/lib/word-parser';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const { words: wordsInput } = body;
    if (typeof wordsInput !== 'string' || !wordsInput.trim()) {
      return NextResponse.json({ success: false, error: 'words must be a non-empty string' }, { status: 400 });
    }

    const parsedWords = parseAndCleanWords(wordsInput);
    if (parsedWords.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid German words provided' }, { status: 400 });
    }

    const existingRows = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, userId));

    const existingByRoot = new Map<string, typeof existingRows[0]>();
    for (const row of existingRows) {
      const root = normalizeWord(row.word);
      if (!existingByRoot.has(root) && row.meaning && normalizeWord(row.meaning) !== root) {
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
        const msg = enrichErr instanceof Error ? enrichErr.message : 'Unknown enrichment error';
        return NextResponse.json({ success: false, error: `Enrichment failed: ${msg}` }, { status: 500 });
      }
    }

    const seenRoots = new Set<string>();
    const allItems: Array<{
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
      if (seenRoots.has(root)) continue;
      seenRoots.add(root);
      allItems.push({
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
      if (seenRoots.has(root)) continue;
      seenRoots.add(root);
      allItems.push({
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

    if (allItems.length === 0) {
      return NextResponse.json({ success: false, error: 'No words to add' }, { status: 400 });
    }

    const [batch] = await db.insert(wordBatches).values({
      userId,
      name: `Batch ${new Date().toLocaleDateString('de-DE')}`,
      wordCount: allItems.length,
    }).returning();

    const insertRows = allItems.map((item) => ({
      userId,
      ...item,
      batchId: batch.id,
    }));

    const DB_INSERT_BATCH = 50;
    for (let i = 0; i < insertRows.length; i += DB_INSERT_BATCH) {
      await db.insert(userWords).values(insertRows.slice(i, i + DB_INSERT_BATCH));
    }

    return NextResponse.json({
      success: true,
      count: allItems.length,
      skipped: 0,
      words: allItems,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Vocabulary upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

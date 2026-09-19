import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userWords, wordBatches } from '@/lib/schema';
import { getCurrentUserId } from '@/lib/get-user';
import { enrichWordsWithGemini } from '@/lib/gemini';
import { parseAndCleanWords, normalizeWord } from '@/lib/word-parser';

type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'preposition' | 'conjunction' | 'other';
type Gender = 'masculine' | 'feminine' | 'neuter';
type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';

interface Analytics {
  totalWords: number;
  byPartOfSpeech: Record<PartOfSpeech, number>;
  byGender: Record<Gender, number>;
  byCefrLevel: Record<CefrLevel, number>;
  mastered: number;
}

function normalizePos(pos: string): PartOfSpeech {
  const p = pos?.toLowerCase();
  if (p === 'noun') return 'noun';
  if (p === 'verb') return 'verb';
  if (p === 'adjective') return 'adjective';
  if (p === 'preposition') return 'preposition';
  if (p === 'conjunction') return 'conjunction';
  return 'other';
}

function normalizeGender(g: string | null): Gender | null {
  if (!g) return null;
  const lower = g.toLowerCase();
  if (lower === 'masculine') return 'masculine';
  if (lower === 'feminine') return 'feminine';
  if (lower === 'neuter') return 'neuter';
  return null;
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const rawRows = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, userId))
      .orderBy(desc(userWords.createdAt));

    // Deduplicate words so repeated words never appear in the vocabulary library
    const uniqueWordMap = new Map<string, typeof rawRows[0]>();
    for (const row of rawRows) {
      const root = normalizeWord(row.word);
      if (!root) continue;
      if (!uniqueWordMap.has(root)) {
        uniqueWordMap.set(root, row);
      } else {
        const existing = uniqueWordMap.get(root)!;
        const scoreExisting = (existing.learned ? 100 : 0) + (existing.stability || 0) * 10 + (existing.reps || 0);
        const scoreCurrent = (row.learned ? 100 : 0) + (row.stability || 0) * 10 + (row.reps || 0);
        if (scoreCurrent > scoreExisting) {
          uniqueWordMap.set(root, row);
        }
      }
    }
    const rows = Array.from(uniqueWordMap.values());

    const analytics: Analytics = {
      totalWords: rows.length,
      byPartOfSpeech: {
        noun: 0,
        verb: 0,
        adjective: 0,
        preposition: 0,
        conjunction: 0,
        other: 0,
      },
      byGender: {
        masculine: 0,
        feminine: 0,
        neuter: 0,
      },
      byCefrLevel: {
        A1: 0,
        A2: 0,
        B1: 0,
        B2: 0,
      },
      mastered: 0,
    };

    for (const row of rows) {
      const pos = normalizePos(row.partOfSpeech);
      analytics.byPartOfSpeech[pos] = (analytics.byPartOfSpeech[pos] ?? 0) + 1;

      const gender = normalizeGender(row.gender);
      if (gender) {
        analytics.byGender[gender] = (analytics.byGender[gender] ?? 0) + 1;
      }

      const level = row.cefrLevel as CefrLevel;
      if (['A1', 'A2', 'B1', 'B2'].includes(level)) {
        analytics.byCefrLevel[level] = (analytics.byCefrLevel[level] ?? 0) + 1;
      }

      const state = row.state ?? 0;
      const stability = row.stability ?? 0;
      if (state >= 2 && stability >= 21) {
        analytics.mastered += 1;
      }
    }

    const verbs = rows.filter(w => w.partOfSpeech === 'verb');
    const verbBreakdown = {
      total: verbs.length,
      regular: verbs.filter(w => w.verbType === 'regular').length,
      irregular: verbs.filter(w => w.verbType === 'irregular').length,
      mixed: verbs.filter(w => w.verbType === 'mixed').length,
      haben: verbs.filter(w => w.auxiliaryType === 'haben').length,
      sein: verbs.filter(w => w.auxiliaryType === 'sein').length,
    };

    return NextResponse.json({ words: rows, analytics, verbBreakdown });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Vocabulary GET error:', error);
    return NextResponse.json({ words: [], analytics: null }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id parameter' }, { status: 400 });
    }
    await db
      .delete(userWords)
      .where(and(eq(userWords.id, id), eq(userWords.userId, userId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Vocabulary DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}

// POST /api/vocabulary - Add and enrich German words with Gemini AI
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const rawInput = body.words || body.word;

    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      return NextResponse.json({ error: 'Please provide one or more German words' }, { status: 400 });
    }

    // Clean input and eliminate repeated words ("repeated words shouldn't come")
    const parsed = parseAndCleanWords(rawInput);
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid German words parsed from input' }, { status: 400 });
    }

    // Check existing words
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

    for (const w of parsed) {
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
        return NextResponse.json({ error: 'Failed to enrich words' }, { status: 500 });
      }
    }

    const seenRootsInBatch = new Set<string>();
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
      if (seenRootsInBatch.has(root)) continue;
      seenRootsInBatch.add(root);
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
      if (seenRootsInBatch.has(root)) continue;
      seenRootsInBatch.add(root);
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

    if (itemsToInsert.length === 0) {
      return NextResponse.json({ error: 'No words to add' }, { status: 400 });
    }

    // Create a batch
    const setName = body.setName?.trim() || `Vocab ${new Date().toLocaleDateString('de-DE')}`;
    const [batch] = await db
      .insert(wordBatches)
      .values({
        userId,
        name: setName,
        wordCount: itemsToInsert.length,
        learnedCount: 0,
      })
      .returning();

    const created = [];
    for (const item of itemsToInsert) {
      const [inserted] = await db
        .insert(userWords)
        .values({
          userId,
          ...item,
          batchId: batch.id,
          learned: false,
        })
        .returning();
      created.push(inserted);
    }

    return NextResponse.json({
      success: true,
      added: created.length,
      skipped: 0,
      words: created,
      batch,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Vocabulary POST error:', error);
    return NextResponse.json({ error: 'Failed to add words' }, { status: 500 });
  }
}


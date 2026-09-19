import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userWords, wordBatches } from '@/lib/schema';
import { getCurrentUserId } from '@/lib/get-user';
import { enrichWordsWithGemini } from '@/lib/gemini';

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
    const rows = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, userId))
      .orderBy(desc(userWords.createdAt));

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

function normalizeForComparison(w: string): string {
  return w
    .toLowerCase()
    .replace(/^(der|die|das|dem|den|des)\s+/, '')
    .trim();
}

function parseWords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,;]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
    )
  );
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

    const parsed = parseWords(rawInput);
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid words parsed from input' }, { status: 400 });
    }

    // Check existing words
    const existingRows = await db
      .select({ word: userWords.word })
      .from(userWords)
      .where(eq(userWords.userId, userId));
    const existingNorm = new Set(existingRows.map((r) => normalizeForComparison(r.word)));

    const newWords = parsed.filter((w) => !existingNorm.has(normalizeForComparison(w)));
    if (newWords.length === 0) {
      return NextResponse.json(
        { error: 'All words already exist in your vocabulary', added: 0, skipped: parsed.length },
        { status: 400 }
      );
    }

    // Enrich with Gemini
    const enriched = await enrichWordsWithGemini(newWords);
    if (!enriched || enriched.length === 0) {
      return NextResponse.json({ error: 'Enrichment failed. Please try again.' }, { status: 500 });
    }

    const deduped = enriched.filter((w) => !existingNorm.has(normalizeForComparison(w.word)));
    if (deduped.length === 0) {
      return NextResponse.json(
        { error: 'All words already exist in your vocabulary', added: 0, skipped: parsed.length },
        { status: 400 }
      );
    }

    // Create a batch
    const setName = body.setName?.trim() || `Vocab ${new Date().toLocaleDateString('de-DE')}`;
    const [batch] = await db
      .insert(wordBatches)
      .values({
        userId,
        name: setName,
        wordCount: deduped.length,
        learnedCount: 0,
      })
      .returning();

    const created = [];
    for (const w of deduped) {
      const [inserted] = await db
        .insert(userWords)
        .values({
          userId,
          word: w.word,
          partOfSpeech: w.part_of_speech,
          gender: w.gender ?? null,
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
          batchId: batch.id,
          learned: false,
        })
        .returning();
      created.push(inserted);
    }

    return NextResponse.json({
      success: true,
      added: created.length,
      skipped: parsed.length - newWords.length + (enriched.length - deduped.length),
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


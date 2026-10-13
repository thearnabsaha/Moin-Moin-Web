import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWords } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/get-user';
import { enrichWordsWithGemini } from '@/lib/gemini';

// POST /api/vocabulary/recheck
// Recheck a single word in the general vocabulary library
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing word id' }, { status: 400 });
    }

    const [word] = await db
      .select()
      .from(userWords)
      .where(and(eq(userWords.id, id), eq(userWords.userId, userId)));

    if (!word) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }

    // Run high-tier enrichment on this specific word
    const [enriched] = await enrichWordsWithGemini([word.word], { powerful: true });

    if (!enriched) {
      return NextResponse.json({ error: 'Failed to enrich word with AI' }, { status: 500 });
    }

    const [updated] = await db
      .update(userWords)
      .set({
        word: enriched.word || word.word,
        meaning: enriched.meaning || word.meaning,
        partOfSpeech: enriched.part_of_speech || word.partOfSpeech,
        gender: enriched.gender !== undefined ? enriched.gender : word.gender,
        cefrLevel: enriched.cefr_level || word.cefrLevel,
        exampleSentence: enriched.example_sentence || word.exampleSentence,
        pluralForm: enriched.plural_form !== undefined ? enriched.plural_form : word.pluralForm,
        conjugation: enriched.conjugation || word.conjugation,
        verbType: enriched.verb_type !== undefined ? enriched.verb_type : word.verbType,
        auxiliaryType: enriched.auxiliary_type !== undefined ? enriched.auxiliary_type : word.auxiliaryType,
        presentForm: enriched.present_form !== undefined ? enriched.present_form : word.presentForm,
        simplePast: enriched.simple_past !== undefined ? enriched.simple_past : word.simplePast,
        perfectForm: enriched.perfect_form !== undefined ? enriched.perfect_form : word.perfectForm,
      })
      .where(and(eq(userWords.id, id), eq(userWords.userId, userId)))
      .returning();

    return NextResponse.json({ success: true, word: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Error rechecking vocabulary word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

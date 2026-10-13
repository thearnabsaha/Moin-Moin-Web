import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWords } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { enrichWordsWithGemini } from '@/lib/gemini';

// POST /api/vocabulary/sets/[setId]/words/[wordId]/recheck
// Recheck a single word in a set using the powerful AI model cascade
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ setId: string; wordId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { setId, wordId } = await params;

    // Find the word
    const [word] = await db
      .select()
      .from(userWords)
      .where(
        and(
          eq(userWords.id, wordId),
          eq(userWords.batchId, setId),
          eq(userWords.userId, session.id)
        )
      );

    if (!word) {
      return NextResponse.json({ error: 'Word not found in this set' }, { status: 404 });
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
      .where(
        and(
          eq(userWords.id, wordId),
          eq(userWords.batchId, setId),
          eq(userWords.userId, session.id)
        )
      )
      .returning();

    return NextResponse.json({ success: true, word: updated });
  } catch (error) {
    console.error('Error rechecking word in set:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

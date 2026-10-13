import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWords, wordBatches } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { enrichWordsWithGemini } from '@/lib/gemini';

// POST /api/vocabulary/sets/[setId]/recheck
// Recheck all words in a set using the powerful AI model cascade
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ setId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { setId } = await params;

    // Verify set belongs to this user
    const [set] = await db
      .select()
      .from(wordBatches)
      .where(and(eq(wordBatches.id, setId), eq(wordBatches.userId, session.id)));

    if (!set) {
      return NextResponse.json({ error: 'Word set not found' }, { status: 404 });
    }

    // Get all words in this set
    const words = await db
      .select()
      .from(userWords)
      .where(and(eq(userWords.batchId, setId), eq(userWords.userId, session.id)));

    if (words.length === 0) {
      return NextResponse.json({ success: true, count: 0, words: [] });
    }

    // Enrich all words using the powerful AI model cascade
    const enrichedList = await enrichWordsWithGemini(
      words.map((w) => w.word),
      { powerful: true }
    );

    const updatedWords = [];

    for (let i = 0; i < words.length; i++) {
      const origWord = words[i];
      const enriched = enrichedList[i];
      if (!enriched) continue;

      const [updated] = await db
        .update(userWords)
        .set({
          word: enriched.word || origWord.word,
          meaning: enriched.meaning || origWord.meaning,
          partOfSpeech: enriched.part_of_speech || origWord.partOfSpeech,
          gender: enriched.gender !== undefined ? enriched.gender : origWord.gender,
          cefrLevel: enriched.cefr_level || origWord.cefrLevel,
          exampleSentence: enriched.example_sentence || origWord.exampleSentence,
          pluralForm: enriched.plural_form !== undefined ? enriched.plural_form : origWord.pluralForm,
          conjugation: enriched.conjugation || origWord.conjugation,
          verbType: enriched.verb_type !== undefined ? enriched.verb_type : origWord.verbType,
          auxiliaryType: enriched.auxiliary_type !== undefined ? enriched.auxiliary_type : origWord.auxiliaryType,
          presentForm: enriched.present_form !== undefined ? enriched.present_form : origWord.presentForm,
          simplePast: enriched.simple_past !== undefined ? enriched.simple_past : origWord.simplePast,
          perfectForm: enriched.perfect_form !== undefined ? enriched.perfect_form : origWord.perfectForm,
        })
        .where(and(eq(userWords.id, origWord.id), eq(userWords.userId, session.id)))
        .returning();

      if (updated) {
        updatedWords.push(updated);
      }
    }

    return NextResponse.json({
      success: true,
      count: updatedWords.length,
      words: updatedWords,
    });
  } catch (error) {
    console.error('Error rechecking set words:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

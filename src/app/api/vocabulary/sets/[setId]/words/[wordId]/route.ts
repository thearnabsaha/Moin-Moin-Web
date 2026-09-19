import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWords, wordBatches, questionSnapshots, wordReviewLogs } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

// DELETE /api/vocabulary/sets/[setId]/words/[wordId] - Remove a specific word from a set
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ setId: string; wordId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { setId, wordId } = await params;

    // Check word belongs to this user and set
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

    if (!word) return NextResponse.json({ error: 'Word not found in this set' }, { status: 404 });

    // Clean up review logs & question snapshots for this word
    await db.delete(questionSnapshots).where(
      and(eq(questionSnapshots.userId, session.id), eq(questionSnapshots.wordId, wordId))
    );
    await db.delete(wordReviewLogs).where(
      and(eq(wordReviewLogs.userId, session.id), eq(wordReviewLogs.wordId, wordId))
    );

    // Delete word
    await db.delete(userWords).where(eq(userWords.id, wordId));

    // Decrement wordCount and learnedCount if learned
    await db
      .update(wordBatches)
      .set({
        wordCount: sql`GREATEST(0, ${wordBatches.wordCount} - 1)`,
        ...(word.learned ? { learnedCount: sql`GREATEST(0, ${wordBatches.learnedCount} - 1)` } : {}),
      })
      .where(eq(wordBatches.id, setId));

    return NextResponse.json({ success: true, removedWordId: wordId });
  } catch (error) {
    console.error('Error removing word from set:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/vocabulary/sets/[setId]/words/[wordId] - Update word meaning and details in set
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ setId: string; wordId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { setId, wordId } = await params;
    const body = await req.json();
    const { meaning, exampleSentence } = body;

    if (!meaning || typeof meaning !== 'string' || !meaning.trim()) {
      return NextResponse.json({ error: 'Meaning cannot be empty' }, { status: 400 });
    }

    const updateData: { meaning: string; exampleSentence?: string | null } = {
      meaning: meaning.trim(),
    };
    if (exampleSentence !== undefined) {
      updateData.exampleSentence = typeof exampleSentence === 'string' ? exampleSentence.trim() || null : null;
    }

    const [updated] = await db
      .update(userWords)
      .set(updateData)
      .where(
        and(
          eq(userWords.id, wordId),
          eq(userWords.batchId, setId),
          eq(userWords.userId, session.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Word not found in this set' }, { status: 404 });
    }

    return NextResponse.json({ success: true, word: updated });
  } catch (error) {
    console.error('Error updating word in set:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userGrammarProgress } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/get-user';
import type {
  GrammarProgress,
  PracticeProgress,
  ChapterProgress,
  LevelResult,
} from '@/lib/grammar-progress';

// Helper to merge 2 GrammarProgress objects (idempotent CRDT-like merge)
function mergeGrammarProgress(
  local: GrammarProgress,
  remote: GrammarProgress
): GrammarProgress {
  const mergedChapters: Record<string, ChapterProgress> = {
    ...(remote.chapters || {}),
  };

  for (const [chId, lCh] of Object.entries(local.chapters || {})) {
    const rCh = mergedChapters[chId];
    if (!rCh) {
      mergedChapters[chId] = lCh;
    } else {
      // Both exist -> take maximums and preserve completed status
      const completedAt =
        lCh.completedAt != null && rCh.completedAt != null
          ? Math.min(lCh.completedAt, rCh.completedAt)
          : lCh.completedAt ?? rCh.completedAt ?? null;

      mergedChapters[chId] = {
        chapterId: chId,
        visitCount: Math.max(lCh.visitCount || 0, rCh.visitCount || 0),
        lastVisited:
          Math.max(lCh.lastVisited || 0, rCh.lastVisited || 0) || null,
        completedAt,
        exerciseAttempts: Math.max(
          lCh.exerciseAttempts || 0,
          rCh.exerciseAttempts || 0
        ),
        exerciseCorrect: Math.max(
          lCh.exerciseCorrect || 0,
          rCh.exerciseCorrect || 0
        ),
      };
    }
  }

  // Merge dailyActivity
  const mergedActivity: Record<string, number> = {
    ...(remote.dailyActivity || {}),
  };
  for (const [day, count] of Object.entries(local.dailyActivity || {})) {
    mergedActivity[day] = Math.max(mergedActivity[day] || 0, count || 0);
  }

  return {
    chapters: mergedChapters,
    dailyActivity: mergedActivity,
  };
}

// Helper to merge PracticeProgress (chapters × 10 levels)
function mergePracticeProgress(
  local: PracticeProgress,
  remote: PracticeProgress
): PracticeProgress {
  const mergedChapters: Record<string, LevelResult[]> = {
    ...(remote.chapters || {}),
  };

  for (const [chId, lLevels] of Object.entries(local.chapters || {})) {
    const rLevels = mergedChapters[chId];
    if (!rLevels) {
      mergedChapters[chId] = lLevels;
    } else {
      const mergedList: LevelResult[] = [];
      const maxLen = Math.max(lLevels.length, rLevels.length, 10);
      for (let i = 0; i < maxLen; i++) {
        const lL = lLevels[i] || {
          score: 0,
          passed: false,
          attempts: 0,
          bestScore: 0,
          lastAttempted: 0,
        };
        const rL = rLevels[i] || {
          score: 0,
          passed: false,
          attempts: 0,
          bestScore: 0,
          lastAttempted: 0,
        };
        mergedList.push({
          score: Math.max(lL.score, rL.score),
          passed: lL.passed || rL.passed,
          attempts: Math.max(lL.attempts, rL.attempts),
          bestScore: Math.max(lL.bestScore, rL.bestScore),
          lastAttempted: Math.max(lL.lastAttempted, rL.lastAttempted),
        });
      }
      mergedChapters[chId] = mergedList;
    }
  }

  return { chapters: mergedChapters };
}

// GET: fetch cloud grammar progress for user
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const [row] = await db
      .select()
      .from(userGrammarProgress)
      .where(eq(userGrammarProgress.userId, userId))
      .limit(1);

    if (!row) {
      return NextResponse.json({
        progress: { chapters: {} },
        practice: { chapters: {} },
        updatedAt: null,
      });
    }

    return NextResponse.json({
      progress: (row.progress as unknown as GrammarProgress) || { chapters: {} },
      practice: (row.practice as unknown as PracticeProgress) || { chapters: {} },
      updatedAt: row.updatedAt,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: sync client grammar progress with cloud (two-way merge)
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const clientProgress: GrammarProgress = body.progress || { chapters: {} };
    const clientPractice: PracticeProgress = body.practice || { chapters: {} };

    const [existing] = await db
      .select()
      .from(userGrammarProgress)
      .where(eq(userGrammarProgress.userId, userId))
      .limit(1);

    let finalProgress = clientProgress;
    let finalPractice = clientPractice;

    if (existing) {
      const dbProgress = (existing.progress as unknown as GrammarProgress) || { chapters: {} };
      const dbPractice = (existing.practice as unknown as PracticeProgress) || { chapters: {} };

      finalProgress = mergeGrammarProgress(clientProgress, dbProgress);
      finalPractice = mergePracticeProgress(clientPractice, dbPractice);

      await db
        .update(userGrammarProgress)
        .set({
          progress: finalProgress as unknown as Record<string, unknown>,
          practice: finalPractice as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(userGrammarProgress.id, existing.id));
    } else {
      await db.insert(userGrammarProgress).values({
        userId,
        progress: finalProgress as unknown as Record<string, unknown>,
        practice: finalPractice as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      });
    }

    const completedChapterCount = Object.values(finalProgress.chapters).filter(
      (c) => c.completedAt != null
    ).length;

    return NextResponse.json({
      success: true,
      progress: finalProgress,
      practice: finalPractice,
      completedChapterCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

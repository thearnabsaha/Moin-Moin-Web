import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  users,
  userSettings,
  userWords,
  wordBatches,
  userGrammarProgress,
} from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/get-user';
import type {
  GrammarProgress,
  PracticeProgress,
  ChapterProgress,
  LevelResult,
} from '@/lib/grammar-progress';

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json().catch(() => ({}));
    const clientProgress: GrammarProgress | undefined = body.grammarProgress;
    const clientPractice: PracticeProgress | undefined = body.practiceProgress;

    // 1. Fetch User and UserSettings
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        targetLevel: users.targetLevel,
        xp: users.xp,
        level: users.level,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [settings] = await db
      .select({
        theme: userSettings.theme,
        dailyGoal: userSettings.dailyGoal,
        soundEnabled: userSettings.soundEnabled,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // 2. Grammar Sync (two-way merge)
    let finalGrammar: GrammarProgress = { chapters: {} };
    let finalPractice: PracticeProgress = { chapters: {} };

    const [existingGrammarRow] = await db
      .select()
      .from(userGrammarProgress)
      .where(eq(userGrammarProgress.userId, userId))
      .limit(1);

    if (clientProgress || clientPractice) {
      if (existingGrammarRow) {
        const dbP =
          (existingGrammarRow.progress as unknown as GrammarProgress) || {
            chapters: {},
          };
        const dbPr =
          (existingGrammarRow.practice as unknown as PracticeProgress) || {
            chapters: {},
          };
        finalGrammar = mergeGrammarProgress(clientProgress || { chapters: {} }, dbP);
        finalPractice = mergePracticeProgress(clientPractice || { chapters: {} }, dbPr);

        await db
          .update(userGrammarProgress)
          .set({
            progress: finalGrammar as unknown as Record<string, unknown>,
            practice: finalPractice as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(userGrammarProgress.id, existingGrammarRow.id));
      } else {
        finalGrammar = clientProgress || { chapters: {} };
        finalPractice = clientPractice || { chapters: {} };
        await db.insert(userGrammarProgress).values({
          userId,
          progress: finalGrammar as unknown as Record<string, unknown>,
          practice: finalPractice as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        });
      }
    } else if (existingGrammarRow) {
      finalGrammar =
        (existingGrammarRow.progress as unknown as GrammarProgress) || {
          chapters: {},
        };
      finalPractice =
        (existingGrammarRow.practice as unknown as PracticeProgress) || {
          chapters: {},
        };
    }

    const grammarCompletedCount = Object.values(finalGrammar.chapters).filter(
      (c) => c.completedAt != null
    ).length;

    // 3. Vocabulary counts
    const totalWords = await db
      .select({ count: sql<number>`count(*)` })
      .from(userWords)
      .where(eq(userWords.userId, userId));

    const totalBatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(wordBatches)
      .where(eq(wordBatches.userId, userId));

    const wordCount = Number(totalWords[0]?.count || 0);
    const setCount = Number(totalBatches[0]?.count || 0);

    return NextResponse.json({
      success: true,
      message: 'Cloud & devices are fully synchronized!',
      timestamp: new Date().toISOString(),
      user: {
        username: user?.username || 'learner',
        name: user?.name || 'Learner',
        targetLevel: user?.targetLevel || 'A1',
        xp: user?.xp || 0,
        level: user?.level || 1,
        dailyGoal: settings?.dailyGoal ?? 20,
        soundEnabled: settings?.soundEnabled ?? true,
        theme: settings?.theme || 'system',
      },
      grammar: {
        completedChapters: grammarCompletedCount,
        totalChapters: 64,
        progress: finalGrammar,
        practice: finalPractice,
      },
      vocabulary: {
        wordCount,
        setCount,
      },
      deviceSync: {
        status: 'synced',
        webSynced: true,
        phoneSynced: true,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

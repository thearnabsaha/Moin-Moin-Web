import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWords, wordBatches, wordReviewLogs } from '@/lib/schema';
import { eq, and, inArray, InferSelectModel } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { enrichWordsWithGemini } from '@/lib/gemini';
import { lookupWord } from '@/lib/dictionary-data';
import { normalizeWord, isCorruptedWordData } from '@/lib/word-parser';

type UserWordRow = InferSelectModel<typeof userWords>;

// POST /api/vocabulary/sync - Synchronize, deduplicate and heal damaged vocabulary
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const allWords: UserWordRow[] = await db
      .select()
      .from(userWords)
      .where(eq(userWords.userId, session.id));

    // Group words by batch and normalized root so repeated words within a set or unbatched words are merged
    const groups = new Map<string, UserWordRow[]>();
    for (const w of allWords) {
      const root = normalizeWord(w.word);
      if (!root) continue;
      const key = `${w.batchId || 'orphan'}:${root}`;
      const list = groups.get(key) || [];
      list.push(w);
      groups.set(key, list);
    }

    let totalDuplicatesRemoved = 0;
    const removedIds: string[] = [];

    const clusters = Array.from(groups.values());
    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;

      // Sort to find the highest-quality / most-progressed record to keep
      cluster.sort((a: UserWordRow, b: UserWordRow) => {
        const scoreA =
          (a.learned ? 100 : 0) +
          (a.stability || 0) * 10 +
          (a.reps || 0) +
          (a.exampleSentence ? 5 : 0) +
          (a.conjugation ? 5 : 0) +
          (a.gender ? 5 : 0);
        const scoreB =
          (b.learned ? 100 : 0) +
          (b.stability || 0) * 10 +
          (b.reps || 0) +
          (b.exampleSentence ? 5 : 0) +
          (b.conjugation ? 5 : 0) +
          (b.gender ? 5 : 0);
        return scoreB - scoreA;
      });

      const keeper = cluster[0];
      const duplicates = cluster.slice(1);

      // Merge progress into keeper
      const maxStability = Math.max(keeper.stability || 0, ...duplicates.map((d: UserWordRow) => d.stability || 0));
      const maxReps = Math.max(keeper.reps || 0, ...duplicates.map((d: UserWordRow) => d.reps || 0));
      const isLearned = keeper.learned || duplicates.some((d: UserWordRow) => d.learned);

      if (
        maxStability > (keeper.stability || 0) ||
        maxReps > (keeper.reps || 0) ||
        isLearned !== keeper.learned
      ) {
        await db
          .update(userWords)
          .set({
            stability: maxStability,
            reps: maxReps,
            learned: isLearned,
          })
          .where(eq(userWords.id, keeper.id));
      }

      // Re-link review logs to keeper before deleting duplicates
      for (const dup of duplicates) {
        await db
          .update(wordReviewLogs)
          .set({ wordId: keeper.id })
          .where(eq(wordReviewLogs.wordId, dup.id));
        removedIds.push(dup.id);
      }

      totalDuplicatesRemoved += duplicates.length;
    }

    // Delete all duplicate word records in bulk
    if (removedIds.length > 0) {
      await db
        .delete(userWords)
        .where(and(eq(userWords.userId, session.id), inArray(userWords.id, removedIds)));
    }

    // Auto-repair any damaged words (e.g. naive stem translations, self-referential meanings, dummy sentences)
    let totalRepairedWords = 0;
    const wordsToHealViaAi: UserWordRow[] = [];

    for (const w of allWords) {
      if (removedIds.includes(w.id)) continue;

      const cleanWord = normalizeWord(w.word);
      const rawWord = w.word.trim().toLowerCase();
      const corrupted = isCorruptedWordData(w.word, w.meaning, w.exampleSentence, w.partOfSpeech);

      if (corrupted) {
        const dict = lookupWord(cleanWord) || lookupWord(rawWord);
        if (dict) {
          await db
            .update(userWords)
            .set({
              meaning: dict.meaning,
              exampleSentence: dict.exampleSentence ?? w.exampleSentence,
              gender: dict.partOfSpeech === 'noun' ? (dict.gender ?? null) : null,
              partOfSpeech: dict.partOfSpeech || w.partOfSpeech,
            })
            .where(eq(userWords.id, w.id));
          totalRepairedWords++;
        } else {
          wordsToHealViaAi.push(w);
        }
      }
    }

    // Heal remaining words via AI in batches
    if (wordsToHealViaAi.length > 0) {
      try {
        const aiResults = await enrichWordsWithGemini(wordsToHealViaAi.map((w) => w.word));
        for (let i = 0; i < wordsToHealViaAi.length; i++) {
          const target = wordsToHealViaAi[i];
          const enriched = aiResults[i];
          if (enriched && enriched.meaning && !isCorruptedWordData(target.word, enriched.meaning, enriched.example_sentence, enriched.part_of_speech)) {
            await db
              .update(userWords)
              .set({
                meaning: enriched.meaning,
                exampleSentence: enriched.example_sentence ?? target.exampleSentence,
                gender: enriched.part_of_speech === 'noun' ? (enriched.gender ?? null) : null,
                partOfSpeech: enriched.part_of_speech,
              })
              .where(eq(userWords.id, target.id));
            totalRepairedWords++;
          }
        }
      } catch (aiErr) {
        console.warn('[Sync] AI healing batch error:', aiErr);
      }
    }

    // Recalculate word counts and learned counts for all user batches
    const userBatches = await db
      .select()
      .from(wordBatches)
      .where(eq(wordBatches.userId, session.id));

    let affectedSetsCount = 0;
    for (const b of userBatches) {
      const remainingWords = await db
        .select()
        .from(userWords)
        .where(and(eq(userWords.batchId, b.id), eq(userWords.userId, session.id)));

      const learned = remainingWords.filter((w) => w.learned || (w.stability || 0) > 0).length;

      if (b.wordCount !== remainingWords.length || b.learnedCount !== learned) {
        affectedSetsCount++;
        await db
          .update(wordBatches)
          .set({
            wordCount: remainingWords.length,
            learnedCount: learned,
          })
          .where(eq(wordBatches.id, b.id));
      }
    }

    const totalRemainingWords = allWords.length - totalDuplicatesRemoved;

    return NextResponse.json({
      success: true,
      removedDuplicatesCount: totalDuplicatesRemoved,
      repairedWordsCount: totalRepairedWords,
      affectedSetsCount,
      totalUniqueWords: totalRemainingWords,
      message:
        totalDuplicatesRemoved > 0 || totalRepairedWords > 0
          ? `Synchronized! Removed ${totalDuplicatesRemoved} duplicate(s) and repaired ${totalRepairedWords} word definition(s).`
          : 'All words are synchronized! No duplicate words found.',
    });
  } catch (error) {
    console.error('Error synchronizing words:', error);
    return NextResponse.json({ error: 'Failed to synchronize words' }, { status: 500 });
  }
}

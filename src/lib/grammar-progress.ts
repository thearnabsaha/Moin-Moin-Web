/**
 * Grammar progress tracking — stores per-chapter scores, visits, & explicit completion.
 * Uses localStorage (SSR-safe).
 */
import { ALL_GRAMMAR_CHAPTERS } from "./grammar-data";

export interface ChapterProgress {
  chapterId: string;
  visitCount: number;
  lastVisited: number | null; // timestamp
  completedAt: number | null; // timestamp — set when user marks done
  exerciseAttempts: number;
  exerciseCorrect: number;
}

export interface GrammarProgress {
  chapters: Record<string, ChapterProgress>;
  dailyActivity?: Record<string, number>; // date string -> visit count
}

const KEY = "grammar_progress_v1";

const defaultChapter = (id: string): ChapterProgress => ({
  chapterId: id,
  visitCount: 0,
  lastVisited: null,
  completedAt: null,
  exerciseAttempts: 0,
  exerciseCorrect: 0,
});

export function loadGrammarProgress(): GrammarProgress {
  if (typeof window === "undefined") return { chapters: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GrammarProgress;
  } catch {}
  return { chapters: {} };
}

export function saveGrammarProgress(p: GrammarProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function recordChapterVisit(chapterId: string): void {
  const p = loadGrammarProgress();
  const ch = p.chapters[chapterId] ?? defaultChapter(chapterId);
  ch.visitCount += 1;
  ch.lastVisited = Date.now();
  p.chapters[chapterId] = ch;
  
  const today = new Date().toISOString().split("T")[0];
  if (!p.dailyActivity) p.dailyActivity = {};
  p.dailyActivity[today] = (p.dailyActivity[today] ?? 0) + 1;
  saveGrammarProgress(p);
}

/** User marks chapter as done (or un-done). */
export function toggleChapterComplete(chapterId: string): boolean {
  const p = loadGrammarProgress();
  const ch = p.chapters[chapterId] ?? defaultChapter(chapterId);
  const nowDone = ch.completedAt === null;
  ch.completedAt = nowDone ? Date.now() : null;
  p.chapters[chapterId] = ch;
  saveGrammarProgress(p);
  return nowDone;
}

export function recordExercise(
  chapterId: string,
  correct: boolean,
): void {
  const p = loadGrammarProgress();
  const ch = p.chapters[chapterId] ?? defaultChapter(chapterId);
  ch.exerciseAttempts += 1;
  if (correct) ch.exerciseCorrect += 1;
  p.chapters[chapterId] = ch;

  const today = new Date().toISOString().split("T")[0];
  if (!p.dailyActivity) p.dailyActivity = {};
  p.dailyActivity[today] = (p.dailyActivity[today] ?? 0) + 1;
  saveGrammarProgress(p);
}

// ─── Practice (MCQ) Progress ──────────────────────────────────────────────────

export interface LevelResult {
  score: number;       // 0-10
  passed: boolean;     // score >= 7
  attempts: number;
  bestScore: number;
  lastAttempted: number; // timestamp
}

export interface PracticeProgress {
  chapters: Record<string, LevelResult[]>; // chapterId → array of 10 LevelResult
}

const PRACTICE_KEY = "grammar_practice_v1";

export function loadPracticeProgress(): PracticeProgress {
  if (typeof window === "undefined") return { chapters: {} };
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (raw) return JSON.parse(raw) as PracticeProgress;
  } catch {}
  return { chapters: {} };
}

export function savePracticeProgress(p: PracticeProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(p));
  } catch {}
}

/** Record a level attempt. Returns updated LevelResult. */
export function recordLevelAttempt(
  chapterId: string,
  levelIndex: number, // 0-9
  score: number,
): LevelResult {
  const p = loadPracticeProgress();
  if (!p.chapters[chapterId]) {
    p.chapters[chapterId] = Array.from({ length: 10 }, () => ({
      score: 0,
      passed: false,
      attempts: 0,
      bestScore: 0,
      lastAttempted: 0,
    }));
  }
  const existing = p.chapters[chapterId][levelIndex] || {
    score: 0,
    passed: false,
    attempts: 0,
    bestScore: 0,
    lastAttempted: 0,
  };
  const updated: LevelResult = {
    score,
    passed: existing.passed || score >= 7,
    attempts: existing.attempts + 1,
    bestScore: Math.max(existing.bestScore, score),
    lastAttempted: Date.now(),
  };
  p.chapters[chapterId][levelIndex] = updated;
  savePracticeProgress(p);
  return updated;
}

/**
 * Returns state of a level: 'locked' | 'unlocked' | 'passed'
 * Level 0 is always unlocked. Each subsequent level unlocks when prior is passed.
 */
export function getLevelState(
  chapterId: string,
  levelIndex: number,
  p: PracticeProgress,
): "locked" | "unlocked" | "passed" {
  const levels = p.chapters[chapterId];
  if (!levels) return levelIndex === 0 ? "unlocked" : "locked";
  if (levelIndex === 0) return levels[0]?.passed ? "passed" : "unlocked";
  const prev = levels[levelIndex - 1];
  if (!prev?.passed) return "locked";
  return levels[levelIndex]?.passed ? "passed" : "unlocked";
}

/** Wipe all grammar progress. */
export function resetGrammarProgress(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ chapters: {} }));
    localStorage.setItem(PRACTICE_KEY, JSON.stringify({ chapters: {} }));
  } catch {}
}

/** Synchronize local grammar progress with cloud database (bidirectional merge) */
export async function syncGrammarProgressWithCloud(): Promise<{
  success: boolean;
  progress: GrammarProgress;
  practice: PracticeProgress;
  completedChapterCount: number;
}> {
  const localProgress = loadGrammarProgress();
  const localPractice = loadPracticeProgress();

  try {
    const res = await fetch('/api/grammar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        progress: localProgress,
        practice: localPractice,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.progress && data.practice) {
        saveGrammarProgress(data.progress);
        savePracticeProgress(data.practice);
        return {
          success: true,
          progress: data.progress,
          practice: data.practice,
          completedChapterCount: data.completedChapterCount || 0,
        };
      }
    }
  } catch (err) {
    console.warn('[GrammarSync] Cloud sync error:', err);
  }

  return {
    success: false,
    progress: localProgress,
    practice: localPractice,
    completedChapterCount: Object.values(localProgress.chapters).filter(
      (c) => c.completedAt != null
    ).length,
  };
}

/** Derived stats used across Grammar and Dashboard */
export function computeGrammarStats(p: GrammarProgress, pp?: PracticeProgress) {
  const total = ALL_GRAMMAR_CHAPTERS.length;

  const visited = ALL_GRAMMAR_CHAPTERS.filter(
    (c) => (p.chapters[c.id]?.visitCount ?? 0) > 0,
  );
  const completed = ALL_GRAMMAR_CHAPTERS.filter(
    (c) => p.chapters[c.id]?.completedAt != null,
  );
  const withScores = ALL_GRAMMAR_CHAPTERS.filter(
    (c) => (p.chapters[c.id]?.exerciseAttempts ?? 0) > 0,
  );

  const accuracy = (chId: string): number | null => {
    const ch = p.chapters[chId];
    if (!ch || ch.exerciseAttempts === 0) return null;
    return Math.round((ch.exerciseCorrect / ch.exerciseAttempts) * 100);
  };

  const overallAccuracy =
    withScores.length > 0
      ? Math.round(
          withScores.reduce((sum, c) => sum + (accuracy(c.id) ?? 0), 0) /
            withScores.length,
        )
      : null;

  // Calculate practice completion stats
  let totalPracticeLevelsPassed = 0;
  if (pp) {
    for (const chLevels of Object.values(pp.chapters)) {
      totalPracticeLevelsPassed += chLevels.filter((lvl) => lvl.passed).length;
    }
  }

  return {
    total,
    visited: visited.length,
    completed: completed.length,
    completionPct: Math.round((completed.length / total) * 100),
    withScores: withScores.length,
    overallAccuracy,
    totalPracticeLevelsPassed,
  };
}

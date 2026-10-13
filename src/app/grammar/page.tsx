'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import {
  BookOpen,
  ChevronRight,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  Zap,
  Award,
  Sparkles,
  Layers,
  GraduationCap,
  Star,
  Flame,
  Filter,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_GRAMMAR_CHAPTERS,
  GRAMMAR_CHAPTERS_BY_LEVEL,
  type GrammarChapter,
} from '@/lib/grammar-data';
import {
  loadGrammarProgress,
  loadPracticeProgress,
  toggleChapterComplete,
  computeGrammarStats,
  syncGrammarProgressWithCloud,
  type GrammarProgress,
  type PracticeProgress,
} from '@/lib/grammar-progress';
import { PRACTICE_MAP } from '@/lib/grammar-practice-data';

const LEVELS = [
  { id: 'A0', label: 'A0', title: 'Grundlagen', desc: 'Alphabet, Phonetics & Numbers', color: '#F59E0B', lightBg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' },
  { id: 'A1', label: 'A1', title: 'Beginner', desc: 'Pronouns, Cases & Perfekt', color: '#A855F7', lightBg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.25)' },
  { id: 'A2', label: 'A2', title: 'Elementary', desc: 'Two-Way Preps & Passive', color: '#1CB0F6', lightBg: 'rgba(28, 176, 246, 0.12)', border: 'rgba(28, 176, 246, 0.25)' },
  { id: 'B1', label: 'B1', title: 'Intermediate', desc: 'Konjunktiv II & Complex Syntax', color: '#22C55E', lightBg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.25)' },
] as const;

function getDifficultyBadge(diff?: 'easy' | 'medium' | 'hard') {
  switch (diff) {
    case 'hard':
      return <span className="inline-flex items-center rounded-lg bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400 border border-red-500/25">Hard</span>;
    case 'medium':
      return <span className="inline-flex items-center rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/25">Medium</span>;
    default:
      return <span className="inline-flex items-center rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">Easy</span>;
  }
}

export default function GrammarPage() {
  const [activeLevel, setActiveLevel] = useState<string>('A1');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'uncompleted'>('all');

  const [grammarProgress, setGrammarProgress] = useState<GrammarProgress>({ chapters: {} });
  const [practiceProgress, setPracticeProgress] = useState<PracticeProgress>({ chapters: {} });
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  const handleSyncGrammar = async () => {
    setSyncing(true);
    const toastId = toast.loading('Syncing grammar with phone & cloud...');
    try {
      const res = await syncGrammarProgressWithCloud();
      toast.dismiss(toastId);
      if (res.success) {
        setGrammarProgress(res.progress);
        setPracticeProgress(res.practice);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(timeStr);
        toast.success(`Grammar synchronized! ${res.completedChapterCount} chapters in sync across devices.`);
      } else {
        toast.info('Local grammar progress is up to date.');
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to sync grammar progress');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setGrammarProgress(loadGrammarProgress());
    setPracticeProgress(loadPracticeProgress());
    setMounted(true);

    syncGrammarProgressWithCloud().then((res) => {
      if (res.success) {
        setGrammarProgress(res.progress);
        setPracticeProgress(res.practice);
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    return computeGrammarStats(grammarProgress, practiceProgress);
  }, [grammarProgress, practiceProgress]);

  const activeLevelConfig = useMemo(() => {
    return LEVELS.find((l) => l.id === activeLevel) || LEVELS[1];
  }, [activeLevel]);

  const levelChapters = useMemo(() => {
    return GRAMMAR_CHAPTERS_BY_LEVEL[activeLevel] || [];
  }, [activeLevel]);

  const levelCompletedCount = useMemo(() => {
    return levelChapters.filter((c) => grammarProgress.chapters[c.id]?.completedAt != null).length;
  }, [levelChapters, grammarProgress]);

  const levelPct = levelChapters.length > 0 ? Math.round((levelCompletedCount / levelChapters.length) * 100) : 0;

  const filteredChapters = useMemo(() => {
    return levelChapters.filter((ch) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ch.title.toLowerCase().includes(q) ||
        ch.subtitle.toLowerCase().includes(q) ||
        (ch.rule && ch.rule.toLowerCase().includes(q)) ||
        (ch.tags && ch.tags.some((t) => t.toLowerCase().includes(q)));

      const matchesDiff = difficultyFilter === 'all' || (ch.difficulty || 'easy') === difficultyFilter;

      const isDone = grammarProgress.chapters[ch.id]?.completedAt != null;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && isDone) ||
        (statusFilter === 'uncompleted' && !isDone);

      return matchesSearch && matchesDiff && matchesStatus;
    });
  }, [levelChapters, searchQuery, difficultyFilter, statusFilter, grammarProgress]);

  const handleToggleComplete = (e: React.MouseEvent, chapterId: string) => {
    e.preventDefault();
    e.stopPropagation();
    toggleChapterComplete(chapterId);
    setGrammarProgress(loadGrammarProgress());
    syncGrammarProgressWithCloud().catch(() => {});
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="German Grammar Masterclass"
        subtitle="64 structured chapters from A0 to B1 with clear rules, tables, 10-level practice drills, audio, and AI tutoring."
        action={
          <button
            onClick={handleSyncGrammar}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent)] transition-all active:scale-95 disabled:opacity-60"
            title="Synchronize grammar chapters and scores between Web and Phone"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin text-[var(--accent)]' : 'text-[var(--accent)]'} />
            <span className="hidden sm:inline">Sync with Phone</span>
            <span className="sm:hidden">Sync</span>
            {lastSyncedTime && (
              <span className="hidden md:inline text-[10px] font-normal text-[var(--text-tertiary)]">
                ({lastSyncedTime})
              </span>
            )}
          </button>
        }
      />

      {/* ─── Hero Overview Bento Grid ─── */}
      <motion.div
        className="mt-6 grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <GlassCard hover={false} className="flex items-center gap-3.5 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <BookOpen size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">{ALL_GRAMMAR_CHAPTERS.length}</p>
            <p className="text-xs font-medium text-[var(--text-tertiary)] truncate">Total Chapters</p>
          </div>
        </GlassCard>

        <GlassCard hover={false} className="flex items-center gap-3.5 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
              {stats.completed} <span className="text-xs sm:text-sm font-normal text-[var(--text-tertiary)]">/ {stats.total}</span>
            </p>
            <p className="text-xs font-medium text-[var(--text-tertiary)] truncate">Chapters Done</p>
          </div>
        </GlassCard>

        <GlassCard hover={false} className="flex items-center gap-3.5 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Award size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">{stats.totalPracticeLevelsPassed}</p>
            <p className="text-xs font-medium text-[var(--text-tertiary)] truncate">Levels Mastered</p>
          </div>
        </GlassCard>

        <GlassCard hover={false} className="flex items-center justify-center p-3 sm:p-4">
          <ProgressRing
            progress={stats.completionPct}
            size={68}
            strokeWidth={6}
            color="#A855F7"
            label={`${stats.completionPct}%`}
            sublabel="Mastery"
          />
        </GlassCard>
      </motion.div>

      {/* ─── Level Navigation Tabs (Duolingo Pill Selector) ─── */}
      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {LEVELS.map((lvl) => {
          const isActive = activeLevel === lvl.id;
          const chapters = GRAMMAR_CHAPTERS_BY_LEVEL[lvl.id] || [];
          const done = chapters.filter((c) => grammarProgress.chapters[c.id]?.completedAt != null).length;
          const pct = chapters.length > 0 ? Math.round((done / chapters.length) * 100) : 0;

          return (
            <button
              key={lvl.id}
              onClick={() => setActiveLevel(lvl.id)}
              className={`group relative flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 text-left transition-all border shadow-sm hover:shadow-md active:translate-y-[1px] ${
                isActive
                  ? 'bg-[var(--bg-secondary)] border-2 shadow-md'
                  : 'bg-[var(--bg-secondary)]/70 border-[var(--border)] hover:bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]/40'
              }`}
              style={{
                borderColor: isActive ? lvl.color : undefined,
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className="inline-flex h-6 items-center rounded-lg px-2 text-xs font-black"
                  style={{ backgroundColor: lvl.lightBg, color: lvl.color }}
                >
                  {lvl.label}
                </span>

                <ProgressRing
                  progress={pct}
                  size={36}
                  strokeWidth={3.5}
                  color={lvl.color}
                  label={`${pct}%`}
                />
              </div>

              <div className="mt-3">
                <p className="font-extrabold text-sm text-[var(--text-primary)] leading-tight">{lvl.title}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--text-tertiary)] truncate">
                  {chapters.length} chapters · {done} done
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── Search & Filters Bar ─── */}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeLevel} grammar topics, rules, or keywords...`}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] py-2.5 pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Filter */}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as any)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none shadow-sm"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none shadow-sm"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="uncompleted">Incomplete</option>
          </select>
        </div>
      </div>

      {/* ─── Chapter Bento Grid ─── */}
      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-tertiary)]">
            {activeLevel} Chapters · {filteredChapters.length} shown ({levelPct}% Completed)
          </p>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredChapters.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-[var(--border)] py-16 text-center"
            >
              <BookOpen size={40} className="mx-auto text-[var(--text-tertiary)]" />
              <p className="mt-3 text-base font-bold text-[var(--text-primary)]">No matching chapters found</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Try adjusting your search query or filters.</p>
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 auto-rows-fr">
              {filteredChapters.map((ch, idx) => {
                const isCompleted = grammarProgress.chapters[ch.id]?.completedAt != null;
                const hasPractice = !!PRACTICE_MAP[ch.id];
                const practiceLevels = practiceProgress.chapters[ch.id] || [];
                const passedCount = practiceLevels.filter((lvl) => lvl.passed).length;

                return (
                  <motion.div
                    key={ch.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                    className="h-full"
                  >
                    <Link href={`/grammar/${ch.id}`} className="group block h-full">
                      <GlassCard
                        className={`btn-3d relative flex h-full flex-col justify-between p-5 transition-all group-hover:border-[var(--accent)]/50 ${
                          isCompleted ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : ''
                        }`}
                      >
                        <div>
                          {/* Top row: Number, Difficulty, Completed toggle */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-1 text-xs font-black text-[var(--text-primary)]">
                                Ch. {ch.number}
                              </span>
                              {getDifficultyBadge(ch.difficulty)}
                              {ch.estimatedMinutes && (
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-tertiary)]">
                                  <Clock size={12} />
                                  {ch.estimatedMinutes}m
                                </span>
                              )}
                            </div>

                            {/* Mark complete toggle */}
                            <button
                              onClick={(e) => handleToggleComplete(e, ch.id)}
                              title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                              className={`rounded-full p-1.5 transition-all ${
                                isCompleted
                                  ? 'text-emerald-500 hover:bg-emerald-500/10'
                                  : 'text-[var(--text-tertiary)] hover:text-emerald-500 hover:bg-[var(--bg-tertiary)]'
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 size={20} className="fill-emerald-500 text-white dark:text-black" /> : <Circle size={20} />}
                            </button>
                          </div>

                          {/* Title & Subtitle */}
                          <div className="mt-3.5">
                            <h3 className="text-base font-extrabold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug">
                              {ch.title}
                            </h3>
                            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] leading-normal">
                              {ch.subtitle}
                            </p>
                          </div>

                          {/* Rule / Key takeaway preview */}
                          {ch.rule && (
                            <div className="mt-3 rounded-xl bg-[var(--bg-tertiary)]/70 p-3 text-xs text-[var(--text-secondary)] line-clamp-2 border border-[var(--border)]">
                              <span className="font-extrabold text-[var(--text-primary)]">Rule: </span>
                              {ch.rule}
                            </div>
                          )}

                          {/* Theory snippet fallback */}
                          {!ch.rule && ch.explanation && (
                            <p className="mt-2.5 text-xs text-[var(--text-tertiary)] line-clamp-2 leading-relaxed">
                              {ch.explanation}
                            </p>
                          )}
                        </div>

                        {/* Bottom Row: Practice status & Arrow */}
                        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                          <div className="flex items-center gap-2">
                            {hasPractice && (
                              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Star size={12} className="fill-amber-500 text-amber-500" />
                                <span>{passedCount}/10 Levels</span>
                              </div>
                            )}
                            <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                              {ch.examples.length} ex · {ch.exercises.length} drills
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-xs font-black text-[var(--accent)] group-hover:translate-x-1 transition-transform">
                            <span>Open</span>
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

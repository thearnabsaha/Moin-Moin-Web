'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { RatingButtons } from '@/components/practice/rating-buttons';
import {
  Brain,
  BookOpen,
  Tag,
  Loader2,
  CheckCircle2,
  XCircle,
  Volume2,
  ArrowRight,
  Headphones,
  MessageSquareQuote,
} from 'lucide-react';
import { sfx } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { matchesMeaning } from '@/lib/word-matching';

type PracticeMode = 'flashcard' | 'meaning' | 'gender' | null;

interface UserWord {
  id: string;
  word: string;
  partOfSpeech: string;
  gender: string | null;
  pluralForm: string | null;
  conjugation: Record<string, string> | null;
  meaning: string;
  cefrLevel: string;
  exampleSentence: string | null;
}

const MODES: Array<{
  id: PracticeMode;
  title: string;
  description: string;
  icon: typeof Brain;
  color: string;
  bgColor: string;
}> = [
  {
    id: 'flashcard',
    title: 'Flashcard Review',
    description: 'Classic FSRS-based review',
    icon: Brain,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'meaning',
    title: 'Meaning Recall',
    description: 'See German, type the English meaning',
    icon: BookOpen,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
  },
  {
    id: 'gender',
    title: 'Gender Test',
    description: 'der/die/das for nouns only',
    icon: Tag,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
  },
];

function stripArticle(word: string): string {
  return word.replace(/^(der|die|das|ein|eine|einen|einem|einer)\s+/i, '').trim();
}



export default function PracticePage() {
  const [mode, setMode] = useState<PracticeMode>(null);
  const [queue, setQueue] = useState<UserWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  // Meaning mode
  const [meaningInput, setMeaningInput] = useState('');

  // Gender mode
  const [genderInput, setGenderInput] = useState('');

  const fetchQueue = useCallback(async () => {
    if (!mode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/practice/queue?mode=${mode}&limit=10`);
      const data = await res.json();
      setQueue(data.words || []);
      setCurrentIndex(0);
      setRevealed(false);
      setAnswered(false);
      setCorrect(false);
      setMeaningInput('');
      setGenderInput('');
      if (!data.words || data.words.length === 0) {
        setSessionComplete(true);
      }
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode) fetchQueue();
  }, [mode, fetchQueue]);

  const currentWord = queue[currentIndex];
  const progress = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentWord || submitting || isTransitioning) return;
    sfx.xp();

    setSubmitting(true);
    try {
      await fetch('/api/practice/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordId: currentWord.id,
          rating,
          mode: mode || 'flashcard',
          correct,
        }),
      });
      setReviewCount((c) => c + 1);
    } catch {
      // continue
    }

    setSubmitting(false);

    if (currentIndex + 1 < queue.length) {
      if (revealed) {
        // 1. First turn the card around back to the front
        setIsTransitioning(true);
        setRevealed(false);
        sfx.swoosh();

        // 2. Only advance after the card has turned around (320ms)
        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
          setAnswered(false);
          setMeaningInput('');
          setGenderInput('');
          setIsTransitioning(false);
        }, 320);
      } else {
        sfx.swoosh();
        setCurrentIndex((i) => i + 1);
        setAnswered(false);
        setMeaningInput('');
        setGenderInput('');
      }
    } else {
      setRevealed(false);
      sfx.complete();
      setSessionComplete(true);
    }
  };

  const handleReveal = () => {
    sfx.flip();
    setRevealed(true);
  };

  const handleCheckMeaning = () => {
    if (!currentWord) return;
    const ok = matchesMeaning(meaningInput, currentWord.meaning);
    setCorrect(ok);
    setAnswered(true);
    ok ? sfx.correct() : sfx.wrong();
  };

  const handleGenderCheck = () => {
    if (!currentWord || answered) return;
    const input = genderInput.trim().toLowerCase();
    const correctArticle = currentWord.gender === 'masculine' ? 'der' : currentWord.gender === 'feminine' ? 'die' : 'das';
    const ok = input === correctArticle;
    setCorrect(ok);
    setAnswered(true);
    ok ? sfx.correct() : sfx.wrong();
  };

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, []);

  // Auto-pronounce word when flashcard is displayed or word changes (after flip completes)
  useEffect(() => {
    if (mode === 'flashcard' && currentWord && !sessionComplete && !isTransitioning) {
      const timer = setTimeout(() => {
        speak(currentWord.word);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [mode, currentWord, sessionComplete, isTransitioning, speak]);

  const PRACTICE_MODULES = [
    {
      id: 'words',
      title: 'Word Batch Practice',
      description: 'Learn → Practice Test → Word Exam with 3D flashcards and batch progress.',
      href: '/practice/words',
      icon: BookOpen,
      badge: 'Full Flow',
      badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderHover: 'hover:border-emerald-500/50',
    },
    {
      id: 'listening',
      title: 'Listening Practice Lab',
      description: 'AI-generated German audio with native speed controls & Goethe exam audio drills.',
      href: '/practice/listening',
      icon: Headphones,
      badge: 'Audio Lab',
      badgeColor: 'text-purple-600 dark:text-purple-400 bg-purple-500/15',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderHover: 'hover:border-purple-500/50',
    },
    {
      id: 'expressions',
      title: 'Idioms & Expressions',
      description: 'Learn → Practice Test → Exam. Master fixed expressions, idioms & phrases.',
      href: '/practice/expressions',
      icon: MessageSquareQuote,
      badge: 'Phrases',
      badgeColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/15',
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
      borderHover: 'hover:border-teal-500/50',
    },
    {
      id: 'flashcard',
      title: 'Flashcard Review',
      description: 'Classic FSRS-4.5 spaced repetition memory intervals adapted to retention.',
      mode: 'flashcard' as const,
      icon: Brain,
      badge: 'FSRS Spaced',
      badgeColor: 'text-blue-600 dark:text-blue-400 bg-blue-500/15',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderHover: 'hover:border-blue-500/50',
    },
    {
      id: 'meaning',
      title: 'Meaning Recall',
      description: 'See German vocabulary and type the English meaning under focus.',
      mode: 'meaning' as const,
      icon: BookOpen,
      badge: 'Active Recall',
      badgeColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/15',
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      borderHover: 'hover:border-rose-500/50',
    },
    {
      id: 'gender',
      title: 'Gender Articles Test',
      description: 'Rapid-fire der, die, and das noun classification and memory training.',
      mode: 'gender' as const,
      icon: Tag,
      badge: 'Grammar',
      badgeColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/15',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderHover: 'hover:border-amber-500/50',
    },
  ];

  if (mode === null) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Practice Hub"
          subtitle="Select a practice lab or quick drill to strengthen your German recall."
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRACTICE_MODULES.map((item) => {
            const Icon = item.icon;
            const isLink = !!item.href;

            const cardContent = (
              <GlassCard
                hover={true}
                className={cn(
                  'h-full flex flex-col justify-between p-6 transition-all border-2 border-[var(--border)] cursor-pointer group',
                  item.borderHover
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={cn('rounded-2xl p-3.5', item.bgColor, item.color)}>
                      <Icon size={24} />
                    </div>
                    <span className={cn('rounded-lg px-2.5 py-1 text-[11px] font-black', item.badgeColor)}>
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)]/60 flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                  <span>{isLink ? 'Open Practice Lab' : 'Start Drill'}</span>
                  <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                </div>
              </GlassCard>
            );

            if (isLink) {
              return (
                <Link key={item.id} href={item.href!} onClick={() => sfx.tap()} className="block h-full">
                  {cardContent}
                </Link>
              );
            }

            return (
              <div
                key={item.id}
                onClick={() => {
                  sfx.tap();
                  setMode(item.mode!);
                }}
                className="h-full"
              >
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            setMode(null);
            setQueue([]);
            setSessionComplete(false);
            setReviewCount(0);
          }}
          className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          ← Back
        </button>
        <PageHeader
          title={
            MODES.find((m) => m.id === mode)?.title || 'Practice'
          }
          subtitle={`${mode} mode`}
        />
      </div>

      {!sessionComplete && queue.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>
              {currentIndex + 1} / {queue.length}
            </span>
            <span>{reviewCount} reviewed</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
      )}

      <div className="mt-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                Building your queue...
              </p>
            </motion.div>
          ) : sessionComplete ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-20"
            >
              <GlassCard hover={false} className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                </motion.div>
                <h2 className="mt-4 text-xl font-semibold">Session Complete</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {reviewCount > 0
                    ? `You reviewed ${reviewCount} words. Great work!`
                    : 'No words available for this mode. Upload vocabulary first!'}
                </p>
                {queue.length === 0 && (
                  <Link href="/vocabulary" className="btn-primary mt-6 inline-flex">
                    Go to Vocabulary
                  </Link>
                )}
                {queue.length > 0 && (
                  <motion.button
                    className="btn-primary mt-6"
                    onClick={() => {
                      setSessionComplete(false);
                      setReviewCount(0);
                      fetchQueue();
                    }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    New Session
                  </motion.button>
                )}
              </GlassCard>
            </motion.div>
          ) : currentWord ? (
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Flashcard */}
              {mode === 'flashcard' && (
                <div className="mx-auto w-full max-w-lg">
                  <div className="flashcard-flip mx-auto w-full">
                    <div
                      className={`flashcard-inner relative transition-transform duration-500 cursor-pointer ${revealed ? 'flipped' : ''}`}
                      style={{ minHeight: 400 }}
                      onClick={() => !revealed && handleReveal()}
                    >
                      {/* ── CARD FRONT ── */}
                      <div className="flashcard-front absolute inset-0">
                        <div className="flex h-full flex-col justify-between rounded-[32px] border-2 border-black/[0.08] dark:border-white/[0.12] bg-[var(--bg-card)] p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/20 text-center relative select-none">
                          {/* Top Badges & Sound Button */}
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              {currentWord.partOfSpeech && (
                                <span className="rounded-full border border-purple-400/80 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-black text-purple-600 dark:text-purple-300">
                                  {currentWord.partOfSpeech.charAt(0).toUpperCase() + currentWord.partOfSpeech.slice(1)}
                                </span>
                              )}
                              {currentWord.cefrLevel && (
                                <span className="rounded-full border border-emerald-500/80 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-300">
                                  {currentWord.cefrLevel}
                                </span>
                              )}
                              {currentWord.gender && (
                                <span
                                  className={cn(
                                    'rounded-full border px-3 py-1 text-xs font-black',
                                    currentWord.gender === 'masculine'
                                      ? 'border-blue-400/80 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'
                                      : currentWord.gender === 'feminine'
                                        ? 'border-rose-400/80 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300'
                                        : 'border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300'
                                  )}
                                >
                                  {currentWord.gender === 'masculine'
                                    ? 'Masculine'
                                    : currentWord.gender === 'feminine'
                                      ? 'Feminine'
                                      : 'Neuter'}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speak(currentWord.word);
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--accent)]/15 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm"
                              title="Pronounce"
                            >
                              <Volume2 size={20} />
                            </button>
                          </div>

                          {/* Center German Word & Article Tag */}
                          <div className="my-auto py-6 flex flex-col items-center">
                            <motion.h2
                              className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--text-primary)]"
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            >
                              {currentWord.word}
                            </motion.h2>

                            {currentWord.gender && (
                              <span
                                className={cn(
                                  'mt-3 inline-flex items-center justify-center px-4 py-1 rounded-full border text-xs font-black',
                                  currentWord.gender === 'masculine'
                                    ? 'border-blue-400/80 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300'
                                    : currentWord.gender === 'feminine'
                                      ? 'border-rose-400/80 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300'
                                      : 'border-amber-400/80 bg-amber-50/50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-300'
                                )}
                              >
                                {currentWord.gender === 'masculine' ? 'der' : currentWord.gender === 'feminine' ? 'die' : 'das'}
                              </span>
                            )}
                          </div>

                          {/* Example Box */}
                          {currentWord.exampleSentence ? (
                            <div className="w-full rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/80 dark:bg-sky-950/30 p-4 sm:p-5 text-left relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500 rounded-l" />
                              <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                                EXAMPLE
                              </span>
                              <p className="mt-1 text-sm sm:text-base font-semibold italic text-[var(--text-primary)] leading-relaxed">
                                „{currentWord.exampleSentence}"
                              </p>
                            </div>
                          ) : (
                            <div className="h-6" />
                          )}

                          {/* Bottom Helper */}
                          <div className="mt-4 text-xs font-bold text-[var(--text-tertiary)]">
                            Tap to reveal meaning
                          </div>
                        </div>
                      </div>

                      {/* ── CARD BACK ── */}
                      <div className="flashcard-back absolute inset-0">
                        <div className="flex h-full flex-col justify-between rounded-[32px] border-2 border-[var(--accent)]/40 bg-[var(--bg-secondary)] p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/20 text-center relative select-none">
                          {/* Top Badges & Sound Button */}
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              {currentWord.partOfSpeech && (
                                <span className="rounded-full border border-purple-400/80 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-black text-purple-600 dark:text-purple-300">
                                  {currentWord.partOfSpeech.charAt(0).toUpperCase() + currentWord.partOfSpeech.slice(1)}
                                </span>
                              )}
                              {currentWord.cefrLevel && (
                                <span className="rounded-full border border-emerald-500/80 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-300">
                                  {currentWord.cefrLevel}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speak(currentWord.word);
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--accent)]/15 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shadow-sm"
                              title="Pronounce"
                            >
                              <Volume2 size={20} />
                            </button>
                          </div>

                          {/* Center Meaning */}
                          <div className="my-auto py-4 flex flex-col items-center">
                            <p className="text-sm font-bold text-[var(--text-tertiary)]">
                              {currentWord.word}
                            </p>

                            <motion.h3
                              className="mt-1 text-3xl sm:text-4xl font-black text-[var(--accent)] tracking-tight"
                              initial={{ scale: 0.95 }}
                              animate={{ scale: 1 }}
                            >
                              {currentWord.meaning}
                            </motion.h3>

                            {/* Example Sentence Box */}
                            {currentWord.exampleSentence && (
                              <div className="mt-4 w-full rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/80 dark:bg-sky-950/30 p-3.5 text-left relative overflow-hidden max-w-md">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500 rounded-l" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                                  EXAMPLE
                                </span>
                                <p className="mt-0.5 text-xs sm:text-sm font-semibold italic text-[var(--text-primary)]">
                                  „{currentWord.exampleSentence}"
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 text-xs font-bold text-[var(--text-tertiary)]">
                            Select below how well you recalled this word:
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 text-center text-xs font-bold text-[var(--text-tertiary)]">
                    Tap the card to flip
                  </p>
                </div>
              )}

              {/* Meaning Recall */}
              {mode === 'meaning' && (
                <GlassCard hover={false} className="text-center">
                  <h2 className="text-3xl font-semibold">{currentWord.word}</h2>
                  {currentWord.exampleSentence && (
                    <p className="mt-4 text-sm italic text-[var(--text-tertiary)]">
                      {currentWord.exampleSentence}
                    </p>
                  )}
                  <div className="mt-6">
                    <input
                      type="text"
                      placeholder="Type the English meaning..."
                      value={meaningInput}
                      onChange={(e) => setMeaningInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCheckMeaning()}
                      disabled={answered}
                      className="input-field w-full"
                    />
                    {!answered && (
                      <button
                        className="btn-primary mt-4"
                        onClick={handleCheckMeaning}
                      >
                        Check
                      </button>
                    )}
                  </div>
                </GlassCard>
              )}

              {/* Gender Test */}
              {mode === 'gender' && (
                <GlassCard hover={false} className="text-center">
                  <p className="text-sm text-[var(--text-tertiary)]">What is the article?</p>
                  <h2 className="mt-4 text-3xl font-semibold">{stripArticle(currentWord.word)}</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">({currentWord.meaning})</p>
                  <div className="mt-6">
                    <input
                      type="text"
                      placeholder="der / die / das"
                      value={genderInput}
                      onChange={(e) => setGenderInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !answered && handleGenderCheck()}
                      disabled={answered}
                      className="input-field mx-auto max-w-[200px] text-center text-lg"
                      autoFocus
                    />
                    {!answered && (
                      <button className="btn-primary mt-4" onClick={handleGenderCheck} disabled={!genderInput.trim()}>
                        Check
                      </button>
                    )}
                  </div>
                  {answered && (
                    <div className="mt-4">
                      {correct ? (
                        <p className="text-emerald-600 dark:text-emerald-400 font-medium">Correct!</p>
                      ) : (
                        <p className="text-red-600 dark:text-red-400">
                          Wrong. Correct: <strong>{currentWord.gender === 'masculine' ? 'der' : currentWord.gender === 'feminine' ? 'die' : 'das'} {stripArticle(currentWord.word)}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </GlassCard>
              )}

              {/* FSRS rating (after answer for meaning/gender, after reveal for flashcard) */}
              <AnimatePresence>
                {((mode === 'flashcard' && revealed) ||
                  (mode !== 'flashcard' && answered)) && (
                  <motion.div
                    className="mt-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                  >
                    {(mode === 'meaning' || mode === 'gender') && (
                      <div className="mb-6 flex items-center justify-center gap-2">
                        {correct ? (
                          <CheckCircle2 size={24} className="text-emerald-500" />
                        ) : (
                          <XCircle size={24} className="text-red-500" />
                        )}
                        <span
                          className={
                            correct
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {correct ? 'Correct!' : 'Incorrect'}
                        </span>
                      </div>
                    )}
                    <RatingButtons onRate={handleRate} disabled={submitting} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

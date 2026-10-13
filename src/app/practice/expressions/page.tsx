'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import {
  Lock,
  CheckCircle2,
  Volume2,
  Loader2,
  ArrowLeft,
  BookOpen,
  PenLine,
  Pencil,
  Trash2,
  Plus,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { sfx } from '@/lib/sounds';
import { cachedFetch, invalidateCache } from '@/lib/client-cache';
import { checkWordOnly, matchesMeaning, normalizeGerman } from '@/lib/word-matching';

interface UserExpression {
  id: string;
  expression: string;
  meaning: string;
  literalTranslation: string | null;
  register: string | null;
  cefrLevel: string;
  exampleSentence: string | null;
  usageNote: string | null;
  category: string | null;
  learned: boolean;
  batchId: string | null;
}

interface ExprBatch {
  id: string;
  userId: string;
  name: string;
  expressionCount: number;
  learnedCount: number;
  practiceUnlocked: boolean;
  examUnlocked: boolean;
  createdAt: string;
  expressions: UserExpression[];
}

type FlowMode = 'list' | 'learn' | 'practice' | 'exam' | 'select_exprs' | 'filters' | 'expr_only';
type QuestionType = 'meaning' | 'fill_blank';
type DirectionFilter = 'de_to_en' | 'en_to_de' | 'both';



function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/[.,;:!?]/g, '');
}

function getQuestionForExpr(
  expr: UserExpression,
  direction: DirectionFilter
): { type: QuestionType; prompt: string; correctAnswer: string } {
  const types: QuestionType[] = ['meaning'];
  if (expr.exampleSentence) types.push('fill_blank');

  const type = types[Math.floor(Math.random() * types.length)];

  if (type === 'fill_blank' && expr.exampleSentence) {
    const blanked = expr.exampleSentence.replace(new RegExp(expr.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '___');
    if (blanked !== expr.exampleSentence) {
      return { type: 'fill_blank', prompt: blanked, correctAnswer: expr.expression };
    }
  }

  const deToEn = direction === 'de_to_en' || (direction === 'both' && Math.random() > 0.5);
  return deToEn
    ? { type: 'meaning', prompt: expr.expression, correctAnswer: expr.meaning }
    : { type: 'meaning', prompt: expr.meaning, correctAnswer: expr.expression };
}

function checkAnswer(type: QuestionType, userAnswer: string, correctAnswer: string): boolean {
  if (type === 'meaning') return matchesMeaning(userAnswer, correctAnswer);
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
}

const checkExprOnly = checkWordOnly;

type ExprOnlyDirection = 'de_to_en' | 'en_to_de' | 'both';

export default function PracticeExpressionsPage() {
  const [batches, setBatches] = useState<ExprBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [flowMode, setFlowMode] = useState<FlowMode>('list');
  const [selectedBatch, setSelectedBatch] = useState<ExprBatch | null>(null);

  const [learnIndex, setLearnIndex] = useState(0);
  const [xpFloat, setXpFloat] = useState<number | null>(null);

  const [practiceExprs, setPracticeExprs] = useState<UserExpression[]>([]);
  const [practiceQuestions, setPracticeQuestions] = useState<Array<{ type: QuestionType; prompt: string; correctAnswer: string }>>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceAnswered, setPracticeAnswered] = useState(false);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceCorrectCount, setPracticeCorrectCount] = useState(0);
  const [practiceComplete, setPracticeComplete] = useState(false);

  const [examQuestions, setExamQuestions] = useState<Array<{ expr: UserExpression; type: QuestionType; prompt: string; correctAnswer: string }>>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examInput, setExamInput] = useState('');
  const [examAnswers, setExamAnswers] = useState<Array<{ expressionId: string; type: string; userAnswer: string; correctAnswer: string; correct: boolean }>>([]);
  const [examTimeLeft, setExamTimeLeft] = useState(60);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examResult, setExamResult] = useState<{
    score: number; maxScore: number; xpEarned: number; meaningAccuracy: number | null;
    answers: Array<{ expressionId: string; type: string; userAnswer: string; correctAnswer: string; correct: boolean }>;
  } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('both');
  const [pendingMode, setPendingMode] = useState<'practice' | 'exam'>('practice');

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingBatchName, setEditingBatchName] = useState('');
  const [deleteConfirmBatch, setDeleteConfirmBatch] = useState<ExprBatch | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [addExprBatch, setAddExprBatch] = useState<ExprBatch | null>(null);
  const [addExprInput, setAddExprInput] = useState('');
  const [addExprLoading, setAddExprLoading] = useState(false);

  const [eoDirection, setEoDirection] = useState<ExprOnlyDirection>('de_to_en');
  const [eoExprs, setEoExprs] = useState<Array<{ expr: UserExpression; prompt: string; correctAnswer: string }>>([]);
  const [eoIndex, setEoIndex] = useState(0);
  const [eoInput, setEoInput] = useState('');
  const [eoAnswered, setEoAnswered] = useState(false);
  const [eoCorrect, setEoCorrect] = useState(false);
  const [eoCorrectCount, setEoCorrectCount] = useState(0);
  const [eoComplete, setEoComplete] = useState(false);
  const [eoStartTime, setEoStartTime] = useState(0);
  const [eoTotalTime, setEoTotalTime] = useState(0);

  const fetchBatches = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) invalidateCache('/api/practice/expression-batches');
    setLoading(true);
    try {
      const data = await cachedFetch<{ batches: ExprBatch[] }>('/api/practice/expression-batches', 30000);
      setBatches(data.batches || []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (flowMode !== 'exam' || examSubmitted || examQuestions.length === 0) return;
    const t = setInterval(() => { setExamTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1)); }, 1000);
    return () => clearInterval(t);
  }, [flowMode, examSubmitted, examQuestions.length]);

  const handleExamSubmit = useCallback(async () => {
    if (examSubmitted || !selectedBatch) return;
    setExamSubmitted(true);
    const currentQ = examQuestions[examIndex];
    const userAns = examInput.trim();
    const correct = currentQ ? checkAnswer(currentQ.type, userAns, currentQ.correctAnswer) : false;
    const newAnswers = [...examAnswers];
    if (currentQ) newAnswers.push({ expressionId: currentQ.expr.id, type: currentQ.type, userAnswer: userAns, correctAnswer: currentQ.correctAnswer, correct });
    for (let i = examIndex + 1; i < examQuestions.length; i++) {
      const q = examQuestions[i];
      newAnswers.push({ expressionId: q.expr.id, type: q.type, userAnswer: '', correctAnswer: q.correctAnswer, correct: false });
    }
    const timeSpent = 60 - examTimeLeft;
    try {
      const res = await fetch(`/api/practice/expression-batches/${selectedBatch.id}/exam`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: newAnswers, timeSpent }),
      });
      const data = await res.json();
      setExamResult({ score: data.score ?? 0, maxScore: data.maxScore ?? 0, xpEarned: data.xpEarned ?? 0, meaningAccuracy: data.meaningAccuracy ?? null, answers: newAnswers });
      sfx.complete();
    } catch {
      setExamResult({ score: newAnswers.filter((a) => a.correct).length, maxScore: newAnswers.length, xpEarned: 0, meaningAccuracy: null, answers: newAnswers });
    }
  }, [examSubmitted, selectedBatch, examIndex, examInput, examQuestions, examAnswers, examTimeLeft]);

  useEffect(() => {
    if (flowMode === 'exam' && examTimeLeft === 0 && !examSubmitted && selectedBatch && examQuestions.length > 0) handleExamSubmit();
  }, [flowMode, examTimeLeft, examSubmitted, selectedBatch, examQuestions.length, handleExamSubmit]);

  const startLearn = (batch: ExprBatch) => { if (!batch.expressions.length) return; setSelectedBatch(batch); setFlowMode('learn'); setLearnIndex(0); setXpFloat(null); };
  const startPractice = (batch: ExprBatch) => { if (!batch.practiceUnlocked) return; setSelectedBatch(batch); setSelectedIds(new Set(batch.expressions.map((e) => e.id))); setPendingMode('practice'); setFlowMode('select_exprs'); };
  const startExam = (batch: ExprBatch) => { if (!batch.examUnlocked) return; setSelectedBatch(batch); setSelectedIds(new Set(batch.expressions.map((e) => e.id))); setPendingMode('exam'); setFlowMode('select_exprs'); };

  const proceedFromSelect = () => { if (!selectedBatch) return; const sel = selectedBatch.expressions.filter((e) => selectedIds.has(e.id)); if (sel.length === 0) return; setFlowMode('filters'); };

  const proceedFromFilters = () => {
    if (!selectedBatch) return;
    const selected = selectedBatch.expressions.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) return;
    const shuffled = [...selected].sort(() => Math.random() - 0.5);
    if (pendingMode === 'practice') {
      const pairs = shuffled.map((e) => ({ expr: e, q: getQuestionForExpr(e, directionFilter) }));
      setPracticeExprs(pairs.map((p) => p.expr));
      setPracticeQuestions(pairs.map((p) => p.q));
      setPracticeIndex(0); setPracticeInput(''); setPracticeAnswered(false); setPracticeCorrectCount(0); setPracticeComplete(false);
      setFlowMode('practice');
    } else {
      const questions = shuffled.map((e) => ({ expr: e, ...getQuestionForExpr(e, directionFilter) }));
      setExamQuestions(questions); setExamIndex(0); setExamInput(''); setExamAnswers([]); setExamTimeLeft(60); setExamSubmitted(false); setExamResult(null);
      setFlowMode('exam');
    }
  };

  const startExprOnly = (batch: ExprBatch, direction: ExprOnlyDirection) => {
    if (batch.expressions.length === 0) return;
    setSelectedBatch(batch);
    const shuffled = [...batch.expressions].sort(() => Math.random() - 0.5);
    const pairs = shuffled.map((e) => {
      const dir = direction === 'both' ? (Math.random() > 0.5 ? 'de_to_en' : 'en_to_de') : direction;
      return { expr: e, prompt: dir === 'de_to_en' ? e.expression : e.meaning, correctAnswer: dir === 'de_to_en' ? e.meaning : e.expression };
    });
    setEoExprs(pairs); setEoDirection(direction); setEoIndex(0); setEoInput(''); setEoAnswered(false); setEoCorrectCount(0); setEoComplete(false); setEoStartTime(Date.now()); setEoTotalTime(0);
    setFlowMode('expr_only');
  };

  const handleEoCheck = () => { const current = eoExprs[eoIndex]; if (!current || eoAnswered) return; const correct = checkExprOnly(eoInput, current.correctAnswer); setEoCorrect(correct); setEoAnswered(true); correct ? sfx.correct() : sfx.wrong(); if (correct) setEoCorrectCount((c) => c + 1); };
  const handleEoNext = () => { if (eoIndex + 1 >= eoExprs.length) { setEoComplete(true); setEoTotalTime(Math.round((Date.now() - eoStartTime) / 1000)); sfx.complete(); return; } setEoIndex((i) => i + 1); setEoInput(''); setEoAnswered(false); setEoCorrect(false); sfx.swoosh(); };

  const handleBatchRename = async (batchId: string, newName: string) => { try { await fetch(`/api/practice/expression-batches/${batchId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) }); setEditingBatchId(null); fetchBatches(); sfx.correct(); } catch { toast.error('Failed to rename'); } };
  const handleBatchDelete = async (batch: ExprBatch) => { if (deleteConfirmInput !== 'RESET') return; try { await fetch(`/api/practice/expression-batches/${batch.id}`, { method: 'DELETE' }); setDeleteConfirmBatch(null); setDeleteConfirmInput(''); fetchBatches(); setFlowMode('list'); setSelectedBatch(null); toast.success('Batch deleted'); sfx.complete(); } catch { toast.error('Failed to delete'); } };

  const handleAddExprs = async () => {
    if (!addExprBatch || !addExprInput.trim()) return;
    setAddExprLoading(true);
    try {
      const res = await fetch(`/api/practice/expression-batches/${addExprBatch.id}/expressions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expressions: addExprInput }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAddExprBatch(null); setAddExprInput(''); fetchBatches(); toast.success(`Added ${data.added ?? 0} expressions`); sfx.complete();
    } catch { toast.error('Failed to add expressions'); } finally { setAddExprLoading(false); }
  };

  const handleLearnNext = async () => {
    if (!selectedBatch) return;
    const expr = selectedBatch.expressions[learnIndex];
    if (!expr) return;
    sfx.xp(); setXpFloat(Date.now());
    try { await fetch(`/api/practice/expression-batches/${selectedBatch.id}/learn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expressionId: expr.id }) }); } catch {}
    if (learnIndex + 1 >= selectedBatch.expressions.length) { sfx.complete(); setTimeout(() => { setFlowMode('list'); setSelectedBatch(null); fetchBatches(); }, 1500); } else { sfx.swoosh(); setLearnIndex((i) => i + 1); setXpFloat(null); }
  };

  const handlePracticeCheck = () => {
    const correctAnswer = practiceQuestions[practiceIndex]?.correctAnswer;
    if (!correctAnswer) return;
    const correct = checkAnswer(practiceQuestions[practiceIndex]!.type, practiceInput, correctAnswer);
    setPracticeCorrect(correct); setPracticeAnswered(true); correct ? sfx.correct() : sfx.wrong(); if (correct) setPracticeCorrectCount((c) => c + 1);
  };

  const handlePracticeNext = async () => {
    const correctCount = practiceCorrectCount + (practiceCorrect ? 1 : 0);
    if (practiceIndex + 1 >= practiceExprs.length) {
      try { await fetch(`/api/practice/expression-batches/${selectedBatch!.id}/practice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correctCount, totalCount: practiceExprs.length }) }); } catch {}
      if (correctCount / practiceExprs.length >= 0.7) sfx.levelUp();
      setPracticeComplete(true);
    } else { setPracticeIndex((i) => i + 1); setPracticeInput(''); setPracticeAnswered(false); sfx.swoosh(); }
  };

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  // Auto-pronounce expression when learn card opens or index changes
  useEffect(() => {
    if (flowMode === 'learn' && selectedBatch && selectedBatch.expressions[learnIndex]) {
      const expr = selectedBatch.expressions[learnIndex]?.expression;
      if (expr) {
        const timer = setTimeout(() => {
          speak(expr);
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [flowMode, selectedBatch, learnIndex, speak]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <AnimatePresence mode="wait">
        {flowMode === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <PageHeader title="Practice Expressions" subtitle="Learn → Practice → Exam" />
            {loading ? (
              <div className="mt-10 flex flex-col items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading batches...</p>
              </div>
            ) : batches.length === 0 ? (
              <motion.div className="mt-10 rounded-2xl border border-dashed border-[var(--border)] py-16 text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <BookOpen size={48} className="mx-auto text-[var(--text-tertiary)]" />
                <p className="mt-4 text-[var(--text-secondary)]">No expression batches yet</p>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">Add expressions in the Expressions page to create batches</p>
              </motion.div>
            ) : (
              <motion.div className="mt-10 space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
                {batches.map((batch) => (
                  <motion.div key={batch.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} className="group">
                    <GlassCard hover={false} className="overflow-hidden">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          {editingBatchId === batch.id ? (
                            <input type="text" value={editingBatchName} onChange={(e) => setEditingBatchName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleBatchRename(batch.id, editingBatchName); if (e.key === 'Escape') setEditingBatchId(null); }}
                              onBlur={() => editingBatchId && handleBatchRename(batch.id, editingBatchName)} className="input-field w-full text-lg font-semibold" autoFocus />
                          ) : (<h3 className="text-lg font-semibold">{batch.name}</h3>)}
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">{batch.learnedCount} / {batch.expressionCount} expressions · {new Date(batch.createdAt).toLocaleDateString('de-DE')}</p>
                          <div className="mt-3 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                            <motion.div className="h-full rounded-full bg-[var(--accent)]" initial={{ width: 0 }} animate={{ width: `${(batch.learnedCount / Math.max(batch.expressionCount, 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                            <motion.button onClick={() => { setEditingBatchId(batch.id); setEditingBatchName(batch.name); }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]" whileTap={{ scale: 0.98 }}><Pencil size={14} />Rename</motion.button>
                            <motion.button onClick={() => setDeleteConfirmBatch(batch)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10" whileTap={{ scale: 0.98 }}><Trash2 size={14} />Delete</motion.button>
                            <motion.button onClick={() => setAddExprBatch(batch)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10" whileTap={{ scale: 0.98 }}><Plus size={14} />Add Expressions</motion.button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <motion.button className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all" onClick={() => startLearn(batch)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ background: 'var(--accent)', color: 'white' }}>
                            {batch.learnedCount >= batch.expressionCount ? <CheckCircle2 size={18} /> : <BookOpen size={18} />} Learn
                          </motion.button>
                          <motion.button className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${batch.practiceUnlocked ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]' : 'cursor-not-allowed bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] opacity-60'}`} onClick={() => batch.practiceUnlocked && startPractice(batch)} disabled={!batch.practiceUnlocked} whileHover={batch.practiceUnlocked ? { scale: 1.02 } : undefined} whileTap={batch.practiceUnlocked ? { scale: 0.98 } : undefined}>
                            {batch.practiceUnlocked ? <PenLine size={18} /> : <Lock size={18} />} Practice
                          </motion.button>
                          <motion.button className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${batch.examUnlocked ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)]' : 'cursor-not-allowed bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] opacity-60'}`} onClick={() => batch.examUnlocked && startExam(batch)} disabled={!batch.examUnlocked} whileHover={batch.examUnlocked ? { scale: 1.02 } : undefined} whileTap={batch.examUnlocked ? { scale: 0.98 } : undefined}>
                            {batch.examUnlocked ? <CheckCircle2 size={18} /> : <Lock size={18} />} Exam
                          </motion.button>
                          <motion.button className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400" onClick={() => startExprOnly(batch, 'both')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Sparkles size={18} /> Expression Only
                          </motion.button>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {flowMode === 'select_exprs' && selectedBatch && (
          <motion.div key="select_exprs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => { setFlowMode('list'); setSelectedBatch(null); }} className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={18} />Back</button>
            <GlassCard hover={false}>
              <h2 className="text-lg font-semibold">Select expressions to practice</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Choose which expressions to include in your {pendingMode} session</p>
              <div className="mt-4 flex gap-2">
                <motion.button onClick={() => setSelectedIds(new Set(selectedBatch.expressions.map((e) => e.id)))} className="btn-secondary text-sm" whileTap={{ scale: 0.98 }}>Select All</motion.button>
                <motion.button onClick={() => setSelectedIds(new Set())} className="btn-secondary text-sm" whileTap={{ scale: 0.98 }}>Deselect All</motion.button>
              </div>
              <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-2">
                  {selectedBatch.expressions.map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--bg-tertiary)]">
                      <input type="checkbox" checked={selectedIds.has(e.id)} onChange={(ev) => { const next = new Set(selectedIds); if (ev.target.checked) next.add(e.id); else next.delete(e.id); setSelectedIds(next); }} className="h-5 w-5 rounded border-[var(--border)]" />
                      <span className="font-medium">{e.expression}</span>
                      <span className="text-sm text-[var(--text-secondary)]">— {e.meaning}</span>
                    </label>
                  ))}
                </div>
              </div>
              {selectedIds.size === 0 && <p className="mt-3 text-sm text-[var(--danger)]">Select at least one expression</p>}
              <motion.button className="btn-primary mt-4" onClick={proceedFromSelect} disabled={selectedIds.size === 0} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Continue</motion.button>
            </GlassCard>
          </motion.div>
        )}

        {flowMode === 'filters' && selectedBatch && (
          <motion.div key="filters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setFlowMode('select_exprs')} className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={18} />Back</button>
            <GlassCard hover={false}>
              <h2 className="text-lg font-semibold">Practice filters</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Customize how questions appear</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">Direction</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(['de_to_en', 'en_to_de', 'both'] as const).map((d) => (
                      <motion.button key={d} onClick={() => setDirectionFilter(d)} className={cn('rounded-xl px-4 py-2 text-sm font-medium transition-all', directionFilter === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]')} whileTap={{ scale: 0.98 }}>
                        {d === 'de_to_en' ? 'German → English' : d === 'en_to_de' ? 'English → German' : 'Both'}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
              <motion.button className="btn-primary mt-6" onClick={proceedFromFilters} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Start {pendingMode === 'practice' ? 'Practice' : 'Exam'}</motion.button>
            </GlassCard>
          </motion.div>
        )}

        {flowMode === 'learn' && selectedBatch && (
          <motion.div key="learn" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <button onClick={() => { setFlowMode('list'); setSelectedBatch(null); }} className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"><ArrowLeft size={18} />Back</button>
            <div className="mb-6 flex items-center gap-4 text-sm">
              <span className="shrink-0 text-[var(--text-tertiary)]">{learnIndex + 1} / {selectedBatch.expressions.length}</span>
              <div className="h-2 min-w-0 flex-1 max-w-[200px] overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                <motion.div className="h-full rounded-full bg-[var(--accent)]" animate={{ width: `${((learnIndex + 1) / selectedBatch.expressions.length) * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
              </div>
            </div>
            {learnIndex < selectedBatch.expressions.length ? (
              <motion.div key={selectedBatch.expressions[learnIndex]?.id} initial={{ rotateY: 0 }} animate={{ rotateY: 0 }}>
                <GlassCard hover={false} className="relative overflow-hidden">
                  {xpFloat && <motion.span className="absolute right-6 top-6 text-sm font-bold text-[var(--accent)]" initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} transition={{ duration: 0.8 }}>+10 XP</motion.span>}
                  <div className="flex flex-col items-center text-center">
                    <motion.h2 className="text-3xl font-bold tracking-tight" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>{selectedBatch.expressions[learnIndex]?.expression ?? ''}</motion.h2>
                    <p className="mt-4 text-lg text-[var(--text-secondary)]">{selectedBatch.expressions[learnIndex]?.meaning}</p>
                    {selectedBatch.expressions[learnIndex]?.literalTranslation && selectedBatch.expressions[learnIndex]?.literalTranslation !== selectedBatch.expressions[learnIndex]?.meaning && (
                      <p className="mt-2 text-sm text-[var(--text-tertiary)]">Literal: {selectedBatch.expressions[learnIndex]?.literalTranslation}</p>
                    )}
                    {selectedBatch.expressions[learnIndex]?.exampleSentence && (
                      <p className="mt-3 text-sm italic text-[var(--text-tertiary)]">&bdquo;{selectedBatch.expressions[learnIndex]?.exampleSentence}&ldquo;</p>
                    )}
                    {selectedBatch.expressions[learnIndex]?.category && <Badge className="mt-3">{selectedBatch.expressions[learnIndex]?.category}</Badge>}
                    {selectedBatch.expressions[learnIndex]?.usageNote && (
                      <p className="mt-3 text-xs text-[var(--text-tertiary)]">Usage: {selectedBatch.expressions[learnIndex]?.usageNote}</p>
                    )}
                    <button onClick={() => speak(selectedBatch.expressions[learnIndex]?.expression ?? '')} className="mt-6 rounded-full p-3 transition-colors hover:bg-[var(--bg-tertiary)]"><Volume2 size={24} className="text-[var(--accent)]" /></button>
                    <motion.button className="btn-primary mt-6" onClick={handleLearnNext} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Next</motion.button>
                  </div>
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-16">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}><CheckCircle2 size={64} className="text-[var(--success)]" /></motion.div>
                <h2 className="mt-6 text-2xl font-bold">All expressions learned!</h2>
                <p className="mt-2 text-[var(--text-secondary)]">Practice Test unlocked!</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {flowMode === 'practice' && selectedBatch && (
          <motion.div key="practice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => { setFlowMode('list'); setSelectedBatch(null); }} className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={18} />Back</button>
            {!practiceComplete ? (
              <>
                <div className="mb-6 flex items-center justify-between text-sm">
                  <span className="text-[var(--text-tertiary)]">{practiceIndex + 1} / {practiceExprs.length}</span>
                  <span className="text-[var(--accent)] font-medium">{practiceCorrectCount} correct</span>
                </div>
                <div className="h-2 mb-6 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <motion.div className="h-full rounded-full bg-[var(--accent)]" animate={{ width: `${((practiceIndex + 1) / practiceExprs.length) * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                </div>
                {practiceQuestions[practiceIndex] && (
                  <motion.div key={practiceExprs[practiceIndex]?.id ?? practiceIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <GlassCard hover={false}>
                      <p className="text-sm text-[var(--text-tertiary)]">{practiceQuestions[practiceIndex].type === 'meaning' ? 'What does this mean?' : 'Fill in the blank'}</p>
                      <h2 className="mt-4 text-2xl font-semibold">{practiceQuestions[practiceIndex].prompt}</h2>
                      <div className="mt-6">
                        <input type="text" placeholder="Your answer..." value={practiceInput} onChange={(e) => setPracticeInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !practiceAnswered && handlePracticeCheck()} disabled={practiceAnswered} className="input-field w-full" autoFocus />
                        {!practiceAnswered ? (
                          <motion.button className="btn-primary mt-4" onClick={handlePracticeCheck} disabled={!practiceInput.trim()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Check</motion.button>
                        ) : (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3">
                            <div className={`flex items-center gap-2 font-medium ${practiceCorrect ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                              {practiceCorrect ? <CheckCircle2 size={20} /> : <span className="text-lg">✗</span>}
                              {practiceCorrect ? 'Correct!' : `Correct: ${practiceQuestions[practiceIndex].correctAnswer}`}
                            </div>
                            <motion.button className="btn-primary" onClick={handlePracticeNext} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Next</motion.button>
                          </motion.div>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-16">
                <GlassCard hover={false} className="max-w-md text-center">
                  <h2 className="text-xl font-bold">Practice Complete!</h2>
                  <p className="mt-2 text-[var(--text-secondary)]">{practiceCorrectCount} / {practiceExprs.length} correct</p>
                  {practiceCorrectCount / practiceExprs.length >= 0.7 && <p className="mt-2 text-sm font-medium text-[var(--success)]">Exam unlocked!</p>}
                  <motion.button className="btn-primary mt-6" onClick={() => { setFlowMode('list'); setSelectedBatch(null); fetchBatches(); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Back to Batches</motion.button>
                </GlassCard>
              </motion.div>
            )}
          </motion.div>
        )}

        {flowMode === 'exam' && selectedBatch && (
          <motion.div key="exam" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {!examSubmitted ? (
              <>
                <button onClick={() => { if (confirm('Abandon exam?')) { setFlowMode('list'); setSelectedBatch(null); } }} className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={18} />Back</button>
                <div className={`mb-6 flex items-center justify-center gap-2 rounded-xl py-4 text-2xl font-bold ${examTimeLeft <= 10 ? 'bg-[var(--danger)]/20 text-[var(--danger)]' : 'bg-[var(--bg-tertiary)]'}`}>
                  <span>{Math.floor(examTimeLeft / 60)}:{(examTimeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
                {examQuestions[examIndex] && (
                  <GlassCard hover={false}>
                    <p className="text-sm text-[var(--text-tertiary)]">{examIndex + 1} / {examQuestions.length}</p>
                    <h2 className="mt-4 text-2xl font-semibold">{examQuestions[examIndex].prompt}</h2>
                    <input type="text" placeholder="Your answer..." value={examInput} onChange={(e) => setExamInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (examIndex + 1 < examQuestions.length) {
                            setExamAnswers([...examAnswers, { expressionId: examQuestions[examIndex].expr.id, type: examQuestions[examIndex].type, userAnswer: examInput.trim(), correctAnswer: examQuestions[examIndex].correctAnswer, correct: checkAnswer(examQuestions[examIndex].type, examInput, examQuestions[examIndex].correctAnswer) }]);
                            setExamInput(''); setExamIndex((i) => i + 1);
                          } else { handleExamSubmit(); }
                        }
                      }} className="input-field mt-6 w-full" autoFocus />
                    <motion.button className="btn-primary mt-4" onClick={() => {
                      if (examIndex + 1 < examQuestions.length) {
                        setExamAnswers([...examAnswers, { expressionId: examQuestions[examIndex].expr.id, type: examQuestions[examIndex].type, userAnswer: examInput.trim(), correctAnswer: examQuestions[examIndex].correctAnswer, correct: checkAnswer(examQuestions[examIndex].type, examInput, examQuestions[examIndex].correctAnswer) }]);
                        setExamInput(''); setExamIndex((i) => i + 1);
                      } else { handleExamSubmit(); }
                    }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      {examIndex + 1 < examQuestions.length ? 'Next' : 'Submit'}
                    </motion.button>
                  </GlassCard>
                )}
              </>
            ) : examResult ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <GlassCard hover={false} className="text-center">
                  <h2 className="text-2xl font-bold">Exam Complete!</h2>
                  <p className="mt-2 text-4xl font-bold text-[var(--accent)]">{examResult.score} / {examResult.maxScore}</p>
                  <motion.span className="mt-2 inline-block text-sm font-medium text-[var(--success)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>+{examResult.xpEarned} XP</motion.span>
                  {examResult.meaningAccuracy != null && <div className="mt-4"><Badge>Meaning: {Math.round(examResult.meaningAccuracy)}%</Badge></div>}
                </GlassCard>
                <GlassCard hover={false}>
                  <h3 className="mb-4 font-semibold">Results</h3>
                  <div className="space-y-3">
                    {examResult.answers.map((a, i) => (
                      <div key={i} className={`flex items-center justify-between rounded-lg px-4 py-3 ${a.correct ? 'bg-[var(--success)]/10' : 'bg-[var(--danger)]/10'}`}>
                        <span className="text-sm">Your answer: <strong>{a.userAnswer || '(empty)'}</strong></span>
                        <span className="flex items-center gap-2 text-sm">
                          {a.correct ? <CheckCircle2 size={18} className="text-[var(--success)]" /> : <span className="text-[var(--danger)]">✗</span>}
                          {!a.correct && <span className="text-[var(--text-secondary)]">Correct: {a.correctAnswer}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
                <motion.button className="btn-primary" onClick={() => { setFlowMode('list'); setSelectedBatch(null); fetchBatches(); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Back to Batches</motion.button>
              </motion.div>
            ) : null}
          </motion.div>
        )}

        {flowMode === 'expr_only' && selectedBatch && (
          <motion.div key="expr_only" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <div className="flex items-center gap-3 mb-6">
              <motion.button onClick={() => { setFlowMode('list'); setSelectedBatch(null); }} className="rounded-lg p-2 hover:bg-[var(--bg-tertiary)]" whileTap={{ scale: 0.95 }}><ArrowLeft size={20} /></motion.button>
              <div><h2 className="text-xl font-bold">Expression Only Mode</h2><p className="text-sm text-[var(--text-secondary)]">{selectedBatch.name}</p></div>
            </div>
            {!eoComplete && eoExprs.length > 0 && (
              <>
                <div className="flex gap-2 mb-4">
                  {(['de_to_en', 'en_to_de', 'both'] as const).map((d) => (
                    <motion.button key={d} onClick={() => { setEoDirection(d); startExprOnly(selectedBatch!, d); }} className={cn('rounded-xl px-4 py-2 text-sm font-medium transition-all', eoDirection === d ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]')} whileTap={{ scale: 0.97 }}>
                      {d === 'de_to_en' ? 'DE → EN' : d === 'en_to_de' ? 'EN → DE' : 'Both'}
                    </motion.button>
                  ))}
                </div>
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <motion.div className="h-full rounded-full bg-[var(--accent)]" animate={{ width: `${((eoIndex + 1) / eoExprs.length) * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                </div>
                <p className="mb-4 text-xs text-[var(--text-tertiary)] text-right">{eoIndex + 1} / {eoExprs.length} · {eoCorrectCount} correct</p>
                <AnimatePresence mode="wait">
                  <motion.div key={eoIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                    <GlassCard hover={false} className="text-center">
                      <p className="text-3xl font-bold mb-2">{eoExprs[eoIndex]?.prompt}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mb-6">{eoExprs[eoIndex]?.expr.category ?? 'expression'}{eoExprs[eoIndex]?.expr.register ? ` · ${eoExprs[eoIndex].expr.register}` : ''}</p>
                      <input type="text" value={eoInput} onChange={(e) => setEoInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') eoAnswered ? handleEoNext() : handleEoCheck(); }} placeholder="Type your answer..." disabled={eoAnswered} className="input-field mx-auto max-w-md text-center text-lg" autoFocus autoComplete="off" />
                      {eoAnswered && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                          <div className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium', eoCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
                            {eoCorrect ? <CheckCircle2 size={16} /> : <></>}
                            {eoCorrect ? 'Correct!' : `Answer: ${eoExprs[eoIndex]?.correctAnswer}`}
                          </div>
                        </motion.div>
                      )}
                      <div className="mt-6 flex justify-center gap-3">
                        {!eoAnswered ? (
                          <motion.button onClick={handleEoCheck} disabled={!eoInput.trim()} className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Check</motion.button>
                        ) : (
                          <motion.button onClick={handleEoNext} className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{eoIndex + 1 >= eoExprs.length ? 'Finish' : 'Next'}</motion.button>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
                </AnimatePresence>
              </>
            )}
            {eoComplete && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <GlassCard hover={false} className="text-center">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                  <h3 className="mt-4 text-2xl font-bold">Expression Only Complete!</h3>
                  <p className="mt-2 text-lg text-[var(--text-secondary)]">{eoCorrectCount} / {eoExprs.length} correct ({Math.round((eoCorrectCount / eoExprs.length) * 100)}%)</p>
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">Time: {eoTotalTime}s · Avg: {eoExprs.length > 0 ? (eoTotalTime / eoExprs.length).toFixed(1) : 0}s per expression</p>
                  <div className="mt-6 flex justify-center gap-3">
                    <motion.button onClick={() => startExprOnly(selectedBatch!, eoDirection)} className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Try Again</motion.button>
                    <motion.button onClick={() => { setFlowMode('list'); setSelectedBatch(null); }} className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Back to Batches</motion.button>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmBatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteConfirmBatch(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[var(--bg-primary)] p-6 shadow-xl">
              <div className="flex items-center gap-3"><AlertTriangle size={24} className="text-[var(--danger)]" /><h3 className="text-lg font-semibold">Delete batch</h3></div>
              <p className="mt-4 text-sm text-[var(--text-secondary)]">This will permanently delete &quot;{deleteConfirmBatch.name}&quot; and all its expressions. Type RESET to confirm.</p>
              <input type="text" value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} placeholder="RESET" className="input-field mt-4 w-full" />
              <div className="mt-6 flex gap-3">
                <motion.button onClick={() => { setDeleteConfirmBatch(null); setDeleteConfirmInput(''); }} className="btn-secondary flex-1" whileTap={{ scale: 0.98 }}>Cancel</motion.button>
                <motion.button onClick={() => handleBatchDelete(deleteConfirmBatch)} disabled={deleteConfirmInput !== 'RESET'} className="btn-primary flex-1 bg-[var(--danger)] hover:bg-[var(--danger)]/90 disabled:opacity-50" whileTap={{ scale: 0.98 }}>Delete</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addExprBatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !addExprLoading && setAddExprBatch(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[var(--bg-primary)] p-6 shadow-xl">
              <h3 className="text-lg font-semibold">Add expressions to {addExprBatch.name}</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Enter German fixed expressions (one per line)</p>
              <textarea value={addExprInput} onChange={(e) => setAddExprInput(e.target.value)} placeholder="Guten Morgen&#10;auf Wiedersehen&#10;es tut mir leid" className="input-field mt-4 min-h-[120px] w-full resize-none" disabled={addExprLoading} />
              <div className="mt-6 flex gap-3">
                <motion.button onClick={() => { setAddExprBatch(null); setAddExprInput(''); }} disabled={addExprLoading} className="btn-secondary flex-1" whileTap={{ scale: 0.98 }}>Cancel</motion.button>
                <motion.button onClick={handleAddExprs} disabled={!addExprInput.trim() || addExprLoading} className="btn-primary flex-1 disabled:opacity-50" whileTap={{ scale: 0.98 }}>{addExprLoading ? <Loader2 size={18} className="animate-spin" /> : 'Add Expressions'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Plus, Loader2, Trash2, BookOpen, Search, Filter } from 'lucide-react';
import { sfx } from '@/lib/sounds';
import { cn } from '@/lib/utils';

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
  state: number;
  stability: number;
}

interface Analytics {
  totalExpressions: number;
  byCategory: Record<string, number>;
  byCefrLevel: { A1: number; A2: number; B1: number; B2: number };
  mastered: number;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'greeting', label: 'Greetings' },
  { value: 'farewell', label: 'Farewells' },
  { value: 'polite', label: 'Polite' },
  { value: 'idiom', label: 'Idioms' },
  { value: 'collocation', label: 'Collocations' },
  { value: 'proverb', label: 'Proverbs' },
  { value: 'filler', label: 'Fillers' },
  { value: 'connector', label: 'Connectors' },
  { value: 'other', label: 'Other' },
];

export default function ExpressionsPage() {
  const [expressions, setExpressions] = useState<UserExpression[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [input, setInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchExpressions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expressions');
      const data = await res.json();
      setExpressions(data.expressions || []);
      setAnalytics(data.analytics || null);
    } catch {
      setExpressions([]);
      setAnalytics(null);
      toast.error('Failed to load expressions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpressions();
  }, [fetchExpressions]);

  const handleUpload = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error('Please enter at least one expression');
      return;
    }
    setUploading(true);

    const count = trimmed.split(/\n+/).filter((w) => w.trim()).length;
    const toastId = count > 5
      ? toast.loading(`Enriching ${count} expressions with Gemini AI...`)
      : undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 150_000);

      const res = await fetch('/api/expressions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expressions: trimmed }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (toastId) toast.dismiss(toastId);

      if (!res.ok) {
        toast.error(data.error || 'Upload failed');
        return;
      }
      sfx.streak();
      const skippedMsg = data.skipped ? ` (${data.skipped} duplicate${data.skipped !== 1 ? 's' : ''} skipped)` : '';
      toast.success(`Added ${data.count} expression${data.count !== 1 ? 's' : ''}${skippedMsg}`);
      setInput('');
      await fetchExpressions();
    } catch {
      if (toastId) toast.dismiss(toastId);
      toast.error('Upload failed -- try fewer expressions at once if it times out');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/expressions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Expression removed');
        await fetchExpressions();
      } else {
        toast.error('Failed to delete expression');
      }
    } catch {
      toast.error('Failed to delete expression');
    }
  };

  const filtered = expressions
    .filter((e) => categoryFilter === 'all' || (e.category?.toLowerCase() ?? 'other') === categoryFilter)
    .filter(
      (e) =>
        !searchQuery ||
        e.expression.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const analyticsRows = analytics
    ? [
        { label: 'Total Expressions', count: analytics.totalExpressions },
        { label: 'Greetings', count: analytics.byCategory.greeting ?? 0 },
        { label: 'Idioms', count: analytics.byCategory.idiom ?? 0 },
        { label: 'Collocations', count: analytics.byCategory.collocation ?? 0 },
        { label: 'Proverbs', count: analytics.byCategory.proverb ?? 0 },
        { label: 'Connectors', count: analytics.byCategory.connector ?? 0 },
        { label: 'Mastered', count: analytics.mastered },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <PageHeader
        title="Fixed Expressions"
        subtitle="Build your personal phrase & idiom library"
      />

      <motion.section
        className="mt-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassCard hover={false}>
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold">Add Expressions</h2>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"Enter German fixed expressions, one per line.\n\nExample:\nGuten Morgen\nauf Wiedersehen\nes tut mir leid\num die Ecke"}
            className="mt-4 min-h-[180px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            disabled={uploading}
          />
          <motion.button
            className="btn-primary mt-4 flex items-center gap-2"
            onClick={handleUpload}
            disabled={uploading}
            whileHover={!uploading ? { scale: 1.02 } : undefined}
            whileTap={!uploading ? { scale: 0.98 } : undefined}
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Plus size={18} />
                Enrich & Add
              </>
            )}
          </motion.button>
        </GlassCard>
      </motion.section>

      <motion.section
        className="mt-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold">Expression Library</h2>
        </div>

        {loading ? (
          <div className="mt-6 flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading expressions...</p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analyticsRows.map((row, i) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GlassCard className="flex items-center justify-between" hover={false}>
                    <span className="text-sm text-[var(--text-secondary)]">{row.label}</span>
                    <span className="text-xl font-semibold text-[var(--text-primary)]">
                      {row.count}
                    </span>
                  </GlassCard>
                </motion.div>
              ))}
            </div>

            <div className="mt-8">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                  <input
                    type="text"
                    placeholder="Search expressions or meanings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Filter size={16} className="text-[var(--text-tertiary)]" />
                  {CATEGORY_OPTIONS.slice(0, 6).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCategoryFilter(opt.value)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-black transition-all rounded-xl',
                        categoryFilter === opt.value
                          ? 'btn-duo-primary shadow-none'
                          : 'btn-duo-secondary'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filtered.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--text-tertiary)]"
                    >
                      {expressions.length === 0
                        ? 'No expressions yet. Add some German fixed expressions above to get started!'
                        : 'No expressions match the filter.'}
                    </motion.div>
                  ) : (
                    filtered.map((expr, idx) => (
                      <motion.div
                        key={expr.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        <GlassCard className="group relative">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-semibold text-[var(--text-primary)]">
                                  {expr.expression}
                                </span>
                                {expr.category && <Badge>{expr.category}</Badge>}
                                {expr.register && (
                                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {expr.register}
                                  </Badge>
                                )}
                                <Badge variant="level" level={expr.cefrLevel}>
                                  {expr.cefrLevel}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                                {expr.meaning}
                              </p>
                              {expr.literalTranslation && expr.literalTranslation !== expr.meaning && (
                                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                                  Literal: {expr.literalTranslation}
                                </p>
                              )}
                              {expr.exampleSentence && (
                                <p className="mt-2 text-sm italic text-[var(--text-tertiary)]">
                                  &bdquo;{expr.exampleSentence}&ldquo;
                                </p>
                              )}
                              {expr.usageNote && (
                                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                                  Usage: {expr.usageNote}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDelete(expr.id)}
                              className="flex-shrink-0 rounded-lg p-2 text-[var(--text-tertiary)] opacity-60 transition-opacity hover:bg-red-500/10 hover:text-red-500 hover:opacity-100"
                              aria-label="Delete expression"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </motion.section>
    </div>
  );
}

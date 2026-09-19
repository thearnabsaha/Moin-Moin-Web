'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Loader2,
  Trash2,
  BookOpen,
  Search,
  Filter,
  Layers,
  Sparkles,
  Pencil,
  Volume2,
  Check,
  X,
  Brain,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  BookMarked,
  RefreshCw,
} from 'lucide-react';
import { sfx } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { cachedFetch, invalidateCache } from '@/lib/client-cache';

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
  learned?: boolean;
  state?: number;
  stability?: number;
  batchId?: string | null;
}

interface WordSet {
  id: string;
  name: string;
  wordCount: number;
  learnedCount: number;
  practiceUnlocked: boolean;
  examUnlocked: boolean;
  createdAt: string;
  words: UserWord[];
}

interface Analytics {
  totalWords: number;
  byPartOfSpeech: { noun: number; verb: number; adjective: number; preposition: number; conjunction: number; other: number };
  byGender: { masculine: number; feminine: number; neuter: number };
  byCefrLevel: { A1: number; A2: number; B1: number; B2: number };
  mastered: number;
}

const POS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'noun', label: 'Nouns' },
  { value: 'verb', label: 'Verbs' },
  { value: 'adjective', label: 'Adjectives' },
  { value: 'preposition', label: 'Prepositions' },
  { value: 'conjunction', label: 'Conjunctions' },
  { value: 'other', label: 'Other' },
];

export default function VocabularyPage() {
  const [activeTab, setActiveTab] = useState<'sets' | 'library'>('sets');

  // Word Sets State
  const [sets, setSets] = useState<WordSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetWords, setNewSetWords] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Set Actions State
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editSetName, setEditSetName] = useState('');
  const [addingWordsSetId, setAddingWordsSetId] = useState<string | null>(null);
  const [moreWordsInput, setMoreWordsInput] = useState('');
  const [addingWordsLoading, setAddingWordsLoading] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);

  // All Words Library State
  const [words, setWords] = useState<UserWord[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [posFilter, setPosFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pronounce TTS
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

  // Fetch Word Sets
  const fetchSets = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) invalidateCache('/api/vocabulary/sets');
    setSetsLoading(true);
    try {
      const data = await cachedFetch<{ sets: WordSet[] }>('/api/vocabulary/sets', 30000);
      setSets(data.sets || []);
    } catch {
      setSets([]);
      toast.error('Failed to load word sets');
    } finally {
      setSetsLoading(false);
    }
  }, []);

  // Fetch All Words
  const fetchWords = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) invalidateCache('/api/vocabulary');
    setLibraryLoading(true);
    try {
      const data = await cachedFetch<{ words: UserWord[]; analytics: Analytics }>('/api/vocabulary', 30000);
      setWords(data.words || []);
      setAnalytics(data.analytics || null);
    } catch {
      setWords([]);
      setAnalytics(null);
      toast.error('Failed to load vocabulary');
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSets();
    fetchWords();
  }, [fetchSets, fetchWords]);

  // Synchronize and Deduplicate Words
  const handleSyncWords = async () => {
    setSyncing(true);
    const toastId = toast.loading('Synchronizing & checking for duplicate words...');
    try {
      const res = await fetch('/api/vocabulary/sync', {
        method: 'POST',
      });
      const data = await res.json();
      toast.dismiss(toastId);

      if (!res.ok) {
        toast.error(data.error || 'Failed to synchronize words');
        return;
      }

      sfx.correct();
      if (data.removedDuplicatesCount > 0) {
        toast.success(`Synchronized! Removed ${data.removedDuplicatesCount} duplicate word${data.removedDuplicatesCount !== 1 ? 's' : ''} across your sets.`);
      } else {
        toast.success('All words are synchronized! No duplicate words found.');
      }

      await fetchSets();
      await fetchWords();
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to synchronize words');
    } finally {
      setSyncing(false);
    }
  };

  // Create New Word Set
  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedWords = newSetWords.trim();
    if (!trimmedWords) {
      toast.error('Please enter at least one word');
      return;
    }

    setCreatingSet(true);
    const wordCount = trimmedWords.split(/[\n,;]+/).filter((w) => w.trim()).length;
    const toastId = toast.loading(`Enriching ${wordCount} word(s) with Gemini AI...`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const res = await fetch('/api/vocabulary/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSetName.trim() || undefined,
          words: trimmedWords,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      toast.dismiss(toastId);

      if (!res.ok) {
        toast.error(data.error || 'Failed to create word set');
        return;
      }

      sfx.streak();
      const skippedMsg = data.skippedCount > 0 ? ` (${data.skippedCount} duplicate word${data.skippedCount !== 1 ? 's' : ''} skipped)` : '';
      toast.success(`Created set with ${data.addedCount} new word${data.addedCount !== 1 ? 's' : ''}${skippedMsg}!`);

      setNewSetName('');
      setNewSetWords('');
      setIsCreateOpen(false);
      await fetchSets();
      await fetchWords();
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to create set (request timed out or failed)');
    } finally {
      setCreatingSet(false);
    }
  };

  // Rename Word Set
  const handleRenameSet = async (setId: string) => {
    if (!editSetName.trim()) return;
    try {
      const res = await fetch(`/api/vocabulary/sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editSetName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to rename set');
        return;
      }
      toast.success('Word set renamed!');
      setEditingSetId(null);
      setEditSetName('');
      await fetchSets();
    } catch {
      toast.error('Failed to rename set');
    }
  };

  // Delete Word Set
  const handleDeleteSet = async (setId: string, setName: string) => {
    if (!confirm(`Are you sure you want to delete the set "${setName}" and its words?`)) return;
    try {
      const res = await fetch(`/api/vocabulary/sets/${setId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete set');
        return;
      }
      toast.success(`Deleted set "${setName}"`);
      await fetchSets();
      await fetchWords();
    } catch {
      toast.error('Failed to delete set');
    }
  };

  // Add More Words to Existing Set
  const handleAddMoreWords = async (setId: string) => {
    const trimmed = moreWordsInput.trim();
    if (!trimmed) {
      toast.error('Please enter words to add');
      return;
    }
    setAddingWordsLoading(true);
    const toastId = toast.loading('Enriching and adding words with Gemini AI...');

    try {
      const res = await fetch(`/api/vocabulary/sets/${setId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: trimmed }),
      });
      const data = await res.json();
      toast.dismiss(toastId);

      if (!res.ok) {
        toast.error(data.error || 'Failed to add words');
        return;
      }

      sfx.correct();
      const skippedMsg = data.skippedCount > 0 ? ` (${data.skippedCount} duplicate word${data.skippedCount !== 1 ? 's' : ''} skipped)` : '';
      toast.success(`Added ${data.addedCount} new word${data.addedCount !== 1 ? 's' : ''}${skippedMsg}!`);

      setMoreWordsInput('');
      setAddingWordsSetId(null);
      await fetchSets();
      await fetchWords();
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to add words to set');
    } finally {
      setAddingWordsLoading(false);
    }
  };

  // Delete Individual Word from Set
  const handleDeleteWordFromSet = async (setId: string, wordId: string, wordText: string) => {
    try {
      const res = await fetch(`/api/vocabulary/sets/${setId}/words/${wordId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to remove word');
        return;
      }
      toast.success(`Removed "${wordText}" from set`);
      await fetchSets();
      await fetchWords();
    } catch {
      toast.error('Failed to remove word');
    }
  };

  // Delete Word from General Library
  const handleDeleteGeneralWord = async (id: string) => {
    try {
      const res = await fetch(`/api/vocabulary?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Word removed');
        await fetchWords();
        await fetchSets();
      } else {
        toast.error('Failed to delete word');
      }
    } catch {
      toast.error('Failed to delete word');
    }
  };

  const filteredWords = words
    .filter((w) => posFilter === 'all' || w.partOfSpeech.toLowerCase() === posFilter)
    .filter(
      (w) =>
        !searchQuery ||
        w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Vocabulary & Sets
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
            Create custom sets, enrich words with AI, and practice with flashcards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncWords}
            disabled={syncing}
            className="btn-duo-secondary py-2 px-3 text-xs sm:text-sm font-black flex items-center gap-1.5"
            title="Synchronize and remove duplicate words"
          >
            <RefreshCw size={15} className={cn('text-[var(--accent)]', syncing && 'animate-spin')} />
            <span>{syncing ? 'Syncing...' : 'Synchronize'}</span>
          </button>

          <Link
            href="/vocabulary/book"
            className="btn-duo-secondary py-2 px-3 text-xs sm:text-sm font-black flex items-center gap-1.5"
          >
            <BookMarked size={15} className="text-[var(--accent)]" />
            <span>Vocab Book</span>
          </Link>

          <button
            onClick={() => {
              if (activeTab !== 'sets') setActiveTab('sets');
              setIsCreateOpen((prev) => !prev);
            }}
            className={cn(
              'py-2 px-3.5 text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all',
              isCreateOpen ? 'btn-duo-secondary' : 'btn-duo-primary'
            )}
          >
            {isCreateOpen ? (
              <>
                <X size={15} />
                <span>Close</span>
              </>
            ) : (
              <>
                <Plus size={15} />
                <span>Add Words</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Duolingo Segmented Navigation Switcher ─── */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--bg-secondary)] p-1.5 border-2 border-[var(--border)] shadow-sm">
        <button
          onClick={() => setActiveTab('sets')}
          className={cn(
            'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all',
            activeTab === 'sets'
              ? 'btn-duo-primary shadow-none'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <Layers size={16} />
          <span>Word Sets ({sets.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={cn(
            'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all',
            activeTab === 'library'
              ? 'btn-duo-primary shadow-none'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <BookOpen size={16} />
          <span>All Words ({words.length})</span>
        </button>
      </div>

      <div className="mt-6 sm:mt-8">
        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: WORD SETS & CUSTOM LISTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'sets' && (
          <div className="space-y-6">
            {/* Create Word Set Expandable Drawer */}
            <AnimatePresence>
              {isCreateOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="rounded-3xl border-2 border-[var(--accent)]/40 bg-[var(--bg-secondary)] p-5 sm:p-6 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                          <FolderPlus size={20} />
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                            Add Words & Create Set
                          </h2>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            Powered by Gemini AI — German words are automatically enriched with articles, plural forms & examples
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsCreateOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <form onSubmit={handleCreateSet} className="mt-5 space-y-4">
                      <div>
                        <label className="block text-xs font-black text-[var(--text-secondary)]">
                          Set Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={newSetName}
                          onChange={(e) => setNewSetName(e.target.value)}
                          placeholder="e.g. Travel & Airport, Daily Verbs, Office Vocab..."
                          className="input-field mt-1.5 bg-[var(--bg-primary)] font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[var(--text-secondary)]">
                          German Words (Comma or newline separated)
                        </label>
                        <textarea
                          value={newSetWords}
                          onChange={(e) => setNewSetWords(e.target.value)}
                          placeholder="e.g. der Apfel, das Buch, laufen, schön, trinken, der Tisch, reisen, pünktlich"
                          rows={3}
                          className="input-field mt-1.5 min-h-[90px] w-full resize-y bg-[var(--bg-primary)] text-sm font-medium leading-relaxed"
                          required
                          disabled={creatingSet}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                          ✨ Duplicates in your input or library are automatically skipped.
                        </span>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="btn-duo-secondary px-4 py-2.5 text-xs font-black"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={creatingSet || !newSetWords.trim()}
                            className="btn-duo-primary px-5 py-2.5 text-xs sm:text-sm font-black flex items-center gap-2"
                          >
                            {creatingSet ? (
                              <>
                                <Loader2 size={15} className="animate-spin" />
                                <span>Enriching & Creating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={15} />
                                <span>Create Set</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact Trigger Button when drawer is closed and sets exist */}
            {!isCreateOpen && sets.length > 0 && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/40 hover:border-[var(--accent)]/60 hover:bg-[var(--bg-secondary)] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] group-hover:scale-105 transition-transform">
                    <Plus size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">Create Another Word Set</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">Add comma-separated words with AI auto-enrichment</p>
                  </div>
                </div>
                <span className="btn-duo-primary text-xs py-1.5 px-3 font-black">
                  + New Set
                </span>
              </button>
            )}

            {/* Word Sets List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">Your Word Sets</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Rename, add words, delete sets, or start 3D flashcard practice
                  </p>
                </div>
              </div>

              {setsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                  <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">Loading word sets...</p>
                </div>
              ) : sets.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/40 p-8 sm:p-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Layers size={28} />
                  </div>
                  <h4 className="mt-4 text-lg font-black text-[var(--text-primary)]">No word sets yet</h4>
                  <p className="mt-1 max-w-sm mx-auto text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
                    Create custom word sets from any list of German words and practice with interactive 3D flashcards.
                  </p>
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="btn-duo-primary mt-6 px-6 py-3 text-sm font-black inline-flex items-center gap-2"
                  >
                    <Plus size={16} />
                    <span>Create First Word Set</span>
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {sets.map((set) => {
                    const isEditing = editingSetId === set.id;
                    const isAddingWords = addingWordsSetId === set.id;
                    const isExpanded = expandedSetId === set.id;

                    return (
                      <div
                        key={set.id}
                        className="flex flex-col justify-between p-5 rounded-3xl border-2 border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                      >
                        <div>
                          {/* Set Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editSetName}
                                    onChange={(e) => setEditSetName(e.target.value)}
                                    className="input-field py-1 px-2 text-sm font-bold bg-[var(--bg-primary)]"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleRenameSet(set.id)}
                                    className="btn-duo-primary p-2 rounded-xl text-xs"
                                    title="Save name"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingSetId(null)}
                                    className="btn-duo-secondary p-2 rounded-xl text-xs"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-extrabold text-[var(--text-primary)] truncate">
                                    {set.name}
                                  </h4>
                                  <button
                                    onClick={() => {
                                      setEditingSetId(set.id);
                                      setEditSetName(set.name);
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                    title="Rename set"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                </div>
                              )}

                              <p className="mt-0.5 text-xs font-medium text-[var(--text-tertiary)]">
                                {set.wordCount} words · {set.learnedCount} learned
                              </p>
                            </div>

                            {/* Delete Set Button */}
                            <button
                              onClick={() => handleDeleteSet(set.id, set.name)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                              title="Delete set"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all"
                              style={{
                                width: `${set.wordCount > 0 ? (set.learnedCount / set.wordCount) * 100 : 0}%`,
                              }}
                            />
                          </div>

                          {/* Words Preview Chips */}
                          <div className="mt-3 flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
                            {set.words.slice(0, 6).map((w) => (
                              <span
                                key={w.id}
                                className="rounded-lg bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-secondary)] border border-[var(--border)]"
                              >
                                {w.word}
                              </span>
                            ))}
                            {set.words.length > 6 && (
                              <span className="rounded-lg bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-tertiary)]">
                                +{set.words.length - 6} more
                              </span>
                            )}
                          </div>

                          {/* Add More Words Form (Expandable) */}
                          <AnimatePresence>
                            {isAddingWords && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 border-t border-[var(--border)] pt-3"
                              >
                                <label className="text-[11px] font-bold text-[var(--text-secondary)]">
                                  Add comma-separated words to this set:
                                </label>
                                <textarea
                                  value={moreWordsInput}
                                  onChange={(e) => setMoreWordsInput(e.target.value)}
                                  placeholder="e.g. der Strand, die Sonne, schwimmen"
                                  rows={2}
                                  className="input-field mt-1 w-full bg-[var(--bg-primary)] text-xs font-medium"
                                  disabled={addingWordsLoading}
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setAddingWordsSetId(null);
                                      setMoreWordsInput('');
                                    }}
                                    className="btn-duo-secondary text-xs py-1.5 px-3"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddMoreWords(set.id)}
                                    disabled={addingWordsLoading || !moreWordsInput.trim()}
                                    className="btn-duo-primary text-xs py-1.5 px-3"
                                  >
                                    {addingWordsLoading ? 'Enriching...' : 'Add Words'}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Word Inspector Table (Expandable) */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 border-t border-[var(--border)] pt-3 space-y-2 max-h-64 overflow-y-auto"
                              >
                                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                                  Words in this set ({set.words.length}):
                                </p>
                                {set.words.map((w) => (
                                  <div
                                    key={w.id}
                                    className="flex items-center justify-between rounded-xl bg-[var(--bg-primary)] p-2.5 border border-[var(--border)]"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <button
                                        onClick={() => speak(w.word)}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
                                        title="Speak"
                                      >
                                        <Volume2 size={14} />
                                      </button>
                                      <div className="min-w-0 flex-1 truncate">
                                        <span className="font-bold text-xs text-[var(--text-primary)]">{w.word}</span>
                                        <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                                        <span className="text-xs text-[var(--text-secondary)]">{w.meaning}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteWordFromSet(set.id, w.id, w.word)}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                      title="Remove from set"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Set Footer Actions */}
                        <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setAddingWordsSetId(isAddingWords ? null : set.id);
                                setMoreWordsInput('');
                              }}
                              className="btn-duo-secondary text-xs font-black py-2 px-3 flex items-center gap-1.5"
                            >
                              <Plus size={13} />
                              <span>Add Words</span>
                            </button>

                            <button
                              onClick={() => setExpandedSetId(isExpanded ? null : set.id)}
                              className="btn-duo-secondary text-xs font-black py-2 px-3 flex items-center gap-1.5"
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                            </button>
                          </div>

                          <Link
                            href="/practice/words"
                            className="btn-duo-primary text-xs font-black py-2 px-4 flex items-center gap-1.5"
                          >
                            <Brain size={14} />
                            <span>Practice</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: ALL WORDS LIBRARY & DICTIONARY
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            {libraryLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading vocabulary library...</p>
              </div>
            ) : (
              <>
                {/* Search & Filter Bar */}
                <GlassCard hover={false} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 sm:max-w-md">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                      />
                      <input
                        type="text"
                        placeholder="Search German words or English meanings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field pl-10 bg-[var(--bg-secondary)]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Filter size={15} className="text-[var(--text-tertiary)] mr-1" />
                      {POS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPosFilter(opt.value)}
                          className={cn(
                            'px-3.5 py-1.5 text-xs font-black transition-all rounded-xl',
                            posFilter === opt.value
                              ? 'btn-duo-primary shadow-none'
                              : 'btn-duo-secondary'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* Word List */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredWords.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-3xl border-2 border-dashed border-[var(--border)] py-16 text-center text-sm text-[var(--text-tertiary)] font-bold"
                      >
                        {words.length === 0
                          ? 'No words yet. Create a Word Set to get started!'
                          : `No words match your search or filter.`}
                      </motion.div>
                    ) : (
                      filteredWords.map((word, idx) => (
                        <motion.div
                          key={word.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                        >
                          <div className="flex items-start justify-between gap-4 p-4 sm:p-5 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => speak(word.word)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
                                  title="Pronounce"
                                >
                                  <Volume2 size={16} />
                                </button>
                                <span className="text-lg font-black text-[var(--text-primary)]">
                                  {word.word}
                                </span>
                                <Badge className="font-bold">{word.partOfSpeech}</Badge>
                                {word.partOfSpeech.toLowerCase() === 'noun' && word.gender && (
                                  <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 font-black">
                                    {word.gender}
                                  </Badge>
                                )}
                                <Badge variant="level" level={word.cefrLevel} className="font-black">
                                  {word.cefrLevel}
                                </Badge>
                              </div>
                              <p className="mt-1.5 text-sm font-bold text-[var(--text-secondary)]">
                                {word.meaning}
                              </p>
                              {word.exampleSentence && (
                                <p className="mt-1 text-xs italic text-[var(--text-tertiary)]">
                                  „{word.exampleSentence}"
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteGeneralWord(word.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                              aria-label="Delete word"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import {
  Save,
  Loader2,
  Check,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Palette,
  Contrast,
  User,
  Target,
  LogOut,
  AlertTriangle,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  Snowflake,
  Flame,
  Smartphone,
  Sparkles,
  TreePine,
  BookOpen,
  BookMarked,
  MessageSquareQuote,
  GraduationCap,
  BarChart3,
  MessageCircle,
  Mic,
  Headphones,
  Brain,
  ChevronRight,
  Compass,
  Sliders,
  KeyRound,
  ShieldCheck,
  AtSign,
  Copy,
  CheckCheck,
  Lock,
  Zap,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { setMuted, isMuted } from '@/lib/sounds';
import { useAuth } from '@/components/auth/auth-guard';

const levels = ['A1', 'A2', 'B1', 'B2'] as const;
type ThemeId = 'system' | 'colorful' | 'neo-brutalist';

const themes: Array<{
  id: ThemeId;
  label: string;
  description: string;
  icon: typeof Sun;
  preview: string;
}> = [
  {
    id: 'system',
    label: 'System',
    description: 'Follows your operating system appearance (Light / Dark).',
    icon: Monitor,
    preview: 'bg-gradient-to-r from-white via-[#f0faf0] to-[#1c1c1e] border border-[var(--border)]',
  },
  {
    id: 'colorful',
    label: 'Colorful (Duolingo)',
    description: 'Vibrant Duolingo emerald green with smooth glassmorphism.',
    icon: Palette,
    preview: 'bg-[#58cc02] border-2 border-[#46a302]',
  },
  {
    id: 'neo-brutalist',
    label: 'Neo-Brutalist',
    description: 'Bold 3px solid black outlines, hard offset shadows & retro tactile physics.',
    icon: Sparkles,
    preview: 'bg-[#58CC02] border-3 border-black shadow-[3px_3px_0px_#000]',
  },
];

type ResetType = 'vocabulary' | 'progress' | 'hard';

const resetConfig: Record<ResetType, { title: string; description: string; color: string; icon: typeof Trash2 }> = {
  vocabulary: {
    title: 'Reset Vocabulary',
    description: 'Deletes all uploaded words and batches. Keeps account and progress.',
    color: 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/30',
    icon: Trash2,
  },
  progress: {
    title: 'Reset Progress',
    description: 'Clears review logs, exam history, XP, and analytics. Keeps vocabulary.',
    color: 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 border-orange-500/30',
    icon: RotateCcw,
  },
  hard: {
    title: 'Hard Reset',
    description: 'Deletes vocabulary, progress, exams, analytics, and word batches. Account remains.',
    color: 'text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-500/30',
    icon: AlertTriangle,
  },
};

const featureHubItems = [
  {
    title: 'Vocabulary Book',
    desc: 'Browse CEFR A1-B2 chapters with words in full detail',
    href: '/vocabulary/book',
    icon: BookMarked,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    badge: 'Popular',
  },
  {
    title: 'Grammar Masterclass',
    desc: '64 structured chapters with 10-level practice drills',
    href: '/grammar',
    icon: Brain,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    badge: '64 Chapters',
  },
  {
    title: 'Idioms & Expressions',
    desc: 'Native German expressions, colloquial phrases & drills',
    href: '/expressions',
    icon: MessageSquareQuote,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  {
    title: 'Goethe Exam Simulator',
    desc: 'Full A1-B2 mock exams with Lesen, Hören, Schreiben, Sprechen',
    href: '/exam',
    icon: GraduationCap,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
  },
  {
    title: 'Analytics & Insights',
    desc: 'Memory stability index, review streak & weakness analysis',
    href: '/progress',
    icon: BarChart3,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
  },
  {
    title: 'Listening Practice Lab',
    desc: 'Audio dialogues with native speed & comprehension quizzes',
    href: '/practice/listening',
    icon: Headphones,
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/25',
  },
  {
    title: 'Vocabulary Manager',
    desc: 'Search, filter, manage, and upload custom word lists',
    href: '/vocabulary',
    icon: BookOpen,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSectionTab, setActiveSectionTab] = useState<'all' | 'explore' | 'account' | 'preferences'>('all');

  const { setTheme, theme: activeTheme } = useTheme();
  const { refresh } = useAuth();
  const [username, setUsername] = useState('learner');
  const [name, setName] = useState('Learner');
  const [targetLevel, setTargetLevel] = useState('A1');
  const [themeChoice, setThemeChoice] = useState<ThemeId>('system');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);

  // ─── Password Change State ───
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(true);

  // ─── Reset Modal State ───
  const [resetModal, setResetModal] = useState<ResetType | null>(null);
  const [resetInput, setResetInput] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // ─── AI Rate Limit Status State ───
  interface AiServiceStatus {
    name: string;
    configured: boolean;
    status: 'operational' | 'rate_limited' | 'error' | 'unconfigured';
    latencyMs: number | null;
    model: string | null;
    error: string | null;
    rateLimitInfo: {
      remaining: number | null;
      limit: number | null;
      resetAt: string | null;
    } | null;
  }
  const [aiServices, setAiServices] = useState<AiServiceStatus[]>([]);
  const [aiStatusLoading, setAiStatusLoading] = useState(false);
  const [aiLastChecked, setAiLastChecked] = useState<string | null>(null);

  const fetchAiStatus = async () => {
    setAiStatusLoading(true);
    try {
      const res = await fetch('/api/ai/status');
      const data = await res.json();
      if (res.ok && data.services) {
        setAiServices(data.services);
        setAiLastChecked(new Date().toLocaleTimeString());
      }
    } catch { /* ignore */ }
    finally { setAiStatusLoading(false); }
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (activeTheme) {
      setThemeChoice(activeTheme as ThemeId);
    }
  }, [activeTheme]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUsername(data.username || 'learner');
        setName(data.name || 'Learner');
        setTargetLevel(data.targetLevel || 'A1');
        setSoundEnabled(data.soundEnabled ?? true);
        setDailyGoal(data.dailyGoal ?? 20);
        setHasExistingPassword(data.hasPassword ?? true);
        setMuted(!(data.soundEnabled ?? true));
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!mounted) return;
    setSoundEnabled(!isMuted());
  }, [mounted]);

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(username);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
    toast.success('Username copied to clipboard!');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          name,
          targetLevel,
          theme: themeChoice,
          dailyGoal,
          soundEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save settings');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Settings & profile updated!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update password');
        return;
      }
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch {
      toast.error('Error updating password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleThemeSelect = (id: ThemeId) => {
    setThemeChoice(id);
    setTheme(id);
    const label = themes.find((t) => t.id === id)?.label || id;
    toast.success(`Theme switched to ${label}`);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: id }),
    }).catch(() => {});
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    setMuted(!enabled);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundEnabled: enabled }),
    }).catch(() => {});
  };

  const handleResetConfirm = async (type: ResetType) => {
    if (resetInput !== 'RESET') return;
    setResetLoading(true);
    try {
      const res = await fetch('/api/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, confirmation: 'RESET' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Reset failed');
        return;
      }
      toast.success('Reset completed successfully');
      setResetModal(null);
      setResetInput('');
      window.location.reload();
    } catch {
      toast.error('Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await refresh();
    } catch {}
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="More & Settings"
        subtitle="Manage your credentials, password, learning tracks, and app preferences."
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-duo-primary py-2 px-4 text-xs sm:text-sm font-black flex items-center gap-2 rounded-xl"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              <Check size={15} />
            ) : (
              <Save size={15} />
            )}
            <span>{saved ? 'Saved!' : 'Save'}</span>
          </button>
        }
      />

      {/* ─── Navigation Switcher Tabs ─── */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl bg-[var(--bg-secondary)] p-1.5 border-2 border-[var(--border)] shadow-sm">
        <button
          onClick={() => setActiveSectionTab('all')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-black transition-all',
            activeSectionTab === 'all'
              ? 'btn-duo-primary shadow-none'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <Compass size={16} />
          <span>All Modules</span>
        </button>
        <button
          onClick={() => setActiveSectionTab('explore')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-black transition-all',
            activeSectionTab === 'explore'
              ? 'btn-duo-primary shadow-none'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <BookMarked size={16} />
          <span>Features Hub</span>
        </button>
        <button
          onClick={() => setActiveSectionTab('account')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-black transition-all',
            activeSectionTab === 'account'
              ? 'btn-duo-primary shadow-none'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <ShieldCheck size={16} />
          <span>Account & Security</span>
        </button>
        <button
          onClick={() => setActiveSectionTab('preferences')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-black transition-all',
            activeSectionTab === 'preferences'
              ? 'btn-duo-primary shadow-none'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          )}
        >
          <Sliders size={16} />
          <span>Preferences</span>
        </button>
      </div>

      <div className="mt-8 space-y-8">
        {/* ═══ 1. EXPLORE & FEATURE DIRECTORY HUB ═══ */}
        {(activeSectionTab === 'all' || activeSectionTab === 'explore') && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-[var(--text-primary)]">Explore & Learn Modules</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Direct access to all learning tracks on mobile and desktop</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 auto-rows-fr">
              {featureHubItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link key={idx} href={item.href} className="group block h-full">
                    <GlassCard
                      className={`relative flex h-full items-center justify-between gap-4 p-4 sm:p-5 transition-all border ${item.border} group-hover:border-[var(--accent)] group-hover:shadow-md`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.bg} ${item.color} shadow-sm`}>
                          <Icon size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                              {item.title}
                            </h3>
                            {item.badge && (
                              <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-black text-[var(--accent)]">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      <ChevronRight size={18} className="shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
                    </GlassCard>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ═══ 2. ACCOUNT CREDENTIALS & SECURITY ═══ */}
        {(activeSectionTab === 'all' || activeSectionTab === 'account') && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard hover={false} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                      Account Credentials & Security
                    </h2>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      View your username, account details, and update your password
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {/* Username Row */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                        <AtSign size={14} className="text-[var(--accent)]" />
                        <span>Account Username</span>
                      </div>
                      <p className="mt-1 text-base font-black text-[var(--text-primary)] tracking-wide">
                        @{username}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyUsername}
                        className="btn-duo-secondary text-xs font-black flex items-center gap-1.5 py-2 px-3 rounded-xl"
                      >
                        {copiedUsername ? <CheckCheck size={14} /> : <Copy size={14} />}
                        <span>{copiedUsername ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Status & Change Toggle */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                        <KeyRound size={14} className="text-amber-500" />
                        <span>Account Password</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="font-mono text-base tracking-widest text-[var(--text-secondary)] font-bold">
                          ••••••••••••
                        </span>
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                          Bcrypt Secured
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowPasswordChange(!showPasswordChange)}
                      className="btn-duo-secondary text-xs font-black flex items-center gap-1.5 py-2 px-3 rounded-xl self-start sm:self-auto"
                    >
                      <Lock size={14} />
                      <span>{showPasswordChange ? 'Cancel' : 'Change Password'}</span>
                    </button>
                  </div>

                  {/* Expandable Change Password Form */}
                  <AnimatePresence>
                    {showPasswordChange && (
                      <motion.form
                        onSubmit={handleChangePassword}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-5 border-t border-[var(--border)] pt-5 space-y-4"
                      >
                        <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                          Set New Password
                        </h4>

                        {hasExistingPassword && (
                          <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)]">
                              Current Password
                            </label>
                            <div className="relative mt-1">
                              <input
                                type={showCurrentPass ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                className="input-field bg-[var(--bg-primary)] pr-10"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPass(!showCurrentPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)]">
                              New Password (min. 6 characters)
                            </label>
                            <div className="relative mt-1">
                              <input
                                type={showNewPass ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                className="input-field bg-[var(--bg-primary)] pr-10"
                                minLength={6}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPass(!showNewPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)]">
                              Confirm New Password
                            </label>
                            <div className="relative mt-1">
                              <input
                                type={showConfirmPass ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-type new password"
                                className="input-field bg-[var(--bg-primary)] pr-10"
                                minLength={6}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPass(!showConfirmPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              >
                                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowPasswordChange(false)}
                            className="btn-duo-secondary text-xs font-black py-2 px-3.5 rounded-xl"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={passwordSaving}
                            className="btn-duo-primary text-xs font-black py-2 px-4 rounded-xl flex items-center gap-1.5"
                          >
                            {passwordSaving ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Updating...</span>
                              </>
                            ) : (
                              'Save New Password'
                            )}
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ═══ 3. PROFILE & PREFERENCES ═══ */}
        {(activeSectionTab === 'all' || activeSectionTab === 'preferences') && (
          <>
            {/* Profile */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard hover={false} className="p-6">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-primary)]">
                  <User size={18} className="text-[var(--accent)]" />
                  Profile Settings
                </h2>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)]">
                      Display Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field mt-2 bg-[var(--bg-secondary)]"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-secondary)]">
                      Target CEFR Level
                    </label>
                    <div className="mt-2 flex gap-2">
                      {levels.map((l) => (
                        <button
                          key={l}
                          onClick={() => setTargetLevel(l)}
                          className={cn(
                            'btn-3d flex-1 rounded-xl py-2.5 text-sm font-black transition-all border',
                            targetLevel === l
                              ? 'bg-[var(--accent)] text-white border-2 border-[var(--accent-hover)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Theme */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <GlassCard hover={false} className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-primary)]">
                    <Sun size={18} className="text-[var(--accent)]" />
                    Theme & Visual Style
                  </h2>
                  <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-black text-[var(--accent)] border border-[var(--accent)]/20">
                    3 Styles Available
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {themes.map((t) => {
                    const Icon = t.icon;
                    const isActive = themeChoice === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleThemeSelect(t.id)}
                        className={cn(
                          'btn-3d flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition-all relative overflow-hidden',
                          isActive
                            ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/30'
                            : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/50'
                        )}
                      >
                        <div>
                          <div className={cn('h-14 w-full rounded-xl flex items-center justify-center font-black text-sm', t.preview)} aria-hidden />
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon size={18} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'} />
                              <span className="text-sm font-extrabold text-[var(--text-primary)]">{t.label}</span>
                            </div>
                            {isActive && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-black">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs font-medium text-[var(--text-tertiary)] leading-relaxed">
                            {t.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </motion.div>

            {/* AI Rate Limit & Status */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.055 }}
            >
              <GlassCard hover={false} className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-primary)]">
                    <Zap size={18} className="text-amber-500" />
                    AI Rate Limit & Status
                  </h2>
                  <button
                    onClick={fetchAiStatus}
                    disabled={aiStatusLoading}
                    className="btn-duo-secondary text-xs font-black flex items-center gap-1.5 py-2 px-3 rounded-xl"
                  >
                    {aiStatusLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    <span>{aiStatusLoading ? 'Checking...' : 'Check Status'}</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Live probe of Gemini & Groq AI services — latency, remaining quota, and errors
                </p>

                {aiServices.length === 0 ? (
                  <div className="mt-5 rounded-2xl border-2 border-dashed border-[var(--border)] p-6 text-center">
                    <Activity size={28} className="mx-auto text-[var(--text-tertiary)]" />
                    <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">
                      Click &quot;Check Status&quot; to probe AI services
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      Sends a tiny test request to each AI provider to measure availability and rate limits
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {aiServices.map((svc) => {
                      const statusConfig = {
                        operational: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-500', label: 'Operational' },
                        rate_limited: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', dot: 'bg-amber-500 animate-pulse', label: 'Rate Limited' },
                        error: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15', dot: 'bg-red-500', label: 'Error' },
                        unconfigured: { color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--bg-tertiary)]', dot: 'bg-gray-400', label: 'Not Configured' },
                      }[svc.status];

                      return (
                        <div
                          key={svc.name}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', svc.name === 'Google Gemini' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500')}>
                                <Zap size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-extrabold text-[var(--text-primary)]">{svc.name}</p>
                                {svc.model && (
                                  <p className="text-[11px] font-mono text-[var(--text-tertiary)]">{svc.model}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('h-2.5 w-2.5 rounded-full', statusConfig.dot)} />
                              <span className={cn('rounded-lg px-2.5 py-1 text-[11px] font-black', statusConfig.bg, statusConfig.color)}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>

                          {svc.configured && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {/* Latency */}
                              <div className="rounded-xl bg-[var(--bg-primary)] p-3 border border-[var(--border)]">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Latency</p>
                                <p className={cn('mt-1 text-lg font-black', svc.latencyMs !== null && svc.latencyMs < 2000 ? 'text-emerald-600 dark:text-emerald-400' : svc.latencyMs !== null && svc.latencyMs < 5000 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                                  {svc.latencyMs !== null ? `${svc.latencyMs}ms` : '—'}
                                </p>
                              </div>
                              {/* Remaining */}
                              <div className="rounded-xl bg-[var(--bg-primary)] p-3 border border-[var(--border)]">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Remaining</p>
                                <p className="mt-1 text-lg font-black text-[var(--text-primary)]">
                                  {svc.rateLimitInfo?.remaining !== null && svc.rateLimitInfo?.remaining !== undefined
                                    ? svc.rateLimitInfo.remaining.toLocaleString()
                                    : '—'}
                                  {svc.rateLimitInfo?.limit !== null && svc.rateLimitInfo?.limit !== undefined && (
                                    <span className="text-xs font-bold text-[var(--text-tertiary)]"> / {svc.rateLimitInfo.limit.toLocaleString()}</span>
                                  )}
                                </p>
                              </div>
                              {/* Reset */}
                              <div className="rounded-xl bg-[var(--bg-primary)] p-3 border border-[var(--border)] col-span-2 sm:col-span-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Resets</p>
                                <p className="mt-1 text-sm font-bold text-[var(--text-primary)] truncate">
                                  {svc.rateLimitInfo?.resetAt || '—'}
                                </p>
                              </div>
                            </div>
                          )}

                          {svc.error && (
                            <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                              <p className="text-xs font-bold text-red-600 dark:text-red-400 break-all">
                                {svc.error}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {aiLastChecked && (
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)] text-right">
                        Last checked: {aiLastChecked}
                      </p>
                    )}
                  </div>
                )}
              </GlassCard>
            </motion.div>

            {/* Sound Effects */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 }}
            >
              <GlassCard hover={false} className="p-6">
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                  <div className="flex items-center gap-3">
                    {soundEnabled ? (
                      <Volume2 size={20} className="text-[var(--accent)]" />
                    ) : (
                      <VolumeX size={20} className="text-[var(--text-tertiary)]" />
                    )}
                    <div>
                      <p className="text-sm font-bold">Sound Effects & Audio FX</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Correct, level up, mistake, and completion audio
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSoundToggle(!soundEnabled)}
                    className={cn(
                      'relative h-8 w-14 rounded-full transition-colors',
                      soundEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                    )}
                  >
                    <motion.span
                      className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
                      animate={{ x: soundEnabled ? 24 : 2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      style={{ left: 0 }}
                    />
                  </button>
                </div>
              </GlassCard>
            </motion.div>

            {/* Daily Goal */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <GlassCard hover={false} className="p-6">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--text-primary)]">
                  <Target size={18} className="text-[var(--accent)]" />
                  Daily Review Goal
                </h2>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Target number of spaced-repetition card reviews per day
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="h-2 flex-1 appearance-none rounded-full bg-[var(--bg-tertiary)] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
                  />
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Math.min(200, Math.max(5, Number(e.target.value) || 20)))}
                    className="input-field w-20 text-center font-bold"
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--text-tertiary)]">{dailyGoal} reviews/day</p>
              </GlassCard>
            </motion.div>

            {/* Reset System */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <GlassCard hover={false} className="p-6">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--danger)]">
                  <AlertTriangle size={18} />
                  Reset System
                </h2>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Irreversible actions. Confirm carefully.
                </p>
                <div className="mt-4 space-y-3">
                  {(Object.keys(resetConfig) as ResetType[]).map((type) => {
                    const config = resetConfig[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setResetModal(type)}
                        className={cn(
                          'btn-3d flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors bg-[var(--bg-secondary)]',
                          config.color
                        )}
                      >
                        <Icon size={20} />
                        <div>
                          <p className="font-bold">{config.title}</p>
                          <p className="text-xs opacity-90">{config.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </motion.div>

            {/* Account Sign Out */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <GlassCard hover={false} className="p-6">
                <h2 className="text-base font-extrabold text-[var(--text-primary)]">Sign Out</h2>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  End your active session securely
                </p>
                <button
                  onClick={handleLogout}
                  className="btn-3d mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-[var(--danger)] transition-colors hover:bg-red-500/20"
                >
                  <LogOut size={16} />
                  Log Out
                </button>
              </GlassCard>
            </motion.div>
          </>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {resetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => !resetLoading && setResetModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[var(--bg-primary)] p-6 shadow-2xl border border-[var(--border)]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[var(--danger)]/20 p-3">
                  <AlertTriangle size={24} className="text-[var(--danger)]" />
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">Confirm {resetConfig[resetModal].title}</h3>
              </div>
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                {resetConfig[resetModal].description}
              </p>
              <p className="mt-4 text-sm font-bold text-[var(--text-primary)]">
                Type <span className="font-mono font-black text-[var(--danger)]">RESET</span> to confirm:
              </p>
              <input
                type="text"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder="RESET"
                className="input-field mt-2 w-full bg-[var(--bg-secondary)]"
                disabled={resetLoading}
              />
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setResetModal(null)}
                  disabled={resetLoading}
                  className="btn-duo-secondary py-2.5 px-4 text-xs sm:text-sm font-black flex-1 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResetConfirm(resetModal)}
                  disabled={resetInput !== 'RESET' || resetLoading}
                  className="btn-duo-danger py-2.5 px-4 text-xs sm:text-sm font-black flex-1 rounded-xl"
                >
                  {resetLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    'Confirm Reset'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────

type Platform = 'reddit' | 'youtube' | 'rss' | 'lemmy' | 'peertube' | 'newsletter';
type SourceLifecycle = 'active' | 'stale' | 'dormant' | 'culled';

interface DiscoveredSource {
  id: string;
  platform: Platform;
  name: string;
  url: string;
  iconUrl?: string;
  description?: string;
  score: number;
  subscriberCount: number;
  weeklyActivity: number;
  autoApproved: boolean;
  status: string;
  relevanceScore: number;
  discoveredAt: number;
  lifecycle?: SourceLifecycle;
  metadata?: Record<string, unknown>;
}

interface TrendingSource {
  sourceId: string;
  name: string;
  platform: Platform;
  trendingScore: number;
  engagementVelocity: number;
  postVelocity: number;
}

interface StaleSource {
  source: DiscoveredSource;
  daysSinceLastPost: number;
}

interface SourceHealthEntry {
  source: DiscoveredSource;
  signals: { score: number; signals: Record<string, number>; lifecycle: SourceLifecycle };
}

interface DiscoveryStats {
  totalRuns: number;
  totalDiscovered: number;
  totalApproved: number;
  totalRejected: number;
  pendingCount: number;
  activeSources: number;
  staleSources: number;
  newThisWeek: number;
  perPlatform: Record<string, { discovered: number; approved: number; pending: number }>;
  lastRunAt: number | null;
  lastRunDuration: number | null;
  runHistory: Array<{ platform: string; discovered: number; autoApproved: number; pending: number; timestamp: number }>;
}

// ─── Admin wallets ────────────────────────────────────────────────────

const ADMIN_WALLETS_RAW = process.env.NEXT_PUBLIC_ADMIN_WALLETS || '';
const ADMIN_WALLETS = new Set(
  ADMIN_WALLETS_RAW.split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
);

const PLATFORM_ICONS: Record<string, string> = {
  reddit: '🔴',
  youtube: '▶️',
  rss: '📡',
  lemmy: '🔮',
  peertube: '🎬',
  newsletter: '📧',
};

const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  youtube: 'YouTube',
  rss: 'RSS Feed',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  newsletter: 'Newsletter',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ────────────────────────────────────────────────────────

export default function AdminSourcesPage() {
  const { walletAddress } = useAuth();
  const isAdmin = walletAddress && ADMIN_WALLETS.has(walletAddress.toLowerCase());

  // State
  const [pending, setPending] = useState<DiscoveredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // New data
  const [newThisWeek, setNewThisWeek] = useState<DiscoveredSource[]>([]);
  const [trending, setTrending] = useState<TrendingSource[]>([]);
  const [stale, setStale] = useState<StaleSource[]>([]);
  const [healthEntries, setHealthEntries] = useState<SourceHealthEntry[]>([]);
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'new-this-week' | 'trending' | 'stale' | 'health'>('pending');

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/sources/pending', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = (await res.json()) as { sources: DiscoveredSource[] };
      setPending(data.sources);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources');
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [pendingRes, newRes, trendingRes, staleRes, healthRes, statsRes] = await Promise.all([
        fetch('/api/sources/pending', { credentials: 'include' }),
        fetch('/api/sources/new-this-week', { credentials: 'include' }),
        fetch('/api/sources/trending', { credentials: 'include' }),
        fetch('/api/sources/stale', { credentials: 'include' }),
        fetch('/api/sources/health', { credentials: 'include' }),
        fetch('/api/sources/stats', { credentials: 'include' }),
      ]);
      if (pendingRes.ok) {
        const d = (await pendingRes.json()) as { sources: DiscoveredSource[] };
        setPending(d.sources);
      }
      if (newRes.ok) {
        const d = (await newRes.json()) as { sources: DiscoveredSource[] };
        setNewThisWeek(d.sources);
      }
      if (trendingRes.ok) {
        const d = (await trendingRes.json()) as { trending: TrendingSource[] };
        setTrending(d.trending);
      }
      if (staleRes.ok) {
        const d = (await staleRes.json()) as { sources: StaleSource[] };
        setStale(d.sources);
      }
      if (healthRes.ok) {
        const d = (await healthRes.json()) as { health: SourceHealthEntry[] };
        setHealthEntries(d.health);
      }
      if (statsRes.ok) {
        const d = (await statsRes.json()) as { stats: DiscoveryStats };
        setStats(d.stats);
      }
    } catch (e) {
      // Non-critical, individual fetches handle their own errors
    }
  }, [fetchPending]);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    Promise.all([fetchPending(), fetchAll()]).finally(() => setLoading(false));
  }, [isAdmin, fetchPending, fetchAll]);

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setError(null);
    try {
      const res = await fetch('/api/sources/discover?platform=all', { credentials: 'include' });
      if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
      const data = (await res.json()) as {
        success: boolean;
        discovered: number;
        autoApproved: number;
        pendingReview: number;
      };
      showToast(
        `Found ${data.discovered} sources (${data.autoApproved} auto-approved, ${data.pendingReview} pending)`,
        'success',
      );
      await fetchAll();
      await fetchPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [fetchPending, fetchAll, showToast]);

  const handleApprove = useCallback(
    async (id: string) => {
      setActionInProgress(id);
      try {
        const res = await fetch('/api/sources/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error('Failed to approve');
        showToast('Source approved', 'success');
        await fetchPending();
        await fetchAll();
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Approve failed', 'error');
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchPending, fetchAll, showToast],
  );

  const handleReject = useCallback(
    async (id: string) => {
      setActionInProgress(id);
      try {
        const res = await fetch('/api/sources/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error('Failed to reject');
        showToast('Source rejected', 'success');
        setPending((prev) => prev.filter((s) => s.id !== id));
        await fetchAll();
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Reject failed', 'error');
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchAll, showToast],
  );

  const handleBatchApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setActionInProgress('batch');
    try {
      const res = await fetch('/api/sources/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      showToast(`Approved ${selectedIds.size} sources`, 'success');
      setSelectedIds(new Set());
      await fetchPending();
      await fetchAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Batch approve failed', 'error');
    } finally {
      setActionInProgress(null);
    }
  }, [selectedIds, fetchPending, fetchAll, showToast]);

  const handleRunHealthCheck = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sources/health-check', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('Health check complete', 'success');
        await fetchAll();
      }
    } catch (e) {
      showToast('Health check failed', 'error');
    }
  }, [fetchAll, showToast]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredPending =
    platformFilter === 'all' ? pending : pending.filter((s) => s.platform === platformFilter);

  // ── Access denied ──

  if (!loading && (!walletAddress || !isAdmin)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-6 text-5xl">🔒</div>
        <h1 className="mb-4 text-2xl font-bold text-[var(--color-fg)]">Admin Access Required</h1>
        <p className="mb-8 text-[var(--color-muted)]">
          You need an admin wallet to access the source discovery dashboard.
        </p>
        <a href="/home" className="btn-primary inline-block">
          Back to Feed
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        <p className="mt-4 text-[var(--color-muted)]">Loading source discovery…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg transition-all ${
            toast.kind === 'success'
              ? 'bg-green-900/80 text-green-300'
              : 'bg-red-900/80 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Source Discovery</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Auto-discover new content sources across platforms
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRunHealthCheck}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
          >
            Health Check
          </button>
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discovering}
            className="rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {discovering ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
                Discovering…
              </span>
            ) : (
              'Run Discovery'
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Stats bar ── */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Total Runs" value={String(stats.totalRuns)} />
          <StatCard label="Total Discovered" value={formatCount(stats.totalDiscovered)} />
          <StatCard label="Approved" value={formatCount(stats.totalApproved)} color="text-green-400" />
          <StatCard label="Pending" value={String(stats.pendingCount)} color="text-yellow-400" />
          <StatCard label="Stale" value={String(stats.staleSources)} color={stats.staleSources > 5 ? 'text-red-400' : 'text-yellow-400'} />
          <StatCard label="New This Week" value={String(stats.newThisWeek)} color="text-degen-400" />
        </div>
      )}

      {/* ── Last run info ── */}
      {stats && stats.lastRunAt && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2">
          <span className="text-xs text-[var(--color-muted)]">
            Last discovery run: {formatTime(stats.lastRunAt)} ({stats.lastRunDuration ? formatDuration(stats.lastRunDuration) : 'N/A'})
          </span>
          {stats.runHistory.length > 0 && (
            <span className="text-xs text-gray-600">
              — {stats.runHistory.length} total runs, last: {stats.runHistory[0].platform} ({stats.runHistory[0].discovered} found)
            </span>
          )}
        </div>
      )}

      {/* ── Tab navigation ── */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        {[
          { id: 'pending' as const, label: 'Pending Review', count: pending.length },
          { id: 'new-this-week' as const, label: 'New This Week', count: newThisWeek.length },
          { id: 'trending' as const, label: 'Trending', count: trending.length },
          { id: 'stale' as const, label: 'Stale Sources', count: stale.length },
          { id: 'health' as const, label: 'Health Scores', count: healthEntries.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-degen-500 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="rounded-full bg-[var(--color-card)] px-2 py-0.5 text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
             TAB: PENDING REVIEW
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <>
          {/* Platform filter + batch actions */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['all', 'reddit', 'youtube', 'rss', 'lemmy', 'peertube', 'newsletter'] as const).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatformFilter(p)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      platformFilter === p
                        ? 'bg-degen-500/20 text-degen-400'
                        : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                    }`}
                  >
                    {p === 'all' ? 'All' : (PLATFORM_LABELS[p] ?? p)}
                  </button>
                ),
              )}
            </div>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={actionInProgress === 'batch'}
                className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionInProgress === 'batch' ? 'Approving…' : `Approve ${selectedIds.size}`}
              </button>
            )}
          </div>

          {/* Pending sources list */}
          {filteredPending.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
              <div className="mb-3 text-3xl text-gray-600">📡</div>
              <p className="text-sm text-[var(--color-muted)]">
                No pending sources. Click &ldquo;Run Discovery&rdquo; to find new sources.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPending.map((source) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-degen-500/20"
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(source.id)}
                      onChange={() => toggleSelect(source.id)}
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-card)] text-degen-500 focus:ring-degen-500"
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-lg">
                      {PLATFORM_ICONS[source.platform] ?? '📄'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-semibold text-[var(--color-fg)] hover:underline"
                        >
                          {source.name}
                        </a>
                        <span className="shrink-0 rounded-full bg-[var(--color-card)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                          {PLATFORM_LABELS[source.platform] ?? source.platform}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            source.score >= 0.7
                              ? 'bg-green-900/30 text-green-400'
                              : source.score >= 0.4
                                ? 'bg-yellow-900/30 text-yellow-400'
                                : 'bg-red-900/30 text-red-400'
                          }`}
                        >
                          {(source.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      {source.description && (
                        <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                          {source.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-muted)]">
                        <span>👥 {formatCount(source.subscriberCount)} subscribers</span>
                        <span>📊 {source.weeklyActivity}/week</span>
                        <span>🎯 {(source.relevanceScore * 100).toFixed(0)}% relevant</span>
                        <span>🕐 {formatTime(source.discoveredAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(source.id)}
                        disabled={actionInProgress === source.id}
                        className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionInProgress === source.id ? '…' : '✓ Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(source.id)}
                        disabled={actionInProgress === source.id}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
             TAB: NEW THIS WEEK
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'new-this-week' && (
        <div>
          {newThisWeek.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
              <div className="mb-3 text-3xl text-gray-600">🆕</div>
              <p className="text-sm text-[var(--color-muted)]">
                No new sources discovered this week. Run discovery to find fresh sources.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {newThisWeek.map((source) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-degen-500/20 bg-[var(--color-card)] p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">{PLATFORM_ICONS[source.platform] ?? '📄'}</span>
                    <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                      NEW
                    </span>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[var(--color-fg)] hover:underline"
                  >
                    {source.name}
                  </a>
                  {source.description && (
                    <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                      {source.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]">
                    <span>🎯 {(source.relevanceScore * 100).toFixed(0)}%</span>
                    <span>⭐ {(source.score * 100).toFixed(0)}</span>
                    <span>📊 {source.weeklyActivity}/week</span>
                    <span>🕐 {formatTime(source.discoveredAt)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(source.id)}
                      className="rounded-lg bg-green-500/20 px-2.5 py-1 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-500/30"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(source.id)}
                      className="rounded-lg bg-red-500/20 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/30"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
             TAB: TRENDING
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'trending' && (
        <div>
          {trending.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
              <div className="mb-3 text-3xl text-gray-600">📈</div>
              <p className="text-sm text-[var(--color-muted)]">
                No trending data yet. Engage with sources to generate trending scores.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {trending.map((t, i) => (
                <div
                  key={t.sourceId}
                  className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
                >
                  <span className="w-5 text-center text-xs font-bold text-[var(--color-muted)]">
                    #{i + 1}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-sm">
                    {PLATFORM_ICONS[t.platform] ?? '📄'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-fg)]">{t.name}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">{PLATFORM_LABELS[t.platform]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-degen-400">
                      {(t.trendingScore * 100).toFixed(0)}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)]">trending</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-[var(--color-fg)]">
                      {t.engagementVelocity.toFixed(1)}/d
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)]">engagement</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-[var(--color-fg)]">
                      {t.postVelocity.toFixed(1)}/d
                    </p>
                    <p className="text-[10px] text-[var(--color-muted)]">posts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
             TAB: STALE SOURCES
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'stale' && (
        <div>
          {stale.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
              <div className="mb-3 text-3xl text-gray-600">✅</div>
              <p className="text-sm text-[var(--color-muted)]">
                All active sources have posted within the last 14 days. No stale sources detected.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-400">
                  {stale.length} stale source{stale.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  Sources inactive for 14+ days. May be candidates for culling.
                </span>
              </div>
              <div className="space-y-2">
                {stale.map(({ source, daysSinceLastPost }) => (
                  <div
                    key={source.id}
                    className="flex items-center gap-4 rounded-xl border border-red-900/20 bg-[var(--color-card)] px-4 py-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-sm">
                      {PLATFORM_ICONS[source.platform] ?? '📄'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {source.name}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted)]">
                        {PLATFORM_LABELS[source.platform]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">{daysSinceLastPost}d</p>
                      <p className="text-[10px] text-[var(--color-muted)]">inactive</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--color-fg)]">
                        {(source.score * 100).toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-[var(--color-muted)]">quality</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
             TAB: HEALTH SCORES
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'health' && (
        <div>
          {healthEntries.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
              <div className="mb-3 text-3xl text-gray-600">🏥</div>
              <p className="text-sm text-[var(--color-muted)]">
                No health data yet. Run discovery and engage with sources to generate health scores.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {healthEntries.map(({ source, signals }) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-sm">
                      {PLATFORM_ICONS[source.platform] ?? '📄'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {source.name}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted)]">
                        {PLATFORM_LABELS[source.platform]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          signals.score >= 0.7
                            ? 'text-green-400'
                            : signals.score >= 0.4
                              ? 'text-yellow-400'
                              : 'text-red-400'
                        }`}
                      >
                        {(signals.score * 100).toFixed(0)}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted)]">composite</p>
                    </div>
                    <div
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                        signals.lifecycle === 'active'
                          ? 'bg-green-900/20 text-green-400'
                          : signals.lifecycle === 'stale'
                            ? 'bg-yellow-900/20 text-yellow-400'
                            : signals.lifecycle === 'dormant'
                              ? 'bg-red-900/20 text-red-400'
                              : 'bg-[var(--color-card)]/20 text-[var(--color-muted)]'
                      }`}
                    >
                      {signals.lifecycle}
                    </div>
                  </div>
                  {/* Health signal bars */}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(signals.signals).map(([key, value]) => (
                      <div key={key}>
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[9px] capitalize text-[var(--color-muted)]">
                            {key}
                          </span>
                          <span className="text-[9px] text-[var(--color-fg)]">
                            {(value * 100).toFixed(0)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                          <div
                            className={`h-full rounded-full ${
                              value >= 0.15
                                ? 'bg-green-500/60'
                                : value >= 0.08
                                  ? 'bg-yellow-500/60'
                                  : 'bg-red-500/60'
                            }`}
                            style={{ width: `${Math.min(value * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = 'text-[var(--color-fg)]',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{label}</p>
    </div>
  );
}

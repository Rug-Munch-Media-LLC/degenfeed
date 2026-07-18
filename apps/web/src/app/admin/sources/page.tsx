'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────

type Platform = 'reddit' | 'youtube' | 'rss' | 'lemmy' | 'peertube' | 'newsletter';

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
  metadata?: Record<string, unknown>;
}

interface PendingResponse {
  sources: DiscoveredSource[];
  total: number;
}

interface DiscoverResponse {
  success: boolean;
  platform: string;
  discovered: number;
  autoApproved: number;
  pendingReview: number;
  sources: DiscoveredSource[];
}

// ─── Admin wallets (same as moderation page) ──────────────────────────

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

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ────────────────────────────────────────────────────────

export default function AdminSourcesPage() {
  const { walletAddress } = useAuth();
  const [pending, setPending] = useState<DiscoveredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isAdmin = walletAddress && ADMIN_WALLETS.has(walletAddress.toLowerCase());

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/sources/pending', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Admin access required');
          return;
        }
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      const data = (await res.json()) as PendingResponse;
      setPending(data.sources);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    fetchPending().finally(() => setLoading(false));
  }, [isAdmin, fetchPending]);

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    setError(null);
    try {
      const res = await fetch('/api/sources/discover?platform=all', { credentials: 'include' });
      if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
      const data = (await res.json()) as DiscoverResponse;
      showToast(
        `Found ${data.discovered} sources (${data.autoApproved} auto-approved, ${data.pendingReview} pending)`,
        'success',
      );
      await fetchPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [fetchPending, showToast]);

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
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Approve failed', 'error');
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchPending, showToast],
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
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Reject failed', 'error');
      } finally {
        setActionInProgress(null);
      }
    },
    [showToast],
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
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Batch approve failed', 'error');
    } finally {
      setActionInProgress(null);
    }
  }, [selectedIds, fetchPending, showToast]);

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

  // ── Not admin → access denied ──

  if (!loading && (!walletAddress || !isAdmin)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-6 text-5xl">🔒</div>
        <h1 className="mb-4 text-2xl font-bold text-[var(--color-fg)]">Admin Access Required</h1>
        <p className="mb-8 text-gray-400">
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
        <p className="mt-4 text-gray-500">Loading source discovery…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Source Discovery</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Auto-discover new content sources across platforms
          </p>
        </div>
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

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Pending Review', count: pending.length, color: 'text-yellow-400' },
          {
            label: 'Auto-Approved',
            count: pending.filter((s) => s.autoApproved).length,
            color: 'text-green-400',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

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
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(source.id)}
                  onChange={() => toggleSelect(source.id)}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-card)] text-degen-500 focus:ring-degen-500"
                />

                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card)] text-lg">
                  {PLATFORM_ICONS[source.platform] ?? '📄'}
                </div>

                {/* Content */}
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

                {/* Actions */}
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
    </div>
  );
}

'use client';

import { useAuth } from '../../../components/AuthProvider';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface ReportEntry {
  id: string;
  postId: string;
  protocol: string;
  reason: string;
  description?: string;
  reporterAddress: string;
  reportedAt: number;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: number;
  postText?: string;
  postAuthorId?: string;
  postAuthorHandle?: string;
}

interface ModStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
  today: number;
  week: number;
  month: number;
  resolutionRate: number;
  activeBans: number;
}

interface StatsResponse {
  stats: ModStats;
  topReporters: { address: string; count: number }[];
  mostReported: { userId: string; count: number }[];
}

// ─── Admin wallets (hardcoded for now; also checked server-side) ──────
// In production, this should be set via NEXT_PUBLIC_ADMIN_WALLETS env var.
const ADMIN_WALLETS_RAW =
  process.env.NEXT_PUBLIC_ADMIN_WALLETS || '';
const ADMIN_WALLETS = new Set(
  ADMIN_WALLETS_RAW.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
);

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  scam: 'Scam',
  nsfw: 'NSFW',
  other: 'Other',
};

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  mastodon: '🐘',
  threads: '🧵',
  reddit: '🔴',
  rss: '📡',
  ponder: '🔍',
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

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Component ────────────────────────────────────────────────────────

export default function AdminModerationPage() {
  const { walletAddress } = useAuth();
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [showBanModal, setShowBanModal] = useState<{
    userId: string;
    protocol: string;
    postAuthorHandle?: string;
    walletAddress?: string;
  } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);

  const isAdmin =
    walletAddress && ADMIN_WALLETS.has(walletAddress.toLowerCase());

  const showToast_ = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (protocolFilter) params.set('protocol', protocolFilter);
      if (reasonFilter) params.set('reason', reasonFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/moderation/reports?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Admin access required');
          return;
        }
        throw new Error(`Failed to fetch reports: ${res.status}`);
      }
      const data = (await res.json()) as {
        reports: ReportEntry[];
        total: number;
      };
      setReports(data.reports);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    }
  }, [statusFilter, protocolFilter, reasonFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/moderation/stats', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as StatsResponse;
        setStats(data);
      }
    } catch {
      // stats are non-critical
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    Promise.all([fetchReports(), fetchStats()]).finally(() => setLoading(false));
  }, [isAdmin, fetchReports, fetchStats]);

  const handleAction = useCallback(
    async (reportId: string, action: 'resolve' | 'remove', e: React.MouseEvent) => {
      e.stopPropagation();
      setActionInProgress(reportId);
      try {
        const endpoint =
          action === 'resolve'
            ? `/api/moderation/reports/${reportId}/resolve`
            : `/api/moderation/reports/${reportId}/remove`;
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error || `Failed to ${action}`);
        }
        showToast_(`Report ${action === 'resolve' ? 'resolved' : 'post removed'}`, 'success');
        void fetchReports();
        void fetchStats();
      } catch (e) {
        showToast_(e instanceof Error ? e.message : 'Action failed', 'error');
      } finally {
        setActionInProgress(null);
      }
    },
    [fetchReports, fetchStats, showToast_],
  );

  const handleBan = useCallback(async () => {
    if (!showBanModal || !banReason.trim()) return;
    setBanning(true);
    try {
      const res = await fetch('/api/moderation/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: showBanModal.userId,
          protocol: showBanModal.protocol,
          reason: banReason.trim(),
          walletAddress: showBanModal.walletAddress,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Failed to ban user');
      }
      showToast_(`Banned ${showBanModal.postAuthorHandle || showBanModal.userId}`, 'success');
      setShowBanModal(null);
      setBanReason('');
    } catch (e) {
      showToast_(e instanceof Error ? e.message : 'Ban failed', 'error');
    } finally {
      setBanning(false);
    }
  }, [showBanModal, banReason, showToast_]);

  // ── Not admin → access denied ──

  if (!loading && (!walletAddress || !isAdmin)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-6 text-5xl">🔒</div>
        <h1 className="mb-4 text-2xl font-bold text-[var(--color-fg)]">Admin Access Required</h1>
        <p className="mb-8 text-gray-400">
          You need an admin wallet to access the moderation dashboard.
          <br />
          {walletAddress ? (
            <>
              Connected wallet: <code className="text-degen-400">{shortenAddress(walletAddress)}</code>
            </>
          ) : (
            'Please connect your wallet first.'
          )}
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
        <p className="mt-4 text-gray-500">Loading moderation dashboard…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${
            toast.kind === 'success'
              ? 'border border-green-500/30 bg-green-900/40 text-green-300'
              : 'border border-red-500/30 bg-red-900/40 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Moderation Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage reported content across all protocols
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Reports Today"
            value={stats.stats.today}
            subtitle={`${stats.stats.week} this week · ${stats.stats.month} this month`}
          />
          <StatCard
            label="Pending"
            value={stats.stats.pending}
            subtitle={`${stats.stats.total} total`}
            accent="yellow"
          />
          <StatCard
            label="Resolution Rate"
            value={`${stats.stats.resolutionRate}%`}
            subtitle={`${stats.stats.resolved} resolved · ${stats.stats.dismissed} dismissed`}
            accent={stats.stats.resolutionRate > 80 ? 'green' : stats.stats.resolutionRate > 50 ? 'yellow' : 'red'}
          />
          <StatCard
            label="Active Bans"
            value={stats.stats.activeBans}
            subtitle="Across all protocols"
            accent="red"
          />

          {/* Top reporters */}
          {stats.topReporters.length > 0 && (
            <div className="col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Top Reporters
              </h3>
              <div className="space-y-1.5">
                {stats.topReporters.slice(0, 5).map((r) => (
                  <div key={r.address} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-400">{shortenAddress(r.address)}</span>
                    <span className="font-medium text-[var(--color-fg)]">{r.count} reports</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most reported users */}
          {stats.mostReported.length > 0 && (
            <div className="col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Most Reported Users
              </h3>
              <div className="space-y-1.5">
                {stats.mostReported.slice(0, 5).map((r) => (
                  <div key={r.userId} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-400">
                      {r.userId.length > 30 ? `${r.userId.slice(0, 30)}…` : r.userId}
                    </span>
                    <span className="font-medium text-red-400">{r.count} reports</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
        >
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All Statuses</option>
        </select>

        <select
          value={protocolFilter}
          onChange={(e) => setProtocolFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
        >
          <option value="">All Protocols</option>
          {['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads', 'reddit', 'rss'].map(
            (p) => (
              <option key={p} value={p}>
                {PROTOCOL_ICONS[p] || ''} {p}
              </option>
            ),
          )}
        </select>

        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
        >
          <option value="">All Reasons</option>
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            void fetchReports();
            void fetchStats();
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-gray-400 hover:bg-[var(--color-muted)] transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-900/20 p-4 text-sm text-red-400">
          {error}
          <button
            type="button"
            onClick={() => void fetchReports()}
            className="ml-3 underline hover:text-red-300 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Report queue */}
      <div className="space-y-3">
        {reports.length === 0 && !error && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">All Clear</h3>
            <p className="text-xs text-gray-500">
              No {statusFilter !== 'all' ? statusFilter : ''} reports to review.
            </p>
          </div>
        )}

        {reports.map((report) => (
          <div
            key={report.id}
            className={`rounded-xl border bg-[var(--color-card)] p-4 transition-colors ${
              report.status === 'pending'
                ? 'border-yellow-500/20'
                : 'border-[var(--color-border)] opacity-70'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Report details */}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      report.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {report.status}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-medium text-gray-400">
                    {PROTOCOL_ICONS[report.protocol] || ''} {report.protocol}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      report.reason === 'scam'
                        ? 'bg-red-500/20 text-red-400'
                        : report.reason === 'harassment'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-[var(--color-muted)] text-gray-400'
                    }`}
                  >
                    {REASON_LABELS[report.reason] || report.reason}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {formatTime(report.reportedAt)}
                  </span>
                </div>

                <p className="mb-1 text-xs text-gray-500">
                  Report <span className="font-mono text-gray-400">{report.id}</span>
                  {' · '}
                  Reporter:{' '}
                  <span className="font-mono text-gray-400">
                    {shortenAddress(report.reporterAddress)}
                  </span>
                </p>

                <p className="mb-1 text-xs text-gray-500">
                  Post:{' '}
                  <span className="font-mono text-gray-400">
                    {report.postId.length > 40
                      ? `${report.postId.slice(0, 40)}…`
                      : report.postId}
                  </span>
                </p>

                {report.postAuthorHandle && (
                  <p className="mb-1 text-xs text-gray-500">
                    Author:{' '}
                    <span className="font-mono text-gray-400">{report.postAuthorHandle}</span>
                  </p>
                )}

                {report.description && (
                  <p className="mt-2 rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-gray-400 italic">
                    "{report.description}"
                  </p>
                )}

                {report.resolvedBy && (
                  <p className="mt-1 text-[10px] text-gray-600">
                    Resolved by {shortenAddress(report.resolvedBy)}
                    {report.resolvedAt && ` · ${formatTime(report.resolvedAt)}`}
                  </p>
                )}
              </div>

              {/* Actions */}
              {report.status === 'pending' && (
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    disabled={actionInProgress === report.id}
                    onClick={(e) => void handleAction(report.id, 'resolve', e)}
                    className="w-full rounded-lg border border-green-500/30 px-4 py-2 text-xs font-medium text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40 sm:w-auto"
                  >
                    {actionInProgress === report.id ? '…' : '✓ Dismiss'}
                  </button>
                  <button
                    type="button"
                    disabled={actionInProgress === report.id}
                    onClick={(e) => void handleAction(report.id, 'remove', e)}
                    className="w-full rounded-lg border border-red-500/30 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 sm:w-auto"
                  >
                    {actionInProgress === report.id ? '…' : '✕ Remove Post'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBanModal({
                        userId: report.postAuthorId || report.postId,
                        protocol: report.protocol,
                        postAuthorHandle: report.postAuthorHandle,
                      });
                    }}
                    className="w-full rounded-lg border border-orange-500/30 px-4 py-2 text-xs font-medium text-orange-400 hover:bg-orange-500/10 transition-colors sm:w-auto"
                  >
                    🚫 Ban User
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ban modal */}
      {showBanModal && (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!banning) setShowBanModal(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !banning) setShowBanModal(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Ban user"
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">Ban User</h2>
            <p className="mb-4 text-sm text-gray-400">
              This will block the user across all protocols.
              {showBanModal.postAuthorHandle && (
                <>
                  {' '}
                  Handle: <span className="font-mono text-red-400">{showBanModal.postAuthorHandle}</span>
                </>
              )}
            </p>
            <div className="mb-4">
              <label htmlFor="ban-reason" className="mb-1 block text-sm font-medium text-gray-400">
                Reason for ban
              </label>
              <textarea
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Explain why this user is being banned…"
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder-gray-600 focus:border-degen-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowBanModal(null);
                  setBanReason('');
                }}
                disabled={banning}
                className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-gray-400 hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBan()}
                disabled={banning || !banReason.trim()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {banning ? 'Banning…' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Stat Card Component ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: 'green' | 'yellow' | 'red';
}) {
  const accentColors: Record<string, string> = {
    green: 'border-green-500/20 text-green-400',
    yellow: 'border-yellow-500/20 text-yellow-400',
    red: 'border-red-500/20 text-red-400',
  };
  const valueClass = accent ? accentColors[accent] ?? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]';

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {subtitle && <p className="mt-1 text-[10px] text-gray-600">{subtitle}</p>}
    </div>
  );
}

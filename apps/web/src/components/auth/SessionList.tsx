'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../Toast';

/* ─── Types ─────────────────────────────────────────────────── */

export interface SessionMeta {
  nonce: string;
  address: string;
  chain: 'ethereum' | 'solana';
  browser: string;
  os: string;
  device: string;
  ip: string;
  location: string;
  loginAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

/* ─── Device Icon ───────────────────────────────────────────── */

function DeviceIcon({ device, os }: { device: string; os: string }) {
  // Pick an icon based on device type
  let icon: string;
  let label: string;

  if (device === 'Mobile') {
    icon = '📱';
    label = 'Mobile device';
  } else if (device === 'Tablet') {
    icon = '📟';
    label = 'Tablet';
  } else if (device === 'API') {
    icon = '⚙️';
    label = 'API client';
  } else {
    // Desktop
    icon = os === 'macOS' ? '💻' : os === 'Windows' ? '🖥️' : '🖥️';
    label = `${os} desktop`;
  }

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-overlay)] text-base"
      role="img"
      aria-label={label}
    >
      {icon}
    </div>
  );
}

/* ─── Format helpers ────────────────────────────────────────── */

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskIp(ip: string): string {
  if (!ip) return '';
  // Mask last octet for IPv4, last 40 bits for IPv6
  if (ip.includes(':')) {
    // IPv6 — show first 4 groups
    const parts = ip.split(':');
    if (parts.length > 4) {
      return `${parts.slice(0, 4).join(':')}:****`;
    }
    return `${parts[0]}****`;
  }
  // IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  return ip;
}

/* ─── Confirm dialog ────────────────────────────────────────── */

function ConfirmAction({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  variant,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  variant?: 'danger' | 'default';
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 shadow-2xl animate-fade-in">
        <h3 className="text-base font-semibold text-[var(--color-fg)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                : 'bg-degen-500/15 text-degen-400 hover:bg-degen-500/25'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {confirmLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Session List ──────────────────────────────────────────── */

export function SessionList() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const { showToast } = useToast();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sessions', {
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in required');
          return;
        }
        throw new Error(`Failed to fetch sessions (${res.status})`);
      }
      const data = (await res.json()) as { sessions: SessionMeta[] };
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = useCallback(
    async (nonce: string) => {
      setRevokingId(nonce);
      try {
        const res = await fetch(`/api/auth/sessions/${nonce}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'x-csrf-token': '' }, // CSRF handled via cookie session check
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? 'Failed to revoke session');
        }
        showToast('success', 'Session revoked');
        // Remove from local state
        setSessions((prev) => prev.filter((s) => s.nonce !== nonce));
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to revoke session');
      } finally {
        setRevokingId(null);
      }
    },
    [showToast],
  );

  const handleRevokeAll = useCallback(async () => {
    setRevokingAll(true);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Failed to revoke sessions');
      }
      const data = (await res.json()) as { revokedCount: number; message?: string };
      showToast('success', data.message ?? `${data.revokedCount} session(s) revoked`);
      // Keep only the current session
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setRevokingAll(false);
      setShowRevokeAll(false);
    }
  }, [showToast]);

  /* ─── Loading skeleton ────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => `session-skeleton-${i}`).map((key) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
          >
            <div className="skeleton h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-4 w-48 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ─── Error state ─────────────────────────────────────── */

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={fetchSessions}
          className="mt-3 rounded-lg bg-[var(--color-overlay)] px-4 py-2 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)]"
        >
          Try again
        </button>
      </div>
    );
  }

  /* ─── Empty state ─────────────────────────────────────── */

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
        <div className="text-2xl mb-2">🔐</div>
        <p className="text-sm font-medium text-[var(--color-fg)]">No active sessions</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Sessions appear here after you sign in.
        </p>
      </div>
    );
  }

  /* ─── Session rows ────────────────────────────────────── */

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.nonce}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
              session.isCurrent
                ? 'border-degen-500/30 bg-degen-500/5'
                : 'border-[var(--color-glass-border)] bg-[var(--color-card)]'
            }`}
          >
            <DeviceIcon device={session.device} os={session.os} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {session.browser || 'Unknown browser'}
                </span>
                {session.os && (
                  <span className="text-xs text-[var(--color-muted)]">on {session.os}</span>
                )}
                {session.isCurrent && (
                  <span className="inline-flex items-center rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-degen-400">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-muted)]">
                {session.ip && <span>{maskIp(session.ip)}</span>}
                {session.location && <span>{session.location}</span>}
                {session.device && <span>via {session.device}</span>}
                <span>{formatTime(session.loginAt)}</span>
              </div>
            </div>

            {!session.isCurrent && (
              <button
                type="button"
                onClick={() => handleRevoke(session.nonce)}
                disabled={revokingId === session.nonce}
                className="shrink-0 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                aria-label={`Revoke session on ${session.browser}`}
              >
                {revokingId === session.nonce ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  'Revoke'
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Revoke all other sessions */}
      {otherCount > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowRevokeAll(true)}
            className="w-full rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Revoke all {otherCount} other session{otherCount !== 1 ? 's' : ''}
          </button>

          <ConfirmAction
            open={showRevokeAll}
            title="Revoke all other sessions?"
            description={`This will sign out ${otherCount} other device${otherCount !== 1 ? 's' : ''}. Your current session will remain active.`}
            confirmLabel="Revoke all"
            onConfirm={handleRevokeAll}
            onCancel={() => setShowRevokeAll(false)}
            loading={revokingAll}
            variant="danger"
          />
        </>
      )}
    </div>
  );
}

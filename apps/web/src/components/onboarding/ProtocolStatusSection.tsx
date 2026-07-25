'use client';

/**
 * @component ProtocolStatusSection
 *
 * Displays on the user's profile:
 *   1. Which protocols they have accounts on
 *   2. "Create account" button for protocols they don't have
 *   3. Link to their profile on each network
 *   4. Content count per protocol
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

interface ProtocolInfo {
  registered: boolean;
  username: string | null;
  profileUrl: string | null;
  label: string;
  icon: string;
  color: string;
}

interface ProtocolStatusData {
  protocols: Record<string, ProtocolInfo>;
  connectedCount: number;
  totalPlatforms: number;
}

interface Props {
  /** Wallet address of the profile being viewed */
  walletAddress?: string;
  /** Whether this is the user's own profile */
  isOwnProfile: boolean;
}

// ─── Protocol Icons (for unregistered) ────────────────────────────────────

const PROTOCOL_DETAILS: Record<string, { icon: string; color: string }> = {
  mastodon: { icon: '🐘', color: '#6364ff' },
  peertube: { icon: '▶️', color: '#f2691d' },
  lemmy: { icon: '🔮', color: '#4a8c6f' },
  pixelfed: { icon: '📷', color: '#f5a623' },
  writefreely: { icon: '✍️', color: '#2eaadc' },
  bookwyrm: { icon: '📚', color: '#4a8c6f' },
  mobilizon: { icon: '📅', color: '#f15a22' },
  funkwhale: { icon: '🎵', color: '#a855f7' },
};

// ─── Component ───────────────────────────────────────────────────────────

export function ProtocolStatusSection({ walletAddress, isOwnProfile }: Props) {
  const [data, setData] = useState<ProtocolStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [showJoinAll, setShowJoinAll] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/protocol/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: ProtocolStatusData };
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load protocol status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const createAccount = useCallback(
    async (protocol: string, desiredUsername?: string) => {
      setCreating(protocol);
      try {
        const username = desiredUsername || `user${(walletAddress || '').slice(2, 8)}`;
        const res = await fetch(`/api/protocol/${protocol}/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        if (res.ok) {
          await fetchStatus(); // Refresh the status
        } else {
          const errJson = (await res.json().catch(() => ({}))) as {
            data?: { error?: string };
            error?: string;
          };
          alert(
            `Failed to create account: ${errJson.data?.error || errJson.error || `HTTP ${res.status}`}`,
          );
        }
      } catch (err) {
        alert(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      } finally {
        setCreating(null);
      }
    },
    [walletAddress, fetchStatus],
  );

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 animate-pulse">
        <div className="mb-4 h-5 w-40 skeleton rounded-lg" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm text-[var(--color-muted)]">
          {error || 'Unable to load protocol status'}
        </p>
      </div>
    );
  }

  const protocolEntries = Object.entries(data.protocols);
  const registeredCount = data.connectedCount;
  const totalCount = data.totalPlatforms;

  return (
    <div className="mb-6">
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Protocol Accounts</h3>
            <p className="text-xs text-[var(--color-muted)]">
              {registeredCount} of {totalCount} networks connected
            </p>
          </div>
          {isOwnProfile && registeredCount < totalCount && (
            <button
              type="button"
              onClick={() => setShowJoinAll(!showJoinAll)}
              className="btn-primary text-xs"
            >
              {showJoinAll ? 'Cancel' : `Join All (${totalCount - registeredCount})`}
            </button>
          )}
        </div>

        {/* Protocol grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {protocolEntries.map(([id, info]) => {
            const details = PROTOCOL_DETAILS[id] || { icon: '🔗', color: '#666' };
            return (
              <div
                key={id}
                className={`rounded-xl border p-3 transition-all ${
                  info.registered
                    ? 'border-green-500/20 bg-green-500/[0.03]'
                    : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)]'
                }`}
              >
                {/* Icon + Status */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-lg" role="img" aria-label={info.label}>
                    {info.icon || details.icon}
                  </span>
                  {info.registered ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--color-muted)]">—</span>
                  )}
                </div>

                {/* Name */}
                <p className="text-xs font-medium text-[var(--color-fg)]">
                  {info.label.split(' ')[0]}
                </p>

                {/* Username or action */}
                {info.registered && info.username ? (
                  <div className="mt-1 min-w-0">
                    <p className="truncate text-[10px] text-[var(--color-muted)]">
                      {info.username}
                    </p>
                    {info.profileUrl && (
                      <a
                        href={info.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-degen-400 hover:underline"
                      >
                        View Profile ↗
                      </a>
                    )}
                  </div>
                ) : isOwnProfile && !info.registered ? (
                  <button
                    type="button"
                    onClick={() => createAccount(id)}
                    disabled={creating === id}
                    className="mt-1.5 rounded-lg border border-degen-500/20 px-2 py-0.5 text-[10px] font-medium text-degen-400 hover:bg-degen-500/10 disabled:opacity-50 transition-colors"
                  >
                    {creating === id ? 'Creating...' : 'Create Account'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Join All prompt */}
        {showJoinAll && isOwnProfile && (
          <div className="mt-4 border-t border-[var(--color-glass-border)] pt-4">
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              Create accounts on all unregistered networks with one click:
            </p>
            <div className="flex flex-wrap gap-2">
              {protocolEntries
                .filter(([, info]) => !info.registered)
                .map(([id]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => createAccount(id)}
                    disabled={creating !== null}
                    className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:bg-[var(--color-overlay)] disabled:opacity-50"
                  >
                    {PROTOCOL_DETAILS[id]?.icon || '🔗'} Create{' '}
                    {(PROTOCOL_DETAILS[id]?.icon || '').length > 0 ? '' : id}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  setShowJoinAll(false);
                  window.location.href = '/register';
                }}
                className="btn-primary text-xs"
              >
                Full Registration Flow →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content count summary */}
      {registeredCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {protocolEntries
            .filter(([, info]) => info.registered)
            .map(([id]) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={{
                  backgroundColor: `${PROTOCOL_DETAILS[id]?.color || '#666'}15`,
                  color: PROTOCOL_DETAILS[id]?.color || '#666',
                }}
              >
                {PROTOCOL_DETAILS[id]?.icon || '🔗'}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Utility hook ─────────────────────────────────────────────────────────

/**
 * Hook to fetch and use protocol status.
 */
export function useProtocolStatus() {
  const [data, setData] = useState<ProtocolStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/protocol/status')
      .then((r) => r.json())
      .then((json) => {
        setData((json as { data: ProtocolStatusData }).data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return {
    data,
    loading,
    registeredCount: data?.connectedCount ?? 0,
    totalCount: data?.totalPlatforms ?? 0,
  };
}

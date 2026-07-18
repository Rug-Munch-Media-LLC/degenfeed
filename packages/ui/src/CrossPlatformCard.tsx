'use client';

/**
 * @degenfeed/ui — CrossPlatformCard
 *
 * Profile page card showing "Cross-Platform Setup" summary.
 * Displays which platforms the user has accounts on, a progress bar,
 * and a CTA to open the full CrossPlatformSetup component.
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

export interface CrossPlatformCardProps {
  /** Wallet address of the current user */
  walletAddress: string;
  /** Whether the user is premium */
  isPremium?: boolean;
  /** Custom API base URL */
  apiBase?: string;
  /** Callback when the "Setup" button is clicked */
  onOpenSetup?: () => void;
  /** Callback when the "Upgrade to Pro" button is clicked (instead of navigating) */
  onUpgrade?: () => void;
}

interface PlatformStatusEntry {
  registered: boolean;
  username: string | null;
}

interface StatusResponse {
  data: {
    platformStatus: Record<string, PlatformStatusEntry>;
    connectedCount: number;
    totalPlatforms: number;
    isPremium: boolean;
    tier: string | null;
  };
}

// ─── Component ────────────────────────────────────────────────────────

export function CrossPlatformCard({
  walletAddress,
  isPremium: propIsPremium,
  apiBase = '',
  onOpenSetup,
  onUpgrade,
}: CrossPlatformCardProps) {
  const [connectedCount, setConnectedCount] = useState(0);
  const [totalPlatforms] = useState(5);
  const [platformStatus, setPlatformStatus] = useState<Record<string, PlatformStatusEntry>>({});
  const [isPremium, setIsPremium] = useState(propIsPremium ?? false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) return;

    try {
      const res = await fetch(`${apiBase}/api/register-platform/status`, {
        credentials: 'include',
      });

      if (!res.ok) return;

      const json = (await res.json()) as StatusResponse;
      const data = json.data;

      setConnectedCount(data.connectedCount);
      setPlatformStatus(data.platformStatus);
      setIsPremium(data.isPremium || propIsPremium || false);
    } catch {
      // Silently fail — card is decorative
    } finally {
      setLoading(false);
    }
  }, [walletAddress, apiBase, propIsPremium]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
        </div>
      </div>
    );
  }

  const progressPct = (connectedCount / totalPlatforms) * 100;

  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-fg)]">Cross-Platform Setup</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            {connectedCount}/{totalPlatforms} platforms connected
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
            isPremium
              ? 'bg-degen-500/15 text-degen-400'
              : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {isPremium ? 'Pro' : 'Upgrade'}
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-4">
        <div className="h-2 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-degen-500 to-purple-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Platform grid ── */}
      <div className="mb-4 grid grid-cols-5 gap-1">
        {(['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] as const).map((p) => {
          const icons: Record<string, string> = {
            nostr: '⚡',
            farcaster: '◈',
            lens: '◎',
            bluesky: '☁',
            mastodon: '🐘',
          };
          const colors: Record<string, string> = {
            nostr: '#8b5cf6',
            farcaster: '#8a63d2',
            lens: '#abfe2c',
            bluesky: '#1185fe',
            mastodon: '#6364ff',
          };
          const registered = platformStatus[p]?.registered;
          const username = platformStatus[p]?.username;

          return (
            <div key={p} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all ${
                  registered
                    ? 'ring-2 ring-offset-1 ring-offset-[var(--color-card)]'
                    : 'opacity-30'
                }`}
                style={{
                  backgroundColor: registered ? `${colors[p]}22` : 'var(--color-glass-border)',
                  ...(registered ? { '--tw-ring-color': colors[p] } as React.CSSProperties : {}),
                }}
                title={registered && username ? `${p}: @${username}` : p}
              >
                <span aria-hidden="true">{icons[p]}</span>
              </div>
              <span
                className="text-[9px] font-medium truncate max-w-full"
                style={{ color: registered ? colors[p] : 'var(--color-muted)' }}
              >
                {registered && username ? username.slice(0, 8) : p.slice(0, 4)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── CTA ── */}
      <button
        type="button"
        onClick={isPremium ? onOpenSetup : (onUpgrade ?? onOpenSetup)}
        className={`w-full rounded-lg py-2 text-xs font-medium transition-colors ${
          isPremium
            ? 'bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 border border-degen-500/30'
            : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
        }`}
      >
        {isPremium
          ? connectedCount < totalPlatforms
            ? `Create accounts on all platforms`
            : 'Manage connected platforms'
          : 'Upgrade to Pro →'}
      </button>
    </div>
  );
}

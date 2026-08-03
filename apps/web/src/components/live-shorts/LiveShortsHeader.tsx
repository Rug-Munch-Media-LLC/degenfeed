'use client';

/**
 * LiveShortsHeader — Hero section showing currently-live count + Go Live CTA.
 *
 * Features:
 *   - Animated live count with pulsing dot
 *   - "Go Live" button with auth guard
 *   - Protocol pill indicators showing which protocols have live content
 */

import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';

interface LiveShortsHeaderProps {
  liveCount: number;
  protocols?: string[];
  onGoLive: () => void;
  onRefresh: () => void;
  isValidating?: boolean;
}

function PulseDot() {
  return (
    <span className="relative flex h-3 w-3" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
    </span>
  );
}

function LiveCountBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-0.5 text-xs font-semibold text-red-400">
      <PulseDot />
      {count} live{count !== 1 ? 's' : ''}
    </span>
  );
}

function ProtocolPills({ protocols }: { protocols?: string[] }) {
  if (!protocols || protocols.length === 0) return null;

  const protocolColors: Record<string, { label: string; color: string }> = {
    degenfeed: { label: 'DegenFeed', color: '#8b5cf6' },
    farcaster: { label: 'Farcaster', color: '#8a63d2' },
    nostr: { label: 'Nostr', color: '#8b5cf6' },
    lens: { label: 'Lens', color: '#abfe2c' },
    bluesky: { label: 'Bluesky', color: '#1185fe' },
    activitypub: { label: 'ActivityPub', color: '#f0932b' },
    atprotocol: { label: 'AT Protocol', color: '#1185fe' },
    ethereum: { label: 'Ethereum', color: '#627eea' },
    solana: { label: 'Solana', color: '#9945ff' },
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Active protocols">
      {protocols.map((p) => {
        const meta = protocolColors[p.toLowerCase()] ?? { label: p, color: '#888' };
        return (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium backdrop-blur-sm"
            style={{
              backgroundColor: `${meta.color}18`,
              borderColor: `${meta.color}40`,
              color: meta.color,
              borderWidth: 1,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

export function LiveShortsHeader({
  liveCount,
  protocols,
  onGoLive,
  onRefresh,
  isValidating,
}: LiveShortsHeaderProps) {
  const { ready, signedInProtocols } = useAuth();
  const { showToast } = useToast();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const handleGoLive = () => {
    if (!hasSignedIn) {
      showToast('info', 'Sign in to start a live short');
      return;
    }
    onGoLive();
  };

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: title + live count */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/10">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-red-400"
          >
            <circle cx="12" cy="12" r="6" fill="currentColor" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="h-3 w-3 animate-ping rounded-full bg-red-500 opacity-40" />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">Live Shorts</h1>
            <LiveCountBadge count={liveCount} />
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Short-form live video from every protocol
          </p>
        </div>
      </div>

      {/* Right: protocol pills + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <ProtocolPills protocols={protocols} />

        <button
          type="button"
          onClick={onRefresh}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
          aria-label="Refresh live shorts"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isValidating ? 'animate-spin' : ''}
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {isValidating ? 'Syncing...' : 'Refresh'}
        </button>

        <button
          type="button"
          onClick={handleGoLive}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 px-4 py-2 text-sm font-bold text-black shadow-lg shadow-degen-500/20 transition-all hover:from-degen-400 hover:to-emerald-400 hover:shadow-degen-500/30 active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Go Live
        </button>
      </div>
    </header>
  );
}

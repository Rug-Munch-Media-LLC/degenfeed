'use client';

/**
 * @pages/live-shorts — Live Shorts Discovery Page.
 *
 * The command center for discovering and interacting with live short-form
 * video from EVERY protocol simultaneously.
 *
 * Layout:
 *   ┌=================================================┐
 *   │ 🔴 Live Shorts   42 live     [Go Live] [↻]     │ ← LiveShortsHeader
 *   ├=================================================┤
 *   │ ┌=====┐ ┌=====┐ ┌=====┐ ┌=====┐ ┌=====┐       │
 *   │ │ 🔴  │ │ 🔴  │ │ 🔴  │ │ 🔴  │ │ 🔴  │       │
 *   │ │Live │ │Live │ │Live │ │Live │ │Live │       │ ← LiveShortsGrid
 *   │ │     │ │     │ │     │ │     │ │     │       │
 *   │ └=====┘ └=====┘ └=====┘ └=====┘ └=====┘       │
 *   ├=================================================┤
 *   │ "Starting Soon" (upcoming / scheduled)          │ ← UpcomingLiveShorts
 *   │ [card] [card] [card] [card]                     │
 *   ├=================================================┤
 *   │ "Recent Live Shorts" (ended, recordings)        │ ← RecentLiveShorts
 *   │ [card] [card] [card] [card]                     │
 *   └=================================================┘
 *
 * Features:
 *   - Real-time auto-refreshing grid of active live shorts (every 8s)
 *   - Protocol pill indicators
 *   - Upcoming scheduled shorts
 *   - Recent ended shorts with recording links
 *   - "Go Live" modal for starting a new session
 *   - Live count badge in header
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useMemo, useState } from 'react';
import { GoLiveShortModal } from '../../components/live-shorts/GoLiveShortModal';
import { LiveShortsGrid } from '../../components/live-shorts/LiveShortsGrid';
import { LiveShortsHeader } from '../../components/live-shorts/LiveShortsHeader';
import type {
  LiveShortProtocol,
  LiveShortSession,
} from '../../components/live-shorts/useLiveShorts';
import { useActiveLiveShorts } from '../../components/live-shorts/useLiveShorts';

// === Mock data for upcoming and recent sections =======================

function generateMockUpcoming(): LiveShortSession[] {
  const now = Date.now();
  const offset = 3600000; // 1 hour
  return [
    {
      id: 'upcoming-1',
      title: 'ETH London Recap — Live Thoughts',
      creator: {
        id: 'c1',
        handle: 'eth_dev',
        displayName: 'ETH Dev',
        avatarUrl: '',
        verified: true,
      },
      playbackUrl: '',
      protocol: 'hls',
      startedAt: now + offset,
      maxDuration: 60,
      viewerCount: 0,
      viewerBreakdown: [],
      tipCount: 0,
      tipAmount: '0',
      reactionCount: 0,
      status: 'starting',
      tags: ['ethereum', 'recap'],
    },
    {
      id: 'upcoming-2',
      title: "Solana DeFi — What I'm Watching",
      creator: {
        id: 'c2',
        handle: 'solana_dev',
        displayName: 'Sol Dev',
        avatarUrl: '',
        verified: false,
      },
      playbackUrl: '',
      protocol: 'webrtc',
      startedAt: now + offset * 2,
      maxDuration: 90,
      viewerCount: 0,
      viewerBreakdown: [],
      tipCount: 0,
      tipAmount: '0',
      reactionCount: 0,
      status: 'starting',
      tags: ['solana', 'defi'],
    },
    {
      id: 'upcoming-3',
      title: 'NFT Market Pulse — Quick Take',
      creator: {
        id: 'c3',
        handle: 'nft_watcher',
        displayName: 'NFT Watcher',
        avatarUrl: '',
        verified: true,
      },
      playbackUrl: '',
      protocol: 'hls',
      startedAt: now + offset * 3,
      maxDuration: 60,
      viewerCount: 0,
      viewerBreakdown: [],
      tipCount: 0,
      tipAmount: '0',
      reactionCount: 0,
      status: 'starting',
      tags: ['nft', 'market'],
    },
  ];
}

function generateMockRecent(): LiveShortSession[] {
  const now = Date.now();
  return [
    {
      id: 'recent-1',
      title: 'BTC to 100K? My hot take 🔥',
      creator: {
        id: 'c4',
        handle: 'btc_maxi',
        displayName: 'BTC Maxi',
        avatarUrl: '',
        verified: false,
      },
      playbackUrl: '',
      protocol: 'hls',
      startedAt: now - 7200000,
      maxDuration: 60,
      viewerCount: 342,
      viewerBreakdown: [],
      tipCount: 12,
      tipAmount: '0.5 SOL',
      reactionCount: 89,
      status: 'ended',
      tags: ['bitcoin', 'prediction'],
    },
    {
      id: 'recent-2',
      title: 'Airdrop farming alpha',
      creator: {
        id: 'c5',
        handle: 'airdrop_hunter',
        displayName: 'Airdrop Hunter',
        avatarUrl: '',
        verified: true,
      },
      playbackUrl: '',
      protocol: 'hls',
      startedAt: now - 10800000,
      maxDuration: 120,
      viewerCount: 891,
      viewerBreakdown: [],
      tipCount: 34,
      tipAmount: '1.2 ETH',
      reactionCount: 156,
      status: 'ended',
      tags: ['airdrop', 'alpha'],
    },
  ];
}

// === Horizontal row component for upcoming/recent ====================

function LiveShortMiniCard({ session }: { session: LiveShortSession }) {
  const isUpcoming = session.status === 'starting';
  const isEnded = session.status === 'ended';

  const scheduleTime = useMemo(() => {
    const d = new Date(session.startedAt);
    const now = Date.now();
    const diff = d.getTime() - now;
    if (isUpcoming && diff > 0) {
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (hours > 0) return `In ${hours}h ${mins}m`;
      return `In ${mins}m`;
    }
    if (isEnded) {
      const hours = Math.floor((now - d.getTime()) / 3600000);
      if (hours < 1) return 'Just now';
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    }
    return '';
  }, [session.startedAt, isUpcoming, isEnded]);

  return (
    <a
      href={isEnded ? `/live-shorts/${session.id}/recording` : `/live-shorts/${session.id}`}
      className="group flex w-44 shrink-0 flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 transition-all hover:border-degen-500/30 hover:shadow-[0_0_16px_var(--color-accent-glow)]"
    >
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        {isUpcoming && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            UPCOMING
          </span>
        )}
        {isEnded && (
          <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/50">
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            RECORDING
          </span>
        )}
        <span className="ml-auto text-[9px] text-[var(--color-muted)]">{scheduleTime}</span>
      </div>

      {/* Title */}
      <h4 className="line-clamp-2 text-xs font-semibold text-[var(--color-fg)] group-hover:text-degen-400">
        {session.title}
      </h4>

      {/* Creator */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[6px] font-bold text-degen-400">
          {session.creator.displayName[0]?.toUpperCase() || '?'}
        </div>
        <span className="truncate text-[10px] text-[var(--color-muted)]">
          @{session.creator.handle}
        </span>
      </div>
    </a>
  );
}

function HorizontalScrollRow({
  title,
  subtitle,
  sessions,
}: {
  title: string;
  subtitle?: string;
  sessions: LiveShortSession[];
}) {
  if (sessions.length === 0) return null;

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-bold text-[var(--color-fg)]">{title}</h2>
        {subtitle && <span className="text-[10px] text-[var(--color-muted)]">{subtitle}</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {sessions.map((session) => (
          <LiveShortMiniCard key={session.id} session={session} />
        ))}
      </div>
    </section>
  );
}

// === Main Page ========================================================

export default function LiveShortsPage() {
  const { sessions, total, isLoading, isValidating, refresh } = useActiveLiveShorts();

  const [goLiveOpen, setGoLiveOpen] = useState(false);

  const upcoming = useMemo(() => generateMockUpcoming(), []);
  const recent = useMemo(() => generateMockRecent(), []);

  // Extract unique protocols from active sessions
  const activeProtocols = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      set.add(s.creator.protocol ?? 'degenfeed');
      for (const v of s.viewerBreakdown) {
        set.add(v.platform);
      }
    }
    return Array.from(set).slice(0, 6);
  }, [sessions]);

  const handleGoLive = useCallback(() => setGoLiveOpen(true), []);

  const handleStartLiveShort = useCallback(
    (_data: {
      title: string;
      description: string;
      maxDuration: number;
      protocols: LiveShortProtocol[];
      tokenAddress: string;
      tokenSymbol: string;
    }) => {
      // TODO: POST /api/live-shorts/start
    },
    [],
  );

  const handleTip = useCallback((_session: LiveShortSession) => {
    // Open tip modal for the session
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
        {/* Header with live count + Go Live */}
        <LiveShortsHeader
          liveCount={total}
          protocols={activeProtocols}
          onGoLive={handleGoLive}
          onRefresh={refresh}
          isValidating={isValidating}
        />

        {/* Syncing indicator */}
        {isValidating && !isLoading && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-1.5 text-[11px] text-degen-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Real-time — updating live shorts...
          </div>
        )}

        <div className="space-y-8">
          {/* Active live shorts grid */}
          <section aria-label="Active live shorts">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--color-fg)]">
                {total > 0 ? `Live Now (${total})` : 'Live Now'}
              </h2>
              {total > 0 && (
                <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                  Updated just now
                </span>
              )}
            </div>
            <LiveShortsGrid
              sessions={sessions}
              isLoading={isLoading}
              onTip={handleTip}
              emptyMessage="No live shorts right now. Be the first — hit 'Go Live' above!"
            />
          </section>

          {/* Upcoming / Scheduled */}
          <HorizontalScrollRow
            title="Starting Soon"
            subtitle={`${upcoming.length} scheduled`}
            sessions={upcoming}
          />

          {/* Recent ended sessions */}
          <HorizontalScrollRow
            title="Recent Live Shorts"
            subtitle="Recordings available"
            sessions={recent}
          />
        </div>

        {/* Go Live Modal */}
        <GoLiveShortModal
          isOpen={goLiveOpen}
          onClose={() => setGoLiveOpen(false)}
          onStart={handleStartLiveShort}
        />
      </div>
    </ErrorBoundary>
  );
}

'use client';

import type { LiveStream } from './useLiveStreams';

/* === Types ==================================================== */

interface UpcomingStream {
  id: string;
  title: string;
  creatorHandle: string;
  creatorAvatar?: string;
  streamType: LiveStream['streamType'];
  scheduledAt: string; // ISO date
  description?: string;
}

interface UpcomingStreamsProps {
  streams?: UpcomingStream[];
  isLoading?: boolean;
}

/* === Mock data ================================================ */

const MOCK_UPCOMING: UpcomingStream[] = [
  {
    id: 'upcoming-1',
    title: 'Bitcoin 2026 — Post-Halving Analysis',
    creatorHandle: 'btc_maxi',
    streamType: 'spaces',
    scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    description:
      'Expert panel discussing Bitcoin post-halving dynamics and institutional adoption.',
  },
  {
    id: 'upcoming-2',
    title: 'Building on Base — Live Coding Workshop',
    creatorHandle: 'base_builder',
    streamType: 'collab',
    scheduledAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    description: 'Live coding session building a DEX on Base.',
  },
  {
    id: 'upcoming-3',
    title: 'DeFi Yield Strategies — Q3 Outlook',
    creatorHandle: 'yield_farmer',
    streamType: 'solo',
    scheduledAt: new Date(Date.now() + 3600000 * 8).toISOString(),
    description: 'Best yield farming opportunities across chains this quarter.',
  },
  {
    id: 'upcoming-4',
    title: 'Meme Coin Watch Party 🐸',
    creatorHandle: 'meme_lord',
    streamType: 'launch',
    scheduledAt: new Date(Date.now() + 3600000 * 3).toISOString(),
    description: 'Tracking the latest meme coin launches and community calls.',
  },
];

/* === Helpers ================================================== */

function formatScheduled(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = date.getTime() - now;

  if (diff < 0) return 'Starting soon';
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `In ${mins}m`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `In ${hours}h`;
  }
  const days = Math.floor(diff / 86400000);
  return `In ${days}d`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* === Stream type config ======================================= */

const TYPE_ICONS: Record<string, string> = {
  solo: '🎥',
  spaces: '🎙️',
  collab: '👥',
  launch: '🪙',
};

/* === Single upcoming card ===================================== */

function UpcomingCard({ stream }: { stream: UpcomingStream }) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-all hover:border-amber-500/20 hover:shadow-[0_0_16px_var(--color-accent-glow)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/15 to-yellow-500/10 text-lg">
        {TYPE_ICONS[stream.streamType] ?? '📺'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-[var(--color-fg)] group-hover:text-degen-400">
            {stream.title}
          </h4>
          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
            {formatScheduled(stream.scheduledAt)}
          </span>
        </div>

        {stream.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-muted)]">
            {stream.description}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
          <span>by @{stream.creatorHandle}</span>
          <span>·</span>
          <span>{formatDate(stream.scheduledAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* === Skeleton ================================================= */

function UpcomingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3"
        >
          <div className="h-10 w-10 shrink-0 skeleton rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 skeleton rounded" />
            <div className="h-3 w-1/2 skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* === Main Component =========================================== */

export function UpcomingStreams({
  streams = MOCK_UPCOMING,
  isLoading = false,
}: UpcomingStreamsProps) {
  if (isLoading) {
    return (
      <section aria-label="Upcoming streams" className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            📅
          </span>
          <h2 className="text-base font-bold text-[var(--color-fg)]">Upcoming Streams</h2>
        </div>
        <UpcomingSkeleton />
      </section>
    );
  }

  if (streams.length === 0) return null;

  return (
    <section aria-label="Upcoming streams" className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-sm">
            📅
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--color-fg)]">Upcoming Streams</h2>
            <p className="text-[10px] text-[var(--color-muted)]">Scheduled streams and spaces</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {streams.map((stream, i) => (
          <div
            key={stream.id}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <UpcomingCard stream={stream} />
          </div>
        ))}
      </div>
    </section>
  );
}

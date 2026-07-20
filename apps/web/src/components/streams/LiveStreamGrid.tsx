'use client';

import { LiveStreamCard } from './LiveStreamCard';
import type { LiveStream } from './useLiveStreams';

/* ─── Types ──────────────────────────────────────────────────── */

interface LiveStreamGridProps {
  streams: LiveStream[];
  isLoading?: boolean;
  emptyMessage?: string;
  onPlay?: (stream: LiveStream) => void;
}

/* ─── Skeleton card ──────────────────────────────────────────── */

function StreamCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="aspect-video skeleton" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 skeleton rounded-full" />
          <div className="h-3 w-20 skeleton rounded" />
          <div className="ml-auto h-3 w-12 skeleton rounded" />
        </div>
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-overlay)]">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[var(--color-muted)]"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--color-fg)]">No streams yet</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{message}</p>
    </div>
  );
}

/* ─── Main Grid ──────────────────────────────────────────────── */

export function LiveStreamGrid({
  streams,
  isLoading = false,
  emptyMessage = 'No active streams right now. Check back later or start one!',
  onPlay,
}: LiveStreamGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <section aria-label="Live streams">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StreamCardSkeleton key={`skel-${i}`} />
          ))}
        </div>
      </section>
    );
  }

  // Empty state
  if (streams.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  // Grid
  return (
    <section aria-label="Live streams">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {streams.map((stream, index) => (
          <div
            key={stream.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <LiveStreamCard stream={stream} onPlay={onPlay} />
          </div>
        ))}
      </div>
    </section>
  );
}

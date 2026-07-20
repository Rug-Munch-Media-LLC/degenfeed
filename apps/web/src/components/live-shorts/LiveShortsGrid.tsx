'use client';

/**
 * LiveShortsGrid — Grid of live short discovery cards.
 *
 * Responsive breakouts:
 *   mobile: 2 columns
 *   tablet: 3 columns
 *   desktop: 4 columns
 *   wide: 5 columns
 *
 * Uses aspect-[9/16] cards optimized for vertical video thumbnails.
 */

import { LiveShortsCard } from './LiveShortsCard';
import type { LiveShortSession } from './useLiveShorts';

interface LiveShortsGridProps {
  sessions: LiveShortSession[];
  isLoading?: boolean;
  emptyMessage?: string;
  onTip?: (session: LiveShortSession) => void;
}

/* ─── Skeleton card ───────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="aspect-[9/16] skeleton" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 skeleton rounded-full" />
          <div className="h-3 w-20 skeleton rounded" />
        </div>
        <div className="h-3 w-full skeleton rounded" />
        <div className="flex gap-2">
          <div className="h-7 flex-1 skeleton rounded-lg" />
          <div className="h-7 w-12 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────── */

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
          aria-hidden="true"
          className="text-[var(--color-muted)]"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--color-fg)]">No live shorts right now</p>
      <p className="mt-1 max-w-xs text-center text-xs text-[var(--color-muted)]">{message}</p>
    </div>
  );
}

/* ─── Main Grid ────────────────────────────────────────────────── */

export function LiveShortsGrid({
  sessions,
  isLoading = false,
  emptyMessage = 'No one is live right now. Be the first to go live!',
  onTip,
}: LiveShortsGridProps) {
  if (isLoading) {
    return (
      <section aria-label="Live shorts grid" className="animate-fade-in">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, no state
            <CardSkeleton key={`skel-${i}`} />
          ))}
        </div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <section aria-label="Live shorts grid" className="animate-fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <LiveShortsCard session={session} onTip={onTip} />
          </div>
        ))}
      </div>
    </section>
  );
}

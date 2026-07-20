'use client';

/**
 * LiveShortsCard — Discovery card for a live short session.
 *
 * Shows:
 *   - Pulsing "🔴 LIVE" badge
 *   - Thumbnail / stream preview with gradient fallback
 *   - Creator avatar + handle + verified check
 *   - Viewer count with per-platform breakdown
 *   - Time remaining
 *   - "Watch Live" and "Tip" action buttons
 *
 * Responsive: full-width on mobile, card on desktop.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { TimeRemaining } from './TimeRemaining';
import type { LiveShortSession } from './useLiveShorts';
import { ViewerBreakdown } from './ViewerBreakdown';

interface LiveShortsCardProps {
  session: LiveShortSession;
  onTip?: (session: LiveShortSession) => void;
}

/* === Helpers =================================================== */

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* === Status badge ============================================== */

function StatusBadge({ status }: { status: LiveShortSession['status'] }) {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          LIVE
        </span>
      );
    case 'starting':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
          STARTING
        </span>
      );
    case 'ended':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
          RECORDING
        </span>
      );
  }
}

/* === Thumbnail / Preview ======================================= */

function LiveShortThumbnail({ session }: { session: LiveShortSession }) {
  const gradient = useMemo(() => {
    const hues = [220, 190, 160, 280, 340, 30, 120, 200];
    const hash = session.creator.handle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hues[hash % hues.length] ?? 200;
    return `linear-gradient(135deg, hsl(${hue}, 60%, 20%) 0%, hsl(${hue + 40}, 40%, 12%) 100%)`;
  }, [session.creator.handle]);

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
      {session.thumbnailUrl ? (
        <Image
          src={session.thumbnailUrl}
          alt={`${session.title} thumbnail`}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: gradient }}>
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-30" aria-hidden="true">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-white/30"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
          </div>
        </div>
      )}

      {/* Gradient overlays for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />

      {/* Top: badge + viewer count */}
      <div className="absolute left-2 right-2 top-2 z-10 flex items-start justify-between gap-1">
        <StatusBadge status={session.status} />
        <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {formatViewers(session.viewerCount)}
        </span>
      </div>

      {/* Bottom: time remaining */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        {session.status === 'live' && (
          <TimeRemaining startedAt={session.startedAt} maxDuration={session.maxDuration} compact />
        )}
      </div>
    </div>
  );
}

/* === Creator info row ========================================== */

function CreatorRow({ creator }: { creator: LiveShortSession['creator'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[8px] font-bold text-degen-400">
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.displayName}
            width={24}
            height={24}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          creator.displayName[0]?.toUpperCase() || '?'
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs font-semibold text-[var(--color-fg)]">
            {creator.displayName}
          </span>
          {creator.verified && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="#00ff41"
              aria-label="Verified"
              role="img"
            >
              <path d="M12 1L15 9H23L17 15L19 23L12 18L5 23L7 15L1 9H9L12 1Z" />
            </svg>
          )}
        </div>
        <span className="truncate text-[10px] text-[var(--color-muted)]">@{creator.handle}</span>
      </div>
    </div>
  );
}

/* === Mini tip counter ========================================== */

function TipCounter({ amount, count }: { amount: string; count: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-degen-500/10 px-1.5 py-0.5 text-[9px] font-medium text-degen-400">
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
        <line x1="13" y1="19" x2="19" y2="13" />
        <line x1="16" y1="16" x2="20" y2="20" />
        <line x1="19" y1="21" x2="21" y2="19" />
      </svg>
      {amount}
    </span>
  );
}

/* === Main Card ================================================== */

export function LiveShortsCard({ session, onTip }: LiveShortsCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:border-degen-500/30 hover:shadow-[0_0_24px_var(--color-accent-glow)]">
      {/* Thumbnail link to viewer */}
      <Link href={`/live-shorts/${session.id}`} className="block">
        <LiveShortThumbnail session={session} />
      </Link>

      {/* Info section */}
      <div className="space-y-2 p-2.5">
        {/* Title */}
        <Link href={`/live-shorts/${session.id}`} className="block">
          <h3 className="truncate text-sm font-semibold text-[var(--color-fg)] transition-colors group-hover:text-degen-400">
            {session.title}
          </h3>
        </Link>

        {/* Creator */}
        <CreatorRow creator={session.creator} />

        {/* Viewer breakdown */}
        <ViewerBreakdown counts={session.viewerBreakdown} compact />

        {/* Actions row */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/live-shorts/${session.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-degen-500 px-3 py-1.5 text-[11px] font-bold text-black transition-all hover:bg-degen-400 active:scale-[0.97]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Watch Live
          </Link>

          <button
            type="button"
            onClick={() => onTip?.(session)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-muted)] transition-all hover:border-degen-500/30 hover:text-degen-400 active:scale-[0.97]"
            aria-label={`Tip ${session.creator.displayName}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
              <line x1="13" y1="19" x2="19" y2="13" />
              <line x1="16" y1="16" x2="20" y2="20" />
              <line x1="19" y1="21" x2="21" y2="19" />
            </svg>
            Tip
          </button>

          {session.tipCount > 0 && (
            <TipCounter amount={session.tipAmount} count={session.tipCount} />
          )}
        </div>

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {session.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[var(--color-overlay)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

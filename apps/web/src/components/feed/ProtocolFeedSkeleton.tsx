/**
 * @degenfeed/web — ProtocolFeedSkeleton
 *
 * Protocol-aware loading skeletons for feed routes. Server-safe (no hooks,
 * no "use client") so they can be used directly from layout.tsx Suspense
 * fallbacks and loading.tsx files.
 *
 * Dispatches by protocol category:
 *  - Video protocols   → grid of 6 dark aspect-video rectangles (pulse)
 *  - Markets/Governance → grid of card skeletons
 *  - Audio protocols   → row list of media skeletons
 *  - Text protocols    → list of 3 PostCard-matching skeletons
 */

import { PostCardSkeleton } from '@degenfeed/ui/server';
import { CardSkeleton, Line } from '@/components/loading/PageSkeleton';

/* ─── Protocol category sets (ids from @degenfeed/utils registry) ─── */

export const VIDEO_PROTOCOLS = new Set([
  'peertube',
  'youtube',
  'vimeo',
  'twitch',
  'kick',
  'owncast',
  'loops',
  'live',
  'media',
  'videos',
  'streams',
  'dtube',
  'lbry',
  'huddle01',
  'livestreams',
]);

export const GRID_PROTOCOLS = new Set([
  'rarible',
  'opensea',
  'snapshot',
  'tally',
  'juicebox',
  'polymarket',
  'unlock',
  'zora',
  'launch',
  'nft',
  'dao',
  'governance',
  'markets',
]);

export const AUDIO_PROTOCOLS = new Set([
  'audius',
  'soundcloud',
  'bandcamp',
  'castopod',
  'funkwhale',
  'podcast',
]);

export function isVideoProtocol(protocol: string): boolean {
  return VIDEO_PROTOCOLS.has(protocol);
}

export function isGridProtocol(protocol: string): boolean {
  return GRID_PROTOCOLS.has(protocol);
}

export function isAudioProtocol(protocol: string): boolean {
  return AUDIO_PROTOCOLS.has(protocol);
}

/* ─── Video grid: 6 dark rectangles with pulse ───────────────────── */

export function VideoGridSkeleton({
  count = 6,
  title = false,
}: {
  count?: number;
  title?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading videos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          {/* Dark 16:9 thumbnail with pulse */}
          <div
            className="relative aspect-video w-full"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
          >
            <div
              className="absolute inset-0 animate-pulse"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.22 }}
              aria-hidden="true"
            />
            <div
              className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.18 }}
              aria-hidden="true"
            />
          </div>
          {/* Caption lines */}
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 shrink-0 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
                aria-hidden="true"
              />
              <div
                className="h-3 w-2/3 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
                aria-hidden="true"
              />
            </div>
            <div
              className="h-2.5 w-1/3 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              aria-hidden="true"
            />
            {title && (
              <div
                className="h-2.5 w-1/2 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Markets/Governance: card grid ──────────────────────────────── */

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i}>
          <Line width="w-3/4" />
          <Line width="w-full" height="h-3" />
          <Line width="w-2/3" height="h-3" />
        </CardSkeleton>
      ))}
    </div>
  );
}

/* ─── Audio: media rows ──────────────────────────────────────────── */

export function AudioFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading tracks">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border p-4"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <div
            className="h-14 w-14 shrink-0 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <Line width="w-1/2" height="h-4" />
            <Line width="w-1/3" height="h-3" />
          </div>
          <div
            className="h-9 w-16 shrink-0 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Header skeleton (protocol header block) ────────────────────── */

export function ProtocolHeaderSkeleton() {
  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      <div className="flex items-start gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div
          className="h-14 w-14 shrink-0 rounded-2xl animate-pulse sm:h-16 sm:w-16"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="h-7 w-40 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              aria-hidden="true"
            />
            <div
              className="h-5 w-16 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-3 space-y-2">
            <div
              className="h-3 w-11/12 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              aria-hidden="true"
            />
            <div
              className="h-3 w-2/3 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-4 flex gap-6">
            <div
              className="h-4 w-20 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
              aria-hidden="true"
            />
            <div
              className="h-4 w-24 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tabs skeleton ──────────────────────────────────────────────── */

export function FeedTabsSkeleton() {
  return (
    <div className="mb-4 flex items-center justify-between" aria-hidden="true">
      <div className="flex gap-1.5">
        {['Popular', 'Trending', 'Newest', 'Videos'].map((t) => (
          <div
            key={t}
            className="h-8 w-20 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
          />
        ))}
      </div>
      <div
        className="h-8 w-20 animate-pulse rounded-lg"
        style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
      />
    </div>
  );
}

/* ─── Top-level dispatcher ───────────────────────────────────────── */

export function ProtocolFeedSkeleton({
  protocol,
  count = 6,
}: {
  protocol: string;
  count?: number;
}) {
  const body = isVideoProtocol(protocol) ? (
    <VideoGridSkeleton count={count} title />
  ) : isGridProtocol(protocol) ? (
    <CardGridSkeleton count={count} />
  ) : isAudioProtocol(protocol) ? (
    <AudioFeedSkeleton count={3} />
  ) : (
    <PostCardSkeleton count={3} />
  );

  return (
    <div className="mx-auto max-w-2xl">
      <ProtocolHeaderSkeleton />
      <FeedTabsSkeleton />
      {body}
    </div>
  );
}

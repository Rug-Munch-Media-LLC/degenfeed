'use client';

/**
 * Visual Feed Page — Unified visual feed combining Pixelfed, Zora,
 * Bluesky, Nostr, Farcaster, and GoToSocial media into one
 * Instagram-like masonry grid experience.
 *
 * Every card has: 🎁 Tip  💬 Comment  🔄 Repost
 * Filter by: Photos, NFTs, Video, Bluesky source
 * Sort by: Newest, Trending, Top
 */

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Dynamic import to avoid SSR issues with intersection observer / canvas
const VisualFeedLayout = dynamic(
  () =>
    import('../../components/visual-feed/VisualFeedLayout').then((m) => ({
      default: m.VisualFeedLayout,
    })),
  {
    ssr: false,
    loading: () => <VisualFeedSkeleton />,
  },
);

function VisualFeedSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8 animate-page-enter"
      role="status"
      aria-label="Loading visual feed"
    >
      <div className="sr-only">Loading visual feed...</div>
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton-avatar h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <div className="skeleton-title h-5 w-32" />
            <div className="skeleton-text h-3 w-48" />
          </div>
        </div>
        {/* Filter pills skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-text h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
        {Array.from({ length: 12 }).map((_, i) => {
          const heights = [200, 280, 240, 320, 260, 220, 300, 260, 240, 280, 200, 310];
          return (
            <div
              key={i}
              className="skeleton-card mb-4"
              style={{
                height: `${heights[i % heights.length]}px`,
                breakInside: 'avoid',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function VisualPage() {
  return (
    <ErrorBoundary>
      <VisualFeedLayout />
    </ErrorBoundary>
  );
}

// Server-safe skeleton — no React hooks, no "use client" directive.
// Import this from Server Components like loading.tsx without triggering
// client-component validation errors.

export interface PostCardSkeletonProps {
  /** Number of skeleton cards (default: 1) */
  count?: number;
}

let _skelId = 0;
function nextSkelId(): string {
  _skelId += 1;
  return `skel-${_skelId}`;
}

/**
 * Skeleton placeholder that exactly matches PostCard layout dimensions
 * to prevent Cumulative Layout Shift (CLS) during loading.
 * Renders `count` skeleton cards with `role="status"` for a11y.
 * Server-safe: no hooks, no "use client" dependency.
 *
 * Uses the `.skeleton-shimmer` CSS class from the design system for
 * consistent shimmer animation across the entire app.
 */
export function PostCardSkeleton({ count = 1 }: PostCardSkeletonProps) {
  const uid = nextSkelId();
  return (
    <output className="block w-full" aria-label="Loading posts" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`${uid}-${i}`}
          className="post-card border-b border-[var(--color-border)] px-4 py-3"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {/* Author row skeleton — matches PostCard layout */}
          <div className="author-row mb-3 flex items-center gap-3">
            <div className="skeleton-shimmer h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="skeleton-shimmer h-3.5 w-28 rounded" />
                <div className="skeleton-shimmer h-3.5 w-14 rounded" />
                <div className="ml-auto skeleton-shimmer h-5 w-14 rounded-full" />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="skeleton-shimmer h-2.5 w-20 rounded" />
                <div className="skeleton-shimmer h-2.5 w-2.5 rounded-full" />
                <div className="skeleton-shimmer h-2.5 w-14 rounded" />
                <div className="skeleton-shimmer h-3.5 w-10 rounded-full" />
              </div>
            </div>
          </div>
          {/* Content lines skeleton — matches PostCard's content-text mb-3 */}
          <div className="mb-3 space-y-2">
            <div className="skeleton-shimmer h-3 w-full rounded" />
            <div className="skeleton-shimmer h-3 w-[91.666%] rounded" />
            <div className="skeleton-shimmer h-3 w-3/4 rounded" />
          </div>
          {/* Media skeleton — optional media area */}
          {i % 3 === 0 && <div className="mb-3 skeleton-shimmer aspect-video w-full rounded-xl" />}
          {/* Engagement bar skeleton — matches PostCardEngagement layout */}
          <div className="mt-1 flex items-center gap-4">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="skeleton-shimmer h-4 w-4 rounded" />
                <div className="skeleton-shimmer h-2.5 w-6 rounded" />
              </div>
            ))}
            <div className="ml-auto skeleton-shimmer h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </output>
  );
}

/**
 * Minimal shimmer skeleton for inline loading states.
 * Renders a single shimmer line matching the parent width.
 */
export function InlineSkeleton({
  width = '100%',
  height = 16,
}: {
  width?: string;
  height?: number;
}) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: 'var(--radius-sm, 6px)' }}
    />
  );
}

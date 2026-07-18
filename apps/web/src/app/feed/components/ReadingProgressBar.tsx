'use client';

import { useReadingProgress } from '../../../hooks/useReadingProgress';

/**
 * A thin animated progress bar pinned to the top of a long post,
 * showing the user's scroll progress through the content.
 *
 * Uses the post's `id` attribute to track scroll position.
 */
export function ReadingProgressBar({
  postId,
  enabled = true,
}: {
  /** The DOM id of the post element (without the #) */
  postId: string;
  /** Enable tracking — set to false when post is in feed (not expanded) */
  enabled?: boolean;
}) {
  const progress = useReadingProgress(
    enabled ? `post-${postId}` : null,
    enabled,
  );

  if (!enabled || progress <= 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className="h-full transition-all duration-150 ease-out"
        style={{
          width: `${progress * 100}%`,
          background:
            'linear-gradient(90deg, var(--color-accent), #8b5cf6, var(--color-accent))',
          backgroundSize: '200% 100%',
          animation: 'progress-glow 2s ease-in-out infinite',
          boxShadow: '0 0 8px var(--color-accent-glow)',
        }}
      />
    </div>
  );
}

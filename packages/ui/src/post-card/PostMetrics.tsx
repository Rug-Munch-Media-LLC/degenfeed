'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { memo } from 'react';

export interface PostMetricsProps {
  post: UnifiedPost;
}

export const PostMetrics = memo(function PostMetrics({ post }: PostMetricsProps) {
  if (!post.niches || post.niches.length === 0) return null;

  return (
    <div className="niche-tags mb-3 flex flex-wrap gap-1">
      {post.niches.slice(0, 5).map((n) => (
        <span
          key={n}
          className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]"
        >
          {n}
        </span>
      ))}
    </div>
  );
});

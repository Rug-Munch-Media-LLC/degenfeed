/**
 * @degenfeed/web — VideoGridCard
 *
 * YouTube-style video card for the video feed grid.
 * Shows: thumbnail, duration badge, channel avatar + name,
 * title, views, and timestamp.
 */

'use client';

import type { VisualPost } from '@degenfeed/types';
import Image from 'next/image';
import { useState } from 'react';
import { formatCount, formatDuration, timeAgo } from './MediaCard';
import { MEDIA_SOURCES } from './MediaTypes';

interface VideoGridCardProps {
  post: VisualPost;
  onClick: (post: VisualPost) => void;
}

export function VideoGridCard({ post, onClick }: VideoGridCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const thumbSrc = post.imageUrl;
  const sourceMeta = MEDIA_SOURCES[post.source] ?? MEDIA_SOURCES[post.protocol];
  const sourceColor = sourceMeta?.color ?? post.sourceColor ?? 'var(--color-accent)';

  return (
    <button
      type="button"
      onClick={() => onClick(post)}
      className="group flex w-full flex-col overflow-hidden rounded-xl text-left transition-all duration-200
        hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-[var(--color-accent)] active:scale-[0.99]"
      style={{ backgroundColor: 'var(--color-card)' }}
    >
      {/* ── Thumbnail ── */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {!loaded && !error && <div className="absolute inset-0 skeleton-shimmer" />}

        {thumbSrc && !error ? (
          <Image
            src={thumbSrc}
            alt={post.text?.slice(0, 80) || 'Video thumbnail'}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: 'var(--color-overlay)' }}
          >
            <svg
              aria-hidden="true"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ color: sourceColor, opacity: 0.4 }}
            >
              <polygon points="5 3 19 12 5 21 5 3" fill={sourceColor} stroke="none" opacity="0.3" />
            </svg>
          </div>
        )}

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform group-hover:scale-110">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {post.duration && (
          <span
            className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            {formatDuration(post.duration)}
          </span>
        )}

        {/* Source badge */}
        {sourceMeta && (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${sourceColor}CC`,
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            {sourceMeta.icon && <span className="text-[10px]">{sourceMeta.icon}</span>}
            {sourceMeta.label}
          </span>
        )}
      </div>

      {/* ── Info ── */}
      <div className="flex gap-3 p-3">
        {/* Channel avatar */}
        {post.author.avatarUrl ? (
          <Image
            src={post.author.avatarUrl}
            alt=""
            width={32}
            height={32}
            className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: sourceColor }}
          >
            {post.author.displayName[0]?.toUpperCase() || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Title / text */}
          <p
            className="line-clamp-2 text-sm font-medium leading-snug"
            style={{ color: 'var(--color-fg)' }}
          >
            {post.text || 'Untitled'}
          </p>

          {/* Channel name */}
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--color-muted)' }}>
            {post.author.displayName}
          </p>

          {/* Views + timestamp */}
          <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {post.metrics.views ? `${formatCount(post.metrics.views)} views` : ''}
            {post.metrics.views ? ' · ' : ''}
            {timeAgo(post.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
}

/**
 * @degenfeed/web — LiveCard
 *
 * Live streaming card for the live hub.
 * Shows: thumbnail, "LIVE" badge with viewer count,
 * stream title, channel name, and platform badge.
 * Click streams the video in a built-in player or opens the native source.
 */

'use client';

import type { VisualPost } from '@degenfeed/types';
import { useState } from 'react';
import { formatCount } from './MediaCard';
import { MEDIA_SOURCES } from './MediaTypes';

interface LiveCardProps {
  post: VisualPost;
  onClick: (post: VisualPost) => void;
}

export function LiveCard({ post, onClick }: LiveCardProps) {
  const [_loaded, setLoaded] = useState(false);
  const sourceMeta = MEDIA_SOURCES[post.source] ?? MEDIA_SOURCES[post.protocol];
  const sourceColor = sourceMeta?.color ?? post.sourceColor ?? 'var(--color-accent)';
  const viewerCount = post.metrics.views ?? post.metrics.likes;

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
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={post.text?.slice(0, 80) || 'Stream thumbnail'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${sourceColor}15` }}
          >
            <span className="text-4xl opacity-30">{sourceMeta?.icon || '●'}</span>
          </div>
        )}

        {/* Animated LIVE badge */}
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{
            backgroundColor: '#ef4444',
            boxShadow: '0 0 12px rgba(239,68,68,0.6)',
          }}
        >
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-white"
            style={{ animationDuration: '1.2s' }}
          />
          LIVE
        </span>

        {/* Viewer count */}
        <span
          className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <svg
            aria-hidden="true"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {viewerCount ? formatCount(viewerCount) : '0'}
        </span>

        {/* Platform badge top-right */}
        {sourceMeta && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${sourceColor}CC`,
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            {sourceMeta.label}
          </span>
        )}
      </div>

      {/* ── Info ── */}
      <div className="flex items-start gap-3 p-3">
        {/* Channel avatar */}
        {post.author.avatarUrl ? (
          <img
            src={post.author.avatarUrl}
            alt=""
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
          <p
            className="line-clamp-2 text-sm font-medium leading-snug"
            style={{ color: 'var(--color-fg)' }}
          >
            {post.text || 'Untitled Stream'}
          </p>
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--color-muted)' }}>
            {post.author.displayName}
          </p>

          {/* Live dot + started */}
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Started streaming recently
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

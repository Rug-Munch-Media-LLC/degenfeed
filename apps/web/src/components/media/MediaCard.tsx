/**
 * @degenfeed/web — MediaCard
 *
 * Single card in the masonry grid showing an image/video thumbnail.
 * Displays: image, source badge, author avatar/name, likes count.
 * Video cards show a play button overlay + duration badge.
 * Click opens the lightbox.
 */

'use client';

import type { VisualPost } from '@degenfeed/types';
import { useState } from 'react';
import { MEDIA_SOURCES } from './MediaTypes';

// ─── Helpers ─────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function formatDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Source Badge ────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const meta = MEDIA_SOURCES[source];
  if (!meta) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: `${meta.color}20`,
        color: meta.color,
      }}
    >
      {meta.icon && <span className="text-[10px]">{meta.icon}</span>}
      {meta.label}
    </span>
  );
}

// ─── Media Card ──────────────────────────────────────────────────

interface MediaCardProps {
  post: VisualPost;
  onClick: (post: VisualPost) => void;
}

export function MediaCard({ post, onClick }: MediaCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const isVideo = post.mediaType === 'video' || post.mediaType === 'nft_video';
  const imgSrc = post.imageUrl;
  const sourceMeta = MEDIA_SOURCES[post.source] ?? MEDIA_SOURCES[post.protocol];
  const sourceColor = sourceMeta?.color ?? post.sourceColor ?? 'var(--color-accent)';
  const _sourceLabel = sourceMeta?.label ?? post.sourceLabel ?? post.source;
  const sourceIcon = sourceMeta?.icon ?? '◆';

  return (
    <button
      type="button"
      onClick={() => onClick(post)}
      className="group relative flex w-full flex-col overflow-hidden rounded-xl text-left transition-all duration-200
        hover:scale-[1.02] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-[var(--color-accent)] active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--color-card)',
        aspectRatio: post.aspectRatio ? Math.min(Math.max(post.aspectRatio, 0.4), 3) : undefined,
      }}
    >
      {/* Image */}
      <div className="relative w-full overflow-hidden" style={{ flex: 1 }}>
        {/* Shimmer placeholder */}
        {!loaded && !error && <div className="absolute inset-0 skeleton-shimmer" />}

        {imgSrc && !error ? (
          <img
            src={imgSrc}
            alt={post.text?.slice(0, 80) || `Media from ${post.author.displayName}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : error || !imgSrc ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: 'var(--color-overlay)' }}
          >
            <span className="text-2xl opacity-30">{sourceIcon}</span>
          </div>
        ) : null}

        {/* Video play button overlay */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform group-hover:scale-110">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        )}

        {/* Duration badge */}
        {isVideo && post.duration && (
          <span
            className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            {formatDuration(post.duration)}
          </span>
        )}

        {/* NFT badge */}
        {post.isNFT && (
          <span
            className="absolute left-2 top-2 rounded-full bg-purple-600/80 px-2 py-0.5 text-[9px] font-semibold text-white"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            NFT
          </span>
        )}

        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Hover info bar */}
        <div className="absolute bottom-0 left-0 right-0 flex translate-y-2 items-end justify-between p-3 transition-transform duration-200 group-hover:translate-y-0">
          <div className="flex items-center gap-2">
            {post.author.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt=""
                className="h-6 w-6 rounded-full border border-white/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ backgroundColor: sourceColor }}
              >
                {post.author.displayName[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="max-w-[120px] truncate text-xs font-medium text-white drop-shadow-lg">
              {post.author.displayName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/80 drop-shadow-lg">
            <span>♥ {formatCount(post.metrics.likes)}</span>
          </div>
        </div>
      </div>

      {/* Source badge + timestamp row (always visible) */}
      <div
        className="flex items-center justify-between px-2.5 py-2"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        <SourceBadge source={post.source} />
        <span className="text-[9px] tabular-nums" style={{ color: 'var(--color-muted)' }}>
          {timeAgo(post.createdAt)}
        </span>
      </div>
    </button>
  );
}

export { formatCount, formatDuration, timeAgo };

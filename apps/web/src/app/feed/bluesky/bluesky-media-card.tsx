/**
 * @degenfeed/web — Bluesky Media Cards
 *
 * ImageCard, VideoCard, EmptyState, and TrendingTextCard components.
 */

'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useState } from 'react';
import { extractMedia, formatCount, getExternalUrl, timeAgo } from './bluesky-media-helpers';
import type { MediaItem } from './bluesky-media-types';
import { BLUESKY_BLUE } from './bluesky-media-types';

// ─── Image Card ──────────────────────────────────────────────────

export function ImageCard({
  post,
  media,
  style,
  onImageClick,
}: {
  post: UnifiedPost;
  media: MediaItem;
  style?: React.CSSProperties;
  onImageClick: (post: UnifiedPost) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const ar = media.aspectRatio || 1;
  const displayAr = Math.min(Math.max(ar, 0.5), 2);

  return (
    <button
      type="button"
      onClick={() => onImageClick(post)}
      className="group relative overflow-hidden rounded-xl text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98]"
      style={{ aspectRatio: displayAr, ...style }}
    >
      <div
        className="absolute inset-0 skeleton-shimmer"
        style={{ opacity: imageLoaded ? 0 : 1, transition: 'opacity 0.3s' }}
      />
      <img
        src={media.thumb || media.url}
        alt={media.alt || `Image by ${post.author.displayName}`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
      {imageError && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-muted)' }}
        >
          <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            Failed to load
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
        <div className="flex items-center gap-2">
          <img
            src={post.author.avatarUrl || '/default-avatar.svg'}
            alt=""
            className="h-6 w-6 rounded-full border border-white/30"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="truncate text-xs font-medium text-white drop-shadow-lg">
            {post.author.displayName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/80 drop-shadow-lg">
          <span>♥ {formatCount(post.metrics.likes)}</span>
          <span>↻ {formatCount(post.metrics.reposts)}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Video Card ──────────────────────────────────────────────────

export function VideoCard({ post, style }: { post: UnifiedPost; style?: React.CSSProperties }) {
  const thumb = extractMedia(post)[0];
  const externalUrl = getExternalUrl(post);
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className="group relative overflow-hidden rounded-xl text-left transition-all duration-200 hover:scale-[1.02] focus-visible:outline-none"
      style={{ aspectRatio: '16/9', ...style }}
    >
      {thumb ? (
        <img
          src={thumb.thumb || thumb.url}
          alt={thumb.alt || 'Video thumbnail'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: 'var(--color-card)' }}
        >
          <svg
            aria-hidden="true"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ color: BLUESKY_BLUE }}
          >
            <polygon points="5 3 19 12 5 21 5 3" fill={BLUESKY_BLUE} stroke="none" opacity="0.3" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform group-hover:scale-110">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <p className="truncate text-sm font-medium text-white">{post.author.displayName}</p>
        <p className="text-[10px] text-white/70">{timeAgo(post.createdAt)}</p>
      </div>
      {expanded && externalUrl && (
        <div className="absolute inset-0 z-10 bg-black">
          <video
            src={externalUrl}
            className="h-full w-full"
            controls
            autoPlay
            onError={() => setExpanded(false)}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
            aria-label="Close video"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>
      )}
    </button>
  );
}

// ─── Empty State ─────────────────────────────────────────────────

export function EmptyState({ tabLabel, onRetry }: { tabLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl"
        style={{ backgroundColor: `${BLUESKY_BLUE}12`, color: BLUESKY_BLUE }}
      >
        📭
      </div>
      <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
        No {tabLabel.toLowerCase()} yet
      </p>
      <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
        Content will appear here as the Bluesky community posts media
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: BLUESKY_BLUE }}
      >
        Try again
      </button>
    </div>
  );
}

// ─── Trending Text Card ──────────────────────────────────────────

export function TrendingTextCard({ post }: { post: UnifiedPost }) {
  return (
    <button
      type="button"
      className="w-full rounded-xl p-4 text-left transition-all duration-150 hover:scale-[1.01]"
      style={{ backgroundColor: 'var(--color-card)' }}
    >
      <div className="flex items-center gap-2">
        <img
          src={post.author.avatarUrl || '/default-avatar.svg'}
          alt=""
          className="h-5 w-5 rounded-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
          {post.author.displayName}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {timeAgo(post.createdAt)}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed" style={{ color: 'var(--color-fg)' }}>
        {post.text}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {post.niches.slice(0, 3).map((niche) => (
          <span
            key={niche}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${BLUESKY_BLUE}12`, color: BLUESKY_BLUE }}
          >
            {niche}
          </span>
        ))}
        <div
          className="ml-auto flex items-center gap-3 text-[11px]"
          style={{ color: 'var(--color-muted)' }}
        >
          <span>♥ {formatCount(post.metrics.likes)}</span>
          <span>↻ {formatCount(post.metrics.reposts)}</span>
        </div>
      </div>
    </button>
  );
}

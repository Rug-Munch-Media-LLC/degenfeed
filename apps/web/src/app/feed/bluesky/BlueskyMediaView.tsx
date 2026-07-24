/**
 * @degenfeed/web — BlueskyMediaView
 *
 * Instagram-style media gallery for Bluesky content.
 * Features:
 *  - Tabbed: Images | Videos | Trending
 *  - Responsive grid (3/2/1 columns)
 *  - Lightbox for full-size images
 *  - Video player for external/video embeds
 *  - Infinite scroll pagination
 *  - Pull-to-refresh on mobile
 *  - Loading skeletons with staggered entrance
 */

'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

type TabId = 'images' | 'videos' | 'trending';

interface TabConfig {
  id: TabId;
  label: string;
  endpoint: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'images', label: 'Images', endpoint: '/api/feed/bluesky/images', icon: '📷' },
  { id: 'videos', label: 'Videos', endpoint: '/api/feed/bluesky/videos', icon: '▶' },
  { id: 'trending', label: 'Trending', endpoint: '/api/feed/bluesky/trending', icon: '🔥' },
];

const BLUESKY_BLUE = '#1185fe';
const POSTS_PER_PAGE = 30;

// ─── Helpers ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface MediaItem {
  url: string;
  thumb?: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

function extractMedia(post: UnifiedPost): MediaItem[] {
  const images = post.embeds
    .filter((e) => e.kind === 'image')
    .map((e) => ({
      url: e.url,
      thumb: (e.meta?.thumb as string) || undefined,
      alt: (e.meta?.alt as string) || '',
      width: e.meta?.width as number | undefined,
      height: e.meta?.height as number | undefined,
      aspectRatio: e.meta?.aspectRatio as number | undefined,
    }));

  // For external embeds with thumbnails (link cards)
  if (images.length === 0) {
    const linkEmbeds = post.embeds.filter((e) => e.kind === 'link' && e.meta?.thumb);
    for (const e of linkEmbeds) {
      images.push({
        url: e.meta?.thumb as string,
        thumb: e.meta?.thumb as string | undefined,
        alt: (e.meta?.title as string) || 'Link preview',
        width: undefined,
        height: undefined,
        aspectRatio: 1.91,
      });
    }
  }

  return images;
}

function isVideoPost(post: UnifiedPost): boolean {
  return (
    post.contentType === 'video' ||
    post.embeds.some(
      (e) =>
        e.kind === 'link' &&
        (e.meta?.thumb ||
          /youtube|youtu\.be|vimeo|twitch/i.test(e.url) ||
          /\.(mp4|webm|mov)$/i.test(e.url)),
    )
  );
}

function getExternalUrl(post: UnifiedPost): string | null {
  const link = post.embeds.find((e) => e.kind === 'link' && e.url);
  return link?.url || null;
}

// ─── Loading Skeleton ────────────────────────────────────────────────

function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl"
          style={{
            backgroundColor: 'var(--color-card)',
            animationDelay: `${i * 60}ms`,
            aspectRatio: i % 3 === 0 ? '4/3' : i % 3 === 1 ? '1/1' : '3/4',
          }}
        >
          {/* Image area shimmer */}
          <div className="relative h-full w-full">
            <div className="skeleton-shimmer absolute inset-0" />
            {/* Bottom overlay skeleton */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                />
                <div
                  className="h-3 w-24 rounded"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                />
              </div>
              <div className="mt-2 flex gap-3">
                <div className="h-3 w-12 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="h-3 w-12 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────

function Lightbox({
  post,
  media,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  post: UnifiedPost;
  media: MediaItem;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-backdrop-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        aria-label="Close lightbox"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 5L5 15M5 5l10 10" />
        </svg>
      </button>

      {/* Prev button */}
      {hasPrev && onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          aria-label="Previous image"
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Next button */}
      {hasNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          aria-label="Next image"
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={media.alt || 'Media content'}
          className="max-h-full max-w-full animate-slide-up rounded-lg object-contain shadow-2xl"
          style={{ maxHeight: 'calc(100vh - 8rem)' }}
        />
      </div>

      {/* Bottom info bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-4 sm:px-8"
        style={{
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.author.avatarUrl || '/default-avatar.svg'}
          alt=""
          className="h-8 w-8 rounded-full border"
          style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{post.author.displayName}</p>
          <p className="truncate text-xs text-white/60">@{post.author.handles.bluesky}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/80">
          <span className="flex items-center gap-1">
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
            </svg>
            {formatCount(post.metrics.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            {formatCount(post.metrics.reposts)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Image Card ──────────────────────────────────────────────────────

function ImageCard({
  post,
  media,
  onClick,
  style,
}: {
  post: UnifiedPost;
  media: MediaItem;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Use aspect ratio from media, or fall back to a standard ratio
  const ar = media.aspectRatio || 1;
  // Clamp between 0.5 and 2 for nice grid appearance
  const displayAr = Math.min(Math.max(ar, 0.5), 2);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1185fe]"
      style={{
        backgroundColor: 'var(--color-card)',
        aspectRatio: `${displayAr}`,
        ...style,
      }}
      aria-label={`View media by ${post.author.displayName}`}
    >
      {/* Image */}
      {!imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.thumb || media.url}
          alt={media.alt || `Media by ${post.author.displayName}`}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: 'var(--color-muted-bg)' }}
        >
          <span className="text-2xl opacity-30">🖼</span>
        </div>
      )}

      {/* Loading shimmer */}
      {!imageLoaded && !imageError && <div className="skeleton-shimmer absolute inset-0" />}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7))' }}
      >
        {/* Author info on hover */}
        <div className="absolute bottom-3 left-3 right-3 transition-transform duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.author.avatarUrl || '/default-avatar.svg'}
              alt=""
              className="h-6 w-6 rounded-full border"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="truncate text-xs font-medium text-white drop-shadow-lg">
              {post.author.displayName}
            </span>
          </div>
        </div>
      </div>

      {/* Persistent info overlay (visible at all times on mobile, hover on desktop) */}
      <div
        className="absolute right-2 top-2 flex items-center gap-2 rounded-full px-2 py-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <span className="flex items-center gap-1 text-[11px] text-white">
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
          </svg>
          {formatCount(post.metrics.likes)}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-white">
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          {formatCount(post.metrics.reposts)}
        </span>
      </div>

      {/* Always-visible attribution on mobile (bottom strip) */}
      <div
        className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-6 md:hidden"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}
      >
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.author.avatarUrl || '/default-avatar.svg'}
            alt=""
            className="h-4 w-4 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="truncate text-[11px] font-medium text-white drop-shadow">
            {post.author.displayName}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Video Card ──────────────────────────────────────────────────────

function VideoCard({ post, style }: { post: UnifiedPost; style?: React.CSSProperties }) {
  const thumb = extractMedia(post)[0];
  const externalUrl = getExternalUrl(post);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02]"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-glass-border)',
        ...style,
      }}
    >
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="group relative block w-full"
        style={{ aspectRatio: thumb?.aspectRatio || '16/9' }}
        aria-label={`Play video by ${post.author.displayName}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb.url}
            alt={thumb.alt || ''}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: 'var(--color-muted-bg)' }}
          >
            <span className="text-6xl opacity-20">▶</span>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.author.avatarUrl || '/default-avatar.svg'}
            alt=""
            className="h-5 w-5 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="truncate text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
            {post.author.displayName}
          </span>
          <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--color-muted)' }}>
            {timeAgo(post.createdAt)}
          </span>
        </div>

        {post.text && (
          <p className="mt-1.5 line-clamp-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            {post.text}
          </p>
        )}

        <div
          className="mt-2 flex items-center gap-4 text-[11px]"
          style={{ color: 'var(--color-muted)' }}
        >
          <span className="flex items-center gap-1">
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
            </svg>
            {formatCount(post.metrics.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            {formatCount(post.metrics.reposts)}
          </span>

          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:opacity-80"
              style={{ backgroundColor: BLUESKY_BLUE }}
              onClick={(e) => e.stopPropagation()}
            >
              Open
              <svg
                aria-hidden="true"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({ tabLabel, onRetry }: { tabLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="empty-state-icon mb-4" style={{ fontSize: '2rem' }}>
        {tabLabel === 'Images' ? '📷' : tabLabel === 'Videos' ? '▶' : '🔥'}
      </div>
      <h3 className="mb-1 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
        No {tabLabel.toLowerCase()} yet
      </h3>
      <p className="mb-6 max-w-xs text-center text-sm" style={{ color: 'var(--color-muted)' }}>
        {tabLabel === 'Images'
          ? 'Image posts from Bluesky will appear here. Check back soon!'
          : tabLabel === 'Videos'
            ? 'Video and link posts from Bluesky will appear here.'
            : 'Trending crypto content from Bluesky will appear here.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: BLUESKY_BLUE }}
      >
        Refresh
      </button>
    </div>
  );
}

// ─── Pull-to-Refresh ─────────────────────────────────────────────────

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [state, setState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const pullStartY = useRef(0);
  const pullDist = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 10) return; // only at top
    const touch = e.touches[0];
    if (!touch) return;
    pullStartY.current = touch.clientY;
    pullDist.current = 0;
    setState('pulling');
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (state === 'idle' || state === 'refreshing') return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - pullStartY.current;
      if (dy < 0) {
        setState('idle');
        return;
      }
      pullDist.current = dy;
      if (dy > 80) {
        setState('ready');
      } else {
        setState('pulling');
      }
    },
    [state],
  );

  const handleTouchEnd = useCallback(async () => {
    if (state === 'ready') {
      setState('refreshing');
      try {
        await onRefresh();
      } finally {
        setState('idle');
      }
    } else {
      setState('idle');
    }
    pullDist.current = 0;
  }, [state, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pullState: state, pullDistance: pullDist.current };
}

// ─── Pull-to-Refresh Indicator ───────────────────────────────────────

function PullIndicator({
  state,
  distance,
}: {
  state: 'idle' | 'pulling' | 'ready' | 'refreshing';
  distance: number;
}) {
  if (state === 'idle') return null;

  const height = state === 'refreshing' ? 48 : Math.min(distance * 0.4, 60);

  return (
    <div
      className="flex items-center justify-center gap-2 overflow-hidden transition-all"
      style={{
        height,
        color: BLUESKY_BLUE,
      }}
    >
      {state === 'refreshing' ? (
        <>
          <svg
            aria-hidden="true"
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path
              d="M12 2a10 10 0 0110 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-xs font-medium">Refreshing...</span>
        </>
      ) : state === 'ready' ? (
        <>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-xs font-medium">Release to refresh</span>
        </>
      ) : (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform"
          style={{ transform: `rotate(${distance * 2}deg)` }}
        >
          <path d="M12 5v14M5 12l7-7 7 7" />
        </svg>
      )}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────

function TabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabConfig[];
  activeTab: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <div
      className="mb-6 flex gap-1 rounded-xl p-1"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      role="tablist"
      aria-label="Bluesky media tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
              isActive ? 'shadow-sm' : ''
            }`}
            style={{
              backgroundColor: isActive ? 'var(--color-card)' : 'transparent',
              color: isActive ? BLUESKY_BLUE : 'var(--color-muted)',
              border: isActive ? `1px solid ${BLUESKY_BLUE}22` : '1px solid transparent',
            }}
          >
            <span className="text-base" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function BlueskyMediaView() {
  const [activeTab, setActiveTab] = useState<TabId>('images');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'error' | 'empty'>('loading');
  const [error, setError] = useState<string>();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Lightbox state
  const [lightboxPost, setLightboxPost] = useState<UnifiedPost | null>(null);
  const [_lightboxMediaIndex, setLightboxMediaIndex] = useState(0);

  // Pull-to-refresh
  const { containerRef, pullState, pullDistance } = usePullToRefresh(async () => {
    setPage(1);
    setState('loading');
    await fetchPosts(1, true);
  });

  const activeConfig = TABS.find((t) => t.id === activeTab)!;

  const fetchPosts = useCallback(
    async (pageNum: number, replace = false) => {
      try {
        const endpoint = activeConfig.endpoint;
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', String(POSTS_PER_PAGE));
        if (pageNum > 1) url.searchParams.set('page', String(pageNum));

        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const data = (await res.json()) as { data?: UnifiedPost[]; meta?: { total?: number } };
        const feed = data.data ?? [];
        const _total = data.meta?.total ?? 0;

        if (replace) {
          setPosts(feed);
        } else {
          setPosts((prev) => [...prev, ...feed]);
        }

        // If we got fewer results than requested, no more pages
        setHasMore(feed.length >= POSTS_PER_PAGE);
        setState(feed.length > 0 || pageNum > 1 ? 'loaded' : 'empty');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setState('error');
      }
    },
    [activeConfig.endpoint],
  );

  // Initial fetch when tab changes
  useEffect(() => {
    setPage(1);
    setPosts([]);
    setState('loading');
    setHasMore(true);
    void fetchPosts(1, true);
  }, [fetchPosts]);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && state === 'loaded') {
          setLoadingMore(true);
          const nextPage = page + 1;
          setPage(nextPage);
          await fetchPosts(nextPage, false);
          setLoadingMore(false);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, state, page, fetchPosts]);

  // Get all media items from current posts
  const getAllMediaPosts = useCallback(() => {
    if (activeTab === 'videos') {
      // For video tab, show video cards (no lightbox)
      return [];
    }
    return posts.flatMap((p) => {
      const media = extractMedia(p);
      return media.length > 0 ? [{ post: p, media: media[0]! }] : [];
    });
  }, [posts, activeTab]);

  const mediaPosts = getAllMediaPosts();

  // Lightbox navigation
  const currentLightboxIndex = lightboxPost
    ? mediaPosts.findIndex((mp) => mp.post.id === lightboxPost.id)
    : -1;

  const openLightbox = (post: UnifiedPost) => {
    setLightboxPost(post);
    setLightboxMediaIndex(0);
  };

  const closeLightbox = () => {
    setLightboxPost(null);
    setLightboxMediaIndex(0);
  };

  const goToPrev = () => {
    if (currentLightboxIndex > 0) {
      const prev = mediaPosts[currentLightboxIndex - 1];
      if (prev) openLightbox(prev.post);
    }
  };

  const goToNext = () => {
    if (currentLightboxIndex < mediaPosts.length - 1) {
      const next = mediaPosts[currentLightboxIndex + 1];
      if (next) openLightbox(next.post);
    }
  };

  // ── Render ──

  return (
    <div ref={containerRef} className="min-h-screen pb-12">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
            Bluesky Media
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Photos, videos, and trending content from the AT Protocol
          </p>
        </div>
        <div
          className="hidden h-10 w-10 items-center justify-center rounded-full sm:flex"
          style={{ backgroundColor: `${BLUESKY_BLUE}15` }}
        >
          <span className="text-lg" aria-hidden="true">
            🦋
          </span>
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Pull indicator */}
      <PullIndicator state={pullState} distance={pullDistance} />

      {/* Error state */}
      {state === 'error' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="empty-state-icon mb-4">⚠️</div>
          <h3 className="mb-1 text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
            Something went wrong
          </h3>
          <p className="mb-6 max-w-xs text-center text-sm" style={{ color: 'var(--color-muted)' }}>
            {error || 'Failed to load Bluesky content. The bridge may be unavailable.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setState('loading');
              void fetchPosts(1, true);
            }}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: BLUESKY_BLUE }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {state === 'loading' && <SkeletonGrid count={12} />}

      {/* Images tab content */}
      {state === 'loaded' && activeTab === 'images' && (
        <>
          {mediaPosts.length === 0 ? (
            <EmptyState
              tabLabel="Images"
              onRetry={() => {
                setState('loading');
                void fetchPosts(1, true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-enter">
              {mediaPosts.map(({ post, media }, index) => (
                <div
                  key={post.id}
                  className="stagger-item"
                  style={
                    {
                      '--stagger-delay': '60ms',
                      '--stagger-item-index': index,
                    } as React.CSSProperties
                  }
                >
                  <ImageCard post={post} media={media} onClick={() => openLightbox(post)} />
                </div>
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="mt-4 h-4" />

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="mt-4">
              <SkeletonGrid count={6} />
            </div>
          )}

          {/* End of feed */}
          {!hasMore && state === 'loaded' && mediaPosts.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 py-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${BLUESKY_BLUE}12`, color: BLUESKY_BLUE }}
              >
                <span className="text-lg">🦋</span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
                You&apos;ve reached the end
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>
                {mediaPosts.length} posts loaded
              </p>
            </div>
          )}
        </>
      )}

      {/* Videos tab content */}
      {state === 'loaded' && activeTab === 'videos' && (
        <>
          {posts.length === 0 ? (
            <EmptyState
              tabLabel="Videos"
              onRetry={() => {
                setState('loading');
                void fetchPosts(1, true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 stagger-enter">
              {posts
                .filter(isVideoPost)
                .concat(
                  // Also show posts with link embeds as cards
                  posts.filter((p) => !isVideoPost(p) && getExternalUrl(p)),
                )
                .map((post, index) => (
                  <div
                    key={post.id}
                    className="stagger-item"
                    style={
                      {
                        '--stagger-delay': '60ms',
                        '--stagger-item-index': index,
                      } as React.CSSProperties
                    }
                  >
                    <VideoCard post={post} />
                  </div>
                ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="mt-4 h-4" />

          {loadingMore && (
            <div className="mt-4">
              <SkeletonGrid count={4} />
            </div>
          )}
        </>
      )}

      {/* Trending tab content */}
      {state === 'loaded' && activeTab === 'trending' && (
        <>
          {posts.length === 0 ? (
            <EmptyState
              tabLabel="Trending"
              onRetry={() => {
                setState('loading');
                void fetchPosts(1, true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-enter">
              {posts.map((post, index) => {
                const media = extractMedia(post);
                // Show as image card if it has images, otherwise show as text card
                return media.length > 0 ? (
                  <div
                    key={post.id}
                    className="stagger-item"
                    style={
                      {
                        '--stagger-delay': '60ms',
                        '--stagger-item-index': index,
                      } as React.CSSProperties
                    }
                  >
                    <ImageCard post={post} media={media[0]!} onClick={() => openLightbox(post)} />
                  </div>
                ) : (
                  <div
                    key={post.id}
                    className="stagger-item"
                    style={
                      {
                        '--stagger-delay': '60ms',
                        '--stagger-item-index': index,
                      } as React.CSSProperties
                    }
                  >
                    <TrendingTextCard post={post} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="mt-4 h-4" />

          {loadingMore && (
            <div className="mt-4">
              <SkeletonGrid count={6} />
            </div>
          )}

          {!hasMore && state === 'loaded' && posts.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 py-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${BLUESKY_BLUE}12`, color: BLUESKY_BLUE }}
              >
                <span className="text-lg">🔥</span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
                All caught up
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>
                {posts.length} trending posts loaded
              </p>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxPost && (
        <Lightbox
          post={lightboxPost}
          media={extractMedia(lightboxPost)[0] ?? { url: '', alt: '' }}
          onClose={closeLightbox}
          onPrev={currentLightboxIndex > 0 ? goToPrev : undefined}
          onNext={currentLightboxIndex < mediaPosts.length - 1 ? goToNext : undefined}
          hasPrev={currentLightboxIndex > 0}
          hasNext={currentLightboxIndex < mediaPosts.length - 1}
        />
      )}
    </div>
  );
}

// ─── Trending Text Card (for posts without images in trending tab) ───

function TrendingTextCard({ post }: { post: UnifiedPost }) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-glass-border)',
      }}
    >
      {/* Author row */}
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.author.avatarUrl || '/default-avatar.svg'}
          alt=""
          className="h-6 w-6 rounded-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="truncate text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
          {post.author.displayName}
        </span>
        <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {timeAgo(post.createdAt)}
        </span>
      </div>

      {/* Text */}
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed" style={{ color: 'var(--color-fg)' }}>
        {post.text}
      </p>

      {/* Niches + metrics */}
      <div className="mt-3 flex items-center gap-2">
        {post.niches.slice(0, 3).map((niche) => (
          <span
            key={niche}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${BLUESKY_BLUE}12`,
              color: BLUESKY_BLUE,
            }}
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

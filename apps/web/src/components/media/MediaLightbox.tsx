/**
 * @degenfeed/web — MediaLightbox
 *
 * Full-screen lightbox for viewing images and videos.
 * Shows: full-resolution image/video, source badge, author info,
 * metrics (likes, saves), description, and navigation.
 * Supports keyboard nav (← → ESC) and touch swipe.
 */

'use client';

import type { VisualPost } from '@degenfeed/types';
import { useCallback, useEffect, useState } from 'react';
import { formatCount } from './MediaCard';
import { MEDIA_SOURCES } from './MediaTypes';

// ─── Props ───────────────────────────────────────────────────────

interface MediaLightboxProps {
  post: VisualPost;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

// ─── Component ───────────────────────────────────────────────────

export function MediaLightbox({
  post,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: MediaLightboxProps) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Touch swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0]?.clientX ?? 0);
    setTouchDeltaX(0);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      setTouchDeltaX((e.touches[0]?.clientX ?? 0) - touchStartX);
    },
    [touchStartX],
  );

  const handleTouchEnd = useCallback(() => {
    if (touchDeltaX > 80 && onPrev) onPrev();
    else if (touchDeltaX < -80 && onNext) onNext();
    setTouchDeltaX(0);
  }, [touchDeltaX, onPrev, onNext]);

  const sourceMeta = MEDIA_SOURCES[post.source] ?? MEDIA_SOURCES[post.protocol];
  const isVideo = post.mediaType === 'video' || post.mediaType === 'nft_video';
  const imgSrc = post.fullImageUrl || post.imageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-backdrop-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.93)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Media lightbox"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Close button ── */}
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

      {/* ── Previous button ── */}
      {hasPrev && onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white transition-transform hover:scale-110 active:scale-95 sm:left-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          aria-label="Previous media"
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

      {/* ── Next button ── */}
      {hasNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white transition-transform hover:scale-110 active:scale-95 sm:right-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          aria-label="Next media"
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

      {/* ── Media content ── */}
      <div className="flex h-full w-full flex-col items-center justify-center p-4 sm:p-8">
        {isVideo && post.videoUrl ? (
          <video
            src={post.videoUrl}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            controls
            autoPlay
            poster={imgSrc}
            style={{ maxHeight: 'calc(100vh - 12rem)' }}
          >
            <track kind="captions" label="No captions available" />
          </video>
        ) : imgSrc ? (
          <img
            src={imgSrc}
            alt={post.text?.slice(0, 120) || 'Media content'}
            className="max-h-full max-w-full animate-slide-up rounded-lg object-contain shadow-2xl"
            style={{
              maxHeight: 'calc(100vh - 12rem)',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="flex items-center justify-center" style={{ color: 'var(--color-muted)' }}>
            <p className="text-sm">Media not available</p>
          </div>
        )}

        {/* Loading indicator */}
        {!imgLoaded && imgSrc && !isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              aria-hidden="true"
              className="animate-spin"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path
                d="M12 2a10 10 0 0110 10"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* ── Bottom info bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-4 sm:px-8"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
      >
        {/* Author */}
        {post.author.avatarUrl ? (
          <img
            src={post.author.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full border border-white/20"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: sourceMeta?.color ?? 'var(--color-accent)' }}
          >
            {post.author.displayName[0]?.toUpperCase() || '?'}
          </div>
        )}

        {/* Name + source */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{post.author.displayName}</p>
          <div className="flex items-center gap-2">
            {sourceMeta && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0 text-[9px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: `${sourceMeta.color}30`, color: sourceMeta.color }}
              >
                {sourceMeta.label}
              </span>
            )}
            {post.isNFT && post.collectionName && (
              <span className="text-[10px] text-purple-300">{post.collectionName}</span>
            )}
          </div>
        </div>

        {/* Metrics */}
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
          {post.isNFT && post.mintUrl && (
            <a
              href={post.mintUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#6b21a8' }}
            >
              Mint
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

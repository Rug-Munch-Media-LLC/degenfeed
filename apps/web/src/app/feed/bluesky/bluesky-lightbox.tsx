/**
 * @degenfeed/web — Bluesky Lightbox
 *
 * Full-screen image lightbox with keyboard navigation and swipe support.
 */

'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useEffect } from 'react';
import { formatCount } from './bluesky-media-helpers';
import type { MediaItem } from './bluesky-media-types';

interface LightboxProps {
  post: UnifiedPost;
  media: MediaItem;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function Lightbox({
  post,
  media,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: LightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

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

      <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
        <img
          src={media.url}
          alt={media.alt || 'Media content'}
          className="max-h-full max-w-full animate-slide-up rounded-lg object-contain shadow-2xl"
          style={{ maxHeight: 'calc(100vh - 8rem)' }}
        />
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-4 sm:px-8"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
      >
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

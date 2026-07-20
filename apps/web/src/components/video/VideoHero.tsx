'use client';

/**
 * @degenfeed/web — VideoHero
 *
 * Featured hero video banner for the top of the video hub.
 * Large responsive layout with auto-playing preview, title, metadata,
 * action buttons, and source badge. Netflix-style.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { VideoSourceBadge } from './VideoSourceBadge';
import type { UnifiedVideo } from './useVideoHub';

interface VideoHeroProps {
  video: UnifiedVideo;
  onPlay?: (video: UnifiedVideo) => void;
  className?: string;
}

export function VideoHero({ video, onPlay, className = '' }: VideoHeroProps) {
  const [imgError, setImgError] = useState(false);

  const handlePlay = useCallback(() => {
    onPlay?.(video);
  }, [video, onPlay]);

  const handleWatchLater = useCallback(() => {
    try {
      const existing = JSON.parse(
        localStorage.getItem('df:watch-later') ?? '[]',
      ) as { id: string; title: string; addedAt: number }[];
      if (!existing.some((i) => i.id === video.id)) {
        existing.push({ id: video.id, title: video.title, addedAt: Date.now() });
        localStorage.setItem('df:watch-later', JSON.stringify(existing));
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'info', message: 'Saved to Watch Later' },
          }),
        );
      }
    } catch {
      // Storage unavailable
    }
  }, [video]);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{ minHeight: '360px', maxHeight: '560px' }}
    >
      {/* Background image */}
      <div className="absolute inset-0">
        {!imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--color-card)] to-degen-500/10" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg)]/80 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12">
        {/* Source badge */}
        <div className="mb-3">
          <VideoSourceBadge
            source={video.source}
            size="md"
          />
        </div>

        {/* Title */}
        <h1 className="mb-2 max-w-2xl text-2xl font-bold text-white drop-shadow-lg sm:text-3xl md:text-4xl line-clamp-2">
          {video.title}
        </h1>

        {/* Meta info */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
          <span className="font-medium text-white">{video.channelName}</span>
          <span aria-hidden="true">·</span>
          <span>{formatViews(video.views)} views</span>
          <span aria-hidden="true">·</span>
          <span>{video.publishedLabel}</span>
          {video.durationLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{video.durationLabel}</span>
            </>
          )}
        </div>

        {/* Description */}
        {video.description && (
          <p className="mb-5 max-w-lg text-sm text-white/60 line-clamp-2">
            {video.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePlay}
            className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
            Play
          </button>

          <button
            type="button"
            onClick={handleWatchLater}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            Watch Later
          </button>

          <Link
            href={`/video/${video.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Details
          </Link>
        </div>
      </div>

      {/* Category tag */}
      {video.category && video.category !== 'all' && (
        <Link
          href={`/video?category=${video.category}`}
          className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/60 hover:text-white transition-colors"
        >
          {video.category}
        </Link>
      )}
    </section>
  );
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

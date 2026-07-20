'use client';

/**
 * @degenfeed/web — YouTubeShortsCard
 *
 * Individual YouTube Shorts card for the vertical scroll feed.
 * Vertical aspect ratio (9:16), labeled as YouTube Shorts.
 */

import { memo, useState } from 'react';
import { formatYouTubeCount, formatYouTubeTimeAgo } from './useYouTube';
import type { YouTubeShort } from './useYouTube';

// === Types ===============================================================

export interface YouTubeShortsCardProps {
  short: YouTubeShort;
  onPlay?: (short: YouTubeShort) => void;
  onLike?: (short: YouTubeShort) => void;
}

// === Component ===========================================================

export const YouTubeShortsCard = memo(function YouTubeShortsCard({
  short,
  onPlay,
  onLike,
}: YouTubeShortsCardProps) {
  const [imgError, setImgError] = useState(false);
  const [liked, setLiked] = useState(false);

  const thumbnailSrc = imgError
    ? `https://img.youtube.com/vi/${short.id}/hqdefault.jpg`
    : short.thumbnail;

  const handlePlay = () => {
    if (onPlay) {
      onPlay(short);
    } else {
      window.open(short.videoUrl, '_blank', 'noopener noreferrer');
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    if (onLike) onLike(short);
  };

  return (
    <article
      className="group relative flex-shrink-0 w-44 md:w-52 rounded-xl overflow-hidden border border-[var(--color-glass-border)] bg-[var(--color-card)] transition-all duration-200 hover:border-pink-500/30 hover:shadow-lg hover:shadow-pink-500/10 cursor-pointer"
      onClick={handlePlay}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlay(); }}
      role="button"
      tabIndex={0}
      aria-label={`Play Short: ${short.title}`}
    >
      {/* Thumbnail — 9:16 aspect ratio */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-[var(--color-muted)]">
        {/* biome-ignore lint/performance/noImgElement: external thumbnail */}
        <img
          src={thumbnailSrc}
          alt={short.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        {/* Source badge */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 rounded bg-pink-600/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <span>{'\u25B6'}</span>
            <span>Shorts</span>
          </span>
        </div>

        {/* View count */}
        <div className="absolute bottom-3 left-3 text-xs text-white font-medium drop-shadow-lg pointer-events-none">
          <span>{formatYouTubeCount(short.viewCount)} views</span>
        </div>

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5V19L19 12L8 5Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1">
        <h3 className="text-xs font-semibold text-[var(--color-fg)] line-clamp-2 leading-snug">
          {short.title}
        </h3>
        <p className="text-[10px] text-[var(--color-muted)] truncate">
          {short.channelName}
        </p>
        <p className="text-[10px] text-[var(--color-muted)]">
          {formatYouTubeTimeAgo(short.publishedAt)}
        </p>
      </div>

      {/* Like button */}
      <button
        type="button"
        onClick={handleLike}
        className={`absolute bottom-3 right-3 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] transition-all backdrop-blur-sm ${
          liked
            ? 'bg-pink-600/40 text-pink-300'
            : 'bg-black/30 text-white/80 hover:bg-black/50'
        }`}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <span>{liked ? '\u2764\uFE0F' : '\u2661'}</span>
      </button>
    </article>
  );
});

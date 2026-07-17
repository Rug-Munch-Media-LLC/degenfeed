'use client';

/**
 * @degenfeed/ui — YouTubeVideoCard
 *
 * Video thumbnail card with play-overlay, duration badge, channel info,
 * source badge, view count, and time-ago. Designed for the /videos grid.
 *
 * States: normal, hover (enlarged thumbnail), loading (skeleton).
 */

import { memo, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface YouTubeVideoCardItem {
  id: string;
  title: string;
  channelName: string;
  channelUrl?: string;
  thumbnailUrl: string;
  url: string;
  publishedAt: string;
  publishedMs: number;
  duration?: string;
  views?: number;
  description?: string;
  category?: string;
  source: 'youtube' | 'peertube';
}

export interface YouTubeVideoCardProps {
  video: YouTubeVideoCardItem;
  /** If true, show extended info on hover */
  showExtended?: boolean;
  /** Called when card is clicked */
  onPlay?: (video: YouTubeVideoCardItem) => void;
  /** Optional "Watch on" link handler — default opens in new tab */
  onWatchOn?: (video: YouTubeVideoCardItem) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(duration?: string): string {
  if (!duration) return '';
  // YouTube RSS doesn't include duration directly — fallback
  // If we have a duration like PT1H2M3S (ISO 8601), parse it
  if (duration.startsWith('PT')) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    const h = match[1] ? Number.parseInt(match[1], 10) : 0;
    const m = match[2] ? Number.parseInt(match[2], 10) : 0;
    const s = match[3] ? Number.parseInt(match[3], 10) : 0;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return duration;
}

// ─── Component ──────────────────────────────────────────────────────────

export const YouTubeVideoCard = memo(function YouTubeVideoCard({
  video,
  showExtended = false,
  onPlay,
  onWatchOn,
}: YouTubeVideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isYouTube = video.source === 'youtube';
  const isShort = /#shorts/.test(video.url);
  const durationLabel = formatDuration(video.duration);

  const handleClick = () => {
    if (onPlay) {
      onPlay(video);
    } else {
      window.open(video.url, '_blank', 'noopener noreferrer');
    }
  };

  const handleWatchOn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWatchOn) {
      onWatchOn(video);
    } else {
      window.open(video.url, '_blank', 'noopener noreferrer');
    }
  };

  // Fallback thumbnail on error
  const thumbnailSrc = imgError
    ? `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`
    : video.thumbnailUrl;

  return (
    <article
      className="group relative flex flex-col rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden transition-all duration-200 hover:border-degen-500/20 hover:shadow-lg hover:shadow-degen-500/5 hover:bg-[var(--color-card-hover)] focus-within:ring-2 focus-within:ring-degen-500/40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Thumbnail ── */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-muted)]">
        {/* biome-ignore lint/performance/noImgElement: external thumbnail */}
        <img
          src={thumbnailSrc}
          alt={`Thumbnail for ${video.title}`}
          className={`h-full w-full object-cover transition-all duration-300 ${
            isHovered ? 'scale-105' : 'scale-100'
          }`}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />

        {/* Gradient overlay bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Duration badge */}
        {durationLabel && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm pointer-events-none">
            {durationLabel}
          </span>
        )}

        {/* Shorts indicator */}
        {isShort && (
          <span className="absolute bottom-2 left-2 rounded bg-degen-500/20 px-1.5 py-0.5 text-[10px] font-medium text-degen-400 backdrop-blur-sm pointer-events-none">
            #Shorts
          </span>
        )}

        {/* Play button overlay — appears on hover */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isHovered ? 'opacity-100 bg-black/20' : 'opacity-0'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-lg shadow-degen-500/30 transition-transform duration-200 group-hover:scale-110">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5V19L19 12L8 5Z" />
            </svg>
          </div>
        </div>

        {/* Source badge */}
        <span
          className={`absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm pointer-events-none ${
            isYouTube
              ? 'bg-red-600/80 text-white'
              : 'bg-purple-600/80 text-white'
          }`}
        >
          {isYouTube ? '\u25B6 YouTube' : '\uD83D\uDCF9 PeerTube'}
        </span>
      </div>

      {/* ── Card Body ── */}
      <div className="flex flex-1 flex-col p-3">
        {/* Title */}
        <h3 className="text-sm font-semibold text-[var(--color-fg)] line-clamp-2 leading-snug group-hover:text-degen-400 transition-colors">
          <button
            type="button"
            onClick={handleClick}
            className="text-left w-full bg-transparent border-none cursor-pointer p-0 m-0 text-inherit hover:text-inherit"
            aria-label={`Play ${video.title} by ${video.channelName}`}
          >
            {video.title}
          </button>
        </h3>

        {/* Channel + source */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)] truncate">
            {video.channelName}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium ${
              isYouTube
                ? 'bg-red-500/10 text-red-500'
                : 'bg-purple-500/10 text-purple-500'
            }`}
          >
            {isYouTube ? '\u25B6' : '\uD83D\uDCF9'}
            {isYouTube ? 'YouTube' : 'Federated'}
          </span>
        </div>

        {/* Views + time ago */}
        <div className="mt-auto pt-2 flex items-center gap-2 text-[11px] text-[var(--color-muted)] tabular-nums">
          {video.views != null && (
            <span>{formatCount(video.views)} views</span>
          )}
          <span>&middot;</span>
          <span>{formatTimeAgo(video.publishedMs)} ago</span>
        </div>

        {/* Extended info on hover */}
        {showExtended && isHovered && video.description && (
          <p className="mt-2 text-[10px] text-[var(--color-muted)] line-clamp-2 leading-relaxed border-t border-[var(--color-glass-border)] pt-2">
            {video.description.slice(0, 200)}
          </p>
        )}
      </div>

      {/* ── "Watch on" link — always accessible at bottom ── */}
      <button
        type="button"
        onClick={handleWatchOn}
        className="flex items-center justify-center gap-1 border-t border-[var(--color-glass-border)] px-3 py-2 text-[10px] text-[var(--color-muted)] hover:text-degen-400 hover:bg-[var(--color-overlay)] transition-colors focus:outline-none"
        aria-label={`Watch on ${isYouTube ? 'YouTube' : 'PeerTube'}`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Watch on {isYouTube ? 'youtube.com' : 'video.degenfeed.xyz'}
      </button>

      {/* Full card click target (a11y: keyboard already handled by button) */}
      <button
        type="button"
        onClick={handleClick}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-hidden="true"
        tabIndex={-1}
      />
    </article>
  );
});

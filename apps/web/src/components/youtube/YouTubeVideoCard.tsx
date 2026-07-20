'use client';

/**
 * @degenfeed/web — YouTubeVideoCard
 *
 * Video card for YouTube content in the YouTube section.
 * Distinct from PeerTube cards — always labeled with YouTube badge.
 * Includes cross-platform DegenFeed actions: Tip, Share, Save, Cross-post.
 */

import { memo, useState } from 'react';
import { YouTubeSourceBadge } from './YouTubeSourceBadge';
import { formatYouTubeCount, formatYouTubeDuration, formatYouTubeTimeAgo } from './useYouTube';
import type { EnrichedYouTubeVideo } from './useYouTube';

// ─── Types ───────────────────────────────────────────────────────────────

export interface YouTubeVideoCardProps {
  video: EnrichedYouTubeVideo;
  /** Called when card is clicked */
  onPlay?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks tip button */
  onTip?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks share button */
  onShare?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks save button */
  onSave?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks cross-post button */
  onCrossPost?: (video: EnrichedYouTubeVideo) => void;
  /** Layout variant */
  variant?: 'card' | 'compact' | 'featured';
}

// ─── Component ───────────────────────────────────────────────────────────

export const YouTubeVideoCard = memo(function YouTubeVideoCard({
  video,
  onPlay,
  onTip,
  onShare,
  onSave,
  onCrossPost,
  variant = 'card',
}: YouTubeVideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const thumbnailSrc = imgError
    ? `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`
    : video.thumbnail;

  const isFeatured = variant === 'featured';
  const isCompact = variant === 'compact';

  const handlePlay = () => {
    if (onPlay) {
      onPlay(video);
    } else {
      window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank', 'noopener noreferrer');
    }
  };

  const handleAction = (action: string, handler?: (v: EnrichedYouTubeVideo) => void) => {
    if (handler) {
      handler(video);
    }
    setActionFeedback(action);
    setTimeout(() => setActionFeedback(null), 1500);
  };

  return (
    <article
      className={`group relative flex flex-col rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden transition-all duration-200 hover:border-degen-500/20 hover:shadow-lg hover:shadow-degen-500/5 hover:bg-[var(--color-card-hover)] focus-within:ring-2 focus-within:ring-degen-500/40 ${
        isFeatured ? 'lg:flex-row' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Thumbnail ── */}
      <div
        className={`relative overflow-hidden bg-[var(--color-muted)] ${
          isFeatured ? 'lg:w-3/5 aspect-video lg:aspect-auto' : isCompact ? 'aspect-video' : 'aspect-video w-full'
        }`}
      >
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

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Duration badge */}
        {video.duration && !isFeatured && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm pointer-events-none">
            {formatYouTubeDuration(video.duration)}
          </span>
        )}

        {/* Source badge — always visible: "YouTube" in red */}
        <div className="absolute top-2 left-2">
          <YouTubeSourceBadge source="youtube" size="sm" />
        </div>

        {/* Play overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isHovered ? 'opacity-100 bg-black/20' : 'opacity-0'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg shadow-red-500/30 transition-transform duration-200 group-hover:scale-110">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5V19L19 12L8 5Z" />
            </svg>
          </div>
        </div>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-xs text-white backdrop-blur-sm animate-fade-in pointer-events-none">
            {actionFeedback === 'tip' && '\u26A1 Tipped!'}
            {actionFeedback === 'save' && '\uD83D\uDCC1 Saved!'}
            {actionFeedback === 'share' && '\uD83D\uDD17 Link copied!'}
            {actionFeedback === 'crosspost' && '\uD83D\uDCE3 Cross-posted!'}
          </div>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className={`flex flex-1 flex-col ${isFeatured ? 'lg:w-2/5' : ''} p-3`}>
        {/* Title */}
        <h3 className={`font-semibold text-[var(--color-fg)] line-clamp-2 leading-snug group-hover:text-red-400 transition-colors ${isFeatured ? 'text-lg' : isCompact ? 'text-xs' : 'text-sm'}`}>
          <button
            type="button"
            onClick={handlePlay}
            className="text-left w-full bg-transparent border-none cursor-pointer p-0 m-0 text-inherit hover:text-inherit"
            aria-label={`Play ${video.title} by ${video.channelName}`}
          >
            {video.title}
          </button>
        </h3>

        {/* Channel info */}
        <div className={`mt-1.5 flex items-center gap-2 ${isCompact ? 'mt-1' : ''}`}>
          <div className={`rounded-full bg-[var(--color-overlay)] overflow-hidden flex-shrink-0 ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`}>
            {video.channelAvatar ? (
              // biome-ignore lint/performance/noImgElement: channel avatar
              <img
                src={video.channelAvatar}
                alt={video.channelName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--color-muted)]">
                {video.channelName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className={`text-[var(--color-muted)] truncate ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
            {video.channelName}
          </span>
        </div>

        {/* Views + time ago */}
        <div className={`mt-auto flex items-center gap-2 text-[11px] text-[var(--color-muted)] tabular-nums ${isCompact ? 'pt-1' : 'pt-2'}`}>
          <span>{formatYouTubeCount(video.viewCount)} views</span>
          <span>&middot;</span>
          <span>{formatYouTubeTimeAgo(video.publishedAt)}</span>
        </div>

        {/* Description (featured only) */}
        {isFeatured && video.description && (
          <p className="mt-2 text-xs text-[var(--color-muted)] line-clamp-3 leading-relaxed border-t border-[var(--color-glass-border)] pt-2">
            {video.description.slice(0, 300)}
          </p>
        )}

        {/* Creator coin indicator */}
        {video.canTip && video.creatorCoin && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
            <span className="text-amber-500">{'\u25C8'}</span>
            <span>Tip with ${video.creatorCoin.symbol}</span>
          </div>
        )}
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center border-t border-[var(--color-glass-border)] divide-x divide-[var(--color-glass-border)]">
        {/* Tip */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAction('tip', onTip);
          }}
          className={`flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[10px] transition-colors focus:outline-none hover:bg-amber-500/5 ${
            video.canTip ? 'text-amber-400 hover:text-amber-300' : 'text-[var(--color-muted)] hover:text-amber-400'
          }`}
          aria-label={`Tip ${video.channelName}`}
          disabled={!video.canTip}
          title={video.canTip ? `Tip with ${video.creatorCoin?.symbol ?? 'coin'}` : 'Tipping not available'}
        >
          <span>{'\u26A1'}</span>
          <span>Tip</span>
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAction('share', onShare);
          }}
          className="flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[10px] text-[var(--color-muted)] hover:text-degen-400 hover:bg-[var(--color-overlay)] transition-colors focus:outline-none"
          aria-label="Share video"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M9 4C9.82843 4 10.5 3.32843 10.5 2.5C10.5 1.67157 9.82843 1 9 1C8.17157 1 7.5 1.67157 7.5 2.5C7.5 2.5 7.5 2.5 7.5 2.5L4.5 4M9 8C9.82843 8 10.5 8.67157 10.5 9.5C10.5 10.3284 9.82843 11 9 11C8.17157 11 7.5 10.3284 7.5 9.5C7.5 9.5 7.5 9.5 7.5 9.5L4.5 8M3 6C3 6.82843 2.32843 7.5 1.5 7.5C0.671573 7.5 0 6.82843 0 6C0 5.17157 0.671573 4.5 1.5 4.5C2.32843 4.5 3 5.17157 3 6Z" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          <span>Share</span>
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAction('save', onSave);
          }}
          className="flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[10px] text-[var(--color-muted)] hover:text-blue-400 hover:bg-blue-500/5 transition-colors focus:outline-none"
          aria-label="Save video"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2.5 1H9.5C9.77614 1 10 1.22386 10 1.5V10.5C10 10.7761 9.77614 11 9.5 11H2.5C2.22386 11 2 10.7761 2 10.5V1.5C2 1.22386 2.22386 1 2.5 1Z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 3H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M4 5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M4 7H6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>Save</span>
        </button>

        {/* Cross-post */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAction('crosspost', onCrossPost);
          }}
          className="flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[10px] text-[var(--color-muted)] hover:text-purple-400 hover:bg-purple-500/5 transition-colors focus:outline-none"
          aria-label="Cross-post to other protocols"
          title="Share to Nostr, Farcaster, Bluesky, Mastodon"
        >
          <span>{'\uD83D\uDCE3'}</span>
          <span>Cross-post</span>
        </button>
      </div>
    </article>
  );
});

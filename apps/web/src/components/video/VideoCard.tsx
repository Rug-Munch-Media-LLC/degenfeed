'use client';

/**
 * @degenfeed/web — VideoCard
 *
 * Thumbnail card with title, duration badge, source badge, channel info,
 * and view count. Used in horizontal scrollable rows and grid layouts.
 * Hover reveals a play button overlay.
 *
 * Multi-platform aggregator aware:
 * - Color-coded source badge (YouTube/Invidious, Twitch, Rumble, PeerTube, Zora)
 * - Creator platform presence indicators
 * - "Follow on All Platforms" action
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { VideoSourceBadge } from './VideoSourceBadge';
import { CreatorPresence } from './CreatorPresence';
import type { UnifiedVideo, CreatorProfile } from './useVideoHub';

interface VideoCardProps {
  video: UnifiedVideo;
  size?: 'sm' | 'md' | 'lg';
  onPlay?: (video: UnifiedVideo) => void;
  onSave?: (video: UnifiedVideo) => void;
  onFollow?: (creatorId: string) => void;
  onUnfollow?: (creatorId: string) => void;
  isFollowing?: boolean;
  showChannel?: boolean;
  showCreatorPresence?: boolean;
  className?: string;
}

export function VideoCard({
  video,
  size = 'md',
  onPlay,
  onSave,
  onFollow,
  onUnfollow,
  isFollowing = false,
  showChannel = true,
  showCreatorPresence = true,
  className = '',
}: VideoCardProps) {
  const [hovered, setHovered] = useState(false);

  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPlay?.(video);
    },
    [video, onPlay],
  );

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSave?.(video);
    },
    [video, onSave],
  );

  const sizeConfig = {
    sm: {
      card: 'w-48',
      thumbnail: 'aspect-video',
      title: 'text-xs',
      channel: 'text-[10px]',
      meta: 'text-[10px]',
      avatarSize: 'h-6 w-6',
    },
    md: {
      card: 'w-64',
      thumbnail: 'aspect-video',
      title: 'text-sm',
      channel: 'text-xs',
      meta: 'text-[10px]',
      avatarSize: 'h-7 w-7',
    },
    lg: {
      card: 'w-80',
      thumbnail: 'aspect-video',
      title: 'text-base',
      channel: 'text-sm',
      meta: 'text-xs',
      avatarSize: 'h-8 w-8',
    },
  };

  const cfg = sizeConfig[size];

  // Build a mini creator profile from video data if platforms exist
  const miniCreator: CreatorProfile | null =
    video.creatorPlatforms && video.creatorPlatforms.length > 0
      ? {
          id: video.channelId,
          name: video.channelName,
          avatar: video.channelAvatar,
          platforms: video.creatorPlatforms,
          totalFollowers: video.creatorPlatforms.reduce(
            (sum, p) => sum + (p.subscriberCount ?? p.followerCount),
            0,
          ),
        }
      : null;

  return (
    <Link
      href={`/video/${video.id}`}
      className={`group ${cfg.card} shrink-0 cursor-pointer ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className={`relative ${cfg.thumbnail} mb-2 overflow-hidden rounded-xl bg-[var(--color-card)]`}>
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Duration badge */}
        {video.durationLabel && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
            {video.durationLabel}
          </span>
        )}

        {/* Live indicator */}
        {video.isLive && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        )}

        {/* Source badge (top-left, not shown when live) */}
        {!video.isLive && (
          <div className="absolute left-1.5 top-1.5">
            <VideoSourceBadge source={video.source} size="sm" />
          </div>
        )}

        {/* Play overlay on hover */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-200 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={handlePlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-lg transition-transform hover:scale-110"
            aria-label={`Play ${video.title}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-2">
        {showChannel && video.channelAvatar && (
          <img
            src={video.channelAvatar}
            alt={video.channelName}
            className={`${cfg.avatarSize} mt-0.5 shrink-0 rounded-full bg-[var(--color-card)]`}
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3
            className={`${cfg.title} font-semibold text-[var(--color-fg)] leading-tight line-clamp-2 group-hover:text-degen-400 transition-colors`}
            title={video.title}
          >
            {video.title}
          </h3>

          {showChannel && (
            <p className={`${cfg.channel} mt-0.5 text-[var(--color-muted)] truncate`}>
              {video.channelName}
            </p>
          )}

          <div className={`${cfg.meta} flex items-center gap-2 text-[var(--color-muted)]`}>
            <span>{formatViews(video.views)} views</span>
            <span>·</span>
            <span>{video.publishedLabel}</span>
          </div>

          {/* Creator platform presence (compact) */}
          {showCreatorPresence && miniCreator && (
            <div className="mt-1.5">
              <CreatorPresence
                creator={miniCreator}
                compact
                isFollowing={isFollowing}
                onFollow={onFollow}
                onUnfollow={onUnfollow}
              />
            </div>
          )}
        </div>

        {/* Save button */}
        {onSave && (
          <button
            type="button"
            onClick={handleSave}
            className="shrink-0 self-start rounded-lg p-1 text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-fg)] group-hover:opacity-100"
            aria-label="Save video"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

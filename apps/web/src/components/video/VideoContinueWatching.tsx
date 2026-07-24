'use client';

/**
 * @degenfeed/web — VideoContinueWatching
 *
 * Recently watched / continue watching row.
 * Reads from localStorage to show the user's in-progress videos.
 * Only renders if there are items stored.
 */

import { useCallback } from 'react';
import type { UnifiedVideo } from './useVideoHub';
import { useContinueWatching } from './useVideoHub';
import { VideoRow } from './VideoRow';

interface VideoContinueWatchingProps {
  onPlay?: (video: UnifiedVideo) => void;
  maxItems?: number;
}

export function VideoContinueWatching({ onPlay, maxItems = 10 }: VideoContinueWatchingProps) {
  const { items, removeItem } = useContinueWatching();

  const handlePlay = useCallback(
    (video: UnifiedVideo) => {
      onPlay?.(video);
    },
    [onPlay],
  );

  const _handleDismiss = useCallback(
    (videoId: string) => {
      removeItem(videoId);
    },
    [removeItem],
  );

  if (items.length === 0) return null;

  // Convert ContinueWatchingItem to UnifiedVideo-like shape for VideoRow
  const continueVideos: UnifiedVideo[] = items.slice(0, maxItems).map((item) => ({
    id: item.videoId,
    title: item.title,
    description: '',
    thumbnailUrl: item.thumbnailUrl,
    videoUrl: '',
    duration: item.duration,
    durationLabel: formatDuration(item.duration),
    source: item.source as UnifiedVideo['source'],
    sourceLabel: item.source,
    sourceColor: '#888',
    channelName: item.channelName,
    publishedAt: item.watchedAt,
    publishedLabel: timeAgo(item.watchedAt),
    views: 0,
    category: 'all',
    channelId: '',
    tags: [],
    isLive: false,
  }));

  return (
    <div className="relative">
      {/* Progress bar row indicator */}
      <VideoRow
        title="Continue Watching"
        videos={continueVideos}
        size="md"
        onPlay={handlePlay}
        showChannel={false}
      />

      {/* Dismiss button per item — rendered via overlay on cards would need separate approach */}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

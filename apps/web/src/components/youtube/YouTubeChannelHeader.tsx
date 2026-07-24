'use client';

/**
 * @degenfeed/web — YouTubeChannelHeader
 *
 * Channel info banner for YouTube creator pages.
 * Shows avatar, channel name, subscriber count, and video count.
 * YouTube content is clearly labeled.
 */

import { memo } from 'react';
import { formatYouTubeCount } from './useYouTube';
import { YouTubeSourceBadge } from './YouTubeSourceBadge';

// === Types ===============================================================

export interface YouTubeChannelData {
  name: string;
  channelId: string;
  avatar: string;
  subscriberCount: number;
  videoCount: number;
}

export interface YouTubeChannelHeaderProps {
  channel: YouTubeChannelData;
  /** Whether the creator has DegenFeed tipping enabled */
  canTip?: boolean;
  /** Called when user clicks subscribe / follow */
  onSubscribe?: (channelId: string) => void;
  /** Called when user clicks tip */
  onTip?: (channelId: string) => void;
  /** Is the user subscribed */
  isSubscribed?: boolean;
}

// === Component ===========================================================

export const YouTubeChannelHeader = memo(function YouTubeChannelHeader({
  channel,
  canTip = false,
  onSubscribe,
  onTip,
  isSubscribed = false,
}: YouTubeChannelHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
      {/* Avatar */}
      <div className="h-16 w-16 md:h-20 md:w-20 rounded-full overflow-hidden bg-[var(--color-overlay)] flex-shrink-0 border-2 border-red-500/20">
        {channel.avatar ? (
          // biome-ignore lint/performance/noImgElement: channel avatar
          <img
            src={channel.avatar}
            alt={channel.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xl font-bold text-[var(--color-muted)]">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg md:text-xl font-bold text-[var(--color-fg)] truncate">
            {channel.name}
          </h1>
          <YouTubeSourceBadge source="youtube" size="sm" />
        </div>

        <div className="mt-1 flex items-center gap-3 text-sm text-[var(--color-muted)]">
          {channel.subscriberCount > 0 && (
            <span>{formatYouTubeCount(channel.subscriberCount)} subscribers</span>
          )}
          <span>{channel.videoCount} videos</span>
          <span className="text-[10px] text-red-400/60">YouTube</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
        {onSubscribe && (
          <button
            type="button"
            onClick={() => onSubscribe(channel.channelId)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
              isSubscribed
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-600/20'
            }`}
          >
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}
        {canTip && onTip && (
          <button
            type="button"
            onClick={() => onTip(channel.channelId)}
            className="rounded-lg px-4 py-2 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            {'\u26A1'} Tip
          </button>
        )}
      </div>
    </div>
  );
});

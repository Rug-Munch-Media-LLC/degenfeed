'use client';

/**
 * @degenfeed/web — CreatorPresence
 *
 * Shows a creator's presence across all aggregated platforms:
 * YouTube (via Invidious), Twitch, Rumble, PeerTube, Zora.
 * Displays platform-specific follower/subscriber/NFT counts and
 * a "Follow on All Platforms" action.
 *
 * Designed for use in VideoCard hover details, creator detail pages,
 * and the trending feed.
 */

import { useCallback, useState } from 'react';
import type { CreatorPlatform, CreatorProfile } from './useVideoHub';
import { VideoSourceBadge } from './VideoSourceBadge';

// ─── Platform display config ─────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; metric: string; icon: string }> = {
  youtube: { label: 'YouTube', metric: 'subs', icon: '▶' },
  twitch: { label: 'Twitch', metric: 'followers', icon: '📺' },
  rumble: { label: 'Rumble', metric: 'followers', icon: '🔴' },
  peertube: { label: 'PeerTube', metric: 'followers', icon: '📼' },
  zora: { label: 'Zora', metric: 'NFTs', icon: '🔷' },
};

interface CreatorPresenceProps {
  creator: CreatorProfile;
  onFollow?: (creatorId: string) => void;
  onUnfollow?: (creatorId: string) => void;
  isFollowing?: boolean;
  compact?: boolean;
  className?: string;
}

export function CreatorPresence({
  creator,
  onFollow,
  onUnfollow,
  isFollowing = false,
  compact = false,
  className = '',
}: CreatorPresenceProps) {
  const [followLoading, setFollowLoading] = useState(false);

  const handleFollowToggle = useCallback(async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await onUnfollow?.(creator.id);
      } else {
        await onFollow?.(creator.id);
      }
    } catch {
      // Error handled upstream
    } finally {
      setFollowLoading(false);
    }
  }, [creator.id, isFollowing, onFollow, onUnfollow, followLoading]);

  // ── Compact inline variant (for VideoCard) ──────────────────────────

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Mini platform dots */}
        <div className="flex -space-x-1">
          {creator.platforms.slice(0, 5).map((p) => (
            <span
              key={p.platform}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-bg)] text-[9px]"
              style={{
                backgroundColor: getPlatformBg(p.platform),
                color: getPlatformColor(p.platform),
                borderColor: getPlatformBorder(p.platform),
              }}
              title={`${getPlatformLabel(p.platform)}: ${formatCount(getFollowerCount(p))}`}
            >
              {getPlatformEmoji(p.platform)}
            </span>
          ))}
        </div>

        {creator.platforms.length > 1 && (
          <span className="text-[10px] text-[var(--color-muted)]">
            {creator.platforms.length} platforms
          </span>
        )}

        {creator.platforms.length > 1 && (
          <button
            type="button"
            onClick={handleFollowToggle}
            disabled={followLoading}
            className="ml-auto rounded-md border border-degen-500/30 px-2 py-0.5 text-[10px] font-medium text-degen-400 transition-colors hover:bg-degen-500/10 disabled:opacity-50"
          >
            {followLoading ? '•••' : isFollowing ? 'Following' : 'Follow All'}
          </button>
        )}
      </div>
    );
  }

  // ── Full card variant ───────────────────────────────────────────────

  return (
    <div
      className={`rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        {creator.avatar ? (
          <img
            src={creator.avatar}
            alt={creator.name}
            className="h-10 w-10 rounded-full bg-[var(--color-bg)] object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/20 text-degen-400 text-lg font-bold">
            {creator.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-fg)] truncate">
            {creator.name}
          </p>
          <p className="text-[11px] text-[var(--color-muted)]">
            {formatCount(creator.totalFollowers)} total followers
          </p>
        </div>

        {/* Follow button */}
        <button
          type="button"
          onClick={handleFollowToggle}
          disabled={followLoading}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
            isFollowing
              ? 'border-degen-500/30 text-degen-400 hover:bg-degen-500/10'
              : 'border-degen-500 bg-degen-500 text-black hover:bg-degen-400'
          } disabled:opacity-50`}
        >
          {followLoading ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isFollowing ? (
            'Following'
          ) : (
            'Follow on All Platforms'
          )}
        </button>
      </div>

      {/* Description */}
      {creator.description && (
        <p className="mb-3 text-xs text-[var(--color-muted)] line-clamp-2">
          {creator.description}
        </p>
      )}

      {/* Platform presence list */}
      <div className="space-y-1.5">
        {creator.platforms.map((p) => (
          <CreatorPlatformRow key={p.platform} platform={p} />
        ))}
      </div>
    </div>
  );
}

// ─── Platform row sub-component ──────────────────────────────────────────

function CreatorPlatformRow({ platform }: { platform: CreatorPlatform }) {
  const meta = PLATFORM_META[platform.platform] ?? {
    label: platform.platform,
    metric: 'followers',
    icon: '•',
  };

  const followerCount = getFollowerCount(platform);

  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-bg)]"
    >
      <VideoSourceBadge
        source={platform.platform as CreatorPresenceProps['creator']['platforms'][0]['platform']}
        size="sm"
        showLabel={false}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-[var(--color-fg)]">
        @{platform.handle}
      </span>
      <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
        {formatCount(followerCount)} {meta.metric}
      </span>
      {platform.nftCount !== undefined && platform.nftCount > 0 && (
        <span className="shrink-0 text-[10px] text-blue-400">
          {platform.nftCount} NFTs
        </span>
      )}
    </a>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getFollowerCount(p: CreatorPlatform): number {
  return p.subscriberCount ?? p.followerCount;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getPlatformLabel(platform: string): string {
  return PLATFORM_META[platform]?.label ?? platform;
}

function getPlatformBg(platform: string): string {
  const bg: Record<string, string> = {
    youtube: 'rgba(239,68,68,0.15)',
    twitch: 'rgba(168,85,247,0.15)',
    rumble: 'rgba(16,185,129,0.15)',
    peertube: 'rgba(249,115,22,0.15)',
    zora: 'rgba(59,130,246,0.15)',
  };
  return bg[platform] ?? 'rgba(255,255,255,0.1)';
}

function getPlatformColor(platform: string): string {
  const c: Record<string, string> = {
    youtube: '#f87171',
    twitch: '#a855f7',
    rumble: '#34d399',
    peertube: '#fb923c',
    zora: '#60a5fa',
  };
  return c[platform] ?? '#999';
}

function getPlatformBorder(platform: string): string {
  const c: Record<string, string> = {
    youtube: 'rgba(239,68,68,0.3)',
    twitch: 'rgba(168,85,247,0.3)',
    rumble: 'rgba(16,185,129,0.3)',
    peertube: 'rgba(249,115,22,0.3)',
    zora: 'rgba(59,130,246,0.3)',
  };
  return c[platform] ?? 'rgba(255,255,255,0.2)';
}

function getPlatformEmoji(platform: string): string {
  const e: Record<string, string> = {
    youtube: '▶',
    twitch: '📺',
    rumble: '🔴',
    peertube: '📼',
    zora: '◆',
  };
  return e[platform] ?? '•';
}

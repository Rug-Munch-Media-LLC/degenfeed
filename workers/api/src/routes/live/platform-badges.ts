/**
 * @degenfeed/api-worker — Cross-Platform Live Feed Badges
 *
 * Renders platform badge metadata for live streams in the DegenFeed live feed.
 * Each badge shows which platform(s) a stream originates from and
 * which platforms it's simulcast to.
 *
 * Used by the frontend to show "Also watching on" indicators.
 */

import type { LiveSource, UnifiedLiveStream } from '../../feed/live-aggregator';

export interface PlatformBadge {
  id: string;
  label: string;
  emoji: string;
  color: string;
  url?: string;
  viewerCount?: number;
}

const PLATFORM_BADGE_MAP: Record<string, PlatformBadge> = {
  loops: {
    id: 'loops',
    label: 'Loops Live',
    emoji: '🔄',
    color: '#ff0050',
  },
  degenfeed: {
    id: 'degenfeed',
    label: 'DegenFeed',
    emoji: '🔄',
    color: '#ff0050',
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    emoji: '📱',
    color: '#855dfd',
  },
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    emoji: '⚡',
    color: '#00c875',
  },
  owncast: {
    id: 'owncast',
    label: 'Owncast',
    emoji: '📡',
    color: '#1473e6',
  },
  peertube: {
    id: 'peertube',
    label: 'PeerTube',
    emoji: '🎥',
    color: '#f1680d',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    emoji: '▶️',
    color: '#ff0000',
  },
  twitch: {
    id: 'twitch',
    label: 'Twitch',
    emoji: '📺',
    color: '#9146ff',
  },
  kick: {
    id: 'kick',
    label: 'Kick',
    emoji: '🎲',
    color: '#53fc18',
  },
  spaces: {
    id: 'spaces',
    label: 'Spaces',
    emoji: '🎙️',
    color: '#1d9bf0',
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    emoji: '🔮',
    color: '#abfe2c',
  },
  zora: {
    id: 'zora',
    label: 'Zora',
    emoji: '✨',
    color: '#fff',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    emoji: '☁️',
    color: '#0085ff',
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    emoji: '🐘',
    color: '#6364ff',
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    emoji: '✈️',
    color: '#0088cc',
  },
};

/**
 * Get the badge for a given platform ID.
 */
export function getPlatformBadge(platformId: string): PlatformBadge | undefined {
  return PLATFORM_BADGE_MAP[platformId];
}

/**
 * Extract platform badges for a unified live stream.
 * Returns:
 *   - primaryBadge: the main source platform badge
 *   - simulcastBadges: platforms this stream is also broadcast to
 *   - platformFilterList: all unique platforms for filtering
 */
export function extractPlatformBadges(stream: UnifiedLiveStream): {
  primaryBadge: PlatformBadge;
  simulcastBadges: PlatformBadge[];
  platformFilterList: string[];
} {
  const primaryBadge = getPlatformBadge(stream.source) || {
    id: stream.source,
    label: stream.source,
    emoji: '🌐',
    color: '#666',
  };

  // Collect simulcast sources
  const simulcastBadges: PlatformBadge[] = [];

  if (stream.simulcastSources) {
    for (const src of stream.simulcastSources) {
      const badge = getPlatformBadge(src);
      if (badge) {
        simulcastBadges.push(badge);
      }
    }
  }

  // Also check platformMeta for broadcastPlatforms (from Loops)
  const broadcastPlatforms = (stream.platformMeta as Record<string, unknown>)?.broadcastPlatforms as
    | string[]
    | undefined;
  if (broadcastPlatforms) {
    for (const p of broadcastPlatforms) {
      if (p !== stream.source && !simulcastBadges.find((b) => b.id === p)) {
        const badge = getPlatformBadge(p);
        if (badge) {
          simulcastBadges.push(badge);
        }
      }
    }
  }

  // Build filter list
  const platformFilterList = [
    stream.source,
    ...simulcastBadges.map((b) => b.id),
    ...(broadcastPlatforms || []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return { primaryBadge, simulcastBadges, platformFilterList };
}

/**
 * Get all available platform badges for the filter UI.
 */
export function getAllPlatformBadges(): PlatformBadge[] {
  return Object.values(PLATFORM_BADGE_MAP);
}

/**
 * Generate a source label for the live feed UI.
 * Format: "Loops Live · Also on Farcaster, Nostr"
 */
export function generateSourceLabel(stream: UnifiedLiveStream): string {
  const { primaryBadge, simulcastBadges } = extractPlatformBadges(stream);

  if (simulcastBadges.length === 0) {
    return primaryBadge.label;
  }

  const simulcastLabels = simulcastBadges.slice(0, 3).map((b) => b.label);

  const remainder = simulcastBadges.length - 3;
  if (remainder > 0) {
    simulcastLabels.push(`+${remainder} more`);
  }

  return `${primaryBadge.label} · Also on ${simulcastLabels.join(', ')}`;
}

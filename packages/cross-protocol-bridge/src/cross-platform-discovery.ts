/**
 * @degenfeed/cross-protocol-bridge — Cross-Platform Discovery
 *
 * "Also Available On" — every short/live shows which platforms it's
 * available on. Platform pills with native URLs, follow buttons, and
 * aggregated cross-platform follower counts.
 *
 * This module generates the data needed by the UI to render:
 *   - Platform availability pills ("Also on Farcaster, Nostr, Bluesky")
 *   - Click-to-view links for each platform
 *   - Follow-on-platform buttons
 *   - Cross-platform follower count
 *
 * It consumes the batch results from `shorts-publisher.ts` and
 * `live-publisher.ts` and enriches them with display metadata.
 */

import type { Protocol } from '@degenfeed/types';
import type { ShortsPublishBatchResult } from './shorts-publisher';
import type { LivePublishBatchResult } from './live-publisher';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PlatformPill {
  /** Protocol identifier */
  protocol: string;
  /** Human-readable label */
  label: string;
  /** Protocol icon (emoji or icon name) */
  icon: string;
  /** Brand color for the pill */
  color: string;
  /** Native URL to the content on this platform */
  url: string;
  /** Whether the user can follow the creator on this platform */
  canFollow: boolean;
  /** Follow URL (platform-native follow link) */
  followUrl?: string;
  /** Creator's handle on this platform */
  creatorHandle?: string;
  /** Whether this is the original source */
  isOriginal: boolean;
}

export interface CrossPlatformAvailability {
  /** All platform pills */
  platforms: PlatformPill[];
  /** Total number of platforms available */
  totalPlatforms: number;
  /** Summary text: "Also on Farcaster, Nostr, and 3 more" */
  summaryText: string;
  /** Short summary: "+3 more" */
  shortSummary: string;
  /** Cross-platform follower count */
  crossPlatformFollowers: number;
  /** Whether the content is available on more than 1 platform */
  isCrossPlatform: boolean;
}

export interface PlatformProfileSnapshot {
  /** Creator's handle on this platform */
  protocol: Protocol;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  followerCount: number;
  followingCount: number;
  /** Platform-specific profile URL */
  profileUrl: string;
  /** Whether the platform is linked/verified */
  linked: boolean;
}

export interface CrossPlatformProfile {
  /** Creator's DegenFeed display name */
  displayName: string;
  /** Creator's DegenFeed ID */
  dfId: string;
  /** All linked platform profiles */
  profiles: PlatformProfileSnapshot[];
  /** Total followers across all platforms */
  totalFollowers: number;
  /** Combined follower count text: "12.4K across 4 platforms" */
  followerSummaryText: string;
  /** Number of linked platforms */
  platformCount: number;
}

// ─── Protocol Display Metadata ────────────────────────────────────────────

const ALL_PROTOCOL_META: Record<string, { label: string; icon: string; color: string }> = {
  loops: { label: 'Loops', icon: 'Loops', color: '#F1680D' },
  nostr: { label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  farcaster: { label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#1185fe' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  lens: { label: 'Lens', icon: '🌿', color: '#abfe2c' },
  peertube: { label: 'PeerTube', icon: '▶️', color: '#f2691d' },
  pixelfed: { label: 'Pixelfed', icon: '📷', color: '#f2691d' },
  telegram: { label: 'Telegram', icon: '✈️', color: '#0088cc' },
  owncast: { label: 'Owncast', icon: '📡', color: '#e9591d' },
  discord: { label: 'Discord', icon: '💬', color: '#5865f2' },
};

// Which platforms support following from DegenFeed
const FOLLOWABLE_PLATFORMS: Protocol[] = ['farcaster', 'nostr', 'bluesky', 'mastodon', 'lens', 'peertube', 'pixelfed'];

// ─── Main Discovery Functions ─────────────────────────────────────────────

/**
 * Build cross-platform availability data from a shorts publish batch result.
 * Used to render the "Also Available On" platform pills in the UI.
 */
export function buildShortsAvailability(
  batchResult: ShortsPublishBatchResult,
  originalSource: string = 'loops',
): CrossPlatformAvailability {
  const pills: PlatformPill[] = [];

  // Add the original source (Loops)
  const loopsMeta = ALL_PROTOCOL_META[originalSource];
  if (loopsMeta) {
    pills.push({
      protocol: originalSource as Protocol,
      label: loopsMeta.label,
      icon: loopsMeta.icon,
      color: loopsMeta.color,
      url: '',
      canFollow: false,
      isOriginal: true,
    });
  }

  // Add succeeded publishers as platform pills
  for (const result of batchResult.results) {
    if (!result.success || !result.url) continue;
    const meta = ALL_PROTOCOL_META[result.protocol];
    if (!meta) continue;

    pills.push({
      protocol: result.protocol as Protocol,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      url: result.url,
      canFollow: (FOLLOWABLE_PLATFORMS as string[]).includes(result.protocol),
      isOriginal: false,
    });
  }

  const totalPlatforms = pills.length;
  const summaryText = buildSummaryText(pills);
  const shortSummary = buildShortSummary(pills, originalSource);

  return {
    platforms: pills,
    totalPlatforms,
    summaryText,
    shortSummary,
    crossPlatformFollowers: 0, // Filled in by enrichWithFollowerCounts
    isCrossPlatform: totalPlatforms > 1,
  };
}

/**
 * Build cross-platform availability data from a live publish batch result.
 */
export function buildLiveAvailability(
  batchResult: LivePublishBatchResult,
  originalSource: string = 'loops',
): CrossPlatformAvailability {
  const pills: PlatformPill[] = [];

  const loopsMeta = ALL_PROTOCOL_META[originalSource];
  if (loopsMeta) {
    pills.push({
      protocol: originalSource,
      label: loopsMeta.label,
      icon: loopsMeta.icon,
      color: loopsMeta.color,
      url: '',
      canFollow: false,
      isOriginal: true,
    });
  }

  for (const result of batchResult.results) {
    if (!result.success) continue;
    const watchUrl = result.watchUrl || result.url;
    if (!watchUrl) continue;
    const meta = ALL_PROTOCOL_META[result.protocol];
    if (!meta) continue;

    pills.push({
      protocol: result.protocol as Protocol,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      url: watchUrl,
      canFollow: (FOLLOWABLE_PLATFORMS as string[]).includes(result.protocol),
      isOriginal: false,
    });
  }

  const totalPlatforms = pills.length;
  const summaryText = buildSummaryText(pills);
  const shortSummary = buildShortSummary(pills, originalSource);

  return {
    platforms: pills,
    totalPlatforms,
    summaryText,
    shortSummary,
    crossPlatformFollowers: 0,
    isCrossPlatform: totalPlatforms > 1,
  };
}

/**
 * Build a cross-platform profile for a creator from linked identities.
 * Returns aggregated follower counts and platform profile snapshots.
 */
export async function buildCrossPlatformProfile(
  linkedIdentities: Array<{
    protocol: Protocol;
    id: string;
    handle: string;
    displayName?: string;
    avatarUrl?: string;
    followerCount?: number;
    followingCount?: number;
    profileUrl?: string;
    verified: boolean;
  }>,
): Promise<CrossPlatformProfile> {
  // Find the primary identity
  const primary =
    linkedIdentities.find((i) => String(i.protocol) === 'loops') ||
    linkedIdentities[0] ||
    null;

  const profiles: PlatformProfileSnapshot[] = linkedIdentities.map((identity) => ({
    protocol: identity.protocol,
      handle: identity.handle,
      displayName: identity.displayName || identity.handle,
      avatarUrl: identity.avatarUrl,
      followerCount: identity.followerCount ?? 0,
      followingCount: identity.followingCount ?? 0,
      profileUrl:
        identity.profileUrl ||
        buildProfileUrl(identity.protocol, identity.handle, identity.id),
      linked: identity.verified,
    }));


  const totalFollowers = profiles.reduce((sum, p) => sum + p.followerCount, 0);
  const platformCount = profiles.length;

  return {
    displayName: primary?.displayName || primary?.handle || 'Creator',
    dfId: primary?.id || '',
    profiles,
    totalFollowers,
    followerSummaryText: formatFollowerCount(totalFollowers, platformCount),
    platformCount,
  };
}

/**
 * Enrich platform pills with actual follower counts from each protocol.
 * Called after the pills are created to add real numbers.
 */
export async function enrichWithFollowerCounts(
  pills: PlatformPill[],
  creatorHandles: Record<string, string>,
  _env: { [key: string]: string },
): Promise<PlatformPill[]> {
  const enriched = [...pills];

  for (let i = 0; i < enriched.length; i++) {
    const pill = enriched[i];
    if (!pill || !pill.canFollow) continue;

    const handle = creatorHandles[pill.protocol];
    if (!handle) continue;

    // Build follow URL based on platform
    const followUrl = buildFollowUrl(pill.protocol, handle);
    if (followUrl) {
      enriched[i] = { ...pill, followUrl, creatorHandle: handle };
    }
  }

  return enriched;
}

// ─── Summary Text Builders ────────────────────────────────────────────────

/**
 * Build a human-readable "Also on X, Y, and Z" summary.
 */
function buildSummaryText(pills: PlatformPill[]): string {
  if (pills.length <= 1) return `Only on ${pills[0]?.label || 'Loops'}`;

  const nonOriginal = pills.filter((p) => !p.isOriginal);
  if (nonOriginal.length === 0) return 'Available on Loops';

  const labels = nonOriginal.map((p) => p.label);
  if (labels.length === 1) return `Also on ${labels[0]}`;
  if (labels.length === 2) return `Also on ${labels[0]} and ${labels[1]}`;

  const last = labels.pop() || '';
  return `Also on ${labels.join(', ')}, and ${last}`;
}

/**
 * Build a short "+N more" summary.
 */
function buildShortSummary(pills: PlatformPill[], _originalSource: string): string {
  const nonOriginal = pills.filter((p) => !p.isOriginal);
  if (nonOriginal.length === 0) return '';
  if (nonOriginal.length <= 2) {
    return nonOriginal.map((p) => p.label).join(', ');
  }
  return `+${nonOriginal.length} more`;
}

/**
 * Format follower count with platform diversity.
 */
function formatFollowerCount(total: number, platformCount: number): string {
  const formatted = total >= 1000
    ? `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)}K`
    : String(total);
  return `${formatted} across ${platformCount} ${platformCount === 1 ? 'platform' : 'platforms'}`;
}

// ─── URL Builders ─────────────────────────────────────────────────────────

function buildProfileUrl(protocol: string, handle: string, _id: string): string {
  switch (protocol) {
    case 'farcaster':
      return `https://warpcast.com/${handle}`;
    case 'nostr':
      return `https://snort.social/p/${handle}`;
    case 'bluesky':
      return `https://bsky.app/profile/${handle}`;
    case 'mastodon':
      return handle.includes('@')
        ? `https://${handle.split('@')[1]}/@${handle.split('@')[0]}`
        : `https://social.degenfeed.xyz/@${handle}`;
    case 'lens':
      return `https://hey.xyz/u/${handle}`;
    case 'peertube':
      return `https://video.degenfeed.xyz/accounts/${handle}`;
    case 'pixelfed':
      return `https://pixelfed.social/${handle}`;
    case 'telegram':
      return `https://t.me/${handle}`;
    default:
      return '';
  }
}

function buildFollowUrl(protocol: Protocol, handle: string): string | undefined {
  switch (protocol) {
    case 'farcaster':
      return `https://warpcast.com/${handle}`;
    case 'nostr':
      return `https://snort.social/p/${handle}`;
    case 'bluesky':
      return `https://bsky.app/profile/${handle}`;
    case 'mastodon':
      return handle.includes('@')
        ? `https://${handle.split('@')[1]}/@${handle.split('@')[0]}`
        : undefined;
    case 'lens':
      return `https://hey.xyz/u/${handle}`;
    case 'peertube':
      return `https://video.degenfeed.xyz/accounts/${handle}/subscriptions`;
    case 'pixelfed':
      return `https://pixelfed.social/i/web/profile/${handle}`;
    default:
      return undefined;
  }
}

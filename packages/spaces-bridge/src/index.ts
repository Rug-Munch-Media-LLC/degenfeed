/**
 * @degenfeed/spaces-bridge — Unified Cross-Platform Spaces Aggregator
 *
 * Aggregates live content from ALL supported platforms into a single
 * unified feed. Handles create/read/update/end across all bridges.
 *
 * CONTENT TYPES:
 *   Audio Spaces  → Voice-based rooms (Twitter Spaces clone)
 *   Live Video    → Video streams (YouTube, Twitch, Kick)
 *   Live Photos   → Ephemeral photo sharing (stories-like)
 *   Announcements → Social posts when content goes live
 *
 * SUPPORTED PLATFORMS:
 *   ┌─────────────────┬──────────┬──────────────┐
 *   │ Platform        │ Type     │ Status       │
 *   ├─────────────────┼──────────┼──────────────┤
 *   │ Nostr NIP-53    │ Audio    │ ✅ Deployed  │
 *   │ PeerTube        │ Audio    │ ✅ Deployed  │
 *   │ Owncast         │ Audio    │ ✅ Deployed  │
 *   │ LivePeer        │ Audio    │ ✅ Deployed  │
 *   │ YouTube Live    │ Video    │ 🆕 Added     │
 *   │ Twitch          │ Video    │ 🆕 Added     │
 *   │ Kick            │ Video    │ 🆕 Added     │
 *   │ Nostr Pictures  │ Photos   │ 🆕 Added     │
 *   │ Pixelfed        │ Photos   │ 🆕 Added     │
 *   │ Farcaster       │ Announce │ 🆕 Added     │
 *   │ Lens            │ Announce │ 🆕 Added     │
 *   │ Bluesky         │ Announce │ 🆕 Added     │
 *   │ Mastodon        │ Announce │ 🆕 Added     │
 *   │ Discord         │ Announce │ 🆕 Added     │
 *   │ Telegram        │ Announce │ 🆕 Added     │
 *   │ Twitter/X       │ Announce │ 🆕 Added     │
 *   └─────────────────┴──────────┴──────────────┘
 *
 * Usage:
 *   import { spacesAggregator } from '@degenfeed/spaces-bridge';
 *
 *   // Get all live content
 *   const items = await getLiveSpaces({ platforms: ['nostr', 'youtube'] });
 *
 *   // Announce a space on social platforms
 *   await announceSpace(space, ['farcaster', 'bluesky']);
 */

import { announceSpace, getAnnounceBridge, getConfiguredAnnouncePlatforms } from './announce';
import { kickBridge } from './kick';
import { livepeerBridge } from './livepeer';
import { livePhotosBridge } from './livephotos';
import { nostrBridge } from './nostr';
import { owncastBridge } from './owncast';
import { peertubeBridge } from './peertube';
import { checkAllGates } from './premium';
import { twitchBridge } from './twitch';
import type {
  AnnouncePlatform,
  CreateSpaceOptions,
  CreateSpaceResult,
  PlatformBridge,
  SpaceAnnouncement,
  SpaceContentType,
  SpaceItem,
  SpacePlatform,
} from './types';
import { youTubeBridge } from './youtube';

// ─── Exports ─────────────────────────────────────────────────────────────

export {
  announceSpace,
  getAnnounceBridge,
  getConfiguredAnnouncePlatforms,
} from './announce';
export { checkAllGates, checkTokenGate, getGateLabel } from './premium';

export type {
  AnnouncePlatform,
  CreateSpaceOptions,
  CreateSpaceResult,
  PlatformBridge,
  SpaceAnnouncement,
  SpaceContentType,
  SpaceGating,
  SpaceItem,
  SpacePlatform,
  SpacePlatformData,
  SpaceReaction,
  SpaceSpeaker,
  SpaceStatus,
} from './types';

export {
  kickBridge,
  livePhotosBridge,
  livepeerBridge,
  nostrBridge,
  owncastBridge,
  peertubeBridge,
  twitchBridge,
  youTubeBridge,
};

// ─── Bridge Registry ────────────────────────────────────────────────────

const BRIDGES: Record<SpacePlatform, PlatformBridge> = {
  // Audio
  nostr: nostrBridge,
  peertube: peertubeBridge,
  owncast: owncastBridge,
  livepeer: livepeerBridge,
  // Video
  youtube: youTubeBridge,
  twitch: twitchBridge,
  kick: kickBridge,
  // Photos
  'nostr-pictures': livePhotosBridge,
  'bluesky-photos': livePhotosBridge,
  pixelfed: livePhotosBridge,
  // Announcement platforms (no live spaces to aggregate, but registered for completeness)
  farcaster: null as any,
  lens: null as any,
  bluesky: null as any,
  mastodon: null as any,
  discord: null as any,
  telegram: null as any,
  twitter: null as any,
};

const BRIDGE_PLATFORMS = Object.keys(BRIDGES) as SpacePlatform[];

/**
 * Get the live-space-fetching bridge for a platform.
 * Announce-only platforms (farcaster, lens, etc.) will throw.
 */
export function getBridge(platform: SpacePlatform): PlatformBridge {
  const bridge = BRIDGES[platform];
  if (!bridge) throw new Error(`Unknown platform: ${platform}`);
  if (isAnnouncePlatform(platform)) {
    throw new Error(`${platform} is an announce-only platform — use getAnnounceBridge()`);
  }
  return bridge;
}

function isAnnouncePlatform(platform: string): platform is AnnouncePlatform {
  return ['farcaster', 'lens', 'bluesky', 'mastodon', 'discord', 'telegram', 'twitter'].includes(
    platform,
  );
}

// ─── Content Type Helpers ───────────────────────────────────────────────

const CONTENT_TYPE_MAP: Partial<Record<SpacePlatform, SpaceContentType>> = {
  nostr: 'audio',
  peertube: 'audio',
  owncast: 'audio',
  livepeer: 'audio',
  youtube: 'video',
  twitch: 'video',
  kick: 'video',
  'nostr-pictures': 'photos',
  'bluesky-photos': 'photos',
  pixelfed: 'photos',
};

export function getContentType(platform: SpacePlatform): SpaceContentType {
  return CONTENT_TYPE_MAP[platform] ?? 'announcement';
}

// ─── Aggregator Options ─────────────────────────────────────────────────

export interface AggregatorOptions {
  /** Specific platforms to query (default: all configured) */
  platforms?: SpacePlatform[];
  /** Query timeout per platform (ms, default: 8000) */
  timeout?: number;
  /** Include ended spaces (for history) */
  includeEnded?: boolean;
  /** Filter by content type */
  contentType?: SpaceContentType;
}

// ─── Aggregator ─────────────────────────────────────────────────────────

async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[spaces-aggregator] ${label} timed out`)), timeoutMs),
    ),
  ]);
}

/**
 * Get all live content from all configured platforms.
 * Timeout per platform prevents one failing bridge from blocking the rest.
 */
export async function getLiveSpaces(options?: AggregatorOptions): Promise<SpaceItem[]> {
  const platformList = options?.platforms ?? BRIDGE_PLATFORMS.filter((p) => !isAnnouncePlatform(p));
  const timeout = options?.timeout ?? 8000;
  const results: SpaceItem[] = [];

  const fetches = platformList.map(async (platform) => {
    try {
      const bridge = getBridge(platform);
      const spaces = await fetchWithTimeout(
        bridge.getLiveSpaces(),
        timeout,
        `getLiveSpaces:${platform}`,
      );
      return spaces;
    } catch (e) {
      console.warn(`[spaces-aggregator] ${platform} failed:`, e);
      return [] as SpaceItem[];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  // Deduplicate by ID (last wins)
  const seen = new Map<string, SpaceItem>();
  for (const space of results) {
    seen.set(space.id, space);
  }

  let sorted = [...seen.values()].sort((a, b) => {
    if (a.listeners !== b.listeners) return b.listeners - a.listeners;
    return b.createdAt - a.createdAt;
  });

  // Filter by content type if specified
  if (options?.contentType) {
    sorted = sorted.filter((s) => s.contentType === options.contentType);
  }

  return sorted;
}

/**
 * Create a space on multiple platforms simultaneously.
 * Returns the unified result with per-platform status.
 */
export async function createSpace(options: CreateSpaceOptions): Promise<CreateSpaceResult> {
  const id = `space-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const platformResults: CreateSpaceResult['platformResults'] = [];

  // Separate broadcast platforms from announce-only platforms
  const broadcastPlatforms = options.platforms.filter((p) => !isAnnouncePlatform(p));
  const announcePlatforms = options.platforms.filter((p) =>
    isAnnouncePlatform(p),
  ) as AnnouncePlatform[];

  // Create on broadcast platforms
  await Promise.allSettled(
    broadcastPlatforms.map(async (platform) => {
      try {
        const bridge = getBridge(platform);
        const platformData = await bridge.create({ ...options });
        platformResults.push({
          platform,
          nativeId: platformData.nativeId,
          url: platformData.url,
          streamUrl: platformData.streamUrl,
          chatUrl: platformData.chatUrl,
        });
      } catch (e) {
        platformResults.push({
          platform,
          nativeId: '',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }),
  );

  // Announce on social platforms
  if (announcePlatforms.length > 0) {
    const spaceItem: SpaceItem = {
      id,
      title: options.title,
      description: options.description,
      hostId: options.hostId,
      hostName: options.hostName,
      hostAvatarUrl: options.hostAvatarUrl,
      coHosts: options.coHosts ?? [],
      platforms: platformResults
        .filter((r) => !r.error)
        .map((r) => ({
          platform: r.platform,
          nativeId: r.nativeId,
          url: r.url,
          streamUrl: r.streamUrl,
          chatUrl: r.chatUrl,
        })),
      status: options.scheduledAt ? 'scheduled' : 'live',
      contentType: options.contentType ?? 'audio',
      createdAt: Date.now(),
      scheduledAt: options.scheduledAt,
      listeners: 1,
      speakers: [],
      reactions: [],
      tippingEnabled: options.tippingEnabled ?? true,
      tags: options.tags,
    };

    const announceResults = await announceSpace(spaceItem, announcePlatforms);
    for (const [platform, result] of Object.entries(announceResults)) {
      platformResults.push({
        platform: platform as SpacePlatform,
        nativeId: result.nativeId ?? '',
        url: result.url,
        error: result.ok ? undefined : result.error,
      });
    }
  }

  return { id, platformResults };
}

/**
 * End a space across all its platforms.
 */
export async function endSpace(space: SpaceItem): Promise<void> {
  const platforms = space.platforms.map((p) => p.platform);
  await Promise.allSettled(
    platforms.map(async (platform) => {
      if (isAnnouncePlatform(platform)) return; // Announcements can't be "ended"
      try {
        const bridge = getBridge(platform);
        await bridge.endSpace(space);
      } catch (e) {
        console.warn(`[spaces-aggregator] Failed to end space on ${platform}:`, e);
      }
    }),
  );
}

/**
 * Update space status across all platforms.
 */
export async function updateSpace(space: SpaceItem): Promise<void> {
  await Promise.allSettled(
    space.platforms.map(async (p) => {
      if (isAnnouncePlatform(p.platform)) return;
      try {
        const bridge = getBridge(p.platform);
        await bridge.updateSpace(space);
      } catch (e) {
        console.warn(`[spaces-aggregator] Failed to update space on ${p.platform}:`, e);
      }
    }),
  );
}

/**
 * Get a single space by its ID, searching all platforms.
 */
export async function getSpaceById(id: string): Promise<SpaceItem | null> {
  const prefix = id.split(':')[0] as SpacePlatform;
  if (prefix && BRIDGES[prefix] && !isAnnouncePlatform(prefix)) {
    const nativeId = id.slice(prefix.length + 1);
    try {
      return await BRIDGES[prefix].getSpace(nativeId);
    } catch {
      return null;
    }
  }

  // Fallback: search all bridges
  for (const [, bridge] of Object.entries(BRIDGES)) {
    if (!bridge || !bridge.getLiveSpaces) continue;
    try {
      const spaces = await bridge.getLiveSpaces();
      const found = spaces.find((s) => s.id === id);
      if (found) return found;
    } catch {}
  }
  return null;
}

/**
 * Get listener count for a specific space, checking all platforms.
 */
export async function getListenerCount(space: SpaceItem): Promise<number> {
  let total = space.listeners;
  for (const platform of space.platforms) {
    if (isAnnouncePlatform(platform.platform)) continue;
    try {
      const bridge = getBridge(platform.platform);
      const updated = await bridge.getSpace(platform.nativeId);
      if (updated) total += updated.listeners;
    } catch {
      // Use cached count
    }
  }
  return total;
}

/**
 * Check if a user can access a space (for premium/gated spaces).
 */
export async function canAccessSpace(
  space: SpaceItem,
  userId: string,
  userAddress?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!space.gating || space.gating.type === 'none') {
    return { allowed: true };
  }
  return checkAllGates(userId, userAddress, space.gating);
}

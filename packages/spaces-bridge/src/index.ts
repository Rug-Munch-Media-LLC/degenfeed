/**
 * @degenfeed/spaces-bridge — Unified Cross-Platform Spaces Aggregator
 *
 * Aggregates audio spaces from ALL supported platforms into a single
 * unified feed. Handles create/read/update/end across all bridges.
 *
 * Supported platforms:
 *   - Nostr (NIP-53/Kind 30311 live events)  ← ALREADY DEPLOYED
 *   - PeerTube (audio-only live streams)      ← ALREADY DEPLOYED
 *   - Owncast (self-hosted HLS streaming)     ← ALREADY DEPLOYED ✅
 *   - LivePeer (decentralized video network)  ← Configurable
 *
 * Usage:
 *   import { spacesAggregator } from '@degenfeed/spaces-bridge';
 *
 *   // Get all live spaces
 *   const spaces = await spacesAggregator.getLiveSpaces({ platforms: ['nostr', 'peertube'] });
 *
 *   // Create a space across multiple platforms
 *   const result = await spacesAggregator.create({ ... });
 */

import type {
  CreateSpaceOptions,
  CreateSpaceResult,
  PlatformBridge,
  SpaceItem,
  SpacePlatform,
} from './types';
import { livepeerBridge } from './livepeer';
import { nostrBridge } from './nostr';
import { owncastBridge } from './owncast';
import { peertubeBridge } from './peertube';
import { checkAllGates } from './premium';

// ─── Exports ─────────────────────────────────────────────────────────────

export type {
  CreateSpaceOptions,
  CreateSpaceResult,
  PlatformBridge,
  SpaceGating,
  SpaceItem,
  SpacePlatform,
  SpacePlatformData,
  SpaceReaction,
  SpaceSpeaker,
  SpaceStatus,
} from './types';

export { livepeerBridge, nostrBridge, owncastBridge, peertubeBridge };

export { checkAllGates, checkTokenGate, getGateLabel } from './premium';

// ─── Bridge Registry ────────────────────────────────────────────────────

const BRIDGES: Record<SpacePlatform, PlatformBridge> = {
  nostr: nostrBridge,
  peertube: peertubeBridge,
  owncast: owncastBridge,
  livepeer: livepeerBridge,
};

export function getBridge(platform: SpacePlatform): PlatformBridge {
  const bridge = BRIDGES[platform];
  if (!bridge) throw new Error(`Unknown platform: ${platform}`);
  return bridge;
}

// ─── Aggregator Options ─────────────────────────────────────────────────

export interface AggregatorOptions {
  /** Specific platforms to query (default: all configured) */
  platforms?: SpacePlatform[];
  /** Query timeout per platform (ms, default: 8000) */
  timeout?: number;
  /** Include ended spaces (for history) */
  includeEnded?: boolean;
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
 * Get all live audio spaces from all configured platforms.
 * Timeout per platform prevents one failing bridge from blocking the rest.
 */
export async function getLiveSpaces(options?: AggregatorOptions): Promise<SpaceItem[]> {
  const platforms = options?.platforms ?? (Object.keys(BRIDGES) as SpacePlatform[]);
  const timeout = options?.timeout ?? 8000;
  const results: SpaceItem[] = [];

  const fetches = platforms.map(async (platform) => {
    try {
      const bridge = getBridge(platform);
      const spaces = await fetchWithTimeout(bridge.getLiveSpaces(), timeout, `getLiveSpaces:${platform}`);
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

  // Sort: most listeners first, then most recent
  return [...seen.values()].sort((a, b) => {
    if (a.listeners !== b.listeners) return b.listeners - a.listeners;
    return b.createdAt - a.createdAt;
  });
}

/**
 * Create a space on multiple platforms simultaneously.
 * Returns the unified result with per-platform status.
 */
export async function createSpace(options: CreateSpaceOptions): Promise<CreateSpaceResult> {
  const id = `space-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const platformResults: CreateSpaceResult['platformResults'] = [];

  await Promise.allSettled(
    options.platforms.map(async (platform) => {
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

  return { id, platformResults };
}

/**
 * End a space across all its platforms.
 */
export async function endSpace(space: SpaceItem): Promise<void> {
  const platforms = space.platforms.map((p) => p.platform);
  await Promise.allSettled(
    platforms.map(async (platform) => {
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
  // Parse platform from ID prefix
  const prefix = id.split(':')[0] as SpacePlatform;
  if (prefix && BRIDGES[prefix]) {
    const nativeId = id.slice(prefix.length + 1);
    try {
      return await BRIDGES[prefix].getSpace(nativeId);
    } catch {
      return null;
    }
  }

  // Fallback: search all bridges
  for (const [, bridge] of Object.entries(BRIDGES)) {
    try {
      const spaces = await bridge.getLiveSpaces();
      const found = spaces.find((s) => s.id === id);
      if (found) return found;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Get listener count for a specific space, checking all platforms.
 */
export async function getListenerCount(space: SpaceItem): Promise<number> {
  let total = space.listeners;
  for (const platform of space.platforms) {
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

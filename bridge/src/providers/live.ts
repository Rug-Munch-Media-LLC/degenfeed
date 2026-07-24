/**
 * @degenfeed/bridge — Live Streams Provider
 *
 * Aggregates live streams/spaces from all available platforms
 * for the bridge server's /api/streams/live endpoint.
 */

import type { SpaceItem } from '@degenfeed/spaces-bridge';
import { getLiveSpaces } from '@degenfeed/spaces-bridge';

export interface LiveStreamResult {
  streams: SpaceItem[];
  total: number;
  platforms: string[];
  fetchedAt: number;
}

/**
 * Fetch all live streams/spaces from all platforms.
 * Used by the bridge server's /api/streams/live endpoint.
 */
export async function fetchLiveStreams(): Promise<LiveStreamResult> {
  try {
    const spaces = await getLiveSpaces({ timeout: 6000 });
    return {
      streams: spaces,
      total: spaces.length,
      platforms: [...new Set(spaces.flatMap((s) => s.platforms.map((p) => p.platform)))],
      fetchedAt: Date.now(),
    };
  } catch (e) {
    console.error('[live-provider] Failed to fetch streams:', e);
    return { streams: [], total: 0, platforms: [], fetchedAt: Date.now() };
  }
}

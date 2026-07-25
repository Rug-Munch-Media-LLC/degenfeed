/**
 * Sia / Skynet Adapter
 *
 * Decentralized storage network using blockchain smart contracts.
 * Skynet is the content delivery layer on top of Sia.
 *
 * API: https://siasky.net/skynet/skyfile/{skylink}
 *      https://sia.tech/docs/
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const SKYNET_PORTAL = 'https://siasky.net';

export async function resolveSkylink(skylink: string): Promise<unknown> {
  try {
    const res = await $fetch(`${SKYNET_PORTAL}/skynet/skyfile/${encodeURIComponent(skylink)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchSiaPosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // Storage protocol — no native social feed
}

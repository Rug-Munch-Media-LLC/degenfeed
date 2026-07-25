/**
 * Swarm (Ethereum) Adapter
 *
 * Swarm is a decentralized storage network for the Ethereum ecosystem.
 * Uses Bee node API for content upload/download.
 *
 * API: Bee HTTP API — https://docs.ethswarm.org/api/
 *      bee-js SDK: https://github.com/ethersphere/bee-js
 *      Public gateway: https://gateway.ethswarm.org
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const SWARM_GATEWAY = 'https://gateway.ethswarm.org';

export async function downloadSwarmContent(reference: string): Promise<string | null> {
  try {
    const res = await $fetch(`${SWARM_GATEWAY}/bzz/${encodeURIComponent(reference)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchSwarmPosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // Storage protocol — no native social feed
}

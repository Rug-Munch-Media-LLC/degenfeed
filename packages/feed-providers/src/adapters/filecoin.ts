/**
 * Filecoin Adapter
 *
 * Direct integration with Filecoin decentralized storage network.
 * Uses Filecoin Lotus API for deals, miners, and storage.
 *
 * API: Lotus RPC — https://lotus.filecoin.io/
 *      https://api.node.glif.io (public gateway)
 *      Filecoin Green: https://green.filecoin.io
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const GLIF_RPC = 'https://api.node.glif.io/rpc/v1';

export async function getFilecoinBalance(address: string): Promise<string | null> {
  try {
    const res = await $fetch(GLIF_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'Filecoin.WalletBalance',
        params: [address],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.result || null;
  } catch {
    return null;
  }
}

export async function fetchFilecoinPosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // Storage protocol — no native social feed
}

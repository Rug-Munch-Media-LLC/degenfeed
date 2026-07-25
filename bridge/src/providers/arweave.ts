/**
 * Arweave Gateway Bridge Provider
 *
 * Self-hosted AR.IO gateway providing access to the Arweave
 * permaweb — permanent, decentralized data storage.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'arweave',
  name: 'Arweave',
  description: 'Permaweb gateway — permanent decentralized storage',
  endpoint: '/api/feed/arweave',
  requiresAuth: false,
  contentType: 'data',
};

export async function fetchArweavePosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchArweavePosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Arweave error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchArweavePosts;

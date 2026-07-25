/**
 * Guppe Bridge Provider
 *
 * Guppe is a federated group chat platform using ActivityPub.
 * Lightweight alternative to Matrix for decentralized group discussions.
 * Fetches public group posts via the adapter layer.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) {
    _adapter = await import('@degenfeed/feed-providers');
  }
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'guppe',
  name: 'Guppe',
  description: 'Federated group chat platform with ActivityPub federation',
  endpoint: '/api/feed/guppe',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchGuppePosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchGuppePosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Guppe error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchGuppePosts;

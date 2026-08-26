/**
 * Streams Bridge Provider
 *
 * Streams is a nomadic identity platform similar to Hubzilla
 * with ActivityPub federation and Zot protocol support.
 * Fetches public stream posts via the adapter layer.
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
  id: 'streams',
  name: 'Streams',
  description: 'Nomadic identity and content streams with ActivityPub federation',
  endpoint: '/api/feed/streams',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchStreamsPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchStreamsPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Streams error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchStreamsPosts;

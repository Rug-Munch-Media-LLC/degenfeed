/**
 * Friendica Bridge Provider
 *
 * Federated social network — Friendica instances connect to the
 * wider Fediverse (Mastodon, Diaspora*, etc.). Fetches public posts
 * via the feed-providers adapter layer.
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
  id: 'friendica',
  name: 'Friendica',
  description: 'Federated social network — connects to Mastodon, Diaspora, and more',
  endpoint: '/api/feed/friendica',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchFriendicaPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchFriendicaPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Friendica error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchFriendicaPosts;

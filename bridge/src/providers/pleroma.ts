/**
 * Pleroma Bridge Provider
 *
 * Lightweight ActivityPub microblogging server. Uses the Mastodon-client
 * compatible API that Pleroma/Akkoma expose. Fetches from known public
 * instances.
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
  id: 'pleroma',
  name: 'Pleroma / Akkoma',
  description: 'Lightweight ActivityPub microblogging server with Mastodon API',
  endpoint: '/api/feed/pleroma',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchPleromaPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchPleromaPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Pleroma error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchPleromaPosts;

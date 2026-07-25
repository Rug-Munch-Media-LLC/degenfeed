/**
 * Sharkey Bridge Provider
 *
 * Sharkey is a fork of Misskey with Mastodon API compatibility.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'sharkey',
  name: 'Sharkey',
  description: 'Misskey fork with Mastodon API compatibility',
  endpoint: '/api/feed/sharkey',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchSharkeyPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchSharkeyPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Sharkey error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchSharkeyPosts;

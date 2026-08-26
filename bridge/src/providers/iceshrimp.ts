/**
 * Iceshrimp Bridge Provider
 *
 * Iceshrimp is a fork of Misskey focused on stability and bug fixes.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'iceshrimp',
  name: 'Iceshrimp',
  description: 'Misskey fork focused on stability and reliability',
  endpoint: '/api/feed/iceshrimp',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchIceshrimpPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchIceshrimpPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Iceshrimp error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchIceshrimpPosts;

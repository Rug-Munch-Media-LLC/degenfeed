/**
 * Firefish Bridge Provider
 *
 * Firefish is a fork of Misskey with active community development.
 * Rich media support with custom emojis, reactions, and charts.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'firefish',
  name: 'Firefish',
  description: 'Misskey fork with active community and rich media support',
  endpoint: '/api/feed/firefish',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchFirefishPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchFirefishPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch {
    // console.log(`[bridge] Firefish error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchFirefishPosts;

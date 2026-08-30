/**
 * Ghost Bridge Provider
 *
 * Ghost is a headless CMS with built-in ActivityPub support (Ghost 5.100+).
 * Fetches recent posts via the Ghost Content API.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'ghost',
  name: 'Ghost',
  description: 'Headless CMS with ActivityPub — modern publishing platform',
  endpoint: '/api/feed/ghost',
  requiresAuth: false,
  contentType: 'article',
};

export async function fetchGhostPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchGhostPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch {
    // console.log(`[bridge] Ghost error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchGhostPosts;

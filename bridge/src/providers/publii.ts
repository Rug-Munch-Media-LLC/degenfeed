/**
 * Publii Bridge Provider
 *
 * Publii is a desktop static CMS that generates static sites.
 * While desktop-based, Publii sites can be self-hosted on our
 * infrastructure via the generated static output.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'publii',
  name: 'Publii',
  description: 'Desktop static CMS — self-hosted sites via static output',
  endpoint: '/api/feed/publii',
  requiresAuth: false,
  contentType: 'articles',
};

export async function fetchPubliiPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchPubliiPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch {
    // console.log(`[bridge] Publii error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchPubliiPosts;

/**
 * Mbin Bridge Provider
 *
 * Mbin is the community-maintained fork of Kbin.
 * Combines Reddit-style link aggregation with Mastodon-compatible microblogging.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'mbin',
  name: 'Mbin',
  description: 'Active Kbin fork — federated content aggregation + microblogging',
  endpoint: '/api/feed/mbin',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchMbinPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchMbinPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Mbin error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchMbinPosts;

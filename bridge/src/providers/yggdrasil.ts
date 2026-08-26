/**
 * Yggdrasil Bridge Provider
 *
 * Yggdrasil is a decentralized mesh network protocol.
 * Provides IPv6-based encrypted mesh networking between all DegenFeed nodes.
 * Reports mesh peer status and network health.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'yggdrasil',
  name: 'Yggdrasil',
  description: 'Decentralized IPv6 mesh network for DegenFeed fleet',
  endpoint: '/api/feed/yggdrasil',
  requiresAuth: false,
  contentType: 'status',
};

export async function fetchYggdrasilPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchYggdrasilPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Yggdrasil error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchYggdrasilPosts;

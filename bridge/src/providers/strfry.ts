/**
 * strfry Bridge Provider
 *
 * strfry is a high-performance Nostr relay with NIP-50 full-text search.
 * C++/LMDB backed, serves as search index for Nostr content.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'strfry',
  name: 'strfry',
  description: 'High-performance Nostr relay with NIP-50 search',
  endpoint: '/api/feed/strfry',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchStrfryPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchStrfryPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] strfry error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchStrfryPosts;

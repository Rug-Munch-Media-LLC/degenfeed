/**
 * Plume Bridge Provider
 *
 * Plume is a federated blogging engine written in Rust.
 * ActivityPub-compatible, lightweight, fediverse-aware.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'plume',
  name: 'Plume',
  description: 'Federated blogging engine with ActivityPub (Rust)',
  endpoint: '/api/feed/plume',
  requiresAuth: false,
  contentType: 'articles',
};

export async function fetchPlumePosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchPlumePosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch {
    // console.log(`[bridge] Plume error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchPlumePosts;

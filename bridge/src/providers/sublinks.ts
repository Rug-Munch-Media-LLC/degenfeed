/**
 * Sublinks Bridge Provider
 *
 * Sublinks is a Lemmy-compatible link aggregator written in Rust.
 * Lighter weight than Lemmy with full API compatibility.
 * Fetches posts via the adapter layer.
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
  id: 'sublinks',
  name: 'Sublinks',
  description: 'Lightweight Lemmy-compatible link aggregator in Rust',
  endpoint: '/api/feed/sublinks',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchSublinksPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchSublinksPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Sublinks error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchSublinksPosts;

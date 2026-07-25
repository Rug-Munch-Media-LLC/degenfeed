/**
 * Kbin Bridge Provider
 *
 * Kbin is a Reddit-like content aggregator with microblogging on ActivityPub.
 * NOTE: Original Kbin is in maintainence mode. Prefer Mbin for new integrations.
 * This provider supports both Kbin and Mbin instances via the same API.
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
  id: 'kbin',
  name: 'Kbin / Mbin',
  description: 'Federated link aggregation and microblogging (Reddit+Mastodon hybrid)',
  endpoint: '/api/feed/kbin',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchKbinPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchKbinPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Kbin error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchKbinPosts;

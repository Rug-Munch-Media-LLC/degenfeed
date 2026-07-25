/**
 * Diaspora* Bridge Provider
 *
 * Federated social network — pods around the world run the Diaspora*
 * software. Fetches public posts from known pods via the feed-providers
 * adapter layer.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

// Re-use the feed-providers adapter which handles multiple pods
let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) {
    _adapter = await import('@degenfeed/feed-providers');
  }
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'diaspora',
  name: 'Diaspora*',
  description: 'Federated social network — distributed pods worldwide',
  endpoint: '/api/feed/diaspora',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchDiasporaPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchDiasporaPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Diaspora error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchDiasporaPosts;

/**
 * Hubzilla Bridge Provider
 *
 * Hubzilla provides nomadic identity — your online identity follows you
 * across instances. Supports ActivityPub, Zot, and OStatus protocols.
 * Fetches public channel posts via the adapter layer.
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
  id: 'hubzilla',
  name: 'Hubzilla',
  description: 'Nomadic identity platform with ActivityPub, Zot, and OStatus support',
  endpoint: '/api/feed/hubzilla',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchHubzillaPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchHubzillaPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch {
    // console.log(`[bridge] Hubzilla error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchHubzillaPosts;

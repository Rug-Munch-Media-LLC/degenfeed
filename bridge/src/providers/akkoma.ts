/**
 * Akkoma Bridge Provider
 *
 * Akkoma is a Pleroma fork focused on stability and bug fixes.
 * Lightweight with full Mastodon API compatibility.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'akkoma',
  name: 'Akkoma',
  description: 'Pleroma fork — lightweight stable microblogging',
  endpoint: '/api/feed/akkoma',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchAkkomaPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchAkkomaPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Akkoma error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchAkkomaPosts;

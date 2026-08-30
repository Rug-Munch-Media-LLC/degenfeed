/**
 * Immich Bridge Provider
 *
 * Immich is a self-hosted Google Photos alternative with AI features.
 * Provides photo/video management, sharing, and mobile auto-backup.
 * Fetches recent public media via Immich API.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'immich',
  name: 'Immich',
  description: 'Self-hosted Google Photos alternative with AI features',
  endpoint: '/api/feed/immich',
  requiresAuth: false,
  contentType: 'image',
};

export async function fetchImmichPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchImmichPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch {
    // console.log(`[bridge] Immich error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchImmichPosts;

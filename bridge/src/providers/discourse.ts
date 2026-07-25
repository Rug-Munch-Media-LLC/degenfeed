/**
 * Discourse Bridge Provider
 *
 * Discourse is a modern forum platform with ActivityPub plugin support.
 * Fetches recent topics via the Discourse API with ActivityPub compatibility.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'discourse',
  name: 'Discourse',
  description: 'Modern forum platform with ActivityPub support',
  endpoint: '/api/feed/discourse',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchDiscoursePosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchDiscoursePosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Discourse error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchDiscoursePosts;

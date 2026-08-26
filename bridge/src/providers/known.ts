/**
 * Known Bridge Provider
 *
 * Known (Withknown) is an IndieWeb social publishing platform.
 * Supports ActivityPub, Micropub, WebMentions, and IndieAuth.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'known',
  name: 'Known',
  description: 'IndieWeb social publishing platform',
  endpoint: '/api/feed/known',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchKnownPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchKnownPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Known error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchKnownPosts;

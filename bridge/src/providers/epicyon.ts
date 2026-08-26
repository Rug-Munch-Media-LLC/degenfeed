/**
 * Epicyon Bridge Provider
 *
 * Epicyon is an extremely low-resource ActivityPub server written in Python.
 * Designed to run on minimal hardware (~50MB RAM).
 * Fetches public posts via the adapter layer.
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
  id: 'epicyon',
  name: 'Epicyon',
  description: 'Ultralight ActivityPub server — runs on Raspberry Pi class hardware',
  endpoint: '/api/feed/epicyon',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchEpicyonPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchEpicyonPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Epicyon error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchEpicyonPosts;

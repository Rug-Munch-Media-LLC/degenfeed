/**
 * Misskey Bridge Provider
 *
 * Open-source ActivityPub microblogging platform with rich media support
 * (reactions, custom emojis, charts, etc.). Uses the feed-providers adapter
 * which queries known public Misskey instances.
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
  id: 'misskey',
  name: 'Misskey / Firefish',
  description: 'Open-source ActivityPub platform with rich media and reactions',
  endpoint: '/api/feed/misskey',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchMisskeyPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchMisskeyPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] Misskey error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchMisskeyPosts;

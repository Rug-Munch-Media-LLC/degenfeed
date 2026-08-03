/**
 * Pixelfed Bridge Provider
 *
 * Delegates to @degenfeed/feed-providers PixelfedProvider which uses
 * the pixelfed-sdk under the hood. This is a thin bridge integration
 * point providing standardized schema metadata.
 *
 * The feed-providers implementation supports:
 * - Self-hosted Pixelfed instance (photos.degenfeed.xyz → 127.0.0.1:8096)
 * - Federated Pixelfed instances (pixelfed.social, pixelfed.de, etc.)
 * - Hashtag searches for crypto/tech/photography content
 *
 * Auth: our self-hosted instance requires a Bearer token for the public
 * timeline. The token is read from PIXELFED_ACCESS_TOKEN (bridge/.env) and
 * passed through to the provider by the SDK.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

const PIXELFED_BASE_URL = process.env.PIXELFED_BASE_URL || 'http://127.0.0.1:8096';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) {
    _adapter = await import('@degenfeed/feed-providers');
  }
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'pixelfed',
  name: 'Pixelfed',
  description: 'Decentralized image sharing on ActivityPub — delegated to feed-providers',
  endpoint: '/api/feed/pixelfed',
  requiresAuth: false,
  contentType: 'image',
};

export async function fetchPixelfedPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { PixelfedProvider } = await getAdapter();
    const provider = new PixelfedProvider({
      instanceUrl: PIXELFED_BASE_URL,
      accessToken: process.env.PIXELFED_ACCESS_TOKEN,
    });
    const result = await provider.fetchFeed({ timeoutMs: 10000 });
    return (result.posts || []).slice(0, limit);
  } catch (err) {
    console.log(`[bridge] Pixelfed error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchPixelfedPosts;

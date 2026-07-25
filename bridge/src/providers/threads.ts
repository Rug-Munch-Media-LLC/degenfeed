/**
 * Threads Bridge Provider
 *
 * Delegates to @degenfeed/feed-providers ThreadsProvider which uses
 * ActivityPub federation via our GotoSocial instance (social.degenfeed.xyz).
 *
 * Architecture:
 *   Threads user ──ActivityPub──▶ social.degenfeed.xyz ──▶ this provider ──▶ feed
 *
 * This replaces the unreliable HTML scraper with proper ActivityPub federation.
 * Threads content arrives through Fediverse federation and is queried via
 * the Mastodon-compatible API on our instance.
 *
 * Configuration:
 *   Set BRIDGY_FED_ENABLED=true or ACTIVITYPUB_BRIDGE_ENABLED=true to activate.
 *   Without it, returns empty feed with a notice (no scraping, no failures).
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
  id: 'threads',
  name: 'Threads (Meta)',
  description: 'Meta Threads via ActivityPub federation — delegated to feed-providers',
  endpoint: '/api/feed/threads',
  requiresAuth: false,
  contentType: 'text',
};

export async function fetchThreadsPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { ThreadsProvider } = await getAdapter();
    const provider = new ThreadsProvider();
    const result = await provider.fetchFeed({ timeoutMs: 10000 });
    return (result.posts || []).slice(0, limit);
  } catch (err) {
    console.log(`[bridge] Threads error: ${(err as Error).message}`);
    return [];
  }
}

export { fetchThreadsPosts as fetch };

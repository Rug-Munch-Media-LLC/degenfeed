/**
 * /api/feed/farcaster — standalone Farcaster endpoint.
 *
 * Delegates to the FarcasterProvider for real Hub-fetched data
 * with display names, reaction counts, and trending search.
 */

import { FarcasterProvider } from '@degenfeed/feed-providers';
import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import { type Env, noCacheJsonResponse } from '../index';

export async function handleFarcasterFeed(_request: Request, env: Env): Promise<Response> {
  try {
    const provider = new FarcasterProvider({
      hubUrl: env.FARCASTER_HUB_URL,
    });
    const result = await provider.fetchFeed({ timeoutMs: 8000 });
    const posts = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
    return noCacheJsonResponse({ data: posts, meta: { total: posts.length, source: 'hub-live' } });
  } catch (e) {
    return noCacheJsonResponse({ data: [], meta: { total: 0, error: e instanceof Error ? e.message : 'Farcaster unavailable' } });
  }
}

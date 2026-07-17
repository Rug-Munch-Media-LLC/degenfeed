/**
 * /api/content/[uri] — Resolve a df:// URI to the full post data.
 *
 * Accepts a URL-encoded df:// URI as the path segment and returns the
 * corresponding UnifiedPost. The resolution strategy:
 *   1. Check the post KV cache (populated by the feed pipeline).
 *   2. Fetch from the native protocol provider.
 *   3. Fall back to an RSS provider for unmatched protocols.
 */

import {
  BlueskyProvider,
  FarcasterProvider,
  LensProvider,
  MastodonProvider,
  NostrProvider,
  RedditProvider,
  RmiDataBusProvider,
  RssProvider,
  ThreadsProvider,
} from '@degenfeed/feed-providers';
import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { decodeContentUri, rmiUrl } from '@degenfeed/utils';
import type { ProtocolSource } from '@degenfeed/utils';
import { type Env, jsonResponse } from '../index';

function providerFor(protocol: ProtocolSource, env: Env) {
  switch (protocol) {
    case 'rss':
      return new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
    case 'reddit':
      return new RedditProvider();
    case 'nostr':
      return new NostrProvider({ relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean) });
    case 'farcaster':
      return new FarcasterProvider({ hubUrl: env.FARCASTER_HUB_URL });
    case 'lens':
      return new LensProvider({ apiUrl: env.LENS_API_URL });
    case 'bluesky':
      return new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
    case 'mastodon':
      return new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
    case 'threads':
      return new ThreadsProvider();
    default:
      return null;
  }
}

function protocolToFeedProvider(p: ProtocolSource, env: Env) {
  // RSS uses the RMI DataBus or fallback RSS fetcher
  if (p === 'rss') return providerFor('rss', env);
  return providerFor(p, env);
}

/**
 * Resolve a df:// URI to a post.
 * Tries KV cache first, then the native protocol provider, then RSS fallback.
 */
async function fetchPostByUri(
  decoded: { protocol: ProtocolSource; id: string; instance?: string },
  env: Env,
): Promise<UnifiedPost | null> {
  const { protocol, id } = decoded;

  // Build the post KV key that the feed pipeline uses
  const canonicalId = `${protocol}:${id}`;

  // 1. Check KV cache (populated by writePostsToKV in feed pipeline)
  try {
    const stored = await env.CACHE?.get(`post:${canonicalId}`);
    if (stored) {
      const post = JSON.parse(stored) as UnifiedPost;
      if (!isSpamPost(post)) return post;
    }
  } catch {
    /* ignore */
  }

  // 2. Try the native protocol provider
  const provider = protocolToFeedProvider(protocol, env);
  if (provider) {
    try {
      const result = await Promise.race([
        provider.fetchFeed({ timeoutMs: 4000 }),
        new Promise<{ posts: UnifiedPost[] }>((resolve) =>
          setTimeout(() => resolve({ posts: [] }), 4000),
        ),
      ]);
      if (result?.posts) {
        const found = result.posts.find((p) => p.id === canonicalId);
        if (found && !isSpamPost(found)) {
          const enriched = enrichPostNiches(found);
          enriched.dfUri = `df://${protocol}:${id}`;
          return enriched;
        }
      }
    } catch {
      /* try next */
    }
  }

  // 3. Try RSS fallback for unknown protocols
  try {
    const rss = new RssProvider({
      feeds: ['https://cointelegraph.com/rss', 'https://decrypt.co/feed'],
    });
    const r = await rss.fetchFeed({ timeoutMs: 4000 });
    const found = r.posts.find((p) => p.id === canonicalId);
    if (found && !isSpamPost(found)) {
      const enriched = enrichPostNiches(found);
      enriched.dfUri = `df://${protocol}:${id}`;
      return enriched;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export async function handleContentResolve(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const rawUri = url.pathname.replace(/^\/api\/content\//, '');
  const uri = decodeURIComponent(rawUri);

  // Validate and decode the df:// URI
  const decoded = decodeContentUri(uri);
  if (!decoded) {
    return jsonResponse({ error: `Invalid df:// URI: ${uri}` }, 400);
  }

  // Cache the result for 5 minutes
  const cacheKey = `content:v1:${uri}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* ignore */
  }

  const post = await fetchPostByUri(decoded, env);
  if (!post) {
    return jsonResponse({ error: 'Post not found', uri }, 404);
  }

  const response = { data: post };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
  } catch {
    /* ignore */
  }

  return jsonResponse(response);
}

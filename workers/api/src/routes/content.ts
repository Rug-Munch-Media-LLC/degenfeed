/**
 * /api/content/[uri] — Resolve a df:// URI to the full post data.
 *
 * Accepts a URL-encoded df:// URI as the path segment and returns the
 * corresponding UnifiedPost. The resolution strategy:
 *   1. Check the post KV cache (populated by the feed pipeline).
 *   2. Fetch from the native protocol provider.
 *   3. Fall back to an RSS provider for unmatched protocols.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
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
import type { UnifiedPost } from '@degenfeed/types';
import type { ProtocolSource } from '@degenfeed/utils';
import { decodeContentUri, rmiUrl } from '@degenfeed/utils';
import { type Env, jsonResponse } from '../index';

function providerFor(protocol: ProtocolSource, env: Env) {
  switch (protocol) {
    case 'rss':
      return new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
    case 'reddit':
      return new RedditProvider();
    case 'nostr':
      return new NostrProvider({
        relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean),
      });
    case 'farcaster':
      return new FarcasterProvider({ hubUrl: env.FARCASTER_HUB_URL });
    case 'lens':
      return new LensProvider({ apiUrl: env.LENS_API_URL });
    case 'bluesky':
      return new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
    case 'mastodon':
      return new MastodonProvider({ instanceUrl: env.GOTOSOCIAL_INSTANCE_URL });
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
    /* KV operation failed -- non-critical, continue */
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
    /* KV operation failed -- non-critical, continue */
  }

  return null;
}

export async function handleContentResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawUri = url.pathname.replace(/^\/(api|v1)\/content\//, '');
  const uri = decodeURIComponent(rawUri);

  // ── df://profile/ resolution ──
  if (uri.startsWith('df://profile/')) {
    return handleProfileResolve(uri, env);
  }

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
    /* KV operation failed -- non-critical, continue */
  }

  const post = await fetchPostByUri(decoded, env);
  if (!post) {
    return jsonResponse({ error: 'Post not found', uri }, 404);
  }

  const response = { data: post };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 300,
    });
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  return jsonResponse(response);
}

// ─── df://profile/ resolution ─────────────────────────────────────

import { type CrossProtocolIdentity, identityKey } from '@degenfeed/utils';

async function handleProfileResolve(uri: string, env: Env): Promise<Response> {
  const address = uri.replace('df://profile/', '').trim().toLowerCase();
  if (!address || !/^(0x[a-f0-9]{40}|[1-9a-hj-z]{32,44})$/.test(address)) {
    return jsonResponse({ error: `Invalid profile address: ${address}` }, 400);
  }

  const key = identityKey(address);
  try {
    const raw = await env.IDENTITIES?.get(key);
    if (!raw) {
      return jsonResponse(
        {
          data: null,
          uri,
          message: 'Profile not found. Link your wallet in Settings to create one.',
        },
        200,
      );
    }
    const identity = JSON.parse(raw) as CrossProtocolIdentity;

    // Build the unified profile for display
    const { PROTOCOL_ID_REGISTRY } = await import('@degenfeed/utils');
    const handles: Array<{
      protocol: string;
      handle: string;
      icon: string;
      color: string;
      verified: boolean;
    }> = [];

    for (const [protocol, info] of Object.entries(PROTOCOL_ID_REGISTRY)) {
      const ident = (identity as unknown as Record<string, unknown>)[protocol];
      if (!ident || typeof ident !== 'object') continue;
      const p = ident as Record<string, unknown>;
      const handle = (p.handle || p.username || p.npub || p.did || p.id || '') as string;
      if (!handle) continue;
      handles.push({
        protocol,
        handle,
        icon: info.icon,
        color: info.color,
        verified: (p.verified as boolean) || false,
      });
    }

    return jsonResponse({
      data: {
        walletAddress: identity.walletAddress,
        displayName: handles.map((h) => h.handle).join(' / '),
        handles,
        totalFollowerCount: 0,
        networkCount: handles.length,
        linkedAt: identity.linkedAt,
        lastVerified: identity.lastVerified,
        dfUri: uri,
      },
      uri,
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to resolve profile: ${String(err)}` }, 500);
  }
}

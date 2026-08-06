/**
 * /api/feed/farcaster — standalone Farcaster endpoint.
 *
 * Primary: Fetches from the FarcasterProvider (Hubble Hub).
 * No seed/demo fallback — when the hub is unreachable the endpoint
 * returns an explicit empty result. Fake content is never served.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import { FarcasterProvider } from '@degenfeed/feed-providers';
import { identityKey } from '@degenfeed/utils';
import { noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── MAIN HANDLER ───────────────────────────────────────────────────────────

export async function handleFarcasterFeed(_request: Request, env: Env): Promise<Response> {
  const params = new URL(_request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 25, 100);

  let posts: Array<import('@degenfeed/types').UnifiedPost> = [];

  // 1. Try Hub-fetched data (FarcasterProvider)
  try {
    const provider = new FarcasterProvider({
      hubUrl: env.FARCASTER_HUB_URL,
    });
    const result = await provider.fetchFeed({ timeoutMs: 8000 });
    posts = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches as any);

    // Enrich with cross-platform identity KV
    if (env.IDENTITIES && posts.length > 0) {
      const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
      posts = await Promise.all(
        posts.map(async (post) => {
          const fid = (post.author.keys as any)?.fid;
          if (!fid) return post;
          try {
            const custodyRes = await fetch(`${hubUrl}/v1/custodyAddressByFid?fid=${fid}`, {
              headers: { 'user-agent': 'DegenFeed/0.1' },
            });
            if (!custodyRes.ok) return post;
            const custodyData = (await custodyRes.json()) as { custodyAddress?: string };
            const custodyAddr = custodyData.custodyAddress;
            if (!custodyAddr) return post;
            (post.author.keys as any).evmAddress = custodyAddr.toLowerCase();
            const key = identityKey(custodyAddr);
            const raw = await env.IDENTITIES?.get(key);
            if (!raw) return post;
            const identity = JSON.parse(raw) as Record<string, unknown>;
            if (
              identity.walletAddress &&
              /^0x[a-f0-9]{40}$/i.test(identity.walletAddress as string)
            ) {
              (post.author.keys as any).evmAddress = (
                identity.walletAddress as string
              ).toLowerCase();
            }
          } catch {
            /* best-effort */
          }
          return post;
        }),
      );
    }
  } catch {
    /* FarcasterProvider unavailable — return explicit empty result below */
  }

  // 2. Never serve seed/demo content — return real posts or an explicit empty result
  return noCacheJsonResponse({
    data: posts.slice(0, limit),
    meta: {
      total: posts.length,
      source: posts.length > 0 ? 'hub-live' : 'unavailable',
    },
  });
}

/**
 * /api/feed/farcaster — standalone Farcaster endpoint.
 *
 * Delegates to the FarcasterProvider for real Hub-fetched data
 * with display names, reaction counts, and trending search.
 * Enriches post authors with cross-platform identity data from KV
 * so cross-registered users can receive tips on any protocol.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import { FarcasterProvider } from '@degenfeed/feed-providers';
import { identityKey } from '@degenfeed/utils';
import { type Env, noCacheJsonResponse } from '../index';

export async function handleFarcasterFeed(_request: Request, env: Env): Promise<Response> {
  try {
    const provider = new FarcasterProvider({
      hubUrl: env.FARCASTER_HUB_URL,
    });
    const result = await provider.fetchFeed({ timeoutMs: 8000 });

    // ── Spam filter + niche enrichment ────────────────────────
    let posts = result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);

    // ── Enrich post authors with cross-platform identity KV ───
    // Farcaster posts carry `author.keys.fid`. We resolve each FID
    // to its custody address via the hub, then look up the linked
    // identity KV to populate wallet addresses for tipping.
    if (env.IDENTITIES) {
      const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.pinata.cloud';
      posts = await Promise.all(
        posts.map(async (post) => {
          const fid = post.author.keys?.fid;
          if (!fid) {
            return post;
          }

          try {
            // 1. Resolve custody address from hub
            const custodyRes = await fetch(`${hubUrl}/v1/custodyAddressByFid?fid=${fid}`, {
              headers: { 'user-agent': 'DegenFeed/0.1' },
            });
            if (!custodyRes.ok) return post;

            const custodyData = (await custodyRes.json()) as { custodyAddress?: string };
            const custodyAddr = custodyData.custodyAddress;
            if (!custodyAddr) return post;

            // Set the custody/EV M address on the post author
            post.author.keys.evmAddress = custodyAddr.toLowerCase();

            // 2. Look up cross-platform identity by custody address
            const key = identityKey(custodyAddr);
            const raw = await env.IDENTITIES?.get(key);
            if (!raw) return post;

            const identity = JSON.parse(raw) as Record<string, unknown>;

            // Use the registered wallet address if different from custody address
            if (
              identity.walletAddress &&
              /^0x[a-f0-9]{40}$/i.test(identity.walletAddress as string)
            ) {
              const walletAddr = (identity.walletAddress as string).toLowerCase();
              if (walletAddr !== custodyAddr.toLowerCase()) {
                post.author.keys.evmAddress = walletAddr;
              }
            }

            // Link other protocol identities for cross-protocol tipping
            if (identity.lens && typeof identity.lens === 'object') {
              const lens = identity.lens as Record<string, unknown>;
              if (lens.handle) {
                post.author.keys.lensProfileId = lens.handle as string;
              }
            }

            // Solana wallet from identity
            if (
              identity.walletAddress &&
              /^[1-9a-hj-z]{32,44}$/.test(identity.walletAddress as string)
            ) {
              post.author.keys.solanaAddress = identity.walletAddress as string;
            }
          } catch {
            // Best-effort — identity enrichment is non-critical
          }

          return post;
        }),
      );
    }

    return noCacheJsonResponse({ data: posts, meta: { total: posts.length, source: 'hub-live' } });
  } catch (e) {
    return noCacheJsonResponse({
      data: [],
      meta: { total: 0, error: e instanceof Error ? e.message : 'Farcaster unavailable' },
    });
  }
}

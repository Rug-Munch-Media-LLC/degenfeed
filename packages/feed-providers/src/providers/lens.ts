/** LensProvider v2 — Lens API (2026). Uses accounts + posts with filter.searchBy.localNameQuery. */

import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
} from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

export const LENS_API_URL = 'https://api.lens.xyz/graphql';
export const CURATED_LENS_HANDLES = [
  'stani.lens',
  'lensprotocol.lens',
  'jessepollak.lens',
  'nader.lens',
  'christina.lens',
  'sassal0x.lens',
  'dcposch.lens',
  'vbuterin.lens',
  '0xpolygon.lens',
  'base.lens',
  'optimism.lens',
  'arbitrum.lens',
  'zksync.lens',
  'aaveaave.lens',
  'uniswap.lens',
  'lido.lens',
  'makerdao.lens',
  'pooltogether.lens',
  'balancer.lens',
  'coinbase.lens',
  'opensea.lens',
  'gitcoin.lens',
  'ens.lens',
  'safe.lens',
  'worldcoin.lens',
  'chainlink.lens',
  'graphprotocol.lens',
  'arweave.lens',
  'sushiswap.lens',
  '1inch.lens',
  'paraswap.lens',
  'dydx.lens',
  'eigenlayer.lens',
  'starkware.lens',
  'curve.lens',
  'compoundfinance.lens',
  'yearn.lens',
  'fraxfinance.lens',
  'pancakeswap.lens',
  'velodrome.lens',
  'aerodrome.lens',
  'lyra.lens',
  'sky.lens',
  'etherfi.lens',
  'renzo.lens',
  'puffer.lens',
  'kelpdao.lens',
  'ethena.lens',
  'pendle.lens',
  'eigenfoundation.lens',
];

interface LensAccount {
  address: string;
  username?: { localName?: string };
  metadata?: { name?: string | null; bio?: string | null; picture?: string | null };
}
interface LensPost {
  id: string;
  timestamp?: string;
  metadata?: {
    content?: string | null;
    image?: { item?: string | null } | null;
  };
  author?: LensAccount;
  stats?: { reactions?: number; comments?: number; reposts?: number; quotes?: number };
}

export interface LensProviderOptions {
  apiUrl?: string;
}

function postToUnified(pub: LensPost): UnifiedPost {
  const a = pub.author;
  const addr = a?.address ?? 'unknown';
  const h = a?.username?.localName ?? null;
  return buildUnifiedPost({
    protocol: 'lens',
    nativeId: pub.id,
    author: {
      id: `lens:${addr}`,
      primary: { protocol: 'lens', id: addr },
      handles: {
        nostr: null,
        farcaster: null,
        lens: h,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: a?.metadata?.name ?? h ?? '',
      bio: a?.metadata?.bio ?? '',
      avatarUrl: a?.metadata?.picture ?? '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: pub.metadata?.content ?? '',
    createdAt: pub.timestamp ? new Date(pub.timestamp).getTime() : Date.now(),
    metrics: {
      likes: pub.stats?.reactions ?? 0,
      reposts: pub.stats?.reposts ?? 0,
      replies: pub.stats?.comments ?? 0,
      quotes: pub.stats?.quotes ?? 0,
    },
    raw: pub,
  });
}

async function lensGql(url: string, q: string, v?: unknown): Promise<unknown> {
  const d = await fetchJson<{ data?: unknown; errors?: Array<{ message: string }> }>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': DEFAULT_USER_AGENT },
    body: JSON.stringify({ query: q, variables: v }),
  });
  if (d.errors?.length) throw new Error(`Lens: ${d.errors[0]?.message ?? '?'}`);
  return d.data;
}

// Shared selection fragments for the 2026 Lens API (api.lens.xyz/graphql).
// PostMetadata is a UNION — content lives on the concrete metadata types.
const POST_FIELDS = `
  id timestamp
  metadata {
    ... on TextOnlyMetadata { content }
    ... on ImageMetadata { content image { item } }
    ... on VideoMetadata { content }
    ... on LinkMetadata { content }
    ... on ArticleMetadata { content }
  }
  author { address username { localName } metadata { name bio picture } }
  stats { reactions comments reposts quotes }
`;

export class LensProvider implements FeedProvider {
  readonly protocol: Protocol = 'lens';

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly apiUrl: string;
  private readonly breaker = new CircuitBreaker('lens');
  constructor(options: LensProviderOptions | string = LENS_API_URL) {
    this.apiUrl = typeof options === 'string' ? options : options.apiUrl || LENS_API_URL;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const t = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5000);
        const posts: UnifiedPost[] = [];

        // Primary: ML-powered explore feed — viral/hot content with real engagement.
        try {
          const explore = await withTimeout(
            lensGql(
              this.apiUrl,
              `query{mlPostsExplore(request:{pageSize:FIFTY}){items{__typename ... on Post{${POST_FIELDS}}}}}`,
            ),
            Math.min(t, 4000),
            'lens:explore',
          );
          const items =
            (explore as { mlPostsExplore?: { items?: LensPost[] } })?.mlPostsExplore?.items ?? [];
          posts.push(...items.map(postToUnified).map(enrichPostNiches));
        } catch {
          /* explore unavailable — continue with curated */
        }

        // Secondary: curated crypto accounts for consistent signal.
        try {
          const names = CURATED_LENS_HANDLES.map((h) => h.replace('.lens', '')).slice(0, 12);
          const addressResults = await Promise.all(
            names.map(async (name) => {
              try {
                const acc = await withTimeout(
                  lensGql(
                    this.apiUrl,
                    'query($q:String!){accounts(request:{filter:{searchBy:{localNameQuery:$q}},pageSize:FIFTY}){items{address username{localName}}}}',
                    { q: name },
                  ),
                  Math.min(t, 2000),
                  `lens:acct:${name}`,
                );
                return ((acc as { accounts?: { items?: LensAccount[] } })?.accounts?.items ?? [])
                  .filter((a) => a.username?.localName === name)
                  .map((a) => a.address);
              } catch {
                return [] as string[];
              }
            }),
          );
          const addrs = [...new Set(addressResults.flat())].filter(Boolean).slice(0, 8);
          if (addrs.length > 0) {
            const curated = await withTimeout(
              lensGql(
                this.apiUrl,
                `query($a:[String!]!){posts(request:{filter:{authors:$a,postTypes:[ROOT]},pageSize:FIFTY}){items{__typename ... on Post{${POST_FIELDS}}}}}`,
                { a: addrs },
              ),
              Math.min(t, 4000),
              'lens:curated',
            );
            const items = (curated as { posts?: { items?: LensPost[] } })?.posts?.items ?? [];
            // Prepend curated so they float above the explore feed
            posts.unshift(...items.map(postToUnified).map(enrichPostNiches));
          }
        } catch {
          /* curated unavailable */
        }

        // Tertiary: reposts from curated accounts —
        // surfaces what the crypto thought-leaders are amplifying.
        try {
          const names = ['stani.lens', 'lensprotocol.lens', 'nader.lens', 'jessepollak.lens'];
          const mirrorAddresses = await Promise.all(
            names.map(async (name) => {
              try {
                const acc = await withTimeout(
                  lensGql(
                    this.apiUrl,
                    'query($q:String!){accounts(request:{filter:{searchBy:{localNameQuery:$q}},pageSize:FIFTY}){items{address}}}',
                    { q: name.replace('.lens', '') },
                  ),
                  Math.min(t, 2000),
                  `lens:mirror:${name}`,
                );
                const items =
                  (acc as { accounts?: { items?: Array<{ address: string }> } })?.accounts?.items ??
                  [];
                return items[0]?.address ?? null;
              } catch {
                return null;
              }
            }),
          );
          const mirrorAddrs = mirrorAddresses.filter(Boolean) as string[];
          if (mirrorAddrs.length > 0) {
            const mirrors = await withTimeout(
              lensGql(
                this.apiUrl,
                `query($a:[String!]!){posts(request:{filter:{authors:$a,postTypes:[REPOST]},pageSize:TEN}){items{__typename ... on Repost{id timestamp repostOf{... on Post{${POST_FIELDS}}}}}}}`,
                { a: mirrorAddrs },
              ),
              Math.min(t, 4000),
              'lens:mirrors',
            );
            const mirrorItems =
              (
                mirrors as {
                  posts?: {
                    items?: Array<{
                      id: string;
                      timestamp?: string;
                      repostOf?: LensPost;
                    }>;
                  };
                }
              )?.posts?.items ?? [];
            for (const m of mirrorItems) {
              const original = m.repostOf;
              if (!original) continue;
              posts.push(enrichPostNiches(postToUnified(original)));
            }
          }
        } catch {
          /* mirrors unavailable */
        }

        if (posts.length === 0) {
          return { posts: [], notice: 'Lens unavailable' };
        }
        return { posts };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Lens: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Lens unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const s = performance.now();
    try {
      await withTimeout(
        lensGql(this.apiUrl, '{__typename}'),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'lens:hlth',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - s) };
    } catch (e) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - s),
        error: (e as Error).message,
      };
    }
  }
}

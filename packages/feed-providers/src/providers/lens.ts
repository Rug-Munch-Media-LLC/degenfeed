/** LensProvider v2 — Lens API (2026). Uses accounts + posts with filter.searchBy.localNameQuery. */

import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
} from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
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
  metadata?: { displayName?: string; picture?: string };
}
interface LensPost {
  id: string;
  metadata?: { content?: string; asset?: { image?: { raw?: { uri?: string } } } };
  author?: LensAccount;
  createdAt?: string;
  stats?: { reactions?: number; comments?: number; mirrors?: number; quotes?: number };
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
      displayName: a?.metadata?.displayName ?? h ?? '',
      bio: '',
      avatarUrl: a?.metadata?.picture ?? '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: pub.metadata?.content ?? '',
    createdAt: pub.createdAt ? new Date(pub.createdAt).getTime() : Date.now(),
    metrics: {
      likes: pub.stats?.reactions ?? 0,
      reposts: pub.stats?.mirrors ?? 0,
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

export class LensProvider implements FeedProvider {
  readonly protocol: Protocol = 'lens';
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
              'query{mlPostsExplore(request:{pageSize:FIFTY}){items{id metadata{content asset{...on PostMetadataMediaImage{image{raw{uri}}}}} author{username{localName}metadata{displayName picture}} createdAt stats{reactions comments mirrors quotes}}}}',
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
                'query($a:[String!]!){posts(request:{filter:{authors:$a},pageSize:THIRTY}){items{id metadata{content asset{...on PostMetadataMediaImage{image{raw{uri}}}}} author{username{localName}metadata{displayName picture}} createdAt stats{reactions comments mirrors quotes}}}}',
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

        // Tertiary: mirror publications from curated accounts —
        // surfaces what the crypto thought-leaders are amplifying.
        try {
          const names = ['stani.lens', 'lensprotocol.lens', 'nader.lens', 'jessepollak.lens'];
          const mirrorAddresses = await Promise.all(
            names.map(async (name) => {
              try {
                const acc = await withTimeout(
                  lensGql(
                    this.apiUrl,
                    'query($q:String!){accounts(request:{filter:{searchBy:{localNameQuery:$q}},pageSize:ONE}){items{address}}}',
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
                'query($a:[String!]!){publications(request:{where:{from:$a, publicationTypes:[MIRROR]}, limit:TEN}){items{__typename ... on Mirror{id createdAt stats{reactions comments mirrors quotes} mirrorOn{... on Post{id metadata{content asset{...on PostMetadataMediaImage{image{raw{uri}}}}} author{username{localName}metadata{displayName picture}} createdAt stats{reactions comments mirrors quotes}}}}}}}',
                { a: mirrorAddrs },
              ),
              Math.min(t, 4000),
              'lens:mirrors',
            );
            const mirrorItems =
              (
                mirrors as {
                  publications?: {
                    items?: Array<{
                      id: string;
                      createdAt: string;
                      stats?: LensPost['stats'];
                      mirrorOn?: LensPost;
                    }>;
                  };
                }
              )?.publications?.items ?? [];
            for (const m of mirrorItems) {
              const original = m.mirrorOn;
              if (!original) continue;
              posts.push(
                enrichPostNiches(
                  postToUnified({
                    ...original,
                    stats: m.stats ?? original.stats,
                  }),
                ),
              );
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

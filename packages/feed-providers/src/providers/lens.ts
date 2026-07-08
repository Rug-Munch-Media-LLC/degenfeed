/**
 * LensProvider v2 — updated for Lens API (2026 schema).
 * Uses `accounts(request:{filter:{searchBy:{localNameQuery}}})` to resolve
 * profiles and `posts(request:{filter:{authors}})` to fetch their posts.
 */

import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

export const LENS_API_URL = 'https://api.lens.xyz/graphql';

export const CURATED_LENS_HANDLES = [
  'lensprotocol.lens',
  'stani.lens',
  'aaveaave.lens',
  'pooltogether.lens',
  'balancer.lens',
  'uniswap.lens',
  'lido.lens',
  'makerdao.lens',
];

interface LensAccount {
  address: string;
  username?: { localName?: string };
  metadata?: { displayName?: string; bio?: string; picture?: string };
}

interface LensPost {
  id: string;
  metadata?: { content?: string; asset?: { image?: { raw?: { uri?: string } } } };
  author?: LensAccount;
  createdAt?: string;
  stats?: { reactions?: number; comments?: number; mirrors?: number; quotes?: number };
}

function postToUnified(pub: LensPost): UnifiedPost {
  const addr = pub.author?.address ?? 'unknown';
  const handle = pub.author?.username?.localName ?? null;
  return buildUnifiedPost({
    protocol: 'lens',
    nativeId: pub.id,
    author: {
      id: `lens:${addr}`,
      primary: { protocol: 'lens', id: addr },
      handles: {
        nostr: null,
        farcaster: null,
        lens: handle,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: pub.author?.metadata?.displayName ?? handle ?? '',
      bio: pub.author?.metadata?.bio ?? '',
      avatarUrl: pub.author?.metadata?.picture ?? '',
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

async function lensGql(url: string, query: string, v?: unknown): Promise<unknown> {
  const d = await fetchJson<{ data?: unknown; errors?: Array<{ message: string }> }>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': DEFAULT_USER_AGENT },
    body: JSON.stringify({ query, variables: v }),
  });
  if (d.errors?.length) throw new Error(`Lens: ${d.errors[0]?.message ?? '?'}`);
  return d.data;
}

export interface LensProviderOptions {
  apiUrl?: string;
}

export class LensProvider implements FeedProvider {
  readonly protocol: Protocol = 'lens';
  private readonly apiUrl: string;

  constructor(options: LensProviderOptions | string = LENS_API_URL) {
    this.apiUrl = typeof options === 'string' ? options : options.apiUrl || LENS_API_URL;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const t = Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5000);
    try {
      const names = CURATED_LENS_HANDLES.map((h) => h.replace('.lens', '')).slice(0, 6);
      const acc = await withTimeout(
        lensGql(
          this.apiUrl,
          `query($q:String!,FIFTY:PageSize){accounts(request:{filter:{searchBy:{localNameQuery:$q}},pageSize:FIFTY}){items{address username{localName value}}}}`,
          { q: names.join(',') },
        ),
        t,
        'lens:accts',
      );
      const addrs = ((acc as { accounts?: { items?: LensAccount[] } })?.accounts?.items ?? [])
        .map((a) => a.address)
        .filter(Boolean);
      if (!addrs.length) return { posts: [], notice: 'No Lens profiles resolved' };

      const p = await withTimeout(
        lensGql(
          this.apiUrl,
          `query($a:[String!]!,FIFTY:PageSize){posts(request:{filter:{authors:$a},pageSize:FIFTY}){items{id metadata{content asset{...on PostMetadataMediaImage{image{raw{uri}}}}} author{username{localName}metadata{displayName picture}} createdAt stats{reactions comments mirrors quotes}}}}`,
          { a: addrs.slice(0, 6) },
        ),
        t,
        'lens:posts',
      );
      return {
        posts: ((p as { posts?: { items?: LensPost[] } })?.posts?.items ?? [])
          .map(postToUnified)
          .map(enrichPostNiches),
      };
    } catch (e) {
      return { posts: [], notice: e instanceof Error ? e.message : 'Lens unavailable' };
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

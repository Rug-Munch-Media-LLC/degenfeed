/**
 * LensProvider v2 — updated for the current Lens API schema (2026).
 * Uses `accounts` + `posts` instead of the deprecated `profiles` + `publications`.
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
  'bradorbradley.lens',
  'jouni.lens',
  'yoginth.lens',
];

interface LensAccount {
  address: string; // profile ID is now the EVM address
  username?: { localName?: string };
  metadata?: {
    displayName?: string;
    bio?: string;
    picture?: string;
  };
  stats?: {
    followers?: number;
    following?: number;
  };
}

interface LensPost {
  id: string;
  metadata?: {
    content?: string;
    asset?: {
      image?: { raw?: { uri?: string } };
    };
  };
  author?: LensAccount;
  createdAt?: string;
  stats?: {
    reactions?: number;
    comments?: number;
    mirrors?: number;
    quotes?: number;
  };
}

async function lensQuery(url: string, query: string, variables?: unknown): Promise<unknown> {
  const data = await fetchJson<{ data?: unknown; errors?: Array<{ message: string }> }>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': DEFAULT_USER_AGENT },
    body: JSON.stringify({ query, variables }),
  });
  if (data.errors && data.errors.length > 0) {
    throw new Error(`Lens query error: ${data.errors[0]?.message ?? 'unknown'}`);
  }
  return data.data;
}

function publicationToUnifiedPost(pub: LensPost): UnifiedPost {
  const author: UnifiedPost['author'] = {
    id: `lens:${pub.author?.address ?? pub.id}`,
    primary: { protocol: 'lens', id: pub.author?.address ?? pub.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: pub.author?.username?.localName ?? null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: pub.author?.metadata?.displayName ?? pub.author?.username?.localName ?? '',
    bio: pub.author?.metadata?.bio ?? '',
    avatarUrl: pub.author?.metadata?.picture ?? '',
    verified: [],
    followerCount: pub.author?.stats?.followers ?? 0,
    followingCount: pub.author?.stats?.following ?? 0,
    links: [],
    keys: {},
  };
  return buildUnifiedPost({
    protocol: 'lens',
    nativeId: pub.id,
    author,
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

export interface LensProviderOptions {
  apiUrl?: string;
}

export class LensProvider implements FeedProvider {
  readonly protocol: Protocol = 'lens';
  private readonly apiUrl: string;

  constructor(options: LensProviderOptions = {}) {
    this.apiUrl = options.apiUrl || LENS_API_URL;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;

    try {
      // Step 1: Try curated usernames via `accounts` query
      const accounts = await withTimeout(
        lensQuery(
          this.apiUrl,
          `query($handles:[String!]!) { accounts(request:{where:{handles:$handles}}) { items { address username { localName } metadata { displayName bio picture } } } }`,
          {
            handles: CURATED_LENS_HANDLES.slice(0, 8),
          },
        ),
        Math.min(timeoutMs, 4000),
        'lens:accounts',
      );
      const addrs = (
        (accounts as { accounts?: { items?: Array<{ address: string }> } })?.accounts?.items ?? []
      )
        .map((a: { address: string }) => a.address)
        .filter(Boolean);

      if (addrs.length === 0) {
        return { posts: [], notice: 'No Lens profiles resolved' };
      }

      // Step 2: Fetch posts by these addresses
      const postsData = await withTimeout(
        lensQuery(
          this.apiUrl,
          `query($addrs:[String!]!,$limit:Limit!) { posts(request:{where:{from:$addrs},limit:$limit}) { items { id metadata { content asset { ... on PostMetadataMediaImage { image { raw { uri } } } } } author { address username { localName } metadata { displayName picture } } createdAt stats { reactions comments mirrors quotes } } } }`,
          {
            addrs: addrs.slice(0, 6),
            limit: Math.min(limit, 50),
          },
        ),
        Math.min(timeoutMs, 4000),
        'lens:posts',
      );
      const items = ((postsData as { posts?: { items?: LensPost[] } })?.posts?.items ?? []).map(
        publicationToUnifiedPost,
      );

      return { posts: items.map(enrichPostNiches) };
    } catch (err) {
      return { posts: [], notice: err instanceof Error ? err.message : 'Lens feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        lensQuery(this.apiUrl, '{ __typename }'),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'lens:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}

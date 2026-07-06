import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchWithFallbacks,
  withRetry,
  withTimeout,
} from '../utils';

export const LENS_API_URL = 'https://api-v2.lens.dev/graphql';
export const FALLBACK_LENS_URLS = [
  'https://api.lens.xyz/graphql',
  'https://api-v2.lens.dev/graphql',
];

export const CURATED_LENS_PROFILE_IDS = [
  '0x01',
  '0x05',
  '0x0b',
  '0x14',
  '0x1e',
  '0x32',
  '0x64',
  '0xc8',
  '0x12c',
  '0x1f4',
];

export const CURATED_LENS_HANDLES = [
  'lensprotocol',
  'stani',
  'aaveaave',
  'pooltogether',
  'balancer',
  'uniswap',
  'lido',
  'makerdao',
  'bradorbradley',
  'wagmi',
  'chriscomrie',
  'jouni',
  'maguila',
  'yoginth',
  'james',
];

interface LensProfile {
  id: string;
  handle?: { localName: string } | null;
  metadata?: {
    displayName?: string | null;
    picture?: { optimized?: { uri?: string } | null } | null;
    bio?: string | null;
  } | null;
  stats?: { followers?: number; following?: number } | null;
}

interface LensPublication {
  id: string;
  by: {
    id: string;
    handle?: { localName: string } | null;
    metadata?: {
      displayName?: string | null;
      picture?: { optimized?: { uri?: string } | null } | null;
    } | null;
  };
  metadata?: {
    content?: string | null;
    asset?: { image?: { optimized?: { uri?: string } | null } | null } | null;
  } | null;
  createdAt: string;
  stats?: {
    comments?: number;
    mirrors?: number;
    reactions?: number;
    quotes?: number;
  } | null;
}

function publicationToUnifiedPost(pub: LensPublication): UnifiedPost {
  const identity: UnifiedIdentity = {
    id: `lens:${pub.by.id}`,
    primary: { protocol: 'lens', id: pub.by.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: pub.by.handle?.localName ? `${pub.by.handle.localName}.lens` : null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: pub.by.metadata?.displayName ?? pub.by.handle?.localName ?? pub.by.id,
    bio: '',
    avatarUrl: pub.by.metadata?.picture?.optimized?.uri ?? '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { lensProfileId: pub.by.id },
  };

  const text = pub.metadata?.content ?? '';
  const embeds: { kind: 'image'; url: string }[] = [];
  const imageUrl = pub.metadata?.asset?.image?.optimized?.uri;
  if (imageUrl) embeds.push({ kind: 'image', url: imageUrl });
  const stats = pub.stats ?? {};

  return buildUnifiedPost({
    protocol: 'lens',
    nativeId: pub.id,
    author: identity,
    text: text.slice(0, 1000),
    createdAt: new Date(pub.createdAt).getTime(),
    metrics: {
      likes: stats.reactions ?? 0,
      reposts: stats.mirrors ?? 0,
      replies: stats.comments ?? 0,
      quotes: stats.quotes ?? 0,
    },
    viewer: { liked: false, reposted: false },
    raw: pub,
    embeds,
  });
}

async function lensGraphQL(
  url: string,
  query: string,
  variables: Record<string, unknown> = {},
  accessToken?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': DEFAULT_USER_AGENT,
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    throw new Error(`Lens API error: ${res.status}`);
  }
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length)
    throw new Error(`Lens query error: ${json.errors[0]?.message ?? 'unknown'}`);
  return json.data;
}

async function fetchProfilesByHandles(url: string, handles: string[]): Promise<LensProfile[]> {
  const data = (await lensGraphQL(
    url,
    `query Profiles($request: ProfilesRequest!) {
      profiles(request: $request) {
        items { id handle { localName } metadata { displayName picture { optimized { uri } } bio } stats { followers following } }
      }
    }`,
    {
      request: {
        where: { handles: handles.map((h) => (h.endsWith('.lens') ? h : `${h}.lens`)) },
      },
    },
  )) as { profiles?: { items?: LensProfile[] } };
  return data.profiles?.items ?? [];
}

async function fetchPublicationsByProfileIds(
  url: string,
  profileIds: string[],
  limit = 50,
): Promise<LensPublication[]> {
  const data = (await lensGraphQL(
    url,
    `query Publications($request: PublicationsRequest!) {
      publications(request: $request) {
        items {
          ... on Post {
            id
            by { id handle { localName } metadata { displayName picture { optimized { uri } } } }
            metadata { content asset { ... on PublicationMetadataMediaImage { image { optimized { uri } } } } }
            createdAt
            stats { comments mirrors reactions quotes }
          }
        }
      }
    }`,
    { request: { where: { from: profileIds }, limit } },
  )) as { publications?: { items?: LensPublication[] } };
  return data.publications?.items ?? [];
}

async function fetchHeyPublicFeed(): Promise<UnifiedPost[]> {
  // hey.xyz does not expose a public JSON feed; placeholder for graceful empty fallback
  return [];
}

export interface LensProviderOptions {
  apiUrl?: string;
  fallbackUrls?: string[];
  accessToken?: string;
  curatedHandles?: string[];
}

export class LensProvider implements FeedProvider {
  readonly protocol: Protocol = 'lens';
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];
  private readonly accessToken?: string;
  private readonly curatedHandles: string[];

  constructor(options: LensProviderOptions = {}) {
    this.primaryUrl = options.apiUrl || LENS_API_URL;
    this.fallbackUrls =
      options.fallbackUrls ?? FALLBACK_LENS_URLS.filter((u) => u !== this.primaryUrl);
    this.accessToken = options.accessToken;
    this.curatedHandles = options.curatedHandles ?? CURATED_LENS_HANDLES;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;

    try {
      const endpoints = [this.primaryUrl, ...this.fallbackUrls];
      const posts = await withRetry(async () => {
        const profiles = await fetchWithFallbacks(endpoints, (url) => {
          return withTimeout(
            fetchProfilesByHandles(url, this.curatedHandles),
            timeoutMs,
            'lens:profiles',
          );
        });
        const ids = profiles.map((p) => p.id).filter(Boolean);
        if (ids.length === 0) return [];

        const pubs = await fetchWithFallbacks(endpoints, (url) => {
          return withTimeout(
            fetchPublicationsByProfileIds(url, ids, Math.ceil(limit / 2)),
            timeoutMs,
            'lens:publications',
          );
        });
        return pubs.map(publicationToUnifiedPost);
      });

      if (posts.length > 0) {
        return { posts: posts.map(enrichPostNiches) };
      }
    } catch {
      /* fall through to hey/lenster */
    }

    try {
      const hey = await fetchHeyPublicFeed();
      if (hey.length > 0) return { posts: hey.map(enrichPostNiches) };
    } catch {
      /* ignore */
    }

    return { posts: [], notice: 'Lens feed unavailable' };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        lensGraphQL(this.primaryUrl, 'query { __typename }', {}, this.accessToken),
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

import {
  buildUnifiedPost,
  CircuitBreaker,
  CircuitBreakerError,
  enrichPostNiches,
} from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  fetchJson,
  withConcurrencyLimit,
  withRetry,
  withTimeout,
} from '../utils';

export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';
export const BSKY_SOCIAL_URL = 'https://bsky.social';

export const CURATED_BSKY_ACTORS = [
  'jay.bsky.social',
  'naval.bsky.social',
  'balajis.com',
  'vitalik.eth.xyz',
  'a16z.com',
  'coinbase.com',
  'solana.com',
  'joe.bsky.social',
  'shipyard.bsky.social',
  'dappgem.bsky.social',
  'defi.bsky.social',
  'mert.bsky.social',
  'ansem.bsky.social',
  'blknoiz06.bsky.social',
  'pmarca.bsky.social',
  'cdixon.bsky.social',
  'spencernoon.bsky.social',
  'autismcapital.bsky.social',
  'tier10k.bsky.social',
  'karbonbased.bsky.social',
  'lisafed.bsky.social',
  'mollywhite.bsky.social',
  'defiprime.bsky.social',
  'mehowbrian.bsky.social',
  'crypto_birb.bsky.social',
];

export const CRYPTO_SEARCH_QUERIES = [
  'bitcoin OR btc',
  'ethereum OR eth',
  'solana OR sol',
  'crypto',
  'defi',
  'nft',
  'web3',
];

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      type?: string;
      external?: { uri: string; title?: string; description?: string };
      images?: { image: { ref: string }; alt: string }[];
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

function authorToIdentity(author: BskyAuthor): UnifiedIdentity {
  return {
    id: `bluesky:${author.did}`,
    primary: { protocol: 'bluesky', id: author.did },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: author.handle,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: author.displayName || author.handle,
    bio: '',
    avatarUrl: author.avatar || '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { did: author.did },
  };
}

function postToUnifiedPost(post: BskyPostView): UnifiedPost {
  const embeds: { kind: 'image' | 'link'; url: string; meta?: Record<string, unknown> }[] = [];
  if (post.record.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.record.embed.external.uri,
      meta: {
        title: post.record.embed.external.title,
        description: post.record.embed.external.description,
      },
    });
  }
  if (post.record.embed?.images) {
    for (const img of post.record.embed.images) {
      embeds.push({
        kind: 'image',
        url: `https://cdn.bsky.app/img/feed_thumbnail/plain/${img.image.ref}@jpeg`,
      });
    }
  }

  return buildUnifiedPost({
    protocol: 'bluesky',
    nativeId: post.uri,
    author: authorToIdentity(post.author),
    text: post.record.text,
    parentNativeId: post.record.reply?.parent.uri,
    rootNativeId: post.record.reply?.root.uri,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: 0,
    },
    viewer: { liked: false, reposted: false },
    raw: post,
    embeds,
  });
}

async function fetchAuthorFeed(
  baseUrl: string,
  actor: string,
  limit: number,
  accessJwt?: string,
): Promise<BskyPostView[]> {
  const url = buildUrl(baseUrl, '/xrpc/app.bsky.feed.getAuthorFeed', {
    actor,
    limit: String(Math.min(limit, 100)),
  });
  const headers: Record<string, string> = {};
  if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
  const data = await fetchJson<{ feed?: { post: BskyPostView }[]; cursor?: string }>(url, {
    headers,
  });
  return (data.feed ?? []).map((f) => f.post);
}

async function searchPosts(
  baseUrl: string,
  q: string,
  limit: number,
  accessJwt?: string,
): Promise<BskyPostView[]> {
  const url = buildUrl(baseUrl, '/xrpc/app.bsky.feed.searchPosts', {
    q,
    limit: String(Math.min(limit, 100)),
    sort: 'latest',
  });
  const headers: Record<string, string> = {};
  if (accessJwt) headers.authorization = `Bearer ${accessJwt}`;
  const data = await fetchJson<{ posts?: BskyPostView[] }>(url, { headers });
  return data.posts ?? [];
}

export interface BlueskyProviderOptions {
  baseUrl?: string;
  fallbackUrl?: string;
  accessJwt?: string;
  curatedActors?: string[];
}

export class BlueskyProvider implements FeedProvider {
  readonly protocol: Protocol = 'bluesky';
  private readonly primaryUrl: string;
  private readonly fallbackUrl: string;
  private readonly accessJwt?: string;
  private readonly curatedActors: string[];
  private readonly breaker = new CircuitBreaker('bluesky');

  constructor(options: BlueskyProviderOptions = {}) {
    this.primaryUrl = options.baseUrl || BSKY_PUBLIC_URL;
    this.fallbackUrl = options.fallbackUrl || BSKY_SOCIAL_URL;
    this.accessJwt = options.accessJwt;
    this.curatedActors = options.curatedActors ?? CURATED_BSKY_ACTORS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const limit = 50;
        const posts = await withRetry(async () => {
          const all: BskyPostView[] = [];

          // Primary strategy: search crypto terms in parallel. We bound
          // concurrency so a slow relay doesn't multiply latency.
          const queries = CRYPTO_SEARCH_QUERIES.slice(0, 4);
          const searchResults = await withConcurrencyLimit(
            queries,
            Math.min(2, queries.length),
            async (q) => {
              try {
                return await withTimeout(
                  searchPosts(
                    this.primaryUrl,
                    q,
                    Math.max(5, Math.ceil(limit / queries.length)),
                    this.accessJwt,
                  ),
                  timeoutMs,
                  `bluesky:search:${q}`,
                );
              } catch {
                return [];
              }
            },
          );
          for (const r of searchResults) all.push(...r);

          // Fallback: curated crypto actors (only if searches were thin)
          if (all.length < limit / 2) {
            const actors = this.curatedActors.slice(0, 8);
            const actorResults = await withConcurrencyLimit(actors, 3, async (actor) => {
              try {
                return await withTimeout(
                  fetchAuthorFeed(
                    this.primaryUrl,
                    actor,
                    Math.max(3, Math.ceil(limit / actors.length)),
                    this.accessJwt,
                  ),
                  timeoutMs,
                  `bluesky:${actor}`,
                );
              } catch {
                return [];
              }
            });
            for (const r of actorResults) all.push(...r);
          }

          return all;
        });

        return {
          posts: posts.map((p) => enrichPostNiches(postToUnifiedPost(p))),
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'Bluesky: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'Bluesky feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(
          buildUrl(this.primaryUrl, '/xrpc/app.bsky.actor.getProfile', { actor: 'bsky.app' }),
        ),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'bluesky:health',
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

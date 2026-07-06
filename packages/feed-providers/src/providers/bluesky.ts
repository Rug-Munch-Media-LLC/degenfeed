import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  buildUrl,
  fetchJson,
  fetchWithFallbacks,
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

  constructor(options: BlueskyProviderOptions = {}) {
    this.primaryUrl = options.baseUrl || BSKY_PUBLIC_URL;
    this.fallbackUrl = options.fallbackUrl || BSKY_SOCIAL_URL;
    this.accessJwt = options.accessJwt;
    this.curatedActors = options.curatedActors ?? CURATED_BSKY_ACTORS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;

    try {
      const actors = this.curatedActors.slice(0, 12);
      const posts = await withRetry(async () => {
        const primary = await fetchWithFallbacks(
          this.accessJwt ? [this.primaryUrl, this.fallbackUrl] : [this.primaryUrl],
          async (base) => {
            const all: BskyPostView[] = [];
            for (const actor of actors) {
              const p = await withTimeout(
                fetchAuthorFeed(
                  base,
                  actor,
                  Math.max(3, Math.ceil(limit / actors.length)),
                  this.accessJwt,
                ),
                timeoutMs,
                `bluesky:${actor}`,
              );
              all.push(...p);
            }
            return all;
          },
        );
        return primary;
      });

      if (posts.length === 0 && !this.accessJwt) {
        const search = await withTimeout(
          fetchJson<{ actors?: BskyAuthor[] }>(
            buildUrl(this.primaryUrl, '/xrpc/app.bsky.actor.searchActorsTypeahead', {
              q: 'crypto',
              limit: '10',
            }),
            { headers: opts.headers },
          ),
          timeoutMs,
          'bluesky:search',
        );
        const searchActors = (search.actors ?? []).map((a) => a.handle).slice(0, 5);
        for (const actor of searchActors) {
          const p = await withTimeout(
            fetchAuthorFeed(this.primaryUrl, actor, 5),
            timeoutMs,
            `bluesky:${actor}`,
          );
          posts.push(...p);
        }
      }

      return {
        posts: posts.map((p) => enrichPostNiches(postToUnifiedPost(p))),
      };
    } catch (err) {
      return {
        posts: [],
        notice: err instanceof Error ? err.message : 'Bluesky feed unavailable',
      };
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

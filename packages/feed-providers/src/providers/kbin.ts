/**
 * KbinProvider — Fediverse Reddit alternative (ActivityPub, Mastodon-compatible API).
 *
 * Kbin.social and other Kbin instances use the Mastodon API for
 * reading timelines. We hit the public timeline and filter for
 * crypto/tech content. Each Kbin instance also exposes magazine
 * (community) listings at /api/v1/timelines/public.
 *
 * Strategy:
 *   1. Query public timeline from multiple Kbin instances
 *   2. Filter for crypto/tech keywords in post content
 *   3. Extract community context from tags/magazine metadata
 *   4. Return as UnifiedPost with 'kbin' protocol
 */

import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { buildUrl, DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, withTimeout } from '../utils';

export const KBIN_INSTANCES = [
  'https://kbin.social',
  'https://fedia.io',
  'https://lemmings.world',
  'https://kbin.run',
  'https://kbin.earth',
  'https://karab.in',
];

interface KbinPost {
  id: string;
  content: string;
  created_at: string;
  account: {
    id: string;
    username: string;
    display_name?: string;
    avatar?: string;
    url: string;
  };
  tags: string[];
  media_attachments: Array<{
    type: string;
    url: string;
    description?: string;
  }>;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
  url: string;
  magazine?: {
    id: number;
    name: string;
    title: string;
    icon?: string;
    subscribers_count?: number;
  };
}

interface MastodonTimelineResponse extends Array<KbinPost> {}

const CRYPTO_KEYWORDS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'crypto',
  'defi',
  'web3',
  'nft',
  'blockchain',
  'trading',
  'token',
  'altcoin',
  'mining',
  'staking',
  'layer2',
  'dex',
  'dao',
  'metaverse',
  'wallet',
  'airdrop',
  'yield',
  'farcaster',
  'nostr',
  'lens',
  'bluesky',
];

function hasCryptoContent(post: KbinPost): boolean {
  const text = `${post.content} ${post.tags?.join(' ') ?? ''}`.toLowerCase();
  return CRYPTO_KEYWORDS.some((kw) => text.includes(kw));
}

function adaptKbinPost(post: KbinPost, instance: string): UnifiedPost {
  // Strip HTML from content
  const text = post.content.replace(/<[^>]+>/g, '').trim();
  const instanceDomain = instance.replace(/^https?:\/\//, '');

  const magazineName = post.magazine?.name ?? 'general';
  const _nativeId = `kbin:${magazineName}:${post.id}`;

  const author: UnifiedIdentity = {
    id: `kbin:${post.account.id}`,
    primary: { protocol: 'kbin' as Protocol, id: post.account.username },
    handles: { kbin: post.account.username },
    displayName: post.account.display_name || post.account.username,
    bio: '',
    avatarUrl: post.account.avatar || '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  const embeds =
    post.media_attachments?.map((att) => ({
      kind: att.type === 'image' ? ('image' as const) : ('link' as const),
      url: att.url,
    })) ?? [];

  return {
    id: `kbin:${post.id}`,
    protocol: 'kbin' as Protocol,
    author,
    text: text.slice(0, 1500),
    html: post.content,
    embeds,
    createdAt: new Date(post.created_at).getTime(),
    metrics: {
      likes: post.favourites_count ?? 0,
      reposts: post.reblogs_count ?? 0,
      replies: post.replies_count ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.favourites_count ?? 0,
        reposts: post.reblogs_count ?? 0,
        replies: post.replies_count ?? 0,
        quotes: 0,
      },
    },
    community: {
      name: magazineName,
      title: post.magazine?.title ?? magazineName,
      icon: post.magazine?.icon,
      instance: instanceDomain,
      subscriberCount: post.magazine?.subscribers_count ?? 0,
      niche: 'crypto',
    },
    niches: detectNiches(`${text} ${post.tags?.join(' ') ?? ''}`),
    raw: post,
    url: post.url,
    dfUri: `df://kbin/${instanceDomain}/m/${magazineName}/${post.id}`,
  } as UnifiedPost;
}

export class KbinProvider implements FeedProvider {
  readonly protocol: Protocol = 'kbin' as Protocol;
  private readonly instances: string[];

  constructor(instances?: string[]) {
    this.instances = instances ?? KBIN_INSTANCES;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allPosts: UnifiedPost[] = [];

    const results = await Promise.allSettled(
      this.instances.map(async (instance) => {
        try {
          const data = await withTimeout(
            fetchJson<MastodonTimelineResponse>(
              buildUrl(instance, '/api/v1/timelines/public', { limit: '40' }),
              { headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' } },
            ),
            Math.min(timeoutMs, 5000),
            `kbin:${instance}`,
          );
          return (data ?? []).filter(hasCryptoContent).map((post) => adaptKbinPost(post, instance));
        } catch {
          return [] as UnifiedPost[];
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    if (allPosts.length === 0) {
      return { posts: [], notice: 'Kbin unavailable' };
    }
    return { posts: allPosts };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    for (const instance of this.instances) {
      try {
        await withTimeout(
          fetchJson(buildUrl(instance, '/api/v1/instance')),
          opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          `kbin:health:${instance}`,
        );
        return { healthy: true, latencyMs: Math.round(performance.now() - start) };
      } catch {
        /* try next */
      }
    }
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - start),
      error: 'All Kbin instances unreachable',
    };
  }
}

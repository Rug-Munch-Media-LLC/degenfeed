/**
 * RedditAlternativesProvider — Squabbles, Raddle, Discuit.
 *
 * Smaller Reddit alternatives without a unified API pattern.
 * Each uses its own approach:
 *   - Squabbles: RSS feeds (squabbles.io)
 *   - Raddle: JSON API (raddle.it)
 *   - Discuit: Public API (discuit.net)
 *
 * We try all strategies and merge results.
 */

import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, fetchJson, fetchRss, withTimeout } from '../utils';

// ─── Squabbles (RSS-based) ─────────────────────────────────

interface SquabblesConfig {
  community: string;
  niche: string;
}

const SQUABBLES_COMMUNITIES: SquabblesConfig[] = [
  { community: 'crypto', niche: 'crypto' },
  { community: 'technology', niche: 'tech' },
  { community: 'bitcoin', niche: 'bitcoin' },
  { community: 'ethereum', niche: 'ethereum' },
  { community: 'defi', niche: 'defi' },
  { community: 'nft', niche: 'nft' },
  { community: 'trading', niche: 'trading' },
  { community: 'security', niche: 'security' },
  { community: 'ai', niche: 'ai' },
];

const SQUABBLES_BASE = 'https://squabbles.io';

// ─── Raddle (JSON API) ──────────────────────────────────────

interface RaddlePost {
  id: number;
  title: string;
  url: string;
  content: string;
  created_utc: number;
  author: string;
  sub: string;
  upvotes: number;
  downvotes: number;
  num_comments: number;
}

interface RaddleResponse {
  data?: RaddlePost[];
}

const RADDLE_BASE = 'https://raddle.it';

const RADDLE_SUBS = ['crypto', 'cybersecurity', 'technology', 'privacy', 'opensource', 'linux'];

// ─── Discuit (JSON API) ─────────────────────────────────────

interface DiscuitPost {
  id: string;
  title: string;
  content?: string;
  createdAt: string;
  user: { username: string; displayName?: string };
  communityId: string;
  likeCount: number;
  dislikeCount: number;
  replyCount: number;
}

interface DiscuitFeedResponse {
  posts?: DiscuitPost[];
}

const DISCUIT_BASE = 'https://discuit.net';

const DISCUIT_COMMUNITIES = ['crypto', 'ethereum', 'bitcoin', 'technology', 'programming'];

// ─── Parser helpers ─────────────────────────────────────────

function parseRssItems(
  xml: string,
): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const content = m[1] ?? '';
    const title = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
    const link = content.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '';
    const pubDate = content.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? '';
    const description = content.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '';
    if (title) items.push({ title, link: link || '', pubDate, description });
  }
  return items;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Feed Provider ──────────────────────────────────────────

export class RedditAlternativesProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss' as Protocol;

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allPosts: UnifiedPost[] = [];

    // Strategy 1: Squabbles RSS
    const squabblesResults = await Promise.allSettled(
      SQUABBLES_COMMUNITIES.map(async ({ community, niche }) => {
        try {
          const xml = await withTimeout(
            fetchRss(`${SQUABBLES_BASE}/c/${community}.rss`, {
              headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/rss+xml' },
            }),
            Math.min(timeoutMs, 4000),
            `squabbles:${community}`,
          );
          return parseRssItems(xml).map((item) => {
            const text = stripHtml(item.description || item.title || '');
            return {
              id: `squabbles:${community}:${item.link.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`,
              protocol: 'rss' as Protocol,
              author: {
                id: `squabbles:${community}`,
                primary: { protocol: 'rss' as Protocol, id: community },
                handles: {},
                displayName: `squabbles.io/c/${community}`,
                bio: '',
                avatarUrl: '',
                verified: [],
                followerCount: 0,
                followingCount: 0,
                links: [],
                keys: {},
              },
              text: text.slice(0, 1500),
              embeds: [{ kind: 'link' as const, url: item.link }],
              createdAt: new Date(item.pubDate).getTime(),
              metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
              engagement: {
                viewerLiked: false,
                viewerReposted: false,
                viewerBookmarked: false,
                raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
              },
              community: { name: community, title: community, instance: 'squabbles.io', niche },
              niches: [niche],
              raw: item,
              dfUri: `df://squabbles/c/${community}`,
            } as UnifiedPost;
          });
        } catch {
          return [] as UnifiedPost[];
        }
      }),
    );
    for (const r of squabblesResults) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    // Strategy 2: Raddle JSON
    const raddleResults = await Promise.allSettled(
      RADDLE_SUBS.map(async (sub) => {
        try {
          const data = await withTimeout(
            fetchJson<RaddleResponse>(`${RADDLE_BASE}/api/${encodeURIComponent(sub)}`, {
              headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
            }),
            Math.min(timeoutMs, 4000),
            `raddle:${sub}`,
          );
          return (data.data ?? []).map(
            (post) =>
              ({
                id: `raddle:${sub}:${post.id}`,
                protocol: 'rss' as Protocol,
                author: {
                  id: `raddle:${post.author}`,
                  primary: { protocol: 'rss' as Protocol, id: post.author },
                  handles: {},
                  displayName: post.author,
                  bio: '',
                  avatarUrl: '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: {},
                },
                text: `${post.title}\n\n${post.content || ''}`.slice(0, 1500),
                embeds: post.url ? [{ kind: 'link' as const, url: post.url }] : [],
                createdAt: (post.created_utc || Date.now() / 1000) * 1000,
                metrics: {
                  likes: post.upvotes || 0,
                  reposts: 0,
                  replies: post.num_comments || 0,
                  quotes: 0,
                },
                engagement: {
                  viewerLiked: false,
                  viewerReposted: false,
                  viewerBookmarked: false,
                  raw: {
                    likes: post.upvotes || 0,
                    reposts: 0,
                    replies: post.num_comments || 0,
                    quotes: 0,
                  },
                },
                community: { name: sub, title: sub, instance: 'raddle.it', niche: 'crypto' },
                niches: detectNiches(`${post.title} ${post.content || ''}`),
                raw: post,
                dfUri: `df://raddle/${sub}/${post.id}`,
              }) as UnifiedPost,
          );
        } catch {
          return [] as UnifiedPost[];
        }
      }),
    );
    for (const r of raddleResults) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    // Strategy 3: Discuit JSON
    const discuitResults = await Promise.allSettled(
      DISCUIT_COMMUNITIES.map(async (community) => {
        try {
          const data = await withTimeout(
            fetchJson<DiscuitFeedResponse>(
              `${DISCUIT_BASE}/api/communities/${encodeURIComponent(community)}/feed`,
              {
                headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
              },
            ),
            Math.min(timeoutMs, 4000),
            `discuit:${community}`,
          );
          return (data.posts ?? []).map(
            (post) =>
              ({
                id: `discuit:${community}:${post.id}`,
                protocol: 'rss' as Protocol,
                author: {
                  id: `discuit:${post.user.username}`,
                  primary: { protocol: 'rss' as Protocol, id: post.user.username },
                  handles: {},
                  displayName: post.user.displayName || post.user.username,
                  bio: '',
                  avatarUrl: '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: {},
                },
                text: `${post.title}\n\n${post.content || ''}`.slice(0, 1500),
                embeds: [],
                createdAt: new Date(post.createdAt).getTime(),
                metrics: {
                  likes: post.likeCount || 0,
                  reposts: 0,
                  replies: post.replyCount || 0,
                  quotes: 0,
                },
                engagement: {
                  viewerLiked: false,
                  viewerReposted: false,
                  viewerBookmarked: false,
                  raw: {
                    likes: post.likeCount || 0,
                    reposts: 0,
                    replies: post.replyCount || 0,
                    quotes: 0,
                  },
                },
                community: {
                  name: community,
                  title: community,
                  instance: 'discuit.net',
                  niche: 'crypto',
                },
                niches: detectNiches(`${post.title} ${post.content || ''}`),
                raw: post,
                dfUri: `df://discuit/${community}/${post.id}`,
              }) as UnifiedPost,
          );
        } catch {
          return [] as UnifiedPost[];
        }
      }),
    );
    for (const r of discuitResults) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }

    if (allPosts.length === 0) {
      return { posts: [], notice: 'Reddit alternatives unavailable' };
    }
    return { posts: allPosts };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchRss(`${SQUABBLES_BASE}/c/crypto.rss`, {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'reddit-alt:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: 'All Reddit alternatives unreachable',
      };
    }
  }
}

/**
 * ThreadsProvider — HTML scraper for public Threads profiles.
 *
 * Threads does not offer a public API. The internal API requires login.
 * We scrape the public HTML page and extract the embedded JSON state
 * that contains post data. This is brittle — Meta changes page structure
 * frequently. When it breaks, we silently return an empty feed.
 *
 * Strategy:
 *   1. Fetch public profile page (/@handle)
 *   2. Extract the <script> tag containing __INITIAL_STATE__ or similar
 *   3. Parse the JSON and extract posts
 */

import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchText, withTimeout } from '../utils';

export const THREADS_WEB_URL = 'https://www.threads.net';

export const CURATED_THREADS_HANDLES = [
  'zuck',
  'mosseri',
  'vitalik.eth',
  'balajis',
  'sama',
  'naval',
  'jessepollak',
  'stani',
  'sassal0x',
  'cdixon',
  'pmarca',
  'coinbase',
  'opensea',
  'bitcoin',
  'ethereum',
  'solana',
];

interface ThreadsPost {
  id: string;
  text: string;
  createdAt: number;
  likes: number;
  replies: number;
  author?: { username?: string; name?: string; avatar?: string };
}

function threadsHeaders(): Record<string, string> {
  return {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
  };
}

async function scrapeProfile(handle: string, timeoutMs: number): Promise<ThreadsPost[]> {
  const normalized = handle.replace(/^@/, '');
  const url = `${THREADS_WEB_URL}/@${normalized}`;
  try {
    const html = await withTimeout(
      fetchText(url, { headers: threadsHeaders() }),
      Math.min(timeoutMs, 3000),
      `threads:${handle}`,
    );

    // Strategy 1: Extract from JSON-LD (still present for SEO on threads.net)
    const ldMatches = [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
    ];
    for (const m of ldMatches) {
      try {
        const data = JSON.parse(m[1] || '{}');
        if (data.mainEntity?.itemListElement) {
          return data.mainEntity.itemListElement
            .filter((e: Record<string, unknown>) => e.url && e.name)
            .map((e: Record<string, unknown>) => ({
              id: `threads:${normalized}:${e.url || ''}`.slice(0, 128),
              text: String(e.name || ''),
              createdAt: Date.now(),
              likes: e.interactionStatistic?.[0]?.userInteractionCount || 0,
              replies: e.commentCount || 0,
            }));
        }
      } catch {
        continue;
      }
    }

    // Strategy 2: Extract from __INITIAL_STATE__ or similar state blobs
    const stateMatch = html.match(/"thread_items":\s*(\[[^\]]*\])/);
    if (stateMatch) {
      try {
        const items = JSON.parse(stateMatch[1]) as Array<{
          post?: {
            pk?: string;
            code?: string;
            caption?: { text?: string };
            taken_at?: number;
            like_count?: number;
            comment_count?: number;
            user?: { username?: string; full_name?: string; profile_pic_url?: string };
          };
        }>;
        return items
          .filter((p) => p?.post)
          .map((p) => ({
            id: `threads:${p.post!.code || p.post!.pk}`,
            text: p.post!.caption?.text || '',
            createdAt: (p.post!.taken_at || 0) * 1000,
            likes: p.post!.like_count || 0,
            replies: p.post!.comment_count || 0,
            author: p.post!.user
              ? {
                  username: p.post!.user.username,
                  name: p.post!.user.full_name,
                  avatar: p.post!.user.profile_pic_url,
                }
              : undefined,
          }));
      } catch {
        /* structure changed */
      }
    }

    return [];
  } catch {
    return [];
  }
}

export interface ThreadsProviderOptions {
  curatedHandles?: string[];
}

export class ThreadsProvider implements FeedProvider {
  readonly protocol: Protocol = 'threads';
  private readonly curatedHandles: string[];

  constructor(options: ThreadsProviderOptions = {}) {
    this.curatedHandles = options.curatedHandles ?? CURATED_THREADS_HANDLES;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allPosts: UnifiedPost[] = [];

    // Scrape 3 handles per request to keep latency reasonable
    const handles = this.curatedHandles.slice(0, 3);
    const results = await Promise.allSettled(
      handles.map(async (handle) => {
        const posts = await scrapeProfile(handle, timeoutMs);
        return posts.map((p) => {
          const username = p.author?.username || handle;
          return buildUnifiedPost({
            protocol: 'threads',
            nativeId: p.id,
            author: {
              id: `threads:${username}`,
              primary: { protocol: 'threads', id: username },
              handles: {
                nostr: null,
                farcaster: null,
                lens: null,
                bluesky: null,
                threads: username,
                rss: null,
                mastodon: null,
              },
              displayName: p.author?.name || username,
              bio: '',
              avatarUrl: p.author?.avatar || '',
              verified: [],
              followerCount: 0,
              followingCount: 0,
              links: [],
              keys: {},
            },
            text: p.text,
            createdAt: p.createdAt || Date.now(),
            metrics: { likes: p.likes, reposts: 0, replies: p.replies, quotes: 0 },
            raw: p,
          });
        });
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allPosts.push(...r.value);
    }
    return { posts: allPosts.map(enrichPostNiches) };
  }

  async healthCheck(): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(scrapeProfile('zuck', 3000), 4000, 'threads:health');
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: 'Threads scraper failed',
      };
    }
  }
}

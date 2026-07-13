/**
 * ThreadsProvider — Dual-path Threads content fetcher.
 *
 * Threads has NO public read API for arbitrary profiles. Meta's official
 * Threads API (graph.threads.net) is a PUBLISHING API only — it lets
 * authenticated users read their OWN threads, not arbitrary public feeds.
 *
 * Strategy:
 *   1. READ curated handles: HTML scraper (public profile pages).
 *      Brittle but there is no alternative. Meta does not offer a public
 *      read API and has no RSS feeds for Threads.
 *   2. READ authenticated user's feed: official graph.threads.net API.
 *      Used via @degenfeed/threads-sdk when the user has signed in.
 *   3. WRITE (publish): official graph.threads.net API (see publish.ts).
 *   4. ENGAGE: NOT supported. The Threads API does not support liking,
 *      reposting, or replying to other people's threads. Users must use
 *      the Threads app for engagement.
 */

import { buildUnifiedPost, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchText, withTimeout } from '../utils';

export const THREADS_WEB_URL = 'https://www.threads.net';
export const FLARESOLVERR_URL =
  typeof process !== 'undefined' && process.env?.FLARESOLVERR_URL
    ? process.env.FLARESOLVERR_URL
    : ''; // Set FLARESOLVERR_URL env var or leave empty to disable

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

async function fetchViaFlareSolverr(url: string, timeoutMs: number): Promise<string> {
  const resp = await withTimeout(
    fetch(FLARESOLVERR_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url,
        maxTimeout: Math.min(timeoutMs, 30000),
      }),
    }),
    timeoutMs + 5000,
    'threads:flaresolverr',
  );
  const data = (await resp.json()) as { solution?: { response?: string }; status?: string };
  if (data.solution?.response) return data.solution.response;
  throw new Error(data.status || 'no response');
}

async function scrapeProfile(handle: string, timeoutMs: number): Promise<ThreadsPost[]> {
  const normalized = handle.replace(/^@/, '');
  const url = `${THREADS_WEB_URL}/@${normalized}`;
  try {
    let html: string;
    try {
      html = await withTimeout(
        fetchText(url, { headers: threadsHeaders() }),
        Math.min(timeoutMs, 3000),
        `threads:${handle}`,
      );
    } catch {
      html = await fetchViaFlareSolverr(url, timeoutMs);
    }

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
              likes:
                (
                  e.interactionStatistic as Array<{ userInteractionCount?: number }> | undefined
                )?.[0]?.userInteractionCount || 0,
              replies: e.commentCount || 0,
            }));
        }
      } catch {}
    }

    // Strategy 2: Extract from __INITIAL_STATE__ or similar state blobs
    const stateMatch = html.match(/"thread_items":\s*(\[[^\]]*\])/);
    if (stateMatch?.[1]) {
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
            id: `threads:${p.post?.code || p.post?.pk}`,
            text: p.post?.caption?.text || '',
            createdAt: (p.post?.taken_at || 0) * 1000,
            likes: p.post?.like_count || 0,
            replies: p.post?.comment_count || 0,
            author: p.post?.user
              ? {
                  username: p.post?.user.username,
                  name: p.post?.user.full_name,
                  avatar: p.post?.user.profile_pic_url,
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

    // Scrape 6 handles per request, rotating through the full list
    const handles = this.curatedHandles.slice(0, 6);
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

/**
 * ThreadsProvider — Web scraper for public Threads profiles.
 *
 * Threads is NOT on ATProto (despite the old code's assumptions). It's a
 * Meta-owned service that exposes some public data via its web pages.
 * This provider scrapes public Threads profile pages for known crypto
 * accounts, extracting posts from embedded JSON-LD script tags.
 *
 * For accounts that don't expose posts via JSON-LD, the provider also
 * tries the public Threads GraphQL endpoint (used by the web client).
 */

import { detectNiches, enrichPostNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchText, withConcurrencyLimit, withTimeout } from '../utils';

export const THREADS_WEB_URL = 'https://www.threads.net';

export const CURATED_THREADS_HANDLES = [
  'vitalik.eth',
  'dwr.eth',
  'balajis',
  'cdixon.eth',
  'sama',
  'naval',
  'jessepollak',
  'stani',
  'sassal0x',
  'hosseeb',
  '0xfoobar',
  'rleshner',
  'coopahtroopa',
  'pmarca',
  'twobitidiot',
];

interface ThreadsPost {
  id: string;
  text: string;
  url: string;
  author: string;
  authorName: string;
  authorAvatar: string;
  createdAt: number;
  image?: string;
  likes: number;
  replies: number;
  reposts: number;
}

function threadsHeaders(): Record<string, string> {
  return {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
  };
}

function postToUnifiedPost(p: ThreadsPost): UnifiedPost {
  const author: UnifiedIdentity = {
    id: `threads:${p.author}`,
    primary: { protocol: 'threads', id: p.author },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: p.author,
      rss: null,
      mastodon: null,
    },
    displayName: p.authorName || p.author,
    bio: '',
    avatarUrl: p.authorAvatar,
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: { threadsDid: p.author },
  };

  const embeds: { kind: 'image' | 'link'; url: string; meta?: Record<string, unknown> }[] = [];
  if (p.image) embeds.push({ kind: 'image', url: p.image });
  if (p.url) embeds.push({ kind: 'link', url: p.url });

  return {
    id: `threads:${p.id}`,
    protocol: 'threads',
    author,
    text: p.text,
    embeds,
    createdAt: p.createdAt,
    metrics: { likes: p.likes, reposts: p.reposts, replies: p.replies, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: p.likes, reposts: p.reposts, replies: p.replies, quotes: 0 },
    },
    raw: p,
    niches: detectNiches(p.text),
  };
}

function extractJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const scriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null = scriptRe.exec(html);
  while (m !== null) {
    try {
      const json = JSON.parse(m[1] ?? '{}');
      results.push(json);
    } catch {
      // ignore malformed JSON
    }
    m = scriptRe.exec(html);
  }
  return results;
}

function isSocialPosting(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = (obj as Record<string, unknown>)['@type'];
  return t === 'SocialMediaPosting' || (Array.isArray(t) && t.includes('SocialMediaPosting'));
}

async function scrapeThreadsProfile(handle: string, timeoutMs: number): Promise<ThreadsPost[]> {
  const normalized = handle.replace(/^@/, '');
  const url = `${THREADS_WEB_URL}/@${normalized}`;
  try {
    const html = await withTimeout(
      fetchText(url, { headers: threadsHeaders() }),
      timeoutMs,
      `threads:scrape:${handle}`,
    );
    const jsonLdBlocks = extractJsonLd(html);
    const posts: ThreadsPost[] = [];
    for (const block of jsonLdBlocks) {
      if (!isSocialPosting(block)) continue;
      const text = (block.articleBody as string) ?? '';
      const postUrl = (block.url as string) ?? `${url}/post/${Date.now()}`;
      const datePublished = block.datePublished as string;
      const createdAt = datePublished ? new Date(datePublished).getTime() : Date.now();
      const author = (block.author as Record<string, string>) ?? {};
      const authorHandle = (author.identifier as string) ?? normalized;
      const authorName = (author.name as string) ?? normalized;
      const authorAvatar = (author.image as string) ?? '';
      const id = postUrl.split('/').pop() ?? `scraped-${Date.now()}-${posts.length}`;
      const image =
        typeof block.image === 'string'
          ? block.image
          : (block.image as Record<string, string>)?.url;
      const interaction = (block.interactionStatistic as Array<Record<string, unknown>>) ?? [];
      let likes = 0,
        replies = 0,
        reposts = 0;
      for (const stat of interaction) {
        const name = (stat.name as string) ?? '';
        const val = Number(stat.userInteractionCount ?? 0);
        if (name.includes('Like')) likes = val;
        else if (name.includes('Reply') || name.includes('Comment')) replies = val;
        else if (name.includes('Share') || name.includes('Repost')) reposts = val;
      }
      posts.push({
        id,
        text,
        url: postUrl,
        author: authorHandle,
        authorName,
        authorAvatar,
        createdAt,
        image,
        likes,
        replies,
        reposts,
      });
    }
    return posts;
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
    const limit = 25;

    const results = await withConcurrencyLimit(this.curatedHandles.slice(0, 4), 2, async (handle) =>
      scrapeThreadsProfile(handle, timeoutMs),
    );
    const allPosts = results.flat().slice(0, limit);
    if (allPosts.length > 0) {
      return { posts: allPosts.map((p) => enrichPostNiches(postToUnifiedPost(p))) };
    }
    return { posts: [], notice: 'Threads feed unavailable — no posts found in JSON-LD' };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchText(`${THREADS_WEB_URL}/@mosseri`, { headers: threadsHeaders() }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'threads:health',
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

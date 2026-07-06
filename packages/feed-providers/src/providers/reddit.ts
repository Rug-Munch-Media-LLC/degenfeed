import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  fetchRss,
  fetchWithFallbacks,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

export const DEFAULT_SUBREDDITS = [
  'CryptoCurrency',
  'Bitcoin',
  'ethereum',
  'solana',
  'defi',
  'NFTs',
  'CryptoMarkets',
  'technology',
];

export const LIBREDDIT_INSTANCES = [
  'https://teddit.net',
  'https://libreddit.kavin.rocks',
  'https://lr.vern.cc',
];

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  author?: string;
  categories?: string[];
}

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /\u003citem([^\u003e]*)\u003e([\s\S]*?)\u003c\/item\u003e/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const extract = (tag: string) => {
      const re = new RegExp(
        `\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`,
        'i',
      );
      const match = itemXml.match(re);
      return match ? stripHtml(match[1] ?? '') : '';
    };
    const title = extract('title');
    const link = extract('link');
    if (title && link) {
      items.push({
        title,
        link,
        pubDate: extract('pubDate'),
        contentSnippet: extract('description'),
        author: extract('author') || extract('dc:creator'),
        categories: [],
      });
    }
  }
  return items;
}

function itemToUnifiedPost(item: RssItem, subreddit: string): UnifiedPost {
  const text = item.contentSnippet ?? item.title ?? '';
  const author: UnifiedIdentity = {
    id: `reddit:r:${subreddit}`,
    primary: { protocol: 'rss', id: `reddit:r:${subreddit}` },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: `r/${subreddit}`,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'subreddit', url: `https://old.reddit.com/r/${subreddit}` }],
    keys: {},
  };

  return {
    id: `reddit:${subreddit}:${item.link?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? Date.now()}`,
    protocol: 'rss',
    author,
    text: `${item.title ?? ''}\n\n${text}`.slice(0, 1000),
    embeds: item.link ? [{ kind: 'link', url: item.link }] : [],
    createdAt: parseDate(item.pubDate),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: item,
    niches: detectNiches(text),
  };
}

async function fetchRedditRss(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  const path = `/r/${encodeURIComponent(subreddit)}/hot.rss?limit=${Math.min(limit, 100)}`;
  return fetchWithFallbacks(['https://old.reddit.com', 'https://www.reddit.com'], async (base) => {
    const xml = await fetchRss(`${base}${path}`, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
    return parseRss(xml).map((item) => itemToUnifiedPost(item, subreddit));
  });
}

interface RedditJsonPost {
  data: {
    title: string;
    permalink: string;
    url: string;
    created_utc: number;
    selftext?: string;
    author?: string;
    subreddit?: string;
  };
}

async function fetchRedditJson(subreddit: string, limit: number): Promise<UnifiedPost[]> {
  const url = buildUrl('https://www.reddit.com', `/r/${encodeURIComponent(subreddit)}/hot.json`, {
    limit: String(Math.min(limit, 100)),
  });
  const data = await fetchJson<{ data?: { children?: RedditJsonPost[] } }>(url, {
    headers: { 'user-agent': DEFAULT_USER_AGENT },
  });
  return (data.data?.children ?? []).map((child) => {
    const d = child.data;
    const sub = d.subreddit ?? subreddit;
    const link = d.url?.startsWith('/r/') ? `https://www.reddit.com${d.url}` : d.url;
    const item: RssItem = {
      title: d.title,
      link: `https://www.reddit.com${d.permalink}`,
      contentSnippet: d.selftext,
      author: d.author,
    };
    const post = itemToUnifiedPost(item, sub);
    if (link) post.embeds.unshift({ kind: 'link', url: link });
    post.createdAt = d.created_utc * 1000;
    return post;
  });
}

export interface RedditProviderOptions {
  subreddits?: string[];
}

export class RedditProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly subreddits: string[];

  constructor(options: RedditProviderOptions = {}) {
    this.subreddits = options.subreddits ?? DEFAULT_SUBREDDITS;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;

    const results = await withConcurrencyLimit(
      this.subreddits,
      opts.concurrency ?? 4,
      async (sub) => {
        try {
          return await withTimeout(
            fetchRedditRss(sub, Math.ceil(limit / this.subreddits.length)),
            timeoutMs,
            `reddit:${sub}`,
          );
        } catch {
          try {
            return await withTimeout(
              fetchRedditJson(sub, Math.ceil(limit / this.subreddits.length)),
              timeoutMs,
              `reddit:json:${sub}`,
            );
          } catch {
            return [];
          }
        }
      },
    );

    const posts = results.flat().slice(0, limit);
    if (posts.length > 0) return { posts };

    return { posts: [], notice: 'Reddit feed unavailable' };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchRss('https://old.reddit.com/r/Bitcoin/hot.rss?limit=1', {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'reddit:health',
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

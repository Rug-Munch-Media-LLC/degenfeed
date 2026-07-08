/**
 * RedditProvider — Multi-strategy Reddit fetcher.
 *
 * Reddit blocks direct API access from CF Workers (no auth, bad UA).
 * Strategy:
 *   1. Reddit's own RSS feeds at www.reddit.com/r/{sub}/.rss (public, needs proper UA)
 *   2. Open-source Reddit frontends: libreddit/teddit instances (CORS-friendly)
 *   3. JSON API at www.reddit.com with proper User-Agent
 *
 * All strategies set a browser-like User-Agent. RSS is preferred — it's
 * public, no auth, and parses cleanly.
 */

import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  fetchJson,
  fetchRss,
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
  'btc',
  'ethtrader',
  'solanatrader',
  'NFTMarketplace',
  'uniswap',
  'aave',
  'defi_bluechips',
  'BitcoinMining',
  'web3dev',
  'defi_yield',
  'ethdev',
  'polygon',
  'optimism',
  'cryptobounties',
  'cryptotrader',
  'Crypto_General',
  'cryptomining',
  // ── Tech / Programming ─────────────────────────────────────────
  'programming',
  'rust',
  'golang',
  'python',
  'typescript',
  'javascript',
  'MachineLearning',
  'artificial',
  'LocalLLaMA',
  'OpenAI',
  'ChatGPT',
  'stableDiffusion',
  'datascience',
  'learnmachinelearning',
  'computerscience',
  'cybersecurity',
  'netsec',
  'hacking',
  'ReverseEngineering',
  'devops',
  'kubernetes',
  'docker',
  'linux',
  'selfhosted',
  'homelab',
  // ── Science / Engineering ──────────────────────────────────────
  'science',
  'space',
  'physics',
  'Futurology',
  'singularity',
  'robotics',
  'energy',
  'nuclear',
  'climatescience',
  // ── Finance / Economics ────────────────────────────────────────
  'stocks',
  'investing',
  'wallstreetbets',
  'economics',
  'finance',
  'personalfinance',
  'quant',
  'algotrading',
  // ── Tech News / Discussion ─────────────────────────────────────
  'startups',
  'entrepreneur',
  'SideProject',
  'SaaS',
  'webdev',
  'frontend',
  'opensource',
  'github',
];

// Self-hosted Redlib on Talos (primary). Falls back to community instances.
const SELF_HOSTED_REDLIB =
  typeof process !== 'undefined'
    ? (process.env?.REDLIB_URL ?? 'http://127.0.0.1:8281')
    : 'http://127.0.0.1:8281';

const COMMUNITY_REDDIT_FRONTENDS = [
  'https://libreddit.kavin.rocks',
  'https://libreddit.privacydev.net',
  'https://lr.vern.cc',
  'https://red.ngn.tf',
];

const REDDIT_FRONTENDS = [SELF_HOSTED_REDLIB, ...COMMUNITY_REDDIT_FRONTENDS];

// Reddit's own RSS feeds — these are public, no auth needed.
// We use www.reddit.com (old.reddit.com is deprecated).
const REDDIT_RSS_BASE = 'https://www.reddit.com';

function redditHeaders(): Record<string, string> {
  return {
    'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/1.0; +https://degenfeed.xyz)',
    accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*',
  };
}

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  contentSnippet?: string;
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
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);
  while (m !== null) {
    const entryXml = m[2] ?? '';
    const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["']/i);
    const pubDateMatch =
      entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ??
      entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
    const contentMatch =
      entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ??
      entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (titleMatch && linkMatch) {
      items.push({
        title: stripHtml(titleMatch[1] ?? ''),
        link: linkMatch[1] ?? '',
        pubDate: pubDateMatch?.[1]?.trim(),
        description: stripHtml(contentMatch?.[1] ?? ''),
        content: contentMatch?.[1] ?? '',
      });
    }
    m = itemRe.exec(xml);
  }

  if (items.length === 0) {
    const rssItemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let rm: RegExpExecArray | null = rssItemRe.exec(xml);
    while (rm !== null) {
      const itemXml = rm[1] ?? '';
      const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      if (titleMatch && linkMatch) {
        items.push({
          title: stripHtml(titleMatch[1] ?? ''),
          link: stripHtml(linkMatch[1] ?? ''),
          pubDate: pubDateMatch?.[1]?.trim(),
          description: stripHtml(descMatch?.[1] ?? ''),
        });
      }
      rm = rssItemRe.exec(xml);
    }
  }

  return items;
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
    score?: number;
    num_comments?: number;
  };
}

function itemToUnifiedPost(item: RssItem, subreddit: string, score = 0, comments = 0): UnifiedPost {
  const text = item.contentSnippet || item.description || item.title || '';
  const author: UnifiedIdentity = {
    id: `reddit:r:${subreddit}`,
    primary: { protocol: 'reddit' as Protocol, id: subreddit },
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
    bio: item.author ? `Posted by u/${item.author}` : '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'subreddit', url: `https://www.reddit.com/r/${subreddit}` }],
    keys: {},
  };

  const id = item.link
    ? `reddit:${subreddit}:${item.link.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}`
    : `reddit:${subreddit}:${Date.now()}`;

  return {
    id,
    protocol: 'reddit' as Protocol,
    author,
    text: `${item.title ?? ''}\n\n${text}`.slice(0, 1500),
    embeds: item.link ? [{ kind: 'link', url: item.link }] : [],
    createdAt: parseDate(item.pubDate),
    metrics: { likes: score, reposts: 0, replies: comments, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: score, reposts: 0, replies: comments, quotes: 0 },
    },
    raw: item,
    niches: detectNiches(`${item.title ?? ''} ${text} r/${subreddit}`),
  };
}

interface FrontendListing {
  posts: Array<{
    title?: string;
    url?: string;
    permalink?: string;
    selftext?: string;
    author?: string;
    subreddit?: string;
    score?: number;
    num_comments?: number;
    created?: number;
    created_utc?: number;
  }>;
}

/**
 * Strategy 1: Open-source Reddit frontends (libreddit, teddit).
 * These are community-run instances that proxy Reddit's API without auth.
 * Returns JSON with post data.
 */
async function fetchFromFrontend(
  frontend: string,
  subreddit: string,
  sort: string,
  limit: number,
): Promise<UnifiedPost[]> {
  const path = sort === 'hot' ? '' : sort === 'new' ? '/new' : sort === 'top' ? '/top' : '';
  const url = `${frontend}/r/${encodeURIComponent(subreddit)}${path}.json?limit=${Math.min(limit, 50)}`;
  const data = await fetchJson<FrontendListing>(url, { headers: redditHeaders() });
  return (data.posts ?? []).map((p) => {
    const sub = p.subreddit ?? subreddit;
    const link = p.permalink
      ? p.permalink.startsWith('http')
        ? p.permalink
        : `${frontend}${p.permalink}`
      : (p.url ?? `https://www.reddit.com/r/${sub}`);
    const item: RssItem = {
      title: p.title,
      link,
      contentSnippet: p.selftext,
      author: p.author,
    };
    const post = itemToUnifiedPost(item, sub, p.score ?? 0, p.num_comments ?? 0);
    post.createdAt = (p.created_utc ?? p.created ?? Date.now() / 1000) * 1000;
    return post;
  });
}

/**
 * Strategy 2: Reddit's own JSON API with proper User-Agent.
 * www.reddit.com serves JSON if you send a browser-like User-Agent.
 */
async function fetchFromRedditJson(
  subreddit: string,
  sort: string,
  limit: number,
): Promise<UnifiedPost[]> {
  const sortPath = sort === 'new' ? 'new' : sort === 'top' ? 'top' : 'hot';
  const url = buildUrl(REDDIT_RSS_BASE, `/r/${encodeURIComponent(subreddit)}/${sortPath}.json`, {
    limit: String(Math.min(limit, 50)),
  });
  const data = await fetchJson<{ data?: { children?: RedditJsonPost[] } }>(url, {
    headers: redditHeaders(),
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
    const post = itemToUnifiedPost(item, sub, d.score ?? 0, d.num_comments ?? 0);
    if (link) post.embeds.unshift({ kind: 'link', url: link });
    post.createdAt = d.created_utc * 1000;
    return post;
  });
}

/**
 * Strategy 3: Reddit's own RSS feed at www.reddit.com.
 * Public, no auth, parses cleanly.
 */
async function fetchFromRedditRss(
  subreddit: string,
  sort: string,
  limit: number,
): Promise<UnifiedPost[]> {
  const sortPath = sort === 'new' ? 'new' : sort === 'top' ? 'top' : 'hot';
  const xml = await fetchRss(
    `${REDDIT_RSS_BASE}/r/${encodeURIComponent(subreddit)}/${sortPath}/.rss?limit=${Math.min(limit, 50)}`,
    { headers: redditHeaders() },
  );
  return parseRssXml(xml).map((item) => itemToUnifiedPost(item, subreddit));
}

/**
 * Fetch from a single subreddit using all available strategies in parallel.
 * Returns the first non-empty result.
 */
async function fetchSubreddit(
  subreddit: string,
  sort: string,
  limit: number,
  timeoutMs: number,
): Promise<UnifiedPost[]> {
  // Try all strategies in parallel, pick the first non-empty result
  const strategies: Array<{ name: string; fn: () => Promise<UnifiedPost[]> }> = [
    { name: 'rss', fn: () => fetchFromRedditRss(subreddit, sort, limit) },
    { name: 'json', fn: () => fetchFromRedditJson(subreddit, sort, limit) },
    ...REDDIT_FRONTENDS.map((frontend) => ({
      name: `frontend:${frontend}`,
      fn: () => fetchFromFrontend(frontend, subreddit, sort, limit),
    })),
  ];

  const results = await Promise.allSettled(
    strategies.map((s) => withTimeout(s.fn(), timeoutMs, `reddit:${s.name}`)),
  );

  // Return the first strategy that produced posts
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      return r.value;
    }
  }
  return [];
}

export interface RedditProviderOptions {
  subreddits?: string[];
  sort?: 'hot' | 'new' | 'top';
}

export class RedditProvider implements FeedProvider {
  readonly protocol: Protocol = 'reddit';
  private readonly subreddits: string[];
  private readonly sort: 'hot' | 'new' | 'top';

  constructor(options: RedditProviderOptions = {}) {
    this.subreddits = options.subreddits ?? DEFAULT_SUBREDDITS;
    this.sort = options.sort ?? 'hot';
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const limit = 50;
    const perSub = Math.ceil(limit / this.subreddits.length);

    const results = await withConcurrencyLimit(this.subreddits, 4, async (sub) => {
      try {
        return await fetchSubreddit(sub, this.sort, perSub, timeoutMs);
      } catch {
        return [] as UnifiedPost[];
      }
    });

    const posts = results.flat().slice(0, limit);
    if (posts.length > 0) return { posts };
    return { posts: [], notice: 'Reddit feed unavailable — all strategies failed' };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      const xml = await withTimeout(
        fetchRss(`${REDDIT_RSS_BASE}/r/Bitcoin/hot/.rss?limit=1`, { headers: redditHeaders() }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'reddit:health',
      );
      if (xml && xml.length > 50) {
        return { healthy: true, latencyMs: Date.now() - start };
      }
      return { healthy: false, latencyMs: Date.now() - start, error: 'empty response' };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}

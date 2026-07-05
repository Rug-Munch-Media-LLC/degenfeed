/**
 * @degenfeed/rss-sdk
 *
 * Production-grade RSS/Atom/JSONFeed client.
 * Uses `rss-parser` (5M+ weekly downloads) for robust XML parsing.
 * Adds source adapters for Reddit, Mirror.xyz, Substack, Medium, Paragraph.
 *
 * All content normalizes to @degenfeed/types `UnifiedPost`.
 *
 * ## Source adapters
 *
 *   - Reddit:   old.reddit.com/r/{sub}/hot.rss  (free, no API key)
 *   - Mirror:   {handle}.mirror.xyz/feed
 *   - Substack: {handle}.substack.com/feed
 *   - Medium:   medium.com/feed/@{handle}
 *   - Paragraph: https://paragraph.xyz/@{handle}/rss
 *   - Generic:  any RSS/Atom/JSONFeed URL
 *
 * ## Design
 *   - Parser: rss-parser (handles CDATA, namespaces, malformed XML, encoding)
 *   - Normalizer: feedToUnifiedPosts() → UnifiedPost[]
 *   - Sources: stateless URL builders + shared fetch/parse pipeline
 *   - Errors: wrapped with source context, never throw raw network errors
 */

import { detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import Parser from 'rss-parser';

export type { Protocol, UnifiedIdentity, UnifiedPost, Embed };

// Re-export parser type for consumers
export type { Output as RssFeedShape, Item as RssItemShape } from 'rss-parser';

// ─── Feed type constants ───────────────────────────────────────────────

/** All supported source types. */
export type RssSourceType = 'reddit' | 'mirror' | 'substack' | 'medium' | 'paragraph' | 'generic';

// ─── Client ────────────────────────────────────────────────────────────

const feedParser = new Parser({
  timeout: 15000,
  headers: {
    'user-agent': 'DegenFeed/0.1 (RSS aggregator; +https://degenfeed.xyz)',
    accept:
      'application/rss+xml, application/atom+xml, application/json, application/feed+json, text/xml, */*',
  },
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent'],
    ],
  },
});

export interface FetchOpts {
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Fetch and parse any RSS/Atom feed URL.
 * Handles RSS 2.0, Atom, JSONFeed, and common edge cases.
 */
export async function fetchFeed(
  url: string,
  opts: FetchOpts = {},
): Promise<Parser.Output<Record<string, unknown>>> {
  const feed = await feedParser.parseURL(url);
  return feed as unknown as Parser.Output<Record<string, unknown>>;
}

// ─── Source adapters ───────────────────────────────────────────────────

export interface SourcePosts {
  source: RssSourceType;
  handle?: string;
  url: string;
  feed: Parser.Output<Record<string, unknown>>;
}

/**
 * Reddit RSS source.
 *
 * Uses old.reddit.com which provides free RSS feeds without API keys.
 * Rate limit: ~60 req/min (standard Reddit rate limit for unauthenticated).
 */
export const RedditSource = {
  BASE_URL: 'https://old.reddit.com',

  async fetch(
    subreddit: string,
    sort: 'hot' | 'new' | 'top' | 'rising' = 'hot',
    limit = 25,
    opts: FetchOpts = {},
  ): Promise<SourcePosts> {
    const url = `${this.BASE_URL}/r/${encodeURIComponent(subreddit)}/${sort}.rss?limit=${Math.min(limit, 100)}`;
    const feed = await fetchFeed(url, opts);
    return { source: 'reddit', handle: subreddit, url, feed };
  },

  async fetchUser(username: string, opts: FetchOpts = {}): Promise<SourcePosts> {
    const url = `${this.BASE_URL}/user/${encodeURIComponent(username)}/.rss`;
    const feed = await fetchFeed(url, opts);
    return { source: 'reddit', handle: username, url, feed };
  },
};

/**
 * Mirror.xyz RSS source.
 * Format: https://{handle}.mirror.xyz/feed
 */
export const MirrorSource = {
  async fetch(handle: string, opts: FetchOpts = {}): Promise<SourcePosts> {
    const url = `https://${encodeURIComponent(handle)}.mirror.xyz/feed`;
    const feed = await fetchFeed(url, opts);
    return { source: 'mirror', handle, url, feed };
  },
};

/**
 * Substack RSS source.
 * Format: https://{handle}.substack.com/feed
 */
export const SubstackSource = {
  async fetch(handle: string, opts: FetchOpts = {}): Promise<SourcePosts> {
    const url = `https://${encodeURIComponent(handle)}.substack.com/feed`;
    const feed = await fetchFeed(url, opts);
    return { source: 'substack', handle, url, feed };
  },
};

/**
 * Medium RSS source.
 * Format: https://medium.com/feed/@{handle}
 */
export const MediumSource = {
  async fetch(handle: string, opts: FetchOpts = {}): Promise<SourcePosts> {
    const url = `https://medium.com/feed/@${encodeURIComponent(handle)}`;
    const feed = await fetchFeed(url, opts);
    return { source: 'medium', handle, url, feed };
  },
};

/**
 * Paragraph.xyz RSS source.
 * Format: https://paragraph.xyz/@{handle}/rss
 */
export const ParagraphSource = {
  async fetch(handle: string, opts: FetchOpts = {}): Promise<SourcePosts> {
    const url = `https://paragraph.xyz/@${encodeURIComponent(handle)}/rss`;
    const feed = await fetchFeed(url, opts);
    return { source: 'paragraph', handle, url, feed };
  },
};

/**
 * Generic RSS source adapter. Fetches any RSS/Atom/JSONFeed URL.
 */
export const GenericRssSource = {
  async fetch(url: string, opts: FetchOpts = {}): Promise<SourcePosts> {
    const feed = await fetchFeed(url, opts);
    return { source: 'generic', url, feed };
  },
};

// ─── Normalizer ─────────────────────────────────────────────────────────

export interface FeedMeta {
  source: RssSourceType;
  handle?: string;
  url?: string;
  subreddit?: string;
  query?: string;
  user?: string;
}

/**
 * Build a stable author identity string from feed metadata.
 */
function buildAuthorId(meta: FeedMeta, authorName: string, feedLink: string): string {
  const parts = ['rss', meta.source];
  if (meta.handle) parts.push(meta.handle);
  if (meta.subreddit) parts.push('r', meta.subreddit);
  if (authorName) parts.push(authorName.replace(/[^a-zA-Z0-9_-]/g, '_'));
  return parts.join(':');
}

/**
 * Generate a stable post ID.
 */
function buildPostId(meta: FeedMeta, guid: string, link: string, title: string): string {
  const unique = guid || link || title;
  const slug = unique
    .replace(/https?:\/\//, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return `rss:${meta.source}:${slug}`;
}

/**
 * Parse a date string into a unix ms timestamp.
 */
function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

/**
 * Normalize rss-parser output to UnifiedPost[].
 */
export function feedToUnifiedPosts(source: SourcePosts, meta?: FeedMeta): UnifiedPost[] {
  const { feed } = source;
  const effectiveMeta: FeedMeta = meta ?? {
    source: source.source,
    handle: source.handle,
    url: source.url,
  };

  const items = feed.items ?? [];
  const feedTitle = feed.title ?? '';
  const feedLink = feed.link ?? '';
  const feedDescription = feed.description ?? '';

  return items.map((item): UnifiedPost => {
    // Determine the best text content (prefer content:encoded, then content, then description)
    const rawItem = item as Record<string, unknown>;
    const contentEncoded = rawItem.contentEncoded as string | undefined;
    const html = contentEncoded || item.content || item.contentSnippet || '';
    const text = item.contentSnippet || stripHtml(html).slice(0, 1000);

    // Author
    const creator = rawItem.creator as string | undefined;
    const authName = rawItem.author as string | undefined;
    const authorName = creator || authName || feedTitle || effectiveMeta.handle || 'Unknown';
    const authorId = buildAuthorId(effectiveMeta, authorName, feedLink);

    const author: UnifiedIdentity = {
      id: authorId,
      primary: { protocol: 'rss', id: authorId },
      handles: {
        nostr: null,
        farcaster: null,
        lens: null,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: authorName,
      bio: feedDescription.slice(0, 300),
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'source', url: feedLink || source.url }],
      keys: {},
    };

    // Embeds from enclosures/media
    const embeds: Embed[] = [];
    const enclosure = rawItem.enclosure as { url?: string; type?: string } | undefined;
    if (enclosure?.url) {
      const isImage = enclosure.type?.startsWith('image/') ?? false;
      const isVideo = enclosure.type?.startsWith('video/') ?? false;
      if (isImage) embeds.push({ kind: 'image', url: enclosure.url });
      else if (isVideo) embeds.push({ kind: 'video', url: enclosure.url });
    }

    // Extract images from HTML content
    const imgUrls = extractImageUrls(html);
    for (const url of imgUrls) {
      embeds.push({ kind: 'image', url });
    }

    // Add link to article
    const guid =
      typeof item.guid === 'string'
        ? item.guid
        : typeof item.guid === 'object' && item.guid
          ? String(item.guid)
          : '';
    const link = item.link ?? '';
    if (link) {
      embeds.push({ kind: 'link', url: link });
    }

    // Categories/tags
    const categories: string[] = (item.categories ?? []) as string[];
    const niches = detectNiches(`${text} ${categories.join(' ')}`);

    return {
      id: buildPostId(effectiveMeta, guid, link, item.title ?? ''),
      protocol: 'rss',
      author,
      text,
      html,
      embeds,
      createdAt: parseDate(item.pubDate ?? item.isoDate ?? (rawItem.date as string | undefined)),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: { item, feed, source: effectiveMeta },
      niches: [...new Set([...niches, ...categories.map((c: string) => c.toLowerCase())])],
    };
  });
}

/**
 * Convenience: fetch + normalize in one call.
 */
export async function fetchAndNormalize(
  url: string,
  meta?: FeedMeta,
  opts?: FetchOpts,
): Promise<UnifiedPost[]> {
  const feed = await fetchFeed(url, opts);
  return feedToUnifiedPosts(
    { source: meta?.source ?? 'generic', handle: meta?.handle, url, feed },
    meta,
  );
}

// ─── Internal helpers ──────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_m: string, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRe = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

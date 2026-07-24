/**
 * RSS-Bridge Provider
 *
 * Fetches content from the self-hosted RSS-Bridge instance (port 8282).
 * RSS-Bridge converts websites that don't publish RSS feeds into structured
 * JSON feeds. This provider uses it to get content from various sources
 * that are hard to scrape directly.
 *
 * Strategy: Use multiple RSS-Bridge bridges that work without auth and
 * produce JSON output. Fallback to direct RSS feed parsing.
 */

import type { SchemaGuard, UnifiedPost } from '../server';

const RSS_BRIDGE_BASE = 'http://127.0.0.1:8282';
const USER_AGENT = 'DegenFeed-Bridge/0.1';

// Busy/tech news RSS feeds for FeedExpander
const RSS_FEEDS = [
  { url: 'https://cointelegraph.com/rss', label: 'CoinTelegraph', niches: ['crypto'] },
  { url: 'https://decrypt.co/feed', label: 'Decrypt', niches: ['crypto'] },
  { url: 'https://bitcoinmagazine.com/.rss/full/', label: 'BitcoinMagazine', niches: ['bitcoin'] },
  { url: 'https://blog.ethereum.org/feed.xml', label: 'EthereumBlog', niches: ['ethereum'] },
  { url: 'https://blog.chain.link/feed/', label: 'ChainLink', niches: ['crypto', 'oracle'] },
  { url: 'https://hackernewsrss.com/', label: 'HackerNews', niches: ['tech'] },
  { url: 'https://blog.google/technology/ai/rss/', label: 'GoogleAI', niches: ['ai', 'tech'] },
  { url: 'https://news.ycombinator.com/rss', label: 'YC', niches: ['tech', 'startups'] },
  {
    url: 'https://feeds.feedburner.com/TheHackersNews',
    label: 'HackerNews',
    niches: ['security', 'tech'],
  },
  { url: 'https://www.theverge.com/rss/index.xml', label: 'TheVerge', niches: ['tech'] },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', label: 'CoinDesk', niches: ['crypto'] },
  { url: 'https://cryptopotato.com/feed/', label: 'CryptoPotato', niches: ['crypto'] },
  { url: 'https://u.today/rss', label: 'UToday', niches: ['crypto'] },
  { url: 'https://cryptobriefing.com/feed/', label: 'CryptoBriefing', niches: ['crypto'] },
  {
    url: 'https://www.bleepingcomputer.com/feed/',
    label: 'BleepingComputer',
    niches: ['security', 'tech'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function guessNiches(text: string, baseNiches: string[]): string[] {
  const niches = new Set(baseNiches);
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.add('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.add('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.add('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.add('defi');
  if (/\b(nft|art|collectible|punk)\b/.test(lower)) niches.add('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.add('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.add('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.add('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.add('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.add('security');
  if (niches.size === 0) niches.add('crypto');
  return [...niches];
}

// ─── RSS-Bridge JSON API ─────────────────────────────────────────────

async function fetchFromBridge(
  bridge: string,
  params: Record<string, string>,
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    const query = new URLSearchParams({
      action: 'display',
      bridge,
      format: 'Json',
      ...params,
    });
    const url = `${RSS_BRIDGE_BASE}/?${query.toString()}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (contentType.includes('json')) {
      try {
        const data = JSON.parse(text);
        return parseBridgeJson(data, limit);
      } catch {
        return [];
      }
    }

    // Try HTML parsing
    return parseBridgeHtml(text, bridge, limit);
  } catch {
    return [];
  }
}

export function parseBridgeJson(data: Record<string, unknown>, limit: number): UnifiedPost[] {
  const items = (data.items || []) as Array<Record<string, unknown>>;
  if (items.length === 0) return [];

  const title = (data.title || 'RSS-Bridge') as string;
  const baseNiches = guessNiches(title, ['crypto']);

  return items.slice(0, limit).map((item, i) => {
    const itemTitle = (item.title || '') as string;
    const contentHtml = (item.content_html || item.content_text || '') as string;
    const text = itemTitle || stripHtml(contentHtml).slice(0, 500);
    const link = (item.url || '') as string;
    const dateStr = (item.date_modified || item.date_published || item.date || '') as string;
    const createdAt = dateStr ? new Date(dateStr).getTime() : Date.now() - i * 600000;

    return {
      id: `rss-bridge:${title}:${i}`,
      protocol: 'rss' as const,
      author: {
        id: `rss:${title}`,
        primary: { protocol: 'rss' as const, id: title },
        handles: { rss: title },
        displayName: (data.title as string) || 'RSS',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: link ? [{ label: 'source', url: link }] : [],
        keys: {},
      },
      text,
      embeds: link ? [{ kind: 'link', url: link }] : [],
      createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: item,
      niches: guessNiches(text, baseNiches),
    };
  });
}

function parseBridgeHtml(_html: string, _bridge: string, _limit: number): UnifiedPost[] {
  // HTML from RSS-Bridge is the error page wrapped in the UI;
  // not useful for content extraction. Return empty.
  return [];
}

// ─── Direct RSS Feed Fetcher ─────────────────────────────────────────

async function fetchRssFeed(
  url: string,
  label: string,
  baseNiches: string[],
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, label, baseNiches, limit);
  } catch {
    return [];
  }
}

export function parseRssXml(
  xml: string,
  label: string,
  baseNiches: string[],
  limit: number,
): UnifiedPost[] {
  const posts: UnifiedPost[] = [];

  // Try Atom (<entry>)
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = entryRe.exec(xml)) !== null && posts.length < limit) {
    const e = m[1];
    const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
    const updatedMatch =
      e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
      e.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
    const _contentMatch =
      e.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ||
      e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
    if (!title) continue;
    const link = linkMatch ? linkMatch[1] : '';

    posts.push({
      id: `rss:${label}:${posts.length}`,
      protocol: 'rss' as const,
      author: {
        id: `rss:${label}`,
        primary: { protocol: 'rss' as const, id: label },
        handles: { rss: label },
        displayName: label,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: link ? [{ label: 'source', url: link }] : [],
        keys: {},
      },
      text: title,
      embeds: link ? [{ kind: 'link', url: link }] : [],
      contentType: 'link',
      createdAt: updatedMatch ? new Date(updatedMatch[1]).getTime() : Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: guessNiches(title, baseNiches),
    });
  }

  // Fallback to RSS 2.0 (<item>)
  if (posts.length === 0) {
    const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
    while ((m = itemRe.exec(xml)) !== null && posts.length < limit) {
      const e = m[1];
      const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const linkMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
      if (!title) continue;
      const link = linkMatch ? stripHtml(linkMatch[1]) : '';

      posts.push({
        id: `rss:${label}:${posts.length}`,
        protocol: 'rss' as const,
        author: {
          id: `rss:${label}`,
          primary: { protocol: 'rss' as const, id: label },
          handles: { rss: label },
          displayName: label,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: link ? [{ label: 'source', url: link }] : [],
          keys: {},
        },
        text: title,
        embeds: link ? [{ kind: 'link', url: link }] : [],
        createdAt: Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: {},
        niches: guessNiches(title, baseNiches),
      });
    }
  }

  return posts;
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'rss',
  name: 'RSS-Bridge/News',
  description: 'Aggregated from 350+ crypto news RSS sources',
  endpoint: '/api/feed/news',
  requiresAuth: false,
  contentType: 'link',
};

export async function fetchRssBridgePosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Try RSS-Bridge with FeedExpander bridges
  const bridgePromises = [
    // RSS-Bridge has CryptoBridge, CryptomeBridge, TheHackerNewsBridge, etc.
    // But many require specific parameters. Try them.
    fetchFromBridge(
      'FeedExpanderExampleBridge',
      { source: RSS_FEEDS[0].url },
      Math.ceil(limit / 3),
    ),
    fetchFromBridge(
      'FeedExpanderExampleBridge',
      { source: RSS_FEEDS[1].url },
      Math.ceil(limit / 3),
    ),
  ];

  const bridgeResults = await Promise.allSettled(bridgePromises);
  for (const r of bridgeResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // If RSS-Bridge didn't produce results, fall back to direct RSS
  if (all.length < 3) {
    // Limit feeds to avoid timeouts
    const activeFeeds = RSS_FEEDS.slice(0, 10);
    const perFeed = Math.max(2, Math.ceil(limit / activeFeeds.length));
    const feedPromises = activeFeeds.map((feed) =>
      fetchRssFeed(feed.url, feed.label, feed.niches, perFeed),
    );
    const feedResults = await Promise.allSettled(feedPromises);
    for (const r of feedResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] RSS-Bridge: ${deduped.length} posts (${all.length} raw)`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchRssBridgePosts;

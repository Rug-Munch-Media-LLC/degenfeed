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
 *
 * Platform-specific bridges:
 *   - InstagramBridge: public Instagram profile posts (images/video)
 *   - TikTokBridge: public TikTok profile videos
 *   - TwitterBridge: public Twitter/X posts (via Nitter)
 *   - MastodonBridge: public Mastodon timeline
 *   - FeedExpanderExampleBridge: generic RSS/Atom feeds
 *
 * Content type detection: bridges now attach content type metadata
 * based on the bridge type and item content (images, video, text).
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const RSS_BRIDGE_BASE = 'http://127.0.0.1:8282';
const USER_AGENT = 'DegenFeed-Bridge/0.1';

// ─── Bridge Configuration ──────────────────────────────────────────────

interface BridgeConfig {
  name: string;
  params: Record<string, string>;
  /** Default content type for items from this bridge */
  contentType: 'image' | 'video' | 'link' | 'text';
  /** Base niches to assign */
  baseNiches: string[];
  /** Label for the source */
  label: string;
  /** Whether this bridge may be broken (login walls, etc.) */
  experimental?: boolean;
}

/** Platform-specific bridges with context-appropriate config */
const BRIDGE_CONFIGS: BridgeConfig[] = [
  // ── Generic RSS/News ──
  {
    name: 'FeedExpanderExampleBridge',
    params: {},
    contentType: 'link',
    baseNiches: ['crypto'],
    label: 'RSS-Bridge News',
  },
  // ── Mastodon (federated microblogging) ──
  {
    name: 'MastodonBridge',
    params: {},
    contentType: 'text',
    baseNiches: ['crypto', 'tech'],
    label: 'Mastodon (via RSS-Bridge)',
    experimental: true, // may need instance URL param
  },
  // ── Instagram (public accounts only) ──
  {
    name: 'InstagramBridge',
    params: {},
    contentType: 'image',
    baseNiches: ['culture', 'art'],
    label: 'Instagram (via RSS-Bridge)',
    experimental: true, // may be blocked by login walls
  },
  // ── TikTok (public profiles) ──
  {
    name: 'TikTokBridge',
    params: {},
    contentType: 'video',
    baseNiches: ['culture', 'tech'],
    label: 'TikTok (via RSS-Bridge)',
    experimental: true,
  },
  // ── Twitter/X (via Nitter) ──
  {
    name: 'TwitterBridge',
    params: {},
    contentType: 'text',
    baseNiches: ['crypto', 'tech'],
    label: 'Twitter/X (via RSS-Bridge)',
    experimental: true,
  },
  // ── Google News ──
  {
    name: 'GoogleNewsBridge',
    params: {},
    contentType: 'link',
    baseNiches: ['tech', 'news'],
    label: 'Google News',
  },
  // ── Hacker News ──
  {
    name: 'TheHackerNewsBridge',
    params: {},
    contentType: 'link',
    baseNiches: ['security', 'tech'],
    label: 'TheHackerNews',
  },
  // ── GitHub Issues ──
  {
    name: 'GitHubIssueBridge',
    params: {},
    contentType: 'text',
    baseNiches: ['tech', 'oss'],
    label: 'GitHub Issues',
    experimental: true,
  },
];

// Curated RSS feeds for feedexpander fallback
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
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
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
  if (/\b(meme|pepe|dog|doge|shib)\b/.test(lower)) niches.add('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.add('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.add('security');
  if (/\b(golang|rust|python|typescript|javascript|programming|coding)\b/.test(lower))
    niches.add('oss');
  if (/\b(podcast|episode|interview|show)\b/.test(lower)) niches.add('podcast');
  if (/\b(music|track|album|song|audio)\b/.test(lower)) niches.add('music');
  if (niches.size === 0 && baseNiches.length === 0) niches.add('crypto');
  return [...niches];
}

/**
 * Detect content type from bridge item content.
 * Examines HTML content, enclosures, and images to determine type.
 */
export function detectItemContentType(
  item: Record<string, unknown>,
  bridgeContentType: string,
): string {
  // If the bridge already knows the type, use it
  if (bridgeContentType === 'image' || bridgeContentType === 'video') {
    return bridgeContentType;
  }

  const contentHtml = ((item.content_html || item.content_text || '') as string).toLowerCase();
  const itemTitle = (item.title || '') as string;
  const combinedText = `${contentHtml} ${itemTitle}`.toLowerCase();

  // Check for video enclosures
  const enclosures = (item.enclosures || []) as string[];
  if (enclosures.some((e) => /\.(mp4|webm|mov|avi)$/i.test(e))) return 'video';

  // Check for image enclosures
  if (enclosures.some((e) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(e))) return 'image';

  // Check content HTML for video/embed
  if (
    /\b(video|youtube|vimeo|tiktok|twitch|stream)\b/.test(combinedText) ||
    /<video[\s>]/i.test(contentHtml) ||
    /<iframe.*(youtube|vimeo)/i.test(contentHtml)
  ) {
    return 'video';
  }

  // Check content for image markers
  if (/<img[\s>]/i.test(contentHtml) || /\.(jpg|jpeg|png|gif|webp)(\s|"|\)|$)/i.test(contentHtml)) {
    return 'image';
  }

  // Long text = article
  const textLen = itemTitle.length + contentHtml.length;
  if (textLen > 500) return 'article';
  if (textLen > 200) return 'text';

  return 'link';
}

/**
 * Extract media URLs (images, video) from bridge item content.
 */
export function extractMediaUrls(item: Record<string, unknown>): string[] {
  const urls: string[] = [];

  // Enclosures
  const enclosures = (item.enclosures || []) as string[];
  for (const e of enclosures) {
    if (e.startsWith('http')) urls.push(e);
  }

  // Thumbnail
  const thumb = item.thumbnail as string | undefined;
  if (thumb?.startsWith('http')) urls.push(thumb);

  // Extract image URLs from HTML content
  const contentHtml = (item.content_html || '') as string;
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = imgRe.exec(contentHtml)) !== null) {
    if (m[1]?.startsWith('http')) urls.push(m[1]);
  }

  return urls;
}

// ─── RSS-Bridge JSON API ─────────────────────────────────────────────

async function fetchFromBridge(
  bridge: string,
  params: Record<string, string>,
  limit: number,
  contentType: string,
  baseNiches: string[],
  label: string,
): Promise<UnifiedPost[]> {
  try {
    const query = new URLSearchParams({
      action: 'display',
      bridge,
      format: 'Json',
      ...params,
    });
    const url = `${RSS_BRIDGE_BASE}/?${query.toString()}`;

    const res = await $fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const responseContentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (responseContentType.includes('json')) {
      try {
        const data = JSON.parse(text);
        return parseBridgeJson(data, limit, contentType, baseNiches, label);
      } catch {
        return [];
      }
    }

    return parseBridgeHtml(text, bridge, limit);
  } catch {
    return [];
  }
}

export function parseBridgeJson(
  data: Record<string, unknown>,
  limit: number,
  bridgeContentType: string,
  baseNiches: string[],
  label: string,
): UnifiedPost[] {
  const items = (data.items || []) as Array<Record<string, unknown>>;
  if (items.length === 0) return [];

  const resolvedBaseNiches = guessNiches((data.title as string) || label, baseNiches);

  return items.slice(0, limit).map((item, i) => {
    const itemTitle = (item.title || '') as string;
    const contentHtml = (item.content_html || item.content_text || '') as string;
    const text = itemTitle || stripHtml(contentHtml).slice(0, 500);
    const link = (item.url || '') as string;
    const dateStr = (item.date_modified || item.date_published || item.date || '') as string;
    const createdAt = dateStr ? new Date(dateStr).getTime() : Date.now() - i * 600000;

    // Enhanced content type detection
    const detectedType = detectItemContentType(item, bridgeContentType);
    const mediaUrls = extractMediaUrls(item);

    // Build embeds based on detected content type
    const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [];
    if (link) embeds.push({ kind: 'link', url: link });

    if (mediaUrls.length > 0) {
      // Add first media as the primary embed
      if (detectedType === 'video') {
        embeds.push({ kind: 'video', url: mediaUrls[0] || link });
      } else if (detectedType === 'image') {
        embeds.push({ kind: 'image', url: mediaUrls[0] || link });
      }
    }

    return {
      id: `rss-bridge:${label}:${i}`,
      protocol: 'rss' as const,
      author: {
        id: `rss:${label}`,
        primary: { protocol: 'rss' as const, id: label },
        handles: { rss: label },
        displayName: (data.title as string) || label,
        bio: '',
        avatarUrl: (item.avatar as string) || '',
        followerCount: 0,
        followingCount: 0,
        links: link ? [{ label: 'source', url: link }] : [],
        keys: {},
      },
      text,
      embeds,
      contentType: detectedType as 'image' | 'video' | 'link' | 'text' | 'article' | undefined,
      createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: item,
      niches: guessNiches(text, resolvedBaseNiches),
    };
  });
}

function parseBridgeHtml(_html: string, _bridge: string, _limit: number): UnifiedPost[] {
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
    const res = await $fetch(url, {
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

    // Check for media content (enclosures)
    const enclosureMatch = e.match(
      /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']([^"']+)["']/i,
    );
    const mediaUrl = enclosureMatch?.[1] || '';
    const mediaType = enclosureMatch?.[2] || '';

    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
    if (!title) continue;
    const link = linkMatch ? linkMatch[1] : '';

    // Determine content type from media
    let contentType: string | undefined;
    const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [];
    if (mediaUrl) {
      if (mediaType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl)) {
        contentType = 'image';
        embeds.push({ kind: 'image', url: mediaUrl });
      } else if (mediaType.startsWith('video/') || /\.(mp4|webm)$/i.test(mediaUrl)) {
        contentType = 'video';
        embeds.push({ kind: 'video', url: mediaUrl });
      } else if (mediaType.startsWith('audio/')) {
        contentType = 'video';
        embeds.push({ kind: 'video', url: mediaUrl });
      }
    }
    if (link && embeds.length === 0) embeds.push({ kind: 'link', url: link });

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
      embeds,
      contentType,
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

      // Check enclosures in RSS 2.0
      const enclosureMatch = e.match(
        /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']([^"']+)["']/i,
      );
      const mediaUrl = enclosureMatch?.[1] || '';
      const mediaType = enclosureMatch?.[2] || '';

      const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
      if (!title) continue;
      const link = linkMatch ? stripHtml(linkMatch[1]) : '';

      let contentType: string | undefined;
      const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [];
      if (mediaUrl) {
        if (mediaType.startsWith('image/')) {
          contentType = 'image';
          embeds.push({ kind: 'image', url: mediaUrl });
        } else if (mediaType.startsWith('video/')) {
          contentType = 'video';
          embeds.push({ kind: 'video', url: mediaUrl });
        } else if (mediaType.startsWith('audio/')) {
          contentType = 'video';
          embeds.push({ kind: 'video', url: mediaUrl });
        }
      }
      if (link && embeds.length === 0) embeds.push({ kind: 'link', url: link });

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
        embeds,
        contentType,
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

// ─── Platform-Specific Bridge Fetching ──────────────────────────────

/**
 * Fetch posts from a platform-specific bridge.
 * Returns empty array if the bridge is not available (graceful degradation).
 */
export async function fetchFromPlatformBridge(
  platform: 'instagram' | 'tiktok' | 'twitter' | 'mastodon' | 'googlenews' | 'hackernews',
  accountOrQuery?: string,
  limit = 10,
): Promise<UnifiedPost[]> {
  const bridgeMap: Record<string, BridgeConfig> = {};
  for (const cfg of BRIDGE_CONFIGS) {
    bridgeMap[cfg.name] = cfg;
  }

  let bridgeName: string;
  let params: Record<string, string> = {};
  let bridgeCfg: BridgeConfig | undefined;

  switch (platform) {
    case 'instagram': {
      bridgeName = 'InstagramBridge';
      bridgeCfg = bridgeMap[bridgeName];
      if (accountOrQuery) params = { username: accountOrQuery };
      break;
    }
    case 'tiktok': {
      bridgeName = 'TikTokBridge';
      bridgeCfg = bridgeMap[bridgeName];
      if (accountOrQuery) params = { username: accountOrQuery };
      break;
    }
    case 'twitter': {
      bridgeName = 'TwitterBridge';
      bridgeCfg = bridgeMap[bridgeName];
      if (accountOrQuery) params = { username: accountOrQuery };
      // TwitterBridge typically needs a Nitter instance — use blank params
      break;
    }
    case 'mastodon': {
      bridgeName = 'MastodonBridge';
      bridgeCfg = bridgeMap[bridgeName];
      params = { instance: accountOrQuery || 'mastodon.social' };
      break;
    }
    case 'googlenews': {
      bridgeName = 'GoogleNewsBridge';
      bridgeCfg = bridgeMap[bridgeName];
      if (accountOrQuery) params = { topic: accountOrQuery };
      break;
    }
    case 'hackernews': {
      bridgeName = 'TheHackerNewsBridge';
      bridgeCfg = bridgeMap[bridgeName];
      break;
    }
    default:
      return [];
  }

  if (!bridgeCfg) return [];

  const result = await fetchFromBridge(
    bridgeName,
    params,
    limit,
    bridgeCfg.contentType,
    bridgeCfg.baseNiches,
    bridgeCfg.label,
  );

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'rss',
  name: 'RSS-Bridge/News',
  description: 'Aggregated from 350+ crypto news RSS sources + platform bridges',
  endpoint: '/api/feed/news',
  requiresAuth: false,
  contentType: 'link',
};

export async function fetchRssBridgePosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // ── Phase 1: Try platform-specific bridges ──
  // Try each configured bridge (experimental ones may fail silently)
  const platformPromises = BRIDGE_CONFIGS.map((cfg) =>
    fetchFromBridge(
      cfg.name,
      cfg.params,
      Math.max(2, Math.ceil(limit / BRIDGE_CONFIGS.length)),
      cfg.contentType,
      cfg.baseNiches,
      cfg.label,
    ),
  );

  const platformResults = await Promise.allSettled(platformPromises);
  for (const r of platformResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // ── Phase 2: Direct RSS feed fallback ──
  // If we got very few results from bridges, supplement with direct RSS
  if (all.length < Math.max(3, limit / 3)) {
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

  // ── Phase 3: FeedExpander bridge as extra coverage ──
  if (all.length < limit / 2) {
    // Try a few specific RSS feeds through the FeedExpander bridge
    const expanderPromises = RSS_FEEDS.slice(0, 3).map((feed) =>
      fetchFromBridge(
        'FeedExpanderExampleBridge',
        { source: feed.url },
        Math.max(2, Math.ceil(limit / 6)),
        'link',
        feed.niches,
        feed.label,
      ),
    );
    const expanderResults = await Promise.allSettled(expanderPromises);
    for (const r of expanderResults) {
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

  // console.log(`[bridge] RSS-Bridge: ${deduped.length} posts (${all.length} raw)`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchRssBridgePosts;

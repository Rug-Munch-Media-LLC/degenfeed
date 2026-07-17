/**
 * @degenfeed/youtube-provider
 *
 * Fetches YouTube video metadata from RSS feeds of curated crypto channels.
 * Returns normalized VideoItem[] suitable for rendering in the /videos grid.
 *
 * Falls back to the YouTube Data API if RSS is unavailable (not implemented yet).
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelName: string;
  channelUrl: string;
  thumbnailUrl: string;
  url: string;
  publishedAt: string;
  publishedMs: number;
  duration?: string;
  views?: number;
  description?: string;
  category?: string;
  source: 'youtube';
}

export interface YouTubeChannel {
  name: string;
  feed: string;
  channelId?: string;
}

// ─── Curated crypto YouTube channels ──────────────────────────────────

export const CRYPTO_CHANNELS: YouTubeChannel[] = [
  {
    name: 'Bankless',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA',
    channelId: 'UCAl9Ld79qaZxp9JzEOwd3aA',
  },
  {
    name: 'Coin Bureau',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw',
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
  },
  {
    name: 'Altcoin Daily',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbLhGKVY-bJPcawebgtNfbw',
    channelId: 'UCbLhGKVY-bJPcawebgtNfbw',
  },
  {
    name: 'Crypto Banter',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCN9Nj4tjXbVTLYWN0EKlylQ',
    channelId: 'UCN9Nj4tjXbVTLYWN0EKlylQ',
  },
  {
    name: 'Unchained Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWiiMnsnw5Isc2PP1to9nNw',
    channelId: 'UCWiiMnsnw5Isc2PP1to9nNw',
  },
  {
    name: 'a16z Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8gx6RzYYdqWB3K_dKsC6kQ',
    channelId: 'UC8gx6RzYYdqWB3K_dKsC6kQ',
  },
  {
    name: 'DeFi Dad',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZRhDKYWrRiUTsY4Y3stYQA',
    channelId: 'UCZRhDKYWrRiUTsY4Y3stYQA',
  },
  {
    name: 'Finematics',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCn2cHmXby69CRaR5eowM7lQ',
    channelId: 'UCn2cHmXby69CRaR5eowM7lQ',
  },
  {
    name: 'Whiteboard Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC5sYBAiOnT4v0QBseBRh_sg',
    channelId: 'UC5sYBAiOnT4v0QBseBRh_sg',
  },
  {
    name: 'Dapp University',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6jH2FqQyN9x_4f7bK7Jvwg',
    channelId: 'UC6jH2FqQyN9x_4f7bK7Jvwg',
  },
  {
    name: 'Ethereum Foundation',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNOfzGXD_C9YMYmnefmPH0g',
    channelId: 'UCNOfzGXD_C9YMYmnefmPH0g',
  },
  {
    name: 'Anthony Pompliano',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6rD0j7TQ5Rg0zKjV1V6v2g',
    channelId: 'UC6rD0j7TQ5Rg0zKjV1V6v2g',
  },
  {
    name: 'Folding Stock',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCw8mYhF2FmTz0jK0G8z1D0A',
    channelId: 'UCw8mYhF2FmTz0jK0G8z1D0A',
  },
  {
    name: 'Cointelegraph',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCV0XLtgVhDYyFRB-HpHkXbQ',
    channelId: 'UCV0XLtgVhDYyFRB-HpHkXbQ',
  },
  {
    name: 'CoinDesk',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCeU2Fg3fDgQTMOdT6zRqL9g',
    channelId: 'UCeU2Fg3fDgQTMOdT6zRqL9g',
  },
];

// ─── Category keywords mapping ───────────────────────────────────────

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  crypto: [
    'bitcoin',
    'btc',
    'crypto',
    'ethereum',
    'eth',
    'blockchain',
    'coin',
    'token',
    'digital asset',
    'bear market',
    'bull run',
  ],
  defi: [
    'defi',
    'decentralized finance',
    'liquidity',
    'yield',
    'staking',
    'lending',
    'borrowing',
    'amm',
    'dex',
    'swap',
    'pool',
    'farm',
  ],
  nft: [
    'nft',
    'nfts',
    'collectible',
    'digital art',
    'marketplace',
    'blue chip',
    'ape',
    'pixel',
    'mint',
    'metadata',
  ],
  tutorial: [
    'tutorial',
    'guide',
    'how to',
    'learn',
    'beginner',
    'explained',
    'walkthrough',
    'setup',
    'step by step',
    'getting started',
  ],
  news: [
    'news',
    'update',
    'latest',
    'breaking',
    'report',
    'analysis',
    'recap',
    'weekly',
    'daily',
    'roundup',
  ],
  entertainment: [
    'entertainment',
    'podcast',
    'interview',
    'discussion',
    'debate',
    'funny',
    'meme',
    'reaction',
    'vlog',
  ],
};

/**
 * Detect video category from title + description.
 */
function detectCategory(title: string, description?: string): string {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category;
    }
  }
  return 'crypto';
}

// ─── RSS XML Parsing ─────────────────────────────────────────────────

interface RSSEntry {
  videoId: string;
  title: string;
  link: string;
  published: string;
  updated: string;
  description?: string;
  channelName?: string;
  channelId?: string;
  thumbnail?: string;
}

/**
 * Parse YouTube Atom RSS feed XML into structured entries.
 * YouTube RSS uses Atom format (not RSS 2.0).
 */
function parseYouTubeRss(xml: string, channel: YouTubeChannel): RSSEntry[] {
  const entries: RSSEntry[] = [];

  // Extract <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const matches = Array.from(xml.matchAll(entryRegex));

  for (const match of matches) {
    const entryXml = match[1];
    if (!entryXml) continue;

    try {
      const videoId = extractXmlTag(entryXml, 'yt:videoId') ?? '';
      const title = decodeXmlEntities(extractXmlTag(entryXml, 'title') ?? '');
      const link = extractLinkHref(entryXml);
      const published = extractXmlTag(entryXml, 'published') ?? '';
      const description = decodeXmlEntities(extractXmlTag(entryXml, 'media:description') ?? '');
      const thumbnail = extractThumbnailUrl(entryXml) ?? undefined;

      if (!videoId || !title) continue;

      entries.push({
        videoId,
        title,
        link: link ?? `https://www.youtube.com/watch?v=${videoId}`,
        published,
        updated: extractXmlTag(entryXml, 'updated') ?? published,
        description,
        channelName: channel.name,
        channelId: channel.channelId,
        thumbnail,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return entries;
}

function extractXmlTag(xml: string, tag: string): string | null {
  // Handle both <tag>content</tag> and <ns:tag>content</ns:tag>
  const escaped = tag.replace(':', '\\:');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`);
  const match = xml.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractLinkHref(xml: string): string | null {
  const match = xml.match(/<link[^>]*href="([^"]+)"/);
  return match?.[1] ?? null;
}

function extractThumbnailUrl(xml: string): string | null {
  // media:thumbnail url="..."
  const match = xml.match(/<media:thumbnail[^>]*url="([^"]+)"/);
  if (match?.[1]) return match[1];

  // Also check media:content with thumbnail
  const contentMatch = xml.match(/<media:content[^>]*url="([^"]+)"/);
  return contentMatch?.[1] ?? null;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .trim();
}

/**
 * Fetch a single YouTube RSS feed and parse it.
 */
async function fetchChannelFeed(
  channel: YouTubeChannel,
  signal?: AbortSignal,
): Promise<RSSEntry[]> {
  try {
    const response = await fetch(channel.feed, {
      signal,
      headers: {
        'User-Agent': 'DegenFeed/1.0 (+https://degenfeed.xyz)',
        Accept: 'application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      console.warn(`[youtube-provider] HTTP ${response.status} for ${channel.name}`);
      return [];
    }

    const xml = await response.text();
    if (!xml || xml.length < 100) return [];

    return parseYouTubeRss(xml, channel);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Silently handle abort
      return [];
    }
    console.warn(`[youtube-provider] Failed to fetch ${channel.name}:`, err);
    return [];
  }
}

// ─── Main fetch function ────────────────────────────────────────────

export interface FetchYouTubeOptions {
  /** Category filter (crypto, defi, nft, tutorial, news, entertainment) */
  category?: string;
  /** Max number of videos to return */
  limit?: number;
  /** Array of channel names to include (default: all) */
  channels?: string[];
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Sort order */
  sort?: 'recent' | 'popular' | 'trending';
}

/**
 * Fetch YouTube videos from curated crypto channels.
 * Returns normalized YouTubeVideoItem[] sorted by publish date.
 */
export async function fetchYouTubeFeed(
  options: FetchYouTubeOptions = {},
): Promise<YouTubeVideoItem[]> {
  const { category, limit = 20, channels: channelFilter, signal, sort = 'recent' } = options;

  // Filter channels if requested
  const channels = channelFilter
    ? CRYPTO_CHANNELS.filter((c) => channelFilter.includes(c.name))
    : CRYPTO_CHANNELS;

  if (channels.length === 0) return [];

  // Fetch all channel feeds with concurrency limit
  const concurrency = 4;
  const results: RSSEntry[][] = [];
  const queue = [...channels];

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const channel = queue.shift();
      if (!channel) break;
      const entries = await fetchChannelFeed(channel, signal);
      if (entries.length > 0) {
        results.push(entries);
      }
    }
  });

  await Promise.all(workers);

  // Flatten and map to VideoItem
  const allEntries = results.flat();

  // Deduplicate by videoId
  const seen = new Set<string>();
  const items: YouTubeVideoItem[] = [];

  for (const entry of allEntries) {
    if (seen.has(entry.videoId)) continue;
    seen.add(entry.videoId);

    const publishedMs = new Date(entry.published).getTime();

    items.push({
      id: entry.videoId,
      title: entry.title,
      channelName: entry.channelName ?? 'Unknown',
      channelUrl: `https://www.youtube.com/channel/${entry.channelId ?? ''}`,
      thumbnailUrl:
        entry.thumbnail ?? `https://img.youtube.com/vi/${entry.videoId}/maxresdefault.jpg`,
      url: entry.link ?? `https://www.youtube.com/watch?v=${entry.videoId}`,
      publishedAt: entry.published,
      publishedMs,
      duration: undefined,
      description: entry.description,
      category: category ?? detectCategory(entry.title, entry.description),
      source: 'youtube',
    });
  }

  // Sort
  if (sort === 'recent') {
    items.sort((a, b) => b.publishedMs - a.publishedMs);
  } else if (sort === 'popular') {
    items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  } else if (sort === 'trending') {
    // Trending = recent + high engagement proxy
    items.sort((a, b) => {
      const scoreA = (a.views ?? 0) / Math.max(1, (Date.now() - a.publishedMs) / 3600000);
      const scoreB = (b.views ?? 0) / Math.max(1, (Date.now() - b.publishedMs) / 3600000);
      return scoreB - scoreA;
    });
  }

  // Filter by category if specified
  const filtered =
    category && category !== 'all' ? items.filter((v) => v.category === category) : items;

  return filtered.slice(0, limit);
}

/**
 * Get a single YouTube video's details by ID.
 * Uses the oEmbed endpoint for quick metadata.
 */
export async function getYouTubeVideoInfo(
  videoId: string,
  signal?: AbortSignal,
): Promise<YouTubeVideoItem | null> {
  try {
    // oEmbed is a simple JSON endpoint
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      type: string;
    };

    return {
      id: videoId,
      title: data.title ?? 'Untitled',
      channelName: data.author_name ?? 'Unknown',
      channelUrl: data.author_url ?? '',
      thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: new Date().toISOString(),
      publishedMs: Date.now(),
      source: 'youtube',
    };
  } catch {
    return null;
  }
}

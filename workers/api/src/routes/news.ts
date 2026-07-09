/**
 * @degenfeed/api-worker/news
 *
 * Top-tier crypto / AI / tech news aggregator.
 */

import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { type Env, noCacheJsonResponse } from '../index';

interface NewsSource {
  name: string;
  type: 'rss' | 'reddit' | 'hackernews';
  url: string;
  category?: string;
  tier: 1 | 2 | 3 | 4;
  mustRead?: boolean;
  weight: number;
}

const NEWS_SOURCES: NewsSource[] = [
  {
    name: 'CoinDesk',
    type: 'rss',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    tier: 1,
    mustRead: true,
    weight: 1.5,
  },
  {
    name: 'CoinTelegraph',
    type: 'rss',
    url: 'https://cointelegraph.com/rss',
    tier: 1,
    mustRead: true,
    weight: 1.5,
  },
  {
    name: 'The Block',
    type: 'rss',
    url: 'https://www.theblockcrypto.com/rss.xml',
    tier: 1,
    mustRead: true,
    weight: 1.5,
  },
  {
    name: 'Decrypt',
    type: 'rss',
    url: 'https://decrypt.co/feed',
    tier: 1,
    mustRead: true,
    weight: 1.4,
  },
  {
    name: 'Blockworks',
    type: 'rss',
    url: 'https://blockworks.co/feed',
    tier: 1,
    mustRead: true,
    weight: 1.4,
  },
  {
    name: 'Bitcoin Magazine',
    type: 'rss',
    url: 'https://bitcoinmagazine.com/feed',
    tier: 1,
    mustRead: true,
    weight: 1.3,
  },
  {
    name: 'CryptoSlate',
    type: 'rss',
    url: 'https://cryptoslate.com/feed/',
    tier: 1,
    mustRead: false,
    weight: 1.1,
  },

  {
    name: 'Bankless',
    type: 'rss',
    url: 'https://bankless.substack.com/feed',
    tier: 2,
    mustRead: true,
    weight: 1.3,
  },
  {
    name: 'The Defiant',
    type: 'rss',
    url: 'https://thedefiant.io/feed',
    tier: 2,
    mustRead: true,
    weight: 1.3,
  },
  {
    name: 'Week in Ethereum',
    type: 'rss',
    url: 'https://weekinethereumnews.com/feed',
    tier: 2,
    mustRead: true,
    weight: 1.2,
  },
  {
    name: 'ETH Daily',
    type: 'rss',
    url: 'https://ethdaily.substack.com/feed',
    tier: 2,
    mustRead: false,
    weight: 1.1,
  },
  {
    name: 'Messari',
    type: 'rss',
    url: 'https://messari.io/rss',
    tier: 2,
    mustRead: false,
    weight: 1.1,
  },
  {
    name: 'Unchained',
    type: 'rss',
    url: 'https://unchainedcrypto.com/feed/',
    tier: 2,
    mustRead: false,
    weight: 1.1,
  },
  {
    name: 'Milk Road',
    type: 'rss',
    url: 'https://milkroad.substack.com/feed',
    tier: 2,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'The DeFi Edge',
    type: 'rss',
    url: 'https://thedefiedge.substack.com/feed',
    tier: 2,
    mustRead: false,
    weight: 1.0,
  },

  {
    name: 'Dune Analytics',
    type: 'rss',
    url: 'https://dune.com/feed',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'Glassnode',
    type: 'rss',
    url: 'https://glassnode.com/blog/feed',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'Nansen',
    type: 'rss',
    url: 'https://nansen.substack.com/feed',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'Token Terminal',
    type: 'rss',
    url: 'https://tokenterminal.com/feed',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'DeFiLlama',
    type: 'rss',
    url: 'https://defillama.com/feed',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'L2Beat',
    type: 'rss',
    url: 'https://l2beat.com/feed.xml',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'Rekt News',
    type: 'rss',
    url: 'https://rekt.news/feed.xml',
    tier: 3,
    mustRead: true,
    weight: 1.2,
  },
  {
    name: 'Immunefi',
    type: 'rss',
    url: 'https://medium.com/feed/immunefi',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },
  {
    name: 'SlowMist',
    type: 'rss',
    url: 'https://slowmist.medium.com/feed',
    tier: 3,
    mustRead: false,
    weight: 1.0,
  },

  {
    name: 'TechCrunch',
    type: 'rss',
    url: 'https://techcrunch.com/feed/',
    tier: 4,
    mustRead: false,
    weight: 0.9,
  },
  {
    name: 'The Verge',
    type: 'rss',
    url: 'https://www.theverge.com/rss/index.xml',
    tier: 4,
    mustRead: false,
    weight: 0.9,
  },

  {
    name: 'r/CryptoCurrency',
    type: 'reddit',
    url: 'https://old.reddit.com/r/CryptoCurrency/hot.rss?limit=25',
    tier: 3,
    mustRead: false,
    weight: 0.8,
  },
  {
    name: 'r/ethfinance',
    type: 'reddit',
    url: 'https://old.reddit.com/r/ethfinance/hot.rss?limit=25',
    tier: 3,
    mustRead: false,
    weight: 0.8,
  },
  {
    name: 'r/solana',
    type: 'reddit',
    url: 'https://old.reddit.com/r/solana/hot.rss?limit=25',
    tier: 3,
    mustRead: false,
    weight: 0.8,
  },
  {
    name: 'r/ethdev',
    type: 'reddit',
    url: 'https://old.reddit.com/r/ethdev/hot.rss?limit=25',
    tier: 3,
    mustRead: false,
    weight: 0.8,
  },

  { name: 'Hacker News', type: 'hackernews', url: '', tier: 4, mustRead: false, weight: 1.1 },
];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  content?: string;
  image?: string;
  categories: string[];
}

function stripTags(html: string): string {
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

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}

function extractText(tag: string, xml: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? decodeXmlEntities(match[1] || '') : '';
}

function extractAll(tag: string, xml: string): string[] {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    out.push(decodeXmlEntities(m[1] || ''));
    m = re.exec(xml);
  }
  return out;
}

function parseRss(xml: string, maxItems = 20): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item([^>]*)>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null = itemRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const itemXml = m[2] || '';
    const title = extractText('title', itemXml);
    const link = extractText('link', itemXml) || extractText('guid', itemXml);
    const description = extractText('description', itemXml);
    const content = extractText('content:encoded', itemXml) || extractText('content', itemXml);
    const pubDate =
      extractText('pubDate', itemXml) ||
      extractText('dc:date', itemXml) ||
      extractText('published', itemXml);
    const creator = extractText('dc:creator', itemXml) || extractText('author', itemXml);
    const categories = extractAll('category', itemXml);

    let image = '';
    const media = itemXml.match(/<media:content[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (media?.[1]) image = media[1];
    const enclosure = itemXml.match(/<enclosure[^>]+url\s*=\s*["']([^"']+)["']/i);
    if (!image && enclosure?.[1]) image = enclosure[1];
    const img = itemXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (!image && img?.[1]) image = img[1];

    if (title && link) {
      items.push({ title, link, description, pubDate, creator, content, image, categories });
    }
    m = itemRe.exec(xml);
  }

  return items;
}

function parseAtom(xml: string, maxItems = 20): RssItem[] {
  const items: RssItem[] = [];
  const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null = entryRe.exec(xml);

  while (m !== null && items.length < maxItems) {
    const entryXml = m[2] || '';
    const title = extractText('title', entryXml);
    const linkMatch = entryXml.match(/<link[^>]+href\s*=\s*["']([^"']+)["']/i);
    const link = linkMatch?.[1] || extractText('id', entryXml);
    const description = extractText('summary', entryXml);
    const content = extractText('content', entryXml);
    const pubDate = extractText('updated', entryXml) || extractText('published', entryXml);
    const creator = extractText('name', entryXml);
    const categories = extractAll('category', entryXml);

    let image = '';
    const img = entryXml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    if (img?.[1]) image = img[1];

    if (title && link) {
      items.push({ title, link, description, pubDate, creator, content, image, categories });
    }
    m = entryRe.exec(xml);
  }

  return items;
}

function parseFeed(xml: string): RssItem[] {
  const trimmed = xml.trim();
  if (trimmed.includes('<feed')) return parseAtom(trimmed);
  return parseRss(trimmed);
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'DegenFeed/0.1 (news aggregator; +https://degenfeed.xyz)',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return null;
    }
    return res;
  } catch {
    return null;
  }
}

async function fetchRss(source: NewsSource): Promise<RssItem[]> {
  const res = await fetchWithTimeout(source.url);
  if (!res?.ok) return [];
  const xml = await res.text();
  if (xml.length > 2_000_000) return [];
  return parseFeed(xml).slice(0, 15);
}

interface HnHit {
  title: string;
  url: string;
  points: number;
  num_comments: number;
  created_at_i: number;
  author: string;
  objectID?: string;
}

async function fetchHackerNews(): Promise<RssItem[]> {
  const tags = ['crypto', 'bitcoin', 'ethereum', 'web3', 'ai'];
  const hits: HnHit[] = [];

  for (const tag of tags) {
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=${tag}&hitsPerPage=10`;
    try {
      const res = await fetchWithTimeout(url, 6000);
      if (!res?.ok) continue;
      const data = (await res.json()) as { hits?: HnHit[] };
      if (data.hits) hits.push(...data.hits);
    } catch {
      /* ignore */
    }
  }

  return hits.map((h) => ({
    title: h.title,
    link: h.url || `https://news.ycombinator.com/item?id=${h.objectID || ''}`,
    description: `${h.points} points · ${h.num_comments} comments`,
    pubDate: new Date(h.created_at_i * 1000).toISOString(),
    creator: h.author,
    content: '',
    image: '',
    categories: ['hackernews'],
  }));
}

async function withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = new Set<Promise<void>>();
  while (queue.length > 0 || runners.size > 0) {
    while (runners.size < limit && queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      const promise = fn(item)
        .catch(() => {})
        .finally(() => {
          runners.delete(promise);
        });
      runners.add(promise);
    }
    if (runners.size > 0) await Promise.race(runners);
  }
}

async function fetchSource(source: NewsSource): Promise<RssItem[]> {
  if (source.type === 'rss' || source.type === 'reddit') return fetchRss(source);
  if (source.type === 'hackernews') return fetchHackerNews();
  return [];
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'source']) {
      u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function toUnifiedPost(item: RssItem, source: NewsSource): UnifiedPost {
  const canonicalUrl = normalizeUrl(item.link);
  const text = stripTags(item.content || item.description || item.title).slice(0, 600);
  const html = item.content || item.description || '';
  const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
  const createdAt = Number.isNaN(pubDate) ? Date.now() : pubDate;

  const embeds: { kind: 'image' | 'link' | 'video'; url: string }[] = [];
  if (item.image) embeds.push({ kind: 'image', url: item.image });
  embeds.push({ kind: 'link', url: canonicalUrl });

  const authorId = `rss:news:${source.name.replace(/\s+/g, '-').toLowerCase()}`;
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
    displayName: source.name,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'source', url: source.url }],
    keys: {},
  };

  const categories = [
    ...new Set([...(source.category ? [source.category] : []), ...item.categories]),
  ];
  const niches = detectNiches(`${text} ${categories.join(' ')} ${source.name}`);

  return {
    id: `rss:news:${canonicalUrl.slice(0, 128).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    protocol: 'rss',
    author,
    text,
    html,
    embeds,
    createdAt,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: { sourceName: source.name, tier: source.tier, mustRead: source.mustRead },
    niches: [...new Set([...niches, ...categories.map((c) => c.toLowerCase())])],
  };
}

const NICHE_KEYWORDS: Record<string, string[]> = {
  bitcoin: ['bitcoin', 'btc', 'satoshi', 'halving'],
  ethereum: ['ethereum', 'eth', 'vitalik', 'eip-', 'gas fee', 'validator'],
  solana: ['solana', 'sol ', 'solana-based'],
  defi: ['defi', 'lending', 'yield', 'liquidity', 'amm', 'dex', 'swap', 'staking', 'restaking'],
  nft: ['nft', 'nfts', 'collectible', 'punk', 'azuki', 'opensea', 'blur'],
  ai: [
    'ai ',
    'artificial intelligence',
    'machine learning',
    'llm',
    'gpt',
    'openai',
    'anthropic',
    'deepseek',
  ],
  regulation: ['sec', 'regulation', 'mica', 'cftc', 'congress', 'senate', 'policy', 'compliance'],
  security: [
    'hack',
    'exploit',
    'vulnerability',
    'audit',
    'phishing',
    'rug pull',
    'rekt',
    'immunefi',
  ],
  macro: ['fed', 'fomc', 'inflation', 'interest rate', 'dollar', 'recession', 'nasdaq', 'spx'],
  stablecoin: ['stablecoin', 'usdt', 'usdc', 'tether', 'circle'],
  layer2: ['layer 2', 'l2', 'rollup', 'arbitrum', 'optimism', 'base', 'zk-', 'zero knowledge'],
  memecoin: ['memecoin', 'meme coin', 'dogecoin', 'shiba', 'pepe', 'bonk', 'wif'],
  etf: ['etf', 'spot bitcoin', 'blackrock', 'grayscale', 'ibit'],
  onchain: ['onchain', 'on-chain', 'blockchain data', 'whale'],
};

function detectNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const niches: string[] = [];
  for (const [niche, terms] of Object.entries(NICHE_KEYWORDS)) {
    if (terms.some((t) => lower.includes(t))) niches.push(niche);
  }
  return [...new Set(niches)];
}

function rankPost(post: UnifiedPost, source: NewsSource, now: number): number {
  const ageHrs = Math.max(0, (now - post.createdAt) / 3600000);
  const recency = Math.exp(-ageHrs / 24);
  const tierBoost = 1 + (4 - source.tier) * 0.15;
  const mustReadBoost = source.mustRead ? 1.4 : 1.0;
  return recency * source.weight * tierBoost * mustReadBoost;
}

interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

function extractTrending(posts: UnifiedPost[], limit = 12): TrendingTopic[] {
  const counts: Record<string, { count: number; score: number }> = {};

  for (const post of posts.slice(0, 100)) {
    for (const niche of post.niches) {
      if (!counts[niche]) counts[niche] = { count: 0, score: 0 };
      counts[niche].count++;
      counts[niche].score += 1;
    }
    const text = `${post.text} ${post.author.displayName}`.toUpperCase();
    const tickers = Array.from(text.matchAll(/\$([A-Z]{2,5})\b/g))
      .map((m) => m[1])
      .filter((t): t is string => !!t);
    for (const t of tickers) {
      if (!counts[t]) counts[t] = { count: 0, score: 0 };
      counts[t].count++;
      counts[t].score += 2;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([topic, v]) => ({ topic, count: v.count, score: v.score }));
}

export async function handleNewsFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const category = url.searchParams.get('category') || '';
  const query = url.searchParams.get('q')?.toLowerCase() || '';
  const mustRead = url.searchParams.get('mustRead') === 'true';
  const cacheKey = `news:v1:${category || 'all'}:${query || 'none'}:${mustRead}`;

  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return noCacheJsonResponse(parsed);
    }
  } catch {
    /* ignore */
  }

  const now = Date.now();

  const allItems: { item: RssItem; source: NewsSource }[] = [];
  await withConcurrencyLimit(NEWS_SOURCES, 3, async (source) => {
    const items = await fetchSource(source);
    allItems.push(...items.map((i) => ({ item: i, source })));
  });

  const seenUrls = new Set<string>();
  const posts: { post: UnifiedPost; source: NewsSource; score: number }[] = [];

  for (const { item, source } of allItems) {
    try {
      const post = toUnifiedPost(item, source);
      const canonicalUrl = normalizeUrl(item.link);
      if (seenUrls.has(canonicalUrl)) continue;
      seenUrls.add(canonicalUrl);

      if (category) {
        const cats = post.niches;
        if (!cats.includes(category.toLowerCase()) && source.category !== category) continue;
      }

      if (mustRead && !source.mustRead) continue;

      if (query) {
        const haystack =
          `${post.text} ${post.author.displayName} ${post.niches.join(' ')}`.toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      const score = rankPost(post, source, now);
      posts.push({ post, source, score });
    } catch {
      /* skip */
    }
  }

  posts.sort((a, b) => b.score - a.score);

  for (const p of posts) {
    const raw = p.post.raw as Record<string, unknown>;
    raw.mustRead = p.source.mustRead;
    raw.tier = p.source.tier;
  }

  const topPosts = posts.slice(0, limit).map((p) => p.post);
  const trending = extractTrending(posts.map((p) => p.post));
  const sourceCounts = NEWS_SOURCES.reduce(
    (acc, s) => {
      acc[s.name] = posts.filter((p) => p.source.name === s.name).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const response = {
    data: topPosts,
    meta: {
      total: posts.length,
      limit,
      category: category || 'all',
      query: query || undefined,
      mustRead,
      trending,
      sourceCounts,
      fetchedAt: now,
      sources: NEWS_SOURCES.length,
    },
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
  } catch {
    /* ignore */
  }

  return noCacheJsonResponse(response);
}

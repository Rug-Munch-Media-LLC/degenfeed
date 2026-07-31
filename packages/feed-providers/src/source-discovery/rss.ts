/**
 * @degenfeed/source-discovery — RSS feed discovery engine.
 *
 * Discovers new RSS feeds from crypto news sites, blog directories,
 * and known content sources. Checks feed freshness and scores by
 * post frequency and content quality.
 */

import { computeQualityScore } from './quality';
import type { DiscoveredSource } from './types';
import { CRYPTO_KEYWORDS, DEFAULT_DISCOVERY_CONFIG } from './types';

const REQUEST_TIMEOUT_MS = 5000;
const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

/** Known crypto news/blog sites to check for RSS feeds */
const KNOWN_SITES: Array<{ name: string; feedUrl: string; category: string }> = [
  {
    name: 'CoinDesk',
    feedUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'news',
  },
  { name: 'CoinTelegraph', feedUrl: 'https://cointelegraph.com/rss', category: 'news' },
  { name: 'Decrypt', feedUrl: 'https://decrypt.co/feed', category: 'news' },
  { name: 'The Block', feedUrl: 'https://www.theblock.co/rss', category: 'news' },
  { name: 'Bitcoin Magazine', feedUrl: 'https://bitcoinmagazine.com/.rss/full/', category: 'news' },
  { name: 'CryptoSlate', feedUrl: 'https://cryptoslate.com/feed/', category: 'news' },
  { name: 'Coingape', feedUrl: 'https://coingape.com/feed/', category: 'news' },
  { name: 'U.Today', feedUrl: 'https://u.today/rss', category: 'news' },
  { name: 'BeInCrypto', feedUrl: 'https://beincrypto.com/feed/', category: 'news' },
  { name: 'NewsBTC', feedUrl: 'https://www.newsbtc.com/feed/', category: 'news' },
  { name: 'Bitcoinist', feedUrl: 'https://bitcoinist.com/feed/', category: 'news' },
  { name: 'CryptoPotato', feedUrl: 'https://cryptopotato.com/feed/', category: 'news' },
  { name: 'Zycrypto', feedUrl: 'https://zycrypto.com/feed/', category: 'news' },
  { name: 'NullTX', feedUrl: 'https://nulltx.com/feed/', category: 'news' },
  { name: 'LiveCoinWatch', feedUrl: 'https://www.livecoinwatch.com/feed.xml', category: 'markets' },
  { name: 'Crypto News', feedUrl: 'https://cryptonews.com/feed/', category: 'news' },
  { name: 'Blockworks', feedUrl: 'https://blockworks.co/feed', category: 'news' },
  { name: 'CryptoDaily', feedUrl: 'https://cryptodaily.co.uk/feed', category: 'news' },
  { name: 'CoinJournal', feedUrl: 'https://coinjournal.net/feed/', category: 'news' },
  { name: 'The Crypto Basic', feedUrl: 'https://thecryptobasic.com/feed/', category: 'news' },
  { name: 'TokenInsight', feedUrl: 'https://tokeninsight.com/en/rss', category: 'research' },
  { name: 'Messari', feedUrl: 'https://messari.substack.com/feed', category: 'research' },
  { name: 'Chainalysis', feedUrl: 'https://www.chainalysis.com/feed/', category: 'research' },
  { name: 'Dune Analytics', feedUrl: 'https://dune.com/blog/feed.xml', category: 'analytics' },
  { name: 'Nansen', feedUrl: 'https://www.nansen.ai/feed', category: 'analytics' },
  {
    name: 'Ethereum Foundation',
    feedUrl: 'https://blog.ethereum.org/feed.xml',
    category: 'development',
  },
  {
    name: 'Solana Foundation',
    feedUrl: 'https://solana.com/news/rss.xml',
    category: 'development',
  },
  { name: 'Arbitrum', feedUrl: 'https://arbitrum.foundation/feed.xml', category: 'development' },
  { name: 'Optimism', feedUrl: 'https://optimism.io/feed.xml', category: 'development' },
  { name: 'Paradigm', feedUrl: 'https://paradigm.xyz/feed.xml', category: 'research' },
  { name: 'a16z crypto', feedUrl: 'https://a16zcrypto.com/feed/', category: 'research' },
  {
    name: 'Delphi Digital',
    feedUrl: 'https://members.delphidigital.io/feed',
    category: 'research',
  },
  { name: 'Bankless', feedUrl: 'https://www.bankless.com/feed', category: 'newsletter' },
  {
    name: 'Week in Ethereum',
    feedUrl: 'https://weekinethereumnews.com/feed/',
    category: 'newsletter',
  },
  { name: 'rekt news', feedUrl: 'https://rekt.news/feed.xml', category: 'security' },
];

/**
 * Parse RSS feed XML to extract basic metadata and post count.
 */
async function inspectFeed(
  feedUrl: string,
): Promise<{ recentPosts: number; lastPostDate: number; title?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(feedUrl, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/xml, text/xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('<item') && !text.includes('<entry')) return null;

    // Extract title
    const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch?.[1] ?? undefined;

    // Count items published in the last 7 days
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const dateRegex =
      /<pubDate[^>]*>([^<]+)<\/pubDate>|<published[^>]*>([^<]+)<\/published>|<updated[^>]*>([^<]+)<\/updated>/gi;
    let recentPosts = 0;
    let lastPostDate = 0;
    while (true) {
      const match = dateRegex.exec(text);
      if (match === null) break;
      const dateStr = match[1] ?? match[2] ?? match[3];
      if (dateStr) {
        const ts = new Date(dateStr).getTime();
        if (!Number.isNaN(ts)) {
          if (ts > lastPostDate) lastPostDate = ts;
          if (ts > sevenDaysAgo) recentPosts++;
        }
      }
    }

    return {
      recentPosts,
      lastPostDate,
      title,
    };
  } catch {
    return null;
  }
}

/**
 * Discover new RSS feeds from the known sites list.
 * Checks each feed for freshness and scores by post frequency.
 */
export async function discoverRSSFeeds(existingFeeds: string[] = []): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  const existingUrls = new Set(existingFeeds.map((f) => f.toLowerCase()));

  for (const site of KNOWN_SITES) {
    const feedUrlLower = site.feedUrl.toLowerCase();
    if (existingUrls.has(feedUrlLower)) continue;

    const feed = await inspectFeed(site.feedUrl);
    if (!feed) continue;

    // Calculate relevance based on category
    const relevanceScore = 0.9; // All known crypto feeds are highly relevant

    // Estimate subscriber/follower count from content quality signals
    const subscriberCount =
      site.category === 'news' ? 100000 : site.category === 'research' ? 50000 : 25000;

    // Weekly activity: use recent posts, default to estimated if 0
    const weeklyActivity = Math.max(1, feed.recentPosts || 3);

    const candidate = {
      id: `rss:${encodeURIComponent(site.feedUrl).slice(0, 64)}`,
      platform: 'rss' as const,
      name: feed.title ?? site.name,
      url: site.feedUrl,
      description: `Crypto ${site.category} feed`,
      subscriberCount,
      weeklyActivity,
      sourceCreatedAt: feed.lastPostDate > 0 ? feed.lastPostDate : undefined,
      relevanceScore,
      metadata: {
        category: site.category,
      },
    };

    const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

    sources.push({
      ...candidate,
      score,
      autoApproved: passed,
      status: passed ? 'approved' : 'pending',
      discoveredAt: Date.now(),
    });
  }

  // Try RSS directory search for additional feeds
  await discoverFeedsFromDirectories(existingUrls, sources);

  return sources.sort((a, b) => b.score - a.score);
}

/**
 * Discover additional feeds by searching RSS directories and aggregators.
 */
async function discoverFeedsFromDirectories(
  existingUrls: Set<string>,
  sources: DiscoveredSource[],
): Promise<void> {
  // Check Feedspot crypto feed directory
  const feedDirectories = ['https://blog.feedspot.com/cryptocurrency_rss_feeds/'];

  for (const dirUrl of feedDirectories) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(dirUrl, {
        headers: { 'user-agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const html = await res.text();

      // Extract feed URLs from the page
      const feedUrls =
        html.match(/https?:\/\/[^"'\s]+feed[^"'\s]*\.xml|https?:\/\/[^"'\s]+\/feed\/?/gi) ?? [];
      for (const url of feedUrls.slice(0, 20)) {
        if (existingUrls.has(url.toLowerCase())) continue;
        existingUrls.add(url.toLowerCase());

        const feed = await inspectFeed(url);
        if (!feed?.recentPosts) continue;

        const relevanceScore = CRYPTO_KEYWORDS.some((kw) => feed.title?.toLowerCase().includes(kw))
          ? 0.8
          : 0.5;

        const candidate = {
          id: `rss:${encodeURIComponent(url).slice(0, 64)}`,
          platform: 'rss' as const,
          name: feed.title ?? url.slice(0, 60),
          url,
          subscriberCount: 10000,
          weeklyActivity: Math.max(1, feed.recentPosts),
          relevanceScore,
          metadata: { source: 'feed-directory' },
        };

        const { score, passed } = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);

        sources.push({
          ...candidate,
          score,
          autoApproved: passed,
          status: passed ? 'approved' : 'pending',
          discoveredAt: Date.now(),
        });
      }
    } catch {
      // Directory unavailable, skip
    }
  }
}

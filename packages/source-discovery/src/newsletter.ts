/**
 * @degenfeed/source-discovery — Newsletter discovery engine.
 *
 * Discovers crypto newsletters from known platforms (Substack, Revue,
 * Buttondown, Beehiiv, Ghost) and scores by subscriber count and
 * publishing frequency.
 */

import type { DiscoveredSource } from './types';
import { CRYPTO_KEYWORDS, DEFAULT_DISCOVERY_CONFIG } from './types';
import { computeQualityScore, estimateRelevance } from './quality';

const REQUEST_TIMEOUT_MS = 5000;
const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

/** Known crypto newsletters to check */
const KNOWN_NEWSLETTERS: Array<{
  name: string;
  url: string;
  platform: string;
  category: string;
}> = [
  // Large crypto newsletters
  { name: 'Bankless', url: 'https://www.bankless.com/feed', platform: 'substack', category: 'defi' },
  { name: 'Week in Ethereum News', url: 'https://weekinethereumnews.com/feed/', platform: 'ghost', category: 'development' },
  { name: 'The Daily Gwei', url: 'https://thedailygwei.substack.com/feed', platform: 'substack', category: 'defi' },
  { name: 'Milk Road', url: 'https://milkroad.com/feed/', platform: 'custom', category: 'crypto' },
  { name: 'Proof of Work', url: 'https://proofofwork.news/feed.xml', platform: 'ghost', category: 'crypto' },
  { name: 'DeFi Times', url: 'https://defitimes.substack.com/feed', platform: 'substack', category: 'defi' },
  { name: 'The Rollup', url: 'https://therollup.co/feed/', platform: 'ghost', category: 'development' },
  { name: 'Crypto Native', url: 'https://cryptonative.substack.com/feed', platform: 'substack', category: 'crypto' },
  { name: 'How to DeFi', url: 'https://howtodefi.substack.com/feed', platform: 'substack', category: 'defi' },
  { name: 'Token Daily', url: 'https://www.tokendaily.co/feed.xml', platform: 'custom', category: 'crypto' },
  { name: 'Delphi Daily', url: 'https://members.delphidigital.io/feed', platform: 'ghost', category: 'research' },
  { name: '24/7 Crypto', url: 'https://247crypto.substack.com/feed', platform: 'substack', category: 'crypto' },
  { name: 'The Scoop', url: 'https://blockworks.co/feed', platform: 'custom', category: 'news' },
  { name: 'Empire', url: 'https://blockworks.co/feed/empire', platform: 'custom', category: 'crypto' },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed', platform: 'ghost', category: 'defi' },
  { name: 'Chainlink Today', url: 'https://chainlinktoday.substack.com/feed', platform: 'substack', category: 'development' },
  { name: 'Solana Beach', url: 'https://newsletter.solana.com/feed', platform: 'custom', category: 'development' },
  { name: 'The Tie', url: 'https://research.thetie.io/feed/', platform: 'ghost', category: 'research' },
  { name: 'Kaito Research', url: 'https://research.kaito.ai/feed.xml', platform: 'custom', category: 'research' },
  { name: 'Messari Daily', url: 'https://messari.io/rss', platform: 'custom', category: 'research' },
  { name: 'HackerNoon Crypto', url: 'https://hackernoon.com/tagged/cryptocurrency/feed', platform: 'custom', category: 'crypto' },
  { name: 'Crypto Briefing', url: 'https://cryptobriefing.com/feed/', platform: 'custom', category: 'news' },
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/', platform: 'custom', category: 'news' },
  { name: 'CoinMarketCap Blog', url: 'https://blog.coinmarketcap.com/feed/', platform: 'custom', category: 'markets' },
];

/**
 * Check a newsletter's RSS feed for freshness and metadata.
 */
async function inspectNewsletter(
  feedUrl: string,
): Promise<{ recentPosts: number; lastPostDate: number; title?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(feedUrl, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml, text/xml' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('<item') && !text.includes('<entry')) return null;

    const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch?.[1];

    // Count recent posts (last 30 days for newsletters)
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    let recentPosts = 0;
    let lastPostDate = 0;

    const dateRegex = /<pubDate[^>]*>([^<]+)<\/pubDate>|<published[^>]*>([^<]+)<\/published>|<updated[^>]*>([^<]+)<\/updated>/gi;
    let match;
    while ((match = dateRegex.exec(text)) !== null) {
      const dateStr = match[1] ?? match[2] ?? match[3];
      if (dateStr) {
        const ts = new Date(dateStr).getTime();
        if (!isNaN(ts)) {
          if (ts > lastPostDate) lastPostDate = ts;
          if (ts > thirtyDaysAgo) recentPosts++;
        }
      }
    }

    // For newsletters, check weekly post cadence
    const weeklyPosts = (text.match(/<(item|entry)>/g) ?? []).length;

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
 * Discover new crypto newsletters.
 */
export async function discoverNewsletters(
  existingNewsletters: string[] = [],
): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  const existingUrls = new Set(existingNewsletters.map((n) => n.toLowerCase()));

  for (const nl of KNOWN_NEWSLETTERS) {
    const feedUrlLower = nl.url.toLowerCase();
    if (existingUrls.has(feedUrlLower)) continue;

    const feed = await inspectNewsletter(nl.url);
    if (!feed) continue;

    // Newsletters typically have weekly/monthly cadence
    const weeklyActivity = Math.max(1, feed.recentPosts || 2);

    // Estimate subscriber base from category and platform
    const subscriberCount =
      nl.category === 'defi' ? 30000 :
      nl.category === 'research' ? 25000 :
      nl.category === 'news' ? 50000 :
      15000;

    const relevanceScore = estimateRelevance(nl.name, nl.category);

    const candidate = {
      id: `newsletter:${encodeURIComponent(nl.url).slice(0, 64)}`,
      platform: 'newsletter' as const,
      name: feed.title ?? nl.name,
      url: nl.url.replace('/feed', '').replace('/feed.xml', ''),
      description: `${nl.platform} newsletter covering ${nl.category}`,
      subscriberCount,
      weeklyActivity,
      sourceCreatedAt: feed.lastPostDate > 0 ? feed.lastPostDate : undefined,
      relevanceScore,
      metadata: {
        platform: nl.platform,
        category: nl.category,
        feedUrl: nl.url,
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

  // Also discover from Substack's network
  await discoverSubstackNewsletters(existingUrls, sources);

  return sources.sort((a, b) => b.score - a.score);
}

/**
 * Discover newsletters by browsing Substack's crypto section.
 */
async function discoverSubstackNewsletters(
  existingUrls: Set<string>,
  sources: DiscoveredSource[],
): Promise<void> {
  try {
    const substackUrl = 'https://substack.com/search?q=crypto&type=publication';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(substackUrl, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return;
    const html = await res.text();

    // Extract Substack publication URLs
    const substackUrls = html.match(/https?:\/\/[a-zA-Z0-9-]+\.substack\.com\/?/g) ?? [];
    const seen = new Set<string>();

    for (const url of substackUrls.slice(0, 15)) {
      const normalized = url.replace(/\/$/, '').toLowerCase();
      if (existingUrls.has(normalized) || seen.has(normalized)) continue;
      seen.add(normalized);

      // Check the RSS feed
      const feedUrl = `${normalized}/feed`;
      const feed = await inspectNewsletter(feedUrl);
      if (!feed) continue;

      const name = feed.title ?? normalized.replace('https://', '').replace('.substack.com', '');
      const relevanceScore = CRYPTO_KEYWORDS.some(
        (kw) => name.toLowerCase().includes(kw),
      ) ? 0.8 : 0.5;

      const candidate = {
        id: `newsletter:substack:${encodeURIComponent(normalized)}`,
        platform: 'newsletter' as const,
        name,
        url: normalized,
        subscriberCount: 10000,
        weeklyActivity: Math.max(1, feed.recentPosts || 1),
        relevanceScore,
        metadata: { platform: 'substack', source: 'substack-search' },
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
    // Substack browse unavailable
  }
}

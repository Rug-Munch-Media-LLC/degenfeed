/**
 * @degenfeed/source-discovery — Newsletter discovery engine.
 *
 * Discovers crypto newsletters from known platforms (Substack, Revue,
 * Buttondown, Beehiiv, Ghost) and scores by subscriber count and
 * publishing frequency.
 */

import { computeQualityScore, estimateRelevance } from './quality';
import type { DiscoveredSource } from './types';
import { CRYPTO_KEYWORDS, DEFAULT_DISCOVERY_CONFIG } from './types';

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
  {
    name: 'Bankless',
    url: 'https://www.bankless.com/feed',
    platform: 'substack',
    category: 'defi',
  },
  {
    name: 'Week in Ethereum News',
    url: 'https://weekinethereumnews.com/feed/',
    platform: 'ghost',
    category: 'development',
  },
  {
    name: 'The Daily Gwei',
    url: 'https://thedailygwei.substack.com/feed',
    platform: 'substack',
    category: 'defi',
  },
  { name: 'Milk Road', url: 'https://milkroad.com/feed/', platform: 'custom', category: 'crypto' },
  {
    name: 'Proof of Work',
    url: 'https://proofofwork.news/feed.xml',
    platform: 'ghost',
    category: 'crypto',
  },
  {
    name: 'DeFi Times',
    url: 'https://defitimes.substack.com/feed',
    platform: 'substack',
    category: 'defi',
  },
  {
    name: 'The Rollup',
    url: 'https://therollup.co/feed/',
    platform: 'ghost',
    category: 'development',
  },
  {
    name: 'Crypto Native',
    url: 'https://cryptonative.substack.com/feed',
    platform: 'substack',
    category: 'crypto',
  },
  {
    name: 'How to DeFi',
    url: 'https://howtodefi.substack.com/feed',
    platform: 'substack',
    category: 'defi',
  },
  {
    name: 'Token Daily',
    url: 'https://www.tokendaily.co/feed.xml',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'Delphi Daily',
    url: 'https://members.delphidigital.io/feed',
    platform: 'ghost',
    category: 'research',
  },
  {
    name: '24/7 Crypto',
    url: 'https://247crypto.substack.com/feed',
    platform: 'substack',
    category: 'crypto',
  },
  { name: 'The Scoop', url: 'https://blockworks.co/feed', platform: 'custom', category: 'news' },
  {
    name: 'Empire',
    url: 'https://blockworks.co/feed/empire',
    platform: 'custom',
    category: 'crypto',
  },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed', platform: 'ghost', category: 'defi' },
  {
    name: 'Chainlink Today',
    url: 'https://chainlinktoday.substack.com/feed',
    platform: 'substack',
    category: 'development',
  },
  {
    name: 'Solana Beach',
    url: 'https://newsletter.solana.com/feed',
    platform: 'custom',
    category: 'development',
  },
  {
    name: 'The Tie',
    url: 'https://research.thetie.io/feed/',
    platform: 'ghost',
    category: 'research',
  },
  {
    name: 'Kaito Research',
    url: 'https://research.kaito.ai/feed.xml',
    platform: 'custom',
    category: 'research',
  },
  {
    name: 'Messari Daily',
    url: 'https://messari.substack.com/feed',
    platform: 'substack',
    category: 'research',
  },
  {
    name: 'HackerNoon Crypto',
    url: 'https://hackernoon.com/tagged/cryptocurrency/feed',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'Crypto Briefing',
    url: 'https://cryptobriefing.com/feed/',
    platform: 'custom',
    category: 'news',
  },
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/', platform: 'custom', category: 'news' },
  {
    name: 'CoinMarketCap Blog',
    url: 'https://blog.coinmarketcap.com/feed/',
    platform: 'custom',
    category: 'markets',
  },

  // Crypto/Trading
  {
    name: 'CoinTelegraph Newsletter',
    url: 'https://cointelegraph.com/rss',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'CoinDesk Newsletter',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'The Block Newsletter',
    url: 'https://www.theblock.co/rss',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'Blockworks Daily',
    url: 'https://blockworks.co/feed',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'Bankless Daily',
    url: 'https://newsletter.banklesshq.com/feed',
    platform: 'substack',
    category: 'defi',
  },
  {
    name: 'Milk Road Daily',
    url: 'https://milkroad.com/feed/',
    platform: 'custom',
    category: 'crypto',
  },
  {
    name: 'Token Dispatch',
    url: 'https://substack.com/@tokendispatch',
    platform: 'substack',
    category: 'crypto',
  },
  {
    name: 'The Drop',
    url: 'https://thedefiant.io/newsletter/feed',
    platform: 'custom',
    category: 'defi',
  },
  {
    name: 'Messari Daily Substack',
    url: 'https://messari.substack.com/feed',
    platform: 'substack',
    category: 'research',
  },

  // Tech
  { name: 'TLDR Tech', url: 'https://tldr.tech/feed', platform: 'custom', category: 'tech' },
  { name: 'The Hustle', url: 'https://thehustle.co/feed', platform: 'custom', category: 'tech' },
  {
    name: 'Benedict Evans',
    url: 'https://www.ben-evans.com/newsletter/feed',
    platform: 'ghost',
    category: 'tech',
  },
  {
    name: 'Stratechery',
    url: 'https://stratechery.com/feed',
    platform: 'custom',
    category: 'tech',
  },
  {
    name: 'Platformer',
    url: 'https://www.platformer.news/feed',
    platform: 'ghost',
    category: 'tech',
  },
  {
    name: 'The Verge Newsletter',
    url: 'https://www.theverge.com/rss/index.xml',
    platform: 'custom',
    category: 'tech',
  },
  {
    name: 'Ars Technica Newsletter',
    url: 'https://arstechnica.com/feed/',
    platform: 'custom',
    category: 'tech',
  },
  {
    name: 'Wired Newsletter',
    url: 'https://www.wired.com/feed/rss',
    platform: 'custom',
    category: 'tech',
  },
  {
    name: 'TechCrunch Daily',
    url: 'https://techcrunch.com/feed/',
    platform: 'custom',
    category: 'tech',
  },
  {
    name: 'Hacker Newsletter',
    url: 'https://hackernewsletter.com/feed',
    platform: 'custom',
    category: 'tech',
  },
  {
    name: 'Not Boring',
    url: 'https://notboring.substack.com/feed',
    platform: 'substack',
    category: 'startup',
  },
  {
    name: 'Exponential View',
    url: 'https://www.exponentialview.co/feed',
    platform: 'custom',
    category: 'tech',
  },

  // AI
  {
    name: 'The Batch (Andrew Ng)',
    url: 'https://www.deeplearning.ai/the-batch/feed/',
    platform: 'custom',
    category: 'ai',
  },
  {
    name: 'TLDR AI',
    url: 'https://tldrai.substack.com/feed',
    platform: 'substack',
    category: 'ai',
  },
  {
    name: 'Import AI',
    url: 'https://importai.substack.com/feed',
    platform: 'substack',
    category: 'ai',
  },
  { name: 'Supervised', url: 'https://supervised.news/feed', platform: 'custom', category: 'ai' },
  {
    name: 'The Algorithmic Bridge',
    url: 'https://www.thealgorithmicbridge.com/feed',
    platform: 'custom',
    category: 'ai',
  },
  {
    name: 'AI Supremacy',
    url: 'https://www.ai-supremacy.com/feed',
    platform: 'custom',
    category: 'ai',
  },
  {
    name: 'Last Week in AI',
    url: 'https://lastweekin.ai/feed',
    platform: 'custom',
    category: 'ai',
  },
  {
    name: 'The Neuron',
    url: 'https://www.theneurondaily.com/feed',
    platform: 'custom',
    category: 'ai',
  },
  { name: "Ben's Bites", url: 'https://bensbites.co/feed', platform: 'custom', category: 'ai' },
  {
    name: 'AI Tool Report',
    url: 'https://www.aitoolreport.com/feed',
    platform: 'custom',
    category: 'ai',
  },
  {
    name: 'TheSequence',
    url: 'https://thesequence.substack.com/feed',
    platform: 'substack',
    category: 'ai',
  },

  // Science
  {
    name: 'Nature Briefing',
    url: 'https://www.nature.com/briefing/signup/feed',
    platform: 'custom',
    category: 'science',
  },
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

    const titleMatch = text.match(/<title[^>]*>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch?.[1];

    // Count recent posts (last 30 days for newsletters)
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    let recentPosts = 0;
    let lastPostDate = 0;

    const dateRegex =
      /<pubDate[^>]*>([^<]+)<\/pubDate>|<published[^>]*>([^<]+)<\/published>|<updated[^>]*>([^<]+)<\/updated>/gi;
    let match;
    while ((match = dateRegex.exec(text)) !== null) {
      const dateStr = match[1] ?? match[2] ?? match[3];
      if (dateStr) {
        const ts = new Date(dateStr).getTime();
        if (!Number.isNaN(ts)) {
          if (ts > lastPostDate) lastPostDate = ts;
          if (ts > thirtyDaysAgo) recentPosts++;
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
      nl.category === 'defi'
        ? 30000
        : nl.category === 'research'
          ? 25000
          : nl.category === 'news'
            ? 50000
            : 15000;

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
      const relevanceScore = CRYPTO_KEYWORDS.some((kw) => name.toLowerCase().includes(kw))
        ? 0.8
        : 0.5;

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

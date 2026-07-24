import type { RssFeedConfig } from './types';
import { DEFAULT_CRYPTO_FEEDS } from './config';

export function normalizeFeedInput(feed: string | RssFeedConfig): RssFeedConfig {
  if (typeof feed === 'string') {
    return {
      url: feed,
      tier: 3,
      weight: 0.7,
      category: 'news',
      tags: ['crypto'],
      authority: 1,
    };
  }
  return feed;
}

export function getFeedsByCategory(category: string): RssFeedConfig[] {
  return DEFAULT_CRYPTO_FEEDS.filter((f) => f.category === category);
}

export function getFeedCategories(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of DEFAULT_CRYPTO_FEEDS) {
    counts[f.category] = (counts[f.category] ?? 0) + 1;
  }
  return counts;
}

/** Returns all newsletter feeds grouped by type */
export function getNewsletterFeeds(): {
  topCrypto: RssFeedConfig[];
  cryptoResearch: RssFeedConfig[];
  defiProtocol: RssFeedConfig[];
  defiAlpha: RssFeedConfig[];
  bitcoin: RssFeedConfig[];
  tradingMarkets: RssFeedConfig[];
  aiCrypto: RssFeedConfig[];
  web3Builders: RssFeedConfig[];
  web3Publishing: RssFeedConfig[];
  medium: RssFeedConfig[];
  techStartup: RssFeedConfig[];
} {
  const all = DEFAULT_CRYPTO_FEEDS.filter((f) => f.category === 'newsletter');
  return {
    topCrypto: all.filter((f) => f.tier === 1),
    cryptoResearch: all.filter(
      (f) => f.tags.includes('research') && f.tier === 2 && !f.tags.includes('ai'),
    ),
    defiProtocol: all.filter(
      (f) => f.tags.includes('defi') && f.tier <= 2 && !f.url.includes('substack'),
    ),
    defiAlpha: all.filter(
      (f) =>
        (f.tags.includes('defi') || f.tags.includes('yield')) &&
        f.tier === 2 &&
        f.url.includes('substack'),
    ),
    bitcoin: all.filter((f) => f.tags.includes('bitcoin') && f.tier === 3),
    tradingMarkets: all.filter((f) => f.tags.includes('markets') || f.tags.includes('trading')),
    aiCrypto: all.filter((f) => f.tags.includes('ai')),
    web3Builders: all.filter((f) => f.tags.includes('web3') && f.tier === 3),
    web3Publishing: all.filter((f) => f.tags.includes('mirror') || f.tags.includes('paragraph')),
    medium: all.filter((f) => f.url.includes('medium.com')),
    techStartup: all.filter((f) => f.tier >= 5),
  };
}

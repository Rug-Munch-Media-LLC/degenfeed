import type { RSSEntry, YouTubeChannel } from './types';
export const QUALITY_FILTERS = {
  /** Max age in days — anything older is excluded */
  MAX_AGE_DAYS: 7,
  /** Shorts shorter than this (seconds) are filtered out */
  SHORTS_MAX_DURATION: 60,
  /** Minimum views threshold (requires Data API; RSS doesn't provide this) */
  MIN_VIEWS: 1000,
  /** Channels exempt from livestream filtering (high-value commentary) */
  LIVESTREAM_EXEMPT_CHANNELS: [
    'Bankless',
    'Coin Bureau',
    'a16z Crypto',
    'Andrei Jikh',
    'Benjamin Cowen',
    'InvestAnswers',
  ] as readonly string[],
};

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
  trading: [
    'trade',
    'trading',
    'chart',
    'technical analysis',
    'support',
    'resistance',
    'entry',
    'exit',
    'swing',
    'scalp',
    'futures',
  ],
  macro: [
    'macro',
    'fed',
    'federal reserve',
    'inflation',
    'interest rate',
    'gdp',
    'recession',
    'monetary policy',
    'qe',
    'dollar',
  ],
};

/**
 * Check if a video should be filtered out as low quality.
 */
export function isLowQualityVideo(
  entry: RSSEntry,
  channel: YouTubeChannel,
  nowMs: number,
  maxAgeDays: number,
): boolean {
  // Age check — skip videos older than maxAgeDays
  const publishedMs = new Date(entry.published).getTime();
  const ageDays = (nowMs - publishedMs) / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) return true;

  // Very short duration = likely Short or irrelevant
  if (entry.duration !== undefined && entry.duration < 60) {
    // But allow certain channels that post short commentary
    const exempt = [
      'Bankless',
      'Coin Bureau',
      'a16z Crypto',
      'Andrei Jikh',
      'Benjamin Cowen',
      'InvestAnswers',
    ] as readonly string[];
    if (!exempt.includes(channel.name)) {
      return true;
    }
  }

  return false;
}

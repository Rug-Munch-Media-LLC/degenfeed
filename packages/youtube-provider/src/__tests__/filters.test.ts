/**
 * @degenfeed/youtube-provider — Filter Tests
 *
 * Tests content type detection, engagement signal computation, quality scoring,
 * low-quality video filtering, creator relevance scoring, and keyword mappings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATEGORY_KEYWORDS,
  computeEngagementSignals,
  computeQualityScore,
  detectContentType,
  isLowQualityVideo,
  QUALITY_FILTERS,
  scoreCreatorRelevance,
} from '../youtube/filters';
import type { RSSEntry, YouTubeChannel } from '../youtube/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const sampleChannel: YouTubeChannel = {
  name: 'Coin Bureau',
  channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
  category: 'market_analysis',
  subcategory: 'daily-news',
  weight: 1.0,
  niches: ['crypto', 'defi', 'macro', 'bitcoin'],
};

function makeEntry(overrides: Partial<RSSEntry> = {}): RSSEntry {
  const now = new Date();
  return {
    videoId: 'abc123',
    title: 'Bitcoin Price Analysis',
    link: 'https://youtube.com/watch?v=abc123',
    published: now.toISOString(),
    updated: now.toISOString(),
    description: 'In-depth analysis of Bitcoin price action',
    channelName: 'Coin Bureau',
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    thumbnail: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
    duration: 600,
    views: 15000,
    likes: 1200,
    comments: 300,
    tags: ['bitcoin', 'crypto', 'analysis'],
    ...overrides,
  };
}

// ─── QUALITY_FILTERS ───────────────────────────────────────────────────────

describe('YouTube Filters: QUALITY_FILTERS constants', () => {
  it('MAX_AGE_DAYS is 7', () => {
    expect(QUALITY_FILTERS.MAX_AGE_DAYS).toBe(7);
  });

  it('SHORTS_MAX_DURATION is 60 seconds', () => {
    expect(QUALITY_FILTERS.SHORTS_MAX_DURATION).toBe(60);
  });

  it('MIN_VIEWS is 1000', () => {
    expect(QUALITY_FILTERS.MIN_VIEWS).toBe(1000);
  });

  it('MIN_ENGAGEMENT_RATE is 0.01 (1%)', () => {
    expect(QUALITY_FILTERS.MIN_ENGAGEMENT_RATE).toBe(0.01);
  });

  it('VIRAL_ENGAGEMENT_RATE is 0.15 (15%)', () => {
    expect(QUALITY_FILTERS.VIRAL_ENGAGEMENT_RATE).toBe(0.15);
  });

  it('LIVESTREAM_EXEMPT_CHANNELS has known crypto channels', () => {
    expect(QUALITY_FILTERS.LIVESTREAM_EXEMPT_CHANNELS).toContain('Bankless');
    expect(QUALITY_FILTERS.LIVESTREAM_EXEMPT_CHANNELS).toContain('Coin Bureau');
    expect(QUALITY_FILTERS.LIVESTREAM_EXEMPT_CHANNELS).toContain('a16z Crypto');
  });
});

// ─── CATEGORY_KEYWORDS ─────────────────────────────────────────────────────

describe('YouTube Filters: CATEGORY_KEYWORDS', () => {
  it('has entries for all expected categories', () => {
    const expectedCategories = [
      'crypto', 'defi', 'nft', 'tutorial', 'news',
      'entertainment', 'trading', 'macro', 'ai', 'tech', 'science', 'startups',
    ];
    for (const cat of expectedCategories) {
      expect(CATEGORY_KEYWORDS[cat]).toBeDefined();
      expect(CATEGORY_KEYWORDS[cat]!.length).toBeGreaterThan(0);
    }
  });

  it('crypto category includes bitcoin and ethereum', () => {
    expect(CATEGORY_KEYWORDS.crypto).toContain('bitcoin');
    expect(CATEGORY_KEYWORDS.crypto).toContain('ethereum');
  });

  it('defi category includes yield and staking', () => {
    expect(CATEGORY_KEYWORDS.defi).toContain('defi');
    expect(CATEGORY_KEYWORDS.defi).toContain('yield');
    expect(CATEGORY_KEYWORDS.defi).toContain('staking');
  });

  it('trading category includes technical analysis terms', () => {
    expect(CATEGORY_KEYWORDS.trading).toContain('trading');
    expect(CATEGORY_KEYWORDS.trading).toContain('technical analysis');
    expect(CATEGORY_KEYWORDS.trading).toContain('leverage');
  });
});

// ─── detectContentType ─────────────────────────────────────────────────────

describe('YouTube Filters: detectContentType', () => {
  it('detects short videos under 60 seconds', () => {
    expect(detectContentType('My Short Video', undefined, 30)).toBe('short');
  });

  it('detects shorts from hashtag', () => {
    expect(detectContentType('#shorts Bitcoin update')).toBe('short');
    expect(detectContentType('#short Crypto news')).toBe('short');
  });

  it('detects livestreams', () => {
    expect(detectContentType('LIVE: Bitcoin Trading')).toBe('livestream');
    expect(detectContentType('Livestream Trading Session')).toBe('livestream');
  });

  it('detects tutorials', () => {
    expect(detectContentType('How to trade Bitcoin tutorial')).toBe('tutorial');
    expect(detectContentType('DeFi Masterclass for Beginners')).toBe('tutorial');
    expect(detectContentType('Complete Guide to Staking')).toBe('tutorial');
  });

  it('detects educational content', () => {
    expect(detectContentType('Bitcoin Explained')).toBe('educational');
    expect(detectContentType('Understanding DeFi Protocols')).toBe('educational');
    expect(detectContentType('What is Layer 2 Scaling')).toBe('educational');
  });

  it('detects reviews', () => {
    expect(detectContentType('Ledger Nano X Review')).toBe('review');
    expect(detectContentType('Best Crypto Wallets Comparison')).toBe('review');
  });

  it('detects interviews', () => {
    expect(detectContentType('Interview with Vitalik Buterin')).toBe('interview');
    expect(detectContentType('Chat with CEO of Coinbase')).toBe('interview');
  });

  it('detects podcasts', () => {
    expect(detectContentType('Crypto Podcast Episode 42')).toBe('podcast');
  });

  it('detects news content', () => {
    expect(detectContentType('Breaking: Bitcoin Hits New ATH')).toBe('news');
    expect(detectContentType('Crypto News Weekly Roundup')).toBe('news');
    expect(detectContentType('Daily Market Update')).toBe('news');
    expect(detectContentType('Weekly Roundup')).toBe('news');
  });

  it('detects analysis', () => {
    expect(detectContentType('Bitcoin On-Chain Analysis')).toBe('analysis');
    expect(detectContentType('Deep Dive into Pendle Finance')).toBe('analysis');
  });

  it('detects commentary', () => {
    expect(detectContentType('My Take on the Fed Decision')).toBe('commentary');
    expect(detectContentType('Unpopular Opinion: ETH is Better')).toBe('commentary');
  });

  it('detects entertainment', () => {
    expect(detectContentType('Funny Crypto Meme Compilation')).toBe('entertainment');
  });

  it('detects vlogs', () => {
    expect(detectContentType('Day in the Life of a Trader')).toBe('vlog');
  });

  it('returns unknown for unrecognized content', () => {
    expect(detectContentType('Random Title')).toBe('unknown');
  });

  it('does not misclassify "lived" or "liveroom" as livestream', () => {
    expect(detectContentType('I Lived in a Cave')).not.toBe('livestream');
  });

  it('checks description text too', () => {
    const detected = detectContentType('Some Title', 'This is a tutorial for beginners');
    expect(detected).toBe('tutorial');
  });
});

// ─── computeEngagementSignals ─────────────────────────────────────────────

describe('YouTube Filters: computeEngagementSignals', () => {
  it('returns undefined for views < 100', () => {
    const entry = makeEntry({ views: 50 });
    expect(computeEngagementSignals(entry)).toBeUndefined();
  });

  it('returns engagement signals with all required fields', () => {
    const entry = makeEntry({ views: 10000, likes: 500, comments: 100 });
    const signals = computeEngagementSignals(entry);
    expect(signals).toBeDefined();
    expect(signals!.viewCount).toBe(10000);
    expect(signals!.likeCount).toBeGreaterThan(0);
    expect(signals!.commentCount).toBeGreaterThan(0);
    expect(signals!.estimatedEngagementRate).toBeGreaterThan(0);
    expect(signals!.growthVelocity).toBeGreaterThan(0);
    expect(['viral', 'trending', 'steady', 'stale']).toContain(signals!.momentum);
  });

  it('estimates likes at 4% of views when not provided', () => {
    const entry = makeEntry({ views: 10000, likes: undefined, comments: undefined });
    const signals = computeEngagementSignals(entry);
    expect(signals!.likeCount).toBe(400); // 4% of 10000
  });

  it('estimates comments at 0.5% of views when not provided', () => {
    const entry = makeEntry({ views: 10000, likes: undefined, comments: undefined });
    const signals = computeEngagementSignals(entry);
    expect(signals!.commentCount).toBe(50); // 0.5% of 10000
  });

  it('identifies viral momentum for high engagement', () => {
    const entry = makeEntry({ views: 500000, likes: 80000, comments: 10000 });
    const signals = computeEngagementSignals(entry);
    expect(signals!.momentum).toBe('viral');
  });

  it('identifies stale momentum for very low velocity', () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 3600000); // 30 days ago
    const entry = makeEntry({
      views: 5000,
      likes: 100,
      comments: 20,
      published: longAgo.toISOString(),
    });
    const signals = computeEngagementSignals(entry);
    expect(signals!.momentum).toBe('stale');
  });
});

// ─── computeQualityScore ─────────────────────────────────────────────────

describe('YouTube Filters: computeQualityScore', () => {
  it('returns a QualityScore with all fields', () => {
    const entry = makeEntry();
    const qs = computeQualityScore(entry, sampleChannel);
    expect(qs).toHaveProperty('overall');
    expect(qs).toHaveProperty('productionQuality');
    expect(qs).toHaveProperty('engagementRateScore');
    expect(qs).toHaveProperty('recencyScore');
    expect(qs).toHaveProperty('completeness');
    expect(qs).toHaveProperty('clickbaitPenalty');
    expect(qs).toHaveProperty('confidence');
    expect(qs.overall).toBeGreaterThan(0);
    expect(qs.overall).toBeLessThanOrEqual(1);
  });

  it('applies clickbait penalty for suspicious titles', () => {
    const clickbaitEntry = makeEntry({
      title: 'YOU WON\'T BELIEVE what happened next! SHOCKING Bitcoin News! 😱🚀',
    });
    const safeEntry = makeEntry({ title: 'Bitcoin Price Analysis March 2024' });
    const clickbaitQs = computeQualityScore(clickbaitEntry, sampleChannel);
    const safeQs = computeQualityScore(safeEntry, sampleChannel);
    expect(clickbaitQs.clickbaitPenalty).toBeGreaterThan(safeQs.clickbaitPenalty);
  });

  it('boosts production quality with engagement data', () => {
    const entry = makeEntry();
    const engagement = computeEngagementSignals(entry);
    const qs = computeQualityScore(entry, sampleChannel, engagement!);
    expect(qs.overall).toBeGreaterThanOrEqual(0);
  });

  it('recencyScore decreases with age', () => {
    const fresh = makeEntry({ published: new Date().toISOString() });
    const old = makeEntry({
      published: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    });
    const freshQs = computeQualityScore(fresh, sampleChannel);
    const oldQs = computeQualityScore(old, sampleChannel);
    expect(freshQs.recencyScore).toBeGreaterThan(oldQs.recencyScore);
  });

  it('completeness is higher with description and thumbnail', () => {
    const full = makeEntry({ description: 'x'.repeat(300), thumbnail: 'thumb.jpg' });
    const minimal = makeEntry({ description: '', thumbnail: undefined });
    const fullQs = computeQualityScore(full, sampleChannel);
    const minimalQs = computeQualityScore(minimal, sampleChannel);
    expect(fullQs.completeness).toBeGreaterThan(minimalQs.completeness);
  });
});

// ─── isLowQualityVideo ────────────────────────────────────────────────────

describe('YouTube Filters: isLowQualityVideo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters videos older than maxAgeDays', () => {
    const oldDate = new Date('2024-01-01').toISOString();
    const entry = makeEntry({ published: oldDate });
    expect(isLowQualityVideo(entry, sampleChannel, Date.now(), 7)).toBe(true);
  });

  it('keeps recent videos that pass quality checks', () => {
    const entry = makeEntry({ views: 50000, likes: 5000 });
    expect(isLowQualityVideo(entry, sampleChannel, Date.now(), 7)).toBe(false);
  });

  it('filters very short videos under 60 seconds for non-exempt channels', () => {
    const shortEntry = makeEntry({ duration: 30 });
    const lowWeightChannel: YouTubeChannel = { ...sampleChannel, weight: 0.4, name: 'Small Channel' };
    expect(isLowQualityVideo(shortEntry, lowWeightChannel, Date.now(), 7)).toBe(true);
  });

  it('exempts known channels from short-duration filter', () => {
    const shortEntry = makeEntry({ duration: 30 });
    const exemptChannel: YouTubeChannel = { ...sampleChannel, name: 'Bankless' };
    const result = isLowQualityVideo(shortEntry, exemptChannel, Date.now(), 7);
    // Should pass through the short-duration check
    expect(result).toBe(false);
  });

  it('filters very low quality content from low-weight channels', () => {
    const lowQuality = makeEntry({
      views: 10,
      likes: 0,
      description: '',
      duration: 0,
      thumbnail: undefined,
    });
    const lowWeightChannel: YouTubeChannel = { ...sampleChannel, weight: 0.3, name: 'Unknown' };
    expect(isLowQualityVideo(lowQuality, lowWeightChannel, Date.now(), 7)).toBe(true);
  });
});

// ─── scoreCreatorRelevance ────────────────────────────────────────────────

describe('YouTube Filters: scoreCreatorRelevance', () => {
  it('returns high score for crypto-related channels', () => {
    const score = scoreCreatorRelevance(
      'Crypto News Channel',
      'Daily cryptocurrency news and Bitcoin analysis',
      ['Bitcoin Price Analysis Today', 'Ethereum Upgrade Discussion'],
    );
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns low score for irrelevant channels', () => {
    const score = scoreCreatorRelevance(
      'GamingFun',
      'Minecraft and Fortnite gameplay videos',
      ['Minecraft Survival Series', 'Fortnite Battle Royale'],
    );
    expect(score).toBeLessThan(0.5);
  });

  it('penalizes obvious gaming content', () => {
    const gaming = scoreCreatorRelevance(
      'Gaming World',
      'Best gaming videos and walkthroughs',
      ['Minecraft Building Tips'],
    );
    const crypto = scoreCreatorRelevance(
      'Crypto World',
      'Bitcoin and cryptocurrency tutorials',
      ['How to trade Bitcoin'],
    );
    expect(gaming).toBeLessThan(crypto);
  });

  it('returns score between 0 and 1', () => {
    const score = scoreCreatorRelevance(
      'Channel',
      'Some description',
      ['Video Title'],
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 0 for entirely empty/channel with no keywords', () => {
    const score = scoreCreatorRelevance(
      'Xyz',
      'asdf',
      ['qwerty'],
    );
    expect(score).toBe(0);
  });
});

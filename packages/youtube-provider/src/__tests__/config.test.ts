/**
 * @degenfeed/youtube-provider — Configuration Tests
 *
 * Tests the curated YouTube channel list and lookup maps.
 * Validates all channel entries have required fields and proper structure.
 */
import { describe, expect, it } from 'vitest';
import { CHANNEL_BY_NAME, CRYPTO_CHANNELS } from '../youtube/config';

// ─── Channel Data Integrity ───────────────────────────────────────────────

describe('YouTube Config: CRYPTO_CHANNELS data integrity', () => {
  it('has a non-empty channel list', () => {
    expect(CRYPTO_CHANNELS.length).toBeGreaterThan(0);
  });

  it('every channel has required fields', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(channel.name).toBeTruthy();
      expect(channel.channelId).toBeTruthy();
      expect(channel.category).toBeTruthy();
      expect(channel.subcategory).toBeTruthy();
      expect(channel.weight).toBeGreaterThanOrEqual(0);
      expect(channel.weight).toBeLessThanOrEqual(1);
      expect(channel.niches.length).toBeGreaterThan(0);
      expect(channel.feed).toContain('youtube.com/feeds/videos.xml');
    }
  });

  it('every channel has a valid category', () => {
    const validCategories = [
      'market_analysis', 'defi', 'trading', 'nft_gaming',
      'macro_bitcoin', 'security_tech', 'ai_ml', 'general_tech',
      'science', 'startups',
    ];
    for (const channel of CRYPTO_CHANNELS) {
      expect(validCategories).toContain(channel.category);
    }
  });

  it('every channel has a weight between 0.5 and 1.0', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(channel.weight).toBeGreaterThanOrEqual(0.5);
      expect(channel.weight).toBeLessThanOrEqual(1.0);
    }
  });

  it('no duplicate channel IDs', () => {
    const ids = CRYPTO_CHANNELS.map((c) => c.channelId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('no duplicate channel names', () => {
    const names = CRYPTO_CHANNELS.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('all channel feeds use valid YouTube RSS URL', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(channel.feed).toMatch(
        /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[\w-]{22}$/,
      );
    }
  });

  it('channel IDs match the feed URLs', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(channel.feed).toContain(channel.channelId);
    }
  });
});

// ─── Category Distribution ───────────────────────────────────────────────

describe('YouTube Config: category distribution', () => {
  it('has channels across all major categories', () => {
    const categories = new Set(CRYPTO_CHANNELS.map((c) => c.category));
    expect(categories.has('market_analysis')).toBe(true);
    expect(categories.has('defi')).toBe(true);
    expect(categories.has('trading')).toBe(true);
    expect(categories.has('nft_gaming')).toBe(true);
    expect(categories.has('macro_bitcoin')).toBe(true);
    expect(categories.has('security_tech')).toBe(true);
  });

  it('market_analysis is the largest category', () => {
    const categoryCounts: Record<string, number> = {};
    for (const ch of CRYPTO_CHANNELS) {
      categoryCounts[ch.category] = (categoryCounts[ch.category] ?? 0) + 1;
    }
    expect(categoryCounts.market_analysis).toBeGreaterThanOrEqual(
      Math.max(...Object.values(categoryCounts)),
    );
  });
});

// ─── CHANNEL_BY_NAME Lookup ──────────────────────────────────────────────

describe('YouTube Config: CHANNEL_BY_NAME lookup', () => {
  it('maps every channel name to its config', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(CHANNEL_BY_NAME[channel.name]).toBeDefined();
      expect(CHANNEL_BY_NAME[channel.name]!.name).toBe(channel.name);
      expect(CHANNEL_BY_NAME[channel.name]!.channelId).toBe(channel.channelId);
    }
  });

  it('provides fast lookup for known channels', () => {
    expect(CHANNEL_BY_NAME['Coin Bureau']).toBeDefined();
    expect(CHANNEL_BY_NAME['Coin Bureau']!.category).toBe('market_analysis');
    expect(CHANNEL_BY_NAME['Bankless']).toBeDefined();
    expect(CHANNEL_BY_NAME['Bankless']!.category).toBe('market_analysis');
    expect(CHANNEL_BY_NAME['Finematics']).toBeDefined();
    expect(CHANNEL_BY_NAME['Finematics']!.category).toBe('defi');
  });

  it('returns undefined for unknown channels', () => {
    expect(CHANNEL_BY_NAME['NonExistent Channel']).toBeUndefined();
  });

  it('exact count matches: all channels are in the lookup', () => {
    const lookupCount = Object.keys(CHANNEL_BY_NAME).length;
    expect(lookupCount).toBe(CRYPTO_CHANNELS.length);
  });
});

// ─── Channel Niches ──────────────────────────────────────────────────────

describe('YouTube Config: channel niches', () => {
  it('every channel has at least one niche', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(channel.niches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all niches are strings and every channel has at least one', () => {
    for (const channel of CRYPTO_CHANNELS) {
      expect(channel.niches.length).toBeGreaterThan(0);
      for (const niche of channel.niches) {
        expect(typeof niche).toBe('string');
        expect(niche.length).toBeGreaterThan(0);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  FEED_DESCRIPTIONS,
  generateCrossProtocolFeed,
  generateCryptoFeed,
  generateDegenFeed,
  generateTrendingFeed,
  toFeedSkeleton,
} from './atproto-feeds';

describe('@degenfeed/bluesky-sdk/atproto-feeds', () => {
  describe('FEED_DESCRIPTIONS', () => {
    it('should have descriptions for all feed types', () => {
      expect(FEED_DESCRIPTIONS.crypto).toBeTruthy();
      expect(FEED_DESCRIPTIONS.trending).toBeTruthy();
      expect(FEED_DESCRIPTIONS['cross-protocol']).toBeTruthy();
    });
  });

  describe('generateCryptoFeed', () => {
    it('should return a feed response with correct shape', async () => {
      const result = await generateCryptoFeed({ limit: 10 });
      expect(result).toHaveProperty('feed');
      expect(result).toHaveProperty('meta');
      expect(result.meta.feedType).toBe('crypto');
      expect(result.feed.length).toBeLessThanOrEqual(10);
    });

    it('should return items with required fields', async () => {
      const result = await generateCryptoFeed({ limit: 5 });
      for (const item of result.feed) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('uri');
        expect(item).toHaveProperty('sourceApp');
        expect(item).toHaveProperty('text');
        expect(item).toHaveProperty('badgeColor');
      }
    });
  });

  describe('generateTrendingFeed', () => {
    it('should return a trending feed with sorted items', async () => {
      const result = await generateTrendingFeed({ limit: 10 });
      expect(result.meta.feedType).toBe('trending');
      expect(result.feed.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateCrossProtocolFeed', () => {
    it('should include bridged protocol content', async () => {
      const result = await generateCrossProtocolFeed({ limit: 20 });
      expect(result.meta.feedType).toBe('cross-protocol');
      expect(result.meta.sourceProtocols).toContain('atproto');
      expect(result.meta.sourceProtocols).toContain('nostr');
      expect(result.meta.sourceProtocols).toContain('farcaster');
    });

    it('should have cross-protocol badge color', async () => {
      const result = await generateCrossProtocolFeed({ limit: 5 });
      for (const item of result.feed) {
        expect(item.badgeColor).toBeTruthy();
      }
    });
  });

  describe('generateDegenFeed', () => {
    it('should dispatch to crypto feed by default', async () => {
      const result = await generateDegenFeed({});
      expect(result.meta.feedType).toBe('crypto');
    });

    it('should dispatch based on feedType param', async () => {
      const trending = await generateDegenFeed({ feedType: 'trending' });
      expect(trending.meta.feedType).toBe('trending');

      const cross = await generateDegenFeed({ feedType: 'cross-protocol' });
      expect(cross.meta.feedType).toBe('cross-protocol');
    });
  });

  describe('toFeedSkeleton', () => {
    it('should convert feed response to AT Protocol skeleton format', async () => {
      const feed = await generateCryptoFeed({ limit: 3 });
      const skeleton = toFeedSkeleton(feed);

      expect(skeleton).toHaveProperty('feed');
      expect(skeleton.feed.length).toBeLessThanOrEqual(3);
      for (const entry of skeleton.feed) {
        expect(entry).toHaveProperty('post');
        expect(entry.post).toMatch(/^at:\/\//);
      }
    });
  });
});

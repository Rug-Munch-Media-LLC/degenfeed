import { describe, expect, it } from 'vitest';
import { badgeColorForApp, mapCollectionToApp } from './atproto-firehose';

describe('@degenfeed/bluesky-sdk/atproto-firehose', () => {
  describe('mapCollectionToApp', () => {
    it('should map app.bsky.feed.post to bluesky', () => {
      const result = mapCollectionToApp('app.bsky.feed.post');
      expect(result).not.toBeNull();
      expect(result?.appKey).toBe('bluesky');
      expect(result?.appName).toBe('Bluesky');
      expect(result?.type).toBe('post');
    });

    it('should map com.whtwnd.blog.entry to whitewind', () => {
      const result = mapCollectionToApp('com.whtwnd.blog.entry');
      expect(result).not.toBeNull();
      expect(result?.appKey).toBe('whitewind');
      expect(result?.type).toBe('article');
    });

    it('should map fyi.frontpage.post to frontpage', () => {
      const result = mapCollectionToApp('fyi.frontpage.post');
      expect(result).not.toBeNull();
      expect(result?.appKey).toBe('frontpage');
      expect(result?.type).toBe('link');
    });

    it('should return null for unknown collection', () => {
      expect(mapCollectionToApp('com.unknown.app')).toBeNull();
    });
  });

  describe('badgeColorForApp', () => {
    it('should return blue for bluesky', () => {
      expect(badgeColorForApp('bluesky')).toBe('#0285FF');
    });

    it('should return green for degenfeed', () => {
      expect(badgeColorForApp('degenfeed')).toBe('#22C55E');
    });

    it('should return default gray for unknown app', () => {
      expect(badgeColorForApp('unknown')).toBe('#6B7280');
    });
  });
});

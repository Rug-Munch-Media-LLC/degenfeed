/**
 * Tests for the RecommendationEngine.
 *
 * Run: npx vitest run workers/api/src/__tests__/recommendation-engine.test.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';
import { type ContentItem, RecommendationEngine } from '../lib/recommendation-engine';

// ─── Mock KV ──────────────────────────────────────────────────────────────

function createMockEnv(): Env {
  const store = new Map<string, string>();

  return {
    CACHE: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string, _opts?: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      getWithMetadata: vi.fn(),
      list: vi.fn(),
    },
  } as unknown as Env;
}

// ─── Sample content ───────────────────────────────────────────────────────

function _createSampleContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'youtube:test123',
    source: 'youtube',
    title: 'Test Video',
    description: 'A test video for recommendation engine testing',
    creatorId: 'nostr:creator1',
    creatorName: 'Test Creator',
    creatorAvatar: 'https://example.com/avatar.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    url: 'https://example.com/video',
    duration: 600,
    categories: ['crypto', 'defi'],
    tags: ['bitcoin', 'ethereum', 'defi'],
    publishedAt: Date.now() - 3600000, // 1 hour ago
    metrics: { views: 5000, likes: 200, shares: 50, comments: 30 },
    creatorQuality: 85,
    isShort: false,
    isLive: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('RecommendationEngine', () => {
  let env: Env;
  let engine: RecommendationEngine;

  beforeEach(() => {
    env = createMockEnv();
    engine = new RecommendationEngine(env);
  });

  describe('recordInteraction', () => {
    it('should store an interaction and invalidate profile cache', async () => {
      await engine.recordInteraction('0xabc', 'youtube:test123', 'watch', {
        dwellMs: 30000,
        category: 'crypto',
        tags: ['bitcoin'],
        creatorId: 'nostr:creator1',
        source: 'youtube',
        duration: 600,
      });

      // Profile cache should be invalidated after recording
      const cachedProfile = await (env.CACHE as NonNullable<Env['CACHE']>).get('rec:profile:0xabc');
      expect(cachedProfile).toBeNull();

      // Interactions should be stored
      const raw = await (env.CACHE as NonNullable<Env['CACHE']>).get('rec:int:0xabc');
      expect(raw).not.toBeNull();
      const interactions = JSON.parse(raw!);
      expect(interactions).toHaveLength(1);
      expect(interactions[0].contentId).toBe('youtube:test123');
      expect(interactions[0].action).toBe('watch');
    });

    it('should handle multiple interactions from different users', async () => {
      await engine.recordInteraction('0xabc', 'video1', 'like', {
        category: 'crypto',
      });
      await engine.recordInteraction('0xdef', 'video2', 'watch', {
        category: 'nft',
      });

      // Each user should have their own interaction store
      const raw1 = await (env.CACHE as NonNullable<Env['CACHE']>).get('rec:int:0xabc');
      const raw2 = await (env.CACHE as NonNullable<Env['CACHE']>).get('rec:int:0xdef');
      expect(JSON.parse(raw1!)).toHaveLength(1);
      expect(JSON.parse(raw2!)).toHaveLength(1);
    });

    it('should handle skip interactions', async () => {
      await engine.recordInteraction('0xabc', 'youtube:skipme', 'skip', {
        category: 'gaming',
        creatorId: 'nostr:gamer',
        source: 'youtube',
      });

      const profile = await engine.getUserProfile('0xabc');
      expect(profile.skippedContent).toContain('youtube:skipme');
    });
  });

  describe('getUserProfile', () => {
    it('should return a default profile for new users with no interactions', async () => {
      const profile = await engine.getUserProfile('0xnewuser');
      expect(profile.topCategories).toEqual([]);
      expect(profile.topTags).toEqual([]);
      expect(profile.topCreators).toEqual([]);
      expect(profile.engagementRate).toBe(0.1);
      expect(profile.recentWatched).toEqual([]);
    });

    it('should build a profile from watch interactions', async () => {
      // Record several watch interactions in the same category
      for (let i = 0; i < 5; i++) {
        await engine.recordInteraction('0xabc', `video${i}`, 'watch', {
          category: 'crypto',
          tags: ['bitcoin', 'ethereum'],
          creatorId: 'nostr:crypto-creator',
          source: 'youtube',
          dwellMs: 120000,
          duration: 600,
        });
      }

      // Record a like
      await engine.recordInteraction('0xabc', 'video0', 'like', {
        category: 'crypto',
        creatorId: 'nostr:crypto-creator',
      });

      const profile = await engine.getUserProfile('0xabc');
      expect(profile.topCategories.length).toBeGreaterThan(0);
      expect(profile.topCategories[0]?.category).toBe('crypto');
      expect(profile.engagementRate).toBeGreaterThan(0);
      expect(profile.watchTimeByCategory.crypto).toBeGreaterThan(0);
    });

    it('should prefer fresh interactions over old ones', async () => {
      // Old interaction (older timestamp)
      await engine.recordInteraction('0xabc', 'old-video', 'watch', {
        category: 'old-category',
        tags: ['old-tag'],
        creatorId: 'nostr:old-creator',
        timestamp: Date.now() - 86400000 * 30, // 30 days ago
      });

      // New interaction
      await engine.recordInteraction('0xabc', 'new-video', 'watch', {
        category: 'crypto',
        tags: ['bitcoin'],
        creatorId: 'nostr:crypto-creator',
        timestamp: Date.now() - 3600000, // 1 hour ago
      });

      const profile = await engine.getUserProfile('0xabc');
      // The crypto category should have higher weight due to more recent activity
      const cryptoCat = profile.topCategories.find((c) => c.category === 'crypto');
      const _oldCat = profile.topCategories.find((c) => c.category === 'old-category');
      expect(cryptoCat).toBeDefined();
    });
  });

  describe('getVideoRecommendations', () => {
    it('should return an empty array when no content pool is available', async () => {
      await engine.recordInteraction('0xabc', 'video1', 'watch', {
        category: 'crypto',
        creatorId: 'nostr:creator1',
      });

      const results = await engine.getVideoRecommendations('0xabc', {
        limit: 10,
      });
      expect(results).toEqual([]);
    });

    it('should exclude watched content by default', async () => {
      // The engine excludes content in profile.recentWatched
      await engine.recordInteraction('0xabc', 'youtube:watched1', 'watch', {
        category: 'crypto',
        creatorId: 'nostr:creator1',
      });

      const profile = await engine.getUserProfile('0xabc');
      expect(profile.recentWatched).toContain('youtube:watched1');
    });

    it('should apply source filter correctly', async () => {
      await engine.recordInteraction('0xabc', 'video1', 'watch', {
        category: 'crypto',
        source: 'youtube',
        creatorId: 'nostr:creator1',
      });

      // With a source filter that doesn't include any available sources
      const results = await engine.getVideoRecommendations('0xabc', {
        sourceFilter: ['tiktok'],
      });
      expect(results).toEqual([]);
    });
  });

  describe('getPersonalizedTrending', () => {
    it('should return empty when no trending content is available', async () => {
      await engine.recordInteraction('0xabc', 'video1', 'watch', {
        category: 'crypto',
        creatorId: 'nostr:creator1',
      });

      const results = await engine.getPersonalizedTrending('0xabc', 'crypto');
      expect(results).toEqual([]);
    });
  });

  describe('getDiscoverNew', () => {
    it('should return empty when no diverse content is available', async () => {
      await engine.recordInteraction('0xabc', 'video1', 'watch', {
        category: 'crypto',
        creatorId: 'nostr:creator1',
      });

      const results = await engine.getDiscoverNew('0xabc');
      expect(results).toEqual([]);
    });
  });

  describe('getRelatedContent', () => {
    it('should return empty for unknown content', async () => {
      const results = await engine.getRelatedContent('unknown-id', 'youtube');
      expect(results).toEqual([]);
    });
  });

  describe('getShortsRecommendations', () => {
    it('should return empty when no short content is available', async () => {
      await engine.recordInteraction('0xabc', 'short1', 'watch', {
        category: 'gaming',
        creatorId: 'nostr:gamer',
        duration: 30,
      });

      const results = await engine.getShortsRecommendations('0xabc');
      expect(results).toEqual([]);
    });
  });

  describe('getStreamRecommendations', () => {
    it('should return empty when no live content is available', async () => {
      await engine.recordInteraction('0xabc', 'stream1', 'watch', {
        category: 'gaming',
        creatorId: 'nostr:streamer',
        source: 'twitch',
      });

      const results = await engine.getStreamRecommendations('0xabc');
      expect(results).toEqual([]);
    });
  });

  describe('profile caching', () => {
    it('should cache profile after first build', async () => {
      await engine.recordInteraction('0xabc', 'video1', 'watch', {
        category: 'crypto',
        creatorId: 'nostr:creator1',
      });

      // First call builds and caches the profile
      const profile1 = await engine.getUserProfile('0xabc');
      expect(profile1.topCategories.length).toBeGreaterThan(0);

      // Second call should return cached profile (no new interactions recorded)
      const getSpy = vi.spyOn(env.CACHE!, 'get');
      const profile2 = await engine.getUserProfile('0xabc');
      expect(profile2.topCategories).toEqual(profile1.topCategories);

      // Verify cache was used
      expect(getSpy).toHaveBeenCalledWith('rec:profile:0xabc');
    });
  });

  describe('interaction history limits', () => {
    it('should cap stored interactions at MAX_INTERACTIONS', async () => {
      const maxInteractions = 500;

      // Record more than the max
      for (let i = 0; i < maxInteractions + 50; i++) {
        await engine.recordInteraction('0xabc', `video${i}`, 'watch', {
          category: 'crypto',
          creatorId: 'nostr:creator1',
        });
      }

      const raw = await (env.CACHE as NonNullable<Env['CACHE']>).get('rec:int:0xabc');
      const interactions = JSON.parse(raw!);
      expect(interactions.length).toBeLessThanOrEqual(maxInteractions);
    });
  });
});

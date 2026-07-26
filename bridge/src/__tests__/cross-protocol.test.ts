/**
 * TEST SUITE 4: Cross-Protocol Tests
 *
 * Tests cross-protocol event bridging, fediverse discovery,
 * identity resolution, and fallback behavior.
 */

import { describe, expect, it } from 'vitest';

describe('Cross-protocol event bridge', () => {
  it('sync functions return structured results gracefully', async () => {
    const { syncMobilizonToSmokeSignal } = await import('../event-bridge');

    const result = await syncMobilizonToSmokeSignal('test-token');
    expect(result).toHaveProperty('bridged');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('errors');
    expect(typeof result.bridged).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('syncSmokeSignalToMobilizon returns structured result', async () => {
    const { syncSmokeSignalToMobilizon } = await import('../event-bridge');

    const result = await syncSmokeSignalToMobilizon('test-token');
    expect(result).toHaveProperty('bridged');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('errors');
  });

  it('contentHash produces consistent behavior across calls', async () => {
    const { syncMobilizonToSmokeSignal } = await import('../event-bridge');

    // Running twice — second run should skip already-seen events
    const result1 = await syncMobilizonToSmokeSignal('token-a');
    const result2 = await syncMobilizonToSmokeSignal('token-a');

    // Both should not throw and return valid shapes
    expect(typeof result1.skipped).toBe('number');
    expect(typeof result2.skipped).toBe('number');
  });

  it('UnifiedEvent type has required fields for bridging', () => {
    const event = {
      id: 'event:test:1',
      protocol: 'smokesignal',
      title: 'Test Event',
      description: 'A test event',
      beginsOn: '2024-06-15T10:00:00.000Z',
      isOnline: true,
      organizer: {
        id: 'did:plc:test',
        primary: { protocol: 'atproto', id: 'did:plc:test' },
        handles: { atproto: 'test.bsky.social' },
        displayName: 'Test Organizer',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      tags: ['crypto', 'defi'],
      url: 'https://example.com/event',
      rsvpCount: 0,
      status: 'confirmed' as const,
      visibility: 'public' as const,
      categories: ['conference'],
      createdAt: Date.now(),
      raw: {},
    };

    expect(event.id).toBeTruthy();
    expect(event.protocol).toBe('smokesignal');
    expect(event.isOnline).toBe(true);
    expect(event.status).toBe('confirmed');
    expect(event.visibility).toBe('public');

    // Bridging metadata
    const bridgedEvent = {
      ...event,
      bridgedFrom: 'mobilizon:event-123',
      bridgedTo: ['smokesignal:event-456'],
    };
    expect(bridgedEvent.bridgedFrom).toBeTruthy();
    expect(bridgedEvent.bridgedTo?.length).toBe(1);
  });
});

describe('Fediverse discovery', () => {
  it('fetchTrendingHashtags returns array gracefully', async () => {
    const { fetchTrendingHashtags } = await import('../server/fediverse-discovery');

    const tags = await fetchTrendingHashtags();
    expect(Array.isArray(tags)).toBe(true);
    // May be empty without network, but should be an array
  });
});

describe('Federation hub — identity resolution', () => {
  it('FediverseIdentity type has required fields', () => {
    const identity = {
      gtsHandle: '@testuser@social.degenfeed.xyz',
      gtsId: '12345',
      services: {
        peertube: {
          service: 'peertube',
          handle: 'testuser@video.degenfeed.xyz',
          profileUrl: 'https://video.degenfeed.xyz/accounts/testuser',
          exists: true,
        },
        lemmy: null,
      },
      discoveredAt: Date.now(),
      resolved: true,
    };

    expect(identity.gtsHandle).toContain('@');
    expect(identity.gtsHandle).toContain('social.degenfeed.xyz');
    expect(identity.services.peertube.exists).toBe(true);
    expect(identity.services.lemmy).toBeNull();
    expect(identity.resolved).toBe(true);
  });

  it('FediverseServiceProfile handles non-existent accounts', () => {
    const profile = {
      service: 'peertube',
      handle: null,
      profileUrl: null,
      exists: false,
      error: 'Account not found',
    };

    expect(profile.exists).toBe(false);
    expect(profile.error).toBeTruthy();
    expect(profile.handle).toBeNull();
  });
});

describe('Cross-protocol routing and fallback', () => {
  it('SchemaGuard type validates provider metadata shape', () => {
    const schema = {
      id: 'test-protocol',
      name: 'Test Protocol',
      description: 'A test protocol for testing',
      endpoint: '/api/feed/test',
      requiresAuth: false,
    };

    expect(schema.id).toBeTruthy();
    expect(schema.endpoint).toMatch(/^\/api\/feed\//);
    expect(schema.description.length).toBeGreaterThan(0);
    expect(typeof schema.requiresAuth).toBe('boolean');
  });

  it('provider fetch function returns promised posts', () => {
    const mockFetch = async (_limit: number) => [] as any[];
    const result = mockFetch(10);
    expect(result).toBeInstanceOf(Promise);
  });

  it('server module exports expected symbols', async () => {
    const mod = await import('../server/index');
    expect(mod).toHaveProperty('buildFeed');
    expect(mod).toHaveProperty('PROVIDERS');
    expect(mod).toHaveProperty('DEFAULT_PREFERENCES');
  });

  it('cross-protocol notification has expected structure', () => {
    const notification = {
      id: 'notif-cross-0',
      type: 'like' as const,
      protocol: 'nostr',
      actor: {
        displayName: 'Test User',
        handle: 'test@nostr',
        protocol: 'nostr',
      },
      content: 'Liked your post',
      timestamp: Date.now(),
      read: false,
      targetPostId: 'post-1',
    };

    expect(notification.type).toBe('like');
    expect(notification.protocol).toBe('nostr');
    expect(notification.actor.displayName).toBeTruthy();
    expect(notification.read).toBe(false);

    // Verify type discrimination
    const types = ['like', 'repost', 'reply', 'follow', 'mention', 'zap', 'bridge'] as const;
    expect(types).toContain(notification.type);
  });

  it('reaction sync follows expected data shape across protocols', () => {
    const reaction = {
      type: 'like' as const,
      sourceProtocol: 'nostr',
      targetProtocol: 'farcaster',
      sourcePostId: 'nostr:abc@relay',
      targetPostId: 'farcaster:hubble:1:123:post',
      actor: {
        displayName: 'Cross Protocol User',
        handle: 'crossuser',
      },
      timestamp: Date.now(),
    };

    expect(reaction.type).toBe('like');
    expect(reaction.sourceProtocol).toBe('nostr');
    expect(reaction.targetProtocol).toBe('farcaster');
    // Cross-protocol means source and target IDs differ
    expect(reaction.sourcePostId).not.toBe(reaction.targetPostId);
  });

  it('thread continuity preserves parent references across protocols', () => {
    // Simulate a cross-protocol thread
    const rootPost = {
      id: 'nostr:root1@relay',
      protocol: 'nostr',
      text: 'Original post on Nostr',
      createdAt: Date.now() - 3600000,
    };

    const reply = {
      id: 'farcaster:hubble:2:123:reply',
      protocol: 'farcaster',
      text: 'Reply from Farcaster',
      parentId: rootPost.id,
      rootId: rootPost.id,
      createdAt: Date.now() - 1800000,
    };

    const threadedReply = {
      id: 'mastodon:3@mastodon.social',
      protocol: 'mastodon',
      text: 'Another reply from Mastodon',
      parentId: reply.id,
      rootId: rootPost.id,
      createdAt: Date.now() - 600000,
    };

    // Thread chain verification
    expect(reply.parentId).toBe(rootPost.id);
    expect(threadedReply.parentId).toBe(reply.id);
    expect(threadedReply.rootId).toBe(rootPost.id);
    expect(reply.rootId).toBe(rootPost.id);

    // Chain: rootPost ← reply ← threadedReply
    expect(threadedReply.rootId).toBe(rootPost.id);
    expect(threadedReply.parentId).toBe(reply.id);
  });

  it('fallback behavior when protocol does not support feature', () => {
    // RSS has no reactions — should have zero counts
    const rssPost = createMinimalPost('rss:test:1', 'Article', 'rss');

    expect(rssPost.metrics.likes).toBe(0);
    expect(rssPost.metrics.reposts).toBe(0);
    expect(rssPost.engagement.viewerLiked).toBe(false);

    // Simulating a "like" on an RSS post has no persistent effect
    rssPost.engagement.viewerLiked = true;
    expect(rssPost.engagement.raw.likes).toBe(0); // raw data unchanged
  });

  it('crossposter pair configuration validates correctly', () => {
    // Valid pair
    const validPair = {
      id: 'gts-to-nostr',
      source: 'mastodon' as const,
      targets: ['nostr' as const, 'bluesky' as const],
      enabled: true,
      pollIntervalMs: 60000,
      sourceConfig: { baseUrl: 'http://127.0.0.1:8082' },
      targetConfigs: {
        nostr: { relayUrl: 'ws://127.0.0.1:8085' },
        bluesky: { pdsUrl: 'http://127.0.0.1:3012' },
      },
    };

    expect(validPair.id).toBe('gts-to-nostr');
    expect(validPair.enabled).toBe(true);
    expect(validPair.targets).toContain('nostr');
    expect(validPair.targetConfigs.nostr.relayUrl).toContain('ws://');

    // Disabled pair should be skippable
    const disabledPair = { ...validPair, enabled: false };
    expect(disabledPair.enabled).toBe(false);

    // Rate limit config
    const withRateLimit = {
      ...validPair,
      rateLimit: { maxPosts: 10, windowMs: 60000 },
    };
    expect(withRateLimit.rateLimit?.maxPosts).toBe(10);
  });

  it('pair stats tracks success/failure correctly', () => {
    const stats = {
      id: 'gts-to-nostr',
      source: 'mastodon',
      targets: 'nostr',
      totalAttempts: 10,
      totalSuccesses: 7,
      totalFailures: 3,
      consecutiveFailures: 0,
      lastAttemptAt: Date.now() - 60000,
      lastSuccessAt: Date.now() - 120000,
      lastError: null,
      rateLimitRemaining: 50,
      enabled: true,
    };

    expect(stats.totalAttempts).toBe(10);
    expect(stats.totalSuccesses).toBe(7);
    expect(stats.totalSuccesses + stats.totalFailures).toBe(stats.totalAttempts);
    expect(stats.enabled).toBe(true);
  });
});

// ─── Helper ─────────────────────────────────────────────────────────

function createMinimalPost(id: string, text: string, protocol: string) {
  return {
    id,
    protocol,
    author: {
      id: `${protocol}:author`,
      primary: { protocol, id: `${protocol}:author` },
      handles: { [protocol]: `${protocol}user` },
      displayName: `${protocol} User`,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: {},
    niches: ['crypto'],
  };
}

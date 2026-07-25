/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEST SUITE 4: Cross-Protocol Integration Tests (14 tests)
 *
 * Covers cross-protocol flows: post bridging, comment sync, like sync,
 * identity resolution, content deduplication, and engagement aggregation.
 *
 * Tests REAL identity-linking, normalization, and bridge logic from
 * @degenfeed/cross-protocol-bridge with controlled inputs.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  linkIdentity,
  resolveByIdentity,
  resolveByHandle,
  resolveByWallet,
  unlinkIdentity,
  getCrossProtocolDisplay,
  getLinkedProtocols,
} from '../../packages/cross-protocol-bridge/src/identity-linking';
import { aggregateEngagement } from '../../packages/cross-protocol-bridge/src/engagement-sync';
import { extractHashtags, extractMentions, normalizePost } from '../../packages/cross-protocol-bridge/src/normalization';

// ─── Helper: create mock UnifiedPost ──────────────────────────────────────

function createPost(overrides: Partial<UnifiedPost> & { protocol: Protocol; text: string }): UnifiedPost {
  return {
    id: overrides.id ?? `${overrides.protocol}:test-${Date.now()}`,
    protocol: overrides.protocol,
    author: overrides.author ?? {
      id: `${overrides.protocol}:author1`,
      primary: { protocol: overrides.protocol, id: 'author1' },
      handles: { [overrides.protocol]: 'author1' },
      displayName: 'Test Author',
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 100,
      followingCount: 50,
      links: [],
      keys: {},
    },
    text: overrides.text,
    html: overrides.html,
    embeds: overrides.embeds ?? [],
    createdAt: overrides.createdAt ?? Date.now(),
    metrics: overrides.metrics ?? { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: overrides.engagement ?? {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: overrides.raw ?? null,
    niches: overrides.niches ?? [],
    ...overrides,
  } as UnifiedPost;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CROSS-PROTOCOL POST BRIDGING
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Protocol Post Bridging', () => {
  it('normalizes a Nostr post and extracts hashtags correctly', () => {
    const post = createPost({
      protocol: 'nostr',
      text: 'Bitcoin is the future #BTC #crypto #DeFi',
    });
    const normalized = normalizePost(post);
    expect(normalized.text).toContain('Bitcoin');
    // #BTC is translated via translateHashtag function → 'bitcoin'
    expect(normalized.hashtags).toContain('bitcoin');
    expect(normalized.hashtags).toContain('crypto');
    expect(normalized.hashtags).toContain('defi');
    expect(normalized.sourceProtocol).toBe('nostr');
  });

  it('extracts mentions from cross-protocol text using NormalizedMention fields', () => {
    const mentions = extractMentions('Hello @alice@mastodon.social and @bob@bsky.social');
    expect(mentions.length).toBeGreaterThanOrEqual(2);
    const mastodon = mentions.find((m) => m.raw === '@alice@mastodon.social');
    expect(mastodon).toBeDefined();
    expect(mastodon?.protocol).toBe('mastodon');
    const bsky = mentions.find((m) => m.raw === '@bob@bsky.social');
    expect(bsky).toBeDefined();
    expect(bsky?.protocol).toBe('bluesky');
  });

  it('bridges Nostr post to Farcaster via adapter', async () => {
    const { Bridge } = await import('../../packages/cross-protocol-bridge/src/bridge');
    const bridge = new Bridge({ enabled: true });

    const post = createPost({
      protocol: 'nostr',
      text: 'Hello from #Nostr! Bridging to #Farcaster',
    });

    const result = await bridge.bridgePost(post, 'farcaster');
    expect(result.pathId).toBe('nostr→farcaster');
    expect(result.sourceProtocol).toBe('nostr');
    expect(result.targetProtocol).toBe('farcaster');

    bridge.stop();
  });

  it('bridges Mastodon post to Bluesky via adapter', async () => {
    const { Bridge } = await import('../../packages/cross-protocol-bridge/src/bridge');
    const bridge = new Bridge({ enabled: true });

    const post = createPost({
      protocol: 'mastodon',
      text: 'Cross-posting to #Bluesky via the #bridge!',
    });

    const result = await bridge.bridgePost(post, 'bluesky');
    expect(result.pathId).toBe('mastodon→bluesky');
    expect(result.sourceProtocol).toBe('mastodon');
    expect(result.targetProtocol).toBe('bluesky');

    bridge.stop();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. IDENTITY RESOLUTION ACROSS PROTOCOLS
// ═══════════════════════════════════════════════════════════════════════════

describe('Identity Resolution Across Protocols', () => {
  const dfId = 'df:identity_user';
  const wallet = '0xwallet_identity_test';

  beforeEach(() => {
    for (const proto of ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens'] as Protocol[]) {
      unlinkIdentity(dfId, proto);
    }
  });

  it('links identity across Nostr, Farcaster, and Bluesky', () => {
    linkIdentity(dfId, wallet, 'nostr', 'npub_linked_test', 'nostr_user');
    linkIdentity(dfId, wallet, 'farcaster', 'fid:999', 'fc_user');
    linkIdentity(dfId, wallet, 'bluesky', 'did:plc:linked', 'bsky_user');

    const protocols = getLinkedProtocols(dfId);
    expect(protocols).toContain('nostr');
    expect(protocols).toContain('farcaster');
    expect(protocols).toContain('bluesky');
    expect(protocols).not.toContain('lens');
  });

  it('resolves identity by any protocol handle', () => {
    linkIdentity(dfId, wallet, 'farcaster', 'fid:resolve_test', 'resolve_fc');
    linkIdentity(dfId, wallet, 'mastodon', 'mastodon:resolve', 'resolve_masto@example.com');

    const byFcHandle = resolveByHandle('farcaster', 'resolve_fc');
    expect(byFcHandle).toBeDefined();
    expect(byFcHandle?.dfId).toBe(dfId);

    const byMastoHandle = resolveByHandle('mastodon', 'resolve_masto@example.com');
    expect(byMastoHandle).toBeDefined();
    expect(byMastoHandle?.dfId).toBe(dfId);
  });

  it('resolves identity by wallet address', () => {
    linkIdentity(dfId, wallet, 'nostr', 'npub_wallet_test', 'wallet_user');
    const resolved = resolveByWallet(wallet);
    expect(resolved).toBeDefined();
    expect(resolved?.dfId).toBe(dfId);
    expect(resolved?.protocols.some((p) => p.protocol === 'nostr')).toBe(true);
  });

  it('provides cross-protocol display information', () => {
    linkIdentity(dfId, wallet, 'nostr', 'npub_display', 'nostr_display');
    linkIdentity(dfId, wallet, 'farcaster', 'fid:display', 'fc_display');
    linkIdentity(dfId, wallet, 'lens', 'lens:display', 'lens_display');

    const display = getCrossProtocolDisplay(dfId);
    expect(display.protocolCount).toBe(3);
    expect(display.alsoPostedOn).toContain('farcaster');
    expect(display.alsoPostedOn).toContain('lens');
    expect(display.allHandles.length).toBe(3);
  });

  it('unlinks identity and no longer resolves', () => {
    linkIdentity(dfId, wallet, 'nostr', 'npub_unlink', 'unlink_user');
    expect(resolveByIdentity('nostr', 'npub_unlink')).toBeDefined();
    const unlinked = unlinkIdentity(dfId, 'nostr');
    expect(unlinked).toBe(true);
    expect(resolveByIdentity('nostr', 'npub_unlink')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CROSS-PROTOCOL ENGAGEMENT SYNC (LIKES, COMMENTS)
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Protocol Engagement Sync', () => {
  it('aggregates likes from multiple protocols using totalLikes', () => {
    const events: EngagementEvent[] = [
      { type: 'like', protocol: 'nostr', postId: 'post:1', userId: 'u1', timestamp: Date.now() },
      { type: 'like', protocol: 'farcaster', postId: 'post:1', userId: 'u2', timestamp: Date.now() },
      { type: 'like', protocol: 'bluesky', postId: 'post:1', userId: 'u3', timestamp: Date.now() },
    ];

    const aggregated = aggregateEngagement(events);
    expect(aggregated.totalLikes).toBe(3);
    expect(aggregated.byProtocol).toHaveProperty('nostr');
    expect(aggregated.byProtocol).toHaveProperty('farcaster');
    expect(aggregated.byProtocol).toHaveProperty('bluesky');
    expect(aggregated.byProtocol.nostr.likes).toBe(1);
  });

  it('aggregates mixed engagement types (likes + reposts + comments)', () => {
    const events: EngagementEvent[] = [
      { type: 'like', protocol: 'farcaster', postId: 'post:2', userId: 'u1', timestamp: Date.now() },
      { type: 'like', protocol: 'farcaster', postId: 'post:2', userId: 'u2', timestamp: Date.now() },
      { type: 'repost', protocol: 'nostr', postId: 'post:2', userId: 'u3', timestamp: Date.now() },
      { type: 'reply', protocol: 'bluesky', postId: 'post:2', userId: 'u4', timestamp: Date.now() },
      { type: 'like', protocol: 'lens', postId: 'post:2', userId: 'u5', timestamp: Date.now() },
    ];

    const aggregated = aggregateEngagement(events);
    expect(aggregated.totalLikes).toBe(3);
    expect(aggregated.totalReposts).toBe(1);
    expect(aggregated.totalComments).toBe(1);
    const total = aggregated.totalLikes + aggregated.totalReposts + aggregated.totalComments;
    expect(total).toBe(5);
  });

  it('syncs engagement across protocols via syncEngagementAcrossProtocols', async () => {
    const events: EngagementEvent[] = [
      { type: 'like', protocol: 'farcaster', postId: 'farcaster:abc', userId: 'u1', timestamp: Date.now() },
      { type: 'like', protocol: 'bluesky', postId: 'bluesky:abc', userId: 'u1', timestamp: Date.now() },
      { type: 'repost', protocol: 'nostr', postId: 'nostr:abc', userId: 'u2', timestamp: Date.now() },
    ];

    const synced = await syncEngagementAcrossProtocols(events);
    expect(synced.success).toBe(true);
    const agg = synced.aggregated;
    expect(agg.totalLikes).toBe(2);
    expect(agg.totalReposts).toBe(1);
  });

  it('handles empty engagement events gracefully', () => {
    const aggregated = aggregateEngagement([]);
    expect(aggregated.totalLikes).toBe(0);
    expect(aggregated.totalReposts).toBe(0);
    expect(aggregated.totalComments).toBe(0);
    expect(Object.keys(aggregated.byProtocol).length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. CONTENT DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Content Deduplication', () => {
  it('extracts hashtags for dedup comparison', () => {
    const tags1 = extractHashtags('#Bitcoin #DeFi #crypto');
    const tags2 = extractHashtags('#Bitcoin #DeFi #crypto');
    expect(tags1).toEqual(tags2);
  });

  it('detects identical hashtag sets (case-insensitive)', () => {
    const tags1 = extractHashtags('#Bitcoin #DeFi');
    const tags2 = extractHashtags('#bitcoin #defi');
    // Both should normalize to same lowercase translated tags
    expect(tags1.map((t) => t.toLowerCase()).sort()).toEqual(
      tags2.map((t) => t.toLowerCase()).sort(),
    );
  });

  it('extracts mentions with handle field for cross-protocol identity checking', () => {
    const mentions = extractMentions('Hello @user@example.com #BTC');
    expect(mentions.length).toBeGreaterThanOrEqual(1);
    expect(mentions[0]?.handle).toBe('user@example.com');
    expect(mentions[0]?.raw).toBe('@user@example.com');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. FULL CROSS-PROTOCOL SYNC FLOW
// ═══════════════════════════════════════════════════════════════════════════

describe('Full Cross-Protocol Sync Flow', () => {
  it('bridges a post and verifies the result structure', async () => {
    const { Bridge } = await import('../../packages/cross-protocol-bridge/src/bridge');
    const bridge = new Bridge({ enabled: true });

    const post = createPost({
      protocol: 'mastodon',
      text: 'Cross-protocol sync test #testing',
      createdAt: Date.now(),
    });

    const bridgeResult = await bridge.bridgePost(post, 'nostr');
    expect(bridgeResult.pathId).toBe('mastodon→nostr');
    expect(bridgeResult.sourceProtocol).toBe('mastodon');
    expect(bridgeResult.targetProtocol).toBe('nostr');
    // Should have latency (even if the bridge is mocked/empty)
    expect(bridgeResult.latencyMs).toBeGreaterThanOrEqual(0);

    bridge.stop();
  });
});

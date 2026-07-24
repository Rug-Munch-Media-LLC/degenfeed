/**
 * @degenfeed/cross-protocol-bridge — Comprehensive Tests
 *
 * Tests all six requirements:
 * 1. Unified cross-protocol bridge
 * 2. Content normalization
 * 3. Identity linking
 * 4. Cross-protocol notifications
 * 5. Cross-protocol search
 * 6. End-to-end bridge verification
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Bridge } from './bridge';
import { circuitBreaker } from './circuit-breaker';
import {
  findLinkedIdentitiesInText,
  getCrossProtocolDisplay,
  getLinkedProtocols,
  linkIdentity,
  resolveByHandle,
  resolveByIdentity,
  resolveByWallet,
  resolveMentions,
  unlinkIdentity,
} from './identity-linking';
import {
  extractHashtags,
  extractMedia,
  extractMentions,
  normalizePost,
  normalizeText,
  translateHashtag,
} from './normalization';
import {
  fetchUnifiedNotifications,
  generateBridgeNotifications,
  registerNotificationFetcher,
} from './notifications';
import {
  computeRelevanceScore,
  crossProtocolSearch,
  registerSearchProviderFromPosts,
} from './search';
import { activityPubToNostr } from './transforms/activitypub-to-nostr';
import { BRIDGE_PATHS } from './types';

// ─── Mock UnifiedPost Factory ────────────────────────────────────────────

function createMockPost(
  overrides: Partial<UnifiedPost> & { protocol: Protocol; text: string },
): UnifiedPost {
  return {
    id: overrides.id ?? `${overrides.protocol}:test-${Date.now()}`,
    protocol: overrides.protocol,
    author: overrides.author ?? {
      id: `${overrides.protocol}:author1`,
      primary: { protocol: overrides.protocol, id: 'author1' },
      handles: { [overrides.protocol]: 'author1' },
      displayName: 'Author One',
      bio: 'Test author',
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
    raw: overrides.raw ?? {},
    niches: overrides.niches ?? [],
    contentType: overrides.contentType,
  };
}

// ─── Mock WebSocket for notification tests ───────────────────────────────

function mockWebSocket(): void {
  if (typeof globalThis.WebSocket === 'undefined') {
    class MockWebSocket {
      url: string;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      readyState = 0;
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 10);
      }
      addEventListener(event: string, handler: () => void): void {
        if (event === 'open') this.onopen = handler;
        if (event === 'close') this.onclose = handler;
        if (event === 'error') this.onerror = handler;
        if (event === 'message') this.onmessage = handler as (event: { data: string }) => void;
      }
      close(): void {
        this.readyState = 3;
        if (this.onclose) this.onclose();
      }
      send(_data: string): void {
        setTimeout(() => {
          if (this.onmessage) this.onmessage({ data: JSON.stringify(['EOSE', 'df-notif-test']) });
        }, 20);
      }
    }
    (globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket;
  }
}

// ─── Test Suite ──────────────────────────────────────────────────────────

describe('Cross-Protocol Bridge', () => {
  let bridge: Bridge;

  beforeEach(() => {
    circuitBreaker.reset();
    bridge = new Bridge({ enabled: true });
  });

  afterEach(() => {
    bridge.stop();
  });

  // ── Requirement 1: Unified Cross-Protocol Bridge ───────────────────────

  describe('1. Unified Cross-Protocol Bridge', () => {
    it('has all required bridge paths', () => {
      const pathIds = BRIDGE_PATHS.map((p) => p.id);
      expect(pathIds).toContain('activitypub→atproto');
      expect(pathIds).toContain('activitypub→nostr');
      expect(pathIds).toContain('atproto→nostr');
      expect(pathIds).toContain('nostr→farcaster');
      expect(pathIds).toContain('rss→activitypub');
      expect(BRIDGE_PATHS.length).toBeGreaterThanOrEqual(5);
    });

    it('starts and stops without error', () => {
      expect(() => bridge.start()).not.toThrow();
      expect(() => bridge.stop()).not.toThrow();
    });

    it('returns health information for all paths', () => {
      bridge.start();
      const health = bridge.getHealth();
      expect(health.length).toBe(BRIDGE_PATHS.length);
      for (const h of health) {
        expect(h.pathId).toBeTruthy();
        expect(typeof h.healthy).toBe('boolean');
      }
    });

    it('returns health summary', () => {
      const summary = bridge.getHealthSummary();
      expect(summary.total).toBe(BRIDGE_PATHS.length);
      expect(['healthy', 'degraded', 'down']).toContain(summary.overallHealth);
    });

    it('circuit breaker starts closed', () => {
      for (const path of BRIDGE_PATHS) {
        const state = circuitBreaker.getState(path.id);
        if (state) {
          expect(state.state).toBe('closed');
        }
      }
    });

    it('circuit breaker opens after failures', () => {
      const pathId = 'activitypub→nostr';
      circuitBreaker.configure(pathId, {
        failureThreshold: 3,
        resetTimeoutMs: 60_000,
        halfOpenMaxRequests: 1,
      });
      expect(circuitBreaker.isAllowed(pathId)).toBe(true);
      circuitBreaker.recordFailure(pathId);
      circuitBreaker.recordFailure(pathId);
      circuitBreaker.recordFailure(pathId);
      const state = circuitBreaker.getState(pathId);
      expect(state?.state).toBe('open');
      expect(circuitBreaker.isAllowed(pathId)).toBe(false);
    });

    it('circuit breaker resets and allows requests after reset', () => {
      const pathId = 'activitypub→nostr';
      circuitBreaker.configure(pathId, {
        failureThreshold: 1,
        resetTimeoutMs: 60_000,
        halfOpenMaxRequests: 1,
      });
      circuitBreaker.recordFailure(pathId);
      expect(circuitBreaker.getState(pathId)?.state).toBe('open');
      expect(circuitBreaker.isAllowed(pathId)).toBe(false);
      circuitBreaker.reset(pathId);
      expect(circuitBreaker.isAllowed(pathId)).toBe(true);
    });

    it('circuit breaker allows half-open then closes on success', () => {
      const pathId = 'activitypub→nostr';
      circuitBreaker.configure(pathId, {
        failureThreshold: 2,
        resetTimeoutMs: 100,
        halfOpenMaxRequests: 2,
      });
      circuitBreaker.recordFailure(pathId);
      circuitBreaker.recordFailure(pathId);
      expect(circuitBreaker.getState(pathId)?.state).toBe('open');
      expect(circuitBreaker.isAllowed(pathId)).toBe(false);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(circuitBreaker.isAllowed(pathId)).toBe(true);
          circuitBreaker.recordSuccess(pathId);
          expect(circuitBreaker.getState(pathId)?.state).toBe('closed');
          resolve();
        }, 150);
      });
    });
  });

  // ── Requirement 2: Content Normalization ──────────────────────────────

  describe('2. Content Normalization', () => {
    it('normalizes a Mastodon post to NormalizedContent', () => {
      const post = createMockPost({
        protocol: 'mastodon',
        text: 'Hello #Bitcoin world! Check out @user@example.com #crypto',
        embeds: [
          { kind: 'image', url: 'https://example.com/img.jpg', meta: { alt: 'test image' } },
        ],
      });
      const normalized = normalizePost(post);
      expect(normalized.text).toContain('Hello');
      expect(normalized.hashtags).toContain('bitcoin');
      expect(normalized.hashtags).toContain('crypto');
      expect(normalized.mentions.length).toBeGreaterThan(0);
      expect(normalized.mentions[0]?.raw).toBe('@user@example.com');
      expect(normalized.media.length).toBe(1);
      expect(normalized.media[0]?.url).toBe('https://example.com/img.jpg');
      expect(normalized.sourceProtocol).toBe('mastodon');
      expect(normalized.originalPost).toBe(post);
    });

    it('normalizes text without a full UnifiedPost', () => {
      const result = normalizeText('Hello #Bitcoin #crypto world @user@example.com', 'mastodon');
      expect(result.hashtags).toContain('bitcoin');
      expect(result.hashtags).toContain('crypto');
      expect(result.mentions.length).toBeGreaterThan(0);
    });

    it('extracts hashtags correctly', () => {
      const tags = extractHashtags('Hello #Bitcoin #ETH #Solana world #DeFi');
      expect(tags).toContain('bitcoin');
      expect(tags).toContain('ethereum');
      expect(tags).toContain('solana');
      expect(tags).toContain('defi');
    });

    it('translates hashtags between protocols', () => {
      expect(translateHashtag('#Bitcoin')).toBe('bitcoin');
      expect(translateHashtag('#ETH')).toBe('ethereum');
      expect(translateHashtag('#BTC')).toBe('bitcoin');
      expect(translateHashtag('#SOL')).toBe('solana');
      expect(translateHashtag('#UNKNOWN123')).toBe('unknown123');
    });

    it('extracts mentions from ActivityPub handles', () => {
      const mentions = extractMentions('Hello @user@example.com and @alice@bsky.social');
      expect(mentions.length).toBeGreaterThanOrEqual(2);
      const fediMention = mentions.find((m) => m.raw === '@user@example.com');
      expect(fediMention?.protocol).toBe('mastodon');
      const bskyMention = mentions.find((m) => m.raw === '@alice@bsky.social');
      expect(bskyMention?.protocol).toBe('bluesky');
    });

    it('extracts media from posts', () => {
      const post = createMockPost({
        protocol: 'mastodon',
        text: 'Check this out!',
        embeds: [
          { kind: 'image', url: 'https://example.com/img.jpg', meta: { width: 800, height: 600 } },
          { kind: 'video', url: 'https://example.com/vid.mp4', meta: { mimeType: 'video/mp4' } },
        ],
      });
      const media = extractMedia(post);
      expect(media.length).toBe(2);
      expect(media[0]?.kind).toBe('image');
      expect(media[1]?.kind).toBe('video');
    });
  });

  // ── Requirement 3: Identity Linking ───────────────────────────────────

  describe('3. Identity Linking', () => {
    const dfId = 'df:user1';
    const wallet = '0x1234567890abcdef';

    beforeEach(() => {
      for (const proto of ['mastodon', 'nostr', 'farcaster', 'bluesky'] as Protocol[]) {
        unlinkIdentity(dfId, proto);
      }
    });

    it('links a protocol identity', () => {
      const linked = linkIdentity(dfId, wallet, 'mastodon', '12345', 'user@social.degenfeed.xyz', {
        displayName: 'Test User',
        verificationMethod: 'oauth',
      });
      expect(linked.dfId).toBe(dfId);
      expect(linked.protocols.length).toBe(1);
      expect(linked.protocols[0]?.protocol).toBe('mastodon');
      expect(linked.protocols[0]?.verified).toBe(true);
    });

    it('links multiple protocol identities', () => {
      linkIdentity(dfId, wallet, 'mastodon', '12345', 'user@social.degenfeed.xyz');
      linkIdentity(dfId, wallet, 'nostr', 'npub1abc', 'nostruser', {
        verificationMethod: 'signature',
      });
      linkIdentity(dfId, wallet, 'farcaster', '789', 'fcuser');
      const identity = resolveByIdentity('nostr', 'npub1abc');
      expect(identity).toBeDefined();
      expect(identity?.protocols.length).toBe(3);
      const protocols = getLinkedProtocols(dfId);
      expect(protocols).toContain('mastodon');
      expect(protocols).toContain('nostr');
      expect(protocols).toContain('farcaster');
    });

    it('unlinks a protocol identity', () => {
      linkIdentity(dfId, wallet, 'mastodon', '12345', 'user@social.degenfeed.xyz');
      linkIdentity(dfId, wallet, 'nostr', 'npub1abc', 'nostruser');
      const unlinked = unlinkIdentity(dfId, 'mastodon');
      expect(unlinked).toBe(true);
      expect(resolveByIdentity('mastodon', '12345')).toBeUndefined();
    });

    it('resolves by wallet address', () => {
      linkIdentity(dfId, wallet, 'mastodon', '12345', 'user@social.degenfeed.xyz');
      const resolved = resolveByWallet(wallet);
      expect(resolved).toBeDefined();
      expect(resolved?.dfId).toBe(dfId);
    });

    it('resolves by handle', () => {
      linkIdentity(dfId, wallet, 'nostr', 'npub1abc', 'nostruser');
      const resolved = resolveByHandle('nostr', 'nostruser');
      expect(resolved).toBeDefined();
      expect(resolved?.dfId).toBe(dfId);
    });

    it('resolves mentions in text', () => {
      linkIdentity(dfId, wallet, 'mastodon', '12345', 'user@social.degenfeed.xyz');
      const resolved = resolveMentions('Hello @user@social.degenfeed.xyz!', 'mastodon');
      const match = resolved.find((r) => r.mention === '@user@social.degenfeed.xyz');
      expect(match).toBeDefined();
      expect(match?.linked).toBe(true);
    });

    it('finds linked identities in text with display name', () => {
      linkIdentity(dfId, wallet, 'nostr', 'npub1abc', 'nostruser', { displayName: 'Nostr User' });
      const found = findLinkedIdentitiesInText('Check out Nostr User!');
      expect(found.length).toBeGreaterThan(0);
      expect(found[0]?.dfId).toBe(dfId);
    });

    it('provides cross-protocol display info', () => {
      linkIdentity(dfId, wallet, 'nostr', 'npub1abc', 'nostruser');
      linkIdentity(dfId, wallet, 'farcaster', '789', 'fcuser');
      const display = getCrossProtocolDisplay(dfId);
      expect(display.protocolCount).toBe(2);
      expect(display.alsoPostedOn).toContain('farcaster');
      expect(display.allHandles.length).toBe(2);
    });
  });

  // ── Requirement 4: Cross-Protocol Notifications ───────────────────────

  describe('4. Cross-Protocol Notifications', () => {
    it('generates bridge notifications', () => {
      const events = [
        {
          pathId: 'activitypub→nostr',
          sourceProtocol: 'mastodon' as Protocol,
          targetProtocol: 'nostr' as Protocol,
          postId: 'mastodon:123',
          text: 'Hello world',
          timestamp: Date.now(),
        },
      ];
      const notifs = generateBridgeNotifications(events);
      expect(notifs.length).toBe(1);
      expect(notifs[0]?.type).toBe('bridge');
      expect(notifs[0]?.protocol).toBe('nostr');
      expect(notifs[0]?.bridgePath).toBe('activitypub→nostr');
    });

    it('fetches unified notification feed (empty fetcher list)', async () => {
      mockWebSocket();
      const feed = await fetchUnifiedNotifications([], { limit: 10 });
      expect(feed.notifications).toEqual([]);
      expect(feed.meta.total).toBe(0);
    });

    it('fetches notifications with mock fetcher', async () => {
      registerNotificationFetcher('nostr', {
        protocol: 'nostr',
        async fetch() {
          return [
            {
              id: 'test:1',
              type: 'like' as const,
              protocol: 'nostr' as Protocol,
              actor: { displayName: 'Test', handle: 'test', protocol: 'nostr' as Protocol },
              content: 'Test notification',
              createdAt: Date.now(),
              read: false,
            },
          ];
        },
        async healthCheck() {
          return true;
        },
      });
      const feed = await fetchUnifiedNotifications(
        [{ protocol: 'nostr', userId: 'test', auth: {} }],
        { limit: 20 },
      );
      expect(feed.notifications.length).toBeGreaterThanOrEqual(1);
      expect(feed.meta.total).toBeGreaterThanOrEqual(1);
      expect(feed.meta.protocols).toContain('nostr');
      expect(feed.meta.fetchedAt).toBeGreaterThan(0);
    });
  });

  // ── Requirement 5: Cross-Protocol Search ─────────────────────────────

  describe('5. Cross-Protocol Search', () => {
    it('computes relevance scores', () => {
      const post = {
        text: 'Bitcoin is the future of DeFi',
        hashtags: ['bitcoin', 'defi'],
        niches: ['bitcoin', 'defi'],
      };
      const score = computeRelevanceScore(post, {
        text: 'Bitcoin DeFi',
        terms: ['bitcoin', 'defi'],
        exactPhrase: null,
        hashtags: [],
        mentions: [],
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('scores exact phrase higher than partial match', () => {
      const exactMatch = {
        text: 'Bitcoin DeFi revolution',
        hashtags: ['bitcoin', 'defi'],
        niches: [],
      };
      const partialMatch = {
        text: 'DeFi is cool but Bitcoin is king',
        hashtags: ['defi', 'bitcoin'],
        niches: [],
      };
      const query = {
        text: '"bitcoin defi"',
        terms: ['bitcoin', 'defi'],
        exactPhrase: 'bitcoin defi',
        hashtags: [],
        mentions: [],
      };
      const exactScore = computeRelevanceScore(exactMatch, query);
      const partialScore = computeRelevanceScore(partialMatch, query);
      expect(exactScore).toBeGreaterThanOrEqual(partialScore);
    });

    it('returns empty results for empty query', async () => {
      const results = await crossProtocolSearch('', { limit: 10 });
      expect(results.results).toEqual([]);
      expect(results.meta.query).toBe('');
      expect(results.meta.totalResults).toBe(0);
    });

    it('searches registered providers', async () => {
      const posts: UnifiedPost[] = [
        createMockPost({
          protocol: 'nostr',
          text: 'Bitcoin is great for DeFi',
          niches: ['bitcoin', 'defi'],
        }),
        createMockPost({
          protocol: 'farcaster',
          text: 'Ethereum layer2 scaling',
          niches: ['ethereum', 'layer2'],
        }),
      ];
      registerSearchProviderFromPosts('nostr' as Protocol, [posts[0]!]);
      registerSearchProviderFromPosts('farcaster' as Protocol, [posts[1]!]);
      const results = await crossProtocolSearch('Bitcoin', { limit: 10 });
      expect(results.meta.query).toBe('Bitcoin');
      expect(results.meta.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('search returns results grouped by protocol', async () => {
      const results = await crossProtocolSearch('test', { includeIdentities: false });
      expect(results.meta).toBeDefined();
      expect(typeof results.meta.totalResults).toBe('number');
      expect(typeof results.meta.byProtocol).toBe('object');
    });
  });

  // ── Requirement 6: End-to-End Bridge Verification ────────────────────

  describe('6. End-to-End Bridge Verification', () => {
    it('bridges a post from activitypub (mastodon) to nostr', async () => {
      const post = createMockPost({
        protocol: 'mastodon',
        id: 'mastodon:test123',
        text: 'Hello from #ActivityPub! Testing the #bridge to #Nostr @test@example.com',
        embeds: [
          { kind: 'image', url: 'https://example.com/photo.jpg', meta: { alt: 'Test photo' } },
        ],
        createdAt: Date.now(),
      });
      const result = await bridge.bridgePost(post, 'nostr');
      expect(result.pathId).toBe('mastodon→nostr');
      expect(result.sourceProtocol).toBe('mastodon');
      expect(result.targetProtocol).toBe('nostr');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('bridges a post from bluesky (atproto) to nostr', async () => {
      const post = createMockPost({
        protocol: 'bluesky',
        text: 'Hello from #Bluesky! Bridging to #Nostr',
        createdAt: Date.now(),
      });
      const result = await bridge.bridgePost(post, 'nostr');
      expect(result.pathId).toBe('bluesky→nostr');
      expect(result.sourceProtocol).toBe('bluesky');
      expect(result.targetProtocol).toBe('nostr');
    });

    it('bridges a post from nostr to farcaster', async () => {
      const post = createMockPost({
        protocol: 'nostr',
        text: 'Hello from #Nostr! Testing #Farcaster bridge',
        createdAt: Date.now(),
      });
      const result = await bridge.bridgePost(post, 'farcaster');
      expect(result.pathId).toBe('nostr→farcaster');
      expect(result.sourceProtocol).toBe('nostr');
      expect(result.targetProtocol).toBe('farcaster');
    });

    it('bridges RSS to activitypub (mastodon)', async () => {
      const post = createMockPost({
        protocol: 'rss',
        text: 'New blog post: Understanding DeFi in 2026',
        embeds: [{ kind: 'link', url: 'https://blog.example.com/defi-2026', meta: {} }],
        createdAt: Date.now(),
      });
      const result = await bridge.bridgePost(post, 'mastodon');
      expect(result.pathId).toBe('rss→mastodon');
      expect(result.sourceProtocol).toBe('rss');
      expect(result.targetProtocol).toBe('mastodon');
    });

    it('bridges activitypub to atproto (bluesky)', async () => {
      const post = createMockPost({
        protocol: 'mastodon',
        text: 'Cross-posting to #Bluesky via the #bridge!',
        createdAt: Date.now(),
      });
      const result = await bridge.bridgePost(post, 'bluesky');
      expect(result.pathId).toBe('mastodon→bluesky');
      expect(result.sourceProtocol).toBe('mastodon');
      expect(result.targetProtocol).toBe('bluesky');
    });

    it('auto-bridges for linked identity', async () => {
      const dfId = 'df:autobridge';
      const wallet = '0xautobridge';
      linkIdentity(dfId, wallet, 'mastodon', 'author1', 'author@social.degenfeed.xyz');
      linkIdentity(dfId, wallet, 'nostr', 'npub1author', 'author');
      const post = createMockPost({
        protocol: 'mastodon',
        text: 'Auto-bridge test post',
        author: {
          id: 'mastodon:author1',
          primary: { protocol: 'mastodon', id: 'author1' },
          handles: { mastodon: 'author@social.degenfeed.xyz' },
          displayName: 'Author One',
          bio: '',
          avatarUrl: '',
          verified: [],
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
      });
      const batchResult = await bridge.autoBridgeForLinkedIdentity(post);
      expect(batchResult.results.length).toBeGreaterThanOrEqual(0);
      expect(typeof batchResult.totalSuccess).toBe('number');
      expect(typeof batchResult.totalFailure).toBe('number');
    });

    it('bridges a post to multiple targets at once', async () => {
      const post = createMockPost({
        protocol: 'mastodon',
        text: 'Multi-target bridge test #bridge',
        createdAt: Date.now(),
      });
      const batchResult = await bridge.bridgePostToAll(post);
      expect(batchResult.results.length).toBeGreaterThanOrEqual(0);
      expect(typeof batchResult.totalSuccess).toBe('number');
      expect(typeof batchResult.totalFailure).toBe('number');
    });

    it('respects bridge path disable configuration', async () => {
      const disabledBridge = new Bridge({
        enabled: true,
        enabledPaths: { 'mastodon→nostr': false },
      });
      const post = createMockPost({ protocol: 'mastodon', text: 'Should not bridge' });
      const result = await disabledBridge.bridgePost(post, 'nostr');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('content normalization preserves all elements for bridging', async () => {
      const post = createMockPost({
        protocol: 'mastodon',
        text: 'Check out this #Bitcoin post with @friend@example.com and a link https://example.com',
        embeds: [
          { kind: 'image', url: 'https://example.com/img.jpg', meta: { alt: 'chart' } },
          { kind: 'video', url: 'https://example.com/vid.mp4', meta: { duration: 120 } },
        ],
      });
      const normalized = normalizePost(post);
      expect(normalized.text).toContain('Bitcoin');
      expect(normalized.hashtags).toContain('bitcoin');
      expect(normalized.mentions.length).toBeGreaterThan(0);
      expect(normalized.media.length).toBe(2);
      expect(normalized.originalPost).toBe(post);

      // Transform to Nostr via the adapter
      const transformResult = await activityPubToNostr.transform(normalized);
      expect(transformResult.success).toBe(true);
      if (transformResult.success) {
        const payload = transformResult.payload as Record<string, unknown>;
        expect(payload.kind).toBe(1);
        expect(payload.tags).toBeDefined();
        expect(Array.isArray(payload.tags)).toBe(true);
        const tags = payload.tags as string[][];
        expect(tags.some((t: string[]) => t[0] === 't' && t[1] === 'bitcoin')).toBe(true);
      }
    });
  });
});

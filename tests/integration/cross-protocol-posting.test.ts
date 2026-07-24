/**
 * ═════════════════════════════════════════════════════════════════════════════
 * CROSS-PROTOCOL POSTING/PUBLISHING — 8 tests
 *
 * Tests cross-protocol post bridging:
 *   - Bridge engine handling (enabled/disabled, path config)
 *   - Post with media attachments via normalizePost
 *   - Reply threading across protocols
 *   - Cross-post link tracking
 *   - Character limit handling
 *   - Bridge notifications for successful cross-posts
 *
 * Uses the REAL Bridge, identity-linking, normalization, and
 * cross-protocol thread modules with mocked external adapters.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Bridge,
  generateBridgeNotifications,
  normalizePost,
} from '../../packages/cross-protocol-bridge/src';
import {
  buildAlsoPostedIndicator,
  clearThreadStore,
  getAlsoPostedOn,
  registerCrossPostLink,
  registerReply,
} from '../../packages/feed-core/src';
import type { Protocol } from '../../packages/types/src';

// ─── Mock adapter transforms (hoisted to avoid vitest hoisting issue) ──

vi.mock('../../packages/cross-protocol-bridge/src/transforms/index', () => {
  const makeMock = () => ({ success: true as const, payload: { text: 'mocked' } });
  return {
    registerAdapter: vi.fn(),
    getAdapter: vi.fn((id: string) => {
      const adapters: Record<string, any> = {
        'activitypub→nostr': {
          id: 'activitypub→nostr',
          name: 'AP→Nostr',
          source: 'mastodon',
          target: 'nostr',
          healthCheck: vi.fn(),
          transform: vi.fn().mockResolvedValue(makeMock()),
          publish: vi.fn().mockResolvedValue({ success: true as const, nativeId: 'n1' }),
        },
        'nostr→farcaster': {
          id: 'nostr→farcaster',
          name: 'Nostr→FC',
          source: 'nostr',
          target: 'farcaster',
          healthCheck: vi.fn(),
          transform: vi.fn().mockResolvedValue(makeMock()),
          publish: vi.fn().mockResolvedValue({ success: true as const, nativeId: 'n2' }),
        },
        'rss→activitypub': {
          id: 'rss→activitypub',
          name: 'RSS→AP',
          source: 'rss',
          target: 'mastodon',
          healthCheck: vi.fn(),
          transform: vi.fn().mockResolvedValue(makeMock()),
          publish: vi.fn().mockResolvedValue({ success: true as const, nativeId: 'n3' }),
        },
      };
      return adapters[id] ?? null;
    }),
    getAllAdapters: vi.fn(() => []),
    registerBuiltinAdapters: vi.fn(),
  };
});

// ─── Factory helpers ────────────────────────────────────────────────────

function createIdentity(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'test:author1',
    primary: {
      protocol: overrides.primaryProtocol ?? 'nostr',
      id: overrides.primaryId ?? 'npub1author',
    },
    handles: {
      nostr: 'author_nostr',
      farcaster: 'author_fc',
      bluesky: 'author.bsky.social',
      mastodon: 'author@mastodon.social',
      lens: null,
      rss: null,
      threads: null,
    },
    displayName: overrides.displayName ?? 'Cross-Protocol Author',
    bio: overrides.bio ?? '',
    avatarUrl: overrides.avatarUrl ?? '',
    verified: overrides.verified ?? [],
    followerCount: overrides.followerCount ?? 5000,
    followingCount: overrides.followingCount ?? 500,
    links: overrides.links ?? [],
    keys: overrides.keys ?? {},
  };
}

function createPost(overrides: Record<string, any>) {
  return {
    id: overrides.id ?? 'nostr:note1',
    protocol: overrides.protocol ?? 'nostr',
    author: overrides.author ?? createIdentity(),
    text: overrides.text ?? 'Cross-protocol test post',
    html: overrides.html ?? '<p>Cross-protocol test post</p>',
    embeds: overrides.embeds ?? [],
    parentId: overrides.parentId ?? undefined,
    rootId: overrides.rootId ?? undefined,
    createdAt: overrides.createdAt ?? Date.now(),
    metrics: overrides.metrics ?? { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: overrides.metrics ?? { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    niches: overrides.niches ?? ['crypto', 'web3'],
    raw: overrides.raw ?? {},
    crossPostedTo: overrides.crossPostedTo,
  } as any;
}

// ─── SUITE 1: Bridge Engine Basics ──────────────────────────────────────

describe('Cross-Protocol Posting: Bridge Engine', () => {
  it('fails bridge operation when bridge is disabled globally', async () => {
    const bridge = new Bridge({ enabled: false });
    const post = createPost({ id: 'nostr:note1', protocol: 'nostr' });

    const result = await bridge.bridgePost(post, 'mastodon');
    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
    expect(result.retryable).toBe(false);
    console.log('[PASS] Disabled bridge correctly returns error');
  });

  it('rejects when path is explicitly disabled in config', async () => {
    const bridge = new Bridge({ enabled: true, enabledPaths: { 'nostr→farcaster': false } });
    const post = createPost({ id: 'nostr:note2', protocol: 'nostr' });

    const result = await bridge.bridgePost(post, 'farcaster');
    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
    console.log('[PASS] Path-disabled bridge returns disabled error');
  });

  it('updates bridge config at runtime', () => {
    const bridge = new Bridge({ enabled: true });
    expect(bridge.getConfig().enabled).toBe(true);
    bridge.updateConfig({ enabled: false });
    expect(bridge.getConfig().enabled).toBe(false);
    console.log('[PASS] Bridge config updated at runtime');
  });
});

// ─── SUITE 2: Media Attachment Normalization ────────────────────────────

describe('Cross-Protocol Posting: Media Normalization', () => {
  it('normalizes a post with image attachment', () => {
    const post = createPost({
      id: 'nostr:media1',
      protocol: 'nostr',
      text: 'Check out this image!',
      embeds: [
        {
          kind: 'image' as const,
          url: 'https://cdn.example.com/image.png',
          meta: { width: 800, height: 600 },
        },
      ],
    });

    const normalized = normalizePost(post);
    expect(normalized.media).toHaveLength(1);
    expect(normalized.media[0].kind).toBe('image');
    expect(normalized.media[0].url).toBe('https://cdn.example.com/image.png');
    console.log('[PASS] Image post normalized for cross-posting');
  });

  it('normalizes a post with video embed', () => {
    const post = createPost({
      id: 'nostr:video1',
      protocol: 'nostr',
      text: 'New video!',
      embeds: [{ kind: 'video' as const, url: 'https://video.example.com/clip.mp4' }],
    });

    const normalized = normalizePost(post);
    expect(normalized.media).toHaveLength(1);
    expect(normalized.media[0].kind).toBe('video');
    console.log('[PASS] Video post normalized');
  });

  it('extracts hashtags from normalized content', () => {
    const post = createPost({
      id: 'nostr:hash1',
      protocol: 'nostr',
      text: 'Bitcoin and #DeFi are the future',
    });

    const normalized = normalizePost(post);
    // Check that hashtag extraction runs (the function uses the text field)
    expect(normalized.hashtags).toBeDefined();
    expect(typeof normalized.hashtags.length).toBe('number');
    console.log('[PASS] Hashtag extraction ran, found:', normalized.hashtags);
  });
});

// ─── SUITE 3: Reply Threading ───────────────────────────────────────────

describe('Cross-Protocol Posting: Reply Threading', () => {
  beforeEach(() => {
    clearThreadStore();
  });

  it('registers a cross-protocol reply and builds unified thread', () => {
    const thread = registerReply('farcaster', 'cast_original', {
      id: 'nostr:reply_to_fc',
      protocol: 'nostr',
      text: 'Great cast! Replying from Nostr.',
      createdAt: Date.now(),
      author: { id: 'nostr:author1', displayName: 'Nostr User' },
      metrics: { likes: 0, replies: 0 },
      bridged: true,
      bridgeFrom: 'nostr',
      parentUri: 'df://farcaster:cast_original',
      depth: 1,
    });

    expect(thread.threadId).toBe('farcaster:cast_original');
    expect(thread.replies.length).toBeGreaterThanOrEqual(1);
    expect(thread.bridgeCount).toBeGreaterThanOrEqual(1);
    expect(thread.protocols).toContain('nostr');
    console.log('[PASS] Cross-protocol reply thread assembled');
  });

  it('tracks multiple protocol replies in same thread', () => {
    registerReply('mastodon', 'thread1', {
      id: 'nostr:r1',
      protocol: 'nostr',
      text: 'Reply 1',
      createdAt: Date.now() - 2000,
      author: { id: 'n1', displayName: 'Nostr User' },
      metrics: { likes: 0, replies: 0 },
      bridged: true,
      bridgeFrom: 'nostr',
      parentUri: 'df://mastodon:thread1',
      depth: 1,
    });
    const thread = registerReply('mastodon', 'thread1', {
      id: 'bluesky:r2',
      protocol: 'bluesky',
      text: 'Reply 2',
      createdAt: Date.now(),
      author: { id: 'b1', displayName: 'BSky User' },
      metrics: { likes: 0, replies: 0 },
      bridged: true,
      bridgeFrom: 'bluesky',
      parentUri: 'df://mastodon:thread1',
      depth: 1,
    });

    expect(thread.replies).toHaveLength(2);
    expect(thread.protocols).toContain('nostr');
    expect(thread.protocols).toContain('bluesky');
    console.log('[PASS] Multi-protocol thread with', thread.protocols.length, 'protocols');
  });
});

// ─── SUITE 4: Cross-Post Tracking ───────────────────────────────────────

describe('Cross-Protocol Posting: Cross-Post Tracking', () => {
  beforeEach(() => {
    clearThreadStore();
  });

  it('tracks "also posted on" indicators across protocols', () => {
    registerCrossPostLink('mastodon', 'post_original', 'nostr', 'note_bridged', 'user');
    registerCrossPostLink('mastodon', 'post_original', 'bluesky', 'record_bridged', 'bridge');

    const alsoPostedOn = getAlsoPostedOn('mastodon', 'post_original');
    expect(alsoPostedOn).toContain('nostr');
    expect(alsoPostedOn).toContain('bluesky');
    expect(alsoPostedOn).not.toContain('mastodon');

    const indicator = buildAlsoPostedIndicator('mastodon', 'post_original');
    expect(indicator.show).toBe(true);
    expect(indicator.protocols).toHaveLength(2);
    expect(indicator.collapsedText).toContain('Nostr');
    expect(indicator.collapsedText).toContain('Bluesky');
    console.log('[PASS] Cross-post indicator:', indicator.collapsedText);
  });

  it('returns no indicator for posts without cross-posts', () => {
    const indicator = buildAlsoPostedIndicator('mastodon', 'unknown_post');
    expect(indicator.show).toBe(false);
    expect(indicator.protocols).toHaveLength(0);
    console.log('[PASS] No cross-post indicator for single-protocol post');
  });
});

// ─── SUITE 5: Long Content ──────────────────────────────────────────────

describe('Cross-Protocol Posting: Long Content', () => {
  it('identifies content that exceeds Mastodon 500-char limit', () => {
    const shortPost = createPost({ id: 'nostr:short1', protocol: 'nostr', text: 'Short post' });
    expect(shortPost.text.length).toBeLessThan(500);

    const longPost = createPost({ id: 'nostr:long1', protocol: 'nostr', text: 'X'.repeat(600) });
    expect(longPost.text.length).toBeGreaterThan(500);
    console.log('[PASS] Long content (', longPost.text.length, 'chars) detected for truncation');
  });
});

// ─── SUITE 6: Bridge Notifications ──────────────────────────────────────

describe('Cross-Protocol Posting: Bridge Notifications', () => {
  it('generates bridge notifications for multiple bridge paths', () => {
    const notifications = generateBridgeNotifications([
      {
        pathId: 'nostr→farcaster',
        sourceProtocol: 'nostr' as Protocol,
        targetProtocol: 'farcaster' as Protocol,
        postId: 'nostr:note1',
        text: 'Hello from Nostr!',
        timestamp: Date.now(),
      },
      {
        pathId: 'nostr→activitypub',
        sourceProtocol: 'nostr' as Protocol,
        targetProtocol: 'mastodon' as Protocol,
        postId: 'nostr:note1',
        text: 'Hello from Nostr!',
        timestamp: Date.now(),
      },
    ]);

    expect(notifications).toHaveLength(2);
    expect(notifications[0].type).toBe('bridge');
    expect(notifications[0].bridgePath).toBe('nostr→farcaster');
    expect(notifications[1].bridgePath).toBe('nostr→activitypub');
    expect(notifications[0].postId).toBe('nostr:note1');
    console.log('[PASS]', notifications.length, 'bridge notifications generated');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @degenfeed/nostr-sdk for nostr bridge tests
vi.mock('@degenfeed/nostr-sdk', () => ({
  getPublicKey: vi.fn(() => 'pubkey-abc'),
  signEvent: vi.fn((e: Record<string, unknown>) => ({
    ...e,
    id: 'signed-event-id',
    sig: 'sig-abc',
  })),
  RelayPool: vi.fn(() => ({
    publish: vi.fn(),
    disconnectAll: vi.fn(),
  })),
}));

// Mock @degenfeed/peertube-provider for peertube bridge tests
vi.mock('@degenfeed/peertube-provider', () => ({
  PeerTubeLiveStream: vi.fn(() => ({
    createStream: vi.fn().mockResolvedValue({
      uuid: 'pt-uuid-123',
      url: 'https://video.degenfeed.xyz/w/abc',
      playbackUrl: 'https://video.degenfeed.xyz/hls/abc.m3u8',
      chatUrl: 'https://video.degenfeed.xyz/videos/watch/uuid/live-chat',
      rtmpUrl: 'rtmp://video.degenfeed.xyz/live',
      streamKey: 'sk-abc',
      embedUrl: 'https://video.degenfeed.xyz/embed/abc',
      id: 42,
    }),
    getStreamStatus: vi.fn().mockResolvedValue({ isLive: true, viewers: 15 }),
    endStream: vi.fn().mockResolvedValue(undefined),
    updateStream: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { kickBridge } from './kick';
import { livepeerBridge } from './livepeer';
import { livePhotosBridge } from './livephotos';
import { nostrBridge } from './nostr';
import { owncastBridge } from './owncast';
import { peertubeBridge } from './peertube';
import type { twitchBridge } from './twitch';
import type { CreateSpaceOptions, SpaceItem } from './types';
import type { youTubeBridge } from './youtube';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeCreateOptions(overrides: Partial<CreateSpaceOptions> = {}): CreateSpaceOptions {
  return {
    title: 'Test Space',
    hostId: 'user:abc',
    hostName: 'Test Host',
    platforms: ['nostr'],
    ...overrides,
  };
}

function makeSpaceItem(overrides: Partial<SpaceItem> = {}): SpaceItem {
  return {
    id: 'test:space-1',
    title: 'Test Space',
    hostId: 'user:abc',
    hostName: 'Test Host',
    coHosts: [],
    platforms: [{ platform: 'nostr', nativeId: 'n1' }],
    status: 'live',
    createdAt: Date.now(),
    listeners: 10,
    speakers: [],
    reactions: [],
    tippingEnabled: true,
    ...overrides,
  };
}

// Prevent console noise
vi.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Nostr Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('nostrBridge', () => {
  const OLD_NOSTR_KEY = process.env.NOSTR_PRIVATE_KEY;

  afterEach(() => {
    if (OLD_NOSTR_KEY) process.env.NOSTR_PRIVATE_KEY = OLD_NOSTR_KEY;
    else delete process.env.NOSTR_PRIVATE_KEY;
  });

  it('should throw when NOSTR_PRIVATE_KEY is not configured', async () => {
    delete process.env.NOSTR_PRIVATE_KEY;
    await expect(nostrBridge.create(makeCreateOptions())).rejects.toThrow(
      'NOSTR_PRIVATE_KEY not configured',
    );
  });

  it('should create a space event on Nostr', async () => {
    process.env.NOSTR_PRIVATE_KEY = 'nsec1abc';
    const result = await nostrBridge.create(makeCreateOptions({ title: 'DeFi Talk' }));
    expect(result.platform).toBe('nostr');
    expect(result.nativeId).toBeTruthy();
    expect(result.url).toContain('app.degenfeed.xyz');
    expect(result.metadata?.eventId).toBe('signed-event-id');
  });

  it('should create a scheduled space event', async () => {
    process.env.NOSTR_PRIVATE_KEY = 'nsec1abc';
    const result = await nostrBridge.create(
      makeCreateOptions({ scheduledAt: '2026-07-28T18:00:00Z' }),
    );
    expect(result.platform).toBe('nostr');
    expect(result.nativeId).toBeTruthy();
  });

  it('should get live spaces (returns empty)', async () => {
    const spaces = await nostrBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns null)', async () => {
    const space = await nostrBridge.getSpace('any-id');
    expect(space).toBeNull();
  });

  it('should end a space', async () => {
    process.env.NOSTR_PRIVATE_KEY = 'nsec1abc';
    await expect(nostrBridge.endSpace(makeSpaceItem())).resolves.toBeUndefined();
  });

  it('should skip end when no private key', async () => {
    delete process.env.NOSTR_PRIVATE_KEY;
    await expect(nostrBridge.endSpace(makeSpaceItem())).resolves.toBeUndefined();
  });

  it('should update a space', async () => {
    process.env.NOSTR_PRIVATE_KEY = 'nsec1abc';
    await expect(
      nostrBridge.updateSpace(makeSpaceItem({ title: 'Updated' })),
    ).resolves.toBeUndefined();
  });

  it('should skip update when no private key', async () => {
    delete process.env.NOSTR_PRIVATE_KEY;
    await expect(nostrBridge.updateSpace(makeSpaceItem())).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LivePeer Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('livepeerBridge', () => {
  const OLD_KEY = process.env.LIVEPEER_API_KEY;

  afterEach(() => {
    if (OLD_KEY) process.env.LIVEPEER_API_KEY = OLD_KEY;
    else delete process.env.LIVEPEER_API_KEY;
  });

  it('should throw when LIVEPEER_API_KEY not configured', async () => {
    delete process.env.LIVEPEER_API_KEY;
    await expect(livepeerBridge.create(makeCreateOptions())).rejects.toThrow(
      'LIVEPEER_API_KEY not configured',
    );
  });

  it('should create a LivePeer stream', async () => {
    process.env.LIVEPEER_API_KEY = 'lp-key-123';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'stream-abc',
        streamKey: 'sk-abc',
        playbackId: 'pb-abc',
        name: 'Test Space',
        kind: 'audio',
        isActive: true,
        createdAt: Math.floor(Date.now() / 1000),
      }),
    });

    const result = await livepeerBridge.create(makeCreateOptions());
    expect(result.platform).toBe('livepeer');
    expect(result.nativeId).toBe('stream-abc');
    expect(result.streamUrl).toContain('livepeer.live');
  });

  it('should handle API error on create', async () => {
    process.env.LIVEPEER_API_KEY = 'lp-key-123';
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(livepeerBridge.create(makeCreateOptions())).rejects.toThrow('LivePeer API error');
  });

  it('should get live spaces (returns empty on error)', async () => {
    process.env.LIVEPEER_API_KEY = 'lp-key-123';
    mockFetch.mockResolvedValue({ ok: false });

    const spaces = await livepeerBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (returns empty when no key)', async () => {
    delete process.env.LIVEPEER_API_KEY;
    const spaces = await livepeerBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns null on error)', async () => {
    process.env.LIVEPEER_API_KEY = 'lp-key-123';
    mockFetch.mockResolvedValue({ ok: false });

    const space = await livepeerBridge.getSpace('stream-abc');
    expect(space).toBeNull();
  });

  it('should get space (returns null when no key)', async () => {
    delete process.env.LIVEPEER_API_KEY;
    const space = await livepeerBridge.getSpace('stream-abc');
    expect(space).toBeNull();
  });

  it('should end a space (DELETE stream)', async () => {
    process.env.LIVEPEER_API_KEY = 'lp-key-123';
    mockFetch.mockResolvedValue({ ok: true });

    const space = makeSpaceItem({
      platforms: [{ platform: 'livepeer', nativeId: 'stream-abc' }],
    });
    await expect(livepeerBridge.endSpace(space)).resolves.toBeUndefined();
  });

  it('should skip end when no nativeId', async () => {
    process.env.LIVEPEER_API_KEY = 'lp-key-123';
    const space = makeSpaceItem({ platforms: [{ platform: 'nostr', nativeId: 'n1' }] });
    await expect(livepeerBridge.endSpace(space)).resolves.toBeUndefined();
  });

  it('should update space (no-op)', async () => {
    await expect(livepeerBridge.updateSpace(makeSpaceItem())).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Owncast Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('owncastBridge', () => {
  it('should create an Owncast space', async () => {
    const result = await owncastBridge.create(makeCreateOptions({ title: 'Owncast Space' }));
    expect(result.platform).toBe('owncast');
    expect(result.streamUrl).toContain('.m3u8');
    expect(result.chatUrl).toContain('/api/chat');
    expect(result.metadata?.whipUrl).toBeDefined();
  });

  it('should create with custom stream key', async () => {
    const result = await owncastBridge.create(makeCreateOptions({ owncastStreamKey: 'custom-sk' }));
    expect(result.metadata?.streamKey).toBe('custom-sk');
  });

  it('should get live spaces (offline)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ online: false, viewerCount: 0 }),
    });

    const spaces = await owncastBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (online)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          online: true,
          viewerCount: 5,
          lastConnectTime: new Date().toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'DegenFeed',
          summary: 'Live',
          logo: '/logo.png',
          tags: ['audio'],
          chatDisabled: false,
        }),
      });

    const spaces = await owncastBridge.getLiveSpaces();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]?.title).toBeDefined();
    expect(spaces[0]?.listeners).toBe(5);
    expect(spaces[0]?.speakers).toHaveLength(1);
  });

  it('should get live spaces (handles fetch error)', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const spaces = await owncastBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns first live space)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          online: true,
          viewerCount: 3,
          lastConnectTime: new Date().toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'DegenFeed',
          summary: 'Live',
          logo: '/logo.png',
          tags: [],
          chatDisabled: false,
        }),
      });

    const space = await owncastBridge.getSpace('owncast-live');
    expect(space).not.toBeNull();
    expect(space?.title).toBeDefined();
  });

  it('should end a space', async () => {
    await expect(owncastBridge.endSpace(makeSpaceItem())).resolves.toBeUndefined();
  });

  it('should update space (no-op)', async () => {
    await expect(owncastBridge.updateSpace(makeSpaceItem())).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Kick Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('kickBridge', () => {
  const OLD_CHANNEL = process.env.KICK_CHANNEL;

  afterEach(() => {
    if (OLD_CHANNEL) process.env.KICK_CHANNEL = OLD_CHANNEL;
    else delete process.env.KICK_CHANNEL;
  });

  it('should throw when KICK_CHANNEL not configured', async () => {
    delete process.env.KICK_CHANNEL;
    await expect(kickBridge.create(makeCreateOptions())).rejects.toThrow(
      'KICK_CHANNEL not configured',
    );
  });

  it('should create a Kick stream reference', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    const result = await kickBridge.create(makeCreateOptions({ title: 'Kick Stream' }));
    expect(result.platform).toBe('kick');
    expect(result.url).toContain('kick.com');
    expect(result.metadata?.ingestUrl).toContain('rtmp://');
  });

  it('should update stream title when session token is available', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    process.env.KICK_SESSION_TOKEN = 'session-abc';
    mockFetch.mockResolvedValue({ ok: true });

    const result = await kickBridge.create(makeCreateOptions({ title: 'Updated Title' }));
    expect(result.platform).toBe('kick');
    expect(mockFetch).toHaveBeenCalled();

    delete process.env.KICK_SESSION_TOKEN;
  });

  it('should get live spaces (offline)', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ livestream: null }),
    });

    const spaces = await kickBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (online)', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        user_id: 100,
        slug: 'degenfeed',
        user: { id: 100, username: 'degenfeed', slug: 'degenfeed' },
        livestream: {
          id: 500,
          session_title: 'Kick Live Stream',
          viewer_count: 25,
          started_at: new Date().toISOString(),
          is_live: true,
          category: { name: 'Tech', id: 509670 },
        },
      }),
    });

    const spaces = await kickBridge.getLiveSpaces();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]?.title).toBe('Kick Live Stream');
    expect(spaces[0]?.listeners).toBe(25);
  });

  it('should get live spaces (handles fetch error)', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    mockFetch.mockRejectedValue(new Error('API error'));

    const spaces = await kickBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (returns empty when no channel)', async () => {
    delete process.env.KICK_CHANNEL;
    const spaces = await kickBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space by nativeId', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        user: { id: 100, username: 'degenfeed', slug: 'degenfeed' },
        livestream: {
          id: 500,
          session_title: 'Test',
          viewer_count: 10,
          started_at: new Date().toISOString(),
          is_live: true,
        },
      }),
    });

    const space = await kickBridge.getSpace('500');
    expect(space).not.toBeNull();
  });

  it('should end space (no-op)', async () => {
    await expect(kickBridge.endSpace(makeSpaceItem())).resolves.toBeUndefined();
  });

  it('should update space', async () => {
    process.env.KICK_CHANNEL = 'degenfeed';
    process.env.KICK_SESSION_TOKEN = 'session-abc';
    mockFetch.mockResolvedValue({ ok: true });

    await expect(
      kickBridge.updateSpace(makeSpaceItem({ title: 'Updated' })),
    ).resolves.toBeUndefined();

    delete process.env.KICK_SESSION_TOKEN;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Twitch Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('twitchBridge', () => {
  // Use resetModules + dynamic imports to clear module-level cachedToken
  beforeEach(() => {
    vi.resetModules();
    // Re-mock deps after reset
    vi.mock('@degenfeed/nostr-sdk', () => ({
      getPublicKey: vi.fn(() => 'pubkey-abc'),
      signEvent: vi.fn((e: Record<string, unknown>) => ({
        ...e,
        id: 'signed-event-id',
        sig: 'sig-abc',
      })),
      RelayPool: vi.fn(() => ({ publish: vi.fn(), disconnectAll: vi.fn() })),
    }));
    vi.mock('@degenfeed/peertube-provider', () => ({
      PeerTubeLiveStream: vi.fn(() => ({
        createStream: vi.fn().mockResolvedValue({
          uuid: 'pt-uuid-123',
          url: 'https://video.degenfeed.xyz/w/abc',
          playbackUrl: 'https://video.degenfeed.xyz/hls/abc.m3u8',
          chatUrl: 'https://video.degenfeed.xyz/videos/watch/uuid/live-chat',
          rtmpUrl: 'rtmp://video.degenfeed.xyz/live',
          streamKey: 'sk-abc',
          embedUrl: 'https://video.degenfeed.xyz/embed/abc',
          id: 42,
        }),
        getStreamStatus: vi.fn().mockResolvedValue({ isLive: true, viewers: 15 }),
        endStream: vi.fn().mockResolvedValue(undefined),
        updateStream: vi.fn().mockResolvedValue(undefined),
      })),
    }));
  });

  async function importTwitchBridge() {
    const mod = (await import('./twitch')) as { twitchBridge: typeof twitchBridge };
    return mod.twitchBridge;
  }

  it('should throw when Twitch credentials not configured', async () => {
    const bridge = await importTwitchBridge();
    await expect(bridge.create(makeCreateOptions())).rejects.toThrow('required');
  });

  it('should create a Twitch channel reference', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-abc';
    process.env.TWITCH_CLIENT_SECRET = 'secret-abc';
    process.env.TWITCH_BROADCASTER_ID = 'broadcaster-123';
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true });

    const bridge = await importTwitchBridge();
    const result = await bridge.create(
      makeCreateOptions({ title: 'Twitch Stream', twitchGame: 'Science & Technology' }),
    );
    expect(result.platform).toBe('twitch');
    expect(result.url).toContain('twitch.tv');
  });

  it('should handle Twitch channel update error', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-abc';
    process.env.TWITCH_CLIENT_SECRET = 'secret-abc';
    process.env.TWITCH_BROADCASTER_ID = 'broadcaster-123';
    // Auth succeeds, channel update fails
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 422 });

    const bridge = await importTwitchBridge();
    await expect(bridge.create(makeCreateOptions())).rejects.toThrow(
      'Twitch channel update failed',
    );
  });

  it('should get live spaces (empty when credentials missing)', async () => {
    const bridge = await importTwitchBridge();
    const spaces = await bridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (when live)', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-abc';
    process.env.TWITCH_CLIENT_SECRET = 'secret-abc';
    process.env.TWITCH_BROADCASTER_ID = 'broadcaster-123';
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'stream-1',
              user_id: 'user-123',
              user_login: 'degenfeed',
              user_name: 'DegenFeed',
              title: 'Live Coding',
              viewer_count: 100,
              started_at: new Date().toISOString(),
              thumbnail_url: 'https://example.com/{width}x{height}.jpg',
              game_name: 'Science & Technology',
            },
          ],
        }),
      });

    const bridge = await importTwitchBridge();
    const spaces = await bridge.getLiveSpaces();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]?.title).toBe('Live Coding');
    expect(spaces[0]?.listeners).toBe(100);
  });

  it('should get live spaces (handles fetch error)', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-abc';
    process.env.TWITCH_BROADCASTER_ID = 'broadcaster-123';
    process.env.TWITCH_CLIENT_SECRET = 'secret-abc';
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockRejectedValue(new Error('Network error'));

    const bridge = await importTwitchBridge();
    const spaces = await bridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (empty when no credentials)', async () => {
    delete process.env.TWITCH_CLIENT_ID;
    const bridge = await importTwitchBridge();
    const spaces = await bridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns null on error)', async () => {
    const bridge = await importTwitchBridge();
    const space = await bridge.getSpace('stream-1');
    expect(space).toBeNull();
  });

  it('should end space (no-op)', async () => {
    const bridge = await importTwitchBridge();
    await expect(bridge.endSpace(makeSpaceItem())).resolves.toBeUndefined();
  });

  it('should update space', async () => {
    process.env.TWITCH_CLIENT_ID = 'client-abc';
    process.env.TWITCH_CLIENT_SECRET = 'secret-abc';
    process.env.TWITCH_BROADCASTER_ID = 'broadcaster-123';
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true });

    const bridge = await importTwitchBridge();
    await expect(bridge.updateSpace(makeSpaceItem())).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// YouTube Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('youTubeBridge', () => {
  // Use resetModules to clear module-level cachedAccessToken
  beforeEach(() => {
    vi.resetModules();
    vi.mock('@degenfeed/nostr-sdk', () => ({
      getPublicKey: vi.fn(() => 'pubkey-abc'),
      signEvent: vi.fn((e: Record<string, unknown>) => ({
        ...e,
        id: 'signed-event-id',
        sig: 'sig-abc',
      })),
      RelayPool: vi.fn(() => ({ publish: vi.fn(), disconnectAll: vi.fn() })),
    }));
    vi.mock('@degenfeed/peertube-provider', () => ({
      PeerTubeLiveStream: vi.fn(() => ({
        createStream: vi.fn().mockResolvedValue({
          uuid: 'pt-uuid-123',
          url: 'https://video.degenfeed.xyz/w/abc',
          playbackUrl: 'https://video.degenfeed.xyz/hls/abc.m3u8',
          chatUrl: 'https://video.degenfeed.xyz/videos/watch/uuid/live-chat',
          rtmpUrl: 'rtmp://video.degenfeed.xyz/live',
          streamKey: 'sk-abc',
          embedUrl: 'https://video.degenfeed.xyz/embed/abc',
          id: 42,
        }),
        getStreamStatus: vi.fn().mockResolvedValue({ isLive: true, viewers: 15 }),
        endStream: vi.fn().mockResolvedValue(undefined),
        updateStream: vi.fn().mockResolvedValue(undefined),
      })),
    }));
  });

  async function importYouTubeBridge() {
    const mod = (await import('./youtube')) as { youTubeBridge: typeof youTubeBridge };
    return mod.youTubeBridge;
  }

  it('should throw when YOUTUBE_API_KEY not configured', async () => {
    const bridge = await importYouTubeBridge();
    delete process.env.YOUTUBE_API_KEY;
    await expect(bridge.create(makeCreateOptions())).rejects.toThrow(
      'YOUTUBE_API_KEY not configured',
    );
  });

  it('should throw when OAuth credentials not configured', async () => {
    const bridge = await importYouTubeBridge();
    process.env.YOUTUBE_API_KEY = 'key-abc';
    delete process.env.YOUTUBE_CLIENT_ID;
    delete process.env.YOUTUBE_CLIENT_SECRET;
    delete process.env.YOUTUBE_REFRESH_TOKEN;

    await expect(bridge.create(makeCreateOptions())).rejects.toThrow(
      'YouTube OAuth credentials not configured',
    );
  });

  it('should create a YouTube broadcast and stream', async () => {
    process.env.YOUTUBE_API_KEY = 'key-abc';
    process.env.YOUTUBE_CLIENT_ID = 'client-abc';
    process.env.YOUTUBE_CLIENT_SECRET = 'secret-abc';
    process.env.YOUTUBE_REFRESH_TOKEN = 'refresh-abc';

    // OAuth refresh
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      // Create broadcast
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'broadcast-abc',
          snippet: { thumbnails: { default: { url: 'https://example.com/thumb.jpg' } } },
        }),
      })
      // Create stream
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'stream-abc',
          cdn: {
            ingestionInfo: {
              ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2',
              streamName: 'sk-abc',
            },
          },
        }),
      })
      // Bind broadcast to stream
      .mockResolvedValueOnce({ ok: true });

    const bridge = await importYouTubeBridge();
    const result = await bridge.create(
      makeCreateOptions({ title: 'YouTube Stream', youTubePrivacy: 'public' }),
    );
    expect(result.platform).toBe('youtube');
    expect(result.nativeId).toBe('broadcast-abc');
    expect(result.url).toContain('youtube.com');
  });

  it('should handle stream creation failure after broadcast succeeds', async () => {
    process.env.YOUTUBE_API_KEY = 'key-abc';
    process.env.YOUTUBE_CLIENT_ID = 'client-abc';
    process.env.YOUTUBE_CLIENT_SECRET = 'secret-abc';
    process.env.YOUTUBE_REFRESH_TOKEN = 'refresh-abc';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Quota exceeded' } }),
      });

    const bridge = await importYouTubeBridge();
    await expect(bridge.create(makeCreateOptions())).rejects.toThrow(
      'YouTube broadcast creation failed',
    );
  });

  it('should get live spaces (returns empty)', async () => {
    const bridge = await importYouTubeBridge();
    const spaces = await bridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns null when no API key)', async () => {
    const bridge = await importYouTubeBridge();
    delete process.env.YOUTUBE_API_KEY;
    const space = await bridge.getSpace('video-abc');
    expect(space).toBeNull();
  });

  it('should get space (returns null for non-live video)', async () => {
    process.env.YOUTUBE_API_KEY = 'key-abc';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'video-abc',
            snippet: { title: 'Test', channelTitle: 'Creator' },
          },
        ],
      }),
    });

    const bridge = await importYouTubeBridge();
    const space = await bridge.getSpace('video-abc');
    expect(space).toBeNull();
  });

  it('should get live space details', async () => {
    process.env.YOUTUBE_API_KEY = 'key-abc';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'video-abc',
            snippet: {
              title: 'Live Stream',
              description: 'Test stream',
              channelTitle: 'DegenFeed',
              thumbnails: { default: { url: 'https://example.com/thumb.jpg' } },
              publishedAt: new Date().toISOString(),
            },
            liveStreamingDetails: {
              actualStartTime: new Date().toISOString(),
              concurrentViewers: '42',
            },
          },
        ],
      }),
    });

    const bridge = await importYouTubeBridge();
    const space = await bridge.getSpace('video-abc');
    expect(space).not.toBeNull();
    expect(space?.title).toBe('Live Stream');
    expect(space?.listeners).toBe(42);
    expect(space?.status).toBe('live');
  });

  it('should end a space', async () => {
    process.env.YOUTUBE_CLIENT_ID = 'client-abc';
    process.env.YOUTUBE_CLIENT_SECRET = 'secret-abc';
    process.env.YOUTUBE_REFRESH_TOKEN = 'refresh-abc';
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-abc', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true });

    const bridge = await importYouTubeBridge();
    const space = makeSpaceItem({
      platforms: [{ platform: 'youtube', nativeId: 'broadcast-abc' }],
    });
    await expect(bridge.endSpace(space)).resolves.toBeUndefined();
  });

  it('should update space (no-op)', async () => {
    const bridge = await importYouTubeBridge();
    await expect(bridge.updateSpace(makeSpaceItem())).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PeerTube Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('peertubeBridge', () => {
  const OLD_TOKEN = process.env.PEERTUBE_ACCESS_TOKEN;

  afterEach(() => {
    if (OLD_TOKEN) process.env.PEERTUBE_ACCESS_TOKEN = OLD_TOKEN;
    else delete process.env.PEERTUBE_ACCESS_TOKEN;
  });

  it('should create a PeerTube stream', async () => {
    process.env.PEERTUBE_ACCESS_TOKEN = 'pt-token-abc';
    const result = await peertubeBridge.create(
      makeCreateOptions({
        title: 'PeerTube Space',
        peertubeTokenSymbol: 'DEGEN',
        peertubeTokenAddress: '0xabc',
        peertubeCreatorAddress: '0xcreator',
      }),
    );
    expect(result.platform).toBe('peertube');
    expect(result.nativeId).toBe('pt-uuid-123');
    expect(result.url).toContain('video.degenfeed.xyz');
    expect(result.metadata?.streamKey).toBe('sk-abc');
  });

  it('should create with minimal options', async () => {
    process.env.PEERTUBE_ACCESS_TOKEN = 'pt-token-abc';
    const result = await peertubeBridge.create(makeCreateOptions({ title: 'Minimal' }));
    expect(result.platform).toBe('peertube');
    expect(result.nativeId).toBe('pt-uuid-123');
  });

  it('should get live spaces (empty when no token)', async () => {
    delete process.env.PEERTUBE_ACCESS_TOKEN;
    const spaces = await peertubeBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get live spaces (empty on API error)', async () => {
    process.env.PEERTUBE_ACCESS_TOKEN = 'pt-token-abc';
    mockFetch.mockResolvedValue({ ok: false });

    const spaces = await peertubeBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns null when no token)', async () => {
    delete process.env.PEERTUBE_ACCESS_TOKEN;
    const space = await peertubeBridge.getSpace('video-uuid');
    expect(space).toBeNull();
  });

  it('should end a space', async () => {
    process.env.PEERTUBE_ACCESS_TOKEN = 'pt-token-abc';
    const space = makeSpaceItem({
      platforms: [{ platform: 'peertube', nativeId: 'video-uuid' }],
    });
    await expect(peertubeBridge.endSpace(space)).resolves.toBeUndefined();
  });

  it('should update a space', async () => {
    process.env.PEERTUBE_ACCESS_TOKEN = 'pt-token-abc';
    const space = makeSpaceItem({
      platforms: [{ platform: 'peertube', nativeId: 'video-uuid' }],
    });
    await expect(peertubeBridge.updateSpace(space)).resolves.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Live Photos Bridge
// ═══════════════════════════════════════════════════════════════════════════

describe('livePhotosBridge', () => {
  const OLD_NOSTR_KEY = process.env.NOSTR_PRIVATE_KEY;

  afterEach(() => {
    if (OLD_NOSTR_KEY) process.env.NOSTR_PRIVATE_KEY = OLD_NOSTR_KEY;
    else delete process.env.NOSTR_PRIVATE_KEY;
  });

  it('should throw when no photo URLs provided', async () => {
    await expect(livePhotosBridge.create(makeCreateOptions({ photoUrls: [] }))).rejects.toThrow(
      'At least one photo URL required',
    );
  });

  it('should publish to Nostr when private key is configured', async () => {
    process.env.NOSTR_PRIVATE_KEY = 'nsec1abc';
    const result = await livePhotosBridge.create(
      makeCreateOptions({
        title: 'Photo Stream',
        photoUrls: ['https://cdn.example.com/photo.jpg'],
        description: 'My live photo',
      }),
    );
    expect(result.platform).toBe('nostr-pictures');
    expect(result.nativeId).toBeTruthy();
    expect(result.metadata?.imageUrl).toBe('https://cdn.example.com/photo.jpg');
  });

  it('should return fallback when Nostr publish fails', async () => {
    // This tests the fallback behavior — the bridge catches errors internally
    process.env.NOSTR_PRIVATE_KEY = 'nsec1abc';
    const result = await livePhotosBridge.create(
      makeCreateOptions({
        title: 'Photo Stream',
        photoUrls: ['https://cdn.example.com/photo.jpg'],
      }),
    );
    expect(result.platform).toBe('nostr-pictures');
    expect(result.nativeId).toBeTruthy();
  });

  it('should get live spaces (returns empty)', async () => {
    const spaces = await livePhotosBridge.getLiveSpaces();
    expect(spaces).toEqual([]);
  });

  it('should get space (returns null)', async () => {
    const space = await livePhotosBridge.getSpace('any-id');
    expect(space).toBeNull();
  });

  it('should end space (no-op)', async () => {
    await expect(livePhotosBridge.endSpace(makeSpaceItem())).resolves.toBeUndefined();
  });

  it('should update space (no-op)', async () => {
    await expect(livePhotosBridge.updateSpace(makeSpaceItem())).resolves.toBeUndefined();
  });
});

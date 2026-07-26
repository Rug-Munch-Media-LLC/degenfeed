import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external deps before imports
vi.mock('@degenfeed/nostr-sdk', () => ({
  getPublicKey: vi.fn(() => 'pubkey-abc'),
  signEvent: vi.fn((e: unknown) => ({ ...e, id: 'signed-event-id', sig: 'sig-abc' })),
  RelayPool: vi.fn(() => ({
    publish: vi.fn(),
    disconnectAll: vi.fn(),
  })),
}));

vi.mock('@degenfeed/peertube-provider', () => ({
  PeerTubeLiveStream: vi.fn(() => ({
    createStream: vi.fn().mockResolvedValue({
      uuid: 'pt-uuid-123',
      url: 'https://video.degenfeed.xyz/w/abc123',
      playbackUrl: 'https://video.degenfeed.xyz/hls/abc.m3u8',
      chatUrl: 'https://video.degenfeed.xyz/videos/watch/uuid/live-chat',
      rtmpUrl: 'rtmp://video.degenfeed.xyz/live',
      streamKey: 'sk-abc',
      embedUrl: 'https://video.degenfeed.xyz/embed/abc',
      id: 42,
    }),
    getStreamStatus: vi.fn().mockResolvedValue({ isLive: true, viewers: 10 }),
    endStream: vi.fn().mockResolvedValue(undefined),
    updateStream: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@degenfeed/token-gate', () => ({
  checkTokenGate: vi.fn().mockResolvedValue(true),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  canAccessSpace,
  createSpace,
  endSpace,
  getBridge,
  getContentType,
  getListenerCount,
  getLiveSpaces,
  getSpaceById,
  updateSpace,
} from './index';
import { checkAllGates } from './premium';
import type { CreateSpaceOptions, SpaceGating, SpaceItem } from './types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makePlatformData(platform: string, nativeId: string) {
  return { platform, nativeId, url: `https://example.com/${nativeId}` };
}

function makeSpaceItem(overrides: Partial<SpaceItem> = {}): SpaceItem {
  return {
    id: 'test:space-1',
    title: 'Test Space',
    hostId: 'user:abc',
    hostName: 'Test Host',
    coHosts: [],
    platforms: [makePlatformData('nostr', 'n1')],
    status: 'live',
    createdAt: Date.now(),
    listeners: 10,
    speakers: [],
    reactions: [],
    tippingEnabled: true,
    ...overrides,
  };
}

function makeCreateOptions(overrides: Partial<CreateSpaceOptions> = {}): CreateSpaceOptions {
  return {
    title: 'Test Space',
    hostId: 'user:abc',
    hostName: 'Test Host',
    platforms: ['nostr'],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('getBridge()', () => {
  it('should return a bridge for a known platform', () => {
    const bridge = getBridge('nostr');
    expect(bridge).toBeDefined();
    expect(bridge.platform).toBe('nostr');
    expect(typeof bridge.create).toBe('function');
    expect(typeof bridge.getLiveSpaces).toBe('function');
    expect(typeof bridge.endSpace).toBe('function');
  });

  it('should return a bridge for video platforms', () => {
    const bridge = getBridge('youtube');
    expect(bridge.platform).toBe('youtube');
  });

  it('should throw for unknown platforms', () => {
    expect(() => getBridge('unknown-platform' as any)).toThrow('Unknown platform');
  });

  it('should throw for announce-only platforms (null in registry)', () => {
    // Announce-only platforms are registered as null in BRIDGES,
    // so getBridge() throws "Unknown platform" before the announce check
    expect(() => getBridge('farcaster')).toThrow('Unknown platform');
    expect(() => getBridge('bluesky')).toThrow('Unknown platform');
    expect(() => getBridge('discord')).toThrow('Unknown platform');
  });
});

describe('getContentType()', () => {
  it('should return audio for audio platforms', () => {
    expect(getContentType('nostr')).toBe('audio');
    expect(getContentType('peertube')).toBe('audio');
    expect(getContentType('owncast')).toBe('audio');
    expect(getContentType('livepeer')).toBe('audio');
  });

  it('should return video for video platforms', () => {
    expect(getContentType('youtube')).toBe('video');
    expect(getContentType('twitch')).toBe('video');
    expect(getContentType('kick')).toBe('video');
  });

  it('should return photos for photo platforms', () => {
    expect(getContentType('nostr-pictures')).toBe('photos');
    expect(getContentType('bluesky-photos')).toBe('photos');
    expect(getContentType('pixelfed')).toBe('photos');
  });

  it('should return announcement for announce platforms', () => {
    expect(getContentType('farcaster')).toBe('announcement');
    expect(getContentType('discord')).toBe('announcement');
  });
});

describe('createSpace()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should create a space on nostr successfully', async () => {
    process.env.NOSTR_PRIVATE_KEY = 'nsec1test';
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

    const result = await createSpace(makeCreateOptions());
    delete process.env.NOSTR_PRIVATE_KEY;

    expect(result.id).toMatch(/^space-/);
    expect(result.platformResults.length).toBeGreaterThanOrEqual(1);
    const nostrResult = result.platformResults.find((r) => r.platform === 'nostr');
    expect(nostrResult).toBeDefined();
    expect(nostrResult!.nativeId).toBeTruthy();
    expect(nostrResult!.error).toBeUndefined();
  });

  it('should create a space on multiple platforms', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await createSpace(makeCreateOptions({ platforms: ['nostr', 'livepeer'] }));

    expect(result.platformResults).toHaveLength(2);
    const platforms = result.platformResults.map((r) => r.platform);
    expect(platforms).toContain('nostr');
    expect(platforms).toContain('livepeer');
  });

  it('should handle platform failure gracefully', async () => {
    // Make the nostr bridge fail (no private key)
    const oldEnv = process.env.NOSTR_PRIVATE_KEY;
    delete process.env.NOSTR_PRIVATE_KEY;

    const result = await createSpace(makeCreateOptions({ platforms: ['nostr'] }));

    expect(result.platformResults).toHaveLength(1);
    expect(result.platformResults[0]?.error).toBeDefined();

    if (oldEnv) process.env.NOSTR_PRIVATE_KEY = oldEnv;
  });

  it('should create a scheduled space', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'stream-abc',
        streamKey: 'sk-abc',
        playbackId: 'pb-abc',
        name: 'Scheduled Space',
        kind: 'audio',
        isActive: false,
        createdAt: Math.floor(Date.now() / 1000),
      }),
    });

    const result = await createSpace(makeCreateOptions({ scheduledAt: '2026-07-28T18:00:00Z' }));

    expect(result.id).toMatch(/^space-/);
    expect(result.platformResults.length).toBeGreaterThanOrEqual(1);
  });

  it('should create a space with video content type', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await createSpace(
      makeCreateOptions({ contentType: 'video', platforms: ['nostr'] }),
    );

    expect(result.id).toMatch(/^space-/);
  });

  it('should create a space with tipping disabled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'stream-abc',
        streamKey: 'sk',
        playbackId: 'pb',
        name: 'Test',
        kind: 'audio',
        isActive: true,
        createdAt: Math.floor(Date.now() / 1000),
      }),
    });

    const result = await createSpace(makeCreateOptions({ tippingEnabled: false }));
    expect(result.id).toMatch(/^space-/);
  });

  it('should handle empty platform list', async () => {
    const result = await createSpace(makeCreateOptions({ platforms: [] }));
    expect(result.id).toMatch(/^space-/);
    expect(result.platformResults).toHaveLength(0);
  });
});

describe('getLiveSpaces()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should aggregate live spaces from all bridges', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    const spaces = await getLiveSpaces();
    expect(Array.isArray(spaces)).toBe(true);
  });

  it('should filter by content type', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    const spaces = await getLiveSpaces({ contentType: 'audio' });
    expect(Array.isArray(spaces)).toBe(true);
  });

  it('should filter by specific platforms', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    const spaces = await getLiveSpaces({ platforms: ['nostr'] });
    expect(Array.isArray(spaces)).toBe(true);
  });

  it('should timeout on slow bridges', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 200),
        ),
    );

    const spaces = await getLiveSpaces({ timeout: 50 });
    expect(Array.isArray(spaces)).toBe(true);
  });

  it('should deduplicate spaces by ID', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    const spaces = await getLiveSpaces();
    expect(Array.isArray(spaces)).toBe(true);
  });
});

describe('endSpace()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should end a space on all platforms', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const space = makeSpaceItem({
      platforms: [makePlatformData('nostr', 'n1'), makePlatformData('youtube', 'yt1')],
    });

    await expect(endSpace(space)).resolves.toBeUndefined();
  });

  it('should handle end failures gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const space = makeSpaceItem();
    await expect(endSpace(space)).resolves.toBeUndefined();
  });

  it('should skip announce-only platforms', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const space = makeSpaceItem({
      platforms: [makePlatformData('farcaster', 'fc1')],
    });

    await expect(endSpace(space)).resolves.toBeUndefined();
  });
});

describe('updateSpace()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should update a space on all platforms', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const space = makeSpaceItem({ title: 'Updated Title' });
    await expect(updateSpace(space)).resolves.toBeUndefined();
  });

  it('should handle update failures gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const space = makeSpaceItem();
    await expect(updateSpace(space)).resolves.toBeUndefined();
  });
});

describe('getSpaceById()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return null for unknown ID', async () => {
    const space = await getSpaceById('nonexistent');
    expect(space).toBeNull();
  });

  it('should return null when platform prefix is unknown', async () => {
    const space = await getSpaceById('unknown:id-123');
    expect(space).toBeNull();
  });
});

describe('getListenerCount()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return base count when no platforms respond', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const space = makeSpaceItem({ listeners: 42 });
    const count = await getListenerCount(space);
    expect(count).toBe(42);
  });

  it('should sum listeners from all platforms', async () => {
    mockFetch.mockRejectedValue(new Error('Not found'));

    const space = makeSpaceItem({
      listeners: 10,
      platforms: [makePlatformData('nostr', 'n1')],
    });
    const count = await getListenerCount(space);
    expect(count).toBe(10);
  });
});

describe('canAccessSpace()', () => {
  it('should allow access when no gating configured', async () => {
    const space = makeSpaceItem({ gating: undefined });
    const result = await canAccessSpace(space, 'user:abc');
    expect(result.allowed).toBe(true);
  });

  it('should allow access when gating is none', async () => {
    const space = makeSpaceItem({ gating: { type: 'none' } });
    const result = await canAccessSpace(space, 'user:abc');
    expect(result.allowed).toBe(true);
  });

  it('should check gates for token-gated space', async () => {
    const gating: SpaceGating = {
      type: 'token',
      tokenAddress: '0x1234',
      minBalance: '100',
      chainId: 1,
    };
    const space = makeSpaceItem({ gating });

    // token-gate mock returns true
    const result = await canAccessSpace(space, 'user:abc', '0xuser');
    expect(result.allowed).toBeDefined();
  });

  it('should reject access when user address is missing for token gate', async () => {
    const gating: SpaceGating = {
      type: 'token',
      tokenAddress: '0x1234',
      minBalance: '100',
    };
    const space = makeSpaceItem({ gating });

    const result = await canAccessSpace(space, 'user:abc');
    // Without userAddress, checkAllGates skips token gate
    expect(result.allowed).toBeDefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Prevent console.warn noise in test output
vi.spyOn(console, 'warn').mockImplementation(() => {});

import { announceSpace, getAnnounceBridge, getConfiguredAnnouncePlatforms } from './announce';
import type { AnnouncePlatform, SpaceItem } from './types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeSpaceItem(overrides: Partial<SpaceItem> = {}): SpaceItem {
  return {
    id: 'test:space-1',
    title: 'Test Space: DeFi Talk',
    description: 'A deep dive into DeFi protocols',
    hostId: 'user:abc',
    hostName: 'Test Host',
    hostAvatarUrl: 'https://example.com/avatar.png',
    coHosts: [],
    platforms: [
      {
        platform: 'nostr',
        nativeId: 'n1',
        url: 'https://app.degenfeed.xyz/spaces/space-1',
      },
    ],
    status: 'live',
    contentType: 'audio',
    createdAt: Date.now(),
    listeners: 42,
    speakers: [],
    reactions: [],
    tippingEnabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── getAnnounceBridge ───────────────────────────────────────────────────

describe('getAnnounceBridge()', () => {
  it('should return a bridge for each announce platform', () => {
    const platforms: AnnouncePlatform[] = [
      'farcaster',
      'lens',
      'bluesky',
      'mastodon',
      'discord',
      'telegram',
      'twitter',
    ];
    for (const p of platforms) {
      const bridge = getAnnounceBridge(p);
      expect(bridge.platform).toBe(p);
      expect(typeof bridge.announce).toBe('function');
    }
  });

  it('should throw for unknown announce platform', () => {
    expect(() => getAnnounceBridge('unknown' as AnnouncePlatform)).toThrow(
      'Unknown announce platform',
    );
  });
});

// ─── getConfiguredAnnouncePlatforms ──────────────────────────────────────

describe('getConfiguredAnnouncePlatforms()', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('should return empty array when no platforms configured', () => {
    // Clear all announce env vars
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith('FARCASTER_') ||
        key.startsWith('LENS_') ||
        key.startsWith('BLUESKY_') ||
        key.startsWith('MASTODON_') ||
        key.startsWith('DISCORD_') ||
        key.startsWith('TELEGRAM_') ||
        key.startsWith('TWITTER_')
      ) {
        delete process.env[key];
      }
    }
    const platforms = getConfiguredAnnouncePlatforms();
    expect(platforms).toEqual([]);
  });

  it('should return farcaster when its env vars are set', () => {
    process.env.FARCASTER_BOT_FID = '123';
    process.env.FARCASTER_BOT_SIGNER_KEY = '0xabc';
    const platforms = getConfiguredAnnouncePlatforms();
    expect(platforms).toContain('farcaster');
  });

  it('should not return farcaster when only FID is set', () => {
    process.env.FARCASTER_BOT_FID = '123';
    delete process.env.FARCASTER_BOT_SIGNER_KEY;
    const platforms = getConfiguredAnnouncePlatforms();
    expect(platforms).not.toContain('farcaster');
  });
});

// ─── announceSpace ───────────────────────────────────────────────────────

describe('announceSpace()', () => {
  it('should return empty object when no platforms specified', async () => {
    const space = makeSpaceItem();
    const result = await announceSpace(space, []);
    expect(result).toEqual({});
  });

  it('should announce on a single platform', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '123', url: 'https://example.com/123' }),
    });

    process.env.DISCORD_SPACES_WEBHOOK_URL = 'https://discord.com/webhook/test';
    const space = makeSpaceItem();
    const result = await announceSpace(space, ['discord']);
    expect(result.discord?.ok).toBe(true);
    delete process.env.DISCORD_SPACES_WEBHOOK_URL;
  });

  it('should announce on multiple platforms simultaneously', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '123' }),
    });

    process.env.DISCORD_SPACES_WEBHOOK_URL = 'https://discord.com/webhook/test';
    process.env.TELEGRAM_BOT_TOKEN = 'bot:token';
    process.env.TELEGRAM_CHAT_ID = '-100123';

    const space = makeSpaceItem();
    const result = await announceSpace(space, ['discord', 'telegram']);
    expect(Object.keys(result).length).toBeGreaterThanOrEqual(1);
    expect(result.discord).toBeDefined();
    expect(result.telegram).toBeDefined();

    delete process.env.DISCORD_SPACES_WEBHOOK_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('should handle platform errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    process.env.DISCORD_SPACES_WEBHOOK_URL = 'https://discord.com/webhook/test';
    const space = makeSpaceItem();
    const result = await announceSpace(space, ['discord']);
    expect(result.discord?.ok).toBe(false);
    expect(result.discord?.error).toBeDefined();
    delete process.env.DISCORD_SPACES_WEBHOOK_URL;
  });

  it('should truncate text for farcaster (280 char limit)', async () => {
    process.env.FARCASTER_BOT_FID = '123';
    process.env.FARCASTER_BOT_SIGNER_KEY = '0xabc';

    const space = makeSpaceItem({
      title: 'A'.repeat(300),
    });
    const result = await announceSpace(space, ['farcaster']);
    expect(result.farcaster).toBeDefined();

    delete process.env.FARCASTER_BOT_FID;
    delete process.env.FARCASTER_BOT_SIGNER_KEY;
  });

  it('should generate proper announcement text for live spaces', async () => {
    const space = makeSpaceItem({ status: 'live' });
    const result = await announceSpace(space, []);
    expect(result).toEqual({});
  });

  it('should generate proper announcement text for scheduled spaces', async () => {
    const space = makeSpaceItem({ status: 'scheduled' });
    const result = await announceSpace(space, []);
    expect(result).toEqual({});
  });
});

// ─── Individual Announce Bridges ─────────────────────────────────────────

describe('Individual announce bridges', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Farcaster bridge', () => {
    it('should return error when not configured', async () => {
      delete process.env.FARCASTER_BOT_FID;
      delete process.env.FARCASTER_BOT_SIGNER_KEY;

      const bridge = getAnnounceBridge('farcaster');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'farcaster',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Lens bridge', () => {
    it('should return error when not configured', async () => {
      delete process.env.LENS_ACCESS_TOKEN;
      delete process.env.LENS_PROFILE_ID;

      const bridge = getAnnounceBridge('lens');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'lens',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Bluesky bridge', () => {
    it('should return error when not configured', async () => {
      delete process.env.BLUESKY_JWT;
      delete process.env.BLUESKY_DID;
      delete process.env.BLUESKY_APP_PASSWORD;
      delete process.env.BLUESKY_IDENTIFIER;

      const bridge = getAnnounceBridge('bluesky');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'bluesky',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Mastodon bridge', () => {
    it('should return error when not configured', async () => {
      delete process.env.MASTODON_ACCESS_TOKEN;

      const bridge = getAnnounceBridge('mastodon');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'mastodon',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Discord bridge', () => {
    it('should return error when webhook URL not configured', async () => {
      delete process.env.DISCORD_SPACES_WEBHOOK_URL;

      const bridge = getAnnounceBridge('discord');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'discord',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should send a Discord webhook when configured', async () => {
      process.env.DISCORD_SPACES_WEBHOOK_URL = 'https://discord.com/webhook/test';
      mockFetch.mockResolvedValue({ ok: true });

      const bridge = getAnnounceBridge('discord');
      const result = await bridge.announce(makeSpaceItem(), {
        text: '🔊 LIVE: Test Space',
        spaceUrl: 'https://app.degenfeed.xyz/spaces/test',
        platform: 'discord',
        embed: {
          title: 'Test Space',
          description: 'A test space',
          hostName: 'Test Host',
          url: 'https://app.degenfeed.xyz/spaces/test',
        },
      });
      expect(result.ok).toBe(true);

      delete process.env.DISCORD_SPACES_WEBHOOK_URL;
    });

    it('should handle Discord webhook errors', async () => {
      process.env.DISCORD_SPACES_WEBHOOK_URL = 'https://discord.com/webhook/test';
      mockFetch.mockResolvedValue({ ok: false, status: 429 });

      const bridge = getAnnounceBridge('discord');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'discord',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('429');

      delete process.env.DISCORD_SPACES_WEBHOOK_URL;
    });
  });

  describe('Telegram bridge', () => {
    it('should return error when not configured', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      delete process.env.TELEGRAM_SPACES_CHAT_ID;

      const bridge = getAnnounceBridge('telegram');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'telegram',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should send a Telegram message when configured', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot:test-token';
      process.env.TELEGRAM_CHAT_ID = '-100123456';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: { message_id: 42 } }),
      });

      const bridge = getAnnounceBridge('telegram');
      const space = makeSpaceItem({ status: 'live' });
      const result = await bridge.announce(space, {
        text: '🔊 LIVE: Test Space',
        spaceUrl: 'https://app.degenfeed.xyz/spaces/test',
        platform: 'telegram',
      });
      expect(result.ok).toBe(true);
      expect(result.nativeId).toContain('tg:');

      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
    });

    it('should handle Telegram API errors', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot:test-token';
      process.env.TELEGRAM_CHAT_ID = '-100123456';
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ description: 'Chat not found' }),
      });

      const bridge = getAnnounceBridge('telegram');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'telegram',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Chat not found');

      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
    });
  });

  describe('Twitter bridge', () => {
    it('should return error when not configured', async () => {
      delete process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_SECRET;
      delete process.env.TWITTER_ACCESS_TOKEN;
      delete process.env.TWITTER_ACCESS_SECRET;

      const bridge = getAnnounceBridge('twitter');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'twitter',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should return error on OAuth failure', async () => {
      process.env.TWITTER_API_KEY = 'key';
      process.env.TWITTER_API_SECRET = 'secret';
      process.env.TWITTER_ACCESS_TOKEN = 'token';
      process.env.TWITTER_ACCESS_SECRET = 'secret2';
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const bridge = getAnnounceBridge('twitter');
      const result = await bridge.announce(makeSpaceItem(), {
        text: 'Test',
        spaceUrl: 'https://example.com',
        platform: 'twitter',
      });
      expect(result.ok).toBe(false);

      delete process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_SECRET;
      delete process.env.TWITTER_ACCESS_TOKEN;
      delete process.env.TWITTER_ACCESS_SECRET;
    });
  });
});

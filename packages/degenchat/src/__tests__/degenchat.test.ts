/**
 * @degenfeed/degenchat — Test suite
 *
 * Covers: channels, Redis hub relay, protocol adapters, identity resolution,
 * relay fan-out.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEGENCHAT_CHANNEL_LIST, DEGENCHAT_CHANNELS } from '../channels';

// ─── Channels ──────────────────────────────────────────────────────────

describe('DEGENCHAT_CHANNELS', () => {
  it('defines all expected channels', () => {
    expect(DEGENCHAT_CHANNELS.DM_SENT).toBe('degenchat:dm:sent');
    expect(DEGENCHAT_CHANNELS.DM_RECEIVED).toBe('degenchat:dm:received');
    expect(DEGENCHAT_CHANNELS.GROUP_SENT).toBe('degenchat:group:sent');
    expect(DEGENCHAT_CHANNELS.GROUP_RECEIVED).toBe('degenchat:group:received');
    expect(DEGENCHAT_CHANNELS.READ_RECEIPT).toBe('degenchat:read:receipt');
    expect(DEGENCHAT_CHANNELS.TYPING).toBe('degenchat:typing');
    expect(DEGENCHAT_CHANNELS.PRESENCE).toBe('degenchat:presence');
    expect(DEGENCHAT_CHANNELS.BRIDGE_STATUS).toBe('degenchat:bridge:status');
    expect(DEGENCHAT_CHANNELS.IDENTITY_UPDATE).toBe('degenchat:identity:update');
  });

  it('has exactly 9 channels', () => {
    expect(DEGENCHAT_CHANNEL_LIST).toHaveLength(9);
  });

  it('all channel names are non-empty strings', () => {
    for (const channel of DEGENCHAT_CHANNEL_LIST) {
      expect(channel).toBeTruthy();
      expect(typeof channel).toBe('string');
    }
  });
});

// ─── Redis Hub ─────────────────────────────────────────────────────────

describe('RedisHub', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('publishes and delivers to subscribers in memory mode', async () => {
    const { RedisHub, resetRedisHub } = await import('../redis-hub');
    resetRedisHub();
    const hub = new RedisHub();
    await hub.start();

    const handler = vi.fn();
    hub.subscribe(DEGENCHAT_CHANNELS.DM_SENT, handler);

    await hub.publish(DEGENCHAT_CHANNELS.DM_SENT, { messageId: 'm1', body: 'gm' }, 'nostr');

    await new Promise((r) => setTimeout(r, 10));
    expect(handler).toHaveBeenCalledTimes(1);
    const [channel, envelope] = handler.mock.calls[0] as [
      string,
      { payload: { messageId: string }; sourceProtocol: string },
    ];
    expect(channel).toBe('degenchat:dm:sent');
    expect(envelope.payload.messageId).toBe('m1');
    expect(envelope.sourceProtocol).toBe('nostr');
    await hub.stop();
  });

  it('does not deliver after unsubscribing', async () => {
    const { RedisHub } = await import('../redis-hub');
    const hub = new RedisHub();
    await hub.start();
    const handler = vi.fn();
    const unsub = hub.subscribe(DEGENCHAT_CHANNELS.TYPING, handler);
    unsub();
    await hub.publish(DEGENCHAT_CHANNELS.TYPING, { userId: 'u1', isTyping: true }, 'matrix');
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).not.toHaveBeenCalled();
    await hub.stop();
  });

  it('uses a real redis-like client when provided', async () => {
    const { RedisHub } = await import('../redis-hub');
    const redis = {
      publish: vi.fn(async () => 1),
      subscribe: vi.fn(async () => undefined),
      unsubscribe: vi.fn(async () => undefined),
      on: vi.fn(() => redis),
      quit: vi.fn(async () => undefined),
    };
    const hub = new RedisHub({ redis });
    await hub.start();
    expect(redis.subscribe).toHaveBeenCalledWith(...DEGENCHAT_CHANNEL_LIST);

    const handler = vi.fn();
    hub.subscribe(DEGENCHAT_CHANNELS.DM_SENT, handler);
    await hub.publish(DEGENCHAT_CHANNELS.DM_SENT, { body: 'x' }, 'farcaster');
    expect(redis.publish).toHaveBeenCalledWith(
      'degenchat:dm:sent',
      expect.stringContaining('farcaster'),
    );
    await hub.stop();
    expect(redis.quit).toHaveBeenCalled();
  });

  it('reports status', async () => {
    const { RedisHub } = await import('../redis-hub');
    const hub = new RedisHub();
    await hub.start();
    const status = hub.status();
    expect(status.mode).toBe('memory');
    expect(status.connected).toBe(true);
    await hub.stop();
  });

  it('exposes a singleton accessor', async () => {
    const { getRedisHub, resetRedisHub } = await import('../redis-hub');
    resetRedisHub();
    const hub1 = getRedisHub();
    const hub2 = getRedisHub();
    expect(hub1).toBe(hub2);
  });
});

// ─── Protocol adapters ─────────────────────────────────────────────────

describe('ProtocolAdapters', () => {
  it('supports all 7 DegenChat protocols', async () => {
    const { DEGENCHAT_ADAPTERS, DEGENCHAT_PROTOCOL_IDS } = await import('../protocol-adapters');
    expect(DEGENCHAT_PROTOCOL_IDS).toEqual([
      'nostr',
      'farcaster',
      'mastodon',
      'bluesky',
      'lens',
      'matrix',
      'xmpp',
    ]);
    for (const id of DEGENCHAT_PROTOCOL_IDS) {
      expect(DEGENCHAT_ADAPTERS[id]).toBeDefined();
    }
  });

  it('every adapter has capability metadata', async () => {
    const { DEGENCHAT_ADAPTERS } = await import('../protocol-adapters');
    for (const adapter of Object.values(DEGENCHAT_ADAPTERS)) {
      expect(typeof adapter.send).toBe('function');
      expect(adapter.capabilities.maxMessageLength).toBeGreaterThan(0);
      expect(adapter.label).toBeTruthy();
      expect(adapter.color).toBeTruthy();
    }
  });

  it('nostr supports groups (NIP-29)', async () => {
    const { DEGENCHAT_ADAPTERS } = await import('../protocol-adapters');
    expect(DEGENCHAT_ADAPTERS.nostr.capabilities.supportsGroups).toBe(true);
    expect(typeof DEGENCHAT_ADAPTERS.nostr.sendGroup).toBe('function');
  });

  it('getAdapter throws on unknown protocol', async () => {
    const { getAdapter } = await import('../protocol-adapters');
    expect(() => getAdapter('discord' as never)).toThrow();
  });
});

// ─── Relay ─────────────────────────────────────────────────────────────

describe('DegenChatRelay', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fans out a DM to chosen protocols', async () => {
    const { DegenChatRelay } = await import('../relay');
    const relay = new DegenChatRelay();
    const results = await relay.sendDm(
      {
        messageId: 'm1',
        conversationId: 'c1',
        fromId: 'me',
        fromProtocol: 'nostr',
        toId: 'you',
        body: 'gm',
        encrypted: false,
        timestamp: Date.now(),
        protocols: ['matrix'],
      },
      { MATRIX_ACCESS_TOKEN: 'tok' } as never,
      { skipPublish: true },
    );
    expect(results.length).toBe(1);
    // Without a running Matrix server the adapter fails gracefully
    expect(results[0]?.protocol).toBe('matrix');
    expect(typeof results[0]?.result.ok).toBe('boolean');
  });

  it('fans out to all adapters when no protocols specified', async () => {
    const { DegenChatRelay } = await import('../relay');
    const relay = new DegenChatRelay();
    const results = await relay.sendDm(
      {
        messageId: 'm2',
        conversationId: 'c1',
        fromId: 'me',
        fromProtocol: 'nostr',
        toId: 'you',
        body: 'hello',
        encrypted: false,
        timestamp: Date.now(),
        protocols: [],
      },
      {} as never,
      { skipPublish: true },
    );
    expect(results.length).toBe(7);
  });
});

// ─── Identity ──────────────────────────────────────────────────────────

describe('Identity', () => {
  it('resolves unknown identifiers gracefully', async () => {
    const { resolveDegenIdentity } = await import('../identity');
    const identity = await resolveDegenIdentity('', { allowNetworkLookup: false });
    expect(identity.raw).toBe('');
    expect(identity.deliveryProtocols).toEqual([]);
  });

  it('builds a nostr identity from npub', async () => {
    const { resolveDegenIdentity } = await import('../identity');
    // A well-formed-looking npub for resolution testing
    const identity = await resolveDegenIdentity(
      'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      {
        allowNetworkLookup: false,
      },
    );
    expect(identity.sourceProtocol).toBe('nostr');
    expect(identity.links.some((l) => l.protocol === 'nostr')).toBe(true);
  });
});

// ─── Brand ─────────────────────────────────────────────────────────────

describe('Brand', () => {
  it('exports tagline', async () => {
    const { DEGENCHAT_NAME, DEGENCHAT_TAGLINE } = await import('../brand');
    expect(DEGENCHAT_NAME).toBe('DegenChat');
    expect(DEGENCHAT_TAGLINE).toBe('Chat across every protocol');
  });
});

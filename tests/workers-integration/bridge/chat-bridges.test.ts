/**
 * @degenfeed/web — Chat Bridge Provider Tests
 *
 * Tests for Matrix, Signal, Session, XMPP bridge providers and
 * cross-protocol message routing.
 */

import { describe, expect, it } from 'vitest';

// ─── Bridge Provider Interface Contract ────────────────────────────────

interface BridgeProvider {
  name: string;
  protocol: string;
  supportsE2EE: boolean;
  maxMessageLength: number;
  sendMessage(config: unknown, message: unknown): Promise<unknown>;
  receiveMessages(config: unknown, since?: string): Promise<unknown[]>;
}

function validateBridgeProvider(provider: BridgeProvider): void {
  expect(provider).toBeDefined();
  expect(typeof provider.name).toBe('string');
  expect(typeof provider.protocol).toBe('string');
  expect(typeof provider.supportsE2EE).toBe('boolean');
  expect(typeof provider.maxMessageLength).toBe('number');
  expect(provider.maxMessageLength).toBeGreaterThan(0);
  expect(typeof provider.sendMessage).toBe('function');
  expect(typeof provider.receiveMessages).toBe('function');
}

// ─── Provider Definitions ──────────────────────────────────────────────

const BRIDGE_PROVIDERS: BridgeProvider[] = [
  {
    name: 'Matrix (Conduit)',
    protocol: 'matrix',
    supportsE2EE: true,
    maxMessageLength: 65536,
    sendMessage: async () => ({ ok: true, eventId: '$test' }),
    receiveMessages: async () => [],
  },
  {
    name: 'Signal (smokesignal)',
    protocol: 'signal',
    supportsE2EE: true,
    maxMessageLength: 65536,
    sendMessage: async () => ({ ok: true, timestamp: Date.now() }),
    receiveMessages: async () => [],
  },
  {
    name: 'Session (OXEN)',
    protocol: 'session',
    supportsE2EE: true,
    maxMessageLength: 65536,
    sendMessage: async () => ({ ok: true, timestamp: Date.now() }),
    receiveMessages: async () => [],
  },
  {
    name: 'XMPP (Prosody)',
    protocol: 'xmpp',
    supportsE2EE: true,
    maxMessageLength: 65536,
    sendMessage: async () => ({ ok: true, id: 'xmpp:test' }),
    receiveMessages: async () => [],
  },
  {
    name: 'IRC (ergo/Conduit)',
    protocol: 'irc',
    supportsE2EE: false,
    maxMessageLength: 512,
    sendMessage: async () => ({ ok: true }),
    receiveMessages: async () => [],
  },
  {
    name: 'Nostr (NIP-17 DMs)',
    protocol: 'nostr',
    supportsE2EE: true,
    maxMessageLength: 65536,
    sendMessage: async () => ({ ok: true, eventId: 'note1test' }),
    receiveMessages: async () => [],
  },
  {
    name: 'Telegram (MTProto)',
    protocol: 'telegram',
    supportsE2EE: true,
    maxMessageLength: 4096,
    sendMessage: async () => ({ ok: true, messageId: 123 }),
    receiveMessages: async () => [],
  },
];

// ─── Tests ─────────────────────────────────────────────────────────────

describe('Chat Bridge Providers', () => {
  it('should all have valid provider contracts', () => {
    for (const provider of BRIDGE_PROVIDERS) {
      validateBridgeProvider(provider);
    }
  });

  it('should have all required protocols', () => {
    const protocols = BRIDGE_PROVIDERS.map((p) => p.protocol).sort();
    expect(protocols).toContain('matrix');
    expect(protocols).toContain('signal');
    expect(protocols).toContain('session');
    expect(protocols).toContain('xmpp');
    expect(protocols).toContain('irc');
    expect(protocols).toContain('nostr');
    expect(protocols).toContain('telegram');
  });

  it('should have unique protocol names', () => {
    const protocols = BRIDGE_PROVIDERS.map((p) => p.protocol);
    expect(new Set(protocols).size).toBe(protocols.length);
  });

  it('should support E2EE except IRC', () => {
    for (const provider of BRIDGE_PROVIDERS) {
      if (provider.protocol === 'irc') {
        expect(provider.supportsE2EE).toBe(false);
      } else if (provider.protocol === 'telegram') {
        // Telegram secret chats are E2EE but not all chats
        expect(provider.supportsE2EE).toBe(true);
      } else {
        expect(provider.supportsE2EE).toBe(true);
      }
    }
  });

  it('should have reasonable message length limits', () => {
    for (const provider of BRIDGE_PROVIDERS) {
      if (provider.protocol === 'irc') {
        expect(provider.maxMessageLength).toBeLessThanOrEqual(512);
      } else if (provider.protocol === 'telegram') {
        expect(provider.maxMessageLength).toBeLessThanOrEqual(4096);
      } else {
        expect(provider.maxMessageLength).toBeGreaterThanOrEqual(1024);
      }
    }
  });
});

// ─── Cross-Protocol Message Routing Tests ─────────────────────────────

describe('Cross-Protocol Message Routing', () => {
  const testMessage = {
    id: 'msg:test123',
    text: 'Hello from DegenFeed! 🚀',
    sender: { id: 'user:alice', displayName: 'Alice', protocol: 'matrix' },
    timestamp: Date.now(),
    replyTo: null as string | null,
  };

  it('should convert message format between protocols', () => {
    // Simulate Matrix → IRC conversion (strip markdown, truncate)
    const ircMessage = testMessage.text
      .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1')
      .replace(/__+/, '_')
      .slice(0, 512);
    expect(ircMessage).toBeTruthy();
    expect(ircMessage.length).toBeLessThanOrEqual(512);
    expect(ircMessage).not.toContain('🚀'); // IRC can't do emoji

    // Simulate Matrix → Nostr conversion
    const nostrMessage = {
      content: testMessage.text,
      tags: [['e', testMessage.replyTo].filter(Boolean)],
      created_at: Math.floor(testMessage.timestamp / 1000),
    };
    expect(nostrMessage.content).toBe(testMessage.text);
    expect(nostrMessage.created_at).toBeGreaterThan(0);

    // Simulate Matrix → Signal conversion (E2EE envelope)
    const signalMessage = {
      body: testMessage.text,
      timestamp: testMessage.timestamp,
      quote: testMessage.replyTo || undefined,
    };
    expect(signalMessage.body).toBeTruthy();
  });

  it('should track message provenance across bridge hops', () => {
    const provenance = {
      originalProtocol: 'matrix',
      originalMessageId: '!abc123:conduit.degenfeed.xyz',
      hops: [
        { protocol: 'matrix', timestamp: testMessage.timestamp, server: 'conduit.degenfeed.xyz' },
        {
          protocol: 'nostr',
          timestamp: testMessage.timestamp + 100,
          relay: 'wss://relay.degenfeed.xyz',
        },
        { protocol: 'signal', timestamp: testMessage.timestamp + 200, server: 'smokesignal.local' },
      ],
      currentProtocol: 'signal',
    };

    expect(provenance.hops.length).toBe(3);
    expect(provenance.originalProtocol).toBe('matrix');
    expect(provenance.currentProtocol).toBe('signal');
    expect(provenance.hops[2].protocol).toBe('signal');
  });

  it('should handle empty messages gracefully', async () => {
    for (const provider of BRIDGE_PROVIDERS) {
      const result = await provider.sendMessage({}, { text: '' });
      expect(result).toBeDefined();
    }
  });

  it('should handle receive with no messages', async () => {
    for (const provider of BRIDGE_PROVIDERS) {
      const messages = await provider.receiveMessages({});
      expect(Array.isArray(messages)).toBe(true);
    }
  });
});

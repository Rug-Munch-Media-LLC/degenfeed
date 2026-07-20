/**
 * @degenfeed/identity-hub — IdentityHub tests
 */

import { describe, expect, it, vi } from 'vitest';
import { IdentityHub, createIdentityHub } from './index';

// ─── Mock KV ───────────────────────────────────────────────────────────

type MockKv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

function createMockKv(): MockKv {
  const store = new Map<string, string>();
  return {
    get: vi.fn().mockImplementation(async (key: string) => store.get(key) ?? null) as MockKv['get'],
    put: vi.fn().mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    }) as MockKv['put'],
    delete: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }) as MockKv['delete'],
  };
}

describe('IdentityHub', () => {
  describe('linkIdentity', () => {
    it('should link a wallet to a protocol identity', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.linkIdentity('0xabc', 'atproto', {
        identifier: 'did:plc:test123',
        handle: 'test.pds.degenfeed.xyz',
      });

      const identity = await hub.resolveWallet('0xabc');
      expect(identity.linkedProtocolCount).toBe(1);
      expect(identity.protocols.atproto?.linked).toBe(true);
      expect(identity.protocols.atproto?.identifier).toBe('did:plc:test123');
    });

    it('should link multiple protocols to the same wallet', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.linkIdentity('0xabc', 'atproto', {
        identifier: 'did:plc:test123',
        handle: 'test.pds.degenfeed.xyz',
      });

      await hub.linkIdentity('0xabc', 'telegram', {
        identifier: '12345',
        handle: 'testuser',
      });

      const identity = await hub.resolveWallet('0xabc');
      expect(identity.linkedProtocolCount).toBe(2);
      expect(identity.protocols.atproto?.linked).toBe(true);
      expect(identity.protocols.telegram?.linked).toBe(true);
    });

    it('should update protocol-to-wallet reverse index', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.linkIdentity('0xabc', 'atproto', {
        identifier: 'did:plc:test123',
      });

      const wallet = await hub.resolveToWallet('atproto', 'did:plc:test123');
      expect(wallet).toBe('0xabc');
    });
  });

  describe('resolveWallet', () => {
    it('should return empty identity for unknown wallet', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const identity = await hub.resolveWallet('0xunknown');
      expect(identity.linkedProtocolCount).toBe(0);
      expect(identity.premiumStatus).toBe('free');
    });

    it('should list all unlinked protocols for unknown wallet', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const identity = await hub.resolveWallet('0xunknown');
      const protocols = ['nostr', 'farcaster', 'lens', 'bluesky', 'atproto', 'zora', 'telegram'];
      for (const p of protocols) {
        expect(identity.protocols[p as keyof typeof identity.protocols]?.linked).toBe(false);
      }
    });
  });

  describe('hasProtocol', () => {
    it('should return true when protocol is linked', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.linkIdentity('0xabc', 'zora', {
        identifier: '0xcoin123',
      });

      const has = await hub.hasProtocol('0xabc', 'zora');
      expect(has).toBe(true);
    });

    it('should return false when protocol is not linked', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const has = await hub.hasProtocol('0xabc', 'zora');
      expect(has).toBe(false);
    });
  });

  describe('getCredentials / storeCredentials', () => {
    it('should store and retrieve credentials', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.storeCredentials('0xabc', 'atproto', {
        encrypted: 'base64encrypteddata',
        storedAt: Date.now(),
      });

      const creds = await hub.getCredentials('0xabc', 'atproto');
      expect(creds).not.toBeNull();
      expect(creds?.encrypted).toBe('base64encrypteddata');
    });

    it('should return null for non-existent credentials', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const creds = await hub.getCredentials('0xabc', 'atproto');
      expect(creds).toBeNull();
    });
  });

  describe('listProtocols', () => {
    it('should list all linked protocols', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.linkIdentity('0xabc', 'atproto', { identifier: 'did:plc:1' });
      await hub.linkIdentity('0xabc', 'zora', { identifier: '0xcoin1' });
      await hub.linkIdentity('0xabc', 'telegram', { identifier: '12345' });

      const protocols = await hub.listProtocols('0xabc');
      expect(protocols).toContain('atproto');
      expect(protocols).toContain('zora');
      expect(protocols).toContain('telegram');
      expect(protocols.length).toBe(3);
    });

    it('should return empty array for unknown wallet', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const protocols = await hub.listProtocols('0xunknown');
      expect(protocols).toEqual([]);
    });
  });

  describe('premiumStatus', () => {
    it('should default to free', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const status = await hub.getPremiumStatus('0xabc');
      expect(status.tier).toBe('free');
      expect(status.isPremium).toBe(false);
    });

    it('should return premium after setting', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      await hub.setPremiumStatus('0xabc', 'premium');
      const status = await hub.getPremiumStatus('0xabc');
      expect(status.tier).toBe('premium');
      expect(status.isPremium).toBe(true);
    });
  });

  describe('autoCreateAccounts', () => {
    it('should reject auto-creation for non-premium users', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });

      const results = await hub.autoCreateAccounts('0xabc', ['atproto']);
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toContain('Premium');
    });

    it('should return not-supported for unknown protocols', async () => {
      const kv = createMockKv();
      const hub = new IdentityHub({ kv });
      await hub.setPremiumStatus('0xabc', 'premium');

      const results = await hub.autoCreateAccounts('0xabc', ['nostr']);
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toContain('not supported');
    });
  });
});

describe('createIdentityHub', () => {
  it('should create an IdentityHub from a KV-like object', () => {
    const kv = createMockKv();
    const hub = createIdentityHub(kv);
    expect(hub).toBeInstanceOf(IdentityHub);
  });
});

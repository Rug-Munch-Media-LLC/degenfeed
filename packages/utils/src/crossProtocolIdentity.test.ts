/**
 * @degenfeed/utils — CrossProtocolIdentity tests
 */

import { describe, expect, it } from 'vitest';
import { IDENTITY_KV_PREFIX, identityKey, PROTOCOL_ID_REGISTRY } from './crossProtocolIdentity';

describe('identityKey', () => {
  it('should prefix with IDENTITY_KV_PREFIX', () => {
    const key = identityKey('0xabc123');
    expect(key).toBe(`${IDENTITY_KV_PREFIX}0xabc123`);
  });

  it('should lowercase the address', () => {
    const key = identityKey('0xABC123');
    expect(key).toBe(`${IDENTITY_KV_PREFIX}0xabc123`);
  });

  it('should handle Solana addresses', () => {
    const addr = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
    const key = identityKey(addr);
    expect(key).toBe(`${IDENTITY_KV_PREFIX}${addr.toLowerCase()}`);
  });
});

describe('IDENTITY_KV_PREFIX', () => {
  it('should be "identity:"', () => {
    expect(IDENTITY_KV_PREFIX).toBe('identity:');
  });
});

describe('PROTOCOL_ID_REGISTRY', () => {
  it('should contain all supported protocols', () => {
    const protocols = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit'];
    for (const p of protocols) {
      expect(PROTOCOL_ID_REGISTRY[p]).toBeDefined();
      expect(PROTOCOL_ID_REGISTRY[p].displayName).toBeTruthy();
      expect(PROTOCOL_ID_REGISTRY[p].resolveEndpoint).toContain('/api/identity/resolve');
    }
  });

  it('should have Nostr with correct icon and color', () => {
    expect(PROTOCOL_ID_REGISTRY.nostr.displayName).toBe('Nostr');
    expect(PROTOCOL_ID_REGISTRY.nostr.icon).toBe('⚡');
    expect(PROTOCOL_ID_REGISTRY.nostr.color).toBe('#8b5cf6');
  });

  it('should have Bluesky with correct display name', () => {
    expect(PROTOCOL_ID_REGISTRY.bluesky.displayName).toBe('Bluesky');
  });

  it('should have Mastodon with correct icon', () => {
    expect(PROTOCOL_ID_REGISTRY.mastodon.icon).toBe('🐘');
  });
});

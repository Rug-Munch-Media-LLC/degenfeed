import { describe, expect, it } from 'vitest';

describe('@degenfeed/nostr-sdk', () => {
  it('should export npub encode/decode functions', async () => {
    const { npubEncode, npubDecode } = await import('./index');
    expect(typeof npubEncode).toBe('function');
    expect(typeof npubDecode).toBe('function');
  });

  it('should round-trip npub encoding', async () => {
    const { npubEncode, npubDecode } = await import('./index');
    const hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const npub = npubEncode(hex);
    expect(npub).toMatch(/^npub1/);
    const decoded = npubDecode(npub);
    expect(decoded).toBe(hex);
  });

  it('should export event signing functions', async () => {
    const { generateSecretKey, getPublicKey } = await import('./index');
    expect(typeof generateSecretKey).toBe('function');
    expect(typeof getPublicKey).toBe('function');
  });

  it('should export RelayPool class', async () => {
    const { RelayPool } = await import('./index');
    expect(typeof RelayPool).toBe('function');
  });

  it('should export NIP-19 functions', async () => {
    const { decodeNip19, encodeNip19 } = await import('./index');
    expect(typeof decodeNip19).toBe('function');
    expect(typeof encodeNip19).toBe('function');
  });

  it('should export NIP-05 functions', async () => {
    const { parseNip05, resolveNip05 } = await import('./index');
    expect(typeof parseNip05).toBe('function');
    expect(typeof resolveNip05).toBe('function');
  });

  it('should export normalizer functions', async () => {
    const { profileToIdentity, eventToUnifiedPost } = await import('./index');
    expect(typeof profileToIdentity).toBe('function');
    expect(typeof eventToUnifiedPost).toBe('function');
  });
});

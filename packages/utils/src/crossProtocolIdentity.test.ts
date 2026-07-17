import { describe, expect, it } from 'vitest';

describe('crossProtocolIdentity', () => {
  it('should export PROTOCOL_ID_REGISTRY with all 6 protocols', async () => {
    const { PROTOCOL_ID_REGISTRY } = await import('./crossProtocolIdentity');
    expect(Object.keys(PROTOCOL_ID_REGISTRY)).toEqual([
      'nostr',
      'farcaster',
      'lens',
      'bluesky',
      'mastodon',
      'reddit',
    ]);
  });

  it('should have display metadata for each protocol', async () => {
    const { PROTOCOL_ID_REGISTRY } = await import('./crossProtocolIdentity');
    for (const [key, meta] of Object.entries(PROTOCOL_ID_REGISTRY)) {
      expect(meta.displayName).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(meta.resolveEndpoint).toContain('/api/identity/resolve');
    }
  });

  it('should build correct KV key', async () => {
    const { identityKey } = await import('./crossProtocolIdentity');
    expect(identityKey('0x1234')).toBe('identity:0x1234');
    expect(identityKey('0xABCDEF')).toBe('identity:0xabcdef');
  });

  it('should export types', async () => {
    const mod = await import('./crossProtocolIdentity');
    expect(typeof mod.IDENTITY_KV_PREFIX).toBe('string');
  });
});

import { describe, expect, it } from 'vitest';

describe('@degenfeed/lens-sdk', () => {
  it('should export LensClient class', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient();
    expect(client).toBeInstanceOf(LensClient);
  });

  it('should export LENS_API_URL constant', async () => {
    const { LENS_API_URL } = await import('./index');
    expect(LENS_API_URL).toContain('lens.dev');
  });

  it('should reject query with invalid API', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient('https://invalid.test/graphql');
    await expect(client.getProfile('0x01')).resolves.toBeNull();
  });

  it('should convert profile to identity', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient();
    const identity = client.profileToIdentity({
      id: '0x01',
      handle: { localName: 'stani' },
      metadata: {
        displayName: 'Stani',
        bio: 'Lens',
        picture: { optimized: { uri: 'https://x.jpg' } },
      },
      stats: { followers: 1000, following: 500 },
    });
    expect(identity.displayName).toBe('Stani');
    expect(identity.keys.lensProfileId).toBe('0x01');
    expect(identity.avatarUrl).toBe('https://x.jpg');
  });
});

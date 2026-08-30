import { describe, expect, it } from 'vitest';

describe('@degenfeed/lens-sdk', () => {
  it('should export LensClient class', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient();
    expect(client).toBeInstanceOf(LensClient);
  });

  it('should export LENS_API_URL constant', async () => {
    const { LENS_API_URL } = await import('./index');
    expect(LENS_API_URL).toContain('api.lens.xyz');
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

describe('@degenfeed/lens-sdk/momoka', () => {
  it('should export MomokaClient class', async () => {
    const { MomokaClient } = await import('./momoka');
    const client = new MomokaClient();
    expect(client).toBeInstanceOf(MomokaClient);
  });

  it('should reject submit to invalid URL', async () => {
    const { MomokaClient } = await import('./momoka');
    const client = new MomokaClient('https://invalid.momoka.test');
    const result = await client.submit({
      content: 'test',
      profileId: '0x01',
      accessToken: 'test',
    });
    expect(result.accepted).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should return degraded health for invalid URL', async () => {
    const { MomokaClient } = await import('./momoka');
    const client = new MomokaClient('https://invalid.momoka.test');
    const health = await client.health();
    expect(health.status).toBe('down');
  });
});

describe('@degenfeed/lens-sdk/data-export', () => {
  it('should export LensDataExportService class', async () => {
    const { LensDataExportService } = await import('./data-export');
    const svc = new LensDataExportService();
    expect(svc).toBeInstanceOf(LensDataExportService);
  });

  it('should generate DID document', async () => {
    const { LensDataExportService } = await import('./data-export');
    const svc = new LensDataExportService();
    const doc = svc.generateDidDocument('0x01', 'stani', '0x1234');
    expect(doc.id).toBe('did:lens:0x01');
    expect(doc.alsoKnownAs).toContain('lens://stani');
    expect(doc.verificationMethod).toHaveLength(1);
    expect(doc.verificationMethod).toBeDefined();
    const vm = doc.verificationMethod as Record<string, unknown>[];
    expect((vm[0] as Record<string, unknown>).blockchainAccountId as string).toContain('0x1234');
  });
});

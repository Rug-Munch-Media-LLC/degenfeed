import { describe, expect, it } from 'vitest';

describe('@degenfeed/lens-sdk', () => {
  it('should export LensClient class', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient();
    expect(client).toBeInstanceOf(LensClient);
  });

  it('should export LENS_API_URL constant', async () => {
    const { LENS_API_URL, CURATED_LENS_HANDLES } = await import('./index');
    expect(LENS_API_URL).toContain('lens.dev');
    expect(CURATED_LENS_HANDLES.length).toBeGreaterThan(3);
  });

  it('should reject query with invalid API', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient('https://invalid.test/graphql');
    await expect(client.query('{ __typename }')).rejects.toThrow();
  });

  it('should normalize publication to UnifiedPost', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient();
    const post = client.publicationToUnifiedPost({
      id: '0x01-0x01',
      by: {
        id: '0x01',
        handle: { localName: 'stani' },
        metadata: { displayName: 'Stani' },
      },
      metadata: { content: 'Lens content about crypto' },
      createdAt: '2026-07-04T12:00:00.000Z',
      stats: { reactions: 5, mirrors: 2, comments: 1 },
    });
    expect(post.protocol).toBe('lens');
    expect(post.text).toBe('Lens content about crypto');
    expect(post.metrics.likes).toBe(5);
    expect(post.author.handles.lens).toBe('stani.lens');
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

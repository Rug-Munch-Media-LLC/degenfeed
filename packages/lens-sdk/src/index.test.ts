import { describe, expect, it } from 'vitest';

describe('@degenfeed/lens-sdk', () => {
  it('should export LensClient class', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient();
    expect(client).toBeInstanceOf(LensClient);
  });

  it('should export LENS_API_URL constant', async () => {
    const { LENS_API_URL } = await import('./index');
    expect(LENS_API_URL).toContain('lens.xyz');
  });

  it('should reject query with invalid API', async () => {
    const { LensClient } = await import('./index');
    const client = new LensClient('https://invalid.test/graphql');
    await expect(client.query('{ __typename }')).rejects.toThrow();
  });
});

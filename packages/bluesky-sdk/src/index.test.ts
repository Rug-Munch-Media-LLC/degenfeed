import { describe, expect, it } from 'vitest';

describe('@degenfeed/bluesky-sdk', () => {
  it('should export BskyClient class', async () => {
    const { BskyClient } = await import('./index');
    const client = new BskyClient();
    expect(client).toBeInstanceOf(BskyClient);
  });

  it('should export constants', async () => {
    const { BSKY_PUBLIC_URL, BSKY_SOCIAL_URL } = await import('./index');
    expect(BSKY_PUBLIC_URL).toBe('https://public.api.bsky.app');
    expect(BSKY_SOCIAL_URL).toBe('https://bsky.social');
  });

  it('should support setting auth', async () => {
    const { BskyClient } = await import('./index');
    const client = new BskyClient();
    expect(() => client.setAuth('test-jwt')).not.toThrow();
  });
});

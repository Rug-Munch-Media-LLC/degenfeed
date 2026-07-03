import { describe, expect, it } from 'vitest';

describe('@degenfeed/farcaster-sdk', () => {
  it('should export HubClient class', async () => {
    const { HubClient } = await import('./index');
    const client = new HubClient();
    expect(client).toBeInstanceOf(HubClient);
  });

  it('should export DEFAULT_HUB_URL constant', async () => {
    const { DEFAULT_HUB_URL } = await import('./index');
    expect(DEFAULT_HUB_URL).toContain('farcaster');
  });

  it('should export helper functions', async () => {
    const { emptyIdentity, buildUnifiedPost } = await import('./index');
    expect(typeof emptyIdentity).toBe('function');
    expect(typeof buildUnifiedPost).toBe('function');
  });
});

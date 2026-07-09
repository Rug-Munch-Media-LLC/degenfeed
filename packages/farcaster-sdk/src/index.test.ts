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

  it('should export curated FIDs', async () => {
    const { CURATED_FARCASTER_FIDS } = await import('./index');
    expect(CURATED_FARCASTER_FIDS.length).toBeGreaterThan(10);
    expect(CURATED_FARCASTER_FIDS).toContain(1);
    expect(CURATED_FARCASTER_FIDS).toContain(5650);
  });

  it('should convert profile to UnifiedIdentity', async () => {
    const { HubClient } = await import('./index');
    const client = new HubClient();
    const identity = client.profileToIdentity({
      fid: 1,
      username: 'dwr',
      displayName: 'Dan Romero',
      bio: 'Building Farcaster',
      avatarUrl: 'https://example.com/avatar.png',
      pfp: 'https://example.com/avatar.png',
      followerCount: 1000,
      followingCount: 500,
    });
    expect(identity.displayName).toBe('Dan Romero');
    expect(identity.handles.farcaster).toBe('dwr');
    expect(identity.keys.fid).toBe(1);
  });
});

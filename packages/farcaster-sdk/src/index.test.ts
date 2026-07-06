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

  it('should export curated FIDs', async () => {
    const { CURATED_FARCASTER_FIDS } = await import('./index');
    expect(CURATED_FARCASTER_FIDS.length).toBeGreaterThan(10);
    expect(CURATED_FARCASTER_FIDS).toContain(1);
    expect(CURATED_FARCASTER_FIDS).toContain(5650);
  });

  it('should normalize cast to UnifiedPost', async () => {
    const { HubClient } = await import('./index');
    const client = new HubClient();
    const post = client.castToUnifiedPost({
      hash: '0xabc',
      fid: 1,
      text: 'Hello Farcaster',
      embeds: [{ url: 'https://example.com' }],
      timestamp: Date.now(),
      reactions: { likes: 0, recasts: 0, replies: 0 },
    });
    expect(post.protocol).toBe('farcaster');
    expect(post.text).toBe('Hello Farcaster');
    expect(post.id).toBe('farcaster:0xabc');
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

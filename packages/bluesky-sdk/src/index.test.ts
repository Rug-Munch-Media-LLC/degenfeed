import { describe, expect, it } from 'vitest';

describe('@degenfeed/bluesky-sdk', () => {
  it('should export BskyClient class', async () => {
    const { BskyClient } = await import('./index');
    const client = new BskyClient();
    expect(client).toBeInstanceOf(BskyClient);
  });

  it('should export constants', async () => {
    const { BSKY_PUBLIC_URL, BSKY_SOCIAL_URL, CURATED_BSKY_ACTORS } = await import('./index');
    expect(BSKY_PUBLIC_URL).toBe('https://public.api.bsky.app');
    expect(BSKY_SOCIAL_URL).toBe('https://bsky.social');
    expect(CURATED_BSKY_ACTORS.length).toBeGreaterThan(5);
  });

  it('should support setting auth', async () => {
    const { BskyClient } = await import('./index');
    const client = new BskyClient();
    expect(() => client.setAuth('test-jwt')).not.toThrow();
  });

  it('should normalize post to UnifiedPost', async () => {
    const { BskyClient } = await import('./index');
    const client = new BskyClient();
    const post = client.postToUnifiedPost({
      uri: 'at://did:plc:test/app.bsky.feed.post/abc123',
      cid: 'bafy-test',
      author: { did: 'did:plc:test', handle: 'test.bsky.social' },
      record: { text: 'Hello Bluesky', createdAt: '2026-07-04T12:00:00.000Z' },
      likeCount: 10,
      repostCount: 2,
      replyCount: 1,
      indexedAt: '2026-07-04T12:00:00.000Z',
    });
    expect(post.protocol).toBe('bluesky');
    expect(post.text).toBe('Hello Bluesky');
    expect(post.metrics.likes).toBe(10);
    expect(post.author.handles.bluesky).toBe('test.bsky.social');
  });

  it('should convert author to identity', async () => {
    const { BskyClient } = await import('./index');
    const client = new BskyClient();
    const identity = client.authorToIdentity({
      did: 'did:plc:test',
      handle: 'test.bsky.social',
      displayName: 'Test User',
    });
    expect(identity.displayName).toBe('Test User');
    expect(identity.keys.did).toBe('did:plc:test');
  });
});

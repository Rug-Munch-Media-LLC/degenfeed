import { describe, expect, it } from 'vitest';

describe('@degenfeed/threads-sdk', () => {
  it('should export ThreadsClient class', async () => {
    const { ThreadsClient } = await import('./index');
    const client = new ThreadsClient();
    expect(client).toBeInstanceOf(ThreadsClient);
  });

  it('should export constants', async () => {
    const { THREADS_PUBLIC_URL, THREADS_PDS_URL } = await import('./index');
    expect(THREADS_PUBLIC_URL).toBe('https://public.threads.net');
    expect(THREADS_PDS_URL).toBe('https://threads.net');
  });

  it('should support setting auth', async () => {
    const { ThreadsClient } = await import('./index');
    const client = new ThreadsClient();
    expect(() => client.setAuth('test-jwt')).not.toThrow();
  });

  it('should normalize post to UnifiedPost', async () => {
    const { ThreadsClient, THREADS_PUBLIC_URL } = await import('./index');
    const client = new ThreadsClient();
    const mockPost = {
      uri: 'at://did:plc:test/app.bsky.feed.post/abc123',
      cid: 'bafy-test',
      author: {
        did: 'did:plc:testuser',
        handle: 'testuser.threads.net',
        displayName: 'Test User',
        avatar: 'https://threads.net/avatar.jpg',
      },
      record: {
        text: 'Hello from Threads!',
        createdAt: '2026-07-04T12:00:00.000Z',
      },
      likeCount: 42,
      repostCount: 7,
      replyCount: 3,
      indexedAt: '2026-07-04T12:00:00.000Z',
    };

    const unified = client.postToUnifiedPost(mockPost);
    expect(unified.protocol).toBe('threads');
    expect(unified.text).toBe('Hello from Threads!');
    expect(unified.metrics.likes).toBe(42);
    expect(unified.id).toContain('threads:');
  });

  it('should normalize post with embeds', async () => {
    const { ThreadsClient } = await import('./index');
    const client = new ThreadsClient();
    const mockPost = {
      uri: 'at://did:plc:test/app.bsky.feed.post/def456',
      cid: 'bafy-test-2',
      author: {
        did: 'did:plc:testuser2',
        handle: 'testuser2.threads.net',
      },
      record: {
        text: 'Post with image',
        createdAt: '2026-07-04T13:00:00.000Z',
        embed: {
          type: 'app.bsky.embed.images',
          images: [{ image: { ref: '/img/test.jpg' }, alt: 'A test image' }],
        },
      },
      likeCount: 10,
      repostCount: 2,
      replyCount: 1,
      indexedAt: '2026-07-04T13:00:00.000Z',
    };

    const unified = client.postToUnifiedPost(mockPost);
    expect(unified.protocol).toBe('threads');
    expect(unified.embeds.length).toBeGreaterThanOrEqual(1);
  });
});

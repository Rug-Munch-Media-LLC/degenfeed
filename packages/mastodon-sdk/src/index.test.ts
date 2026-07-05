import { describe, expect, it } from 'vitest';

describe('@degenfeed/mastodon-sdk', () => {
  it('should export GtSClient class', async () => {
    const { GtSClient } = await import('./index');
    const client = new GtSClient('https://social.example.com');
    expect(client).toBeInstanceOf(GtSClient);
  });

  it('should support setting auth', async () => {
    const { GtSClient } = await import('./index');
    const client = new GtSClient('https://social.example.com');
    expect(client.isAuthenticated).toBe(false);
    client.setAuth('test-token');
    expect(client.isAuthenticated).toBe(true);
  });

  it('should normalize status to UnifiedPost', async () => {
    const { statusToUnifiedPost } = await import('./index');
    const mockStatus = {
      id: '123456',
      uri: 'https://social.example.com/@testuser/123456',
      created_at: '2026-07-04T12:00:00.000Z',
      content: '<p><p>Bitcoin and crypto from the fediverse!</p></p>',
      visibility: 'public' as const,
      sensitive: false,
      spoiler_text: '',
      media_attachments: [],
      mentions: [],
      tags: [{ name: 'crypto', url: 'https://social.example.com/tags/crypto' }],
      emojis: [],
      reblogs_count: 5,
      favourites_count: 12,
      replies_count: 3,
      url: 'https://social.example.com/@testuser/123456',
      in_reply_to_id: null,
      in_reply_to_account_id: null,
      reblog: null,
      card: null,
      poll: null,
      account: {
        id: '1',
        username: 'testuser',
        acct: 'testuser',
        display_name: 'Test User',
        locked: false,
        bot: false,
        discoverable: true,
        created_at: '2025-01-01T00:00:00Z',
        note: '<p>A test user</p>',
        url: 'https://social.example.com/@testuser',
        avatar: 'https://social.example.com/avatars/test.jpg',
        avatar_static: 'https://social.example.com/avatars/test.jpg',
        header: 'https://social.example.com/headers/test.jpg',
        header_static: 'https://social.example.com/headers/test.jpg',
        followers_count: 100,
        following_count: 50,
        statuses_count: 500,
        last_status_at: '2026-07-04',
        emojis: [],
        fields: [],
      },
      favourited: false,
      reblogged: false,
    };

    const post = statusToUnifiedPost(mockStatus, 'https://social.example.com');
    expect(post.protocol).toBe('mastodon');
    expect(post.text).toContain('Bitcoin and crypto from the fediverse!');
    expect(post.metrics.likes).toBe(12);
    expect(post.metrics.reposts).toBe(5);
    expect(post.author.displayName).toBe('Test User');
    expect(post.niches).toContain('crypto');
    expect(post.id).toContain('mastodon:');
  });

  it('should handle boosted/reblogged posts', async () => {
    const { statusToUnifiedPost } = await import('./index');
    const boostStatus = {
      id: 'boost-1',
      uri: 'https://social.example.com/@testuser/boost-1',
      created_at: '2026-07-04T14:00:00Z',
      content: '',
      visibility: 'public' as const,
      sensitive: false,
      spoiler_text: '',
      media_attachments: [],
      mentions: [],
      tags: [],
      emojis: [],
      reblogs_count: 0,
      favourites_count: 0,
      replies_count: 0,
      url: 'https://social.example.com/@testuser/boost-1',
      in_reply_to_id: null,
      in_reply_to_account_id: null,
      reblog: {
        id: 'original-1',
        uri: 'https://other.instance/@otheruser/original-1',
        created_at: '2026-07-04T10:00:00Z',
        content: '<p>Original post content</p>',
        visibility: 'public' as const,
        sensitive: false,
        spoiler_text: '',
        media_attachments: [],
        mentions: [],
        tags: [],
        emojis: [],
        reblogs_count: 10,
        favourites_count: 25,
        replies_count: 5,
        url: 'https://other.instance/@otheruser/original-1',
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        reblog: null,
        card: null,
        poll: null,
        account: {
          id: 'other-1',
          username: 'otheruser',
          acct: 'otheruser@other.instance',
          display_name: 'Other User',
          locked: false,
          bot: false,
          discoverable: true,
          created_at: '2025-01-01T00:00:00Z',
          note: '',
          url: 'https://other.instance/@otheruser',
          avatar: 'https://other.instance/avatar.jpg',
          avatar_static: 'https://other.instance/avatar.jpg',
          header: 'https://other.instance/header.jpg',
          header_static: 'https://other.instance/header.jpg',
          followers_count: 200,
          following_count: 100,
          statuses_count: 1000,
          last_status_at: '2026-07-04',
          emojis: [],
          fields: [],
        },
        favourited: false,
        reblogged: false,
      },
      card: null,
      poll: null,
      account: {
        id: '1',
        username: 'testuser',
        acct: 'testuser',
        display_name: 'Test User',
        locked: false,
        bot: false,
        discoverable: true,
        created_at: '2025-01-01T00:00:00Z',
        note: '',
        url: 'https://social.example.com/@testuser',
        avatar: 'https://social.example.com/avatar.jpg',
        avatar_static: 'https://social.example.com/avatar.jpg',
        header: 'https://social.example.com/header.jpg',
        header_static: 'https://social.example.com/header.jpg',
        followers_count: 100,
        following_count: 50,
        statuses_count: 500,
        last_status_at: '2026-07-04',
        emojis: [],
        fields: [],
      },
      favourited: false,
      reblogged: true,
    };

    const post = statusToUnifiedPost(boostStatus, 'https://social.example.com');
    expect(post.text).toContain('Original post content');
    expect(post.metrics.likes).toBe(25);
    expect(post.metrics.reposts).toBe(10);
  });

  it('should handle content warnings', async () => {
    const { statusToUnifiedPost } = await import('./index');
    const cwStatus = {
      id: 'cw-1',
      uri: 'https://social.example.com/@testuser/cw-1',
      created_at: '2026-07-04T15:00:00Z',
      content: '<p>Sensitive content here</p>',
      visibility: 'public' as const,
      sensitive: true,
      spoiler_text: 'NSFW: Politics',
      media_attachments: [],
      mentions: [],
      tags: [],
      emojis: [],
      reblogs_count: 0,
      favourites_count: 0,
      replies_count: 0,
      url: 'https://social.example.com/@testuser/cw-1',
      in_reply_to_id: null,
      in_reply_to_account_id: null,
      reblog: null,
      card: null,
      poll: null,
      account: {
        id: '1',
        username: 'testuser',
        acct: 'testuser',
        display_name: 'Test User',
        locked: false,
        bot: false,
        discoverable: true,
        created_at: '2025-01-01T00:00:00Z',
        note: '',
        url: 'https://social.example.com/@testuser',
        avatar: 'https://social.example.com/avatar.jpg',
        avatar_static: 'https://social.example.com/avatar.jpg',
        header: 'https://social.example.com/header.jpg',
        header_static: 'https://social.example.com/header.jpg',
        followers_count: 100,
        following_count: 50,
        statuses_count: 500,
        last_status_at: '2026-07-04',
        emojis: [],
        fields: [],
      },
      favourited: false,
      reblogged: false,
    };

    const post = statusToUnifiedPost(cwStatus, 'https://social.example.com');
    expect(post.text).toContain('[CW: NSFW: Politics]');
    expect(post.text).toContain('Sensitive content here');
  });
});

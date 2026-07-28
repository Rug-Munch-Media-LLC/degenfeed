/**
 * @degenfeed/pixelfed-sdk — PixelfedClient tests
 *
 * Tests the PixelfedClient class with mocked fetch to verify URL construction,
 * request headers, body serialization, response parsing, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PixelfedAccount, PixelfedStatus } from '../index';

// ─── Mock data ────────────────────────────────────────────────────────

const MOCK_ACCOUNT: PixelfedAccount = {
  id: '12345',
  username: 'photographer',
  acct: 'photographer',
  display_name: 'Pixel Photographer',
  locked: false,
  bot: false,
  discoverable: true,
  created_at: '2025-06-01T00:00:00Z',
  note: '<p>Sharing photos from around the world</p>',
  url: 'https://pixelfed.social/photographer',
  avatar: 'https://pixelfed.social/avatars/1.jpg',
  avatar_static: 'https://pixelfed.social/avatars/1.jpg',
  header: 'https://pixelfed.social/headers/1.jpg',
  header_static: 'https://pixelfed.social/headers/1.jpg',
  followers_count: 250,
  following_count: 100,
  statuses_count: 1500,
  last_status_at: '2026-07-27',
  fields: [],
  emojis: [],
};

const MOCK_STATUS: PixelfedStatus = {
  id: '98765',
  uri: 'https://pixelfed.social/p/photographer/98765',
  created_at: '2026-07-27T10:00:00Z',
  content: '<p>Sunset over the mountains</p>',
  visibility: 'public',
  sensitive: false,
  spoiler_text: '',
  media_attachments: [
    {
      id: 'm1',
      type: 'image',
      url: 'https://pixelfed.social/media/1.jpg',
      preview_url: 'https://pixelfed.social/media/1_small.jpg',
      remote_url: null,
      meta: { original: { width: 1920, height: 1080 } },
      description: 'A beautiful sunset',
      blurhash: null,
    },
  ],
  mentions: [],
  tags: [{ name: 'photography', url: '/tags/photography' }],
  emojis: [],
  reblogs_count: 3,
  favourites_count: 15,
  replies_count: 1,
  url: 'https://pixelfed.social/p/photographer/98765',
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  reblog: null,
  card: null,
  poll: null,
  account: MOCK_ACCOUNT,
  favourited: false,
  reblogged: false,
  muted: false,
  bookmarked: false,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('PixelfedClient', () => {
  let PixelfedClient: typeof import('../index').PixelfedClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const mod = await import('../index');
    PixelfedClient = mod.PixelfedClient;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── Instantiation ───────────────────────────────────────────────────

  it('should instantiate with a valid instance URL', () => {
    const client = new PixelfedClient('https://pixelfed.social');
    expect(client).toBeInstanceOf(PixelfedClient);
    expect(client.isAuthenticated).toBe(false);
  });

  it('should strip trailing slash from instance URL', () => {
    const client = new PixelfedClient('https://pixelfed.social/');
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));
    client.verifyCredentials();
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    // Trailing slash should be stripped, preventing double-slash in path
    expect(callUrl).toBe('https://pixelfed.social/api/v1/accounts/verify_credentials');
    expect(callUrl).not.toContain('//api');
  });

  it('should accept an access token in constructor', () => {
    const client = new PixelfedClient('https://pixelfed.social', 'tok_pix_abc123');
    expect(client.isAuthenticated).toBe(true);
  });

  it('should set auth state via setAuth', () => {
    const client = new PixelfedClient('https://pixelfed.social');
    expect(client.isAuthenticated).toBe(false);
    client.setAuth('tok_pix_test');
    expect(client.isAuthenticated).toBe(true);
    client.setAuth('tok_pix_updated');
    expect(client.isAuthenticated).toBe(true);
  });

  // ─── GET requests: URL construction ──────────────────────────────────

  it('should call getAccount with the correct URL', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social');
    const result = await client.getAccount('42');

    expect(result.username).toBe('photographer');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://pixelfed.social/api/v1/accounts/42');
  });

  it('should call lookupAccount with query parameter', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social', 'tok_lookup');
    await client.lookupAccount('alice@example.com');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/lookup');
    expect(callUrl).toContain('acct=alice%40example.com');
  });

  it('should call verifyCredentials with auth header', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social', 'tok_verify');
    await client.verifyCredentials();

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://pixelfed.social/api/v1/accounts/verify_credentials');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('GET');
    expect(callInit.headers).toMatchObject({
      accept: 'application/json',
      authorization: 'Bearer tok_verify',
    });
  });

  it('should call getAccountStatuses with correct URL and limit param', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify([MOCK_STATUS]), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social');
    const result = await client.getAccountStatuses('42', 10);

    expect(result).toHaveLength(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/42/statuses');
    expect(callUrl).toContain('limit=10');
  });

  it('should call getPublicTimeline with correct defaults', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify([MOCK_STATUS]), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social');
    await client.getPublicTimeline();

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/timelines/public');
    expect(callUrl).toContain('limit=20');
  });

  it('should call getTagTimeline with correct URL', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify([MOCK_STATUS]), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social');
    await client.getTagTimeline('photography', 5);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/timelines/tag/photography');
    expect(callUrl).toContain('limit=5');
  });

  it('should encode special characters in tag names', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify([MOCK_STATUS]), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social');
    await client.getTagTimeline('c++');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/timelines/tag/c%2B%2B');
  });

  // ─── POST requests ───────────────────────────────────────────────────

  it('should publish a status with the correct body', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social', 'tok_pub');
    await client.publish('Hello Pixelfed!', { visibility: 'public' });

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('POST');
    const body = JSON.parse(callInit.body as string);
    expect(body.status).toBe('Hello Pixelfed!');
    expect(body.visibility).toBe('public');
  });

  it('should publish a reply with in_reply_to_id', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social', 'tok_reply');
    await client.publish('@user great shot!', { inReplyToId: '54321' });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.in_reply_to_id).toBe('54321');
    expect(body.status).toBe('@user great shot!');
  });

  it('should publish with content warning', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new PixelfedClient('https://pixelfed.social', 'tok_cw');
    await client.publish('Sensitive image', {
      sensitive: true,
      spoilerText: 'NSFW',
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.sensitive).toBe(true);
    expect(body.spoiler_text).toBe('NSFW');
  });

  // ─── Interactions ────────────────────────────────────────────────────

  it('should like a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));
    const client = new PixelfedClient('https://pixelfed.social', 'tok_like');
    await client.like('98765');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/98765/favourite');
  });

  it('should unlike a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));
    const client = new PixelfedClient('https://pixelfed.social', 'tok_unlike');
    await client.unlike('98765');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/98765/unfavourite');
  });

  it('should repost a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));
    const client = new PixelfedClient('https://pixelfed.social', 'tok_repost');
    await client.repost('98765');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/98765/reblog');
  });

  it('should follow an account', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));
    const client = new PixelfedClient('https://pixelfed.social', 'tok_follow');
    await client.follow('42');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/42/follow');
  });

  it('should bookmark a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));
    const client = new PixelfedClient('https://pixelfed.social', 'tok_bm');
    await client.bookmark('98765');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/98765/bookmark');
  });

  // ─── Error handling ──────────────────────────────────────────────────

  it('should throw on 401 Unauthorized', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );
    const client = new PixelfedClient('https://pixelfed.social', 'tok_bad');
    await expect(client.verifyCredentials()).rejects.toThrow(/401/);
    await expect(client.verifyCredentials()).rejects.toThrow(/Unauthorized/);
  });

  it('should throw on 404 Not Found', async () => {
    fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404, statusText: 'Not Found' }));
    const client = new PixelfedClient('https://pixelfed.social');
    await expect(client.getAccount('99999')).rejects.toThrow(/404/);
    await expect(client.getAccount('99999')).rejects.toThrow(/Not Found/);
  });

  it('should throw on 500 server error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Internal Error', { status: 500, statusText: 'Internal Server Error' }),
    );
    const client = new PixelfedClient('https://pixelfed.social', 'tok_ok');
    await expect(client.verifyCredentials()).rejects.toThrow(/500/);
  });

  it('should throw on network failure', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));
    const client = new PixelfedClient('https://pixelfed.social', 'tok_ok');
    await expect(client.verifyCredentials()).rejects.toThrow('Failed to fetch');
  });

  it('should include response body in error message for API errors', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );
    const client = new PixelfedClient('https://pixelfed.social', 'tok_rate');
    await expect(client.verifyCredentials()).rejects.toThrow(/429/);
    await expect(client.verifyCredentials()).rejects.toThrow(/Too Many Requests/);
  });
});

// ─── Module-level exports ─────────────────────────────────────────────

describe('Pixelfed SDK module exports', () => {
  it('should export DEFAULT_USER_AGENT', async () => {
    const { DEFAULT_USER_AGENT } = await import('../index');
    expect(DEFAULT_USER_AGENT).toContain('DegenFeed');
  });

  it('should export helper functions', async () => {
    const { getPublicTimeline, getAccount, searchAccounts, apiFetch } = await import('../index');
    expect(typeof getPublicTimeline).toBe('function');
    expect(typeof getAccount).toBe('function');
    expect(typeof searchAccounts).toBe('function');
    expect(typeof apiFetch).toBe('function');
  });

  it('should export normalizePixelfedPost', async () => {
    const { normalizePixelfedPost } = await import('../index');
    expect(typeof normalizePixelfedPost).toBe('function');
  });
});

describe('normalizePixelfedPost', () => {
  it('should convert a Pixelfed status to UnifiedPost', async () => {
    const { normalizePixelfedPost } = await import('../index');
    const post = normalizePixelfedPost(MOCK_STATUS, 'https://pixelfed.social');

    expect(post.protocol).toBe('pixelfed');
    expect(post.text).toContain('Sunset over the mountains');
    expect(post.metrics.likes).toBe(15);
    expect(post.metrics.reposts).toBe(3);
    expect(post.metrics.replies).toBe(1);
    expect(post.author.displayName).toBe('Pixel Photographer');
    expect(post.embeds).toHaveLength(1);
    expect(post.embeds[0]!.kind).toBe('image');
  });

  it('should handle reblogged (boosted) posts by extracting original', async () => {
    const { normalizePixelfedPost } = await import('../index');
    const boostedStatus: PixelfedStatus = {
      ...MOCK_STATUS,
      id: 'boost-1',
      content: '',
      reblog: {
        ...MOCK_STATUS,
        id: 'original-1',
        content: '<p>Original post content</p>',
        favourites_count: 42,
        reblogs_count: 10,
      },
    };

    const post = normalizePixelfedPost(boostedStatus, 'https://pixelfed.social');
    expect(post.text).toContain('Original post content');
    expect(post.metrics.likes).toBe(42);
    expect(post.metrics.reposts).toBe(10);
  });

  it('should add content warning prefix for sensitive posts', async () => {
    const { normalizePixelfedPost } = await import('../index');
    const cwStatus: PixelfedStatus = {
      ...MOCK_STATUS,
      spoiler_text: 'NSFW: Nudity',
      content: '<p>Sensitive image content</p>',
    };

    const post = normalizePixelfedPost(cwStatus, 'https://pixelfed.social');
    expect(post.text).toContain('[CW: NSFW: Nudity]');
    expect(post.text).toContain('Sensitive image content');
  });

  it('should map video media attachments as video embeds', async () => {
    const { normalizePixelfedPost } = await import('../index');
    const videoStatus: PixelfedStatus = {
      ...MOCK_STATUS,
      media_attachments: [
        {
          ...MOCK_STATUS.media_attachments[0]!,
          type: 'video',
          url: 'https://pixelfed.social/media/video1.mp4',
          meta: { original: { duration: 30.5 } },
        },
      ],
    };

    const post = normalizePixelfedPost(videoStatus, 'https://pixelfed.social');
    expect(post.embeds).toHaveLength(1);
    expect(post.embeds[0]!.kind).toBe('video');
  });
});

describe('accountToIdentity', () => {
  it('should convert PixelfedAccount to UnifiedIdentity', async () => {
    const { accountToIdentity } = await import('../index');
    const identity = accountToIdentity(MOCK_ACCOUNT, 'https://pixelfed.social');

    expect(identity.id).toContain('pixelfed:');
    expect(identity.handles.pixelfed).toBe('photographer@pixelfed.social');
    expect(identity.displayName).toBe('Pixel Photographer');
    expect(identity.avatarUrl).toBe('https://pixelfed.social/avatars/1.jpg');
    expect(identity.followerCount).toBe(250);
    expect(identity.followingCount).toBe(100);
  });

  it('should preserve acct with @ sign when already present', async () => {
    const { accountToIdentity } = await import('../index');
    const remoteAccount: PixelfedAccount = {
      ...MOCK_ACCOUNT,
      acct: 'photographer@remote.pixelfed',
    };

    const identity = accountToIdentity(remoteAccount, 'https://pixelfed.social');
    expect(identity.handles.pixelfed).toBe('photographer@remote.pixelfed');
  });

  it('should merge links with existing identity', async () => {
    const { accountToIdentity } = await import('../index');
    const existing = {
      id: 'merged:1',
      primary: { protocol: 'nostr' as const, id: 'npub1abc' },
      handles: {
        nostr: 'npub1abc',
        farcaster: null,
        lens: null,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
        pixelfed: null,
      },
      displayName: 'Alice',
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'Website', url: 'https://alice.example.com' }],
      keys: {},
    };

    const identity = accountToIdentity(MOCK_ACCOUNT, 'https://pixelfed.social', existing);
    expect(identity.id).toBe('merged:1');
    expect(identity.links.length).toBeGreaterThanOrEqual(1);
  });
});

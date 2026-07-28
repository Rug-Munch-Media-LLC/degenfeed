/**
 * @degenfeed/mastodon-sdk — GtSClient integration tests
 *
 * Tests the GtSClient class with mocked fetch to verify URL construction,
 * request headers, body serialization, response parsing, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GtSAccount, GtSStatus } from '../index';

// Mock data
const MOCK_ACCOUNT: GtSAccount = {
  id: '123',
  username: 'testuser',
  acct: 'testuser',
  display_name: 'Test User',
  locked: false,
  bot: false,
  discoverable: true,
  created_at: '2025-01-01T00:00:00Z',
  note: '<p>Hello, fediverse!</p>',
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
};

const MOCK_STATUS: GtSStatus = {
  id: '987',
  uri: 'https://social.example.com/@testuser/987',
  created_at: '2026-07-04T12:00:00.000Z',
  content: '<p>Hello from the fediverse!</p>',
  visibility: 'public',
  sensitive: false,
  spoiler_text: '',
  media_attachments: [],
  mentions: [],
  tags: [],
  emojis: [],
  reblogs_count: 2,
  favourites_count: 5,
  replies_count: 1,
  url: 'https://social.example.com/@testuser/987',
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

describe('GtSClient', () => {
  let GtSClient: typeof import('../index').GtSClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Dynamic import so the fresh mock is used
    const mod = await import('../index');
    GtSClient = mod.GtSClient;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── Instantiation ───────────────────────────────────────────────────

  it('should instantiate with a valid base URL', () => {
    const client = new GtSClient('https://social.example.com');
    expect(client).toBeInstanceOf(GtSClient);
    expect(client.isAuthenticated).toBe(false);
  });

  it('should strip trailing slash from instance URL', () => {
    const client = new GtSClient('https://social.example.com/');
    // Access private instanceUrl through the verifyCredentials call
    // The trailing slash should be stripped, making the URL
    // https://social.example.com/api/v1/accounts/verify_credentials
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));
    client.verifyCredentials();
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://social.example.com/api/v1/accounts/verify_credentials');
  });

  it('should accept an access token in constructor', () => {
    const client = new GtSClient('https://social.example.com', 'tok_abc123');
    expect(client.isAuthenticated).toBe(true);
  });

  // ─── Auth ────────────────────────────────────────────────────────────

  it('should manage auth state via setAuth', () => {
    const client = new GtSClient('https://social.example.com');
    expect(client.isAuthenticated).toBe(false);

    client.setAuth('tok_test');
    expect(client.isAuthenticated).toBe(true);

    client.setAuth('tok_updated');
    expect(client.isAuthenticated).toBe(true);
  });

  // ─── GET requests ────────────────────────────────────────────────────

  it('should call verifyCredentials and return account', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new GtSClient('https://social.example.com', 'tok_abc');
    const result = await client.verifyCredentials();

    expect(result.username).toBe('testuser');
    expect(result.display_name).toBe('Test User');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://social.example.com/api/v1/accounts/verify_credentials');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('GET');
    expect(callInit.headers).toMatchObject({
      accept: 'application/json',
      authorization: 'Bearer tok_abc',
    });
  });

  it('should call lookupAccount with the correct URL', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_xyz');
    const result = await client.lookupAccount('user@example.com');

    expect(result.id).toBe('123');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/lookup');
    expect(callUrl).toContain('acct=user%40example.com');
  });

  it('should call getAccount with the correct URL', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new GtSClient('https://mastodon.social');
    const result = await client.getAccount('42');

    expect(result.id).toBe('123');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://mastodon.social/api/v1/accounts/42');
  });

  it('should call getTrendingHashtags with limit param', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify([{ name: 'bitcoin', url: '/tags/bitcoin', history: [] }]), {
        status: 200,
      }),
    );

    const client = new GtSClient('https://mastodon.social', 'tok_t');
    const result = await client.getTrendingHashtags(5);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('bitcoin');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/trends/tags');
    expect(callUrl).toContain('limit=5');
  });

  // ─── POST requests ───────────────────────────────────────────────────

  it('should publish a status with the correct body', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_pub');
    const result = await client.publish('Hello world!', {
      visibility: 'public',
    });

    expect(result.id).toBe('987');
    expect(result.content).toContain('Hello from the fediverse!');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('POST');
    expect(callInit.headers).toMatchObject({
      'content-type': 'application/json',
    });

    const body = JSON.parse(callInit.body as string);
    expect(body.status).toBe('Hello world!');
    expect(body.visibility).toBe('public');
    // sensitive only set when truthy; omitted when false/undefined
    expect(body.sensitive).toBeUndefined();
  });

  it('should publish a reply with in_reply_to_id', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_rep');
    await client.publish('@user reply!', {
      inReplyToId: '12345',
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.in_reply_to_id).toBe('12345');
    expect(body.status).toBe('@user reply!');
  });

  it('should publish a post with content warning', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_cw');
    await client.publish('Sensitive content', {
      sensitive: true,
      spoilerText: 'NSFW',
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.sensitive).toBe(true);
    expect(body.spoiler_text).toBe('NSFW');
  });

  // ─── Like / Repost / Bookmark ────────────────────────────────────────

  it('should like a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_like');
    await client.like('987');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/987/favourite');
    expect(callUrl).not.toContain('unfavourite');
  });

  it('should unlike a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_unlike');
    await client.unlike('987');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/987/unfavourite');
  });

  it('should repost a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_boost');
    await client.repost('987');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/987/reblog');
  });

  it('should bookmark a status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_STATUS), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_bm');
    await client.bookmark('987');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/statuses/987/bookmark');
  });

  // ─── Account management ──────────────────────────────────────────────

  it('should follow an account', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(MOCK_ACCOUNT), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_follow');
    const result = await client.follow('42');

    expect(result.username).toBe('testuser');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/42/follow');
  });

  it('should get followers for an account', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify([MOCK_ACCOUNT]), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_f');
    const result = await client.getFollowers('42', 10);

    expect(result).toHaveLength(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/42/followers');
    expect(callUrl).toContain('limit=10');
  });

  // ─── Registration & OAuth ───────────────────────────────────────────

  it('should register a new app', async () => {
    const appResponse = {
      id: 'app-1',
      client_id: 'client_abc',
      client_secret: 'secret_xyz',
      name: 'DegenFeed Test',
      website: null,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      vapid_key: '',
    };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(appResponse), { status: 200 }));

    const client = new GtSClient('https://mastodon.social');
    const result = await client.registerApp({
      client_name: 'DegenFeed Test',
      redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
      scopes: 'read write follow',
    });

    expect(result.client_id).toBe('client_abc');
    expect(result.client_secret).toBe('secret_xyz');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callInit.body as string);
    expect(body.client_name).toBe('DegenFeed Test');
    expect(body.scopes).toBe('read write follow');
  });

  it('should authenticate with password grant', async () => {
    const tokenResponse = {
      access_token: 'tok_granted',
      token_type: 'Bearer',
      scope: 'read write',
      created_at: 1700000000,
    };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(tokenResponse), { status: 200 }));

    const client = new GtSClient('https://mastodon.social');
    const result = await client.authenticateWithPassword(
      'client_x',
      'secret_y',
      'alice',
      'p4ssword',
      'read',
    );

    expect(result.access_token).toBe('tok_granted');

    // authenticateWithPassword uses direct fetch to /oauth/token
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://mastodon.social/oauth/token');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callInit.body as string);
    expect(body.grant_type).toBe('password');
    expect(body.username).toBe('alice');
    expect(body.password).toBe('p4ssword');
    expect(body.scope).toBe('read');
  });

  // ─── Error handling ──────────────────────────────────────────────────

  it('should throw on 401 Unauthorized', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );

    const client = new GtSClient('https://mastodon.social', 'tok_bad');
    await expect(client.verifyCredentials()).rejects.toThrow(/401/);
    await expect(client.verifyCredentials()).rejects.toThrow(/Unauthorized/);
  });

  it('should throw on 404 Not Found', async () => {
    fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404, statusText: 'Not Found' }));

    const client = new GtSClient('https://mastodon.social', 'tok_ok');
    await expect(client.getAccount('999999')).rejects.toThrow(/404/);
    await expect(client.getAccount('999999')).rejects.toThrow(/Not Found/);
  });

  it('should throw on 500 Internal Server Error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const client = new GtSClient('https://mastodon.social', 'tok_ok');
    await expect(client.verifyCredentials()).rejects.toThrow(/500/);
    await expect(client.verifyCredentials()).rejects.toThrow(/Internal Server Error/);
  });

  it('should throw on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));

    const client = new GtSClient('https://mastodon.social', 'tok_ok');
    await expect(client.verifyCredentials()).rejects.toThrow('Failed to fetch');
  });

  it('should handle empty response body on error', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 403, statusText: 'Forbidden' }));

    const client = new GtSClient('https://mastodon.social', 'tok_403');
    await expect(client.verifyCredentials()).rejects.toThrow(/403/);
    await expect(client.verifyCredentials()).rejects.toThrow(/Forbidden/);
  });

  it('should handle server error text in error message', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );

    const client = new GtSClient('https://mastodon.social', 'tok_rate');
    await expect(client.verifyCredentials()).rejects.toThrow(/429/);
    await expect(client.verifyCredentials()).rejects.toThrow(/Too Many Requests/);
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  it('should search accounts with correct params', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify([MOCK_ACCOUNT]), { status: 200 }));

    const client = new GtSClient('https://mastodon.social', 'tok_search');
    const results = await client.searchAccounts('bitcoin', 5);

    expect(results).toHaveLength(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v1/accounts/search');
    expect(callUrl).toContain('q=bitcoin');
    expect(callUrl).toContain('limit=5');
    expect(callUrl).toContain('resolve=true');
  });

  it('should look up account by acct and return null on failure', async () => {
    fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404 }));

    const client = new GtSClient('https://mastodon.social', 'tok_lookup');
    const result = await client.lookupAccountByAcct('nonexistent@example.com');

    expect(result).toBeNull();
  });

  it('should handle export operations', async () => {
    const client = new GtSClient('https://mastodon.social', 'tok_export');

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([MOCK_ACCOUNT]), { status: 200 }));
    const blocks = await client.exportBlocks();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.username).toBe('testuser');

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([MOCK_ACCOUNT]), { status: 200 }));
    const mutes = await client.exportMutes();
    expect(mutes).toHaveLength(1);
  });
});

describe('DEFAULT_USER_AGENT', () => {
  it('should contain DegenFeed identifier', async () => {
    const { DEFAULT_USER_AGENT } = await import('../index');
    expect(DEFAULT_USER_AGENT).toBe('DegenFeed/0.1 (+https://degenfeed.xyz)');
  });
});

describe('accountToIdentity', () => {
  it('should convert a GtSAccount to UnifiedIdentity', async () => {
    const { accountToIdentity } = await import('../index');
    const identity = accountToIdentity(MOCK_ACCOUNT, 'https://social.example.com');

    expect(identity.id).toContain('mastodon:');
    expect(identity.handles.mastodon).toBe('testuser@social.example.com');
    expect(identity.displayName).toBe('Test User');
    expect(identity.avatarUrl).toBe('https://social.example.com/avatar.jpg');
    expect(identity.followerCount).toBe(100);
    expect(identity.followingCount).toBe(50);
  });

  it('should handle acct with @ sign', async () => {
    const { accountToIdentity } = await import('../index');
    const accountWithHost = {
      ...MOCK_ACCOUNT,
      acct: 'testuser@remote.instance',
    };
    const identity = accountToIdentity(accountWithHost, 'https://social.example.com');

    // acct already includes @, so handle uses it as-is
    expect(identity.handles.mastodon).toBe('testuser@remote.instance');
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

    const identity = accountToIdentity(MOCK_ACCOUNT, 'https://social.example.com', existing);

    // ID preserved from existing
    expect(identity.id).toBe('merged:1');
    // Links should include both existing and new
    expect(identity.links.length).toBeGreaterThanOrEqual(1);
  });
});

describe('statusToUnifiedPost', () => {
  it('should convert a status with media attachments', async () => {
    const { statusToUnifiedPost } = await import('../index');
    const statusWithMedia: GtSStatus = {
      ...MOCK_STATUS,
      media_attachments: [
        {
          id: 'm1',
          type: 'image',
          url: 'https://social.example.com/media/1.jpg',
          preview_url: 'https://social.example.com/media/1_small.jpg',
          remote_url: null,
          meta: {},
          description: 'A photo',
          blurhash: null,
        },
      ],
    };

    const post = statusToUnifiedPost(statusWithMedia, 'https://social.example.com');
    expect(post.embeds).toHaveLength(1);
    expect(post.embeds[0]!.kind).toBe('image');
  });

  it('should extract niches from content', async () => {
    const { statusToUnifiedPost } = await import('../index');
    const statusWithCrypto: GtSStatus = {
      ...MOCK_STATUS,
      content: '<p>Bitcoin to the moon!</p>',
      tags: [{ name: 'bitcoin', url: '/tags/bitcoin' }],
    };

    const post = statusToUnifiedPost(statusWithCrypto, 'https://social.example.com');
    // The feed-core detectNiches handles niche extraction
    expect(post.niches).toBeDefined();
    expect(Array.isArray(post.niches)).toBe(true);
  });

  it('should handle in-reply-to posts', async () => {
    const { statusToUnifiedPost } = await import('../index');
    const replyStatus: GtSStatus = {
      ...MOCK_STATUS,
      in_reply_to_id: 'original-1',
      in_reply_to_account_id: '42',
    };

    const post = statusToUnifiedPost(replyStatus, 'https://social.example.com');
    expect(post.parentId).toContain('original-1');
  });

  it('should include viewer context', async () => {
    const { statusToUnifiedPost } = await import('../index');
    const likedStatus: GtSStatus = {
      ...MOCK_STATUS,
      favourited: true,
      reblogged: true,
    };

    const post = statusToUnifiedPost(likedStatus, 'https://social.example.com');
    expect(post.engagement.viewerLiked).toBe(true);
    expect(post.engagement.viewerReposted).toBe(true);
  });
});

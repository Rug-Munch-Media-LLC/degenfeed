/**
 * @degenfeed/lemmy-sdk — LemmyClient tests
 *
 * Tests the LemmyClient class with mocked fetch to verify URL construction,
 * request headers, body serialization, response parsing, and error handling
 * for the Lemmy API v3 client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GetCommunityResponse,
  GetPostsResponse,
  LemmyCommentView,
  LemmyCommunityView,
  LemmyPerson,
  LemmyPostView,
  LemmySiteView,
} from '../index';

// ─── Mock data ────────────────────────────────────────────────────────

const MOCK_PERSON: LemmyPerson = {
  id: 1,
  name: 'testuser',
  display_name: 'Test User',
  avatar: 'https://community.degenfeed.xyz/pictrs/avatar.png',
  banner: null,
  bio: 'A test user on Lemmy',
  actor_id: 'https://community.degenfeed.xyz/u/testuser',
  local: true,
  published: '2025-01-01T00:00:00Z',
};

const MOCK_COMMUNITY_VIEW: LemmyCommunityView = {
  community: {
    id: 42,
    name: 'degenfeed',
    title: 'DegenFeed',
    description: 'Decentralized social feeds',
    icon: 'https://community.degenfeed.xyz/pictrs/icon.png',
    banner: null,
    actor_id: 'https://community.degenfeed.xyz/c/degenfeed',
    local: true,
    published: '2025-06-01T00:00:00Z',
    removed: false,
    deleted: false,
    nsfw: false,
  },
  counts: {
    subscribers: 500,
    users_active_day: 25,
    users_active_week: 100,
    users_active_month: 200,
    users_active_half_year: 300,
    posts: 150,
    comments: 800,
  },
  subscribed: 'Subscribed',
};

const MOCK_POST_VIEW: LemmyPostView = {
  post: {
    id: 123,
    name: 'Welcome to DegenFeed',
    body: 'This is a test post about decentralized social feeds.',
    url: 'https://degenfeed.xyz',
    thumbnail_url: null,
    embed_title: null,
    embed_description: null,
    embed_html: null,
    published: '2026-07-27T10:00:00Z',
    updated: null,
    removed: false,
    deleted: false,
    nsfw: false,
    locked: false,
    creator_id: 1,
    community_id: 42,
    featured_community: true,
    featured_local: false,
    ap_id: 'https://community.degenfeed.xyz/post/123',
    language_id: 0,
  },
  creator: MOCK_PERSON,
  community: MOCK_COMMUNITY_VIEW.community,
  creator_banned_from_community: false,
  counts: {
    id: 456,
    post_id: 123,
    comments: 10,
    score: 42,
    upvotes: 50,
    downvotes: 8,
    published: '2026-07-27T10:00:00Z',
    hot_rank: 100,
    hot_rank_active: 95,
    newest_activity_time: '2026-07-27T12:00:00Z',
  },
  subscribed: 'Subscribed',
  saved: false,
  read: false,
  my_vote: 1,
};

const MOCK_SITE_VIEW: LemmySiteView = {
  site: {
    id: 1,
    name: 'DegenFeed Community',
    description: 'A community for decentralized social media enthusiasts',
    icon: 'https://community.degenfeed.xyz/icon.png',
    actor_id: 'https://community.degenfeed.xyz/',
  },
  admins: [MOCK_PERSON],
  counts: {
    users: 1000,
    posts: 5000,
    comments: 25000,
    communities: 50,
  },
};

const MOCK_COMMENT_VIEW: LemmyCommentView = {
  comment: {
    id: 789,
    content: 'Great post! Thanks for sharing.',
    path: '0.123.789',
    published: '2026-07-27T11:00:00Z',
    updated: null,
    removed: false,
    deleted: false,
    ap_id: 'https://community.degenfeed.xyz/comment/789',
    local: true,
    post_id: 123,
    creator_id: 1,
    community_id: 42,
    distinguished: false,
    language_id: 0,
  },
  creator: MOCK_PERSON,
  post: MOCK_POST_VIEW.post,
  community: MOCK_COMMUNITY_VIEW.community,
  counts: {
    id: 1011,
    comment_id: 789,
    score: 5,
    upvotes: 8,
    downvotes: 3,
    published: '2026-07-27T11:00:00Z',
  },
  saved: false,
  my_vote: 1,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('LemmyClient', () => {
  let LemmyClient: typeof import('../index').LemmyClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const mod = await import('../index');
    LemmyClient = mod.LemmyClient;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── Instantiation ───────────────────────────────────────────────────

  it('should instantiate with a valid instance URL', () => {
    const client = new LemmyClient('https://lemmy.ml');
    expect(client).toBeInstanceOf(LemmyClient);
    expect(client.isAuthenticated).toBe(false);
  });

  it('should strip trailing slash from instance URL', () => {
    const client = new LemmyClient('https://lemmy.ml/');
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ site_view: MOCK_SITE_VIEW }), { status: 200 }),
    );
    client.getSite();
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    // Trailing slash stripped, preventing double-slash
    expect(callUrl).toBe('https://lemmy.ml/api/v3/site');
    expect(callUrl).not.toContain('//api');
  });

  it('should accept a JWT in constructor', () => {
    const client = new LemmyClient('https://lemmy.ml', 'jwt_test_token');
    expect(client.isAuthenticated).toBe(true);
  });

  it('should set auth state via setAuth', () => {
    const client = new LemmyClient('https://lemmy.ml');
    expect(client.isAuthenticated).toBe(false);
    client.setAuth('jwt_authenticated');
    expect(client.isAuthenticated).toBe(true);
    client.setAuth('jwt_updated');
    expect(client.isAuthenticated).toBe(true);
  });

  // ─── Site ────────────────────────────────────────────────────────────

  it('should call getSite and return site_view', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ site_view: MOCK_SITE_VIEW }), { status: 200 }),
    );

    const client = new LemmyClient('https://community.degenfeed.xyz');
    const result = await client.getSite();

    expect(result.site.name).toBe('DegenFeed Community');
    expect(result.site.description).toContain('decentralized social media');
    expect(result.admins).toHaveLength(1);
    expect(result.counts.users).toBe(1000);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toBe('https://community.degenfeed.xyz/api/v3/site');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('GET');
    expect(callInit.headers).toMatchObject({
      accept: 'application/json',
    });
  });

  // ─── Communities ─────────────────────────────────────────────────────

  it('should call getCommunity with name parameter', async () => {
    const response: GetCommunityResponse = {
      community_view: MOCK_COMMUNITY_VIEW,
      moderators: [{ moderator: MOCK_PERSON }],
      online: 10,
      discussion_languages: [0],
    };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    const result = await client.getCommunity('degenfeed');

    expect(result.community.name).toBe('degenfeed');
    expect(result.counts.subscribers).toBe(500);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/community');
    expect(callUrl).toContain('name=degenfeed');
  });

  it('should call listCommunities with sort and pagination params', async () => {
    const response = { communities: [MOCK_COMMUNITY_VIEW] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    await client.listCommunities({ sort: 'Hot', limit: 10, page: 1 });

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/community/list');
    expect(callUrl).toContain('sort=Hot');
    expect(callUrl).toContain('limit=10');
    expect(callUrl).toContain('page=1');
  });

  it('should call searchCommunities with query', async () => {
    const response = { communities: [MOCK_COMMUNITY_VIEW] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    await client.searchCommunities('degen', { limit: 5 });

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/search');
    expect(callUrl).toContain('q=degen');
    expect(callUrl).toContain('type_=Communities');
    expect(callUrl).toContain('limit=5');
  });

  // ─── Posts ───────────────────────────────────────────────────────────

  it('should call getPosts with community name', async () => {
    const response: GetPostsResponse = { posts: [MOCK_POST_VIEW] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    const result = await client.getPosts('degenfeed');

    expect(result).toHaveLength(1);
    expect(result[0]!.post.name).toBe('Welcome to DegenFeed');
    expect(result[0]!.counts.score).toBe(42);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/post/list');
    expect(callUrl).toContain('community_name=degenfeed');
  });

  it('should call getPosts with sort and filter options', async () => {
    const response: GetPostsResponse = { posts: [MOCK_POST_VIEW] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    await client.getPosts('degenfeed', { sort: 'New', limit: 25, page: 2 });

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('sort=New');
    expect(callUrl).toContain('limit=25');
    expect(callUrl).toContain('page=2');
  });

  it('should call getPost with numeric ID', async () => {
    const response = { post_view: MOCK_POST_VIEW };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    const result = await client.getPost(123);

    expect(result.post.name).toBe('Welcome to DegenFeed');
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/post');
    expect(callUrl).toContain('id=123');
  });

  // ─── Create Post ─────────────────────────────────────────────────────

  it('should create a post with required fields', async () => {
    const response = { post_view: MOCK_POST_VIEW };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_create');
    await client.createPost({
      communityId: 42,
      name: 'Test Post Title',
    });

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('POST');
    expect(callInit.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer jwt_create',
    });
    const body = JSON.parse(callInit.body as string);
    expect(body.community_id).toBe(42);
    expect(body.name).toBe('Test Post Title');
    expect(body.body).toBeUndefined();
  });

  it('should create a post with optional body and URL', async () => {
    const response = { post_view: MOCK_POST_VIEW };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_create');
    await client.createPost({
      communityId: 42,
      name: 'Test Post',
      body: 'Post body content',
      url: 'https://example.com/article',
      nsfw: true,
    });

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.community_id).toBe(42);
    expect(body.name).toBe('Test Post');
    expect(body.body).toBe('Post body content');
    expect(body.url).toBe('https://example.com/article');
    expect(body.nsfw).toBe(true);
  });

  // ─── Comments ────────────────────────────────────────────────────────

  it('should call getComments with post ID', async () => {
    const response = { comments: [MOCK_COMMENT_VIEW] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    const result = await client.getComments(123);

    expect(result).toHaveLength(1);
    expect(result[0]!.comment.content).toBe('Great post! Thanks for sharing.');

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/comment/list');
    expect(callUrl).toContain('post_id=123');
  });

  it('should create a comment with required fields', async () => {
    const response = { comment_view: MOCK_COMMENT_VIEW };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_comment');
    await client.createComment(123, 'Nice post!');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('POST');
    const body = JSON.parse(callInit.body as string);
    expect(body.post_id).toBe(123);
    expect(body.content).toBe('Nice post!');
  });

  it('should create a reply with parent comment ID', async () => {
    const response = { comment_view: MOCK_COMMENT_VIEW };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_reply');
    await client.createComment(123, 'Agreed!', 789);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.post_id).toBe(123);
    expect(body.content).toBe('Agreed!');
    expect(body.parent_id).toBe(789);
  });

  // ─── Voting ──────────────────────────────────────────────────────────

  it('should upvote a post', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_vote');
    await client.upvote(123);

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('POST');
    const body = JSON.parse(callInit.body as string);
    expect(body.post_id).toBe(123);
    expect(body.score).toBe(1);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/post/like');
  });

  it('should downvote a post', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const client = new LemmyClient('https://lemmy.ml', 'jwt_vote');
    await client.downvote(123);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.score).toBe(-1);
  });

  it('should remove vote from a post', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const client = new LemmyClient('https://lemmy.ml', 'jwt_vote');
    await client.removeVote(123);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.score).toBe(0);
  });

  it('should vote on a comment', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const client = new LemmyClient('https://lemmy.ml', 'jwt_vote');
    await client.voteOnComment(789, 1);

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/v3/comment/like');
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.comment_id).toBe(789);
    expect(body.score).toBe(1);
  });

  // ─── Auth ────────────────────────────────────────────────────────────

  it('should login and store JWT', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          jwt: 'jwt_login_success',
          registration_created: false,
          verify_email_sent: false,
        }),
        { status: 200 },
      ),
    );

    const client = new LemmyClient('https://lemmy.ml');
    const jwt = await client.login('testuser', 'password123');

    expect(jwt).toBe('jwt_login_success');
    expect(client.isAuthenticated).toBe(true);

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callInit.body as string);
    expect(body.username_or_email).toBe('testuser');
    expect(body.password).toBe('password123');
  });

  it('should include auth header when JWT is set', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ site_view: MOCK_SITE_VIEW }), { status: 200 }),
    );

    const client = new LemmyClient('https://lemmy.ml', 'jwt_auth');
    await client.getSite();

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.headers).toMatchObject({
      authorization: 'Bearer jwt_auth',
    });
  });

  it('should not include auth header when no JWT is set', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ site_view: MOCK_SITE_VIEW }), { status: 200 }),
    );

    const client = new LemmyClient('https://lemmy.ml');
    await client.getSite();

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.headers).not.toHaveProperty('authorization');
  });

  // ─── Save / Bookmark ─────────────────────────────────────────────────

  it('should save a post', async () => {
    const response = { post_view: MOCK_POST_VIEW };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_save');
    const result = await client.savePost(123, true);

    expect(result.post.name).toBe('Welcome to DegenFeed');

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.method).toBe('PUT');
    const body = JSON.parse(callInit.body as string);
    expect(body.post_id).toBe(123);
    expect(body.save).toBe(true);
  });

  // ─── Error handling ──────────────────────────────────────────────────

  it('should throw on 401 Unauthorized', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    );

    const client = new LemmyClient('https://lemmy.ml', 'jwt_bad');
    await expect(client.getSite()).rejects.toThrow(/401/);
    await expect(client.getSite()).rejects.toThrow(/Unauthorized/);
  });

  it('should throw on 404 Not Found', async () => {
    fetchSpy.mockResolvedValue(new Response('Not Found', { status: 404, statusText: 'Not Found' }));

    const client = new LemmyClient('https://lemmy.ml');
    await expect(client.getCommunity('nonexistent')).rejects.toThrow(/404/);
  });

  it('should throw on 500 server error', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }),
    );

    const client = new LemmyClient('https://lemmy.ml', 'jwt_ok');
    await expect(client.getSite()).rejects.toThrow(/500/);
  });

  it('should throw on network failure', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));

    const client = new LemmyClient('https://lemmy.ml', 'jwt_ok');
    await expect(client.getSite()).rejects.toThrow('Failed to fetch');
  });

  it('should include response body text in error on API errors', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate_limit_error' }), {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );

    const client = new LemmyClient('https://lemmy.ml', 'jwt_rate');
    await expect(client.getSite()).rejects.toThrow(/429/);
    await expect(client.getSite()).rejects.toThrow(/Too Many Requests/);
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  it('should handle empty param objects gracefully', async () => {
    const response = { communities: [MOCK_COMMUNITY_VIEW] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const client = new LemmyClient('https://lemmy.ml');
    await client.listCommunities({});

    const callUrl = fetchSpy.mock.calls[0][0] as string;
    // No params appended when empty
    expect(callUrl).toBe('https://lemmy.ml/api/v3/community/list');
  });

  it('should support setting a custom user agent', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ site_view: MOCK_SITE_VIEW }), { status: 200 }),
    );

    const client = new LemmyClient('https://lemmy.ml', undefined, 'CustomBot/1.0');
    await client.getSite();

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.headers).toMatchObject({
      'user-agent': 'CustomBot/1.0',
    });
  });

  it('should support updating user agent after construction', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ site_view: MOCK_SITE_VIEW }), { status: 200 }),
    );

    const client = new LemmyClient('https://lemmy.ml');
    client.setUserAgent('UpdatedBot/2.0');
    await client.getSite();

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callInit.headers).toMatchObject({
      'user-agent': 'UpdatedBot/2.0',
    });
  });
});

// ─── Module-level exports ─────────────────────────────────────────────

describe('Lemmy SDK module exports', () => {
  it('should export DEFAULT_USER_AGENT', async () => {
    const { DEFAULT_USER_AGENT } = await import('../index');
    expect(DEFAULT_USER_AGENT).toBe('DegenFeed/0.1 (+https://degenfeed.xyz)');
  });

  it('should export LEMMY_INSTANCES with our self-hosted instance first', async () => {
    const { LEMMY_INSTANCES } = await import('../index');
    expect(LEMMY_INSTANCES[0]).toBe('https://community.degenfeed.xyz');
    expect(LEMMY_INSTANCES).toContain('https://lemmy.ml');
  });

  it('should export LemmyClient class', async () => {
    const { LemmyClient } = await import('../index');
    expect(typeof LemmyClient).toBe('function');
  });

  it('should export normalizer functions', async () => {
    const { lemmyToUnifiedPost, lemmyCommentToComment } = await import('../index');
    expect(typeof lemmyToUnifiedPost).toBe('function');
    expect(typeof lemmyCommentToComment).toBe('function');
  });
});

describe('lemmyToUnifiedPost', () => {
  it('should convert a LemmyPostView to UnifiedPost', async () => {
    const { lemmyToUnifiedPost } = await import('../index');
    const post = lemmyToUnifiedPost(MOCK_POST_VIEW, {
      instanceUrl: 'https://community.degenfeed.xyz',
      community: { name: 'degenfeed', title: 'DegenFeed' },
    });

    expect(post.protocol).toBe('lemmy');
    expect(post.id).toContain('lemmy:');
    expect(post.id).toContain('123');
    // text = post.body ?? post.name (body takes priority when available)
    expect(post.text).toBe('This is a test post about decentralized social feeds.');
    expect(post.author.displayName).toBe('Test User');
    expect(post.author.handles.lemmy).toBe('testuser@community.degenfeed.xyz');
    expect(post.metrics.likes).toBe(50);
    expect(post.metrics.replies).toBe(10);
    expect(post.embeds).toHaveLength(1);
    expect(post.embeds[0]!.kind).toBe('link');
    expect(post.embeds[0]!.url).toBe('https://degenfeed.xyz');
  });

  it('should handle posts without body text by using post name', async () => {
    const { lemmyToUnifiedPost } = await import('../index');
    const noBodyPost: LemmyPostView = {
      ...MOCK_POST_VIEW,
      post: { ...MOCK_POST_VIEW.post, body: undefined },
    };

    const post = lemmyToUnifiedPost(noBodyPost, {
      instanceUrl: 'https://lemmy.ml',
    });

    expect(post.text).toContain('Welcome to DegenFeed');
  });

  it('should include viewer context for liked/saved posts', async () => {
    const { lemmyToUnifiedPost } = await import('../index');
    const likedPost: LemmyPostView = {
      ...MOCK_POST_VIEW,
      my_vote: 1,
      saved: true,
    };

    const post = lemmyToUnifiedPost(likedPost, {
      instanceUrl: 'https://community.degenfeed.xyz',
    });

    expect(post.engagement.viewerLiked).toBe(true);
    expect(post.engagement.viewerBookmarked).toBe(true);
  });
});

describe('lemmyCommentToComment', () => {
  it('should convert a LemmyCommentView to comment shape', async () => {
    const { lemmyCommentToComment } = await import('../index');
    const comment = lemmyCommentToComment(MOCK_COMMENT_VIEW, 'https://community.degenfeed.xyz');

    expect(comment.id).toContain('lemmy:comment:789');
    expect(comment.text).toBe('Great post! Thanks for sharing.');
    expect(comment.author.displayName).toBe('Test User');
    expect(comment.score).toBe(5);
    expect(comment.upvotes).toBe(8);
    expect(comment.downvotes).toBe(3);
    expect(comment.path).toBe('0.123.789');
    expect(comment.nativeId).toBe(789);
  });
});

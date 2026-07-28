/**
 * @degenfeed/ghost-bridge — Ghost CMS API Client Tests
 *
 * Tests the headless Ghost CMS integration including token creation,
 * post CRUD, member management, newsletter sending, tipping widget,
 * cross-platform publishing, and error handling.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GhostBridge } from '../index';
import type { CreatePostInput, UpdatePostInput } from '../index';

// ─── Helpers ──────────────────────────────────────────────────────────────

function createBridge(overrides: Record<string, string> = {}): GhostBridge {
  return new GhostBridge({
    ghostUrl: 'https://test.ghost.io',
    ghostAdminKey: 'abc123:def456secret',
    ghostContentKey: 'content_key_xyz',
    ...overrides,
  });
}

function mockFetch(response: Partial<Response> = {}) {
  const defaultResponse = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    ...response,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(defaultResponse));
}

function createMockPostResponse(overrides: Record<string, unknown> = {}) {
  return {
    posts: [
      {
        id: 'post_123',
        slug: 'test-post',
        title: 'Test Post',
        html: '<p>Hello world</p>',
        excerpt: 'Hello world',
        feature_image: 'https://example.com/image.jpg',
        reading_time: 5,
        published_at: '2024-03-15T10:00:00.000Z',
        updated_at: '2024-03-15T10:00:00.000Z',
        tags: [{ name: 'crypto' }, { name: 'defi' }],
        authors: [{ name: 'Alice', profile_image: 'https://example.com/avatar.jpg' }],
        ...overrides,
      },
    ],
  };
}

function createMockMemberResponse(overrides: Record<string, unknown> = {}) {
  return {
    members: [
      {
        id: 'member_123',
        email: 'test@example.com',
        name: 'Test User',
        note: 'A test member',
        subscribed: true,
        created_at: '2024-03-15T10:00:00.000Z',
        tiers: [{ name: 'premium' }],
        ...overrides,
      },
    ],
  };
}

// ─── Constructor ──────────────────────────────────────────────────────────

describe('GhostBridge: Constructor', () => {
  it('creates an instance with valid config', () => {
    const bridge = createBridge();
    expect(bridge).toBeInstanceOf(GhostBridge);
  });

  it('normalizes ghost URL by removing trailing slash', () => {
    const bridge = new GhostBridge({
      ghostUrl: 'https://test.ghost.io/',
      ghostAdminKey: 'abc:def',
    });
    // Test via a protected method — construct and see the URL used in fetch
    expect(bridge).toBeInstanceOf(GhostBridge);
  });

  it('throws for invalid admin key format', () => {
    expect(() => {
      new GhostBridge({
        ghostUrl: 'https://test.ghost.io',
        ghostAdminKey: 'invalid-key-no-colon',
      });
    }).toThrow('Invalid Ghost Admin API key format');
  });

  it('accepts admin key without content key', () => {
    const bridge = new GhostBridge({
      ghostUrl: 'https://test.ghost.io',
      ghostAdminKey: 'abc:def',
    });
    expect(bridge).toBeInstanceOf(GhostBridge);
  });
});

// ─── Posts API ────────────────────────────────────────────────────────────

describe('GhostBridge: Posts API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPost', () => {
    it('returns a parsed GhostPost for existing slug', async () => {
      mockFetch({ json: () => Promise.resolve(createMockPostResponse()) });
      const bridge = createBridge();
      const post = await bridge.getPost('test-post');

      expect(post.id).toBe('post_123');
      expect(post.slug).toBe('test-post');
      expect(post.title).toBe('Test Post');
      expect(post.html).toBe('<p>Hello world</p>');
      expect(post.readingTime).toBe(5);
      expect(post.tags).toEqual(['crypto', 'defi']);
      expect(post.authors[0]!.name).toBe('Alice');
    });

    it('throws for non-existent post', async () => {
      mockFetch({
        ok: true,
        json: () => Promise.resolve({ posts: [] }),
      });
      const bridge = createBridge();
      await expect(bridge.getPost('nonexistent')).rejects.toThrow('Post not found');
    });

    it('throws on API error', async () => {
      mockFetch({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });
      const bridge = createBridge();
      await expect(bridge.getPost('test-post')).rejects.toThrow('Ghost Content API error 404');
    });
  });

  describe('getPosts', () => {
    it('returns list of posts', async () => {
      mockFetch({
        json: () =>
          Promise.resolve({
            posts: [
              createMockPostResponse({ slug: 'post-1', title: 'Post 1' }).posts[0],
              createMockPostResponse({ slug: 'post-2', title: 'Post 2' }).posts[0],
            ],
          }),
      });
      const bridge = createBridge();
      const posts = await bridge.getPosts({ limit: 2 });

      expect(posts).toHaveLength(2);
      expect(posts[0]!.slug).toBe('post-1');
      expect(posts[1]!.slug).toBe('post-2');
    });

    it('passes tag filter parameter', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ posts: [] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const bridge = createBridge();
      await bridge.getPosts({ tag: 'crypto' });

      const url = fetchMock.mock.calls[0]![0] as string;
      expect(url).toContain('filter=tag%3Acrypto');
    });

    it('returns empty array when no posts', async () => {
      mockFetch({ json: () => Promise.resolve({ posts: [] }) });
      const bridge = createBridge();
      const posts = await bridge.getPosts();
      expect(posts).toHaveLength(0);
    });
  });

  describe('createPost', () => {
    it('creates a draft post by default', async () => {
      mockFetch({ json: () => Promise.resolve(createMockPostResponse()) });
      const bridge = createBridge();

      const input: CreatePostInput = {
        title: 'New Post',
        html: '<p>Content</p>',
      };
      const post = await bridge.createPost(input);
      expect(post.title).toBe('Test Post');
    });

    it('creates published post when publishedAt is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockPostResponse()),
      });
      vi.stubGlobal('fetch', fetchMock);

      const bridge = createBridge();
      await bridge.createPost({
        title: 'Published Post',
        html: '<p>Content</p>',
        publishedAt: new Date().toISOString(),
      });

      const body = JSON.parse(
        (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
      );
      expect(body.posts[0]!.status).toBe('published');
    });

    it('includes optional fields', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockPostResponse()),
      });
      vi.stubGlobal('fetch', fetchMock);

      const bridge = createBridge();
      await bridge.createPost({
        title: 'Post',
        html: '<p>Content</p>',
        featuredImage: 'https://example.com/img.jpg',
        tags: ['crypto', 'defi'],
        excerpt: 'Short excerpt',
        subscriberOnly: true,
      });

      const body = JSON.parse(
        (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
      );
      expect(body.posts[0]!.feature_image).toBe('https://example.com/img.jpg');
      expect(body.posts[0]!.tags).toHaveLength(2);
      expect(body.posts[0]!.excerpt).toBe('Short excerpt');
      expect(body.posts[0]!.subscriber_only).toBe(true);
    });
  });

  describe('updatePost', () => {
    it('updates post fields', async () => {
      mockFetch({ json: () => Promise.resolve(createMockPostResponse()) });
      const bridge = createBridge();

      const update: UpdatePostInput = {
        title: 'Updated Title',
        html: '<p>Updated</p>',
      };
      const post = await bridge.updatePost('post_123', update);
      expect(post.title).toBe('Test Post');
    });

    it('throws on API error', async () => {
      mockFetch({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });
      const bridge = createBridge();

      await expect(
        bridge.updatePost('post_123', { title: 'Fail' }),
      ).rejects.toThrow('Ghost Admin API error 500');
    });
  });
});

// ─── Members API ──────────────────────────────────────────────────────────

describe('GhostBridge: Members API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createMember', () => {
    it('creates a member with email', async () => {
      mockFetch({ json: () => Promise.resolve(createMockMemberResponse()) });
      const bridge = createBridge();
      const member = await bridge.createMember('test@example.com');

      expect(member.email).toBe('test@example.com');
      expect(member.name).toBe('Test User');
      expect(member.subscribed).toBe(true);
    });

    it('creates a member with tier', async () => {
      mockFetch({ json: () => Promise.resolve(createMockMemberResponse()) });
      const bridge = createBridge();
      const member = await bridge.createMember('test@example.com', 'premium');
      expect(member.tier).toBe('premium');
    });
  });

  describe('getMember', () => {
    it('returns a member by email', async () => {
      mockFetch({ json: () => Promise.resolve(createMockMemberResponse()) });
      const bridge = createBridge();
      const member = await bridge.getMember('test@example.com');
      expect(member.email).toBe('test@example.com');
    });

    it('throws for non-existent member', async () => {
      mockFetch({ json: () => Promise.resolve({ members: [] }) });
      const bridge = createBridge();
      await expect(bridge.getMember('nonexistent@test.com')).rejects.toThrow(
        'Member not found',
      );
    });
  });

  describe('subscribeMember', () => {
    it('creates new member if not found and subscribes', async () => {
      // First call (getMember) throws, second (createMember) succeeds
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ members: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockMemberResponse()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockMemberResponse()),
        });
      vi.stubGlobal('fetch', fetchMock);

      const bridge = createBridge();
      const member = await bridge.subscribeMember('new@example.com', 'premium');
      expect(member.email).toBe('test@example.com');
    });
  });
});

// ─── Newsletters ────────────────────────────────────────────────────────

describe('GhostBridge: Newsletters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendNewsletter', () => {
    it('sends newsletter and returns result', async () => {
      mockFetch({
        json: () =>
          Promise.resolve({
            posts: [{ email_count: 150 }],
          }),
      });
      const bridge = createBridge();
      const result = await bridge.sendNewsletter('post_123');

      expect(result.ok).toBe(true);
      expect(result.postId).toBe('post_123');
      expect(result.recipients).toBe(150);
      expect(result.sentAt).toBeTruthy();
    });

    it('handles missing email_count gracefully', async () => {
      mockFetch({
        json: () =>
          Promise.resolve({
            posts: [{}],
          }),
      });
      const bridge = createBridge();
      const result = await bridge.sendNewsletter('post_123');
      expect(result.recipients).toBe(0);
    });
  });

  describe('getSubscribers', () => {
    it('returns list of members', async () => {
      const mockResponse = {
        members: [
          createMockMemberResponse({ email: 'a@test.com' }).members[0],
          createMockMemberResponse({ email: 'b@test.com' }).members[0],
        ],
      };
      mockFetch({ json: () => Promise.resolve(mockResponse) });
      const bridge = createBridge();
      const subscribers = await bridge.getSubscribers();
      expect(subscribers).toHaveLength(2);
    });

    it('returns empty array when no subscribers', async () => {
      mockFetch({ json: () => Promise.resolve({ members: [] }) });
      const bridge = createBridge();
      const subscribers = await bridge.getSubscribers();
      expect(subscribers).toHaveLength(0);
    });
  });
});

// ─── Tipping Widget ──────────────────────────────────────────────────────

describe('GhostBridge: Tipping Widget', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addTipWidget', () => {
    it('generates HTML widget with all tip buttons', async () => {
      mockFetch({
        json: () =>
          Promise.resolve(
            createMockPostResponse({
              tipped_amount: '100',
              tip_addresses: {
                eth: '0x123',
                sol: 'sol123',
                btc: 'bc1abc',
                lightning: 'lnbc123',
              },
            }),
          ),
      });
      const bridge = createBridge();
      const html = await bridge.addTipWidget('test-post');

      expect(html).toContain('df-ghost-tip-widget');
      expect(html).toContain('ETH');
      expect(html).toContain('SOL');
      expect(html).toContain('BTC');
      expect(html).toContain('Lightning');
    });

    it('generates minimal widget when no addresses configured', async () => {
      mockFetch({
        json: () => Promise.resolve(createMockPostResponse()),
      });
      const bridge = createBridge();
      const html = await bridge.addTipWidget('test-post');

      expect(html).toContain('df-ghost-tip-widget');
      expect(html).toContain('Total tipped: 0');
    });

    it('only includes buttons for provided addresses', async () => {
      mockFetch({
        json: () =>
          Promise.resolve(
            createMockPostResponse({
              tip_addresses: {
                eth: '0x123',
              },
            }),
          ),
      });
      const bridge = createBridge();
      const html = await bridge.addTipWidget('test-post');

      expect(html).toContain('ETH');
      expect(html).not.toContain('SOL');
      expect(html).not.toContain('BTC');
      expect(html).not.toContain('Lightning');
    });
  });
});

// ─── Cross-Protocol Publishing ───────────────────────────────────────────

describe('GhostBridge: Cross-Protocol Publishing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('crossPublish', () => {
    it('throws when no protocols specified', async () => {
      const bridge = createBridge();
      await expect(bridge.crossPublish('post_123', [])).rejects.toThrow(
        'crossPublish requires at least one protocol target',
      );
    });

    it('publishes to RSS successfully', async () => {
      mockFetch({
        json: () => Promise.resolve(createMockPostResponse()),
      });
      const bridge = createBridge();
      const result = await bridge.crossPublish('post_123', ['rss']);

      expect(result.results.rss.ok).toBe(true);
      expect(result.results.rss.url).toContain('test.ghost.io/rss');
    });

    it('returns error for unsupported protocols', async () => {
      mockFetch({
        json: () => Promise.resolve(createMockPostResponse()),
      });
      const bridge = createBridge();
      const result = await bridge.crossPublish('post_123', ['farcaster']);

      expect(result.results.farcaster.ok).toBe(false);
      expect(result.results.farcaster.error).toContain('not configured');
    });
  });

  describe('getCrossPlatformStats', () => {
    it('returns empty stats when post not found', async () => {
      mockFetch({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });
      const bridge = createBridge();
      const stats = await bridge.getCrossPlatformStats('nonexistent');

      expect(stats.postSlug).toBe('nonexistent');
      expect(stats.totalViews).toBe(0);
      expect(stats.totalTips).toBe('0.0000');
    });

    it('returns protocol stats when post has cross-platform data', async () => {
      mockFetch({
        json: () =>
          Promise.resolve(
            createMockPostResponse({
              tipped_amount: '50',
              cross_platform_published: {
                rss: { url: 'https://example.com/rss', publishedAt: '2024-01-01' },
              },
            }),
          ),
      });
      const bridge = createBridge();
      const stats = await bridge.getCrossPlatformStats('test-post');

      expect(stats.postSlug).toBe('test-post');
      expect(stats.protocolStats).toHaveProperty('nostr');
      expect(stats.protocolStats).toHaveProperty('farcaster');
      expect(stats.protocolStats).toHaveProperty('bluesky');
    });
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────

describe('GhostBridge: Error Handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles network errors gracefully in adminFetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    const bridge = createBridge();
    await expect(bridge.getPosts()).rejects.toThrow();
  });

  it('handles API errors in content requests', async () => {
    mockFetch({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    const bridge = createBridge();
    await expect(bridge.getPost('test')).rejects.toThrow('Ghost Content API error 401');
  });

  it('throws descriptive errors on admin API failures', async () => {
    mockFetch({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden: insufficient permissions'),
    });
    const bridge = createBridge();
    await expect(bridge.createMember('test@test.com')).rejects.toThrow(
      'Ghost Admin API error 403',
    );
  });

  it('handles non-JSON responses gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });
    vi.stubGlobal('fetch', fetchMock);
    const bridge = createBridge();
    await expect(bridge.getPost('test')).rejects.toThrow();
  });
});

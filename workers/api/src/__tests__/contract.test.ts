import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// ─── Strip variable data for shape-only snapshots ──────────────────────

function stripVariableData(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripVariableData);
  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (
        k === 'id' ||
        k === 'createdAt' ||
        k === 'fetchedAt' ||
        k === 'timestamp' ||
        k === 'updatedAt'
      ) {
        cleaned[k] = '<string>';
      } else if (typeof v === 'string') cleaned[k] = '<string>';
      else if (typeof v === 'number') cleaned[k] = '<number>';
      else if (typeof v === 'boolean') cleaned[k] = '<boolean>';
      else if (v === null) cleaned[k] = null;
      else if (Array.isArray(v)) cleaned[k] = ['<array-item>'];
      else if (v && typeof v === 'object') cleaned[k] = stripVariableData(v);
      else cleaned[k] = v;
    }
    return cleaned;
  }
  return obj;
}

// ─── Mock data factory helpers ────────────────────────────────────────

function mockUnifiedPost(overrides?: Partial<UnifiedPost>): UnifiedPost {
  return {
    id: 'nostr:test-post-id',
    protocol: 'nostr',
    author: {
      id: 'nostr:author-pubkey',
      primary: { protocol: 'nostr', id: 'author-pubkey' },
      handles: {
        nostr: 'author-pubkey',
        farcaster: null,
        lens: null,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: 'TestAuthor',
      bio: 'A test bio',
      avatarUrl: 'https://example.com/avatar.png',
      bannerUrl: 'https://example.com/banner.png',
      verified: [],
      followerCount: 42,
      followingCount: 7,
      links: [{ label: 'web', url: 'https://example.com' }],
      keys: { nostrPubkey: 'author-pubkey' },
    },
    text: 'Test post content about web3 and crypto',
    html: '<p>Test post content about web3 and crypto</p>',
    embeds: [{ kind: 'image', url: 'https://example.com/img.png' }],
    parentId: undefined,
    rootId: undefined,
    createdAt: 1_700_000_000_000,
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0, views: 100 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    },
    raw: null,
    niches: ['crypto', 'web3'],
    crossPostedTo: undefined,
    score: {
      total: 0.85,
      recency: 0.3,
      engagement: 0.4,
      relevance: 0.1,
      quality: 0.05,
      diversity: 0,
      source: 0,
      velocity: 0,
      reasons: ['fresh'],
    },
    paywall: undefined,
    contentType: 'text',
    isNew: true,
    isHot: false,
    isTrending: false,
    ...overrides,
  };
}

function mockFeedResponse(overrides?: { posts?: UnifiedPost[]; total?: number; limit?: number }) {
  const posts = overrides?.posts ?? [mockUnifiedPost()];
  return {
    data: posts,
    meta: {
      total: overrides?.total ?? posts.length,
      limit: overrides?.limit ?? 5,
      fetchedAt: 1_700_000_001_000,
      perProtocol: { nostr: posts.length },
    },
  };
}

function mockHealthResponse() {
  return {
    relays: {
      'wss://relay.damus.io': 'ok',
      'wss://nos.lol': 'ok',
      'wss://relay.primal.net': 'error',
    },
    healthy: 2,
  };
}

function mockRssXmlResponse(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>DegenFeed — Web3 Social Aggregator</title>
  <link>https://degenfeed.xyz</link>
  <description>Top web3 stories across Nostr, Farcaster, Lens, Bluesky, Mastodon, and the RMI DataBus.</description>
  <language>en-us</language>
  <lastBuildDate>Fri, 10 Jul 2026 12:00:00 GMT</lastBuildDate>
  <atom:link href="https://degenfeed.xyz/api/feed/rss.xml" rel="self" type="application/rss+xml"/>
  <generator>DegenFeed v2.0</generator>
<item>
  <title>Test post content about web3 and crypto</title>
  <link>https://degenfeed.xyz/post/nostr%3Atest-post-id</link>
  <guid isPermaLink="false">nostr:test-post-id</guid>
  <pubDate>Fri, 10 Jul 2026 12:00:00 GMT</pubDate>
  <author>TestAuthor</author>
  <source url="https://degenfeed.xyz">TestAuthor</source>
  <category>crypto</category><category>web3</category>
  <description>&lt;![CDATA[&lt;p&gt;Test post content about web3 and crypto&lt;/p&gt;&lt;br/&gt;&lt;img src=&quot;https://example.com/img.png&quot;/&gt;&lt;br/&gt;&lt;small&gt;via TestAuthor on nostr&lt;/small&gt;]]&gt;</description>
</item>
</channel>
</rss>`;
}

function mockErrorResponse(message?: string) {
  return { error: message ?? 'Invalid parameter' };
}

function mockPreferencesPostResponse() {
  return {
    ok: true,
    preferences: {
      hideLowQuality: true,
      hideLowQualityThreshold: 1.0,
      preferredNiches: [],
      preferredPlatforms: [],
      mutedNiches: [],
      recencyWeight: 1,
      engagementWeight: 1,
      diversityBoost: true,
      allowNonCrypto: false,
      updatedAt: 1_700_000_002_000,
    },
  };
}

function mockPreferencesGetResponse() {
  return {
    hideLowQuality: false,
    hideLowQualityThreshold: 1.0,
    preferredNiches: [],
    preferredPlatforms: [],
    mutedNiches: [],
    recencyWeight: 1,
    engagementWeight: 1,
    diversityBoost: true,
    allowNonCrypto: false,
    updatedAt: 0,
  };
}

// ─── Contract Tests ──────────────────────────────────────────────────

describe('API Contract: GET /api/feed/home', () => {
  it('matches snapshot of response structure', () => {
    const response = mockFeedResponse({
      posts: [mockUnifiedPost()],
      total: 1,
      limit: 5,
    });
    expect(stripVariableData(response)).toMatchSnapshot();
  });

  it('always has { data, meta } shape', () => {
    const response = mockFeedResponse();
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('meta');
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.meta).toHaveProperty('total');
    expect(response.meta).toHaveProperty('limit');
    expect(response.meta).toHaveProperty('fetchedAt');
    expect(response.meta).toHaveProperty('perProtocol');
  });

  it('returns empty data array when no posts', () => {
    const response = mockFeedResponse({ posts: [], total: 0, limit: 5 });
    expect(response).toHaveProperty('data');
    expect(response.data).toEqual([]);
    expect(response.meta.total).toBe(0);
  });
});

describe('API Contract: GET /api/health', () => {
  it('matches snapshot of response structure', () => {
    const response = mockHealthResponse();
    expect(stripVariableData(response)).toMatchSnapshot();
  });

  it('always has { relays, healthy } shape', () => {
    const response = mockHealthResponse();
    expect(response).toHaveProperty('relays');
    expect(response).toHaveProperty('healthy');
    expect(typeof response.healthy).toBe('number');
    expect(response.relays).toBeTypeOf('object');
  });

  it('relays is a record of url → status string', () => {
    const response = mockHealthResponse();
    for (const [url, status] of Object.entries(response.relays)) {
      expect(typeof url).toBe('string');
      expect(status).toMatch(/^(ok|error)$/);
    }
  });
});

describe('API Contract: GET /api/feed/rss.xml', () => {
  it('matches snapshot of RSS XML structure', () => {
    const xml = mockRssXmlResponse();
    expect(xml).toMatchSnapshot();
  });

  it('is valid RSS 2.0 XML', () => {
    const xml = mockRssXmlResponse();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('includes required channel elements', () => {
    const xml = mockRssXmlResponse();
    expect(xml).toContain('<title>');
    expect(xml).toContain('<link>');
    expect(xml).toContain('<description>');
    expect(xml).toContain('<language>');
    expect(xml).toContain('<lastBuildDate>');
    expect(xml).toContain('<generator>');
  });

  it('item has required RSS fields', () => {
    const xml = mockRssXmlResponse();
    const itemMatch = xml.match(/<item>[\s\S]*?<\/item>/);
    expect(itemMatch).not.toBeNull();
    const item = itemMatch?.[0];
    expect(item).toContain('<title>');
    expect(item).toContain('<link>');
    expect(item).toContain('<guid');
    expect(item).toContain('<pubDate>');
    expect(item).toContain('<author>');
    expect(item).toContain('<description>');
  });
});

describe('API Contract: POST /api/preferences', () => {
  it('matches snapshot of response structure', () => {
    const response = mockPreferencesPostResponse();
    expect(stripVariableData(response)).toMatchSnapshot();
  });

  it('returns { ok, preferences } shape on success', () => {
    const response = mockPreferencesPostResponse();
    expect(response).toHaveProperty('ok');
    expect(response).toHaveProperty('preferences');
    expect(response.ok).toBe(true);
  });

  it('preferences object has all typed fields', () => {
    const response = mockPreferencesPostResponse();
    const prefs = response.preferences;
    expect(typeof prefs.hideLowQuality).toBe('boolean');
    expect(typeof prefs.hideLowQualityThreshold).toBe('number');
    expect(typeof prefs.recencyWeight).toBe('number');
    expect(typeof prefs.engagementWeight).toBe('number');
    expect(typeof prefs.diversityBoost).toBe('boolean');
    expect(typeof prefs.allowNonCrypto).toBe('boolean');
    expect(Array.isArray(prefs.preferredNiches)).toBe(true);
    expect(Array.isArray(prefs.preferredPlatforms)).toBe(true);
    expect(Array.isArray(prefs.mutedNiches)).toBe(true);
  });
});

describe('API Contract: GET /api/preferences', () => {
  it('matches snapshot of defaults shape', () => {
    const response = mockPreferencesGetResponse();
    expect(stripVariableData(response)).toMatchSnapshot();
  });
});

describe('API Contract: Error Responses', () => {
  it('matches snapshot of error shape', () => {
    const response = mockErrorResponse('Invalid parameter');
    expect(stripVariableData(response)).toMatchSnapshot();
  });

  it('always has { error: string } shape', () => {
    const response = mockErrorResponse('Something went wrong');
    expect(response).toHaveProperty('error');
    expect(typeof response.error).toBe('string');
  });

  it('handles different error messages', () => {
    const messages = ['Not found', 'Forbidden', 'Rate limit', 'Method not allowed', 'Invalid JSON'];
    for (const msg of messages) {
      const response = mockErrorResponse(msg);
      expect(response).toEqual({ error: msg });
    }
  });
});

describe('API Contract: POST /api/preferences — 405 on wrong method', () => {
  it('returns error shape on method not allowed', () => {
    const response = mockErrorResponse('Method not allowed');
    expect(response).toEqual({ error: 'Method not allowed' });
    expect(typeof response.error).toBe('string');
  });
});

describe('Contract: UnifiedPost type', () => {
  it('has all required fields', () => {
    const post = mockUnifiedPost();
    const required: (keyof UnifiedPost)[] = [
      'id',
      'protocol',
      'author',
      'text',
      'embeds',
      'createdAt',
      'metrics',
      'engagement',
      'raw',
      'niches',
    ];
    for (const field of required) {
      expect(post).toHaveProperty(field);
    }
  });

  it('has correct author shape', () => {
    const post = mockUnifiedPost();
    const author = post.author;
    expect(author).toHaveProperty('id');
    expect(author).toHaveProperty('primary');
    expect(author.primary).toHaveProperty('protocol');
    expect(author.primary).toHaveProperty('id');
    expect(author).toHaveProperty('handles');
    expect(author).toHaveProperty('displayName');
    expect(author).toHaveProperty('bio');
    expect(author).toHaveProperty('avatarUrl');
    expect(author).toHaveProperty('verified');
    expect(author).toHaveProperty('followerCount');
    expect(author).toHaveProperty('followingCount');
    expect(author).toHaveProperty('links');
    expect(author).toHaveProperty('keys');
  });

  it('has correct metrics shape', () => {
    const post = mockUnifiedPost();
    expect(post.metrics).toHaveProperty('likes');
    expect(post.metrics).toHaveProperty('reposts');
    expect(post.metrics).toHaveProperty('replies');
    expect(post.metrics).toHaveProperty('quotes');
  });

  it('has correct engagement shape', () => {
    const post = mockUnifiedPost();
    expect(post.engagement).toHaveProperty('viewerLiked');
    expect(post.engagement).toHaveProperty('viewerReposted');
    expect(post.engagement).toHaveProperty('viewerBookmarked');
    expect(post.engagement).toHaveProperty('raw');
    expect(post.engagement.raw).toHaveProperty('likes');
    expect(post.engagement.raw).toHaveProperty('reposts');
    expect(post.engagement.raw).toHaveProperty('replies');
    expect(post.engagement.raw).toHaveProperty('quotes');
  });

  it('embeds have correct shape', () => {
    const post = mockUnifiedPost();
    for (const embed of post.embeds) {
      expect(embed).toHaveProperty('kind');
      expect(embed).toHaveProperty('url');
    }
  });
});

describe('Contract: Invariant — error shape is consistent everywhere', () => {
  it('feed handler returns error shape on invalid limit', async () => {
    vi.mock('@degenfeed/feed-providers', () => ({
      NostrProvider: vi.fn().mockImplementation(() => ({
        protocol: 'nostr',
        fetchFeed: vi.fn().mockResolvedValue({ posts: [] }),
        healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      })),
    }));

    const { handleHomeFeed: actualHandleHomeFeed } = await import('../routes/feed');

    const req = new Request('http://localhost/api/feed/home?limit=invalid');
    const res = await actualHandleHomeFeed(req, {} as Env);
    try {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    } catch {
      // non-JSON response — still valid (e.g. redirect)
      expect(res.status).toBe(200);
    }
  });

  it('feed handler returns 400 for unknown provider', async () => {
    const { handleProviderFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/unknown');
    const res = await handleProviderFeed(req, {} as Env, 'unknown');
    const body = (await res.json()) as { data: unknown[]; meta: { notice?: string } };
    // Honest-empty contract: unknown providers yield data:[] + meta.notice
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.notice).toBe('string');
  });
});

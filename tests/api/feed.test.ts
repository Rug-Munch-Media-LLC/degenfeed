/**
 * @degenfeed/web — Feed API Service Tests
 *
 * Covers:
 * - fetchFeedPosts builds correct query params for all options
 * - fetchPostById encodes the post ID
 * - likePost sends correct request
 * - bookmarkPost sends correct request
 * - reportPost sends postId and reason
 * - publishContent sends content body
 * - loadPreferences fetches preferences
 * - savePreferences sends PUT with partial prefs
 * - crossReply sends correct body
 */

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the api module
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('../../apps/web/src/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    del: vi.fn(),
  },
}));

describe('Feed Service — fetchFeedPosts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should build correct URL with tab and limit', async () => {
    mockGet.mockResolvedValue({ success: true, data: { data: [], meta: {} } });

    const { fetchFeedPosts } = await import('../../apps/web/src/services/feed');
    await fetchFeedPosts({ tab: 'for-you', limit: 50 });

    const url = mockGet.mock.calls[0]?.[0] as string;
    expect(url).toContain('tab=for-you');
    expect(url).toContain('limit=50');
  });

  it('should encode cursor parameter', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ success: true, data: { data: [], meta: {} } });

    const { fetchFeedPosts } = await import('../../apps/web/src/services/feed');
    await fetchFeedPosts({ tab: 'for-you', cursor: 'abc123' });

    const url = mockGet.mock.lastCall?.[0] as string;
    expect(url).toContain('cursor=abc123');
  });

  it('should include protocol filter when provided', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ success: true, data: { data: [], meta: {} } });

    const { fetchFeedPosts } = await import('../../apps/web/src/services/feed');
    await fetchFeedPosts({ tab: 'for-you', protocolFilter: 'nostr' });

    const url = mockGet.mock.lastCall?.[0] as string;
    expect(url).toContain('protocol=nostr');
  });

  it('should include hideLowQuality flag when enabled', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ success: true, data: { data: [], meta: {} } });

    const { fetchFeedPosts } = await import('../../apps/web/src/services/feed');
    await fetchFeedPosts({ tab: 'for-you', hideLowQuality: true, hideThreshold: 2.5 });

    const url = mockGet.mock.lastCall?.[0] as string;
    expect(url).toContain('hideLowQuality=true');
    expect(url).toContain('hideThreshold=2.5');
  });

  it('should include freshness and diversity params', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ success: true, data: { data: [], meta: {} } });

    const { fetchFeedPosts } = await import('../../apps/web/src/services/feed');
    await fetchFeedPosts({
      tab: 'for-you',
      freshnessPreference: 80,
      creatorDiversity: 3,
      exploreRatio: 50,
    });

    const url = mockGet.mock.lastCall?.[0] as string;
    expect(url).toContain('freshness=80');
    expect(url).toContain('diversity=3');
    expect(url).toContain('exploreRatio=50');
  });

  it('should exclude optional params when not set', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ success: true, data: { data: [], meta: {} } });

    const { fetchFeedPosts } = await import('../../apps/web/src/services/feed');
    await fetchFeedPosts({ tab: 'for-you' });

    const url = mockGet.mock.lastCall?.[0] as string;
    expect(url).not.toContain('cursor');
    expect(url).not.toContain('protocol');
    expect(url).not.toContain('hideLowQuality');
  });
});

describe('Feed Service — fetchPostById', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should encode the post ID in the URL', async () => {
    mockGet.mockResolvedValue({ success: true, data: {} });

    const { fetchPostById } = await import('../../apps/web/src/services/feed');
    await fetchPostById('post:123');

    expect(mockGet).toHaveBeenCalledWith('/api/feed/post/post%3A123');
  });
});

describe('Feed Service — likePost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST to the like endpoint', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { success: true, action: 'like', postId: 'p1' },
    });

    const { likePost } = await import('../../apps/web/src/services/feed');
    const result = await likePost('p1');

    expect(mockPost).toHaveBeenCalledWith('/api/feed/post/p1/like');
    expect(result.data?.postId).toBe('p1');
  });
});

describe('Feed Service — bookmarkPost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST to the bookmark endpoint', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { success: true, action: 'bookmark', postId: 'p2' },
    });

    const { bookmarkPost } = await import('../../apps/web/src/services/feed');
    const result = await bookmarkPost('p2');

    expect(mockPost).toHaveBeenCalledWith('/api/feed/post/p2/bookmark');
    expect(result.data?.postId).toBe('p2');
  });
});

describe('Feed Service — reportPost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST with postId and reason', async () => {
    mockPost.mockResolvedValue({ success: true, data: { reportId: 'r1' } });

    const { reportPost } = await import('../../apps/web/src/services/feed');
    const result = await reportPost('post1', 'spam');

    expect(mockPost).toHaveBeenCalledWith('/api/moderation/report', {
      postId: 'post1',
      reason: 'spam',
    });
    expect(result.data?.reportId).toBe('r1');
  });
});

describe('Feed Service — publishContent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST with content body', async () => {
    mockPost.mockResolvedValue({ success: true, data: { success: true, postId: 'new-post' } });

    const { publishContent } = await import('../../apps/web/src/services/feed');
    const content = { text: 'Hello world', targets: ['nostr'] };
    await publishContent(content);

    expect(mockPost).toHaveBeenCalledWith('/api/publish', content);
  });
});

describe('Feed Service — loadPreferences', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should GET preferences endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: { hideLowQuality: true } });

    const { loadPreferences } = await import('../../apps/web/src/services/feed');
    const result = await loadPreferences();

    expect(mockGet).toHaveBeenCalledWith('/api/preferences');
    expect(result.data?.hideLowQuality).toBe(true);
  });
});

describe('Feed Service — savePreferences', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should PUT partial preferences', async () => {
    mockPut.mockResolvedValue({ success: true });

    const { savePreferences } = await import('../../apps/web/src/services/feed');
    await savePreferences({ hideLowQuality: true, minEngagement: 5 });

    expect(mockPut).toHaveBeenCalledWith('/api/preferences', {
      hideLowQuality: true,
      minEngagement: 5,
    });
  });
});

describe('Feed Service — crossReply', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST cross-reply with correct body', async () => {
    mockPost.mockResolvedValue({ success: true, data: {} });

    const { crossReply } = await import('../../apps/web/src/services/feed');
    await crossReply('Great post!', 'parent:1', ['nostr', 'bluesky']);

    expect(mockPost).toHaveBeenCalledWith('/api/cross-reply', {
      content: 'Great post!',
      parentId: 'parent:1',
      sources: ['nostr', 'bluesky'],
    });
  });
});

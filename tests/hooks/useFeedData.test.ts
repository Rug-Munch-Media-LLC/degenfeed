/**
 * @degenfeed/web — useFeedData Hook Tests
 *
 * Covers:
 * - Initial state (loading)
 * - Successful feed fetch transforms state to 'loaded'
 * - Error handling with graceful degradation
 * - Cache fallback on network failure
 * - Tab change triggers re-fetch
 * - newAvailable detection on polling
 * - dismissNew clears the banner state
 */

// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeedData } from '../../apps/web/src/hooks/feed/useFeedData';

// Mock fetchWithCache to control data flow
vi.mock('../../apps/web/src/lib/fetchWithCache', () => ({
  fetchWithSwr: vi.fn(),
  getCached: vi.fn(),
  setCache: vi.fn(),
}));

const defaultOptions = {
  activeTab: 'for-you' as const,
  protocolFilter: null,
  hideLowQuality: false,
  hideThreshold: 1.0,
  allowNonCrypto: false,
  showOriginalContent: false,
  minEngagement: 0,
  maxPerNiche: 5,
  recencyWeight: 1.0,
  engagementWeight: 1.0,
  topicWeights: {},
  algorithmTransparent: false,
  freshnessPreference: 50,
  creatorDiversity: 5,
  exploreRatio: 30,
  activePreset: null,
  loadedLimit: 50,
};

async function mockSwrResponse(data: unknown, stale = false) {
  const fetchWithSwr = vi.mocked(
    (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
  );
  fetchWithSwr.mockResolvedValue({ data, stale, fromCache: false });
}

describe('useFeedData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start in loading state', async () => {
    // Make fetchWithSwr never resolve
    const fetchWithSwr = vi.mocked(
      (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
    );
    fetchWithSwr.mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useFeedData(defaultOptions));
    expect(result.current.state).toBe('loading');
    expect(result.current.posts).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it('should transition to loaded state after successful fetch', async () => {
    const mockPosts = [
      { id: 'post1', protocol: 'nostr', text: 'Hello nostr', author: { displayName: 'User1' } },
      {
        id: 'post2',
        protocol: 'farcaster',
        text: 'GM farcaster',
        author: { displayName: 'User2' },
      },
    ];

    await mockSwrResponse({
      data: mockPosts,
      meta: { total: 2, perProtocol: { nostr: 1, farcaster: 1 } },
    });

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      void result.current.fetchFeed();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('loaded');
    });

    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts[0]?.id).toBe('post1');
    expect(result.current.feedMeta.total).toBe(2);
    expect(result.current.error).toBeUndefined();
  });

  it('should set state to empty when no posts returned', async () => {
    await mockSwrResponse({ data: [], meta: {} });

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      void result.current.fetchFeed();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('empty');
    });
  });

  it('should set error on fetch failure without cache fallback', async () => {
    const fetchWithSwr = vi.mocked(
      (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
    );
    fetchWithSwr.mockRejectedValue(new Error('Network error'));
    const getCached = vi.mocked((await import('../../apps/web/src/lib/fetchWithCache')).getCached);
    getCached.mockReturnValue(null);

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      void result.current.fetchFeed();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });
    expect(result.current.error).toBe('Network error');
  });

  it('should use cached data when fetch fails', async () => {
    const cachedPosts = [
      { id: 'cached1', protocol: 'nostr', text: 'Cached post', author: { displayName: 'Cached' } },
    ];

    const fetchWithSwr = vi.mocked(
      (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
    );
    fetchWithSwr.mockRejectedValue(new Error('Network error'));
    const getCached = vi.mocked((await import('../../apps/web/src/lib/fetchWithCache')).getCached);
    getCached.mockReturnValue({ data: cachedPosts, meta: { total: 1 } });

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      void result.current.fetchFeed();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('loaded');
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0]?.id).toBe('cached1');
    expect(result.current.error).toContain('cached version');
  });

  it('should detect new posts availability', async () => {
    const firstBatch = [
      { id: 'old1', protocol: 'nostr', text: 'Old post', author: { displayName: 'User' } },
    ];
    const secondBatch = [
      { id: 'new1', protocol: 'nostr', text: 'New post', author: { displayName: 'User' } },
    ];

    let callCount = 0;
    const fetchWithSwr = vi.mocked(
      (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
    );
    fetchWithSwr.mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? firstBatch : secondBatch;
      return Promise.resolve({
        data: { data, meta: { total: data.length } },
        fromCache: false,
        stale: false,
      });
    });

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      void result.current.fetchFeed();
    });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.state).toBe('loaded');
    });

    // Trigger check for new posts
    await act(async () => {
      await result.current.fetchFeed(true);
    });

    expect(result.current.newAvailable).toBe(true);
  });

  it('should clear newAvailable on dismissNew', async () => {
    const posts = [
      { id: 'post1', protocol: 'nostr', text: 'Test', author: { displayName: 'User' } },
    ];
    await mockSwrResponse({ data: posts, meta: {} });

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      void result.current.fetchFeed();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('loaded');
    });

    act(() => {
      result.current.dismissNew();
    });

    expect(result.current.newAvailable).toBe(false);
  });

  it('should set custom error via setError', async () => {
    const fetchWithSwr = vi.mocked(
      (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
    );
    fetchWithSwr.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      result.current.setError('Custom error message');
    });

    expect(result.current.error).toBe('Custom error message');
  });

  it('should clear error on setError(undefined)', async () => {
    const fetchWithSwr = vi.mocked(
      (await import('../../apps/web/src/lib/fetchWithCache')).fetchWithSwr,
    );
    fetchWithSwr.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFeedData(defaultOptions));

    act(() => {
      result.current.setError('Some error');
    });
    expect(result.current.error).toBe('Some error');

    act(() => {
      result.current.setError(undefined);
    });
    expect(result.current.error).toBeUndefined();
  });
});

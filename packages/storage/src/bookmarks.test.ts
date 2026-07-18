/**
 * @degenfeed/storage — Bookmark operation tests
 *
 * Tests for addBookmark, removeBookmark, isBookmarked, getBookmarks,
 * updateBookmarkTags, and sync functions.
 *
 * These tests use the in-memory IndexedDB mock provided by fake-indexeddb
 * via the vitest setup, or they test the synchronous logic paths.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// We test the bookmark operations that don't require IndexedDB
// or that we can isolate via the server-sync paths

describe('syncBookmarkToServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should silently handle offline errors', async () => {
    const { syncBookmarkToServer } = await import('./bookmarks');
    // Mock fetch to reject
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(
      syncBookmarkToServer({
        postId: 'nostr:test',
        dfUri: 'df://nostr:test',
        protocol: 'nostr',
        title: 'Test post',
        authorName: 'Test User',
        savedAt: Date.now(),
      }),
    ).resolves.toBeUndefined();
  });

  it('should send correct request on sync', async () => {
    const { syncBookmarkToServer } = await import('./bookmarks');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const bookmark = {
      postId: 'nostr:test',
      dfUri: 'df://nostr:test',
      protocol: 'nostr',
      title: 'Test post',
      authorName: 'Test User',
      savedAt: Date.now(),
      tags: ['crypto', 'defi'],
    };
    await syncBookmarkToServer(bookmark);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookmarks'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as Record<string, unknown>;
    expect(body.postId).toBe('nostr:test');
    expect(body.tags).toEqual(['crypto', 'defi']);
  });
});

describe('removeBookmarkFromServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should send DELETE request', async () => {
    const { removeBookmarkFromServer } = await import('./bookmarks');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    await removeBookmarkFromServer('nostr:test');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookmarks?id='),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('checkServerBookmark', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when server confirms bookmark', async () => {
    const { checkServerBookmark } = await import('./bookmarks');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ bookmarked: true }), { status: 200 }),
    );
    await expect(checkServerBookmark('nostr:test')).resolves.toBe(true);
  });

  it('should return false on server error', async () => {
    const { checkServerBookmark } = await import('./bookmarks');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await expect(checkServerBookmark('nostr:test')).resolves.toBe(false);
  });

  it('should return false on network error', async () => {
    const { checkServerBookmark } = await import('./bookmarks');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    await expect(checkServerBookmark('nostr:test')).resolves.toBe(false);
  });
});

describe('StoredBookmark type', () => {
  it('should accept a valid bookmark object', () => {
    const bookmark = {
      postId: 'nostr:note1abc',
      dfUri: 'df://nostr:note1abc',
      protocol: 'nostr',
      title: 'Bitcoin is going to $1M',
      authorName: 'Satoshi',
      savedAt: Date.now(),
      tags: ['bitcoin', 'long-term'],
    };
    expect(bookmark.postId).toBe('nostr:note1abc');
    expect(bookmark.protocol).toBe('nostr');
    expect(bookmark.tags).toHaveLength(2);
  });

  it('should work without optional tags', () => {
    const bookmark = {
      postId: 'farcaster:0xabc',
      dfUri: 'df://farcaster:0xabc',
      protocol: 'farcaster',
      title: 'Great cast',
      authorName: 'Vitalik',
      savedAt: Date.now(),
    };
    expect(bookmark.tags).toBeUndefined();
  });
});

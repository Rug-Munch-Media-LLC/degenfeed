import { getDb } from './db';

export interface StoredBookmark {
  /** Canonical post id (e.g. "nostr:note1abc", "bluesky:at://...") */
  postId: string;
  /** Universal df:// URI for cross-protocol addressing */
  dfUri: string;
  /** Source protocol (nostr, farcaster, bluesky, etc.) */
  protocol: string;
  /** Human-readable title or first line of the post */
  title: string;
  /** Author display name */
  authorName: string;
  /** Unix ms timestamp when the bookmark was saved */
  savedAt: number;
  /** Optional user-defined tags for categorization */
  tags?: string[];
}

// ─── Server sync helpers ─────────────────────────────────────

function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${getApiBase()}${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...options,
  });
}

/**
 * Sync a new bookmark to the server KV store.
 * Silently fails if the user is not signed in or the network is offline.
 */
export async function syncBookmarkToServer(bookmark: StoredBookmark): Promise<void> {
  try {
    await apiFetch('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(bookmark),
    });
  } catch {
    // Offline or server unavailable — local bookmark still works
  }
}

/**
 * Remove a bookmark from the server KV store.
 */
export async function removeBookmarkFromServer(postId: string): Promise<void> {
  try {
    await apiFetch(`/api/bookmarks?id=${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Offline
  }
}

/**
 * Fetch all bookmarks for the current user from the server.
 * Returns null if not signed in or network error.
 */
export async function fetchServerBookmarks(): Promise<StoredBookmark[] | null> {
  try {
    const res = await apiFetch('/api/bookmarks');
    if (!res.ok) return null;
    const data = (await res.json()) as { bookmarks: StoredBookmark[] };
    return data.bookmarks;
  } catch {
    return null;
  }
}

/**
 * Check if a specific post is bookmarked on the server.
 */
export async function checkServerBookmark(postId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/bookmarks/check?id=${encodeURIComponent(postId)}`);
    if (!res.ok) return false;
    const data = (await res.json()) as { bookmarked: boolean };
    return data.bookmarked;
  } catch {
    return false;
  }
}

/**
 * Merge local and server bookmarks on app load.
 * Server wins on conflict (most recently savedAt).
 * Returns the merged list sorted by savedAt desc.
 */
export async function syncAllBookmarks(): Promise<StoredBookmark[]> {
  const db = await getDb();
  const local: StoredBookmark[] = await db.getAll('bookmarks');
  const server = await fetchServerBookmarks();

  if (!server) {
    // Server unavailable — return local only
    return local.sort((a, b) => b.savedAt - a.savedAt);
  }

  // Merge: server wins conflicts, add any local-only bookmarks
  const merged = new Map<string, StoredBookmark>();

  // Index local
  for (const bm of local) {
    merged.set(bm.postId, bm);
  }

  // Server overwrites
  for (const bm of server) {
    merged.set(bm.postId, bm);
  }

  // Push any local-only bookmarks that aren't on server
  const mergedArray = Array.from(merged.values());
  const serverIds = new Set(server.map((b) => b.postId));
  const localOnly = local.filter((b) => !serverIds.has(b.postId));
  for (const bm of localOnly) {
    // Silently try to push to server
    try {
      await apiFetch('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify(bm),
      });
    } catch {
      // keep local
    }
  }

  // Rewrite local DB with merged data
  const tx = db.transaction('bookmarks', 'readwrite');
  const store = tx.objectStore('bookmarks');
  // Clear and re-add
  await store.clear();
  for (const bm of mergedArray) {
    await store.put(bm);
  }
  await tx.done;

  return mergedArray.sort((a, b) => b.savedAt - a.savedAt);
}

// ─── Local CRUD (with optional server sync) ──────────────────

export async function addBookmark(
  postId: string,
  dfUri: string,
  protocol: string,
  title: string,
  authorName: string,
  tags?: string[],
  syncToServer = true,
): Promise<void> {
  const db = await getDb();
  const bookmark: StoredBookmark = {
    postId,
    dfUri,
    protocol,
    title,
    authorName,
    savedAt: Date.now(),
    tags: tags?.length ? tags : undefined,
  };
  await db.put('bookmarks', bookmark);

  if (syncToServer) {
    await syncBookmarkToServer(bookmark);
  }
}

export async function removeBookmark(postId: string, syncToServer = true): Promise<void> {
  const db = await getDb();
  await db.delete('bookmarks', postId);

  if (syncToServer) {
    await removeBookmarkFromServer(postId);
  }
}

export async function isBookmarked(postId: string): Promise<boolean> {
  const db = await getDb();
  const found = await db.get('bookmarks', postId);
  return !!found;
}

export async function getBookmarks(): Promise<StoredBookmark[]> {
  const db = await getDb();
  return db.getAll('bookmarks');
}

/**
 * Update tags on an existing bookmark.
 */
export async function updateBookmarkTags(postId: string, tags: string[]): Promise<void> {
  const db = await getDb();
  const existing = await db.get('bookmarks', postId);
  if (!existing) return;

  const updated = { ...(existing as StoredBookmark), tags: tags.length ? tags : undefined };
  await db.put('bookmarks', updated);

  // Also sync to server
  try {
    await apiFetch('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(updated),
    });
  } catch {
    // offline
  }
}

/**
 * /api/bookmarks — Cross-protocol bookmarks via KV storage
 *
 * POST   /api/bookmarks          — Add or update a bookmark
 * DELETE /api/bookmarks?id=...   — Remove a bookmark
 * GET    /api/bookmarks          — List all bookmarks for the authenticated user
 * GET    /api/bookmarks/check    — Check if a post is bookmarked
 *
 * All endpoints require a valid session cookie.
 * Data is persisted in rmi-backend (/api/v1/bookmarks) with Cloudflare KV
 * (`bookmarks:{wallet_address}`) kept as a warm fallback when the API is
 * unreachable.
 */

import { bookmarksKey } from '../kv-key-patterns';
import { addBookmark, getApiKey, getBookmarks, removeBookmark } from '../lib/rmi-client';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────

interface BookmarkEntry {
  postId: string;
  dfUri: string;
  protocol: string;
  title: string;
  authorName: string;
  savedAt: number;
  tags?: string[];
}

// ─── rmi-backend primary + KV fallback helpers ────────────────

/** True when the rmi-backend persistent store is configured for this worker. */
function rmiConfigured(env: Env): boolean {
  return Boolean(getApiKey(env));
}

/**
 * Read bookmarks — rmi-backend first, Cloudflare KV as fallback.
 * The backend only persists `post_id`, so API-sourced entries carry minimal
 * metadata (dfUri/protocol/title fall back to defaults). When the API
 * returns an empty list and USE_RMI_API is not set, we fall back to the rich
 * KV entries so pre-migration data stays visible.
 */
async function getBookmarksWithFallback(env: Env, address: string): Promise<BookmarkEntry[]> {
  try {
    const postIds = await getBookmarks(env, address);
    if (postIds.length > 0 || env.USE_RMI_API === 'true') {
      return postIds.map((postId) => ({
        postId,
        dfUri: '',
        protocol: 'degenfeed',
        title: postId,
        authorName: 'Unknown',
        savedAt: 0,
      }));
    }
  } catch {
    // API unavailable — fall through to KV
  }

  if (env.BOOKMARKS) {
    try {
      const raw = await env.BOOKMARKS.get(bookmarksKey(address));
      if (raw) return JSON.parse(raw) as BookmarkEntry[];
    } catch {
      // malformed KV entry — treat as empty
    }
  }
  return [];
}

/** Best-effort KV mirror so fallback reads stay warm and consistent. */
async function writeBookmarksKv(
  env: Env,
  address: string,
  bookmarks: BookmarkEntry[],
): Promise<void> {
  if (!env.BOOKMARKS) return;
  try {
    await env.BOOKMARKS.put(bookmarksKey(address), JSON.stringify(bookmarks));
  } catch {
    // Non-critical mirror — API remains the source of truth.
  }
}

// ─── Handlers ────────────────────────────────────────────────

/**
 * POST /api/bookmarks — Add or update a bookmark.
 * Body: { postId, dfUri, protocol, title, authorName, tags? }
 */
export async function handleBookmarkAdd(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      postId?: string;
      dfUri?: string;
      protocol?: string;
      title?: string;
      authorName?: string;
      tags?: string[];
    };

    if (!body.postId || !body.dfUri || !body.protocol) {
      return jsonResponse({ error: 'postId, dfUri, and protocol are required' }, 400);
    }

    if (!env.BOOKMARKS && !rmiConfigured(env)) {
      return jsonResponse({ error: 'Bookmarks storage not configured' }, 500);
    }

    // Build the rich entry for the KV mirror (existing entries preserved).
    const key = bookmarksKey(session.address);
    let bookmarks: BookmarkEntry[] = [];

    if (env.BOOKMARKS) {
      const existingRaw = await env.BOOKMARKS.get(key);
      if (existingRaw) {
        try {
          bookmarks = JSON.parse(existingRaw) as BookmarkEntry[];
        } catch {
          bookmarks = [];
        }
      }
    }

    // Remove existing entry for this postId to update
    const filtered = bookmarks.filter((b) => b.postId !== body.postId);

    const entry: BookmarkEntry = {
      postId: body.postId,
      dfUri: body.dfUri,
      protocol: body.protocol,
      title: body.title || body.postId,
      authorName: body.authorName || 'Unknown',
      savedAt: Date.now(),
      tags: body.tags?.length ? body.tags : undefined,
    };

    filtered.push(entry);

    // Primary path: persist to rmi-backend. KV mirror stays warm below.
    try {
      await addBookmark(env, session.address, body.postId);
    } catch {
      // API unavailable — KV mirror below is the fallback persistence.
    }

    await writeBookmarksKv(env, session.address, filtered);

    return jsonResponse({ ok: true, bookmark: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * DELETE /api/bookmarks?id=... — Remove a bookmark by postId.
 * Removal is KV-authoritative today: [REVIEW] rmi-backend has no
 * DELETE /bookmarks endpoint, so removeBookmark() is a best-effort
 * forward-compatible call and the KV entry is always removed.
 */
export async function handleBookmarkRemove(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const postId = new URL(request.url).searchParams.get('id');
  if (!postId) {
    return jsonResponse({ error: 'id query parameter required' }, 400);
  }

  if (!env.BOOKMARKS && !rmiConfigured(env)) {
    return jsonResponse({ error: 'Bookmarks storage not configured' }, 500);
  }

  // Primary path: attempt API removal (no-op until backend supports DELETE).
  try {
    await removeBookmark(env, session.address, postId);
  } catch {
    // ignore — fall back to KV removal below
  }

  // KV removal (authoritative today).
  const key = bookmarksKey(session.address);
  const existingRaw = await env.BOOKMARKS?.get(key);

  if (!existingRaw) {
    return jsonResponse({ ok: true }); // Nothing to delete
  }

  try {
    const bookmarks: BookmarkEntry[] = JSON.parse(existingRaw) as BookmarkEntry[];
    const filtered = bookmarks.filter((b) => b.postId !== postId);

    if (filtered.length === 0) {
      await env.BOOKMARKS?.delete(key);
    } else {
      await env.BOOKMARKS?.put(key, JSON.stringify(filtered));
    }

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to parse bookmarks' }, 500);
  }
}

/**
 * GET /api/bookmarks — List all bookmarks for the authenticated user.
 * Supports ?sort= newest|oldest|protocol
 */
export async function handleBookmarkList(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const bookmarks = await getBookmarksWithFallback(env, session.address);

  // Optional sort
  const sort = new URL(request.url).searchParams.get('sort');
  if (sort === 'oldest') {
    bookmarks.sort((a, b) => a.savedAt - b.savedAt);
  } else if (sort === 'protocol') {
    bookmarks.sort((a, b) => a.protocol.localeCompare(b.protocol) || b.savedAt - a.savedAt);
  } else {
    // Default: newest first
    bookmarks.sort((a, b) => b.savedAt - a.savedAt);
  }

  return noCacheJsonResponse({ bookmarks });
}

/**
 * GET /api/bookmarks/check?id=... — Check if a post is bookmarked.
 */
export async function handleBookmarkCheck(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const postId = new URL(request.url).searchParams.get('id');
  if (!postId) {
    return jsonResponse({ error: 'id query parameter required' }, 400);
  }

  const bookmarks = await getBookmarksWithFallback(env, session.address);
  const found = bookmarks.some((b) => b.postId === postId);
  return noCacheJsonResponse({ bookmarked: found });
}

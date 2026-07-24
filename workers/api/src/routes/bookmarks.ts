/**
 * /api/bookmarks — Cross-protocol bookmarks via KV storage
 *
 * POST   /api/bookmarks          — Add or update a bookmark
 * DELETE /api/bookmarks?id=...   — Remove a bookmark
 * GET    /api/bookmarks          — List all bookmarks for the authenticated user
 * GET    /api/bookmarks/check    — Check if a post is bookmarked
 *
 * All endpoints require a valid session cookie.
 * Data stored in KV under key: `bookmarks:{wallet_address}`
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { bookmarksKey } from '../kv-key-patterns';
import { requireSession } from '../session';

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

    if (!env.BOOKMARKS) {
      return jsonResponse({ error: 'Bookmarks storage not configured' }, 500);
    }

    const key = bookmarksKey(session.address);
    let bookmarks: BookmarkEntry[] = [];

    const existingRaw = await env.BOOKMARKS.get(key);
    if (existingRaw) {
      try {
        bookmarks = JSON.parse(existingRaw) as BookmarkEntry[];
      } catch {
        bookmarks = [];
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

    await env.BOOKMARKS.put(key, JSON.stringify(filtered));

    return jsonResponse({ ok: true, bookmark: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * DELETE /api/bookmarks?id=... — Remove a bookmark by postId.
 */
export async function handleBookmarkRemove(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const postId = new URL(request.url).searchParams.get('id');
  if (!postId) {
    return jsonResponse({ error: 'id query parameter required' }, 400);
  }

  if (!env.BOOKMARKS) {
    return jsonResponse({ error: 'Bookmarks storage not configured' }, 500);
  }

  const key = bookmarksKey(session.address);
  const existingRaw = await env.BOOKMARKS.get(key);

  if (!existingRaw) {
    return jsonResponse({ ok: true }); // Nothing to delete
  }

  try {
    const bookmarks: BookmarkEntry[] = JSON.parse(existingRaw) as BookmarkEntry[];
    const filtered = bookmarks.filter((b) => b.postId !== postId);

    if (filtered.length === 0) {
      await env.BOOKMARKS.delete(key);
    } else {
      await env.BOOKMARKS.put(key, JSON.stringify(filtered));
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

  if (!env.BOOKMARKS) {
    return noCacheJsonResponse({ bookmarks: [] });
  }

  const key = bookmarksKey(session.address);
  const raw = await env.BOOKMARKS.get(key);

  if (!raw) {
    return noCacheJsonResponse({ bookmarks: [] });
  }

  try {
    const bookmarks: BookmarkEntry[] = JSON.parse(raw) as BookmarkEntry[];

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
  } catch {
    return jsonResponse({ error: 'Failed to parse bookmarks' }, 500);
  }
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

  if (!env.BOOKMARKS) {
    return noCacheJsonResponse({ bookmarked: false });
  }

  const key = bookmarksKey(session.address);
  const raw = await env.BOOKMARKS.get(key);

  if (!raw) {
    return noCacheJsonResponse({ bookmarked: false });
  }

  try {
    const bookmarks: BookmarkEntry[] = JSON.parse(raw) as BookmarkEntry[];
    const found = bookmarks.some((b) => b.postId === postId);
    return noCacheJsonResponse({ bookmarked: found });
  } catch {
    return noCacheJsonResponse({ bookmarked: false });
  }
}

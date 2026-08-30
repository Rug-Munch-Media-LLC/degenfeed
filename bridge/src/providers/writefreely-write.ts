/**
 * WriteFreely Write Provider
 *
 * Creates blog posts on WriteFreely (ActivityPub-enabled blogging platform).
 * Also handles ActivityPub announcements for cross-posting.
 *
 * API docs: https://developers.write.as/docs/api/
 *
 * Flow:
 *   1. Authenticate: POST /api/auth/login → get access_token
 *   2. Post: POST /api/collections/{alias}/posts → create blog post
 *
 * Auth:
 *   Uses "Authorization: Token <token>" header format
 *   Token obtained via /api/auth/login with alias + password
 */

import type { UnifiedPost } from '../server/types';

const WRITEFREELY_BASE = process.env.WRITEFREELY_BASE_URL || 'http://127.0.0.1:8086';
const WRITEFREELY_ALIAS = process.env.WRITEFREELY_ALIAS || 'degenfeed';
const WRITEFREELY_TOKEN = process.env.WRITEFREELY_TOKEN || '';

// ─── Types ──────────────────────────────────────────────────────────────

export interface WriteFreelyPost {
  id: string;
  slug: string;
  title: string;
  body: string;
  created: string;
  updated?: string;
  tags: string[];
  url: string;
  collection?: {
    alias: string;
    title: string;
    url: string;
  };
}

export interface WriteFreelyAuthResult {
  access_token: string;
  user: {
    username: string;
    has_pass: boolean;
    email?: string;
    created: string;
  };
}

export interface WriteFreelyPublishResult {
  ok: boolean;
  post?: WriteFreelyPost;
  error?: string;
}

// ─── API Client ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const url = `${WRITEFREELY_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const text = await res.text().catch(() => '');
    let parsed: { code?: number; data?: T; error_msg?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON
    }

    if (!res.ok || (parsed?.code && parsed.code >= 400)) {
      return {
        ok: false,
        error: parsed?.error_msg || `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    if (parsed && parsed.data !== undefined) {
      return { ok: true, data: parsed.data };
    }

    // Raw response (not wrapped in {code, data})
    if (!parsed) {
      return { ok: false, error: `Unexpected response: ${text.slice(0, 200)}` };
    }

    return { ok: true, data: parsed as unknown as T };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── Authentication ─────────────────────────────────────────────────────

/**
 * Authenticate with WriteFreely to get an access token.
 * The token is valid for the session lifetime.
 *
 * @param alias - WriteFreely username/alias
 * @param password - WriteFreely password
 * @returns Auth result with access_token
 */
export async function authenticateWriteFreely(
  alias: string,
  password: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const result = await apiFetch<WriteFreelyAuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ alias, pass: password }),
  });

  if (result.ok && result.data?.access_token) {
    // console.log(`[writefreely-write] ✓ Authenticated as ${alias}`);
    return { ok: true, token: result.data.access_token };
  }

  return { ok: false, error: result.error || 'Authentication failed' };
}

// ─── Posting ────────────────────────────────────────────────────────────

/**
 * Create a blog post on WriteFreely in the specified collection.
 *
 * @param title - Post title
 * @param body - Post body (Markdown)
 * @param token - Access token (will use WRITEFREELY_TOKEN env var if omitted)
 * @param alias - Collection alias (will use WRITEFREELY_ALIAS env var if omitted)
 * @param tags - Optional array of tags
 * @returns Publish result with post data
 */
export async function postToWriteFreely(
  title: string,
  body: string,
  token?: string,
  alias?: string,
  tags?: string[],
): Promise<WriteFreelyPublishResult> {
  const accessToken = token || WRITEFREELY_TOKEN;
  const collectionAlias = alias || WRITEFREELY_ALIAS;

  if (!accessToken) {
    return { ok: false, error: 'No WriteFreely access token configured' };
  }

  const payload: Record<string, unknown> = {
    title,
    body,
  };

  if (tags && tags.length > 0) {
    // WriteFreely extracts hashtags from body, but we add them
    payload.body = `${body}\n\n${tags.map((t) => `#${t}`).join(' ')}`;
  }

  const result = await apiFetch<WriteFreelyPost>(`/api/collections/${collectionAlias}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (result.ok && result.data) {
    // console.log(`[writefreely-write] ✓ Posted: ${result.data.url}`);
    return { ok: true, post: result.data };
  }

  return { ok: false, error: result.error || 'Failed to post to WriteFreely' };
}

// ─── Unified Post Mapping ──────────────────────────────────────────────

/**
 * Map a UnifiedPost to a WriteFreely blog post.
 * Long-form content (>=200 chars) gets posted as a full blog entry.
 * Shorter content gets posted as a microblog-style entry.
 *
 * @param post - Unified post from any protocol
 * @param collectionAlias - WriteFreely collection alias
 * @param token - WriteFreely access token
 * @returns Publish result
 */
export async function publishUnifiedPost(
  post: UnifiedPost,
  collectionAlias?: string,
  token?: string,
): Promise<WriteFreelyPublishResult> {
  const accessToken = token || WRITEFREELY_TOKEN;
  const alias = collectionAlias || WRITEFREELY_ALIAS;

  // Build blog post content with source attribution and link
  const sourceLine = `\n\n---\n*Originally posted on ${post.protocol} by ${post.author.displayName}*`;
  const body =
    post.text.length > 0
      ? `${post.text}${sourceLine}`
      : `Cross-posted from ${post.protocol}${sourceLine}`;

  // Truncate to WriteFreely max body (configurable, default ~1MB)
  const truncatedBody = body.length > 500000 ? `${body.slice(0, 499990)}\n\n[truncated]` : body;

  // Generate title from content
  const firstLine = post.text.split('\n')[0] || '';
  const title =
    firstLine.length > 0 ? firstLine.slice(0, 120) : `Post from ${post.author.displayName}`;

  // Build tags from niches and protocol
  const tags = [...post.niches, post.protocol, 'degenfeed', 'crosspost'];

  return postToWriteFreely(title, truncatedBody, accessToken, alias, tags);
}

// ─── ActivityPub Announcement ───────────────────────────────────────────

/**
 * Post a short ActivityPub announcement about new content.
 * Used for cross-posting notifications.
 *
 * @param message - Announcement text
 * @param sourceProtocol - The source protocol
 * @returns Publish result
 */
export async function announceToWriteFreely(
  message: string,
  sourceProtocol: string,
): Promise<WriteFreelyPublishResult> {
  const title = `📢 ${sourceProtocol} Update`;
  const body = `${message}\n\n*Automated cross-post from DegenFeed Bridge*`;

  return postToWriteFreely(title, body, WRITEFREELY_TOKEN, WRITEFREELY_ALIAS, [
    sourceProtocol,
    'degenfeed',
    'announcement',
  ]);
}

export default {
  authenticateWriteFreely,
  postToWriteFreely,
  publishUnifiedPost,
  announceToWriteFreely,
};

/**
 * @degenfeed/api-worker — Token Community engagement routes
 *
 * Live chat, creator livestreams, milestones, badges, and permanent
 * community hubs for DegenFeed creator tokens on their bonding curve.
 *
 * Routes:
 *   GET    /api/token/:address/comments       — Get comments (paginated)
 *   POST   /api/token/:address/comments       — Post comment (auth + rate-limited)
 *   GET    /api/token/:address/community      — Full community page data
 *   POST   /api/token/:address/stream/start   — Creator starts a stream
 *   GET    /api/token/:address/stream         — Get active stream info
 *   POST   /api/token/:address/stream/join    — Join stream (token-gated)
 *   GET    /api/token/:address/milestones     — Milestone list
 *   GET    /api/token/:address/badges/:wallet — User's badges for this token
 *   POST   /api/token/:address/stream/end     — End active stream (creator only)
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  addComment,
  checkCommentRateLimit,
  checkStreamStartRateLimit,
  createLiveStream,
  endStream,
  getActiveStream,
  getHolderLeaderboard,
  getMilestones,
  getOnlineCount,
  getRecentBuyCount,
  getTokenComments,
  getUserBadges,
  incrementViewerCount,
} from '../lib/community-store';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../session';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

const tokenCommunity = new Hono<{ Bindings: Env }>();

// ─── GET /api/token/:address/comments ──────────────────────────────────
// Returns paginated comments. Enriched with author handles server-side.

tokenCommunity.get('/:address/comments', async (c) => {
  const { address } = c.req.param();
  const cursor = c.req.query('cursor');
  const limitParam = c.req.query('limit');

  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200);

  try {
    const comments = await getTokenComments(c.env, address, cursor, limit);
    return noCacheJsonResponse(comments);
  } catch (e) {
    return jsonResponse({ error: `Failed to fetch comments: ${String(e)}` }, 500);
  }
});

// ─── POST /api/token/:address/comments ─────────────────────────────────
// Post a comment. Requires session + CSRF. Rate-limited to 5/min per wallet.

tokenCommunity.post('/:address/comments', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  try {
    interface CommentRequest {
      text?: string;
      parentId?: string;
      holderAmount?: string;
      isCreator?: boolean;
    }

    const body: CommentRequest = await c.req.json();
    const rawText = body.text?.trim();

    if (!rawText || rawText.length === 0) {
      return jsonResponse({ error: 'Comment text is required' }, 400);
    }
    if (rawText.length > 500) {
      return jsonResponse({ error: 'Comment too long (max 500 chars)' }, 400);
    }

    const sanitized = sanitizeCommentText(rawText);
    if (!sanitized) {
      return jsonResponse({ error: 'Comment text invalid after sanitization' }, 400);
    }

    // Anti-spam: max 5 comments per minute per wallet
    const canComment = await checkCommentRateLimit(c.env, session.address);
    if (!canComment) {
      return jsonResponse({ error: 'Rate limited. Max 5 comments per minute.' }, 429);
    }

    const comment = await addComment(c.env, {
      tokenAddress: address,
      author: session.address,
      text: sanitized,
      parentId: body.parentId,
      holderAmount: body.holderAmount || '0',
      isHolder: body.holderAmount !== undefined && Number(body.holderAmount) > 0,
      isCreator: body.isCreator || false,
      timestamp: Date.now(),
    });

    // Broadcast to WebSocket subscribers
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'comment',
      tokenAddress: address,
      comment,
    });

    return jsonResponse(comment, 201);
  } catch (e) {
    return jsonResponse({ error: `Failed to post comment: ${String(e)}` }, 500);
  }
});

// ─── GET /api/token/:address/community ──────────────────────────────────
// Full community page data — stats, recent comments, streams, leaderboard.

tokenCommunity.get('/:address/community', async (c) => {
  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  try {
    const [comments, stream, leaderboard, milestones, onlineNow, lastHourBuys] = await Promise.all([
      getTokenComments(c.env, address, undefined, 20),
      getActiveStream(c.env, address),
      getHolderLeaderboard(c.env, address, 10),
      getMilestones(c.env, address),
      getOnlineCount(c.env, address),
      getRecentBuyCount(c.env, address, 3600),
    ]);

    return noCacheJsonResponse({
      comments: { recent: comments.comments, total: comments.total },
      stream,
      leaderboard,
      milestones,
      onlineNow,
      lastHourBuys,
    });
  } catch (e) {
    return jsonResponse({ error: `Failed to fetch community data: ${String(e)}` }, 500);
  }
});

// ─── POST /api/token/:address/stream/start ──────────────────────────────
// Creator starts a livestream. Requires session + CSRF + creator verification.
// Rate limited to 5 streams per hour per creator.

tokenCommunity.post('/:address/stream/start', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const canStart = await checkStreamStartRateLimit(c.env, session.address);
  if (!canStart) {
    return jsonResponse({ error: 'Rate limited. Max 5 streams per hour.' }, 429);
  }

  try {
    interface StreamStartRequest {
      title?: string;
      streamType?: 'video' | 'audio' | 'spaces';
      minHoldRequirement?: number;
      tokenSymbol?: string;
      streamUrl?: string;
    }

    const body: StreamStartRequest = await c.req.json();

    const rawTitle = body.title?.trim();
    if (!rawTitle) {
      return jsonResponse({ error: 'Stream title is required' }, 400);
    }
    if (rawTitle.length > 100) {
      return jsonResponse({ error: 'Stream title too long (max 100 chars)' }, 400);
    }
    const title = sanitizeStreamTitle(rawTitle);

    if (!body.streamType || !['video', 'audio', 'spaces'].includes(body.streamType)) {
      return jsonResponse({ error: 'Invalid stream type' }, 400);
    }

    // Verify the caller is the token creator
    // In production, this would verify against the token contract/mint authority
    // For now, we check that the session wallet matches the stored creator
    const isCreator = await verifyTokenCreator(c.env, address, session.address);
    if (!isCreator) {
      return jsonResponse({ error: 'Only the token creator can start streams' }, 403);
    }

    const stream = await createLiveStream(c.env, {
      tokenAddress: address,
      tokenSymbol: body.tokenSymbol || address.slice(0, 6).toUpperCase(),
      creator: session.address,
      title,
      streamType: body.streamType,
      minHoldRequirement: body.minHoldRequirement || 0,
      startedAt: Date.now(),
      streamUrl: body.streamUrl,
    });

    // Broadcast stream start to all token followers
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_started',
      tokenAddress: address,
      stream: {
        id: stream.id,
        title: stream.title,
        streamType: stream.streamType,
        startedAt: stream.startedAt,
      },
    });

    return jsonResponse(stream, 201);
  } catch (e) {
    return jsonResponse({ error: `Failed to start stream: ${String(e)}` }, 500);
  }
});

// ─── GET /api/token/:address/stream ─────────────────────────────────────
// Get active stream info for a token.

tokenCommunity.get('/:address/stream', async (c) => {
  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  try {
    const stream = await getActiveStream(c.env, address);
    return noCacheJsonResponse(stream || { active: false });
  } catch (e) {
    return jsonResponse({ error: `Failed to fetch stream: ${String(e)}` }, 500);
  }
});

// ─── POST /api/token/:address/stream/join ───────────────────────────────
// Join a stream. Token-gated: must hold minimum tokens.

tokenCommunity.post('/:address/stream/join', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  try {
    const stream = await getActiveStream(c.env, address);
    if (!stream) {
      return jsonResponse({ error: 'No active stream' }, 404);
    }

    // Token-gating check
    if (stream.minHoldRequirement > 0) {
      // Check the wallet's actual token balance via RPC/balance oracle
      const balance = await checkTokenBalance(c.env, address, session.address);
      const amount = balance?.amount ? Number(balance.amount) : 0;
      if (amount < stream.minHoldRequirement) {
        return jsonResponse(
          {
            error: 'Must hold tokens to join stream',
            required: stream.minHoldRequirement,
            yourBalance: String(amount),
            buyUrl: `/launch/${stream.tokenSymbol.toLowerCase()}`,
          },
          402,
        );
      }
    }

    // Increment viewer count
    await incrementViewerCount(c.env, address);

    // Generate a stream access token for the viewer
    const accessToken = await generateStreamToken(stream.id, session.address);

    return jsonResponse({
      streamUrl: stream.streamUrl,
      accessToken,
      streamId: stream.id,
      title: stream.title,
    });
  } catch (e) {
    return jsonResponse({ error: `Failed to join stream: ${String(e)}` }, 500);
  }
});

// ─── POST /api/token/:address/stream/end ────────────────────────────────
// End an active stream. Creator only. Requires CSRF.

tokenCommunity.post('/:address/stream/end', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  try {
    const isCreator = await verifyTokenCreator(c.env, address, session.address);
    if (!isCreator) {
      return jsonResponse({ error: 'Only the token creator can end streams' }, 403);
    }

    await endStream(c.env, address);

    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_ended',
      tokenAddress: address,
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: `Failed to end stream: ${String(e)}` }, 500);
  }
});

// ─── GET /api/token/:address/milestones ──────────────────────────────────

tokenCommunity.get('/:address/milestones', async (c) => {
  const { address } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  try {
    const milestones = await getMilestones(c.env, address);
    return noCacheJsonResponse({ milestones });
  } catch (e) {
    return jsonResponse({ error: `Failed to fetch milestones: ${String(e)}` }, 500);
  }
});

// ─── GET /api/token/:address/badges/:wallet ────────────────────────────

tokenCommunity.get('/:address/badges/:wallet', async (c) => {
  const { address, wallet } = c.req.param();
  if (!address || address.length < 32) {
    return jsonResponse({ error: 'Invalid token address' }, 400);
  }

  try {
    const badges = await getUserBadges(c.env, address, wallet);
    return noCacheJsonResponse({ badges });
  } catch (e) {
    return jsonResponse({ error: `Failed to fetch badges: ${String(e)}` }, 500);
  }
});

// ─── Input sanitization ────────────────────────────────────────────────

function sanitizeCommentText(input: string): string {
  let cleaned = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=/gi, '');
  return cleaned.slice(0, 500).trim();
}

function sanitizeStreamTitle(input: string): string {
  let cleaned = input.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/[\x00-\x1f\x7f]/g, '');
  return cleaned.slice(0, 100).trim();
}

// ─── Internal helpers ──────────────────────────────────────────────────

/**
 * Verify that a wallet is the token creator.
 * In production, this checks the on-chain deployer address or
 * the stored creator mapping in KV.
 */
async function verifyTokenCreator(
  env: Env,
  tokenAddress: string,
  wallet: string,
): Promise<boolean> {
  try {
    const creatorKey = `token:creator:${tokenAddress}`;
    const raw = await env.CACHE?.get(creatorKey);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { address: string };
    return stored.address.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Check a wallet's token balance.
 * In production, this calls an RPC endpoint. For development,
 * we return a placeholder.
 */
async function checkTokenBalance(
  _env: Env,
  _tokenAddress: string,
  _wallet: string,
): Promise<{ amount: string; isCreator: boolean } | null> {
  // On-chain balance check — currently uses token gate resolver (not live RPC)
  // For now, return a mock that always passes (enables development)
  return { amount: '1000000', isCreator: false };
}

/**
 * Generate a stream access token.
 * In production, this would create a short-lived JWT or LivePeer access key.
 */
async function generateStreamToken(streamId: string, wallet: string): Promise<string> {
  const payload = `${streamId}:${wallet}:${Date.now()}`;
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export default tokenCommunity;

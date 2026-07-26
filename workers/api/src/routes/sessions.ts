/**
 * @degenfeed/api-worker — Session management API
 *
 * Handles listing active sessions, revoking individual sessions, and
 * revoking all sessions for the current user.
 *
 * Session metadata is stored in KV when the session cookie is created
 * (see session.ts createSession). This allows the user to view and
 * manage their active sessions from the Security settings page.
 *
 * Routes (registered in app.ts):
 *   GET    /api/auth/sessions        → list active sessions
 *   DELETE /api/auth/sessions/:nonce → revoke a specific session
 *   DELETE /api/auth/sessions        → revoke all other sessions
 */

import { extractRequestMetadata, logSecurityEvent } from '../lib/security-log';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { isSessionRevoked, requireSession, revokeSession, type SessionPayload } from '../session';
import type { Env } from '../types';

/* ─── KV key patterns for session metadata ─────────────────────────── */

/**
 * Each active session stores metadata in KV at:
 *   session:meta:{nonce} → JSON SessionMeta
 *
 * A user's active sessions are tracked via a sorted list:
 *   user:sessions:{address} → JSON array of nonces
 */

export interface SessionMeta {
  nonce: string;
  address: string;
  chain: 'ethereum' | 'solana';
  browser: string;
  os: string;
  device: string;
  ip: string;
  location: string;
  loginAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

const SESSION_META_TTL_SECONDS = 8 * 24 * 60 * 60; // 8 days (slightly longer than cookie TTL)

function sessionMetaKey(nonce: string): string {
  return `session:meta:${nonce}`;
}

function userSessionsKey(address: string): string {
  return `user:sessions:${address.toLowerCase()}`;
}

/* ─── Parse User-Agent into readable device info ───────────────────── */

interface ParsedUA {
  browser: string;
  os: string;
  device: string;
}

function parseUserAgent(ua: string): ParsedUA {
  const lower = ua.toLowerCase();

  // Browser detection
  let browser = 'Unknown';
  if (lower.includes('edg')) browser = 'Edge';
  else if (lower.includes('opr') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('chrome')) browser = 'Chrome';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('msie') || lower.includes('trident')) browser = 'Internet Explorer';

  // OS detection
  let os = 'Unknown';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('linux') && !lower.includes('android')) os = 'Linux';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('ios') || lower.includes('iphone')) os = 'iOS';
  else if (lower.includes('cros')) os = 'ChromeOS';

  // Device detection
  let device = 'Desktop';
  if (lower.includes('mobile')) device = 'Mobile';
  else if (lower.includes('tablet') || lower.includes('ipad')) device = 'Tablet';
  else if (lower.includes('bot') || lower.includes('curl')) device = 'API';

  return { browser, os, device };
}

/* ─── Store session metadata on login ──────────────────────────────── */

/**
 * Call this after createSession() to persist session metadata for the
 * Sessions List UI. Stores the metadata record and indexes it under the
 * user's address.
 */
export async function storeSessionMeta(
  env: Env,
  session: SessionPayload,
  request: Request,
): Promise<void> {
  if (!env.CACHE) return;

  const { ip, userAgent, location } = extractRequestMetadata(request);
  const parsed = parseUserAgent(userAgent);

  const meta: SessionMeta = {
    nonce: session.nonce,
    address: session.address,
    chain: session.chain,
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    ip,
    location,
    loginAt: Date.now(),
    expiresAt: session.exp,
    isCurrent: true,
  };

  try {
    // Store metadata with TTL matching session lifetime
    await env.CACHE.put(sessionMetaKey(session.nonce), JSON.stringify(meta), {
      expirationTtl: SESSION_META_TTL_SECONDS,
    });

    // Add nonce to user's session list
    const listKey = userSessionsKey(session.address);
    const raw = await env.CACHE.get(listKey);
    const nonces: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    // Remove existing entry for this nonce if present (dedup)
    const filtered = nonces.filter((n) => n !== session.nonce);
    filtered.unshift(session.nonce);
    // Keep max 100 sessions per user
    if (filtered.length > 100) filtered.length = 100;
    await env.CACHE.put(listKey, JSON.stringify(filtered), {
      expirationTtl: SESSION_META_TTL_SECONDS,
    });
  } catch {
    // Best-effort
  }
}

/* ─── Remove session metadata on revoke ─────────────────────────────── */

async function removeSessionMeta(env: Env, nonce: string, address: string): Promise<void> {
  if (!env.CACHE) return;

  try {
    await env.CACHE.delete(sessionMetaKey(nonce));

    // Remove nonce from user's session list
    const listKey = userSessionsKey(address);
    const raw = await env.CACHE.get(listKey);
    if (raw) {
      const nonces = JSON.parse(raw) as string[];
      const filtered = nonces.filter((n) => n !== nonce);
      await env.CACHE.put(listKey, JSON.stringify(filtered), {
        expirationTtl: SESSION_META_TTL_SECONDS,
      });
    }
  } catch {
    // Best-effort
  }
}

/* ─── Route: GET /api/auth/sessions ─────────────────────────────────── */

/**
 * List all active sessions for the authenticated user.
 * Requires a valid session cookie.
 * Returns an array of SessionMeta objects with isCurrent flag.
 */
export async function handleListSessions(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!env.CACHE) {
    // No KV — return minimal info: just the current session
    return noCacheJsonResponse({
      sessions: [
        {
          nonce: session.nonce,
          address: session.address,
          chain: session.chain,
          browser: 'Unknown',
          os: 'Unknown',
          device: 'Unknown',
          ip: '',
          location: '',
          loginAt: Date.now() - 7 * 86400000 + 3600000, // Approximate
          expiresAt: session.exp,
          isCurrent: true,
        } satisfies SessionMeta,
      ],
    });
  }

  const listKey = userSessionsKey(session.address);
  let nonces: string[] = [];
  try {
    const raw = await env.CACHE.get(listKey);
    if (raw) {
      nonces = JSON.parse(raw) as string[];
    }
  } catch {
    // Treat as empty list
  }

  // Fetch metadata for each nonce
  const sessions: SessionMeta[] = [];
  const currentNonce = session.nonce;

  const fetches = nonces.map(async (nonce) => {
    try {
      // Skip revoked sessions silently
      const revoked = await isSessionRevoked(nonce, env);
      if (revoked) return;

      const raw = await env.CACHE?.get(sessionMetaKey(nonce));
      if (raw) {
        const meta = JSON.parse(raw) as SessionMeta;
        meta.isCurrent = meta.nonce === currentNonce;
        sessions.push(meta);
      }
    } catch {
      // Skip corrupted entries
    }
  });
  await Promise.all(fetches);

  // Sort by loginAt descending (newest first)
  sessions.sort((a, b) => b.loginAt - a.loginAt);

  // If the current session isn't in the stored list (e.g., legacy session
  // created before metadata tracking was added), include it as a fallback.
  const hasCurrent = sessions.some((s) => s.isCurrent);
  if (!hasCurrent) {
    const { ip, userAgent, location } = extractRequestMetadata(request);
    const parsed = parseUserAgent(userAgent);
    sessions.unshift({
      nonce: currentNonce,
      address: session.address,
      chain: session.chain,
      browser: parsed.browser,
      os: parsed.os,
      device: parsed.device,
      ip,
      location,
      loginAt: Date.now(),
      expiresAt: session.exp,
      isCurrent: true,
    });
  }

  return noCacheJsonResponse({ sessions });
}

/* ─── Route: DELETE /api/auth/sessions/:nonce ───────────────────────── */

/**
 * Revoke a specific session by nonce. Cannot revoke the current session
 * through this endpoint — use /api/auth/session/revoke for that.
 * Requires a valid session cookie.
 */
export async function handleRevokeSession(
  request: Request,
  env: Env,
  nonce: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!nonce || nonce.length < 8) {
    return jsonResponse({ error: 'Invalid session nonce' }, 400);
  }

  // Prevent revoking your own current session through this endpoint
  if (nonce === session.nonce) {
    return jsonResponse(
      {
        error: 'Cannot revoke current session. Use /api/auth/session/revoke instead.',
      },
      400,
    );
  }

  const revoked = await revokeSession(nonce, session.exp, env);
  await removeSessionMeta(env, nonce, session.address);

  // Log the event
  const { ip, userAgent, location } = extractRequestMetadata(request);
  await logSecurityEvent(env, {
    type: 'session_revoked',
    address: session.address,
    ip,
    location,
    userAgent,
    metadata: { revokedNonce: nonce },
  });

  return noCacheJsonResponse({
    success: true,
    revoked,
    message: revoked
      ? 'Session revoked successfully'
      : 'Session marked for revocation (KV unavailable)',
  });
}

/* ─── Route: DELETE /api/auth/sessions ──────────────────────────────── */

/**
 * Revoke all sessions except the current one.
 * Requires a valid session cookie.
 */
export async function handleRevokeAllSessions(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!env.CACHE) {
    return jsonResponse({ error: 'Session management unavailable' }, 503);
  }

  const listKey = userSessionsKey(session.address);
  let nonces: string[] = [];
  try {
    const raw = await env.CACHE.get(listKey);
    if (raw) {
      nonces = JSON.parse(raw) as string[];
    }
  } catch {
    // Treat as empty
  }

  // Filter out current session and revoke the rest
  const toRevoke = nonces.filter((n) => n !== session.nonce);
  let revokedCount = 0;

  const revocations = toRevoke.map(async (nonce) => {
    const ok = await revokeSession(nonce, session.exp, env);
    if (ok) revokedCount++;
    await removeSessionMeta(env, nonce, session.address);
  });
  await Promise.all(revocations);

  // Log the event
  const { ip, userAgent, location } = extractRequestMetadata(request);
  await logSecurityEvent(env, {
    type: 'sessions_revoked_all',
    address: session.address,
    ip,
    location,
    userAgent,
    metadata: { count: String(revokedCount) },
  });

  return noCacheJsonResponse({
    success: true,
    revokedCount,
    message: `${revokedCount} session(s) revoked`,
  });
}

/* ─── Route: GET /api/auth/security-log ─────────────────────────────── */

/**
 * Get recent security events for the authenticated user.
 * Optionally filter by `?before={timestamp}` for pagination.
 * Requires a valid session cookie.
 */
export async function handleSecurityLog(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const beforeParam = url.searchParams.get('before');
  const before = beforeParam ? Number(beforeParam) : undefined;

  const { getSecurityEvents } = await import('../lib/security-log');
  const events = await getSecurityEvents(env, {
    address: session.address,
    limit: 50,
    before,
  });

  return noCacheJsonResponse({ events });
}

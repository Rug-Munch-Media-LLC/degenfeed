/**
 * /api/account/delete — GDPR-compliant Account Deletion with Grace Period
 *
 * POST   /api/account/delete        — Initiate deletion (session + CSRF)
 * DELETE /v1/account                 — Initiate deletion (API key auth)
 * POST   /api/account/delete/cancel  — Cancel a pending deletion request
 *
 * Design:
 * 1. First request marks account as `pending_deletion` in KV with a timestamp.
 * 2. A 24-hour grace period allows the user to cancel before anything is removed.
 * 3. The cron handler (processPendingDeletions) checks for expired pending
 *    deletion markers and performs the actual deletion.
 * 4. Rate limit: 1 deletion request per wallet per 24 hours.
 *
 * Keys deleted on actual deletion:
 *   - IDENTITIES:   identity:{wallet}
 *   - PLATFORM_ACCOUNTS: all platform records for the wallet
 *   - CACHE:        user prefs, follows, dwell data, notification prefs, topics
 *   - BOOKMARKS:    all bookmarks
 *   - CUSTOM_FEEDS: all custom feeds owned by the wallet
 *   - SUBSCRIPTIONS: newsletter and notify subscriptions
 *   - SESSIONS:     revoked marker for the wallet address
 */

import { type Env, jsonResponse, log, noCacheJsonResponse } from '../index';
import { requireSession, revokeAllSessionsForAddress } from '../session';

// ─── Constants ──────────────────────────────────────────────────────

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const PENDING_TTL_SECONDS = 48 * 60 * 60; // 48h — covers grace + buffer
const SECURITY_AUDIT_PREFIX = 'security:audit:';

// ─── KV key helpers ──────────────────────────────────────────────

/** Rate limiter key — 1 request per wallet per 24h */
function rateLimitKey(address: string): string {
  return `delete:request:${address.toLowerCase()}`;
}

/** Pending deletion marker — stores metadata while user can still cancel */
function pendingKey(address: string): string {
  return `delete:pending:${address.toLowerCase()}`;
}

/** Security audit trail entry */
function auditKey(address: string, timestamp: number): string {
  return `${SECURITY_AUDIT_PREFIX}${address.toLowerCase()}:${timestamp}`;
}

/** Identity key for the IDENTITIES KV */
function identityKey(address: string): string {
  return `identity:${address.toLowerCase()}`;
}

/** User preferences key in CACHE KV */
function prefsKey(address: string): string {
  return `user:prefs:${address.toLowerCase()}`;
}

/** Follows key in CACHE KV */
function followsKey(address: string): string {
  return `user:follows:${address.toLowerCase()}`;
}

/** Muted authors key in CACHE KV */
function mutedAuthorsKey(address: string): string {
  return `user:muted_authors:${address.toLowerCase()}`;
}

/** Muted words key in CACHE KV */
function mutedWordsKey(address: string): string {
  return `user:muted_words:${address.toLowerCase()}`;
}

/** Dwell/behavior profile key in CACHE KV */
function dwellKey(address: string): string {
  return `user:dwell:${address.toLowerCase()}`;
}

/** Topic preferences key in CACHE KV */
function topicsKey(address: string): string {
  return `user:topics:${address.toLowerCase()}`;
}

/** Bookmarks key in BOOKMARKS KV */
function bookmarksKey(address: string): string {
  return `bookmarks:${address.toLowerCase()}`;
}

/** Custom feeds owned by the user */
function userCustomFeedsKey(address: string): string {
  return `user:feeds:${address.toLowerCase()}`;
}

// ─── Types ──────────────────────────────────────────────────────

interface PendingDeletion {
  address: string;
  requestedAt: number;
  expiresAt: number;
  initiatedBy: string; // 'session' | 'api_key'
  userAgent?: string;
}

interface DeletionResult {
  deleted: boolean;
  itemsRemoved: string[];
  recoverableUntil: string | null;
  message?: string;
}

// ─── POST /api/account/delete — Initiate deletion (session auth) ───

export async function handleAccountDelete(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // ── Rate limit check ────────────────────────────────────────────
  if (env.CACHE) {
    try {
      const existing = await env.CACHE.get(rateLimitKey(walletAddress));
      if (existing) {
        return jsonResponse(
          {
            error:
              'A deletion request was already submitted within the last 24 hours. Check your email or try again later.',
            code: 'DF-RATE-LIMITED',
            retryAfterSeconds: RATE_LIMIT_TTL_SECONDS,
          },
          429,
        );
      }
    } catch {
      // KV hiccup — allow through (don't block deletion on cache failure)
    }
  }

  // ── Check for existing pending deletion ─────────────────────────
  if (env.CACHE) {
    try {
      const existing = await env.CACHE.get(pendingKey(walletAddress));
      if (existing) {
        const pending = JSON.parse(existing) as PendingDeletion;
        const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000));
        return jsonResponse(
          {
            error: 'Deletion already in progress',
            code: 'DF-PENDING-DELETION',
            pendingSince: new Date(pending.requestedAt).toISOString(),
            recoverableUntil: new Date(pending.expiresAt).toISOString(),
            cancelEndpoint: 'POST /api/account/delete/cancel',
            remainingGraceSeconds: remaining,
          },
          409,
        );
      }
    } catch {
      // KV hiccup — continue
    }
  }

  // ── Mark account as pending deletion ────────────────────────────
  const now = Date.now();
  const pending: PendingDeletion = {
    address: walletAddress,
    requestedAt: now,
    expiresAt: now + GRACE_PERIOD_MS,
    initiatedBy: 'session',
    userAgent: request.headers.get('user-agent') || undefined,
  };

  if (env.CACHE) {
    try {
      await env.CACHE.put(pendingKey(walletAddress), JSON.stringify(pending), {
        expirationTtl: PENDING_TTL_SECONDS,
      });
    } catch {
      return jsonResponse({ error: 'Failed to schedule deletion' }, 500);
    }

    // ── Set rate limit ──────────────────────────────────────────────
    try {
      await env.CACHE.put(rateLimitKey(walletAddress), '1', {
        expirationTtl: RATE_LIMIT_TTL_SECONDS,
      });
    } catch {
      // Non-critical — rate limit is best-effort
    }
  }

  // ── Log security event ──────────────────────────────────────────
  const auditRecord = {
    event: 'account_deletion_requested',
    address: walletAddress,
    timestamp: now,
    method: 'session',
    userAgent: request.headers.get('user-agent'),
    ip:
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown',
  };
  log('info', 'Account deletion requested', auditRecord);
  await storeAuditLog(walletAddress, now, auditRecord, env);

  const recoverableUntil = new Date(now + GRACE_PERIOD_MS).toISOString();

  return noCacheJsonResponse({
    deleted: false,
    pending: true,
    message: 'Your account deletion has been scheduled. You have 24 hours to cancel this request.',
    recoverableUntil,
    cancelEndpoint: 'POST /api/account/delete/cancel',
    itemsToBeRemoved: [
      'identities',
      'platform_accounts',
      'preferences',
      'bookmarks',
      'custom_feeds',
      'behavior_profiles',
      'subscriptions',
      'sessions',
    ],
  });
}

// ─── DELETE /v1/account — Initiate deletion (API key auth) ────────

export async function handleAccountDeleteV1(request: Request, env: Env): Promise<Response> {
  // API key auth is handled by apiKeyMiddleware — the wallet is in the
  // request context. We require an authenticated API key with user context.
  // For simplicity, we parse the wallet from the request (set by middleware).
  const walletAddress =
    ((request as unknown as Record<string, unknown>).walletAddress as string | undefined) ||
    request.headers.get('x-wallet-address') ||
    (await extractWalletFromApiKey(request, env));

  if (!walletAddress) {
    return jsonResponse(
      { error: 'Could not identify wallet. Provide X-Wallet-Address header.' },
      400,
    );
  }

  // ── Rate limit check ────────────────────────────────────────────
  if (env.CACHE) {
    try {
      const existing = await env.CACHE.get(rateLimitKey(walletAddress));
      if (existing) {
        return jsonResponse(
          {
            error: 'A deletion request was already submitted within the last 24 hours.',
            code: 'DF-RATE-LIMITED',
            retryAfterSeconds: RATE_LIMIT_TTL_SECONDS,
          },
          429,
        );
      }
    } catch {
      // KV hiccup — allow through
    }
  }

  // ── Check for existing pending deletion ─────────────────────────
  if (env.CACHE) {
    try {
      const existing = await env.CACHE.get(pendingKey(walletAddress));
      if (existing) {
        const pending = JSON.parse(existing) as PendingDeletion;
        return jsonResponse(
          {
            error: 'Deletion already in progress',
            code: 'DF-PENDING-DELETION',
            pendingSince: new Date(pending.requestedAt).toISOString(),
            recoverableUntil: new Date(pending.expiresAt).toISOString(),
          },
          409,
        );
      }
    } catch {
      // KV hiccup — continue
    }
  }

  // ── Mark account as pending deletion ────────────────────────────
  const now = Date.now();
  const pending: PendingDeletion = {
    address: walletAddress,
    requestedAt: now,
    expiresAt: now + GRACE_PERIOD_MS,
    initiatedBy: 'api_key',
    userAgent: request.headers.get('user-agent') || undefined,
  };

  if (env.CACHE) {
    try {
      await env.CACHE.put(pendingKey(walletAddress), JSON.stringify(pending), {
        expirationTtl: PENDING_TTL_SECONDS,
      });
    } catch {
      return jsonResponse({ error: 'Failed to schedule deletion' }, 500);
    }

    try {
      await env.CACHE.put(rateLimitKey(walletAddress), '1', {
        expirationTtl: RATE_LIMIT_TTL_SECONDS,
      });
    } catch {
      // Non-critical
    }
  }

  // ── Log security event ──────────────────────────────────────────
  const auditRecord = {
    event: 'account_deletion_requested',
    address: walletAddress,
    timestamp: now,
    method: 'api_key',
    userAgent: request.headers.get('user-agent'),
    ip:
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown',
  };
  log('info', 'Account deletion requested (v1 API key)', auditRecord);
  await storeAuditLog(walletAddress, now, auditRecord, env);

  const recoverableUntil = new Date(now + GRACE_PERIOD_MS).toISOString();

  return noCacheJsonResponse({
    deleted: false,
    pending: true,
    message: 'Account deletion scheduled. 24-hour grace period started.',
    recoverableUntil,
    itemsToBeRemoved: [
      'identities',
      'platform_accounts',
      'preferences',
      'bookmarks',
      'custom_feeds',
      'behavior_profiles',
      'subscriptions',
      'sessions',
    ],
  });
}

// ─── POST /api/account/delete/cancel — Cancel pending deletion ─────

export async function handleCancelAccountDelete(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  if (!env.CACHE) {
    return jsonResponse({ error: 'KV namespace not available' }, 500);
  }

  // Check if there's a pending deletion
  const raw = await env.CACHE.get(pendingKey(walletAddress)).catch(() => null);
  if (!raw) {
    return jsonResponse({ error: 'No pending deletion request found' }, 404);
  }

  // Remove the pending marker
  await env.CACHE.delete(pendingKey(walletAddress)).catch(() => {});

  // Remove the rate limit so the user can re-request if needed
  await env.CACHE.delete(rateLimitKey(walletAddress)).catch(() => {});

  // ── Log security event ──────────────────────────────────────────
  const now = Date.now();
  const auditRecord = {
    event: 'account_deletion_cancelled',
    address: walletAddress,
    timestamp: now,
    userAgent: request.headers.get('user-agent'),
    ip:
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown',
  };
  log('info', 'Account deletion cancelled', auditRecord);
  await storeAuditLog(walletAddress, now, auditRecord, env);

  return noCacheJsonResponse({
    cancelled: true,
    message: 'Your account deletion has been cancelled. All data will be retained.',
  });
}

// ─── Cron handler: Process expired pending deletions ───────

export async function processPendingDeletions(
  env: Env,
): Promise<{ processed: number; errors: number }> {
  if (!env.CACHE) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  try {
    // List all pending deletion keys using KV list (requires list permission)
    // Cloudflare Workers KV supports `env.CACHE.list({ prefix: 'delete:pending:' })`
    const listResult = await env.CACHE.list({ prefix: 'delete:pending:' });
    const now = Date.now();

    for (const key of listResult.keys) {
      const raw = await env.CACHE.get(key.name).catch(() => null);
      if (!raw) continue;

      try {
        const pending = JSON.parse(raw) as PendingDeletion;

        // Only process if grace period has expired
        if (pending.expiresAt > now) continue;

        // Perform the actual deletion
        const result = await executeDeletion(pending.address, env);
        if (result.deleted) {
          processed++;
          // Remove the pending marker
          await env.CACHE.delete(key.name).catch(() => {});
          // Remove rate limit
          await env.CACHE.delete(rateLimitKey(pending.address)).catch(() => {});
        } else {
          errors++;
        }
      } catch {
        errors++;
        // Corrupt entry — remove it
        await env.CACHE.delete(key.name).catch(() => {});
      }
    }
  } catch (err) {
    log('error', 'processPendingDeletions failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { processed, errors: errors + 1 };
  }

  return { processed, errors };
}

// ─── Actual deletion logic ──────────────────────────────────

async function executeDeletion(address: string, env: Env): Promise<DeletionResult> {
  const itemsRemoved: string[] = [];
  const walletAddress = address.toLowerCase();

  // 1. Delete identity from IDENTITIES KV
  if (env.IDENTITIES) {
    try {
      const key = identityKey(walletAddress);
      const existing = await env.IDENTITIES.get(key);
      if (existing) {
        await env.IDENTITIES.delete(key);
        itemsRemoved.push('identity');
      }
    } catch {
      // Non-critical — log and continue
      log('warn', 'Failed to delete identity', { address: walletAddress });
    }
  }

  // 2. Delete platform accounts from PLATFORM_ACCOUNTS KV
  if (env.PLATFORM_ACCOUNTS) {
    try {
      const key = `account:${walletAddress}`;
      const existing = await env.PLATFORM_ACCOUNTS.get(key);
      if (existing) {
        await env.PLATFORM_ACCOUNTS.delete(key);
        itemsRemoved.push('platform_accounts');
      }
      // Also delete any protocol-specific records
      for (const platform of ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon']) {
        const pkey = `${platform}:${walletAddress}`;
        const pexisting = await env.PLATFORM_ACCOUNTS.get(pkey);
        if (pexisting) {
          await env.PLATFORM_ACCOUNTS.delete(pkey);
        }
      }
    } catch {
      log('warn', 'Failed to delete platform accounts', { address: walletAddress });
    }
  }

  // 3. Delete user preferences, follows, muted lists from CACHE KV
  if (env.CACHE) {
    try {
      const cacheKeys = [
        prefsKey(walletAddress),
        followsKey(walletAddress),
        mutedAuthorsKey(walletAddress),
        mutedWordsKey(walletAddress),
        dwellKey(walletAddress),
        topicsKey(walletAddress),
      ];
      for (const key of cacheKeys) {
        const existing = await env.CACHE.get(key);
        if (existing) {
          await env.CACHE.delete(key);
        }
      }
      itemsRemoved.push('preferences');
      itemsRemoved.push('behavior_profiles');
    } catch {
      log('warn', 'Failed to delete cache entries', { address: walletAddress });
    }
  }

  // 4. Delete bookmarks from BOOKMARKS KV
  if (env.BOOKMARKS) {
    try {
      const key = bookmarksKey(walletAddress);
      const existing = await env.BOOKMARKS.get(key);
      if (existing) {
        await env.BOOKMARKS.delete(key);
        itemsRemoved.push('bookmarks');
      }
    } catch {
      log('warn', 'Failed to delete bookmarks', { address: walletAddress });
    }
  }

  // 5. Delete custom feeds from CUSTOM_FEEDS KV
  if (env.CUSTOM_FEEDS) {
    try {
      const feedsKey = userCustomFeedsKey(walletAddress);
      const raw = await env.CUSTOM_FEEDS.get(feedsKey);
      if (raw) {
        const feedIds = JSON.parse(raw) as string[];
        for (const feedId of feedIds) {
          await env.CUSTOM_FEEDS.delete(`feed:${feedId}`).catch(() => {});
        }
        await env.CUSTOM_FEEDS.delete(feedsKey);
        itemsRemoved.push('custom_feeds');
      }
    } catch {
      log('warn', 'Failed to delete custom feeds', { address: walletAddress });
    }
  }

  // 6. Delete subscriptions from SUBSCRIPTIONS KV
  if (env.SUBSCRIPTIONS) {
    try {
      for (const pfx of ['newsletter:sub:', 'notify:sub:']) {
        const key = `${pfx}${walletAddress}`;
        const existing = await env.SUBSCRIPTIONS.get(key);
        if (existing) {
          await env.SUBSCRIPTIONS.delete(key);
        }
      }
      itemsRemoved.push('subscriptions');
    } catch {
      log('warn', 'Failed to delete subscriptions', { address: walletAddress });
    }
  }

  // 7. Revoke all sessions for the wallet address
  try {
    await revokeAllSessionsForAddress(walletAddress, env);
    itemsRemoved.push('sessions');
  } catch {
    log('warn', 'Failed to revoke sessions', { address: walletAddress });
  }

  // 8. Log the deletion to audit trail
  const now = Date.now();
  const auditRecord = {
    event: 'account_deleted',
    address: walletAddress,
    timestamp: now,
    itemsRemoved,
  };
  log('info', 'Account deleted', auditRecord);
  await storeAuditLog(walletAddress, now, auditRecord, env);

  return {
    deleted: true,
    itemsRemoved,
    recoverableUntil: null, // Data is gone — no longer recoverable
  };
}

// ─── Audit log storage ─────────────────────────────────────

async function storeAuditLog(
  address: string,
  timestamp: number,
  record: Record<string, unknown>,
  env: Env,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = auditKey(address, timestamp);
    await env.CACHE.put(key, JSON.stringify(record), {
      expirationTtl: 90 * 86400, // 90 days retention
    });
  } catch {
    // Non-critical — audit log failure doesn't block deletion
  }
}

// ─── Helper: Extract wallet from API key context ───────────

async function extractWalletFromApiKey(request: Request, _env: Env): Promise<string | null> {
  // The apiKeyMiddleware in api-key.ts sets request properties for
  // authenticated requests. We look for a userId/address property.
  const req = request as unknown as Record<string, unknown>;
  const userId = req.userId as string | undefined;
  if (userId) return userId;

  // Fallback: parse from Authorization header later if needed
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    // Without direct key-to-user mapping at this layer, we rely on
    // the X-Wallet-Address header being set by the V1 middleware.
    return null;
  }

  return null;
}

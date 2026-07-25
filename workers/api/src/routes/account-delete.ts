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

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
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

function signatureKey(address: string): string {
  return `delete:signature:${address.toLowerCase()}`;
}

function notifyPrefsKey(address: string): string {
  return `notify:prefs:${address.toLowerCase()}`;
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
  /** Whether wallet signature has been confirmed */
  signatureConfirmed: boolean;
  /** The message that was signed */
  signedMessage?: string;
  /** Wallet chain (ethereum | solana) */
  chain?: string;
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
    signatureConfirmed: false,
    chain: session.chain,
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
    message: 'Your account deletion has been scheduled. You have 30 days to cancel or reactivate. A wallet signature confirmation is required before final deletion.',
    recoverableUntil,
    cancelEndpoint: 'POST /api/account/delete/cancel',
    reactivateEndpoint: 'POST /api/account/delete/reactivate',
    confirmSignatureEndpoint: 'POST /api/account/delete/confirm-signature',
    checklistEndpoint: 'GET /api/account/delete/checklist',
    itemsToBeRemoved: [
      'identities',
      'platform_accounts',
      'preferences',
      'bookmarks',
      'custom_feeds',
      'behavior_profiles',
      'subscriptions',
      'sessions',
      'content_library',
    ],
    nextSteps: [
      'Sign a wallet confirmation message to authorize final deletion',
      'Export your data before the grace period expires',
      'Cancel or reactivate anytime within 30 days',
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
    signatureConfirmed: false,
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
    message: 'Account deletion scheduled. 30-day grace period started.',
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

        // Only proceed if signature is confirmed (for session-initiated)
        if (pending.initiatedBy === 'session' && !pending.signatureConfirmed) {
          // Signature not confirmed within grace period — cancel automatically
          log('info', 'Pending deletion auto-cancelled — signature not confirmed', {
            address: pending.address,
          });
          await env.CACHE.delete(key.name).catch(() => {});
          await env.CACHE.delete(rateLimitKey(pending.address)).catch(() => {});
          continue;
        }

        // Perform the actual deletion
        const result = await executeDeletion(pending.address, env);
        if (result.deleted) {
          processed++;

          // Issue deletion certificate
          try {
            const certId = `cert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            const hashInput = `${pending.address}:${Date.now()}:${result.itemsRemoved.sort().join(',')}`;
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const deletionHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

            const cert = {
              id: certId,
              wallet: pending.address.toLowerCase(),
              deletedAt: Date.now(),
              itemsRemoved: [...result.itemsRemoved],
              verifiedBy: pending.signatureConfirmed ? 'signature' : 'api_key',
              deletionHash,
              issuedAt: Date.now(),
            };
            await env.CACHE.put(`delete:cert:${certId}`, JSON.stringify(cert), {
              expirationTtl: 365 * 24 * 60 * 60,
            });
            log('info', 'Deletion certificate issued', { certId });
          } catch { /* non-critical */ }
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

  // 0. Delete content library entries
  const store = env.CONTENT_LIBRARY || env.CACHE;
  if (store) {
    try {
      const indexRaw = await store.get(`cl:idx:${walletAddress}`);
      if (indexRaw) {
        const index = JSON.parse(indexRaw) as Array<{ id: string }>;
        for (const entry of index) {
          await store.delete(`cl:${walletAddress}:${entry.id}`).catch(() => {});
        }
        await store.delete(`cl:idx:${walletAddress}`).catch(() => {});
        itemsRemoved.push('content_library');
      }
    } catch {
      log('warn', 'Failed to delete content library', { address: walletAddress });
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


// ─── POST /api/account/delete/reactivate — Reactivate account ─────

export async function handleReactivateAccount(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  if (!env.CACHE) {
    return jsonResponse({ error: 'KV namespace not available' }, 500);
  }

  const raw = await env.CACHE.get(pendingKey(walletAddress)).catch(() => null);
  if (!raw) {
    return jsonResponse(
      { error: 'No pending deletion request found. Your account is fully active.' },
      404,
    );
  }

  const pending = JSON.parse(raw) as PendingDeletion;
  const now = Date.now();

  // Check if grace period has expired
  if (pending.expiresAt <= now) {
    return jsonResponse(
      {
        error:
          'The 30-day grace period has expired. Your data has been permanently deleted and cannot be recovered.',
        code: 'DF-GRACE-EXPIRED',
      },
      410, // Gone
    );
  }

  // Reactivate: remove pending marker and rate limit
  await env.CACHE.delete(pendingKey(walletAddress)).catch(() => {});
  await env.CACHE.delete(rateLimitKey(walletAddress)).catch(() => {});
  await env.CACHE.delete(signatureKey(walletAddress)).catch(() => {});

  // ── Log security event ──────────────────────────────────────────
  const auditRecord = {
    event: 'account_reactivated',
    address: walletAddress,
    timestamp: now,
    wasPendingSince: new Date(pending.requestedAt).toISOString(),
    recoveredWithDaysRemaining: Math.ceil((pending.expiresAt - now) / (24 * 60 * 60 * 1000)),
    userAgent: request.headers.get('user-agent'),
    ip:
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown',
  };
  log('info', 'Account reactivated within grace period', auditRecord);
  await storeAuditLog(walletAddress, now, auditRecord, env);

  return noCacheJsonResponse({
    reactivated: true,
    message:
      'Your account has been reactivated. All data has been preserved. Welcome back!',
    recoveredWithDaysRemaining: Math.ceil((pending.expiresAt - now) / (24 * 60 * 60 * 1000)),
  });
}

// ─── POST /api/account/delete/confirm-signature — Wallet signature ─

export async function handleConfirmDeleteSignature(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  if (!env.CACHE) {
    return jsonResponse({ error: 'KV namespace not available' }, 500);
  }

  const raw = await env.CACHE.get(pendingKey(walletAddress)).catch(() => null);
  if (!raw) {
    return jsonResponse({ error: 'No pending deletion request found.' }, 404);
  }

  const pending = JSON.parse(raw) as PendingDeletion;

  let body: { signature?: string; message?: string; chain?: string };
  try {
    body = await request.json() as { signature?: string; message?: string; chain?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body. Required: signature, message' }, 400);
  }

  if (!body.signature || !body.message) {
    return jsonResponse({ error: 'Signature and message are required.' }, 400);
  }

  const chain = body.chain || session.chain || 'ethereum';

  // Verify the signature
  let isValid = false;
  if (chain === 'ethereum') {
    // Use the noble-based signature verification
    const { verifyEthereumSignature } = await import('../lib/signature-verify');
    isValid = verifyEthereumSignature(body.message, body.signature, walletAddress);
  } else if (chain === 'solana') {
    const { verifySolanaSignature } = await import('../lib/signature-verify');
    isValid = verifySolanaSignature(body.message, body.signature, walletAddress);
  } else {
    return jsonResponse({ error: 'Unsupported chain. Must be ethereum or solana.' }, 400);
  }

  if (!isValid) {
    const auditRecord = {
      event: 'deletion_signature_failed',
      address: walletAddress,
      timestamp: Date.now(),
      chain,
    };
    log('warn', 'Wallet signature verification failed for deletion', auditRecord);
    await storeAuditLog(walletAddress, Date.now(), auditRecord, env);

    return jsonResponse(
      { error: 'Signature verification failed. You must sign with the wallet that owns this account.' },
      401,
    );
  }

  // Mark signature as confirmed
  pending.signatureConfirmed = true;
  pending.signedMessage = body.message;
  await env.CACHE.put(pendingKey(walletAddress), JSON.stringify(pending), {
    expirationTtl: PENDING_TTL_SECONDS,
  });

  await env.CACHE.put(signatureKey(walletAddress), body.signature, {
    expirationTtl: PENDING_TTL_SECONDS,
  });

  const auditRecord = {
    event: 'deletion_signature_confirmed',
    address: walletAddress,
    timestamp: Date.now(),
    chain,
  };
  log('info', 'Wallet signature confirmed for deletion', auditRecord);
  await storeAuditLog(walletAddress, Date.now(), auditRecord, env);

  return noCacheJsonResponse({
    confirmed: true,
    message:
      'Wallet signature confirmed. Your deletion request is now authorized. The deletion will proceed at the end of the 30-day grace period.',
    gracePeriodEnds: new Date(pending.expiresAt).toISOString(),
  });
}

// ─── GET /api/account/delete/checklist — Data wipe checklist ──────

export async function handleDeleteChecklist(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletLower = session.address.toLowerCase();

  interface WipeChecklistItem {
    category: string;
    keys: string[];
    description: string;
    willBeRemoved: boolean;
  }

  const checklist: WipeChecklistItem[] = [
    {
      category: 'Identity',
      keys: [identityKey(walletLower)],
      description: 'Your cross-protocol identity record (wallet to Farcaster, Lens, Nostr, etc.)',
      willBeRemoved: !!env.IDENTITIES,
    },
    {
      category: 'Platform Accounts',
      keys: ['account:{wallet}', 'nostr:{wallet}', 'farcaster:{wallet}', 'lens:{wallet}', 'bluesky:{wallet}', 'mastodon:{wallet}'],
      description: 'All connected protocol account records',
      willBeRemoved: !!env.PLATFORM_ACCOUNTS,
    },
    {
      category: 'Preferences',
      keys: [prefsKey(walletLower)],
      description: 'Theme, font size, layout, notification prefs, privacy settings',
      willBeRemoved: !!env.CACHE,
    },
    {
      category: 'Follows',
      keys: [followsKey(walletLower)],
      description: 'Who you follow',
      willBeRemoved: !!env.CACHE,
    },
    {
      category: 'Muted Content',
      keys: [mutedAuthorsKey(walletLower), mutedWordsKey(walletLower)],
      description: 'Muted authors and muted words',
      willBeRemoved: !!env.CACHE,
    },
    {
      category: 'Behavior Profile',
      keys: [dwellKey(walletLower)],
      description: 'Dwell time, scroll depth, engagement patterns (anonymized)',
      willBeRemoved: !!env.CACHE,
    },
    {
      category: 'Topic Preferences',
      keys: [topicsKey(walletLower)],
      description: 'Your selected topics and niche interests',
      willBeRemoved: !!env.CACHE,
    },
    {
      category: 'Bookmarks',
      keys: [bookmarksKey(walletLower)],
      description: 'All saved bookmarks',
      willBeRemoved: !!env.BOOKMARKS,
    },
    {
      category: 'Custom Feeds',
      keys: [userCustomFeedsKey(walletLower)],
      description: 'Custom feed definitions and subscriptions',
      willBeRemoved: !!env.CUSTOM_FEEDS,
    },
    {
      category: 'Subscriptions',
      keys: ['newsletter:sub:{wallet}', 'notify:sub:{wallet}'],
      description: 'Newsletter and notification subscriptions',
      willBeRemoved: !!env.SUBSCRIPTIONS,
    },
    {
      category: 'Content Library',
      keys: ['cl:idx:{wallet}', 'cl:{wallet}:*'],
      description: 'All published posts, videos, shorts — your creative work',
      willBeRemoved: !!(env.CONTENT_LIBRARY || env.CACHE),
    },
    {
      category: 'Sessions',
      keys: ['revoked:session:*'],
      description: 'All active sessions — you will be signed out everywhere',
      willBeRemoved: true,
    },
    {
      category: 'Security Audit Log',
      keys: ['security:audit:{wallet}:*'],
      description: 'Security event history (retained for 90 days by policy per GDPR Article 30)',
      willBeRemoved: false,
    },
  ];

  return noCacheJsonResponse({
    wallet: session.address,
    checklist,
    summary: {
      categories: checklist.length,
      willBeRemoved: checklist.filter((i) => i.willBeRemoved).length,
      retainedForCompliance: checklist.filter((i) => !i.willBeRemoved).length,
    },
    note: 'Data from external protocols (Farcaster, Lens, Nostr, Bluesky) may remain on their networks. This only removes DegenFeed records.',
  });
}

// ─── GET /api/account/delete/certificate/:id — Get certificate ─────

export async function handleDeletionCertificate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const certId = pathParts[pathParts.length - 1];

  if (!certId || certId === 'certificate') {
    return jsonResponse({ error: 'Certificate ID is required.' }, 404);
  }

  if (!env.CACHE) {
    return jsonResponse({ error: 'KV namespace not available' }, 500);
  }

  try {
    const raw = await env.CACHE.get(`delete:cert:${certId}`);
    if (!raw) {
      return jsonResponse({ error: 'Deletion certificate not found or has expired.' }, 404);
    }

    const cert = JSON.parse(raw);

    // Verify ownership
    if ((cert as Record<string, string>).wallet?.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'This certificate belongs to a different account.' }, 401);
    }

    return new Response(JSON.stringify(cert, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="deletion-certificate-${certId}.json"`,
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch {
    return jsonResponse({ error: 'Failed to retrieve certificate' }, 500);
  }
}

/**
 * @degenfeed/api-worker — Structured error logger
 *
 * Logs errors to console AND persists recent errors in KV for monitoring.
 * Exposes a lightweight endpoint (used by the health handler) to surface
 * recent error counts without querying KV directly.
 *
 * Key schema:
 *   error-log:v2:{serverId}:{hourBucket}  →  Array<ErrorRecord>
 *   error-log:counts:current              →  { total, byRoute, since }
 *
 * Each server isolate maintains its own bucket key, so writes are
 * contention-free. The health endpoint reads from its own isolate's
 * bucket, which is good enough for relative trending.
 */

import type { Env } from './index';

// ─── Types ──────────────────────────────────────────────────────────

export interface ErrorRecord {
  timestamp: number;
  route: string;
  method: string;
  message: string;
  code: string;
  statusCode: number;
  userId?: string;
  /** Digest from Cloudflare Pages / Next.js error boundaries */
  digest?: string;
}

export interface ErrorCounts {
  total: number;
  byRoute: Record<string, number>;
  errors: ErrorRecord[];
  since: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const MAX_STORED_ERRORS = 50;
const ERROR_TTL_SECONDS = 86_400; // 24h
const SERVER_ID =
  typeof crypto !== 'undefined'
    ? ((crypto as Crypto).randomUUID?.() ?? `srv-${Date.now().toString(36)}`)
    : `srv-${Date.now().toString(36)}`;

// ─── Helpers ────────────────────────────────────────────────────────

function hourBucket(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:00:00Z`;
}

function generateCode(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DF-${rand}`;
}

// ─── Core log function ─────────────────────────────────────────────

/**
 * Log an error to console AND persist it to KV for the health dashboard.
 *
 * @param env   Cloudflare Worker env bindings
 * @param error The error to log (Error or string)
 * @param ctx   Structured context about the request
 */
export async function logError(
  env: Env,
  error: unknown,
  ctx: {
    route: string;
    method: string;
    statusCode?: number;
    userId?: string;
    digest?: string;
  },
): Promise<string> {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const code = generateCode();
  const record: ErrorRecord = {
    timestamp: Date.now(),
    route: ctx.route,
    method: ctx.method,
    message,
    code,
    statusCode: ctx.statusCode ?? 500,
    userId: ctx.userId,
    digest: ctx.digest,
  };

  // Always log to console (structured JSON for Cloudflare logging)
  console.log(
    JSON.stringify({
      l: 'error',
      code,
      m: message,
      route: ctx.route,
      method: ctx.method,
      status: ctx.statusCode ?? 500,
      t: record.timestamp,
      userId: ctx.userId,
    }),
  );

  // Persist to KV (fire-and-forget — never block a response on logging)
  if (env.CACHE) {
    persistToKv(env, record).catch(() => {
      /* KV write failures are non-critical */
    });
  }

  return code;
}

async function persistToKv(env: Env, record: ErrorRecord): Promise<void> {
  try {
    const bucket = hourBucket();
    const key = `error-log:v2:${SERVER_ID}:${bucket}`;

    // Read current bucket
    const raw = await env.CACHE?.get(key);
    const errors: ErrorRecord[] = raw ? (JSON.parse(raw) as ErrorRecord[]) : [];

    // Append, cap at MAX
    errors.push(record);
    const trimmed = errors.slice(-MAX_STORED_ERRORS);

    await env.CACHE?.put(key, JSON.stringify(trimmed), {
      expirationTtl: ERROR_TTL_SECONDS,
    });

    // Update running counts (best-effort TTL refresh)
    const countsKey = `error-log:counts:${SERVER_ID}`;
    const countsRaw = await env.CACHE?.get(countsKey);
    const counts: ErrorCounts = countsRaw
      ? (JSON.parse(countsRaw) as ErrorCounts)
      : { total: 0, byRoute: {}, errors: [], since: Date.now() };

    counts.total += 1;
    counts.byRoute[record.route] = (counts.byRoute[record.route] ?? 0) + 1;
    counts.errors.push(record);
    counts.errors = counts.errors.slice(-MAX_STORED_ERRORS);
    counts.since = counts.since || Date.now();

    await env.CACHE?.put(countsKey, JSON.stringify(counts), {
      expirationTtl: ERROR_TTL_SECONDS,
    });
  } catch {
    // Silently ignore KV persistence errors
  }
}

// ─── Read recent error counts for health dashboard ─────────────────

/**
 * Read recent error counts from the current isolate's KV bucket.
 * Returns null if no errors have been logged in this isolate.
 */
export async function getErrorCounts(env: Env): Promise<ErrorCounts | null> {
  if (!env.CACHE) return null;
  try {
    const key = `error-log:counts:${SERVER_ID}`;
    const raw = await env.CACHE.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as ErrorCounts;
  } catch {
    return null;
  }
}

/**
 * @degenfeed/api-worker — Main router
 *
 * Dispatches requests to route handler modules.
 * Shared utilities (Env, rateLimit, jsonResponse, GTS config) are
 * re-exported for route module use.
 */

import { isAllowedOrigin, parseOriginHeader } from './cors';
import { handleCron } from './routes/cron';

// ─── Environment variables ───────────────────────────────────────────

export interface Env {
  AUTH_SECRET?: string;
  CACHE?: KVNamespace;
  SUBSCRIPTIONS?: KVNamespace;
  BOOKMARKS?: KVNamespace;
  IDENTITIES?: KVNamespace;
  GTS_CLIENT_ID?: string;
  GTS_CLIENT_SECRET?: string;
  GTS_INSTANCE_URL?: string;
  GTS_API_BASE?: string;
  GTS_REDIRECT_URI?: string;
  RELAY_URLS?: string;
  FARCASTER_HUB_URL?: string;
  LENS_API_URL?: string;
  BSKY_PUBLIC_URL?: string;
  BSKY_SOCIAL_URL?: string;
  THREADS_PDS_URL?: string;
  THREADS_APP_ID?: string;
  THREADS_APP_SECRET?: string;
  FARCASTER_CLIENT_ID?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  RATE_WINDOW_MS?: string;
  RATE_MAX_REQ?: string;
  /** When "true", disables in-process rate limiting (use only for local dev). */
  RATE_LIMIT_DISABLED?: string;
  /** Comma-separated list of allowed CORS origins for state-changing requests. */
  ALLOWED_ORIGINS?: string;
  SOLANA_RPC_URL?: string;
  /** Base URL of the rmi-backend (default: http://127.0.0.1:8000) */
  RMI_BACKEND_URL?: string;
  /** Self-hosted Redlib instance for Reddit feed proxying */
  REDLIB_URL?: string;
  /** Self-hosted RSS-Bridge instance for proxied RSS feed fetching */
  RSS_BRIDGE_URL?: string;
  /** Optional bearer for rmi-backend if gated */
  RMI_API_KEY?: string;
  /** Optional Sentry DSN for error reporting */
  SENTRY_DSN?: string;
  /** Optional Postmark server token for transactional email delivery */
  POSTMARK_SERVER_TOKEN?: string;
  ALLOW_DEV_OAUTH?: string;
  /** KV namespace for cross-protocol community records */
  COMMUNITIES?: KVNamespace;
  /** @deprecated Use PUSH_API_KEY or NEWSLETTER_API_KEY instead. Retained for backward compatibility. */
  ADMIN_API_KEY?: string;
  /** Scoped API key for push notification sending (Bearer token). */
  PUSH_API_KEY?: string;
  /** Scoped API key for newsletter admin operations (subscriber count, etc.). */
  NEWSLETTER_API_KEY?: string;
  /** VAPID keys for Web Push (generate with: npx web-push generate-vapid-notes) */
  VAPID_SUBJECT?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Comma-separated list of feature flag keys that default to enabled */
  FEATURE_FLAGS_DEFAULT?: string;
}

// ─── Shared constants ────────────────────────────────────────────────

export function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void {
  console.log(JSON.stringify({ l: level, m: msg, t: Date.now(), ...(data ? { d: data } : {}) }));
}

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];
export const FARCASTER_HUBS = [
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
];
export const LENS_APIS = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
export const BSKY_PUBLIC = 'https://public.api.bsky.app';
export const BSKY_SOCIAL = 'https://bsky.social';
export const THREADS_PUBLIC = 'https://public.threads.net';

// ─── Rate limiting ───────────────────────────────────────────────────

const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * KV-backed fixed-window rate limiter.
 *
 * Cloudflare Workers can spin up many isolates per zone, so any in-memory
 * counter is unreliable. We use the CACHE KV namespace with a per-bucket
 * TTL equal to the window. Each bucket key = `${ip}:${path}:${windowMs/1000}`,
 * storing a JSON `{ count, resetAt }`. The bucket auto-expires after one
 * window so the counter resets.
 *
 * If `CACHE` is not bound (local dev), the function falls back to a
 * permissive "always allow" result and logs once — never blocks real users.
 */
export async function rateLimit(
  env: Env,
  ip: string,
  path: string,
  maxReq: number = DEFAULT_RATE_MAX,
  windowMs: number = DEFAULT_RATE_WINDOW,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    // No KV bound (local dev). Skip throttling so the dev experience works.
    return { allowed: true, retryAfter: 0 };
  }
  const bucketSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `rl:${ip}:${path}:${bucketSec}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  let count = 1;
  try {
    const raw = await env.CACHE.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count + 1;
      }
    }
    // TTL covers the window so the key expires automatically.
    await env.CACHE.put(key, JSON.stringify({ count, resetAt }), {
      expirationTtl: bucketSec,
    });
  } catch {
    // KV hiccup — fail open so a single KV outage doesn't break the API.
    return { allowed: true, retryAfter: 0 };
  }

  if (count > maxReq) {
    return { allowed: false, retryAfter: Math.max(0, resetAt - now) };
  }
  return { allowed: true, retryAfter: 0 };
}

// Rate limit cleanup inline in rateLimit() — avoids global setInterval (CF Workers restriction)

// ─── GotoSocial config ───────────────────────────────────────────────

export const GTS_AUTH_CONFIG = {
  clientId: '', // Must be set via GTS_CLIENT_ID env var
  clientSecret: '', // Must be set via GTS_CLIENT_SECRET env var
  instanceUrl: 'https://social.degenfeed.xyz',
  apiBase: 'https://social.degenfeed.xyz',
  redirectUri: 'https://degenfeed.xyz/auth/callback',
  scopes: 'read write follow push',
};

export function getGtsConfig(env: Env) {
  return {
    clientId: env.GTS_CLIENT_ID ?? GTS_AUTH_CONFIG.clientId,
    clientSecret: env.GTS_CLIENT_SECRET ?? GTS_AUTH_CONFIG.clientSecret,
    instanceUrl: env.GTS_INSTANCE_URL ?? GTS_AUTH_CONFIG.instanceUrl,
    apiBase: env.GTS_API_BASE ?? GTS_AUTH_CONFIG.apiBase,
    redirectUri: env.GTS_REDIRECT_URI ?? GTS_AUTH_CONFIG.redirectUri,
    scopes: GTS_AUTH_CONFIG.scopes,
  };
}

// ─── Response helper ─────────────────────────────────────────────────

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=30',
    },
  });
}

export function noCacheJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, must-revalidate',
    },
  });
}

// ─── CORS / CSRF helpers ─────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = [
  // /api/auth/gotosocial/callback is now protected by a signed state nonce
  // (see routes/auth.ts) AND a normal origin check, so it's no longer exempt.
  '/api/tip/frame/',
  // '/api/bridge/rss-to-nostr' is NO LONGER exempt — requires CSRF check
  '/api/blink/tip',
  '/api/x402/verify',
];

function _isStateChanging(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'DELETE';
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
}

function _validateOrigin(request: Request, path: string, env: Env): boolean {
  if (isCsrfExempt(path)) return true;
  const origin = request.headers.get('origin');
  if (origin) return isAllowedOrigin(origin, env.ALLOWED_ORIGINS);
  const referer = request.headers.get('referer');
  if (referer) {
    const refererOrigin = parseOriginHeader(referer);
    return refererOrigin ? isAllowedOrigin(refererOrigin, env.ALLOWED_ORIGINS) : false;
  }
  return false;
}

// ─── Cron handler ───────────────────────────────────────────────

/**
 * Called by the CF Workers cron trigger (daily digest at 14:00 UTC).
 * Re-exported from app.ts for the wrangler entry point.
 */
export async function scheduled(
  _controller: { cron: string; scheduledTime: number; noRetry: () => void },
  env: Env,
): Promise<void> {
  await handleCron(env);
}

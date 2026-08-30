/**
 * @degenfeed/web — Shared proxy helper for worker/bridge API routes.
 *
 * Forwards requests to the self-hosted API / bridge using WORKER_URL.
 *
 * Auth contract:
 *   - The caller's real user `Authorization` (session token) is forwarded
 *     UNTOUCHED so user-scoped feeds (for-you, following) can identify the
 *     caller — it is never overwritten.
 *   - The bridge's own key (BRIDGE_API_KEY) is sent on a SEPARATE internal
 *     header `X-Bridge-Api-Key`, which infra (nginx) maps to
 *     `Authorization: Bearer <key>` when forwarding to the bridge.
 *   - Backward-compat shim: when the request carries NO user Authorization
 *     (the common anonymous feed case), we set `Authorization: Bearer <key>`
 *     so the current bridge auth gate (which only reads Authorization)
 *     accepts the request without infra changes.
 *
 * Environment variable priority for the upstream URL:
 *   1. WORKER_URL
 *   2. API_PROXY_TARGET
 *   3. BRIDGE_URL
 *   4. NEXT_PUBLIC_WORKER_URL
 *   5. NEXT_PUBLIC_API_BASE
 *   6. NEXT_PUBLIC_API_URL
 *   7. http://localhost:8787 (default — the bridge, the only live feed server)
 */

function resolveWorkerUrl(): string {
  return (
    process.env.WORKER_URL ??
    process.env.API_PROXY_TARGET ??
    process.env.BRIDGE_URL ??
    process.env.NEXT_PUBLIC_WORKER_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8787'
  );
}

// ─── In-memory GET response cache (30s TTL) ─────────────────────────────
// Absorbs bridge cold starts: the bridge aggregates 30+ providers on the
// first request after a restart (~20s). Caching proxied GET responses here
// means the container keeps serving fast results even while the bridge warms,
// and repeated requests never re-hit slow provider aggregation.
const PROXY_CACHE_TTL_MS = 30_000; // 30s — matches bridge feed cache TTL
const PROXY_CACHE_MAX_ENTRIES = 100;

interface ProxyCacheEntry {
  status: number;
  body: string;
  contentType: string | null;
  expiresAt: number;
}

const proxyCache = new Map<string, ProxyCacheEntry>();

/**
 * User/session scope used to isolate cached responses: the Authorization
 * header plus the Cookie header. Two users with different sessions can
 * request the same URL but MUST NOT share a cached feed entry (fixes
 * cross-user feed leakage for user-scoped for-you/following feeds).
 * Hashed so raw session material never appears in cache keys or logs.
 *
 * Uses Web Crypto (crypto.subtle) so this module stays runtime-agnostic:
 * it is imported by both nodejs and edge routes. Falls back to a
 * non-crypto FNV-1a hash (32-bit) if subtle is unavailable — never throws,
 * safe on any runtime.
 */
async function userScopeHash(request: Request): Promise<string> {
  const auth = request.headers.get('authorization') ?? '';
  const cookie = request.headers.get('cookie') ?? '';
  if (!auth && !cookie) return 'anon';
  const material = `${auth}\n${cookie}`;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('crypto.subtle unavailable');
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(material));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  } catch {
    // Non-crypto FNV-1a fallback (32-bit) — never throws, safe on any runtime.
    let h = 0x811c9dc5;
    for (let i = 0; i < material.length; i += 1) {
      h ^= material.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return `fnv${(h >>> 0).toString(16)}`;
  }
}

async function proxyCacheKey(workerPath: string, url: URL, request: Request): Promise<string> {
  const scope = await userScopeHash(request);
  return `${workerPath}${url.search}|u=${scope}`;
}

/** Drop expired entries and, if still at capacity, evict the soonest-expiring one. */
function evictProxyCacheIfNeeded(): void {
  if (proxyCache.size < PROXY_CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  let oldestKey: string | null = null;
  let oldestExpiry = Infinity;
  for (const [key, entry] of proxyCache) {
    if (entry.expiresAt < now) {
      proxyCache.delete(key);
    } else if (entry.expiresAt < oldestExpiry) {
      oldestExpiry = entry.expiresAt;
      oldestKey = key;
    }
  }
  if (oldestKey && proxyCache.size >= PROXY_CACHE_MAX_ENTRIES) proxyCache.delete(oldestKey);
}

/**
 * Extract auth/session headers from the incoming request to forward to the
 * upstream. The user's real `Authorization` is preserved; the bridge key is
 * sent separately as `X-Bridge-Api-Key` (never overwrites the user token).
 * When no user token is present, `Authorization` falls back to the bridge key
 * so the current bridge auth gate still accepts anonymous requests.
 */
function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get('cookie');
  if (cookie) headers.Cookie = cookie;

  // Real user session token — forwarded untouched for user-scoped feeds.
  const auth = request.headers.get('authorization');
  if (auth) headers.Authorization = auth;

  const csrf = request.headers.get('x-csrf-token');
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;

  // Bridge-level auth on a SEPARATE internal header (infra maps it to
  // Authorization for the bridge auth gate).
  const bridgeKey = process.env.BRIDGE_API_KEY;
  if (bridgeKey) headers['X-Bridge-Api-Key'] = bridgeKey;

  // Backward-compat: anonymous requests authenticate to the bridge directly.
  if (!auth && bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;

  return headers;
}

/**
 * Proxy a GET request to the worker backend.
 * Preserves query parameters from the incoming request.
 * Caches successful responses for 30s, keyed by path + query + user session
 * (skipped entirely when the request carries a real user Authorization
 * header, since those may be personalized).
 */
export async function proxyGet(workerPath: string, request: Request): Promise<Response> {
  const base = resolveWorkerUrl();
  const url = new URL(request.url);
  const cacheable = !request.headers.get('authorization');

  const key = await proxyCacheKey(workerPath, url, request);

  // Serve from cache if fresh
  if (cacheable) {
    const cached = proxyCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          'content-type': cached.contentType ?? 'application/json',
          'cache-control': 'no-cache',
          'x-degenfeed-cache': 'hit',
        },
      });
    }
  }

  const target = `${base}${workerPath}${url.search}`;

  const res = await fetch(target, { headers: forwardHeaders(request) });
  const body = await res.text();

  // Only cache successful GET responses
  if (cacheable && res.ok) {
    evictProxyCacheIfNeeded();
    proxyCache.set(key, {
      status: res.status,
      body,
      contentType: res.headers.get('content-type'),
      expiresAt: Date.now() + PROXY_CACHE_TTL_MS,
    });
  }

  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': res.headers.get('cache-control') ?? 'no-cache',
      'x-degenfeed-cache': cacheable ? 'miss' : 'bypass',
    },
  });
}

/**
 * Proxy a POST request to the worker backend.
 * Forwards the request body as JSON.
 */
export async function proxyPost(workerPath: string, request: Request): Promise<Response> {
  const base = resolveWorkerUrl();
  const body = await request.text();

  const res = await fetch(`${base}${workerPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...forwardHeaders(request) },
    body,
  });

  const responseBody = await res.text();

  return new Response(responseBody, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}

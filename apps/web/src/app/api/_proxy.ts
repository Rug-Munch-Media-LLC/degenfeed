/**
 * @degenfeed/web — Shared proxy helper for worker/bridge API routes.
 *
 * Forwards requests to the self-hosted API using WORKER_URL.
 * Automatically injects BRIDGE_API_KEY so the API can authenticate.
 *
 * Environment variable priority for WORKER_URL:
 *   1. WORKER_URL
 *   2. NEXT_PUBLIC_WORKER_URL
 *   3. NEXT_PUBLIC_API_BASE
 *   4. NEXT_PUBLIC_API_URL
 *   5. http://host.docker.internal:3101 (fallback — self-hosted API on host)
 */

function resolveWorkerUrl(): string {
  return (
    process.env.WORKER_URL ??
    process.env.NEXT_PUBLIC_WORKER_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://host.docker.internal:3101'
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

function proxyCacheKey(workerPath: string, url: URL): string {
  return `${workerPath}${url.search}`;
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
 * Extract auth/session headers from the incoming request to forward to the worker.
 * Also injects BRIDGE_API_KEY for bridge-level auth (from server env).
 */
function forwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get('cookie');
  if (cookie) headers.Cookie = cookie;
  const auth = request.headers.get('authorization');
  if (auth) headers.Authorization = auth;
  const csrf = request.headers.get('x-csrf-token');
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;
  // Inject bridge API key for local bridge auth (from server env)
  const bridgeKey = process.env.BRIDGE_API_KEY;
  if (bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;
  return headers;
}

/**
 * Proxy a GET request to the worker backend.
 * Preserves query parameters from the incoming request.
 * Caches successful responses for 30s (skipped when the request carries a
 * real user Authorization header, since those may be user-scoped).
 */
export async function proxyGet(workerPath: string, request: Request): Promise<Response> {
  const base = resolveWorkerUrl();
  const url = new URL(request.url);
  const cacheable = !request.headers.get('authorization');

  const key = proxyCacheKey(workerPath, url);

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

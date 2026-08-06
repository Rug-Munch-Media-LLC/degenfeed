/**
 * @degenfeed/api-worker — Edge Cache (Cache API) helper
 *
 * Wraps `caches.default` (Cloudflare Cache API) for edge-local caching of
 * public, cacheable content (TTL <= 300s). The Cache API sits IN FRONT of
 * KV: reads hit the Cache API first, then fall back to KV (graceful
 * migration), then to the fetcher. Writes populate the Cache API and keep
 * the KV write as a fallback so nothing is lost during migration.
 *
 * Why Cache API instead of KV for content?
 *   - KV charges per read/write and has no edge-level caching guarantees.
 *   - `caches.default` is free, colocated at the edge, and automatically
 *     evicted by the Cache-Control TTL we set on the stored response.
 *
 * Cloudflare Workers don't expose `ctx` (ExecutionContext) as a global, so
 * background cache population uses a waitUntil function when one is passed
 * in (via `setEdgeCacheWaitUntil` or `globalThis.waitUntil`), and otherwise
 * accumulates the promises so the isolate keeps them alive as long as it can.
 */

import type { Env } from '../types';

/** Synthetic origin used to build cache keys that are valid Request URLs. */
const EDGE_CACHE_ORIGIN = 'https://edge-cache.internal';

export type WaitUntil = (promise: Promise<unknown>) => void;

type WaitUntilSink = { fn: WaitUntil | undefined };

// waitUntil sink — routes background promises to whatever the runtime offers.
const waitUntilSink: WaitUntilSink = { fn: undefined };

// Fallback queue: when no waitUntil is available, accumulate the promises so
// they are not dropped. The promises have .catch() attached, so a late
// rejection can never crash the isolate.
const pendingWaitUntil: Array<Promise<unknown>> = [];

/**
 * Register the ExecutionContext waitUntil for the current request.
 * Call this once per request (e.g. in the fetch handler) so background
 * cache puts survive past the response.
 */
export function setEdgeCacheWaitUntil(fn: WaitUntil | undefined): void {
  waitUntilSink.fn = fn;
}

/**
 * Run a background promise. Priority:
 *   1. waitUntil registered via setEdgeCacheWaitUntil (request context)
 *   2. globalThis.waitUntil (Cloudflare sets this on module workers)
 *   3. accumulate locally (best-effort — isolate keeps it alive briefly)
 */
function runWaitUntil(promise: Promise<unknown>): void {
  if (waitUntilSink.fn) {
    waitUntilSink.fn(promise);
    return;
  }
  const g = globalThis as unknown as { waitUntil?: WaitUntil };
  if (typeof g.waitUntil === 'function') {
    g.waitUntil(promise);
    return;
  }
  pendingWaitUntil.push(promise);
}

/** Flush accumulated background promises. Safe to call at request end. */
export function flushPendingWaitUntil(): void {
  pendingWaitUntil.splice(0);
}

/**
 * Build a synthetic Request from a cache key. The Cache API requires a
 * Request with an http(s) URL; the key is URL-encoded into the path.
 */
export function edgeCacheRequest(key: string): Request {
  return new Request(`${EDGE_CACHE_ORIGIN}/${encodeURIComponent(key)}`);
}

/**
 * Build a cacheable JSON Response. The Cache API derives the entry TTL from
 * the Cache-Control header, so `max-age`/`s-maxage` are set from `ttl`.
 */
function cachedJsonResponse(value: string, ttl: number): Response {
  return new Response(value, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${ttl}, s-maxage=${ttl}`,
    },
  });
}

/**
 * Resolve the default Cache. `caches.default` is the Cloudflare Workers
 * runtime API; the DOM lib's `CacheStorage` declaration hides it in the
 * merged global type, so it is accessed explicitly.
 */
function defaultCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

/** Best-effort background write to the Cache API. */
function scheduleCachePut(request: Request, response: Response): void {
  const p = defaultCache()
    .put(request, response)
    .catch(() => {
      // Cache API unavailable (local dev / non-CF runtime) — non-critical.
    });
  runWaitUntil(p);
}

/**
 * Check the Cache API for `key`. Returns the raw body string or null.
 * Never throws — Cache API failures degrade to a miss.
 */
export async function edgeCacheGetRaw(key: string): Promise<string | null> {
  try {
    const cached = await defaultCache().match(edgeCacheRequest(key));
    if (!cached) return null;
    return await cached.text();
  } catch {
    return null;
  }
}

/**
 * Check `key` in the Cache API first, then fall back to the CACHE KV
 * namespace (graceful migration). Returns the raw body string or null.
 */
export async function edgeCacheGet(env: Env, key: string): Promise<string | null> {
  const fromCache = await edgeCacheGetRaw(key);
  if (fromCache !== null) return fromCache;

  if (env.CACHE) {
    try {
      return await env.CACHE.get(key);
    } catch {
      // KV hiccup — non-critical, treat as miss.
    }
  }
  return null;
}

/**
 * Write `value` to the Cache API (primary) AND the CACHE KV namespace
 * (fallback for graceful migration). Non-blocking for the caller.
 */
export async function edgeCachePut(
  env: Env,
  key: string,
  value: string,
  ttl: number,
): Promise<void> {
  try {
    scheduleCachePut(edgeCacheRequest(key), cachedJsonResponse(value, ttl));
  } catch {
    // Non-critical — Cache API unavailable.
  }
  if (env.CACHE) {
    try {
      await env.CACHE.put(key, value, { expirationTtl: Math.max(1, ttl) });
    } catch {
      // Non-critical — KV write failed; Cache API already holds the entry.
    }
  }
}

/**
 * Check the Cache API for `key`, falling back to an arbitrary getter
 * (e.g. a SPACES KV read). On a fallback hit, the value is re-populated in
 * the Cache API in the background. Use this when the authoritative store is
 * a namespace other than CACHE.
 */
export async function edgeCacheGetOr(
  _env: Env,
  key: string,
  ttl: number,
  fallback: () => Promise<string | null> | string | null,
): Promise<string | null> {
  const fromCache = await edgeCacheGetRaw(key);
  if (fromCache !== null) return fromCache;

  let value: string | null = null;
  try {
    value = await fallback();
  } catch {
    // Fallback getter failed — treat as miss.
  }
  if (value !== null) {
    try {
      scheduleCachePut(edgeCacheRequest(key), cachedJsonResponse(value, ttl));
    } catch {
      // Non-critical.
    }
  }
  return value;
}

/**
 * Check the Cache API for `key`; on a miss call `fetcher()`, store the
 * result at the edge (background via waitUntil), and return it. If `env` is
 * provided, KV acts as a second fallback layer and the KV write is kept for
 * graceful migration.
 */
export async function getCachedOrFetch(
  key: string,
  ttl: number,
  fetcher: () => Promise<Response>,
  env?: Env,
): Promise<Response> {
  const fromCache = await edgeCacheGetRaw(key);
  if (fromCache !== null) {
    return cachedJsonResponse(fromCache, ttl);
  }

  if (env?.CACHE) {
    try {
      const fromKv = await env.CACHE.get(key);
      if (fromKv !== null) {
        // Re-populate the Cache API in the background.
        scheduleCachePut(edgeCacheRequest(key), cachedJsonResponse(fromKv, ttl));
        return cachedJsonResponse(fromKv, ttl);
      }
    } catch {
      // KV hiccup — non-critical, continue to fetcher.
    }
  }

  const response = await fetcher();

  try {
    const body = await response.clone().text();
    scheduleCachePut(edgeCacheRequest(key), cachedJsonResponse(body, ttl));
    if (env?.CACHE) {
      await env.CACHE.put(key, body, { expirationTtl: Math.max(1, ttl) }).catch(() => {});
    }
  } catch {
    // Non-critical — cache population failure does not fail the request.
  }

  return response;
}

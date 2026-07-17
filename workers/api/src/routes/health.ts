import { DEFAULT_RELAYS, type Env, jsonResponse } from '../index';

/**
 * GET /api/health — Legacy relay health
 */
export async function handleRelaysHealth(env: Env): Promise<Response> {
  const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
  const urls = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;

  const results: Record<string, string> = {};
  for (const url of urls.slice(0, 5)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const ws = new WebSocket(url);
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => reject(new Error('connect failed'));
        setTimeout(() => reject(new Error('timeout')), 3000);
      });
      clearTimeout(timeout);
      results[url] = 'ok';
    } catch {
      results[url] = 'error';
    }
  }

  return jsonResponse({
    relays: results,
    healthy: Object.values(results).filter((r) => r === 'ok').length,
  });
}

// ─── Protocol Health ──────────────────────────────────────────────

interface ProtocolStatus {
  status: 'up' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  circuitBreakerOpen: boolean;
  error?: string;
}

interface ProtocolsHealthResponse {
  protocols: Record<string, ProtocolStatus>;
  summary: {
    total: number;
    up: number;
    degraded: number;
    down: number;
  };
  checkedAt: number;
}

/**
 * GET /api/health/protocols — Status of every protocol DegenFeed connects to.
 *
 * Hits each provider's healthCheck endpoint in parallel, overlays circuit
 * breaker state, and maps the result to a 3-tier status:
 *   up       = healthCheck passed, circuit closed
 *   degraded = healthCheck failed / circuit open but not yet fully down
 *   down     = healthCheck failed AND circuit is open
 *
 * In-memory cache via the CACHE KV namespace with a 30-second TTL so we
 * don't hammer external APIs on every page load. The status dashboard
 * client polls this endpoint every 60 seconds.
 */
export async function handleProtocolsHealth(env: Env): Promise<Response> {
  const cacheKey = 'health:protocols:v1';
  const cached = await readProtocolsCache(env, cacheKey);
  if (cached) return jsonResponse(cached);

  const { checkProvidersHealth, isCircuitOpen, DEFAULT_PROTOCOLS } = await import('../feed/feed-fetcher');

  // Run health checks in parallel — this is the expensive part.
  const health = await checkProvidersHealth(env);

  // Overlay circuit breaker state for each protocol.
  const protocols: Record<string, ProtocolStatus> = {};
  const now = Date.now();

  for (const protocol of DEFAULT_PROTOCOLS) {
    const h = health[protocol];
    const circuitOpen = await isCircuitOpen(env, protocol);
    let status: 'up' | 'degraded' | 'down';

    if (h?.healthy && !circuitOpen) {
      status = 'up';
    } else if (!h?.healthy && circuitOpen) {
      status = 'down';
    } else {
      // healthy + circuitOpen = breaker was open but now responding (degraded)
      // !healthy + circuit closed = one-off failure (degraded)
      status = 'degraded';
    }

    protocols[protocol] = {
      status,
      latency: h?.latencyMs ?? 0,
      lastChecked: now,
      circuitBreakerOpen: circuitOpen,
      error: h?.error,
    };
  }

  const values = Object.values(protocols);
  const body: ProtocolsHealthResponse = {
    protocols,
    summary: {
      total: values.length,
      up: values.filter((p) => p.status === 'up').length,
      degraded: values.filter((p) => p.status === 'degraded').length,
      down: values.filter((p) => p.status === 'down').length,
    },
    checkedAt: now,
  };

  // Cache for 30 seconds to avoid hammering APIs.
  await writeProtocolsCache(env, cacheKey, body);

  return jsonResponse(body);
}

// ─── KV-backed cache (30s TTL) ───────────────────────────────────

async function readProtocolsCache(env: Env, key: string): Promise<ProtocolsHealthResponse | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProtocolsHealthResponse;
    // 30-second stale window
    if (Date.now() - parsed.checkedAt < 30_000) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writeProtocolsCache(env: Env, key: string, body: ProtocolsHealthResponse): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(body), { expirationTtl: 60 });
  } catch {
    // Non-critical cache write — log and continue
  }
}

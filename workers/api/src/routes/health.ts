import { DEFAULT_RELAYS } from '../index';
import { getQueueStats } from '../lib/offline-queue';
import { getTxMonitorStats } from '../lib/transaction-monitor';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

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

  return ok({
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
  if (cached) return ok(cached);

  const { checkProvidersHealth, isCircuitOpen, DEFAULT_PROTOCOLS } = await import(
    '../feed/feed-fetcher'
  );

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

  // ── Postiz cross-posting health ───────────────────────────────
  if (env.POSTIZ_BASE_URL && env.POSTIZ_API_KEY) {
    const postizStatus = await checkPostizHealth(env);
    protocols.postiz = postizStatus;
  } else {
    protocols.postiz = {
      status: 'down',
      latency: 0,
      lastChecked: now,
      circuitBreakerOpen: false,
      error: 'not configured',
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

  return ok(body);
}

// ─── Postiz health check ─────────────────────────────────────────

/**
 * Quick health check of the Postiz API.
 * Uses a GET to /public/v1/posts — if it responds <500, Postiz is alive.
 */
async function checkPostizHealth(env: Env): Promise<ProtocolStatus> {
  const now = Date.now();
  try {
    const start = performance.now();
    const res = await fetch(`${env.POSTIZ_BASE_URL}/public/v1/posts`, {
      method: 'GET',
      headers: {
        Authorization: env.POSTIZ_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok || res.status < 500) {
      return {
        status: 'up',
        latency,
        lastChecked: now,
        circuitBreakerOpen: false,
      };
    }
    return {
      status: 'down',
      latency,
      lastChecked: now,
      circuitBreakerOpen: false,
      error: `Postiz returned ${res.status}`,
    };
  } catch (e) {
    return {
      status: 'down',
      latency: 0,
      lastChecked: now,
      circuitBreakerOpen: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
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

async function writeProtocolsCache(
  env: Env,
  key: string,
  body: ProtocolsHealthResponse,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(body), { expirationTtl: 60 });
  } catch {
    // Non-critical cache write — log and continue
  }
}

// ═════════════════════════════════════════════════════════════════════════
// GET /api/health/full — Full integration health check
// ═════════════════════════════════════════════════════════════════════════

/**
 * GET /api/health/full — Comprehensive health check for ALL integrations.
 *
 * Tests every external dependency:
 *   - ActivityPub / Mastodon
 *   - AT Protocol (Bluesky)
 *   - Nostr (relays)
 *   - Farcaster (Hub)
 *   - Lens Protocol
 *   - Telegram Bot API
 *   - Zora API
 *   - Wormhole Bridge
 *   - PeerTube instance
 *   - EVM RPCs (Ethereum, Base, Polygon)
 *   - Solana RPC
 *   - RSS
 *   - Threads
 *
 * Also includes:
 *   - Offline queue stats
 *   - Transaction monitor stats
 *   - Error counts from the error-logger
 *
 * Returns a full health report with per-integration status, latency,
 * and error information. NEVER cached — always fresh.
 *
 * Designed for the status dashboard and automated alerting.
 */
export async function handleFullHealth(env: Env): Promise<Response> {
  const start = performance.now();

  // Run all health checks in parallel
  const { getFullHealthReport } = await import('../lib/health-integrations');
  const report = await getFullHealthReport(env);

  // Gather system stats in parallel
  const [queueStats, txStats, errorCounts] = await Promise.all([
    getQueueStats(env).catch(() => null),
    getTxMonitorStats(env).catch(() => null),
    (getErrorCounts ? getErrorCounts(env) : Promise.resolve(null)).catch(() => null),
  ]);

  const body = {
    ...report,
    system: {
      offlineQueue: queueStats ?? {
        total: 0,
        pending: 0,
        completed: 0,
        failed: 0,
        deadLetter: 0,
        oldestPending: null,
      },
      transactionMonitor: txStats ?? {
        total: 0,
        pending: 0,
        confirmed: 0,
        failed: 0,
        stuck: 0,
        replaced: 0,
        escalated: 0,
      },
      errors: errorCounts
        ? {
            total: errorCounts.total,
            byRoute: errorCounts.byRoute,
            since: errorCounts.since,
            recentErrors: errorCounts.errors?.slice(0, 10) ?? [],
          }
        : null,
    },
    overallLatency: Math.round(performance.now() - start),
  };

  return jsonResponse(body, 200, { 'cache-control': 'no-store, must-revalidate' });
}

// Import getErrorCounts lazily — depends on error-logger module
import { getErrorCounts } from '../error-logger';

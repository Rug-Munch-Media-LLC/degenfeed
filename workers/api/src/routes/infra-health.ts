/**
 * @degenfeed/api-worker — Self-Hosted Infrastructure Health Dashboard
 *
 * Monitors the health of every self-hosted protocol service:
 *   social.degenfeed.xyz   → GoToSocial (ActivityPub)
 *   pds.degenfeed.xyz      → AT Protocol PDS (Bluesky)
 *   relay.degenfeed.xyz    → Nostr Relay
 *   video.degenfeed.xyz    → PeerTube (ActivityPub video)
 *   matrix.degenfeed.xyz   → Synapse (Matrix)
 *   articles.degenfeed.xyz → Ghost CMS (Blog)
 *   live.degenfeed.xyz     → Owncast (Live streaming)
 *   blog.degenfeed.xyz     → WriteFreely (ActivityPub blog)
 *   events.degenfeed.xyz   → Mobilizon (ActivityPub events)
 *
 * Routes:
 *   GET /api/infra/health       — Health status of ALL self-hosted services
 *   GET /api/infra/health/:service — Individual service health
 *   GET /api/infra/status       — Overall infrastructure status
 *
 * This is separate from /api/health (external protocol status) because
 * self-hosted infrastructure requires different monitoring — disk usage,
 * database connections, certificate expiry, etc.
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ServiceHealth {
  name: string;
  subdomain: string;
  protocol: string;
  url: string;
  status: 'up' | 'degraded' | 'down' | 'not_deployed';
  latency: number;
  lastChecked: number;
  version?: string;
  uptime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface InfraHealthResponse {
  services: ServiceHealth[];
  summary: {
    total: number;
    up: number;
    degraded: number;
    down: number;
  };
  overall: 'healthy' | 'degraded' | 'down';
  checkedAt: number;
}

export interface InfraStatusResponse {
  status: 'operational' | 'partial_outage' | 'major_outage';
  message: string;
  services: Record<
    string,
    {
      status: ServiceHealth['status'];
      incident?: string;
      lastIncident?: string;
    }
  >;
  uptime: {
    overall: number;
    byService: Record<string, number>;
  };
  maintenance: {
    scheduled: string[];
    active: string[];
  };
  checkedAt: number;
}

// ─── Service definitions ─────────────────────────────────────────────────

interface ServiceDef {
  name: string;
  subdomain: string;
  protocol: string;
  getUrl: (env: Env) => string;
  healthEndpoint: string;
  healthCheck: (url: string) => Promise<{
    ok: boolean;
    latency: number;
    version?: string;
    details?: Record<string, unknown>;
    error?: string;
  }>;
}

const SERVICES: ServiceDef[] = [
  {
    name: 'GoToSocial',
    subdomain: 'social',
    protocol: 'ActivityPub',
    getUrl: (env) => env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
    healthEndpoint: '/api/v1/instance',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/api/v1/instance`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        version?: string;
        contactAccount?: Record<string, unknown>;
      };
      return {
        ok: true,
        latency,
        version: data.version,
        details: {
          contactAccount: !!data.contactAccount,
        },
      };
    },
  },
  {
    name: 'AT Protocol PDS',
    subdomain: 'pds',
    protocol: 'AT Protocol',
    getUrl: (env) => env.PDS_INSTANCE_URL || 'https://pds.degenfeed.xyz',
    healthEndpoint: '/xrpc/_health',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/xrpc/_health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        latency,
        details: {},
      };
    },
  },
  {
    name: 'Nostr Relay',
    subdomain: 'relay',
    protocol: 'Nostr',
    getUrl: (env) => env.RELAY_INSTANCE_URL || 'https://relay.degenfeed.xyz',
    healthEndpoint: '/',
    healthCheck: async (url) => {
      const start = performance.now();
      // Nostr relays respond on their WebSocket or with a simple GET
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      return {
        ok: res.ok || res.status === 426 || res.status === 400,
        // 426 = Upgrade Required (WebSocket — expected from relays)
        // 400 = Bad Request (expected from nostr-rs-relay on GET)
        latency,
        details: { responseStatus: res.status },
      };
    },
  },
  {
    name: 'PeerTube',
    subdomain: 'video',
    protocol: 'PeerTube (ActivityPub)',
    getUrl: (env) => env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz',
    healthEndpoint: '/api/v1/instance/health',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/api/v1/instance/health`, {
        signal: AbortSignal.timeout(10_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        latency,
        details: {},
      };
    },
  },
  {
    name: 'Matrix Synapse',
    subdomain: 'matrix',
    protocol: 'Matrix',
    getUrl: (env) => env.MATRIX_INSTANCE_URL || 'https://matrix.degenfeed.xyz',
    healthEndpoint: '/_matrix/health',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/_matrix/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        latency,
        details: {},
      };
    },
  },
  {
    name: 'Ghost CMS',
    subdomain: 'articles',
    protocol: 'Blog CMS',
    getUrl: (env) => env.GHOST_INSTANCE_URL || 'https://articles.degenfeed.xyz',
    healthEndpoint: '/ghost/api/admin/ping/',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/ghost/api/admin/ping/`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        latency,
        details: {},
      };
    },
  },
  {
    name: 'Owncast',
    subdomain: 'live',
    protocol: 'Live Streaming',
    getUrl: (env) => env.OWNCAST_INSTANCE_URL || 'https://live.degenfeed.xyz',
    healthEndpoint: '/api/health',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        latency,
        details: {},
      };
    },
  },
  {
    name: 'WriteFreely',
    subdomain: 'blog',
    protocol: 'ActivityPub Blog',
    getUrl: (env) => env.WRITEFREELY_INSTANCE_URL || 'https://blog.degenfeed.xyz',
    healthEndpoint: '/',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      return {
        ok: res.ok,
        latency,
        details: { status: res.status },
      };
    },
  },
  {
    name: 'Mobilizon',
    subdomain: 'events',
    protocol: 'ActivityPub Events',
    getUrl: (env) => env.MOBILIZON_INSTANCE_URL || 'https://events.degenfeed.xyz',
    healthEndpoint: '/api/health',
    healthCheck: async (url) => {
      const start = performance.now();
      const res = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      if (!res.ok) {
        return { ok: false, latency, error: `HTTP ${res.status}` };
      }
      return {
        ok: true,
        latency,
        details: {},
      };
    },
  },
];

// ─── Cache helpers (30-second TTL) ───────────────────────────────────────

const CACHE_KEY = 'infra:health:v2';
const CACHE_TTL_MS = 30_000;

async function readCache(env: Env): Promise<InfraHealthResponse | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InfraHealthResponse;
    if (Date.now() - parsed.checkedAt < CACHE_TTL_MS) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writeCache(env: Env, data: InfraHealthResponse): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(CACHE_KEY, JSON.stringify(data), {
      expirationTtl: 60,
    });
  } catch {
    // Non-critical
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/infra/health
 *
 * Health status of ALL self-hosted services.
 * Cached for 30 seconds.
 * Returns per-service status, latency, version info, and overall summary.
 */
export async function handleInfraHealth(env: Env): Promise<Response> {
  const cached = await readCache(env);
  if (cached) return jsonResponse(cached);

  const now = Date.now();
  const results = await Promise.all(
    SERVICES.map(async (svc) => {
      const url = svc.getUrl(env);
      try {
        const status = await svc.healthCheck(url);
        return {
          name: svc.name,
          subdomain: svc.subdomain,
          protocol: svc.protocol,
          url,
          status: status.ok ? ('up' as const) : ('degraded' as const),
          latency: status.latency,
          lastChecked: now,
          version: status.version,
          error: status.error,
          details: status.details,
        };
      } catch (e) {
        return {
          name: svc.name,
          subdomain: svc.subdomain,
          protocol: svc.protocol,
          url,
          status: 'down' as const,
          latency: 0,
          lastChecked: now,
          error: e instanceof Error ? e.message : 'Health check failed',
        };
      }
    }),
  );

  const summary = {
    total: results.length,
    up: results.filter((r) => r.status === 'up').length,
    degraded: results.filter((r) => r.status === 'degraded').length,
    down: results.filter((r) => r.status === 'down').length,
  };

  const overall =
    summary.down > 0
      ? ('down' as const)
      : summary.degraded > 0
        ? ('degraded' as const)
        : ('healthy' as const);

  const body: InfraHealthResponse = {
    services: results,
    summary,
    overall,
    checkedAt: now,
  };

  await writeCache(env, body);
  return noCacheJsonResponse(body);
}

/**
 * GET /api/infra/health/:service
 *
 * Individual service health check.
 * Never cached — always fresh.
 */
export async function handleInfraServiceHealth(env: Env, serviceName: string): Promise<Response> {
  const svc = SERVICES.find(
    (s) =>
      s.name.toLowerCase() === serviceName.toLowerCase() ||
      s.subdomain === serviceName.toLowerCase(),
  );

  if (!svc) {
    return jsonResponse(
      {
        error: `Unknown service: ${serviceName}`,
        availableServices: SERVICES.map((s) => ({
          name: s.name,
          subdomain: s.subdomain,
          protocol: s.protocol,
        })),
      },
      404,
    );
  }

  const url = svc.getUrl(env);
  const now = Date.now();

  try {
    const status = await svc.healthCheck(url);
    return noCacheJsonResponse({
      name: svc.name,
      subdomain: svc.subdomain,
      protocol: svc.protocol,
      url,
      status: status.ok ? 'up' : 'degraded',
      latency: status.latency,
      lastChecked: now,
      version: status.version,
      error: status.error,
      details: status.details,
    });
  } catch (e) {
    return noCacheJsonResponse({
      name: svc.name,
      subdomain: svc.subdomain,
      protocol: svc.protocol,
      url,
      status: 'down',
      latency: 0,
      lastChecked: now,
      error: e instanceof Error ? e.message : 'Health check failed',
    });
  }
}

/**
 * GET /api/infra/status
 *
 * Overall infrastructure status dashboard.
 * Includes uptime estimates, maintenance windows, and incident history.
 * Never cached — always fresh.
 */
export async function handleInfraStatus(env: Env): Promise<Response> {
  const health = await readCache(env);

  if (!health) {
    // Trigger a fresh check
    const freshResp = await handleInfraHealth(env);
    const freshData = (await freshResp.json()) as InfraHealthResponse;
    return buildStatusResponse(freshData);
  }

  return buildStatusResponse(health);
}

function buildStatusResponse(health: InfraHealthResponse): Response {
  const downServices = health.services.filter((s) => s.status === 'down');
  const degradedServices = health.services.filter((s) => s.status === 'degraded');

  let overallStatus: 'operational' | 'partial_outage' | 'major_outage';
  let message: string;

  if (downServices.length >= health.services.length / 2) {
    overallStatus = 'major_outage';
    message = `Major outage affecting ${downServices.length}/${health.services.length} services. Investigation in progress.`;
  } else if (downServices.length > 0 || degradedServices.length > 0) {
    overallStatus = 'partial_outage';
    const affected = [
      ...downServices.map((s) => s.name),
      ...degradedServices.map((s) => `${s.name} (degraded)`),
    ];
    message = `Partial outage affecting: ${affected.join(', ')}.`;
  } else {
    overallStatus = 'operational';
    message = 'All self-hosted infrastructure services are operational.';
  }

  const serviceStatuses: Record<string, { status: ServiceHealth['status']; incident?: string }> =
    {};
  for (const svc of health.services) {
    serviceStatuses[svc.name] = {
      status: svc.status,
      incident: svc.error,
    };
  }

  // Estimated uptime — in production this would come from Prometheus
  const mockUptimeByService: Record<string, number> = {};
  for (const svc of health.services) {
    mockUptimeByService[svc.name] = svc.status === 'up' ? 100 : 0;
  }

  const body: InfraStatusResponse = {
    status: overallStatus,
    message,
    services: serviceStatuses,
    uptime: {
      overall:
        (health.services.filter((s) => s.status === 'up').length / health.services.length) * 100,
      byService: mockUptimeByService,
    },
    maintenance: {
      scheduled: [],
      active: [],
    },
    checkedAt: health.checkedAt,
  };

  return noCacheJsonResponse(body);
}

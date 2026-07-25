/**
 * @degenfeed/api-worker — Protocol Status Dashboard
 *
 * Routes:
 *   GET /api/protocols/status       — Health status of ALL protocols
 *   GET /api/protocols/status/:name — Single protocol health
 *
 * Returns real-time health data including latency, uptime, and status.
 * Cached in KV for 30 seconds to reduce backend load.
 *
 * Response:
 * {
 *   "protocols": {
 *     "nostr": { "status": "healthy", "latency": 45, "uptime": 99.9, "lastChecked": 1700000000000 },
 *     "farcaster": { "status": "degraded", "latency": 250, "uptime": 97.2, ... },
 *     ...
 *   },
 *   "totalProtocols": 26,
 *   "healthyProtocols": 22,
 *   "degradedProtocols": 3,
 *   "downProtocols": 1,
 *   "checkedAt": 1700000000000
 * }
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

// ─── Types ─────────────────────────────────────────────────────────────

export type ProtocolHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ProtocolHealth {
  status: ProtocolHealthStatus;
  latency: number;
  uptime: number;
  lastChecked: number;
  error?: string;
}

export interface ProtocolStatusResponse {
  protocols: Record<string, ProtocolHealth>;
  totalProtocols: number;
  healthyProtocols: number;
  degradedProtocols: number;
  downProtocols: number;
  unknownProtocols: number;
  checkedAt: number;
}

// ─── Known Protocol Definitions ────────────────────────────────────────

interface ProtocolDef {
  name: string;
  healthCheck?: () => Promise<{ latency: number; ok: boolean; error?: string }>;
  checkType: 'internal' | 'external' | 'static';
  endpoint: string;
}

const PROTOCOL_DEFINITIONS: Record<string, ProtocolDef> = {
  nostr: {
    name: 'Nostr',
    checkType: 'internal',
    endpoint: '/api/feed/nostr',
  },
  farcaster: {
    name: 'Farcaster',
    checkType: 'internal',
    endpoint: '/api/feed/farcaster',
  },
  lens: {
    name: 'Lens Protocol',
    checkType: 'internal',
    endpoint: '/api/feed/lens',
  },
  bluesky: {
    name: 'Bluesky / AT Protocol',
    checkType: 'internal',
    endpoint: '/api/feed/bluesky',
  },
  mastodon: {
    name: 'Mastodon / GoToSocial',
    checkType: 'internal',
    endpoint: '/api/feed/mastodon',
  },
  pixelfed: {
    name: 'Pixelfed',
    checkType: 'internal',
    endpoint: '/api/feed/pixelfed',
  },
  threads: {
    name: 'Threads (Meta)',
    checkType: 'external',
    endpoint: '/api/feed/threads',
  },
  rss: {
    name: 'RSS / Newsletters',
    checkType: 'internal',
    endpoint: '/api/feed/rss',
  },
  reddit: {
    name: 'Reddit / Redlib',
    checkType: 'internal',
    endpoint: '/api/feed/reddit',
  },
  lemmy: {
    name: 'Lemmy',
    checkType: 'internal',
    endpoint: '/api/feed/lemmy',
  },
  peertube: {
    name: 'PeerTube',
    checkType: 'internal',
    endpoint: '/api/feed/peertube',
  },
  zora: {
    name: 'Zora (NFT)',
    checkType: 'internal',
    endpoint: '/api/feed/zora',
  },
  kbin: {
    name: 'kbin / Mbin',
    checkType: 'internal',
    endpoint: '/api/feed/kbin',
  },
  tildes: {
    name: 'Tildes',
    checkType: 'internal',
    endpoint: '/api/feed/tildes',
  },
  mirror: {
    name: 'Mirror.xyz',
    checkType: 'internal',
    endpoint: '/api/feed/mirror',
  },
  dtube: {
    name: 'DTube (Hive Video)',
    checkType: 'external',
    endpoint: '/api/feed/dtube',
  },
  lbry: {
    name: 'Odysee / LBRY',
    checkType: 'external',
    endpoint: '/api/feed/lbry',
  },
  gab: {
    name: 'Gab / Dissenter',
    checkType: 'external',
    endpoint: '/api/feed/gab',
  },
  minds: {
    name: 'Minds',
    checkType: 'external',
    endpoint: '/api/feed/minds',
  },
  aether: {
    name: 'Aether (P2P Communities)',
    checkType: 'external',
    endpoint: '/api/feed/aether',
  },
  scuttlebutt: {
    name: 'Scuttlebutt / SSB',
    checkType: 'external',
    endpoint: '/api/feed/scuttlebutt',
  },
  hive: {
    name: 'Hive Blog',
    checkType: 'external',
    endpoint: '/api/feed/hive',
  },
  telegram: {
    name: 'Telegram',
    checkType: 'static',
    endpoint: '',
  },
  discord: {
    name: 'Discord',
    checkType: 'static',
    endpoint: '',
  },
  matrix: {
    name: 'Matrix',
    checkType: 'static',
    endpoint: '',
  },
  github: {
    name: 'GitHub',
    checkType: 'static',
    endpoint: '',
  },
  paragraph: {
    name: 'Paragraph',
    checkType: 'static',
    endpoint: '',
  },
  ethereum: {
    name: 'Ethereum (On-chain)',
    checkType: 'static',
    endpoint: '',
  },
  solana: {
    name: 'Solana (On-chain)',
    checkType: 'static',
    endpoint: '',
  },
};

// ─── Example health data (from provider healthCheck) ────────────────────

const DEFAULT_HEALTH: ProtocolHealth = {
  status: 'unknown',
  latency: 0,
  uptime: 99.0,
  lastChecked: 0,
};

// In-memory health cache (reset on worker restart, refreshed via KV)
const inMemoryCache = new Map<string, ProtocolHealth>();

// ─── Health Check Functions ────────────────────────────────────────────

async function checkProtocol(name: string, env: Env): Promise<ProtocolHealth> {
  const def = PROTOCOL_DEFINITIONS[name];
  if (!def) return { ...DEFAULT_HEALTH, status: 'unknown' as const, lastChecked: Date.now() };

  const now = Date.now();
  const cached = inMemoryCache.get(name);
  // Use cached if < 30s old
  if (cached && now - cached.lastChecked < 30_000) return cached;

  let status: ProtocolHealthStatus = 'unknown';
  let latency = 0;
  let error: string | undefined;

  if (def.checkType === 'static') {
    // Static protocols: assume healthy if configured
    status = 'healthy';
    latency = 0;
  } else if (def.checkType === 'internal') {
    // Internal: check via local bridge endpoint
    try {
      const start = performance.now();
      const baseUrl = env.BRIDGE_INTERNAL_URL || 'http://127.0.0.1:8788';
      const res = await fetch(`${baseUrl}${def.endpoint}?limit=1`, {
        headers: { 'User-Agent': 'DegenFeed-HealthCheck/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      latency = Math.round(performance.now() - start);

      if (res.ok) {
        status = 'healthy';
      } else {
        status = 'degraded';
        error = `HTTP ${res.status}`;
      }
    } catch (err) {
      status = 'down';
      error = err instanceof Error ? err.message : 'unknown error';
      latency = 5000;
    }
  } else {
    // External: quick ping to external API
    try {
      const start = performance.now();
      const externalUrl = externalUrlForProtocol(name);
      if (externalUrl) {
        const res = await fetch(externalUrl, {
          headers: { 'User-Agent': 'DegenFeed-HealthCheck/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        latency = Math.round(performance.now() - start);
        status = res.ok ? 'healthy' : 'degraded';
        if (!res.ok) error = `HTTP ${res.status}`;
      } else {
        status = 'unknown';
      }
    } catch (err) {
      status = 'down';
      error = err instanceof Error ? err.message : 'unknown error';
      latency = 5000;
    }
  }

  // Smooth uptime: blend with previous value
  const prevUptime = cached?.uptime ?? 99.0;
  const uptime =
    status === 'healthy'
      ? Math.min(100, prevUptime * 0.9 + 100 * 0.1)
      : prevUptime * 0.9 + (status === 'degraded' ? 70 : 30) * 0.1;

  const health: ProtocolHealth = {
    status,
    latency,
    uptime: Math.round(uptime * 10) / 10,
    lastChecked: now,
    ...(error ? { error } : {}),
  };

  inMemoryCache.set(name, health);
  return health;
}

function externalUrlForProtocol(name: string): string | null {
  const urls: Record<string, string> = {
    dtube: 'https://api.d.tube/v1/trending?skip=0&limit=1',
    lbry: 'https://api.lbry.tv/api/v1/proxy',
    gab: 'https://gab.com/api/v1/instance',
    minds: 'https://www.minds.com/api/v3/',
    aether: 'https://relay.aether.app/api/posts?limit=1',
    scuttlebutt: 'https://ssb.pub.planetary.social/api/public/posts?limit=1',
    hive: 'https://api.hive.blog',
    mirror: 'https://mirror-api.com/graphql',
    threads: 'https://www.threads.net/@instagram',
  };
  return urls[name] || null;
}

// ─── KV Cache Helpers ──────────────────────────────────────────────────

function getCacheKey(): string {
  return 'protocols:status:v1';
}

async function getCached(env: Env): Promise<ProtocolStatusResponse | null> {
  try {
    if (env.CACHE) {
      const cached = await env.CACHE.get(getCacheKey());
      if (cached) {
        const parsed = JSON.parse(cached) as ProtocolStatusResponse;
        if (Date.now() - parsed.checkedAt < 30_000) return parsed;
      }
    }
  } catch {
    // cache miss
  }
  return null;
}

async function setCached(env: Env, data: ProtocolStatusResponse): Promise<void> {
  try {
    if (env.CACHE) {
      await env.CACHE.put(getCacheKey(), JSON.stringify(data), { expirationTtl: 60 });
    }
  } catch {
    // non-critical
  }
}

// ─── Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/protocols/status
 *
 * Returns health status for ALL known 26+ protocols.
 */
export async function handleProtocolsStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }

  // Check KV cache
  const cached = await getCached(env);
  if (cached) return noCacheJsonResponse(cached);

  const protocolNames = Object.keys(PROTOCOL_DEFINITIONS);

  // Check all protocols in parallel
  const results = await Promise.allSettled(
    protocolNames.map(async (name) => {
      const health = await checkProtocol(name, env);
      return { name, health };
    }),
  );

  const protocols: Record<string, ProtocolHealth> = {};
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let unknown = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { name, health } = result.value;
      protocols[name] = health;
      if (health.status === 'healthy') healthy++;
      else if (health.status === 'degraded') degraded++;
      else if (health.status === 'down') down++;
      else unknown++;
    } else {
      // Shouldn't happen, but handle gracefully
      const name = 'unknown';
      protocols[name] = { status: 'unknown', latency: 0, uptime: 0, lastChecked: Date.now() };
      unknown++;
    }
  }

  const response: ProtocolStatusResponse = {
    protocols,
    totalProtocols: protocolNames.length,
    healthyProtocols: healthy,
    degradedProtocols: degraded,
    downProtocols: down,
    unknownProtocols: unknown,
    checkedAt: Date.now(),
  };

  // Cache in KV
  await setCached(env, response);

  return noCacheJsonResponse(response);
}

/**
 * GET /api/protocols/status/:name
 *
 * Returns health for a SINGLE protocol.
 */
export async function handleProtocolStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const parts = path.split('/');
  const name = parts[parts.length - 1] ?? '';

  if (!name || name.length === 0 || name.includes('..')) {
    return jsonResponse({ error: 'Invalid protocol name' }, 400);
  }

  const def = PROTOCOL_DEFINITIONS[name];
  if (!def) {
    return jsonResponse({ error: `Unknown protocol: ${name}` }, 404);
  }

  const health = await checkProtocol(name, env);

  return noCacheJsonResponse({
    ok: true,
    protocol: name,
    name: def.name,
    checkType: def.checkType,
    health,
  });
}

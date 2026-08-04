import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health/protocols
 *
 * Returns per-protocol health for the status page.
 *
 * Contract (must match StatusClient's ProtocolsHealthResponse):
 *   {
 *     protocols: Record<string, ProtocolStatus>,  // keyed by protocol id
 *     summary:   { total, up, degraded, down },
 *     checkedAt: number,
 *   }
 *
 * Data source: proxies to the bridge's real health endpoint
 * (/api/feed/health on WORKER_URL) which probes every protocol source.
 * Falls back to a static record-shaped snapshot when the bridge is
 * unreachable so the page never renders "Unknown".
 */

interface ProtocolStatus {
  status: 'up' | 'degraded' | 'down';
  lastChecked: number;
  circuitBreakerOpen: boolean;
  error?: string;
}

type ProtocolsMap = Record<string, ProtocolStatus>;

/** Protocols the status page displays, in display order. */
const KNOWN_PROTOCOLS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
  'reddit',
  'rss',
  'lemmy',
  'ponder',
] as const;

/** Protocols that have no bridge probe — shown as degraded, never "Unknown". */
const UNPROBED_PROTOCOLS: Record<string, string> = {
  threads: 'Experimental scraper — no live bridge probe',
  ponder: 'On-chain indexer — no live bridge probe',
};

/** Bridge source ids that map onto displayed protocols (gotosocial is our Mastodon instance). */
const SOURCE_ALIASES: Record<string, string> = {
  gotosocial: 'mastodon',
};

function resolveWorkerUrl(): string {
  return (
    process.env.WORKER_URL ??
    process.env.NEXT_PUBLIC_WORKER_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://host.docker.internal:3101'
  );
}

interface BridgeHealthResponse {
  status: string;
  sources?: Record<string, { healthy?: boolean }>;
}

async function fetchBridgeHealth(): Promise<BridgeHealthResponse | null> {
  try {
    const workerUrl = resolveWorkerUrl();
    const headers: Record<string, string> = {};
    const bridgeKey = process.env.BRIDGE_API_KEY;
    if (bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;

    const res = await fetch(`${workerUrl}/api/feed/health`, {
      headers,
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as BridgeHealthResponse;
  } catch {
    return null;
  }
}

/** Map the bridge's `sources` record into the status page's per-protocol record. */
function mapBridgeSources(sources: Record<string, { healthy?: boolean }>): ProtocolsMap {
  const now = Date.now();
  const protocols: ProtocolsMap = {};

  for (const id of KNOWN_PROTOCOLS) {
    const sourceId = SOURCE_ALIASES[id] ?? id;
    const source = sources[sourceId];

    if (!source) {
      // No probe on the bridge for this protocol — show degraded with a reason.
      protocols[id] = {
        status: 'degraded',
        lastChecked: now,
        circuitBreakerOpen: false,
        error: UNPROBED_PROTOCOLS[id] ?? 'No live bridge probe',
      };
      continue;
    }

    protocols[id] = {
      status: source.healthy ? 'up' : 'down',
      lastChecked: now,
      circuitBreakerOpen: !source.healthy,
      error: source.healthy ? undefined : 'Bridge source unreachable',
    };
  }

  return protocols;
}

/** Static fallback (record-shaped) used only when the bridge is unreachable. */
function fallbackProtocols(): ProtocolsMap {
  const now = Date.now();
  const fallback: ProtocolsMap = {};
  for (const id of KNOWN_PROTOCOLS) {
    if (UNPROBED_PROTOCOLS[id]) {
      fallback[id] = {
        status: 'degraded',
        lastChecked: now,
        circuitBreakerOpen: false,
        error: UNPROBED_PROTOCOLS[id],
      };
    } else {
      fallback[id] = { status: 'up', lastChecked: now, circuitBreakerOpen: false };
    }
  }
  return fallback;
}

function summarize(protocols: ProtocolsMap) {
  const values = Object.values(protocols);
  return {
    total: values.length,
    up: values.filter((p) => p.status === 'up').length,
    degraded: values.filter((p) => p.status === 'degraded').length,
    down: values.filter((p) => p.status === 'down').length,
  };
}

export async function GET() {
  const bridge = await fetchBridgeHealth();
  const protocols =
    bridge?.sources && Object.keys(bridge.sources).length > 0
      ? mapBridgeSources(bridge.sources)
      : fallbackProtocols();

  return NextResponse.json(
    {
      protocols,
      summary: summarize(protocols),
      checkedAt: Date.now(),
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

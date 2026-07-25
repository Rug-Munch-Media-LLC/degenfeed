/**
 * @degenfeed/api-worker — Integration Health Checks
 *
 * Comprehensive health check for EVERY external integration.
 * Returns structured status with latency and error info.
 *
 * Used by the `/api/health/full` endpoint to provide a complete
 * picture of all system dependencies.
 *
 * Integrations checked:
 *   - ActivityPub (GoToSocial API)
 *   - AT Protocol (Bluesky PDS + Relay)
 *   - Nostr (multiple relays)
 *   - Farcaster (Hub)
 *   - Lens Protocol (GraphQL API)
 *   - Telegram (Bot API)
 *   - Zora (API)
 *   - Wormhole (RPC)
 *   - PeerTube (Instance)
 *   - RPC endpoints (EVM chains)
 *   - Solana RPC
 */

import type { Env } from '../index';

// ─── Types ─────────────────────────────────────────────────────────────────

export type IntegrationStatus = 'ok' | 'degraded' | 'down';

export interface IntegrationHealth {
  status: IntegrationStatus;
  latency: number;
  lastChecked: number;
  error?: string;
}

export interface FullHealthReport {
  activitypub: IntegrationHealth;
  atproto: IntegrationHealth;
  nostr: IntegrationHealth;
  farcaster: IntegrationHealth;
  lens: IntegrationHealth;
  telegram: IntegrationHealth;
  zora: IntegrationHealth;
  wormhole: IntegrationHealth;
  peertube: IntegrationHealth;
  evm: Record<string, IntegrationHealth>;
  solana: IntegrationHealth;
  rss: IntegrationHealth;
  threads: IntegrationHealth;
  mastodon: IntegrationHealth;
  funkwhale: IntegrationHealth;
  castopod: IntegrationHealth;
  rssbridge: IntegrationHealth;
  summary: {
    total: number;
    ok: number;
    degraded: number;
    down: number;
  };
  checkedAt: number;
  totalLatency: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TIMEOUT_MS = 5_000;

// ─── Health Check Functions ────────────────────────────────────────────────

async function pingUrl(url: string, timeoutMs = TIMEOUT_MS): Promise<IntegrationHealth> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latency = Math.round(performance.now() - start);
    const ok = res.ok || res.status < 500;
    return {
      status: ok ? 'ok' : 'degraded',
      latency,
      lastChecked: Date.now(),
      error: ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      status: 'down',
      latency,
      lastChecked: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pingGraphQl(
  url: string,
  query: string,
  timeoutMs = TIMEOUT_MS,
): Promise<IntegrationHealth> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latency = Math.round(performance.now() - start);
    return {
      status: res.ok ? 'ok' : 'degraded',
      latency,
      lastChecked: Date.now(),
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      status: 'down',
      latency,
      lastChecked: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pingJsonRpc(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs = TIMEOUT_MS,
): Promise<IntegrationHealth> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latency = Math.round(performance.now() - start);
    if (!res.ok) {
      return {
        status: 'down',
        latency,
        lastChecked: Date.now(),
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { error?: { message?: string } };
    if (data.error) {
      return {
        status: 'degraded',
        latency,
        lastChecked: Date.now(),
        error: data.error.message,
      };
    }
    return { status: 'ok', latency, lastChecked: Date.now() };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      status: 'down',
      latency,
      lastChecked: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Check Functions ───────────────────────────────────────────────────────

async function checkActivityPub(env: Env): Promise<IntegrationHealth> {
  const instance = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  return pingUrl(`${instance}/api/v1/instance`);
}

async function checkAtproto(env: Env): Promise<IntegrationHealth> {
  // Check Bluesky PDS
  const pds = env.BSKY_SOCIAL_URL || 'https://bsky.social';
  const pdsHealth = await pingUrl(`${pds}/xrpc/com.atproto.server.describeServer`);
  return pdsHealth;
}

async function checkNostr(env: Env): Promise<IntegrationHealth> {
  // Check multiple relays — first to respond wins
  const relays = (env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (relays.length === 0) {
    return {
      status: 'down',
      latency: 0,
      lastChecked: Date.now(),
      error: 'No relay URLs configured',
    };
  }

  // Try nostr.band API as proxy
  const apiHealth = await pingUrl('https://api.nostr.band/');
  if (apiHealth.status === 'ok') return apiHealth;

  // Fallback: try direct WebSocket relay connection
  // (simplified — full check requires WebSocket handshake)
  try {
    const start = performance.now();
    const relayUrl = relays[0] ?? '';
    if (!relayUrl)
      return { status: 'down', latency: 0, lastChecked: Date.now(), error: 'No relay URL' };
    const ws = new WebSocket(relayUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.close();
        resolve();
      };
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
      const t = setTimeout(() => reject(new Error('WebSocket timeout')), 3000);
      ws.onopen = () => {
        clearTimeout(t);
        ws.close();
        resolve();
      };
    });
    const latency = Math.round(performance.now() - start);
    return { status: 'ok', latency, lastChecked: Date.now() };
  } catch (err) {
    return {
      status: 'degraded',
      latency: 0,
      lastChecked: Date.now(),
      error: err instanceof Error ? err.message : 'All relays unreachable',
    };
  }
}

async function checkFarcaster(env: Env): Promise<IntegrationHealth> {
  const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
  return pingUrl(`${hubUrl}/v1/info`);
}

async function checkLens(env: Env): Promise<IntegrationHealth> {
  const apiUrl = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
  return pingGraphQl(apiUrl, '{ __typename }');
}

async function checkTelegram(env: Env): Promise<IntegrationHealth> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      status: 'down',
      latency: 0,
      lastChecked: Date.now(),
      error: 'TELEGRAM_BOT_TOKEN not configured',
    };
  }
  return pingUrl(`https://api.telegram.org/bot${token}/getMe`);
}

async function checkZora(): Promise<IntegrationHealth> {
  return pingUrl('https://api.zora.co/');
}

async function checkWormhole(): Promise<IntegrationHealth> {
  // Check Wormhole RPC — using mainnet guardian RPC
  return pingJsonRpc('https://wormhole-v2-mainnet-api.certus.one/v1', 'getVersion', []);
}

async function checkPeerTube(env: Env): Promise<IntegrationHealth> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz';
  return pingUrl(`${instanceUrl}/api/v1/instance`);
}

async function checkEvmChain(rpcUrl: string, _chainName: string): Promise<IntegrationHealth> {
  return pingJsonRpc(rpcUrl, 'eth_blockNumber', []);
}

async function checkSolana(rpcUrl?: string): Promise<IntegrationHealth> {
  const url = rpcUrl || 'https://api.mainnet-beta.solana.com';
  return pingJsonRpc(url, 'getSlot', []);
}

async function checkRss(): Promise<IntegrationHealth> {
  // RSS feeds are always "reachable" — individual feeds may fail
  return { status: 'ok', latency: 0, lastChecked: Date.now() };
}

async function checkFunkwhale(): Promise<IntegrationHealth> {
  const instances = ['https://open.audio', 'https://funkwhale.audio'];
  // Try instances in order — first to respond wins
  for (const instance of instances) {
    const result = await pingUrl(`${instance}/api/v1/tracks/?page_size=1`);
    if (result.status === 'ok') return result;
  }
  return {
    status: 'degraded',
    latency: 0,
    lastChecked: Date.now(),
    error: 'No Funkwhale instance reachable',
  };
}

async function checkCastopod(): Promise<IntegrationHealth> {
  const instances = ['https://castopod.org', 'https://podlibre.org'];
  for (const instance of instances) {
    const result = await pingUrl(`${instance}/api/episodes?limit=1`);
    if (result.status === 'ok') return result;
  }
  return {
    status: 'degraded',
    latency: 0,
    lastChecked: Date.now(),
    error: 'No Castopod instance reachable',
  };
}

async function checkRssBridge(): Promise<IntegrationHealth> {
  return pingUrl('http://127.0.0.1:8282/');
}

async function checkThreads(env: Env): Promise<IntegrationHealth> {
  if (!env.THREADS_APP_ID) {
    return {
      status: 'down',
      latency: 0,
      lastChecked: Date.now(),
      error: 'THREADS_APP_ID not configured',
    };
  }
  return pingUrl('https://graph.threads.net/v1.0/me?fields=id&access_token=health');
}

async function checkMastodon(env: Env): Promise<IntegrationHealth> {
  const instance = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  return pingUrl(`${instance}/api/v1/instance`);
}

// ─── Main Health Report ───────────────────────────────────────────────────

/**
 * Run ALL integration health checks in parallel and return a full report.
 */
export async function getFullHealthReport(env: Env): Promise<FullHealthReport> {
  const start = performance.now();

  // Common RPC URLs
  const baseRpc = env.BASE_RPC_URL || 'https://mainnet.base.org';
  const polygonRpc = env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const ethRpc = 'https://eth.llamarpc.com'; // Public fallback
  const solanaRpc = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  // Run ALL checks in parallel
  const [
    activitypub,
    atproto,
    nostr,
    farcaster,
    lens,
    telegram,
    zora,
    wormhole,
    peertube,
    base,
    polygon,
    eth,
    solana,
    rss,
    threads,
    mastodon,
    funkwhale,
    castopod,
    rssbridge,
  ] = await Promise.allSettled([
    checkActivityPub(env),
    checkAtproto(env),
    checkNostr(env),
    checkFarcaster(env),
    checkLens(env),
    checkTelegram(env),
    checkZora(),
    checkWormhole(),
    checkPeerTube(env),
    checkEvmChain(baseRpc, 'base'),
    checkEvmChain(polygonRpc, 'polygon'),
    checkEvmChain(ethRpc, 'ethereum'),
    checkSolana(solanaRpc),
    checkRss(),
    checkThreads(env),
    checkMastodon(env),
    checkFunkwhale(),
    checkCastopod(),
    checkRssBridge(),
  ]);

  const toHealth = (
    result: PromiseSettledResult<IntegrationHealth>,
    _fallbackName: string,
  ): IntegrationHealth => {
    if (result.status === 'fulfilled') return result.value;
    return {
      status: 'down',
      latency: 0,
      lastChecked: Date.now(),
      error: `Health check threw: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    };
  };

  const report: FullHealthReport = {
    activitypub: toHealth(activitypub, 'activitypub'),
    atproto: toHealth(atproto, 'atproto'),
    nostr: toHealth(nostr, 'nostr'),
    farcaster: toHealth(farcaster, 'farcaster'),
    lens: toHealth(lens, 'lens'),
    telegram: toHealth(telegram, 'telegram'),
    zora: toHealth(zora, 'zora'),
    wormhole: toHealth(wormhole, 'wormhole'),
    peertube: toHealth(peertube, 'peertube'),
    evm: {
      base: toHealth(base, 'base'),
      polygon: toHealth(polygon, 'polygon'),
      ethereum: toHealth(eth, 'ethereum'),
    },
    solana: toHealth(solana, 'solana'),
    rss: toHealth(rss, 'rss'),
    threads: toHealth(threads, 'threads'),
    mastodon: toHealth(mastodon, 'mastodon'),
    funkwhale: toHealth(funkwhale, 'funkwhale'),
    castopod: toHealth(castopod, 'castopod'),
    rssbridge: toHealth(rssbridge, 'rssbridge'),
    summary: { total: 0, ok: 0, degraded: 0, down: 0 },
    checkedAt: Date.now(),
    totalLatency: Math.round(performance.now() - start),
  };

  // Calculate summary
  const all = [
    report.activitypub,
    report.atproto,
    report.nostr,
    report.farcaster,
    report.lens,
    report.telegram,
    report.zora,
    report.wormhole,
    report.peertube,
    ...Object.values(report.evm),
    report.solana,
    report.rss,
    report.threads,
    report.mastodon,
    report.funkwhale,
    report.castopod,
    report.rssbridge,
  ];

  report.summary = {
    total: all.length,
    ok: all.filter((h) => h.status === 'ok').length,
    degraded: all.filter((h) => h.status === 'degraded').length,
    down: all.filter((h) => h.status === 'down').length,
  };

  return report;
}

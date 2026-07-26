/**
 * @degenfeed/api-worker — Bridge Health Monitor
 *
 * Checks protocol API reachability across all supported protocols.
 */

import type { Env } from '../types';
import { getCircuitBreaker } from './bridge-reliability-circuit';
import type {
  BridgeHealthReport,
  ProtocolHealth,
  ProtocolHealthCheckResult,
  ProtocolStatus,
} from './bridge-reliability-types';

// ─── Health Checkers ─────────────────────────────────────

async function pingUrl(url: string): Promise<ProtocolHealthCheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const latency = Math.round(performance.now() - start);
    return {
      reachable: res.ok,
      latencyMs: latency,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      reachable: false,
      latencyMs: latency,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pingGraphQl(url: string, query: string): Promise<ProtocolHealthCheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(5_000),
    });
    const latency = Math.round(performance.now() - start);
    return { reachable: res.ok, latencyMs: latency };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return {
      reachable: false,
      latencyMs: latency,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const PROTOCOL_HEALTH_CHECKS: Record<string, (env: Env) => Promise<ProtocolHealthCheckResult>> = {
  // Tier 1: Core Social
  mastodon: async (env) =>
    pingUrl(`${env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz'}/api/v1/instance`),
  activitypub: async (env) =>
    pingUrl(`${env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz'}/api/v1/instance`),
  bluesky: async (env) =>
    pingUrl(
      `${env.BSKY_SOCIAL_URL || 'https://bsky.social'}/xrpc/com.atproto.server.describeServer`,
    ),
  atproto: async (env) =>
    pingUrl(
      `${env.BSKY_SOCIAL_URL || 'https://bsky.social'}/xrpc/com.atproto.server.describeServer`,
    ),
  nostr: async () => pingUrl('https://api.nostr.band/'),
  farcaster: async (env) => pingUrl(`${env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281'}/v1/info`),
  lens: async (env) =>
    pingGraphQl(env.LENS_API_URL || 'https://api-v2.lens.dev/graphql', '{ __typename }'),
  telegram: async (env) => {
    if (!env.TELEGRAM_BOT_TOKEN)
      return { reachable: false, latencyMs: 0, error: 'TELEGRAM_BOT_TOKEN not configured' };
    return pingUrl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
  },
  rss: async () => ({ reachable: true, latencyMs: 0 }),
  zora: async () => pingUrl('https://api.zora.co/'),
  threads: async () => pingUrl('https://graph.threads.net/v1.0/me?fields=id&access_token=health'),

  // Tier 2: Established Federated
  lemmy: async () => pingUrl('https://lemmy.ml/api/v3/site'),
  pixelfed: async () => pingUrl('https://pixelfed.social/api/v1/instance'),
  peertube: async () => pingUrl('https://peertube.tv/api/v1/instance'),
  reddit: async (env) => pingUrl(`${env.REDLIB_URL || 'https://redlib.degenfeed.xyz'}/settings`),
  mirror: async () => pingUrl('https://mirror.xyz/'),
  hive: async () => pingUrl('https://api.hive.blog/'),
  dtube: async () => pingUrl('https://api.d.tube/'),
  lbry: async () => pingUrl('https://api.lbry.tv/lbry/api/v1/proxy?m=version'),
  pleroma: async () => pingUrl('https://pleroma.site/api/v1/instance'),
  misskey: async () => pingUrl('https://misskey.io/api/instance'),
  writefreely: async () => pingUrl('https://write.as/api/instance'),
  funkwhale: async () => pingUrl('https://open.audio/api/v1/instance'),
  castopod: async () => pingUrl('https://castopod.org/api/v1/instance'),
  subsocial: async () => pingUrl('https://squid.subsquid.io/subsocial/graphql'),
  steem: async () => pingUrl('https://api.steemit.com/'),

  // Tier 3: ActivityPub Ecosystem
  diaspora: async () => pingUrl('https://diasp.org/'),
  friendica: async () => pingUrl('https://friendi.ca/'),
  mediagoblin: async () => pingUrl('https://mediagoblin.org/'),
  bookwyrm: async () => pingUrl('https://bookwyrm.social/'),
  mobilizon: async () => pingUrl('https://mobilizon.org/'),
  bonfire: async () => pingUrl('https://bonfirenetworks.org/'),
  mitra: async () => pingUrl('https://mitra.social/'),
  takahe: async () => pingUrl('https://takahe.org.nz/'),
  forgejo: async () => pingUrl('https://forgejo.org/'),
  owncast: async () => pingUrl('https://owncast.online/'),
  faircamp: async () => pingUrl('https://listen.merveilles.town/feed.xml'),

  // Tier 4: Experimental / Blockchain
  gab: async () => pingUrl('https://gab.com/'),
  minds: async () => pingUrl('https://www.minds.com/'),
  aether: async () => pingUrl('https://getaether.net/'),
  scuttlebutt: async () => pingUrl('https://scuttlebutt.nz/'),
  deso: async () => pingUrl('https://api.deso.org/api/v0/get-hot-feed'),
  session: async () => pingUrl('https://sogs.session.foundation/room/about'),
  cyberconnect: async () => pingUrl('https://api.cyberconnect.dev/'),
  arena: async () => pingUrl('https://api.arena.social/'),
  microblog: async () => pingUrl('https://micro.blog/posts/discover'),
  orbis: async () => pingUrl('https://ceramic.orbis.club/'),
  ceramic: async () => {
    const start = performance.now();
    try {
      const res = await fetch('https://ceramic.orbis.club/api/v1/streams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query { streamsConnection(first: 1) { edges { node { streamId } } } }`,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Math.round(performance.now() - start);
      return { reachable: res.ok, latencyMs: latency };
    } catch (err) {
      return {
        reachable: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
  audius: async () => pingUrl('https://api.audius.co/'),
  rarible: async () => pingUrl('https://api.rarible.org/v0.1/'),

  // Tier 5: Infrastructure / Web3
  xmtp: async () => {
    const start = performance.now();
    try {
      const res = await fetch('https://api.xmtp.org/v1/health', {
        signal: AbortSignal.timeout(5_000),
      });
      return { reachable: res.ok, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        reachable: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

// ─── Helpers ─────────────────────────────────────

function normalizeProtocolName(p: string): string {
  const lower = p.toLowerCase();
  if (lower === 'activitypub' || lower === 'mastodon') return 'mastodon';
  if (lower === 'atproto' || lower === 'bluesky') return 'bluesky';
  return lower;
}

// ─── Monitor ─────────────────────────────────────────────

export class BridgeHealthMonitor {
  private cb = getCircuitBreaker();

  constructor(env?: Env) {
    this.cb = getCircuitBreaker(env);
  }

  async checkProtocolHealth(protocol: string, env: Env): Promise<ProtocolHealth> {
    const normalized = normalizeProtocolName(protocol);
    const checker = PROTOCOL_HEALTH_CHECKS[normalized];
    const now = Date.now();
    const circuitState = await this.cb.getCircuitState(protocol);

    let healthResult: ProtocolHealthCheckResult;
    if (checker) {
      healthResult = await checker(env);
    } else {
      healthResult = { reachable: false, latencyMs: 0, error: `No health check for ${protocol}` };
    }

    return {
      protocol,
      reachable: healthResult.reachable,
      latencyMs: healthResult.latencyMs,
      successRate24h:
        circuitState.failureCount > 0
          ? Math.max(
              0,
              1 -
                circuitState.failureCount /
                  (circuitState.failureCount + Math.max(1, circuitState.successCount)),
            )
          : 1,
      rateLimitRemaining: healthResult.error ? 0 : 100,
      circuitBreakerOpen: circuitState.state === 'open',
      circuitBreakerState: circuitState.state,
      lastSuccessAt: circuitState.lastSuccessAt,
      lastErrorAt: circuitState.lastFailureAt,
      lastError: circuitState.lastError ?? healthResult.error,
      consecutiveFailures: circuitState.failureCount,
      checkedAt: now,
    };
  }

  async getOverallHealth(env: Env): Promise<BridgeHealthReport> {
    const start = performance.now();
    const allProtocols = Object.keys(PROTOCOL_HEALTH_CHECKS);

    const checks = allProtocols.map(async (protocol) => {
      try {
        return await this.checkProtocolHealth(protocol, env);
      } catch (err) {
        return {
          protocol,
          reachable: false,
          latencyMs: 0,
          successRate24h: 0,
          rateLimitRemaining: 0,
          circuitBreakerOpen: true,
          circuitBreakerState: 'open' as const,
          lastSuccessAt: null,
          lastErrorAt: Date.now(),
          lastError: err instanceof Error ? err.message : String(err),
          consecutiveFailures: 999,
          checkedAt: Date.now(),
        };
      }
    });

    const results = await Promise.all(checks);
    const protocols: Record<string, ProtocolHealth> = {};
    for (const r of results) protocols[r.protocol] = r;

    const values = Object.values(protocols);
    const up = values.filter((v) => v.reachable && !v.circuitBreakerOpen).length;
    const down = values.filter((v) => !v.reachable || v.circuitBreakerOpen).length;
    const overall: ProtocolStatus =
      up === values.length ? 'up' : down === values.length ? 'down' : 'degraded';

    return {
      overall,
      protocols,
      summary: { total: values.length, up, degraded: values.length - up - down, down },
      checkedAt: Date.now(),
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

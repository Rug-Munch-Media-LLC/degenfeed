/**
 * @degenfeed/api-worker — Bridge Stats Tracking
 *
 * Record and query protocol bridge operation statistics.
 */

import type { Env } from '../types';
import { getCircuitBreaker } from './bridge-reliability-circuit';
import type { BridgeStats, ProtocolStats } from './bridge-reliability-types';

const OPERATION_STATS_PREFIX = 'bridge-stats:';
const ALL_PROTOCOLS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'lemmy',
  'pixelfed',
  'peertube',
  'threads',
  'zora',
  'reddit',
  'rss',
  'mirror',
  'hive',
  'dtube',
  'lbry',
  'pleroma',
  'misskey',
  'writefreely',
  'funkwhale',
  'castopod',
  'subsocial',
  'steem',
  'telegram',
  'diaspora',
  'friendica',
  'mediagoblin',
  'bookwyrm',
  'mobilizon',
  'bonfire',
  'mitra',
  'takahe',
  'forgejo',
  'owncast',
  'faircamp',
  'gab',
  'minds',
  'aether',
  'scuttlebutt',
  'deso',
  'session',
  'cyberconnect',
  'arena',
  'microblog',
  'orbis',
  'ceramic',
  'audius',
  'rarible',
  'xmtp',
  'push',
  'huddle01',
  'tableland',
  'ponder',
  'ethereum',
  'solana',
  'kbin',
  'tildes',
  'discord',
  'matrix',
  'github',
];

export async function recordBridgeOperation(
  env: Env,
  protocol: string,
  success: boolean,
  latencyMs: number,
  error?: string,
): Promise<void> {
  if (!env.CACHE) return;
  const date = new Date();
  const hourKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}`;
  const key = `${OPERATION_STATS_PREFIX}${protocol}:${hourKey}`;
  try {
    const raw = await env.CACHE.get(key);
    const current = raw
      ? (JSON.parse(raw) as {
          total: number;
          success: number;
          totalLatency: number;
          errors: string[];
        })
      : { total: 0, success: 0, totalLatency: 0, errors: [] };
    current.total++;
    if (success) current.success++;
    current.totalLatency += latencyMs;
    if (error) current.errors = [...current.errors.slice(-9), error];
    await env.CACHE.put(key, JSON.stringify(current), { expirationTtl: 86400 * 7 });
  } catch {
    /* non-critical */
  }
}

export async function getProtocolStats(env: Env, protocol: string): Promise<ProtocolStats> {
  if (!env.CACHE) return emptyStats();
  const now = new Date();
  const hours: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    hours.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`,
    );
  }

  const cb = getCircuitBreaker(env);
  const circuitState = await cb.getCircuitState(protocol);
  let totalOps = 0,
    successOps = 0,
    totalLatency = 0;
  let lastError: string | undefined;

  for (const hour of hours) {
    try {
      const raw = await env.CACHE.get(`${OPERATION_STATS_PREFIX}${protocol}:${hour}`);
      if (raw) {
        const data = JSON.parse(raw) as {
          total: number;
          success: number;
          totalLatency: number;
          errors: string[];
        };
        totalOps += data.total;
        successOps += data.success;
        totalLatency += data.totalLatency;
        if (data.errors.length > 0) lastError = data.errors[data.errors.length - 1];
      }
    } catch {
      /* skip */
    }
  }

  return {
    totalOps,
    successOps,
    failedOps: totalOps - successOps,
    successRate: totalOps > 0 ? successOps / totalOps : 1,
    totalLatency,
    avgLatencyMs: totalOps > 0 ? Math.round(totalLatency / totalOps) : 0,
    circuitBreakerTripped: circuitState.state === 'open',
    lastError,
  };
}

export async function getAllBridgeStats(env: Env): Promise<BridgeStats> {
  const byProtocol: Record<string, ProtocolStats> = {};
  let totalOps = 0,
    successOps = 0,
    totalLatency = 0,
    circuitBreakerTrips = 0;

  for (const p of ALL_PROTOCOLS) {
    const stats = await getProtocolStats(env, p);
    byProtocol[p] = stats;
    totalOps += stats.totalOps;
    successOps += stats.successOps;
    totalLatency += stats.totalLatency;
    if (stats.circuitBreakerTripped) circuitBreakerTrips++;
  }

  const now = Date.now();
  return {
    periodStart: now - 86400_000,
    periodEnd: now,
    totalOperations: totalOps,
    successfulOperations: successOps,
    failedOperations: totalOps - successOps,
    successRate: totalOps > 0 ? successOps / totalOps : 1,
    totalLatencyMs: totalLatency,
    avgLatencyMs: totalOps > 0 ? Math.round(totalLatency / totalOps) : 0,
    byProtocol,
    circuitBreakerTrips,
  };
}

function emptyStats(): ProtocolStats {
  return {
    totalOps: 0,
    successOps: 0,
    failedOps: 0,
    successRate: 1,
    totalLatency: 0,
    avgLatencyMs: 0,
    circuitBreakerTripped: false,
  };
}

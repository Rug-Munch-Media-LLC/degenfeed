/**
 * /api/chat/health — Comprehensive Chat Health Dashboard
 *
 * Monitors the entire chat fabric: Conduit, all bridges, federation, and metrics.
 *
 * GET /api/chat/health       — Full health dashboard
 * GET /api/chat/health/quick — Quick status (lighter weight)
 * GET /api/chat/health/bridges — All bridge statuses
 *
 * Returns:
 *   - Conduit status: online/offline
 *   - Per-bridge status: online/degraded/offline
 *   - Federation status: connected/disconnected
 *   - Metrics: total rooms/users, active users, message throughput
 *   - Bridge coverage percentage
 */

import {
  jsonResponse,
  methodNotAllowed,
  noCacheJsonResponse,
  serverError,
} from '../response-helpers';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/health
// ═══════════════════════════════════════════════════════════════════════════

export async function handleChatHealth(_request: Request, env: Env): Promise<Response> {
  try {
    const { getChatHealth } = await import('../lib/chat-matrix');

    const health = await getChatHealth(env);

    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 200 // Still return data, just marked degraded
          : 503;

    return noCacheJsonResponse(health);
  } catch (err) {
    return jsonResponse(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Health check failed',
        timestamp: Date.now(),
      },
      500,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/health/quick
// ═══════════════════════════════════════════════════════════════════════════

export async function handleChatHealthQuick(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const CONDUIT_URL = process.env.CONDUIT_URL || 'http://localhost:8448';

    // Quick check — just Conduit and bridge count
    const [conduitStatus, bridgesStatus] = await Promise.allSettled([
      fetch(`${CONDUIT_URL}/_matrix/client/v3/versions`, { signal: AbortSignal.timeout(3000) }),
      fetch('http://matrix-irc:8090/health', { signal: AbortSignal.timeout(2000) }).catch(  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
        () => null,
      ),
    ]);

    const conduitOk = conduitStatus.status === 'fulfilled' && conduitStatus.value.ok;

    return noCacheJsonResponse({
      status: conduitOk ? 'healthy' : 'down',
      conduit: conduitOk ? 'online' : 'offline',
      bridgeReachable: bridgesStatus.status === 'fulfilled',
      timestamp: Date.now(),
    });
  } catch {
    return jsonResponse({ status: 'down', conduit: 'offline', timestamp: Date.now() }, 503);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/health/bridges
// ═══════════════════════════════════════════════════════════════════════════

export async function handleBridgeHealth(_request: Request, env: Env): Promise<Response> {
  try {
    const bridgeConfigs = [
      { name: 'IRC', protocol: 'irc', url: 'http://matrix-irc:8090' },
      { name: 'XMPP', protocol: 'xmpp', url: 'http://matrix-xmpp:8080' },
      { name: 'Telegram', protocol: 'telegram', url: 'http://matrix-telegram:8080' },
      { name: 'Discord', protocol: 'discord', url: 'http://matrix-discord:9005' },
      { name: 'Slack', protocol: 'slack', url: 'http://matrix-slack:8080' },
      { name: 'Signal', protocol: 'signal', url: 'http://matrix-signal:8080' },
      { name: 'WhatsApp', protocol: 'whatsapp', url: 'http://matrix-whatsapp:8080' },
      { name: 'Nostr', protocol: 'nostr', url: 'http://matrix-nostr:8080' },
    ];

    const results = await Promise.allSettled(
      bridgeConfigs.map(async (bridge) => {
        const start = Date.now();
        try {
          const res = await fetch(`${bridge.url}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          const latencyMs = Date.now() - start;
          const data = res.ok ? await res.json().catch(() => ({})) : {};

          return {
            name: bridge.name,
            protocol: bridge.protocol,
            status: res.ok ? 'online' : 'degraded',
            latencyMs,
            detail: data,
          };
        } catch {
          return {
            name: bridge.name,
            protocol: bridge.protocol,
            status: 'offline' as const,
            latencyMs: Date.now() - start,
          };
        }
      }),
    );

    const bridges = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: 'unknown', protocol: 'unknown', status: 'offline', latencyMs: 0 },
    );

    const online = bridges.filter((b) => b.status === 'online').length;
    const total = bridges.length;

    return noCacheJsonResponse({
      ok: true,
      timestamp: Date.now(),
      summary: {
        total,
        online,
        degraded: bridges.filter((b) => b.status === 'degraded').length,
        offline: bridges.filter((b) => b.status === 'offline').length,
        coverage: Math.round((online / total) * 100),
      },
      bridges,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Bridge health check failed');
  }
}

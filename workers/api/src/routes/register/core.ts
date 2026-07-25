/**
 * @degenfeed/api-worker — Core route registration
 *
 * Landing pages, health, bridge health, protocol status, deploy.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';

export function registerCoreRoutes(app: Hono<{ Bindings: Env }>): void {
  // ─── Health endpoints ─────────────────────────────────────
  app.get('/api/health', async (c) => {
    const { handleRelaysHealth } = await import('../health');
    const relayResp = await handleRelaysHealth(c.env);
    const relayBody = await relayResp.json();
    const { getErrorCounts } = await import('../../error-logger');
    const errorCounts = await getErrorCounts(c.env);
    return jsonResponse({
      status: 'ok',
      service: 'degenfeed-api',
      version: '0.2.0',
      relays: (relayBody as Record<string, unknown>).relays,
      healthy: (relayBody as Record<string, unknown>).healthy,
      ...(errorCounts
        ? {
            errors: {
              total: errorCounts.total,
              byRoute: errorCounts.byRoute,
              since: errorCounts.since,
            },
          }
        : {}),
      checkedAt: Date.now(),
    });
  });
  app.get('/api/health/protocols', async (c) => {
    const { handleProtocolsHealth } = await import('../health');
    return handleProtocolsHealth(c.env);
  });
  app.get('/api/health/full', async (c) => {
    const { handleFullHealth } = await import('../health');
    return handleFullHealth(c.env);
  });

  // ─── Bridge health ────────────────────────────────────
  app.get('/api/bridge/health', async (c) => {
    const { handleBridgeHealth } = await import('../bridge-health');
    return handleBridgeHealth(c.req.raw, c.env);
  });

  // ─── Deploy ──────────────────────────────────────────
  app.all('/api/deploy/request', async (c) => {
    const { handleDeployRequest } = await import('../deploy');
    return handleDeployRequest(c.req.raw, c.env);
  });
  app.all('/api/deploy/status', async (c) => {
    const { handleDeployStatus } = await import('../deploy');
    return handleDeployStatus(c.req.raw, c.env);
  });
}

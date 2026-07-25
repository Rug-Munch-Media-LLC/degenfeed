/**
 * @degenfeed/api-worker — Social route registration hub
 *
 * Dispatches to domain-specific registration modules.
 * Each module handles its own imports and route registrations.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { registerSocialCoreRoutes } from './social-core';
import { registerSocialIdentityRoutes } from './social-identity';
import { registerSocialLemmyRoutes } from './social-lemmy';
import { registerSocialPlatformsRoutes } from './social-platforms';
import { registerSocialTipsRoutes } from './social-tips';

export function registerSocialRoutes(app: Hono<{ Bindings: Env }>): void {
  registerSocialCoreRoutes(app);
  registerSocialTipsRoutes(app);
  registerSocialLemmyRoutes(app);
  registerSocialPlatformsRoutes(app);
  registerSocialIdentityRoutes(app);

  // ─── Creator Earnings ────────────────────────────────────
  app.get('/api/creator/earnings', async (c) => {
    const { handleCreatorEarnings, handleEarningsWithdraw } = await import(
      '../../routes/creator-earnings'
    );
    return handleCreatorEarnings(c.req.raw, c.env);
  });
  app.post('/api/creator/earnings/withdraw', async (c) => {
    const { handleEarningsWithdraw } = await import('../../routes/creator-earnings');
    return handleEarningsWithdraw(c.req.raw, c.env);
  });
}

/**
 * @degenfeed/api-worker — Route registration hub
 *
 * Exports a single registerRoutes() that invokes all domain-specific
 * route registrations. Keeps app.ts focused on middleware and setup.
 *
 * Each domain module below internally handles its own handler imports
 * and Hono route registrations.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { registerCoreRoutes } from './core';
import { registerFeedRoutes } from './feed';
import { registerContentRoutes } from './content';
import { registerSocialRoutes } from './social';
import { registerDAORoutes } from './dao';
import { registerV1Routes } from './v1';
import { registerIntegrationRoutes } from './integrations';
import { registerLiveRoutes } from './live';

export function registerRoutes(app: Hono<{ Bindings: Env }>): void {
  registerCoreRoutes(app);
  registerFeedRoutes(app);
  registerContentRoutes(app);
  registerSocialRoutes(app);
  registerDAORoutes(app);
  registerIntegrationRoutes(app);
  registerLiveRoutes(app);
  registerV1Routes(app);
}

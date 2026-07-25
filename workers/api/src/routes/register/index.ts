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
import { registerCoinsRoutes } from './coins';
import { registerCoreRoutes } from './core';
import { registerDaoRoutes } from './dao';
import { registerFeedRoutes } from './feed';
import { registerFramesRoutes } from './frames';
import { registerLiveRoutes } from './live';
import { registerMediaRoutes } from './media';
import { registerMessagingRoutes } from './messaging';
import { registerNostrGroupRoutes } from './nostr-groups';
import { registerSocialRoutes } from './social';
import { registerZoraRoutes } from './zora';

export function registerRoutes(app: Hono<{ Bindings: Env }>): void {
  registerCoreRoutes(app);
  registerFeedRoutes(app);
  registerSocialRoutes(app);
  registerDaoRoutes(app);
  registerCoinsRoutes(app);
  registerMediaRoutes(app);
  registerMessagingRoutes(app);
  registerLiveRoutes(app);
  registerFramesRoutes(app);
  registerNostrGroupRoutes(app);
  registerZoraRoutes(app);
}

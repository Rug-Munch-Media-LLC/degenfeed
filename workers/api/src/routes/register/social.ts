/**
 * @degenfeed/api-worker — Social route registration hub
 *
 * Dispatches to domain-specific registration modules.
 * Each module handles its own imports and route registrations.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { registerSocialCoreRoutes } from './social-core';
import { registerSocialTipsRoutes } from './social-tips';
import { registerSocialLemmyRoutes } from './social-lemmy';
import { registerSocialPlatformsRoutes } from './social-platforms';
import { registerSocialIdentityRoutes } from './social-identity';

export function registerSocialRoutes(app: Hono<{ Bindings: Env }>): void {
  registerSocialCoreRoutes(app);
  registerSocialTipsRoutes(app);
  registerSocialLemmyRoutes(app);
  registerSocialPlatformsRoutes(app);
  registerSocialIdentityRoutes(app);
}

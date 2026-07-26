/**
 * @degenfeed/api-worker — Social route registration hub
 *
 * Dispatches to domain-specific registration modules.
 * Each module handles its own imports and route registrations.
 */

import type { Hono } from 'hono';
import type { Env } from '../../types';
import { registerSocialCoreRoutes } from './social-core';
import { registerSocialIdentityRoutes } from './social-identity';
import { registerSocialLemmyRoutes } from './social-lemmy';
import { registerSocialPlatformsRoutes } from './social-platforms';
import { registerSocialTipsRoutes } from './social-tips';

export function registerSocialRoutes(app: Hono<{ Bindings: Env }>): void {

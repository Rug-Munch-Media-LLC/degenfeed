/**
 * @degenfeed/api-worker — Core route registration
 *
 * Landing pages, health, bridge health, protocol status, deploy.
 */

import type { Hono } from 'hono';
import { jsonResponse } from '../../response-helpers';
import type { Env } from '../../types';

export function registerCoreRoutes(app: Hono<{ Bindings: Env }>): void {

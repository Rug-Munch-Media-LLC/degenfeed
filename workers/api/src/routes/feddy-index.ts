/**
 * @degenfeed/api-worker — Feddy Communities barrel export
 *
 * Combines all feddy route modules into a single Hono router.
 * Import this in app.ts instead of the old monolithic file.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import feddyAdmin from './feddy-admin';
import feddyCommunity from './feddy-community';
import feddyCore from './feddy-core';
import feddyFeatures from './feddy-features';
import feddyMembers from './feddy-members';
import feddyModeration from './feddy-moderation';
import feddyTreasury from './feddy-treasury';
import feddyWebhooks from './feddy-webhooks';

const feddy = new Hono<{ Bindings: Env }>();

// Mount all sub-routers at root (routes are self-contained with full paths)
feddy.route('/', feddyCore);
feddy.route('/', feddyCommunity);
feddy.route('/', feddyMembers);
feddy.route('/', feddyAdmin);
feddy.route('/', feddyFeatures);
feddy.route('/', feddyTreasury);
feddy.route('/', feddyModeration);
feddy.route('/', feddyWebhooks);

export default feddy;

// Re-export webhook utility for external consumers
export { fireWebhook } from './feddy-webhooks';

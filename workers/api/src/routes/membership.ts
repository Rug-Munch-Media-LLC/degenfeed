/**
 * @degenfeed/api-worker — Membership Tier API Routes
 *
 * GET    /api/membership/tier             — Current user's tier + status
 * GET    /api/membership/features         — All features + which are unlocked
 * POST   /api/membership/upgrade          — Upgrade tier (process on-chain payment)
 * GET    /api/membership/history          — Payment history
 * POST   /api/membership/cancel           — Cancel subscription
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {

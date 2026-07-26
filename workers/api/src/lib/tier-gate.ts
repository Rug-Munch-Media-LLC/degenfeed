/**
 * @degenfeed/api-worker — Tier gate middleware
 *
 * Feature-gating middleware for Hono routes.
 * Use `requireTier('pro')` to gate entire routes.
 * Use `requireFeature('analytics_advanced')` for specific features.
 *
 * Also provides usage tracking helpers for tier limits
 * (coin deploy count, community creation count, etc.)
 */

import type { Context, Next } from 'hono';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {

/**
 * @degenfeed/api-worker — Tier management routes
 *
 * GET    /api/tiers        — Get all tier definitions with features and limits
 * GET    /api/tiers/me     — Current user's tier + usage + limits
 * POST   /api/tiers/upgrade — Initiate tier upgrade (redirects to billing checkout)
 *
 * These endpoints power the /premium page and the tier gate middleware.
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {

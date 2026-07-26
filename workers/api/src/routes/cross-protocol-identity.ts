/**
 * @degenfeed/api-worker — Cross-Protocol Holder Identity Routes
 *
 * One identity across all protocols. Endpoints for resolving and
 * displaying cross-protocol holder information.
 *
 * Routes:
 *   GET  /api/identity/cross-protocol/:wallet    — Get all identities for a wallet
 *   GET  /api/identity/resolve/:protocol/:id     — Resolve protocol identity → wallet
 *   GET  /api/identity/badges/:wallet/:coin       — Get holder badges
 *   GET  /api/leaderboard/cross-protocol/:coin    — Cross-protocol holder leaderboard
 *   GET  /api/identity/merge                      — Check if two identities share a wallet
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {

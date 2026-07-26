/**
 * @degenfeed/api-worker — Token Community engagement routes
 *
 * Live chat, creator livestreams, milestones, badges, and permanent
 * community hubs for DegenFeed creator tokens on their bonding curve.
 *
 * Routes:
 *   GET    /api/token/:address/comments       — Get comments (paginated)
 *   POST   /api/token/:address/comments       — Post comment (auth + rate-limited)
 *   GET    /api/token/:address/community      — Full community page data
 *   POST   /api/token/:address/stream/start   — Creator starts a stream
 *   GET    /api/token/:address/stream         — Get active stream info
 *   POST   /api/token/:address/stream/join    — Join stream (token-gated)
 *   GET    /api/token/:address/milestones     — Milestone list
 *   GET    /api/token/:address/badges/:wallet — User's badges for this token
 *   POST   /api/token/:address/stream/end     — End active stream (creator only)
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {

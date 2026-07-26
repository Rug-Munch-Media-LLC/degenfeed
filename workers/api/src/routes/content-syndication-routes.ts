/**
 * @degenfeed/api-worker — Content Syndication API Routes
 *
 * POST /api/content/syndication/rules                — Set syndication rules
 * GET  /api/content/syndication/rules                — Get syndication rules
 * PUT  /api/content/syndication/rules/:protocol      — Update per-protocol rule
 *
 * POST /api/content/syndication/queue                — Queue content for syndication
 * GET  /api/content/syndication/queue                — List queued syndications
 * POST /api/content/syndication/queue/:queueId       — Execute a queued syndication
 *
 * GET  /api/content/syndication/history              — Get syndication history
 * GET  /api/content/syndication/can/:protocol        — Check if can syndicate to protocol
 */

import { getContent } from '../lib/content-library';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {

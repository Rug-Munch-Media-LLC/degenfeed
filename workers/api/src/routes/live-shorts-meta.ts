/**
 * @degenfeed/api-worker — Live Shorts: Display & Metadata
 *
 * OG tags, Frame tags, manifest, and live-meta routes.
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { liveShortKey } from './live-shorts-engine';
import type { LiveShortRecord } from './live-shorts-types';

const liveShorts = new Hono<{ Bindings: Env }>();
// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/og
// JSON OG meta data for Bluesky embed cards and link previews.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/og', async (c) => {

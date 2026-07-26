/**
 * @degenfeed/api-worker — Enhanced Creator Vesting & Rewards
 *
 * Dedicated vesting management for creator coins. Goes beyond Zora-style
 * fixed schedules by offering 5 presets + custom configuration, reputation
 * gating, real-time vesting progress, and on-chain claim support.
 *
 * Routes:
 *   GET  /api/creator/vesting/presets               — Get available vesting presets (reputation-filtered)
 *   GET  /api/creator/vesting/:coinAddress           — Get current vesting status & progress
 *   POST /api/creator/vesting/:coinAddress/claim     — Claim vested tokens (creator only)
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Vesting Presets ─────────────────────────────────────────────────────
// Better than Zora's fixed 5-year: creators choose the right schedule.
// Each preset shows exactly what the creator gets and when.

type VestingPresetRequirements = {}

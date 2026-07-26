/**
 * /api/gamification — Streaks, achievements, daily challenges, XP, social proof.
 *
 * Endpoints:
 *   GET  /api/gamification/streak                  → streak data
 *   GET  /api/gamification/streak/leaderboard       → top streaks
 *   GET  /api/gamification/achievements             → all achievements + user status
 *   POST /api/gamification/achievements/check       → check unlock conditions
 *   GET  /api/gamification/challenges/today          → today's challenges
 *   POST /api/gamification/challenges/progress       → update challenge progress
 *   GET  /api/gamification/xp                        → XP + level data
 *   POST /api/gamification/xp/award                 → award XP for action
 *   GET  /api/gamification/social-proof             → live social proof counts
 *   POST /api/gamification/activity                  → record activity
 *   GET  /api/gamification/activity/recent           → recent activity feed
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Achievement definitions ─────────────────────────────────────────────

export type AchievementDef = {};

/**
 * @degenfeed/api-worker — Leaderboard routes
 *
 * Unified cross-platform leaderboard: top creators, tippers, trending content,
 * and top communities. Data is computed hourly and cached in KV for 5 minutes.
 *
 * KV keys:
 *   leaderboard:creators:{period}      → sorted list (desc by tips_received)
 *   leaderboard:tippers:{period}       → sorted list (desc by tips_sent)
 *   leaderboard:trending:{period}      → sorted list (desc by engagement)
 *   leaderboard:communities             → sorted list (desc by activity)
 *   leaderboard:last_updated            → ISO timestamp of last compute
 *
 * Periods: daily, weekly, monthly, alltime
 * Platform filter: all, degenfeed, lemmy, peertube
 */

import { jsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type LeaderboardEntry = {};

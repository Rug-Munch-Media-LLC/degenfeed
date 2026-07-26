/**
 * @degenfeed/api-worker — PeerTube tipping routes
 *
 * Viewers can tip video creators on PeerTube instances during playback
 * or from the video page. Tips are stored in KV, aggregated by video,
 * and surfaced in a global leaderboard.
 *
 * KV schema:
 *   peertube:tip:{videoId}           → TipEntry[]
 *   peertube:tip:stats:{videoId}     → StatsEntry
 *   peertube:tip:leaderboard         → CreatorEntry[]
 *
 * The notification pipeline is shared with the main app: each tip creates
 * a `notifications:peertube:{creatorChannel}` KV entry that the unified
 * NotificationBell can pick up.
 */

import { identityKey } from '@degenfeed/utils';
import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';
import { recordUnifiedTip } from './unified-tip';

// ─── Types ───────────────────────────────────────────────────────────────

type TipEntry = {}

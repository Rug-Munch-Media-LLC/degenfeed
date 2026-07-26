/**
 * @degenfeed/api-worker — Live Gifts API Handlers
 *
 * API endpoints for the gift/reward system:
 *   POST /api/live/gifts/send          — Send a gift
 *   GET  /api/live/gifts/leaderboard   — Stream leaderboard
 *   GET  /api/live/gifts/types         — Available gift types
 *   GET  /api/live/gifts/packages      — Available gift packages
 *   GET  /api/live/gifts/history       — User gift history
 *   GET  /api/live/gifts/earnings      — Creator earnings for a stream
 *   POST /api/live/gifts/process-payout — Trigger stream payouts
 *
 * Integrates with:
 *   - unified-tip-core.ts → recordUnifiedTip (unified ledger)
 *   - stream-chat.ts → appendMessage (gift notif in chat)
 *   - ws-broadcast.ts + CHANNELS.TIP_RECEIVED (realtime animation)
 *   - creator-rewards.ts → recordCreatorMetrics (earnings accrual)
 */

import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import {

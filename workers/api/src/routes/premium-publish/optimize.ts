/**
 * @degenfeed/api-worker — Premium Publish AI Optimization
 *
 * AI time optimization, content recycling, evergreen posts, recurring posts.
 */

import { getBestPostingTime } from '../../lib/auto-formatter';
import { getPremiumUsage, incrementPremiumUsage } from '../../lib/premium-gate';
import { requirePremiumTier, TIER_LIMITS } from '../../premium';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { sanitizeStringArray } from '../../sanitize';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import type { EvergreenFrequency, QueueEntry, RecurrencePattern, RecyclingStrategy } from './types';
import { PREFIX_EVERGREEN, PREFIX_RECURRING } from './types';
import { getQueueEntry } from './utils';

// ─── AI Time Optimization ──────────────────────────────────────────────────

export async function handleBestTimes(request: Request, _env: Env): Promise<Response> {

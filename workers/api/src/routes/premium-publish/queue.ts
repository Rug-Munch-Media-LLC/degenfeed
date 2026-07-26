/**
 * @degenfeed/api-worker — Premium Publishing Queue
 *
 * Queue/calendar logic: add, list, update, delete, batch publish, calendar view, stats, cron executor.
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import { type AutoFormatOptions, autoFormatForProtocols, getBestPostingTime } from '../../lib/auto-formatter';
import { getPremiumUsage, incrementPremiumUsage, requireProtocolLimit, requireQuota } from '../../lib/premium-gate';
import { requirePremiumTier, TIER_LIMITS } from '../../premium';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { sanitizeString, sanitizeStringArray } from '../../sanitize';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../../session';
import type { Env } from '../../types';
import type { BatchPublishEntry, CalendarDay, EvergreenFrequency, QueueEntry, QueueStatus, RecurrencePattern, RecyclingStrategy } from './types';
import { PREFIX_EVERGREEN, PREFIX_QUEUE, PREFIX_RECURRING } from './types';
import { calculateNextEvergreenRepost, calculateNextRecurrence, getNextDateForDayAndHour, getNextQueuePosition, getQueueEntry, getRecurringEntriesForDate, getUserTier, listAllQueueEntries, listQueueEntries } from './utils';

// ─── Queue Handlers ───────────────────────────────────────────────────────

export async function handleQueueAdd(request: Request, env: Env): Promise<Response> {

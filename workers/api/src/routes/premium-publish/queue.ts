/**
 * @degenfeed/api-worker — Premium Publishing Queue
 *
 * Queue/calendar logic: add, list, update, delete, batch publish, calendar view, stats, cron executor.
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import {
  type QueueItem,
  dequeueRaw,
  enqueue as queueEnqueue,
  getApiKey,
  parsePayload,
  useRmiQueueApi,
} from '../../lib/queue-client';
import {
  type AutoFormatOptions,
  autoFormatForProtocols,
  getBestPostingTime,
} from '../../lib/auto-formatter';
import {
  getPremiumUsage,
  incrementPremiumUsage,
  requireProtocolLimit,
  requireQuota,
} from '../../lib/premium-gate';
import { requirePremiumTier, TIER_LIMITS } from '../../premium';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { sanitizeString, sanitizeStringArray } from '../../sanitize';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../../session';
import type { Env } from '../../types';
import type {
  BatchPublishEntry,
  CalendarDay,
  EvergreenFrequency,
  QueueEntry,
  QueueStatus,
  RecurrencePattern,
  RecyclingStrategy,
} from './types';
import { PREFIX_EVERGREEN, PREFIX_QUEUE, PREFIX_RECURRING } from './types';
import {
  calculateNextEvergreenRepost,
  calculateNextRecurrence,
  getNextDateForDayAndHour,
  getNextQueuePosition,
  getQueueEntry,
  getRecurringEntriesForDate,
  getUserTier,
  listAllQueueEntries,
  listQueueEntries,
} from './utils';

// ─── Queue Handlers ───────────────────────────────────────────────────────

export async function handleQueueAdd(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const cookieVal = parseSessionCookie(request.headers.get('cookie'));
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (cookieVal) {
      const csrfOk = await validateCsrfToken(cookieVal, csrfToken, env);
      if (!csrfOk) return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const body = (await request.json()) as {
      masterPost?: MasterPost;
      protocols?: string[];
      scheduledAt?: string;
      autoThread?: boolean;
      aiOptimize?: boolean;
      recurrence?: RecurrencePattern;
      isEvergreen?: boolean;
      evergreenFrequency?: EvergreenFrequency;
      recyclingStrategy?: RecyclingStrategy;
    };
    const masterPost = body.masterPost;
    if (!masterPost?.text || masterPost.text.length > 10000) {
      return jsonResponse({ error: 'Invalid or too long post text' }, 400);
    }
    const protocols = sanitizeStringArray(body.protocols, 64);
    if (protocols.length === 0)
      return jsonResponse({ error: 'At least one protocol required' }, 400);
    const protocolGate = await requireProtocolLimit(session.address, protocols, env);
    if (protocolGate) return protocolGate;
    const quotaCheck = await requireQuota(session.address, env, 'queuedPosts', 1);
    if (quotaCheck) return quotaCheck;
    let scheduledAt: string | null = null;
    if (body.scheduledAt) {
      const parsed = new Date(body.scheduledAt);
      if (Number.isNaN(parsed.getTime()))
        return jsonResponse({ error: 'Invalid scheduledAt date' }, 400);
      scheduledAt = parsed.toISOString();
    }
    const id = `pq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const position = await getNextQueuePosition(session.address, env);
    const entry: QueueEntry = {
      id,
      walletAddress: session.address.toLowerCase(),
      masterPost: {
        text: sanitizeString(masterPost.text, 10000),
        title: masterPost.title ? sanitizeString(masterPost.title, 500) : undefined,
        hashtags: masterPost.hashtags,
        media: masterPost.media,
        linkCard: masterPost.linkCard,
        mentions: masterPost.mentions,
        contentWarning: masterPost.contentWarning,
        isSensitive: masterPost.isSensitive,
        lang: masterPost.lang,
      },
      protocols,
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'queued',
      position,
      createdAt: now,
      updatedAt: now,
      autoThread: body.autoThread ?? false,
      aiOptimized: body.aiOptimize ?? false,
      recurrence: body.recurrence,
      isEvergreen: body.isEvergreen,
      evergreenFrequency: body.evergreenFrequency,
      recyclingStrategy: body.recyclingStrategy,
    };
    if (body.aiOptimize && !scheduledAt) {
      const bestTimes = getBestPostingTime(protocols);
      if (bestTimes.length > 0) {
        const best = bestTimes[0];
        const suggestedDate = getNextDateForDayAndHour(best.dayOfWeek, best.hourUTC);
        entry.scheduledAt = suggestedDate.toISOString();
        entry.aiOptimizedTime = suggestedDate.toISOString();
        entry.aiOptimized = true;
        entry.status = 'scheduled';
      }
    }
    if (env.CACHE) {
      await env.CACHE.put(
        `${PREFIX_QUEUE}${session.address.toLowerCase()}:${id}`,
        JSON.stringify(entry),
        { expirationTtl: 86400 * 90 },
      );
      if (scheduledAt || entry.aiOptimizedTime) {
        await env.CACHE.put(
          `premium:scheduled:${id}`,
          JSON.stringify({ walletAddress: session.address.toLowerCase(), id }),
          { expirationTtl: 86400 * 90 },
        );
      }
      if (entry.isEvergreen) {
        await env.CACHE.put(
          `${PREFIX_EVERGREEN}${id}`,
          JSON.stringify({ walletAddress: session.address.toLowerCase(), id }),
          { expirationTtl: 86400 * 365 },
        );
      }
      if (entry.recurrence && entry.recurrence !== 'once') {
        await env.CACHE.put(
          `${PREFIX_RECURRING}${id}`,
          JSON.stringify({ walletAddress: session.address.toLowerCase(), id }),
          { expirationTtl: 86400 * 365 },
        );
      }
    }
    // Queue-API mode: mirror the scheduled index into the rmi-backend queue
    // so the cron executor can dequeue instead of KV list().
    if (useRmiQueueApi(env) && (scheduledAt || entry.aiOptimizedTime)) {
      try {
        await queueEnqueue(
          'premium',
          `premium:scheduled:${id}`,
          { walletAddress: session.address.toLowerCase(), id },
          getApiKey(env),
        );
      } catch (err) {
        console.warn('[premium-queue] Queue API enqueue failed:', err);
      }
    }
    await incrementPremiumUsage(session.address, 'queuedPosts', 1, env);
    return jsonResponse({ ok: true, entry });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleQueueList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') as QueueStatus | null;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
    const cursor = url.searchParams.get('cursor') || undefined;
    const entries = await listQueueEntries(
      env,
      session.address.toLowerCase(),
      statusFilter,
      limit,
      cursor,
    );
    return jsonResponse(entries);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleQueueUpdate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    if (!id) return jsonResponse({ error: 'Missing queue entry ID' }, 400);
    const address = session.address.toLowerCase();
    const entry = await getQueueEntry(env, address, id);
    if (!entry) return jsonResponse({ error: 'Queue entry not found' }, 404);
    if (entry.walletAddress !== address)
      return jsonResponse({ error: 'Not your queue entry' }, 403);
    if (entry.status === 'published' || entry.status === 'cancelled')
      return jsonResponse({ error: `Cannot update ${entry.status} entry` }, 400);
    const body = (await request.json()) as {
      scheduledAt?: string | null;
      status?: QueueStatus;
      position?: number;
      masterPost?: MasterPost;
      protocols?: string[];
    };
    const now = new Date().toISOString();
    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null) {
        entry.scheduledAt = null;
        entry.status = 'queued';
      } else {
        const parsed = new Date(body.scheduledAt);
        if (Number.isNaN(parsed.getTime()))
          return jsonResponse({ error: 'Invalid scheduledAt date' }, 400);
        entry.scheduledAt = parsed.toISOString();
        entry.status = 'scheduled';
      }
    }
    if (body.status && ['queued', 'scheduled', 'cancelled'].includes(body.status))
      entry.status = body.status;
    if (body.position !== undefined && body.position >= 0) entry.position = body.position;
    if (body.masterPost) {
      entry.masterPost = {
        ...entry.masterPost,
        ...body.masterPost,
        text: sanitizeString(body.masterPost.text ?? entry.masterPost.text, 10000),
      };
    }
    if (body.protocols) entry.protocols = sanitizeStringArray(body.protocols, 64);
    entry.updatedAt = now;
    if (env.CACHE)
      await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(entry), {
        expirationTtl: 86400 * 90,
      });
    return jsonResponse({ ok: true, entry });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleQueueDelete(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    if (!id) return jsonResponse({ error: 'Missing queue entry ID' }, 400);
    const address = session.address.toLowerCase();
    const entry = await getQueueEntry(env, address, id);
    if (!entry) return jsonResponse({ error: 'Queue entry not found' }, 404);
    if (entry.walletAddress !== address)
      return jsonResponse({ error: 'Not your queue entry' }, 403);
    entry.status = 'cancelled';
    entry.updatedAt = new Date().toISOString();
    if (env.CACHE) {
      await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(entry), {
        expirationTtl: 86400 * 30,
      });
      await env.CACHE.delete(`premium:scheduled:${id}`);
      await env.CACHE.delete(`${PREFIX_EVERGREEN}${id}`);
      await env.CACHE.delete(`${PREFIX_RECURRING}${id}`);
    }
    await incrementPremiumUsage(session.address, 'queuedPosts', -1, env);
    return jsonResponse({ ok: true, deletedId: id });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Batch Publish ─────────────────────────────────────────────────────────

export async function handleBatchPublish(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'platinum');
    if (gate) return gate;
    const body = (await request.json()) as {
      entries?: BatchPublishEntry[];
      defaultProtocols?: string[];
      scheduleInterval?: number;
    };
    const entries = body.entries ?? [];
    if (entries.length === 0) return jsonResponse({ error: 'At least one entry required' }, 400);
    const defaultProtocols = sanitizeStringArray(body.defaultProtocols, 64);
    const intervalMinutes = body.scheduleInterval ?? 0;
    const address = session.address.toLowerCase();
    const tier = await getUserTier(address, env);
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.basic;
    if (entries.length > limits.batchSize) {
      return jsonResponse(
        {
          error: `Batch size ${entries.length} exceeds limit of ${limits.batchSize}. Upgrade to Pro for larger batches.`,
          upgrade: true,
          requiredTier: 'platinum',
        },
        402,
      );
    }
    const created: QueueEntry[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    for (let i = 0; i < entries.length; i++) {
      try {
        const entry = entries[i];
        if (!entry.text) {
          errors.push({ index: i, error: 'Missing text' });
          continue;
        }
        const protocols = sanitizeStringArray(entry.protocols ?? defaultProtocols, 64);
        if (protocols.length === 0) {
          errors.push({ index: i, error: 'No protocols specified' });
          continue;
        }
        let scheduledAt: string | undefined = entry.scheduledAt;
        if (!scheduledAt && intervalMinutes > 0) {
          const baseTime = new Date();
          baseTime.setMinutes(baseTime.getMinutes() + (i + 1) * intervalMinutes);
          scheduledAt = baseTime.toISOString();
        }
        const id = `pq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        const position = await getNextQueuePosition(address, env);
        const queueEntry: QueueEntry = {
          id,
          walletAddress: address,
          masterPost: {
            text: sanitizeString(entry.text, 10000),
            title: entry.title ? sanitizeString(entry.title, 500) : undefined,
            hashtags: entry.hashtags,
          },
          protocols,
          scheduledAt: scheduledAt ?? null,
          status: scheduledAt ? 'scheduled' : 'queued',
          position,
          createdAt: now,
          updatedAt: now,
        };
        if (env.CACHE) {
          await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(queueEntry), {
            expirationTtl: 86400 * 90,
          });
          if (scheduledAt)
            await env.CACHE.put(
              `premium:scheduled:${id}`,
              JSON.stringify({ walletAddress: address, id }),
              { expirationTtl: 86400 * 90 },
            );
        }
        if (useRmiQueueApi(env) && scheduledAt) {
          try {
            await queueEnqueue(
              'premium',
              `premium:scheduled:${id}`,
              { walletAddress: address, id },
              getApiKey(env),
            );
          } catch (err) {
            console.warn('[premium-queue] Queue API enqueue failed:', err);
          }
        }
        created.push(queueEntry);
      } catch (err) {
        errors.push({ index: i, error: String(err) });
      }
    }
    await incrementPremiumUsage(address, 'queuedPosts', created.length, env);
    return jsonResponse({
      ok: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      entries: created,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Calendar View ─────────────────────────────────────────────────────────

export async function handleCalendarView(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const url = new URL(request.url);
    const startStr = url.searchParams.get('start');
    const endStr = url.searchParams.get('end');
    const start = startStr ? new Date(startStr) : new Date(Date.now() - 30 * 86400_000);
    const end = endStr ? new Date(endStr) : new Date(Date.now() + 60 * 86400_000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return jsonResponse({ error: 'Invalid date range' }, 400);
    const address = session.address.toLowerCase();
    const allEntries = await listAllQueueEntries(env, address);
    const calendarDays: CalendarDay[] = [];
    const grouped = new Map<string, QueueEntry[]>();
    for (const entry of allEntries) {
      if (entry.status !== 'scheduled' && entry.status !== 'queued') continue;
      const dateKey = entry.scheduledAt ? entry.scheduledAt.split('T')[0] : 'unscheduled';
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)?.push(entry);
    }
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const entriesForDay = grouped.get(dateKey) ?? [];
      const recurringForDay = getRecurringEntriesForDate(allEntries, current);
      calendarDays.push({
        date: dateKey,
        entries: [...entriesForDay, ...recurringForDay],
        count: entriesForDay.length + recurringForDay.length,
      });
      current.setDate(current.getDate() + 1);
    }
    const totalScheduled = allEntries.filter((e) => e.status === 'scheduled').length;
    const totalQueued = allEntries.filter((e) => e.status === 'queued').length;
    const totalPublished = allEntries.filter((e) => e.status === 'published').length;
    const totalEvergreen = allEntries.filter((e) => e.isEvergreen).length;
    return jsonResponse({
      calendar: calendarDays,
      stats: {
        scheduled: totalScheduled,
        queued: totalQueued,
        published: totalPublished,
        evergreen: totalEvergreen,
        total: allEntries.length,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Queue Stats ──────────────────────────────────────────────────────────

export async function handleQueueStats(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const address = session.address.toLowerCase();
    const allEntries = await listAllQueueEntries(env, address);
    const usage = await getPremiumUsage(address, env);
    const tier = await getUserTier(address, env);
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.basic;
    const statusCounts: Record<string, number> = {};
    for (const entry of allEntries)
      statusCounts[entry.status] = (statusCounts[entry.status] ?? 0) + 1;
    return jsonResponse({
      stats: {
        total: allEntries.length,
        byStatus: statusCounts,
        usage,
        limits,
        tier,
        availableProtocols: tier === 'basic' ? 3 : 12,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Cron: Execute Due Scheduled Posts ─────────────────────────────────────

export async function executeDuePremiumPosts(env: Env): Promise<number> {
  if (!env.CACHE) return 0;

  if (useRmiQueueApi(env)) {
    return executeDuePremiumPostsViaApi(env);
  }
  return executeDuePremiumPostsViaKv(env);
}

/**
 * API mode: dequeue due schedule refs from the rmi-backend `premium` queue,
 * look up the actual queue entry in KV, publish it, and re-enqueue
 * recurring/evergreen posts for their next slot. Falls back to the KV scan
 * for this run if the API is unreachable.
 */
async function executeDuePremiumPostsViaApi(env: Env): Promise<number> {
  if (!env.CACHE) return 0;
  const now = Date.now();
  let executed = 0;

  let items: Array<QueueItem<unknown>>;
  try {
    items = await dequeueRaw('premium', 100, getApiKey(env));
  } catch (err) {
    console.warn('[premium-executor] Queue API unavailable — falling back to KV scan:', err);
    return executeDuePremiumPostsViaKv(env);
  }

  for (const item of items) {
    try {
      const scheduleRef = parsePayload<{ walletAddress: string; id: string }>(item.payload);
      if (!scheduleRef?.id) continue;

      const entryRaw = await env.CACHE.get(
        `${PREFIX_QUEUE}${scheduleRef.walletAddress}:${scheduleRef.id}`,
      );
      if (!entryRaw) continue;

      const entry = JSON.parse(entryRaw) as QueueEntry;
      if (entry.status !== 'scheduled') continue;
      if (entry.scheduledAt && new Date(entry.scheduledAt).getTime() > now) continue;

      await executeQueueEntry(entry, env);
      entry.status = 'published';
      entry.updatedAt = new Date().toISOString();
      entry.recurrenceCount = (entry.recurrenceCount ?? 0) + 1;

      let reEnqueue = false;
      if (entry.recurrence && entry.recurrence !== 'once') {
        entry.scheduledAt = calculateNextRecurrence(entry);
        entry.status = 'scheduled';
        reEnqueue = true;
      }
      if (entry.isEvergreen) {
        entry.lastRepostedAt = new Date().toISOString();
        entry.scheduledAt = calculateNextEvergreenRepost(entry);
        entry.status = 'scheduled';
        reEnqueue = true;
      }

      await env.CACHE.put(
        `${PREFIX_QUEUE}${entry.walletAddress}:${entry.id}`,
        JSON.stringify(entry),
        { expirationTtl: 86400 * (entry.isEvergreen ? 365 : 90) },
      );

      // Clean up the local scheduled-index copy (if any) — the item was
      // consumed by dequeue, so there is no KV index entry to remove.
      await env.CACHE.delete(item.key).catch(() => {});

      // Recurring / evergreen posts go back on the queue for their next slot.
      if (reEnqueue) {
        try {
          await queueEnqueue(
            'premium',
            `premium:scheduled:${entry.id}`,
            { walletAddress: entry.walletAddress, id: entry.id },
            getApiKey(env),
          );
        } catch (enqErr) {
          console.error(
            `[premium-executor] Re-enqueue failed for ${entry.id}:`,
            enqErr,
          );
        }
      }
      executed++;
    } catch (err) {
      console.error(`[premium-executor] Failed to execute ${item.key}:`, err);
    }
  }
  return executed;
}

/**
 * Legacy KV mode: scan the `premium:scheduled:` index.
 */
async function executeDuePremiumPostsViaKv(env: Env): Promise<number> {
  if (!env.CACHE) return 0;
  const now = Date.now();
  let executed = 0;
  try {
    let cursor: string | undefined;
    do {
      const page = await env.CACHE.list({ prefix: 'premium:scheduled:', cursor, limit: 100 });
      for (const key of page.keys) {
        try {
          const raw = await env.CACHE.get(key.name);
          if (!raw) continue;
          const scheduleRef = JSON.parse(raw) as { walletAddress: string; id: string };
          const entryRaw = await env.CACHE.get(
            `${PREFIX_QUEUE}${scheduleRef.walletAddress}:${scheduleRef.id}`,
          );
          if (!entryRaw) {
            await env.CACHE.delete(key.name);
            continue;
          }
          const entry = JSON.parse(entryRaw) as QueueEntry;
          if (entry.status !== 'scheduled') continue;
          if (entry.scheduledAt && new Date(entry.scheduledAt).getTime() > now) continue;
          await executeQueueEntry(entry, env);
          entry.status = 'published';
          entry.updatedAt = new Date().toISOString();
          entry.recurrenceCount = (entry.recurrenceCount ?? 0) + 1;
          if (entry.recurrence && entry.recurrence !== 'once') {
            entry.scheduledAt = calculateNextRecurrence(entry);
            entry.status = 'scheduled';
          }
          if (entry.isEvergreen) {
            entry.lastRepostedAt = new Date().toISOString();
            entry.scheduledAt = calculateNextEvergreenRepost(entry);
            entry.status = 'scheduled';
          }
          await env.CACHE.put(
            `${PREFIX_QUEUE}${entry.walletAddress}:${entry.id}`,
            JSON.stringify(entry),
            { expirationTtl: 86400 * (entry.isEvergreen ? 365 : 90) },
          );
          if (!entry.recurrence && !entry.isEvergreen) await env.CACHE.delete(key.name);
          executed++;
        } catch (err) {
          console.error(`[premium-executor] Failed to execute ${key.name}:`, err);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (err) {
    console.error('[premium-executor] Failed to scan scheduled index:', err);
  }
  return executed;
}

async function executeQueueEntry(entry: QueueEntry, env: Env): Promise<void> {
  try {
    const options: AutoFormatOptions = {
      autoThread: entry.autoThread,
      optimizeHashtags: true,
      optimizeImages: true,
      optimizeLinks: true,
      adaptLanguage: true,
    };
    autoFormatForProtocols(entry.masterPost, entry.protocols, options);
    const { executeCrossPublish } = await import('../lib/cross-publish-orchestrator');
    const report = await executeCrossPublish(
      {
        masterPost: entry.masterPost,
        protocols: entry.protocols as import('@degenfeed/types').Protocol[],
        auth: {},
      },
      env,
    );
    entry.results = report.results as Record<
      string,
      { success: boolean; error?: string; nativeId?: string }
    >;
    for (const [protocol, result] of Object.entries(report.results)) {
      const { recordBridgeOperation } = await import('../lib/bridge-reliability');
      await recordBridgeOperation(env, protocol, result.ok, 0, result.error).catch(() => {});
    }
  } catch (err) {
    entry.error = err instanceof Error ? err.message : String(err);
    entry.status = 'failed';
    entry.results = {};
  }
}

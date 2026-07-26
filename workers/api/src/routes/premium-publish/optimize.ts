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
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const url = new URL(request.url);
    const protocols = sanitizeStringArray(
      (url.searchParams.get('protocols') ?? 'mastodon,bluesky,nostr').split(','),
      64,
    );
    const bestTimes = getBestPostingTime(protocols);
    return jsonResponse({
      protocols,
      bestTimes: bestTimes.map((t) => ({
        dayOfWeek: t.dayOfWeek,
        hourUTC: t.hourUTC,
        score: t.score,
        label: t.label,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
          t.dayOfWeek
        ],
        timeFormatted: `${t.hourUTC.toString().padStart(2, '0')}:00 UTC`,
      })),
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Content Recycling ─────────────────────────────────────────────────────

export async function handleRecyclePost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const body = (await request.json()) as {
      entryId?: string;
      strategy?: RecyclingStrategy;
      minEngagementScore?: number;
    };
    if (!body.entryId) return jsonResponse({ error: 'entryId required' }, 400);
    const address = session.address.toLowerCase();
    const entry = await getQueueEntry(env, address, body.entryId);
    if (!entry) return jsonResponse({ error: 'Entry not found' }, 404);
    entry.recyclingStrategy = body.strategy ?? 'age';
    entry.minEngagementScore = body.minEngagementScore ?? 0.5;
    entry.updatedAt = new Date().toISOString();
    if (env.CACHE)
      await env.CACHE.put(`premium:queue:${address}:${body.entryId}`, JSON.stringify(entry), {
        expirationTtl: 86400 * 90,
      });
    return jsonResponse({ ok: true, entry });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Evergreen Posts ───────────────────────────────────────────────────────

export async function handleSetEvergreen(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const body = (await request.json()) as { entryId?: string; frequency?: EvergreenFrequency };
    if (!body.entryId) return jsonResponse({ error: 'entryId required' }, 400);
    const address = session.address.toLowerCase();
    const entry = await getQueueEntry(env, address, body.entryId);
    if (!entry) return jsonResponse({ error: 'Entry not found' }, 404);
    const usage = await getPremiumUsage(address, env);
    const tier = await getUserTierHelper(address, env);
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.basic;
    if (usage.evergreenPosts >= limits.evergreenPosts) {
      return jsonResponse(
        {
          error: `Evergreen post limit reached (${usage.evergreenPosts}/${limits.evergreenPosts})`,
          upgrade: true,
        },
        402,
      );
    }
    entry.isEvergreen = true;
    entry.evergreenFrequency = body.frequency ?? 'every-30d';
    entry.lastRepostedAt = null!;
    entry.updatedAt = new Date().toISOString();
    if (env.CACHE) {
      await env.CACHE.put(`premium:queue:${address}:${body.entryId}`, JSON.stringify(entry), {
        expirationTtl: 86400 * 365,
      });
      await env.CACHE.put(
        `${PREFIX_EVERGREEN}${body.entryId}`,
        JSON.stringify({ walletAddress: address, id: body.entryId }),
        { expirationTtl: 86400 * 365 },
      );
    }
    await incrementPremiumUsage(address, 'evergreenPosts', 1, env);
    return jsonResponse({ ok: true, entry });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Recurring Posts ───────────────────────────────────────────────────────

export async function handleSetRecurring(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;
    const body = (await request.json()) as {
      entryId?: string;
      pattern?: RecurrencePattern;
      endDate?: string;
    };
    if (!body.entryId || !body.pattern)
      return jsonResponse({ error: 'entryId and pattern required' }, 400);
    const address = session.address.toLowerCase();
    const entry = await getQueueEntry(env, address, body.entryId);
    if (!entry) return jsonResponse({ error: 'Entry not found' }, 404);
    entry.recurrence = body.pattern;
    entry.recurrenceEnd = body.endDate;
    entry.recurrenceCount = 0;
    entry.updatedAt = new Date().toISOString();
    if (env.CACHE) {
      await env.CACHE.put(`premium:queue:${address}:${body.entryId}`, JSON.stringify(entry), {
        expirationTtl: 86400 * 365,
      });
      await env.CACHE.put(
        `${PREFIX_RECURRING}${body.entryId}`,
        JSON.stringify({ walletAddress: address, id: body.entryId }),
        { expirationTtl: 86400 * 365 },
      );
    }
    return jsonResponse({ ok: true, entry });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

async function getUserTierHelper(walletAddress: string, env: Env): Promise<string> {
  try {
    const { checkPremiumStatus } = await import('../premium');
    const status = await checkPremiumStatus(walletAddress, env);
    return status?.tier ?? 'basic';
  } catch {
    return 'basic';
  }
}

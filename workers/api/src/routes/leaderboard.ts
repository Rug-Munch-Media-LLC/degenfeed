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

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatarUrl: string;
  platform: string;
  platforms: string[];
  tipsReceived: number;
  tipsSent: number;
  followerCount: number;
  postCount: number;
  change: number; // positive = rising, negative = falling
}

export interface TrendingEntry {
  id: string;
  rank: number;
  title: string;
  platform: string;
  url: string;
  engagementScore: number;
  tipCount: number;
  tipTotal: number;
  change: number;
  authorName: string;
  authorAvatar: string;
}

export interface CommunityEntry {
  id: string;
  rank: number;
  name: string;
  icon: string;
  platform: string;
  memberCount: number;
  postCount: number;
  tipCount: number;
  tipTotal: number;
  change: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  updatedAt: string;
}

interface TrendingData {
  entries: TrendingEntry[];
  updatedAt: string;
}

interface CommunitiesData {
  entries: CommunityEntry[];
  updatedAt: string;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';

const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly', 'alltime']);
const VALID_PLATFORMS = new Set(['all', 'degenfeed', 'lemmy', 'peertube']);
const _VALID_CATEGORIES = new Set(['creators', 'tippers', 'trending', 'communities']);

const KV_TTL = 300; // 5-minute cache

// ─── Helpers ──────────────────────────────────────────────────────────────

function isValidPeriod(p: string | null): p is Period {
  return p !== null && VALID_PERIODS.has(p);
}

function sanitizePeriod(period: string | null): Period {
  if (isValidPeriod(period)) return period;
  return 'weekly';
}

function sanitizePlatform(platform: string | null): string {
  if (platform !== null && VALID_PLATFORMS.has(platform)) return platform;
  return 'all';
}

/**
 * Filter entries by platform and clamp to limit.
 */
function filterByPlatform<T extends { platform: string; platforms?: string[] }>(
  entries: T[],
  platform: string,
  limit: number,
): T[] {
  if (platform === 'all') return entries.slice(0, limit);
  return entries
    .filter((e) => e.platform === platform || e.platforms?.includes(platform))
    .slice(0, limit);
}

// ─── KV helpers ───────────────────────────────────────────────────────────

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* KV unavailable */
  }
  return null;
}

async function kvPut(env: Env, key: string, data: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(data), { expirationTtl: KV_TTL });
  } catch {
    /* KV unavailable */
  }
}

// ─── Leaderboard data ─────────────────────────────────────────────────────
// Leaderboards are computed from real tip/creator activity and cached in KV.
// Demo/seed fallback data was removed 2026-08-06 — we NEVER fabricate entries.
export async function handleRefreshLeaderboards(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (env.ADMIN_WALLETS) {
    const admins = env.ADMIN_WALLETS.split(',').map((a) => a.trim().toLowerCase());
    if (!admins.includes(session.address.toLowerCase())) {
      return jsonResponse({ error: 'Forbidden: admin access required' }, 403);
    }
  }

  const now = new Date().toISOString();
  const periods: Period[] = ['daily', 'weekly', 'monthly', 'alltime'];

  try {
    // Demo/seed content is BANNED — the refresh writes EMPTY leaderboards.
    // In production this would aggregate from actual tip/creator events;
    // until that pipeline exists, we never fabricate entries.
    console.warn(
      '[leaderboard] refresh: writing empty leaderboards — aggregation pipeline not yet live (seeded data banned)',
    );
    for (const period of periods) {
      await kvPut(env, `leaderboard:creators:${period}`, { entries: [], updatedAt: now });
      await kvPut(env, `leaderboard:tippers:${period}`, { entries: [], updatedAt: now });
      await kvPut(env, `leaderboard:trending:${period}`, { entries: [], updatedAt: now });
    }
    await kvPut(env, 'leaderboard:communities', { entries: [], updatedAt: now });

    // Last updated timestamp
    await kvPut(env, 'leaderboard:last_updated', { updatedAt: now });

    return jsonResponse({ ok: true, updatedAt: now });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────

async function handleLeaderboardGet(
  _request: Request,
  env: Env,
  category: string,
): Promise<Response> {
  const url = new URL(_request.url);
  const period = sanitizePeriod(url.searchParams.get('period'));
  const platform = sanitizePlatform(url.searchParams.get('platform'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const kvKey = `leaderboard:${category}:${period}`;
  const cached = await kvGet<LeaderboardData>(env, kvKey);

  if (cached?.entries) {
    const filtered = filterByPlatform(cached.entries, platform, limit);
    return jsonResponse({
      entries: filtered,
      updatedAt: cached.updatedAt,
      category,
      period,
    });
  }

  // Fallback: demo/seed content is BANNED — return an explicit empty
  // result with a warning notice. Never fabricate leaderboard entries.
  console.warn(
    `[leaderboard] No cached ${category}/${period} data — returning empty (seeded data banned)`,
  );
  return jsonResponse({
    entries: [] as LeaderboardEntry[],
    updatedAt: new Date().toISOString(),
    category,
    period,
    notice: 'No leaderboard data available yet',
  });
}

export async function handleLeaderboardCreators(request: Request, env: Env): Promise<Response> {
  return handleLeaderboardGet(request, env, 'creators');
}

export async function handleLeaderboardTippers(request: Request, env: Env): Promise<Response> {
  return handleLeaderboardGet(request, env, 'tippers');
}

export async function handleLeaderboardTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const period = sanitizePeriod(url.searchParams.get('period'));
  const platform = sanitizePlatform(url.searchParams.get('platform'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const kvKey = `leaderboard:trending:${period}`;
  const cached = await kvGet<TrendingData>(env, kvKey);

  if (cached?.entries) {
    const filtered = filterByPlatform(cached.entries, platform, limit);
    return jsonResponse({
      entries: filtered,
      updatedAt: cached.updatedAt,
      period,
    });
  }

  // Fallback: demo/seed content is BANNED — return an explicit empty result.
  console.warn(
    `[leaderboard] No cached trending/${period} data — returning empty (seeded data banned)`,
  );
  return jsonResponse({
    entries: [] as TrendingEntry[],
    updatedAt: new Date().toISOString(),
    period,
    notice: 'No trending data available yet',
  });
}

export async function handleLeaderboardCommunities(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const platform = sanitizePlatform(url.searchParams.get('platform'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const cached = await kvGet<CommunitiesData>(env, 'leaderboard:communities');

  if (cached?.entries) {
    const filtered = filterByPlatform(cached.entries, platform, limit);
    return jsonResponse({ entries: filtered, updatedAt: cached.updatedAt });
  }

  // Fallback: demo/seed content is BANNED — return an explicit empty result.
  console.warn('[leaderboard] No cached communities data — returning empty (seeded data banned)');
  return jsonResponse({
    entries: [] as CommunityEntry[],
    updatedAt: new Date().toISOString(),
    notice: 'No community leaderboard data available yet',
  });
}

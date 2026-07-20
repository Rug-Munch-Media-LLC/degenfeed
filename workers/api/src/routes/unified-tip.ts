/**
 * @degenfeed/api-worker — Unified Tip Router
 *
 * One accounting layer for tips across ALL platforms:
 * DegenFeed (main app), Lemmy (community.degenfeed.xyz), and
 * PeerTube (video.degenfeed.xyz).
 *
 * Platform handlers (tip.ts, lemmy-tip.ts, peertube-tip.ts) keep their own
 * per-platform KV surfaces but MUST call `recordUnifiedTip()` on completion
 * so every tip lands in the unified ledger exactly once.
 *
 * Unified KV schema:
 *   tip:{platform}:{entityId}      → { platform, entityId, entityType, totalUsd, tips: [...], lastTipAt }
 *   tip:user:{userId}:sent         → { totalUsd, count, lastTipAt, byPlatform, recent: [...] }
 *   tip:user:{userId}:received     → { totalUsd, count, lastTipAt, byPlatform, tippers, recent: [...] }
 *   tip:leaderboard:{period}       → { bucket, updatedAt, entries: [{ userId, totalUsd, count, platform, byPlatform }] }
 *   tip:activity:recent            → ActivityItem[] (newest first, capped)
 *
 * Periods: daily, weekly, monthly, alltime. Each period key stores the bucket
 * id it was computed for (e.g. "2026-07-18", "2026-W29", "2026-07", "all") and
 * resets when the bucket rolls over.
 *
 * Routes:
 *   POST /api/tip/unified              — route a tip to the correct platform handler
 *   GET  /api/tip/unified/stats        — ?userId=… cross-platform sent/received stats
 *   GET  /api/tip/unified/leaderboard  — ?period=weekly cross-platform leaderboard
 *   GET  /api/tip/unified/activity     — recent tips across all platforms (live feed)
 */

import { type Env, jsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';

// ─── Types ───────────────────────────────────────────────────────────────

export type TipPlatform = 'degenfeed' | 'lemmy' | 'peertube' | 'bluesky' | 'mastodon' | 'farcaster' | 'lens';
export type TipEntityType = 'post' | 'comment' | 'video' | 'space' | 'creator_coin';
export type TipPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

export interface UnifiedTipEvent {
  platform: TipPlatform;
  entityId: string;
  entityType: TipEntityType;
  /** USD value of the tip (positive, ≤ 10,000) */
  amountUsd: number;
  /** Tipper identifier (wallet address or handle) */
  fromUserId?: string;
  /** Recipient identifier (wallet address or handle) */
  toUserId?: string;
  /** Display labels for the activity feed */
  fromLabel?: string;
  toLabel?: string;
  /** Human-readable entity label (video title, post excerpt, …) */
  entityLabel?: string;
  /** Payment method key: eth | sol | btc | usdc | base | matic | … */
  method?: string;
}

interface StoredTip {
  amountUsd: number;
  fromUserId?: string;
  toUserId?: string;
  method?: string;
  at: number;
}

interface EntityTipRecord {
  platform: TipPlatform;
  entityId: string;
  entityType: TipEntityType;
  totalUsd: number;
  tips: StoredTip[];
  lastTipAt: number;
}

interface PlatformBreakdown {
  totalUsd: number;
  count: number;
}

interface UserSentRecord {
  totalUsd: number;
  count: number;
  lastTipAt: number;
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
  recent: ActivityItem[];
}

interface UserReceivedRecord {
  totalUsd: number;
  count: number;
  lastTipAt: number;
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
  /** Unique tipper ids (capped) — length drives "from N tippers" */
  tippers: string[];
  recent: ActivityItem[];
}

export interface UnifiedLeaderboardEntry {
  userId: string;
  totalUsd: number;
  count: number;
  /** Dominant platform (highest USD share) */
  platform: TipPlatform;
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
}

interface LeaderboardRecord {
  bucket: string;
  updatedAt: number;
  entries: UnifiedLeaderboardEntry[];
}

export interface ActivityItem {
  id: string;
  platform: TipPlatform;
  entityId: string;
  entityType: TipEntityType;
  entityLabel?: string;
  amountUsd: number;
  fromUserId?: string;
  toUserId?: string;
  fromLabel: string;
  toLabel: string;
  at: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

const PLATFORMS = new Set<string>(['degenfeed', 'lemmy', 'peertube', 'bluesky', 'mastodon', 'farcaster', 'lens']);
const ENTITY_TYPES = new Set<string>(['post', 'comment', 'video', 'space', 'creator_coin']);
const PERIODS: TipPeriod[] = ['daily', 'weekly', 'monthly', 'alltime'];

const ACTIVITY_KEY = 'tip:activity:recent';
const TTL_1Y = 60 * 60 * 24 * 365;

const MAX_TIP_USD = 10_000;
const MAX_ENTITY_TIPS = 200;
const MAX_ACTIVITY = 100;
const MAX_RECENT_PER_USER = 25;
const MAX_TIPPERS_TRACKED = 1_000;
const MAX_LEADERBOARD = 100;

// ─── Key builders ────────────────────────────────────────────────────────

export function entityKey(platform: TipPlatform, entityId: string): string {
  return `tip:${platform}:${entityId}`;
}

export function userSentKey(userId: string): string {
  return `tip:user:${userId}:sent`;
}

export function userReceivedKey(userId: string): string {
  return `tip:user:${userId}:received`;
}

export function leaderboardKey(period: TipPeriod): string {
  return `tip:leaderboard:${period}`;
}

/** Bucket id for a period — leaderboards reset when the bucket rolls over. */
export function periodBucket(period: TipPeriod, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  switch (period) {
    case 'daily':
      return `${y}-${m}-${d}`;
    case 'weekly': {
      // ISO 8601 week number
      const date = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
      return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${y}-${m}`;
    default:
      return 'all';
  }
}

// ─── Sanitizers ──────────────────────────────────────────────────────────

function normalizeUserId(raw: unknown): string | undefined {
  const str = sanitizeString(raw, 128);
  if (!str || hasSuspiciousPayload(str)) return undefined;
  // Wallet addresses are case-insensitive identifiers — normalize
  return str.startsWith('0x') ? str.toLowerCase() : str;
}

function sanitizeEntityId(raw: unknown): string | null {
  const str = sanitizeString(raw, 256);
  if (!str || str.length < 1 || hasSuspiciousPayload(str)) return null;
  return str;
}

function sanitizeAmountUsd(raw: unknown): number | null {
  const num = typeof raw === 'number' ? raw : Number.parseFloat(sanitizeString(raw, 64) || 'NaN');
  if (!Number.isFinite(num) || num <= 0 || num > MAX_TIP_USD) return null;
  return Math.round(num * 100) / 100;
}

function isPlatform(value: string): value is TipPlatform {
  return PLATFORMS.has(value);
}

function isEntityType(value: string): value is TipEntityType {
  return ENTITY_TYPES.has(value);
}

function isPeriod(value: string): value is TipPeriod {
  return (PERIODS as string[]).includes(value);
}

function shortLabel(id: string | undefined, fallback: string): string {
  if (!id) return fallback;
  if (id.startsWith('0x') && id.length > 12) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  if (id.length > 24) return `${id.slice(0, 21)}…`;
  return id;
}

// ─── KV helpers ──────────────────────────────────────────────────────────

async function kvGetJson<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvPutJson(env: Env, key: string, value: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn(
      `[unified-tip] KV put failed for ${key}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

function bumpBreakdown(
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>,
  platform: TipPlatform,
  amountUsd: number,
): void {
  const entry = byPlatform[platform] ?? { totalUsd: 0, count: 0 };
  entry.totalUsd = Math.round((entry.totalUsd + amountUsd) * 100) / 100;
  entry.count += 1;
  byPlatform[platform] = entry;
}

// ─── Core: record a tip in the unified ledger ────────────────────────────

/**
 * Record a completed tip in the unified accounting layer.
 *
 * Called by every platform tip handler on completion. All writes are
 * best-effort: a failure in one record never blocks the others.
 *
 * Returns the activity item that was appended to the live feed.
 */
export async function recordUnifiedTip(
  env: Env,
  event: UnifiedTipEvent,
): Promise<ActivityItem | null> {
  if (!env.CACHE) return null;

  const entityId = sanitizeEntityId(event.entityId);
  const amountUsd = sanitizeAmountUsd(event.amountUsd);
  if (!entityId || !amountUsd || !isPlatform(event.platform) || !isEntityType(event.entityType)) {
    return null;
  }

  const now = Date.now();
  const fromUserId = normalizeUserId(event.fromUserId);
  const toUserId = normalizeUserId(event.toUserId);
  const method = sanitizeString(event.method, 32) || undefined;

  const activity: ActivityItem = {
    id: `utip:${event.platform}:${now}:${Math.random().toString(36).slice(2, 8)}`,
    platform: event.platform,
    entityId,
    entityType: event.entityType,
    entityLabel: sanitizeString(event.entityLabel, 200) || undefined,
    amountUsd,
    fromUserId,
    toUserId,
    fromLabel: sanitizeString(event.fromLabel, 64) || shortLabel(fromUserId, 'Anonymous'),
    toLabel: sanitizeString(event.toLabel, 64) || shortLabel(toUserId, 'a creator'),
    at: now,
  };

  // 1. Entity aggregate — tip:{platform}:{entityId}
  try {
    const key = entityKey(event.platform, entityId);
    const record = (await kvGetJson<EntityTipRecord>(env, key)) ?? {
      platform: event.platform,
      entityId,
      entityType: event.entityType,
      totalUsd: 0,
      tips: [],
      lastTipAt: 0,
    };
    record.totalUsd = Math.round((record.totalUsd + amountUsd) * 100) / 100;
    record.lastTipAt = now;
    record.tips.unshift({ amountUsd, fromUserId, toUserId, method, at: now });
    record.tips = record.tips.slice(0, MAX_ENTITY_TIPS);
    await kvPutJson(env, key, record);
  } catch (err) {
    console.warn('[unified-tip] entity record failed:', String(err));
  }

  // 2. Sender ledger — tip:user:{wallet}:sent
  if (fromUserId) {
    try {
      const key = userSentKey(fromUserId);
      const record = (await kvGetJson<UserSentRecord>(env, key)) ?? {
        totalUsd: 0,
        count: 0,
        lastTipAt: 0,
        byPlatform: {},
        recent: [],
      };
      record.totalUsd = Math.round((record.totalUsd + amountUsd) * 100) / 100;
      record.count += 1;
      record.lastTipAt = now;
      bumpBreakdown(record.byPlatform, event.platform, amountUsd);
      record.recent = [activity, ...(record.recent ?? [])].slice(0, MAX_RECENT_PER_USER);
      await kvPutJson(env, key, record);
    } catch (err) {
      console.warn('[unified-tip] sent record failed:', String(err));
    }
  }

  // 3. Recipient ledger — tip:user:{wallet}:received
  if (toUserId) {
    try {
      const key = userReceivedKey(toUserId);
      const record = (await kvGetJson<UserReceivedRecord>(env, key)) ?? {
        totalUsd: 0,
        count: 0,
        lastTipAt: 0,
        byPlatform: {},
        tippers: [],
        recent: [],
      };
      record.totalUsd = Math.round((record.totalUsd + amountUsd) * 100) / 100;
      record.count += 1;
      record.lastTipAt = now;
      bumpBreakdown(record.byPlatform, event.platform, amountUsd);
      if (fromUserId && !record.tippers.includes(fromUserId)) {
        record.tippers = [...record.tippers, fromUserId].slice(-MAX_TIPPERS_TRACKED);
      }
      record.recent = [activity, ...(record.recent ?? [])].slice(0, MAX_RECENT_PER_USER);
      await kvPutJson(env, key, record);
    } catch (err) {
      console.warn('[unified-tip] received record failed:', String(err));
    }
  }

  // 4. Leaderboards — tip:leaderboard:{period} (recipients ranked by USD received)
  if (toUserId) {
    for (const period of PERIODS) {
      try {
        const bucket = periodBucket(period);
        const key = leaderboardKey(period);
        let record = await kvGetJson<LeaderboardRecord>(env, key);
        if (!record || record.bucket !== bucket) {
          record = { bucket, updatedAt: now, entries: [] };
        }
        let entry = record.entries.find((e) => e.userId === toUserId);
        if (!entry) {
          entry = {
            userId: toUserId,
            totalUsd: 0,
            count: 0,
            platform: event.platform,
            byPlatform: {},
          };
          record.entries.push(entry);
        }
        entry.totalUsd = Math.round((entry.totalUsd + amountUsd) * 100) / 100;
        entry.count += 1;
        bumpBreakdown(entry.byPlatform, event.platform, amountUsd);
        // Dominant platform = highest USD share
        let top: TipPlatform = entry.platform;
        let topUsd = -1;
        for (const [p, b] of Object.entries(entry.byPlatform)) {
          if (b && b.totalUsd > topUsd) {
            topUsd = b.totalUsd;
            top = p as TipPlatform;
          }
        }
        entry.platform = top;
        record.entries.sort((a, b) => b.totalUsd - a.totalUsd);
        record.entries = record.entries.slice(0, MAX_LEADERBOARD);
        record.updatedAt = now;
        await kvPutJson(env, key, record);
      } catch (err) {
        console.warn(`[unified-tip] leaderboard ${period} failed:`, String(err));
      }
    }
  }

  // 5. Live activity feed — tip:activity:recent
  try {
    const feed = (await kvGetJson<ActivityItem[]>(env, ACTIVITY_KEY)) ?? [];
    await kvPutJson(env, ACTIVITY_KEY, [activity, ...feed].slice(0, MAX_ACTIVITY));
  } catch (err) {
    console.warn('[unified-tip] activity feed failed:', String(err));
  }

  return activity;
}

// ─── POST /api/tip/unified — route to the correct platform handler ───────

interface UnifiedTipBody {
  platform?: string;
  entityId?: string;
  entityType?: string;
  amountUsd?: string | number;
  fromUserId?: string;
  toUserId?: string;
  fromLabel?: string;
  toLabel?: string;
  entityLabel?: string;
  method?: string;
  currency?: string;
  /** Platform-specific extras (PeerTube video metadata, Lemmy recipient wallets, …) */
  platformPayload?: Record<string, unknown>;
}

export async function handleUnifiedTipCreate(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as UnifiedTipBody;

    const platform = sanitizeString(body.platform, 16);
    const entityId = sanitizeEntityId(body.entityId);
    const entityTypeRaw = sanitizeString(body.entityType, 16);
    const amountUsd = sanitizeAmountUsd(body.amountUsd);

    if (!platform || !isPlatform(platform)) {
      return jsonResponse({ error: 'platform must be one of: degenfeed, lemmy, peertube' }, 400);
    }
    if (!entityId) {
      return jsonResponse({ error: 'entityId required' }, 400);
    }
    if (!entityTypeRaw || !isEntityType(entityTypeRaw)) {
      return jsonResponse({ error: 'entityType must be one of: post, comment, video, space' }, 400);
    }
    if (!amountUsd) {
      return jsonResponse({ error: `amountUsd must be a positive number ≤ ${MAX_TIP_USD}` }, 400);
    }

    const entityType = entityTypeRaw;
    const method = sanitizeString(body.method ?? body.currency, 32) || 'usdc';
    const fromUserId = normalizeUserId(body.fromUserId);
    const toUserId = normalizeUserId(body.toUserId);
    const payload = body.platformPayload ?? {};

    // ── Route to the platform handler (each records the platform-specific
    //    KV surface AND calls recordUnifiedTip exactly once) ──
    switch (platform) {
      case 'lemmy': {
        const { recordLemmyTip } = await import('./lemmy-tip');
        const result = await recordLemmyTip(env, {
          contentId: entityId,
          contentType: entityType === 'comment' ? 'comment' : 'post',
          amountUsd,
          currency: method,
          method,
          from: fromUserId,
          fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
          toLabel: sanitizeString(body.toLabel, 64) || undefined,
          recipientEvm: sanitizeString(payload.recipientEvm, 128) || undefined,
          recipientSol: sanitizeString(payload.recipientSol, 128) || undefined,
          recipientUserId: toUserId,
        });
        return jsonResponse({ success: true, platform, entityId, ...result });
      }

      case 'peertube': {
        const { recordPeerTubeTip } = await import('./peertube-tip');
        const result = await recordPeerTubeTip(env, {
          videoId: entityId,
          creatorName:
            sanitizeString(payload.creatorName, 256) ||
            sanitizeString(body.toLabel, 64) ||
            'Unknown creator',
          creatorChannel: sanitizeString(payload.creatorChannel, 256) || toUserId || 'unknown',
          videoTitle:
            sanitizeString(payload.videoTitle, 512) ||
            sanitizeString(body.entityLabel, 200) ||
            entityId,
          instanceDomain: sanitizeString(payload.instanceDomain, 128) || 'video.degenfeed.xyz',
          amountUsd,
          sender: fromUserId,
          senderLabel: sanitizeString(body.fromLabel, 64) || undefined,
          currency: method,
          recipientUserId: toUserId,
        });
        return jsonResponse({ success: true, platform, entityId, ...result });
      }

      case 'bluesky': {
        const { recordBlueskyTip } = await import('./bluesky-tip');
        const result = await recordBlueskyTip(env, {
          postId: entityId,
          authorDid: toUserId || sanitizeString(payload.authorDid, 256) || entityId,
          authorHandle: sanitizeString(body.toLabel, 64),
          amountUsd,
          currency: method,
          method,
          from: fromUserId,
          fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
          toLabel: sanitizeString(body.toLabel, 64) || undefined,
        });
        return jsonResponse({ success: true, platform, entityId, ...result });
      }

      case 'mastodon': {
        const { recordMastodonTip } = await import('./mastodon-tip');
        const result = await recordMastodonTip(env, {
          statusId: entityId,
          authorAcct: toUserId || sanitizeString(payload.authorAcct, 256) || entityId,
          authorDisplayName: sanitizeString(body.toLabel, 64),
          amountUsd,
          currency: method,
          method,
          from: fromUserId,
          fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
          toLabel: sanitizeString(body.toLabel, 64) || undefined,
        });
        return jsonResponse({ success: true, platform, entityId, ...result });
      }

      default: {
        // DegenFeed — unified ledger IS the platform store
        const activity = await recordUnifiedTip(env, {
          platform: 'degenfeed',
          entityId,
          entityType,
          amountUsd,
          fromUserId,
          toUserId,
          fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
          toLabel: sanitizeString(body.toLabel, 64) || undefined,
          entityLabel: sanitizeString(body.entityLabel, 200) || undefined,
          method,
        });
        if (!activity) {
          return jsonResponse({ error: 'Failed to record tip' }, 500);
        }
        // Notify the recipient through the unified notification pipeline
        if (toUserId && toUserId !== fromUserId) {
          try {
            const notifKey = `notifications:${toUserId}`;
            const tipNotif = {
              id: activity.id,
              type: 'tip' as const,
              protocol: 'degenfeed',
              sourceProtocol: method,
              actorName: activity.fromLabel,
              actorHandle: fromUserId ?? '',
              postId: entityId,
              amount: String(amountUsd),
              currency: method,
              createdAt: activity.at,
              read: false,
            };
            const existingRaw = await env.CACHE?.get(notifKey);
            const existing: unknown[] = existingRaw ? JSON.parse(existingRaw) : [];
            await env.CACHE?.put(notifKey, JSON.stringify([tipNotif, ...existing].slice(0, 100)), {
              expirationTtl: 60 * 60 * 24 * 30,
            });
          } catch (kvErr) {
            console.warn('[unified-tip] failed to store notification:', String(kvErr));
          }
        }
        return jsonResponse({
          success: true,
          platform,
          entityId,
          activityId: activity.id,
          amountUsd,
        });
      }
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── GET /api/tip/unified/stats?userId=… ─────────────────────────────────

export async function handleUnifiedTipStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = normalizeUserId(url.searchParams.get('userId'));
  if (!userId) {
    return jsonResponse({ error: 'userId query parameter required' }, 400);
  }

  const [sent, received] = await Promise.all([
    kvGetJson<UserSentRecord>(env, userSentKey(userId)),
    kvGetJson<UserReceivedRecord>(env, userReceivedKey(userId)),
  ]);

  // Merged history (sent + received), newest first, deduped by activity id
  const seen = new Set<string>();
  const history: (ActivityItem & { direction: 'sent' | 'received' })[] = [];
  for (const item of sent?.recent ?? []) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      history.push({ ...item, direction: 'sent' });
    }
  }
  for (const item of received?.recent ?? []) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      history.push({ ...item, direction: 'received' });
    }
  }
  history.sort((a, b) => b.at - a.at);

  return jsonResponse({
    userId,
    sent: {
      totalUsd: sent?.totalUsd ?? 0,
      count: sent?.count ?? 0,
      lastTipAt: sent?.lastTipAt ?? null,
      byPlatform: sent?.byPlatform ?? {},
    },
    received: {
      totalUsd: received?.totalUsd ?? 0,
      count: received?.count ?? 0,
      lastTipAt: received?.lastTipAt ?? null,
      byPlatform: received?.byPlatform ?? {},
      tipperCount: received?.tippers?.length ?? 0,
    },
    history: history.slice(0, 50),
  });
}

// ─── GET /api/tip/unified/leaderboard?period=weekly ──────────────────────

export async function handleUnifiedTipLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const periodRaw = sanitizeString(url.searchParams.get('period'), 16) || 'weekly';
  const period: TipPeriod = isPeriod(periodRaw) ? periodRaw : 'weekly';
  const platformFilter = sanitizeString(url.searchParams.get('platform'), 16);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), MAX_LEADERBOARD);

  const record = await kvGetJson<LeaderboardRecord>(env, leaderboardKey(period));
  const bucket = periodBucket(period);

  // Stale bucket (period rolled over with no new tips yet) → empty board
  let entries = record && record.bucket === bucket ? record.entries : [];

  if (platformFilter && PLATFORMS.has(platformFilter)) {
    entries = entries
      .map((e) => {
        const breakdown = e.byPlatform[platformFilter as TipPlatform];
        if (!breakdown) return null;
        return { ...e, totalUsd: breakdown.totalUsd, count: breakdown.count };
      })
      .filter((e): e is UnifiedLeaderboardEntry => e !== null)
      .sort((a, b) => b.totalUsd - a.totalUsd);
  }

  return jsonResponse({
    period,
    bucket,
    updatedAt: record?.bucket === bucket ? record.updatedAt : null,
    entries: entries.slice(0, limit).map((e, i) => ({ rank: i + 1, ...e })),
  });
}

// ─── GET /api/tip/unified/activity — live cross-platform feed ────────────

export async function handleUnifiedTipActivity(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), MAX_ACTIVITY);
  const platformFilter = sanitizeString(url.searchParams.get('platform'), 16);

  let feed = (await kvGetJson<ActivityItem[]>(env, ACTIVITY_KEY)) ?? [];
  if (platformFilter && PLATFORMS.has(platformFilter)) {
    feed = feed.filter((item) => item.platform === platformFilter);
  }

  return jsonResponse({ activity: feed.slice(0, limit), updatedAt: Date.now() });
}

// ─── Cross-Chain Tip Routing ──────────────────────────────────────────────

/**
 * Interface for cross-chain tip requests.
 * A tip that originates on one chain/protocol must be settled on another.
 */
export interface CrossChainTipRequest {
  /** Amount in USD equivalent */
  amountUsd: number;
  /** Source chain (where the tipper is sending from) */
  fromChain: 'solana' | 'base' | 'polygon' | 'ethereum';
  /** Source token/symbol being sent */
  fromCurrency: string;
  /** Target chain (where the creator coin lives) */
  toChain: 'solana' | 'base' | 'polygon' | 'ethereum';
  /** Creator coin contract address on the target chain */
  targetCoinAddress: string;
  /** Creator's wallet that receives the value (on the target chain) */
  creatorAddress: string;
  /** Creator's protocol + id for UnifiedIdentity resolution */
  creatorProtocol?: string;
  creatorId?: string;
  /** Tipper info */
  fromUserId?: string;
  fromLabel?: string;
  /** Platform-specific entity identifier for unified tip recording */
  entityId?: string;
  entityType?: TipEntityType;
  entityLabel?: string;
}

export interface CrossChainTipResult {
  success: boolean;
  /** USD value after bridge fees */
  settledAmountUsd: number;
  /** Hash of the bridge transaction */
  bridgeTxHash?: string;
  /** Hash of the purchase transaction on the target chain */
  purchaseTxHash?: string;
  /** Activity ID in the unified tip ledger */
  activityId?: string;
  /** Any error message */
  error?: string;
}

/**
 * Handle a cross-chain tip: accept value on chain A, bridge to chain B,
 * buy the creator coin, and record in the unified ledger.
 *
 * In production, this bridges via Wormhole or LayerZero.
 */
export async function handleCrossChainTip(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  let body: CrossChainTipRequest;
  try {
    body = (await request.json()) as CrossChainTipRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate
  if (!body.amountUsd || body.amountUsd <= 0 || body.amountUsd > 10000) {
    return jsonResponse({ error: 'amountUsd must be positive and ≤ 10000' }, 400);
  }
  if (!body.fromChain || !body.toChain) {
    return jsonResponse({ error: 'fromChain and toChain are required' }, 400);
  }
  if (!body.targetCoinAddress || !body.creatorAddress) {
    return jsonResponse({ error: 'targetCoinAddress and creatorAddress are required' }, 400);
  }

  const amountUsd = Math.round(body.amountUsd * 100) / 100;

  // Simulate bridge: in production, bridges via Wormhole/LayerZero
  const bridgeResult = await simulateBridge({
    fromChain: body.fromChain,
    toChain: body.toChain,
    amountUsd,
    recipient: body.creatorAddress,
  });

  // Simulate buying the creator coin on the target chain
  const buyResult = await simulateBuyCreatorCoin({
    coinAddress: body.targetCoinAddress,
    amountUsd: bridgeResult.receivedAmount,
    chain: body.toChain,
  });

  // Record in unified tip ledger
  const entityId =
    body.entityId ||
    `cross-chain:${body.fromChain}:${body.toChain}:${body.targetCoinAddress.slice(0, 10)}`;
  const entityType = body.entityType || 'creator_coin';
  const activity = await recordUnifiedTip(env, {
    platform: body.fromChain === 'solana' ? 'solana' : 'degenfeed',
    entityId,
    entityType: entityType as TipEntityType,
    amountUsd,
    fromUserId: body.fromUserId,
    toUserId: body.creatorAddress,
    fromLabel: body.fromLabel || `Cross-chain tipper (${body.fromChain})`,
    toLabel: body.creatorProtocol
      ? `${body.creatorProtocol}:${body.creatorId || body.creatorAddress.slice(0, 8)}`
      : body.creatorAddress.slice(0, 6) + '…' + body.creatorAddress.slice(-4),
    entityLabel: body.entityLabel || `Cross-chain tip: ${body.fromChain} → ${body.toChain}`,
    method: `cross-chain:${body.fromCurrency}`,
  });

  const result: CrossChainTipResult = {
    success: true,
    settledAmountUsd: bridgeResult.receivedAmount,
    bridgeTxHash: bridgeResult.txHash,
    purchaseTxHash: buyResult.txHash,
    activityId: activity?.id,
  };

  return jsonResponse(result);
}

// ─── Bridge simulation helpers ───────────────────────────────────────────

interface BridgeSimResult {
  txHash: string;
  receivedAmount: number;
  feeUsd: number;
}

async function simulateBridge(opts: {
  fromChain: string;
  toChain: string;
  amountUsd: number;
  recipient: string;
}): Promise<BridgeSimResult> {
  // In production, calls Wormhole or LayerZero to bridge assets.
  // For simulation, deduct a 0.5% bridge fee.
  const bridgeFeeBps = 50; // 0.5%
  const feeUsd = Math.round((opts.amountUsd * bridgeFeeBps) / 10000 * 100) / 100;
  const receivedAmount = Math.round((opts.amountUsd - feeUsd) * 100) / 100;

  return {
    txHash: `0x${crypto.randomUUID().replace(/-/g, '')}`,
    receivedAmount,
    feeUsd,
  };
}

interface BuySimResult {
  txHash: string;
  tokensReceived: string;
}

async function simulateBuyCreatorCoin(opts: {
  coinAddress: string;
  amountUsd: number;
  chain: string;
}): Promise<BuySimResult> {
  // In production, calls the creator coin bonding curve on the target chain.
  return {
    txHash: `0x${crypto.randomUUID().replace(/-/g, '')}`,
    tokensReceived: (opts.amountUsd * 100).toFixed(0), // Simulated: 100 tokens per USD
  };
}

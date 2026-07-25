/**
 * @degenfeed/api-worker — Unified Tip Core
 *
 * Shared types, constants, key builders, sanitizers, KV helpers,
 * core tip recording logic, achievement badges, and POST /api/tip/unified handler.
 * Extracted from unified-tip.ts as the primary shared module.
 */

import type { Protocol } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';

// ─── Types ───────────────────────────────────────────────────────────────

export type TipPlatform =
  | 'degenfeed'
  | 'lemmy'
  | 'peertube'
  | 'bluesky'
  | 'mastodon'
  | 'farcaster'
  | 'lens'
  | 'solana';
export type TipEntityType = 'post' | 'comment' | 'video' | 'space' | 'creator_coin';
export type TipPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

// ─── Multi-Chain Types ─────────────────────────────────────────────────

export type SupportedChain =
  | 'lightning'
  | 'ethereum'
  | 'base'
  | 'solana'
  | 'polygon'
  | 'optimism'
  | 'arbitrum';

export interface ChainRoute {
  chain: SupportedChain;
  /** Native currency symbol */
  currency: string;
  /** Supported tokens for this chain */
  tokens: string[];
  /** Average fee in USD */
  avgFeeUsd: number;
  /** Settlement speed */
  speed: 'instant' | 'fast' | 'medium' | 'slow';
  /** Minimum amount in native currency */
  minAmount: number;
  /** Whether a pre-existing recipient address is needed */
  needsRecipient: boolean;
}

export const CHAIN_ROUTES: Record<SupportedChain, ChainRoute> = {
  lightning: {
    chain: 'lightning',
    currency: 'BTC',
    tokens: ['BTC'],
    avgFeeUsd: 0.001,
    speed: 'instant',
    minAmount: 0.00001,
    needsRecipient: true,
  },
  ethereum: {
    chain: 'ethereum',
    currency: 'ETH',
    tokens: ['ETH', 'USDC', 'USDT', 'DAI'],
    avgFeeUsd: 5,
    speed: 'medium',
    minAmount: 0.0001,
    needsRecipient: true,
  },
  base: {
    chain: 'base',
    currency: 'ETH',
    tokens: ['ETH', 'USDC'],
    avgFeeUsd: 0.01,
    speed: 'fast',
    minAmount: 0.0001,
    needsRecipient: true,
  },
  solana: {
    chain: 'solana',
    currency: 'SOL',
    tokens: ['SOL', 'USDC'],
    avgFeeUsd: 0.002,
    speed: 'fast',
    minAmount: 0.001,
    needsRecipient: true,
  },
  polygon: {
    chain: 'polygon',
    currency: 'MATIC',
    tokens: ['MATIC', 'USDC'],
    avgFeeUsd: 0.05,
    speed: 'fast',
    minAmount: 0.01,
    needsRecipient: true,
  },
  optimism: {
    chain: 'optimism',
    currency: 'ETH',
    tokens: ['ETH', 'USDC'],
    avgFeeUsd: 0.05,
    speed: 'fast',
    minAmount: 0.0001,
    needsRecipient: true,
  },
  arbitrum: {
    chain: 'arbitrum',
    currency: 'ETH',
    tokens: ['ETH', 'USDC'],
    avgFeeUsd: 0.05,
    speed: 'fast',
    minAmount: 0.0001,
    needsRecipient: true,
  },
};

export interface CreatorCoinInfo {
  address: string;
  symbol: string;
  name: string;
  chain: SupportedChain;
  creatorAddress: string;
  /** Price in USD per token (approximate) */
  priceUsd?: number;
}

/** Smart chain selection request */
export interface SmartChainSelectionRequest {
  /** Available chains for the sender */
  senderChains: SupportedChain[];
  /** Available chains for the recipient */
  recipientChains: SupportedChain[];
  /** Amount to tip in USD */
  amountUsd: number;
  /** Preferred chain if any */
  preferredChain?: SupportedChain;
  /** Whether the recipient has a Lightning address (cheapest) */
  recipientHasLightning?: boolean;
  /** Whether the recipient has a Solana address */
  recipientHasSolana?: boolean;
  /** Whether the recipient has an EVM address */
  recipientHasEvm?: boolean;
}

export interface SmartChainSelectionResult {
  chain: SupportedChain;
  rank: number;
  reason: string;
  route: ChainRoute;
}

/**
 * Smart-select the best chain for a tip.
 * Priority: Lightning (cheapest) > Solana (fast+cheap) > Base (L2 cheap) > Polygon > Optimism/Arbitrum > Ethereum
 */
export function selectBestChain(req: SmartChainSelectionRequest): SmartChainSelectionResult[] {
  const available = req.recipientChains.filter((c) => req.senderChains.includes(c));

  const scored = [...new Set(available)]
    .map((chain) => {
      const route = CHAIN_ROUTES[chain];
      if (!route) return null;

      let score = 0;
      // Fee score (lower fee = higher score)
      score += Math.max(0, 100 - route.avgFeeUsd * 10);
      // Speed bonus
      const speedScores = { instant: 60, fast: 40, medium: 20, slow: 0 };
      score += speedScores[route.speed] ?? 0;
      // Preference bonus
      if (chain === req.preferredChain) score += 30;
      // USD amount gates (small tips prefer cheap chains)
      if (req.amountUsd < 1 && route.avgFeeUsd > req.amountUsd * 0.5) score -= 50;
      if (req.amountUsd > 100 && chain === 'ethereum') score += 10; // Ethereum better for large amounts

      return { chain, score, route };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s, i) => ({
    chain: s.chain,
    rank: i + 1,
    reason: i === 0 ? 'Best balance of fees, speed, and recipient availability' : '',
    route: s.route,
  }));
}

export interface UnifiedTipEvent {
  platform: TipPlatform;
  entityId: string;
  entityType: TipEntityType;
  amountUsd: number;
  fromUserId?: string;
  toUserId?: string;
  fromLabel?: string;
  toLabel?: string;
  entityLabel?: string;
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

export interface PlatformBreakdown {
  totalUsd: number;
  count: number;
}

export interface UserSentRecord {
  totalUsd: number;
  count: number;
  lastTipAt: number;
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
  recent: ActivityItem[];
}

export interface UserReceivedRecord {
  totalUsd: number;
  count: number;
  lastTipAt: number;
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
  tippers: string[];
  recent: ActivityItem[];
}

export interface UnifiedLeaderboardEntry {
  userId: string;
  totalUsd: number;
  count: number;
  platform: TipPlatform;
  byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
}

export interface LeaderboardRecord {
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

export interface CrossChainTipRequest {
  amountUsd: number;
  fromChain: 'solana' | 'base' | 'polygon' | 'ethereum';
  fromCurrency: string;
  toChain: 'solana' | 'base' | 'polygon' | 'ethereum';
  targetCoinAddress: string;
  creatorAddress: string;
  creatorProtocol?: string;
  creatorId?: string;
  fromUserId?: string;
  fromLabel?: string;
  entityId?: string;
  entityType?: TipEntityType;
  entityLabel?: string;
}

export interface CrossChainTipResult {
  success: boolean;
  settledAmountUsd: number;
  bridgeTxHash?: string;
  purchaseTxHash?: string;
  activityId?: string;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

export const PLATFORMS = new Set<string>([
  'degenfeed',
  'lemmy',
  'peertube',
  'bluesky',
  'mastodon',
  'farcaster',
  'lens',
]);
export const ENTITY_TYPES = new Set<string>(['post', 'comment', 'video', 'space', 'creator_coin']);
export const PERIODS: TipPeriod[] = ['daily', 'weekly', 'monthly', 'alltime'];
export const ACTIVITY_KEY = 'tip:activity:recent';
export const TTL_1Y = 60 * 60 * 24 * 365;
export const MAX_TIP_USD = 10_000;
export const MAX_ENTITY_TIPS = 200;
export const MAX_ACTIVITY = 100;
export const MAX_RECENT_PER_USER = 25;
export const MAX_TIPPERS_TRACKED = 1_000;
export const MAX_LEADERBOARD = 100;

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

export function periodBucket(period: TipPeriod, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  switch (period) {
    case 'daily':
      return `${y}-${m}-${d}`;
    case 'weekly': {
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

export function normalizeUserId(raw: unknown): string | undefined {
  const str = sanitizeString(raw, 128);
  if (!str || hasSuspiciousPayload(str)) return undefined;
  return str.startsWith('0x') ? str.toLowerCase() : str;
}

export function sanitizeEntityId(raw: unknown): string | null {
  const str = sanitizeString(raw, 256);
  if (!str || str.length < 1 || hasSuspiciousPayload(str)) return null;
  return str;
}

export function sanitizeAmountUsd(raw: unknown): number | null {
  const num = typeof raw === 'number' ? raw : Number.parseFloat(sanitizeString(raw, 64) || 'NaN');
  if (!Number.isFinite(num) || num <= 0 || num > MAX_TIP_USD) return null;
  return Math.round(num * 100) / 100;
}

export function isPlatform(value: string): value is TipPlatform {
  return PLATFORMS.has(value);
}
export function isEntityType(value: string): value is TipEntityType {
  return ENTITY_TYPES.has(value);
}
export function isPeriod(value: string): value is TipPeriod {
  return (PERIODS as string[]).includes(value);
}

export function shortLabel(id: string | undefined, fallback: string): string {
  if (!id) return fallback;
  if (id.startsWith('0x') && id.length > 12) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  if (id.length > 24) return `${id.slice(0, 21)}…`;
  return id;
}

// ─── KV helpers ──────────────────────────────────────────────────────────

export async function kvGetJson<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvPutJson(env: Env, key: string, value: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn(
      `[unified-tip] KV put failed for ${key}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export function bumpBreakdown(
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

export async function recordUnifiedTip(
  env: Env,
  event: UnifiedTipEvent,
): Promise<ActivityItem | null> {
  if (!env.CACHE) return null;
  const entityId = sanitizeEntityId(event.entityId);
  const amountUsd = sanitizeAmountUsd(event.amountUsd);
  if (!entityId || !amountUsd || !isPlatform(event.platform) || !isEntityType(event.entityType))
    return null;
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
      if (fromUserId && !record.tippers.includes(fromUserId))
        record.tippers = [...record.tippers, fromUserId].slice(-MAX_TIPPERS_TRACKED);
      record.recent = [activity, ...(record.recent ?? [])].slice(0, MAX_RECENT_PER_USER);
      await kvPutJson(env, key, record);
    } catch (err) {
      console.warn('[unified-tip] received record failed:', String(err));
    }
  }
  if (toUserId) {
    for (const period of PERIODS) {
      try {
        const bucket = periodBucket(period);
        const key = leaderboardKey(period);
        let record = await kvGetJson<LeaderboardRecord>(env, key);
        if (!record || record.bucket !== bucket) record = { bucket, updatedAt: now, entries: [] };
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
  try {
    const feed = (await kvGetJson<ActivityItem[]>(env, ACTIVITY_KEY)) ?? [];
    await kvPutJson(env, ACTIVITY_KEY, [activity, ...feed].slice(0, MAX_ACTIVITY));
  } catch (err) {
    console.warn('[unified-tip] activity feed failed:', String(err));
  }
  fireTipSyncEvent(env, event, activity).catch((err) =>
    console.error('[unified-tip] realtime sync failed:', err),
  );
  if (toUserId && amountUsd > 0) {
    try {
      const { recordCreatorMetrics } = await import('../lib/creator-rewards');
      await recordCreatorMetrics(env, toUserId, {
        tipsReceived: Math.round(amountUsd * 100),
        tipperCount: 1,
      });
    } catch {
      /* non-fatal */
    }
  }
  if (fromUserId) {
    try {
      await checkTipAchievements(env, fromUserId, toUserId, amountUsd, event);
    } catch {
      /* non-fatal */
    }
  }
  // Fire-and-forget tip notification — enhances the basic KV notification with
  // push, email digest, WebSocket broadcast, and protocol-specific notifications
  if (toUserId && fromUserId && activity) {
    try {
      const { sendTipNotification } = await import('../lib/tip-notifications');
      const protocolBadgeMap: Record<string, string> = {
        degenfeed: '🔄',
        lemmy: '🤖',
        peertube: '🎬',
        bluesky: '☁️',
        mastodon: '🐘',
        farcaster: '◈',
        lens: '◎',
        solana: '◎',
      };
      await sendTipNotification(env, {
        id: activity.id,
        type: 'tip',
        sourceProtocol: event.platform,
        actorName: activity.fromLabel,
        actorHandle: fromUserId,
        amount: String(amountUsd),
        currency: 'USD',
        chain: event.method?.replace('cross-chain:', ''),
        protocolBadge: protocolBadgeMap[event.platform] ?? '⚡',
        entityId: event.entityId,
        entityType: event.entityType,
        message: `Tip of $${amountUsd} on ${event.entityType}`,
        createdAt: activity.at,
        read: false,
        amountUsd,
      });
    } catch {
      /* non-fatal */
    }
  }
  return activity;
}

async function fireTipSyncEvent(
  env: Env,
  event: UnifiedTipEvent,
  activity: ActivityItem,
): Promise<void> {
  try {
    const { createEvent, onEvent } = await import('../lib/realtime-sync');
    const protocolMap: Record<string, string> = {
      degenfeed: 'nostr',
      lemmy: 'mastodon',
      peertube: 'peertube',
      bluesky: 'bluesky',
      mastodon: 'mastodon',
      farcaster: 'farcaster',
      lens: 'lens',
      solana: 'solana',
    };
    const sourceProtocol = (protocolMap[event.platform] ?? 'nostr') as Protocol;
    const syncEvent = createEvent(
      sourceProtocol,
      'tip',
      activity.id,
      { id: event.fromUserId ?? 'anonymous', handle: event.fromLabel },
      {
        text: `Tip of $${event.amountUsd} on ${event.entityType}`,
        subjectId: event.entityId,
        tipAmountUsd: event.amountUsd,
        raw: {
          platform: event.platform,
          entityType: event.entityType,
          toUserId: event.toUserId,
          toLabel: event.toLabel,
          method: event.method,
        },
      },
    );
    await onEvent(sourceProtocol, syncEvent, env);
  } catch (e) {
    console.error('[unified-tip] fireTipSyncEvent error:', e);
  }
}

// ─── POST /api/tip/unified ───────────────────────────────────────────────

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
    if (!platform || !isPlatform(platform))
      return jsonResponse({ error: 'platform must be one of: degenfeed, lemmy, peertube' }, 400);
    if (!entityId) return jsonResponse({ error: 'entityId required' }, 400);
    if (!entityTypeRaw || !isEntityType(entityTypeRaw))
      return jsonResponse({ error: 'entityType must be one of: post, comment, video, space' }, 400);
    if (!amountUsd)
      return jsonResponse({ error: `amountUsd must be a positive number ≤ ${MAX_TIP_USD}` }, 400);
    const entityType = entityTypeRaw as TipEntityType;
    const method = sanitizeString(body.method ?? body.currency, 32) || 'usdc';
    const fromUserId = normalizeUserId(body.fromUserId);
    const toUserId = normalizeUserId(body.toUserId);
    const payload = body.platformPayload ?? {};
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
        if (!activity) return jsonResponse({ error: 'Failed to record tip' }, 500);
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

// ─── Achievement Badge Checking ──────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'tipping' | 'engagement' | 'loyalty' | 'cross_chain' | 'early_adopter';
}

export const TIP_BADGES: Badge[] = [
  {
    id: 'first_tip',
    name: 'First Tip',
    description: 'Sent your first tip',
    icon: '🎯',
    category: 'tipping',
  },
  {
    id: 'generous',
    name: 'Generous',
    description: 'Tipped 10+ different creators',
    icon: '💝',
    category: 'tipping',
  },
  {
    id: 'whale_tipper',
    name: 'Whale Tipper',
    description: 'Tipped 1M+ sats total value',
    icon: '🐋',
    category: 'tipping',
  },
  {
    id: 'loyal_fan',
    name: 'Loyal Fan',
    description: 'Tipped the same creator 50+ times',
    icon: '⭐',
    category: 'loyalty',
  },
  {
    id: 'cross_chain_tipper',
    name: 'Cross-Chain Tipper',
    description: 'Tipped on 3+ different protocols',
    icon: '🌉',
    category: 'cross_chain',
  },
  {
    id: 'early_believer',
    name: 'Early Believer',
    description: 'Tipped a creator before they hit 100 followers',
    icon: '🌅',
    category: 'early_adopter',
  },
];

export async function checkTipAchievements(
  env: Env,
  userId: string,
  toUserId: string | undefined,
  amountUsd: number,
  event: UnifiedTipEvent,
): Promise<string[]> {
  if (!env.CACHE) return [];
  const awarded: string[] = [];
  const sentKey = userSentKey(userId);
  const sentRecord = await kvGetJson<UserSentRecord>(env, sentKey);
  if (sentRecord && sentRecord.count === 1) {
    await awardBadge(env, userId, 'first_tip');
    awarded.push('first_tip');
  }
  const receivedTippers = sentRecord?.recent
    ? [...new Set(sentRecord.recent.map((a) => a.toUserId).filter(Boolean))]
    : [];
  if (receivedTippers.length >= 10) {
    const hasBadge = await hasBadgeAward(env, userId, 'generous');
    if (!hasBadge) {
      await awardBadge(env, userId, 'generous');
      awarded.push('generous');
    }
  }
  const totalSentUsd = sentRecord?.totalUsd ?? 0;
  if (totalSentUsd >= 10000) {
    const hasBadge = await hasBadgeAward(env, userId, 'whale_tipper');
    if (!hasBadge) {
      await awardBadge(env, userId, 'whale_tipper');
      awarded.push('whale_tipper');
    }
  }
  if (toUserId && sentRecord) {
    const tipsToCreator = sentRecord.recent.filter((a) => a.toUserId === toUserId).length;
    if (tipsToCreator >= 10) {
      const hasBadge = await hasBadgeAward(env, userId, 'loyal_fan');
      if (!hasBadge) {
        await awardBadge(env, userId, 'loyal_fan');
        awarded.push('loyal_fan');
      }
    }
  }
  if (sentRecord?.byPlatform) {
    const platformCount = Object.keys(sentRecord.byPlatform).length;
    if (platformCount >= 3) {
      const hasBadge = await hasBadgeAward(env, userId, 'cross_chain_tipper');
      if (!hasBadge) {
        await awardBadge(env, userId, 'cross_chain_tipper');
        awarded.push('cross_chain_tipper');
      }
    }
  }
  if (sentRecord && sentRecord.count <= 3) {
    const hasBadge = await hasBadgeAward(env, userId, 'early_believer');
    if (!hasBadge) {
      await awardBadge(env, userId, 'early_believer');
      awarded.push('early_believer');
    }
  }
  return awarded;
}

export async function awardBadge(env: Env, userId: string, badgeId: string): Promise<void> {
  const badge = TIP_BADGES.find((b) => b.id === badgeId);
  if (!badge) return;
  await env.CACHE?.put(
    `badge:${userId}:${badgeId}`,
    JSON.stringify({
      badgeId,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      awardedAt: Date.now(),
    }),
    { expirationTtl: TTL_1Y },
  );
  const listKey = `badges:${userId}`;
  try {
    const raw = await env.CACHE?.get(listKey);
    const badges: string[] = raw ? JSON.parse(raw) : [];
    if (!badges.includes(badgeId)) {
      badges.push(badgeId);
      await env.CACHE?.put(listKey, JSON.stringify(badges), { expirationTtl: TTL_1Y });
    }
  } catch {
    /* ignore */
  }
}

export async function hasBadgeAward(env: Env, userId: string, badgeId: string): Promise<boolean> {
  try {
    const existing = await env.CACHE?.get(`badge:${userId}:${badgeId}`);
    return existing !== null;
  } catch {
    return false;
  }
}

/**
 * @degenfeed/api-worker — Native Protocol Tipping for ALL Self-Hosted Instances
 *
 * Unified tip button handlers for every protocol we own. Each handler:
 *   1. Validates input (sanitized, size-limited)
 *   2. Records protocol-specific aggregate (KV)
 *   3. Records in the unified cross-platform ledger
 *   4. Sends notification via the tip notification pipeline
 *   5. Returns the updated aggregate to the client
 *
 * Protocols covered:
 *   PeerTube   — videos, live streams (enhanced from existing)
 *   Lemmy      — posts, comments (enhanced from existing)
 *   Pixelfed   — images, posts
 *   WriteFreely — blog posts
 *   BookWyrm   — book reviews
 *   Mobilizon  — events
 *   Owncast    — live streams (enhanced from existing)
 *   Funkwhale  — music tracks
 *   Castopod   — podcast episodes
 *   GoToSocial — toots / statuses
 *   Bluesky PDS— posts (self-hosted PDS variant)
 *   Misskey    — notes
 *   Pleroma    — posts
 */

import { identityKey } from '@degenfeed/utils';
import type { Env } from '../types';
import { jsonResponse } from '../response-helpers';
import { sendTipNotification } from '../lib/tip-notifications';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import { recordUnifiedTip, type TipEntityType, type TipPlatform } from './unified-tip-core';

// ─── Shared Types ─────────────────────────────────────────────────────────

interface ProtocolTipRecord {
  amount: number;
  currency: string;
  from?: string;
  fromLabel?: string;
  timestamp: number;
}

interface ProtocolTipAggregate {
  entityId: string;
  entityType: string;
  platform: string;
  totalUsd: number;
  totalCount: number;
  tips: ProtocolTipRecord[];
  lastTippedAt: number;
  creatorInfo: {
    name: string;
    channel?: string;
    avatar?: string;
    instanceDomain?: string;
  };
}

interface ProtocolLeaderboardEntry {
  entityId: string;
  entityType: string;
  creatorName: string;
  creatorChannel: string;
  instanceDomain: string;
  totalUsd: number;
  totalCount: number;
}

// ─── Protocol Configs ─────────────────────────────────────────────────────

interface ProtocolConfig {
  platform: TipPlatform;
  prefix: string;
  entityType: TipEntityType;
  supportedCurrencies: string[];
  defaultCurrency: string;
  instanceEnvVar: string;
  defaultInstance: string;
  protocolBadge: string;
}

const PROTOCOL_CONFIGS: Record<string, ProtocolConfig> = {
  pixelfed: {
    platform: 'degenfeed',
    prefix: 'pixelfed:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'PIXELFED_INSTANCE_URL',
    defaultInstance: 'https://pixelfed.degenfeed.xyz',
    protocolBadge: '📷',
  },
  writefreely: {
    platform: 'degenfeed',
    prefix: 'writefreely:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'btc',
    instanceEnvVar: 'WRITEFREELY_INSTANCE_URL',
    defaultInstance: 'https://write.degenfeed.xyz',
    protocolBadge: '✍️',
  },
  bookwyrm: {
    platform: 'degenfeed',
    prefix: 'bookwyrm:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'BOOKWYRM_INSTANCE_URL',
    defaultInstance: 'https://books.degenfeed.xyz',
    protocolBadge: '📚',
  },
  mobilizon: {
    platform: 'degenfeed',
    prefix: 'mobilizon:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'MOBILIZON_INSTANCE_URL',
    defaultInstance: 'https://events.degenfeed.xyz',
    protocolBadge: '📅',
  },
  owncast: {
    platform: 'degenfeed',
    prefix: 'owncast:tip:',
    entityType: 'space',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'OWNCAST_INSTANCE_URL',
    defaultInstance: 'https://owncast.degenfeed.xyz',
    protocolBadge: '📡',
  },
  funkwhale: {
    platform: 'degenfeed',
    prefix: 'funkwhale:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'FUNKWHALE_INSTANCE_URL',
    defaultInstance: 'https://music.degenfeed.xyz',
    protocolBadge: '🎵',
  },
  castopod: {
    platform: 'degenfeed',
    prefix: 'castopod:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'btc',
    instanceEnvVar: 'CASTOPOD_INSTANCE_URL',
    defaultInstance: 'https://podcast.degenfeed.xyz',
    protocolBadge: '🎙️',
  },
  gotosocial: {
    platform: 'degenfeed',
    prefix: 'gotosocial:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'eth',
    instanceEnvVar: 'GOTOSOCIAL_INSTANCE_URL',
    defaultInstance: 'https://social.degenfeed.xyz',
    protocolBadge: '🐘',
  },
  blueskypds: {
    platform: 'bluesky',
    prefix: 'blueskypds:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'BLUESKY_PDS_URL',
    defaultInstance: 'https://pds.degenfeed.xyz',
    protocolBadge: '☁️',
  },
  misskey: {
    platform: 'degenfeed',
    prefix: 'misskey:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'sol',
    instanceEnvVar: 'MISSKEY_INSTANCE_URL',
    defaultInstance: 'https://notes.degenfeed.xyz',
    protocolBadge: '🔮',
  },
  pleroma: {
    platform: 'degenfeed',
    prefix: 'pleroma:tip:',
    entityType: 'post',
    supportedCurrencies: ['eth', 'sol', 'btc', 'usdc', 'base', 'matic'],
    defaultCurrency: 'eth',
    instanceEnvVar: 'PLEROMA_INSTANCE_URL',
    defaultInstance: 'https://pleroma.degenfeed.xyz',
    protocolBadge: '🌀',
  },
};

// ─── KV Helper Factory ────────────────────────────────────────────────────

function sanitizeEntityId(raw: unknown): string | null {
  const str = sanitizeString(raw, 256);
  if (!str || str.length < 3 || hasSuspiciousPayload(str)) return null;
  if (!/^[a-zA-Z0-9\-_:./@]+$/.test(str)) return null;
  return str;
}

function sanitizeCurrency(raw: unknown, allowed: Set<string>): string | null {
  const val = sanitizeString(raw, 16);
  return val && allowed.has(val) ? val : null;
}

const TTL_1Y = 60 * 60 * 24 * 365;
const MAX_TIPS = 500;
const MAX_LEADERBOARD = 100;

async function getAggregate(
  env: Env,
  prefix: string,
  entityId: string,
): Promise<ProtocolTipAggregate | null> {
  try {
    const raw = await env.CACHE?.get(`${prefix}${entityId}`);
    return raw ? (JSON.parse(raw) as ProtocolTipAggregate) : null;
  } catch {
    return null;
  }
}

async function saveAggregate(env: Env, prefix: string, agg: ProtocolTipAggregate): Promise<void> {
  try {
    await env.CACHE?.put(`${prefix}${agg.entityId}`, JSON.stringify(agg), {
      expirationTtl: TTL_1Y,
    });
  } catch (err) {
    console.warn(
      `[native-protocol-tips] KV save failed for ${prefix}${agg.entityId}:`,
      String(err),
    );
  }
}

async function updateLeaderboard(
  env: Env,
  leaderboardKey: string,
  entry: ProtocolLeaderboardEntry,
): Promise<void> {
  try {
    const raw = await env.CACHE?.get(leaderboardKey);
    let board: ProtocolLeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    const idx = board.findIndex((e) => e.entityId === entry.entityId);
    if (idx >= 0) board[idx] = entry;
    else board.push(entry);
    board.sort((a, b) => b.totalUsd - a.totalUsd);
    board = board.slice(0, MAX_LEADERBOARD);
    await env.CACHE?.put(leaderboardKey, JSON.stringify(board), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn(
      `[native-protocol-tips] leaderboard update failed for ${leaderboardKey}:`,
      String(err),
    );
  }
}

// ─── Shared Recording Path ────────────────────────────────────────────────

interface RecordNativeProtocolTipInput {
  protocolKey: string;
  entityId: string;
  entityType: string;
  creatorName: string;
  creatorChannel: string;
  instanceDomain: string;
  amountUsd: number;
  currency: string;
  from?: string;
  fromLabel?: string;
  toLabel?: string;
  entityLabel?: string;
  recipientUserId?: string;
  /** Protocol-specific extra payload for native API calls */
  nativePayload?: Record<string, unknown>;
}

async function recordNativeProtocolTip(
  env: Env,
  input: RecordNativeProtocolTipInput,
): Promise<{ totalUsd: number; totalCount: number; tipId: string }> {
  const config = PROTOCOL_CONFIGS[input.protocolKey];
  if (!config) throw new Error(`Unknown protocol: ${input.protocolKey}`);

  const { entityId, creatorName, creatorChannel, instanceDomain, currency } = input;
  const amount = Math.round(input.amountUsd * 100) / 100;
  const origin = `${config.defaultInstance}`;

  const tipId = `${config.prefix}${entityId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  // 1. Store tip record
  const existing = await getAggregate(env, config.prefix, entityId);
  const aggregate: ProtocolTipAggregate = existing ?? {
    entityId,
    entityType: input.entityType || config.entityType,
    platform: config.platform,
    totalUsd: 0,
    totalCount: 0,
    tips: [],
    lastTippedAt: 0,
    creatorInfo: {
      name: creatorName,
      channel: creatorChannel,
      instanceDomain,
    },
  };

  aggregate.totalUsd += amount;
  aggregate.totalCount += 1;
  aggregate.tips.push({
    amount,
    currency,
    from: input.from || undefined,
    fromLabel: input.fromLabel || undefined,
    timestamp: Date.now(),
  });
  aggregate.lastTippedAt = Date.now();
  if (aggregate.tips.length > MAX_TIPS) {
    aggregate.tips = aggregate.tips.slice(-MAX_TIPS);
  }

  await saveAggregate(env, config.prefix, aggregate);

  // 2. Update leaderboard
  await updateLeaderboard(env, `${config.prefix}leaderboard`, {
    entityId,
    entityType: input.entityType || config.entityType,
    creatorName,
    creatorChannel,
    instanceDomain,
    totalUsd: aggregate.totalUsd,
    totalCount: aggregate.totalCount,
  });

  // 3. Call native protocol API if configured
  await callNativeProtocolApi(env, input.protocolKey, origin, {
    entityId,
    creatorName,
    creatorChannel,
    amount: String(amount),
    currency,
    from: input.from,
    fromLabel: input.fromLabel,
    message: `Tip of $${amount} from DegenFeed`,
    nativePayload: input.nativePayload,
  });

  // 4. Identity resolution
  let resolvedUserId = input.recipientUserId || creatorChannel;
  if (
    !/^0x[a-f0-9]{40}$/i.test(resolvedUserId) &&
    !/^[1-9a-hj-z]{32,44}$/.test(resolvedUserId) &&
    env.IDENTITIES
  ) {
    try {
      const key = identityKey(resolvedUserId);
      const raw = await env.IDENTITIES?.get(key);
      if (raw) {
        const identity = JSON.parse(raw) as Record<string, unknown>;
        if (identity.walletAddress) {
          resolvedUserId = identity.walletAddress as string;
        }
      }
    } catch {
      // Best-effort
    }
  }

  // 5. Record in unified cross-platform ledger
  const activity = await recordUnifiedTip(env, {
    platform: config.platform,
    entityId: `${input.protocolKey}:${entityId}`,
    entityType: config.entityType,
    amountUsd: amount,
    fromUserId: input.from || undefined,
    toUserId: resolvedUserId,
    fromLabel: input.fromLabel || undefined,
    toLabel: input.toLabel || creatorName,
    entityLabel: input.entityLabel || `${input.protocolKey} ${input.entityType}`,
    method: `${input.protocolKey}_${currency}`,
  });

  // 6. Send notification
  if (resolvedUserId && activity) {
    try {
      await sendTipNotification(env, {
        id: activity.id,
        type: 'tip',
        sourceProtocol: input.protocolKey,
        actorName: input.fromLabel || (input.from ? `${input.from.slice(0, 6)}…` : 'Anonymous'),
        actorHandle: input.from || '',
        amount: String(amount),
        currency: 'USD',
        protocolBadge: config.protocolBadge,
        entityId,
        entityType: input.entityType || config.entityType,
        message: `💸 ${input.fromLabel || 'Someone'} tipped $${amount}`,
        createdAt: Date.now(),
        read: false,
        amountUsd: amount,
      });
    } catch {
      // Non-fatal
    }
  }

  return { totalUsd: aggregate.totalUsd, totalCount: aggregate.totalCount, tipId };
}

// ─── Native API Caller ────────────────────────────────────────────────────

interface NativeApiCallParams {
  entityId: string;
  creatorName: string;
  creatorChannel: string;
  amount: string;
  currency: string;
  from?: string;
  fromLabel?: string;
  message?: string;
  nativePayload?: Record<string, unknown>;
}

async function callNativeProtocolApi(
  env: Env,
  protocol: string,
  origin: string,
  params: NativeApiCallParams,
): Promise<void> {
  try {
    switch (protocol) {
      case 'peertube':
        // Enhanced: post tip to PeerTube instance API
        await fetch(`${origin}/api/v1/tips`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            videoId: params.entityId,
            tipperName: params.fromLabel || params.from || 'Anonymous',
            tipperMessage: params.message || '',
            amount: params.amount,
            currency: params.currency || 'USD',
          }),
          signal: AbortSignal.timeout(5000),
        });
        break;

      case 'lemmy':
        // Post comment on tip (via Lemmy API)
        if (env.LEMMY_JWT) {
          await fetch(`${origin}/api/v3/comment`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${env.LEMMY_JWT}`,
            },
            body: JSON.stringify({
              post_id: Number(params.entityId),
              content: `💸 ${params.fromLabel || 'Someone'} tipped $${params.amount}!`,
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
        break;

      case 'owncast':
        // Enhanced Owncast: post to external action + chat
        await Promise.allSettled([
          fetch(`${origin}/api/admin/external/useraction`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              userId: params.creatorChannel,
              userName: params.fromLabel || 'Anonymous',
              action: 'tip',
              amount: params.amount,
              message: params.message || '',
            }),
            signal: AbortSignal.timeout(5000),
          }),
          // Also send to Owncast chat
          fetch(`${origin}/api/chat/send`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              body: `💸 ${params.fromLabel || 'Anonymous'} tipped $${params.amount}!`,
            }),
            signal: AbortSignal.timeout(5000),
          }),
        ]);
        break;

      case 'gotosocial':
        // Post a status about the tip
        if (env.GTS_ACCESS_TOKEN) {
          await fetch(`${origin}/api/v1/statuses`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${env.GTS_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              status: `💸 ${params.fromLabel || 'Someone'} tipped ${params.creatorName} $${params.amount}!`,
              visibility: 'unlisted',
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
        break;

      case 'pixelfed':
        // Pixelfed has ActivityPub — post a comment via the API
        if (env.PIXELFED_ACCESS_TOKEN) {
          await fetch(`${origin}/api/v1/statuses`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${env.PIXELFED_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              status: `💸 ${params.fromLabel || 'Someone'} sent a tip!`,
              visibility: 'direct', // Only visible to recipient
              in_reply_to_id: params.entityId,
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
        break;

      default:
        // For protocols without native API access, just record in ledger
        break;
    }
  } catch {
    // Native API calls are best-effort
  }
}

// ─── Generic Handler Factory ──────────────────────────────────────────────

function createProtocolTipHandler(protocolKey: string) {
  const config = PROTOCOL_CONFIGS[protocolKey];
  if (!config) throw new Error(`Unknown protocol: ${protocolKey}`);

  return async (request: Request, env: Env): Promise<Response> => {
    const bodySizeCheck = validateBodySize(request, 10 * 1024);
    if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

    try {
      const body = (await request.json()) as Record<string, unknown>;
      const entityId = sanitizeEntityId(body.entityId);
      const creatorName = sanitizeString(body.creatorName, 256);
      const creatorChannel = sanitizeString(body.creatorChannel, 256);
      const entityLabel = sanitizeString(body.entityLabel, 512);
      const instanceDomain = sanitizeString(body.instanceDomain, 128);
      const amountStr = sanitizeString(body.amount, 64);
      const currency = sanitizeCurrency(
        body.currency ?? body.method,
        new Set(config.supportedCurrencies),
      );
      const method = sanitizeString(body.method ?? body.currency, 32);
      const from = sanitizeString(body.from, 128);
      const fromLabel = sanitizeString(body.fromLabel, 64);
      const toLabel = sanitizeString(body.toLabel, 64);
      const recipientUserId = sanitizeString(body.recipientUserId, 128);

      if (
        !entityId ||
        !creatorName ||
        !creatorChannel ||
        !amountStr ||
        !isValidAmount(amountStr) ||
        !currency
      ) {
        return jsonResponse(
          { error: 'entityId, creatorName, creatorChannel, amount, and currency are required' },
          400,
        );
      }

      const amountNum = Number.parseFloat(amountStr);
      if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
        return jsonResponse({ error: 'Amount must be between 0.01 and 10,000' }, 400);
      }

      const result = await recordNativeProtocolTip(env, {
        protocolKey,
        entityId,
        entityType: config.entityType,
        creatorName,
        creatorChannel,
        instanceDomain: instanceDomain || config.defaultInstance,
        amountUsd: amountNum,
        currency,
        from: from || undefined,
        fromLabel: fromLabel || undefined,
        toLabel: toLabel || undefined,
        entityLabel: entityLabel || undefined,
        recipientUserId: recipientUserId || undefined,
      });

      return jsonResponse({
        success: true,
        protocol: protocolKey,
        entityId,
        tipId: result.tipId,
        totalUsd: result.totalUsd,
        totalCount: result.totalCount,
      });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  };
}

function createProtocolTipStatsHandler(protocolKey: string) {
  const config = PROTOCOL_CONFIGS[protocolKey];
  return async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);
    const entityId = sanitizeEntityId(url.searchParams.get('entityId'));

    if (!entityId) {
      return jsonResponse({ error: 'entityId query parameter required' }, 400);
    }

    const agg = await getAggregate(env, config.prefix, entityId);

    if (!agg) {
      return jsonResponse({
        entityId,
        totalUsd: 0,
        totalCount: 0,
        tips: [],
        lastTippedAt: null,
      });
    }

    return jsonResponse({
      entityId: agg.entityId,
      creatorName: agg.creatorInfo.name,
      totalUsd: agg.totalUsd,
      totalCount: agg.totalCount,
      lastTippedAt: agg.lastTippedAt,
      recentTips: agg.tips.slice(-50).reverse(),
    });
  };
}

function createProtocolLeaderboardHandler(protocolKey: string) {
  const config = PROTOCOL_CONFIGS[protocolKey];
  return async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

    try {
      const raw = await env.CACHE?.get(`${config.prefix}leaderboard`);
      if (!raw) {
        return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
      }
      const board: ProtocolLeaderboardEntry[] = JSON.parse(raw).slice(0, limit);
      return jsonResponse({ leaderboard: board, meta: { total: board.length, limit } });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  };
}

// ─── Export all protocol handlers ─────────────────────────────────────────

export const protocolKeys = Object.keys(PROTOCOL_CONFIGS);

// Create all handlers dynamically
type ProtocolHandlerMap = {
  [K in keyof typeof PROTOCOL_CONFIGS]: {
    handleTipCreate: ReturnType<typeof createProtocolTipHandler>;
    handleTipStats: ReturnType<typeof createProtocolTipStatsHandler>;
    handleLeaderboard: ReturnType<typeof createProtocolLeaderboardHandler>;
  };
};

export const protocolHandlers = Object.fromEntries(
  Object.keys(PROTOCOL_CONFIGS).map((key) => [
    key,
    {
      handleTipCreate: createProtocolTipHandler(key),
      handleTipStats: createProtocolTipStatsHandler(key),
      handleLeaderboard: createProtocolLeaderboardHandler(key),
    },
  ]),
) as ProtocolHandlerMap;

// ─── Individual named exports (for imports from route registration) ──────

// Pixelfed
export const handlePixelfedTipCreate = createProtocolTipHandler('pixelfed');
export const handlePixelfedTipStats = createProtocolTipStatsHandler('pixelfed');
export const handlePixelfedLeaderboard = createProtocolLeaderboardHandler('pixelfed');

// WriteFreely
export const handleWriteFreelyTipCreate = createProtocolTipHandler('writefreely');
export const handleWriteFreelyTipStats = createProtocolTipStatsHandler('writefreely');
export const handleWriteFreelyLeaderboard = createProtocolLeaderboardHandler('writefreely');

// BookWyrm
export const handleBookWyrmTipCreate = createProtocolTipHandler('bookwyrm');
export const handleBookWyrmTipStats = createProtocolTipStatsHandler('bookwyrm');
export const handleBookWyrmLeaderboard = createProtocolLeaderboardHandler('bookwyrm');

// Mobilizon
export const handleMobilizonTipCreate = createProtocolTipHandler('mobilizon');
export const handleMobilizonTipStats = createProtocolTipStatsHandler('mobilizon');
export const handleMobilizonLeaderboard = createProtocolLeaderboardHandler('mobilizon');

// Owncast (enhanced)
export const handleOwncastTipCreate = createProtocolTipHandler('owncast');
export const handleOwncastTipStats = createProtocolTipStatsHandler('owncast');
export const handleOwncastLeaderboard = createProtocolLeaderboardHandler('owncast');

// Funkwhale
export const handleFunkwhaleTipCreate = createProtocolTipHandler('funkwhale');
export const handleFunkwhaleTipStats = createProtocolTipStatsHandler('funkwhale');
export const handleFunkwhaleLeaderboard = createProtocolLeaderboardHandler('funkwhale');

// Castopod
export const handleCastopodTipCreate = createProtocolTipHandler('castopod');
export const handleCastopodTipStats = createProtocolTipStatsHandler('castopod');
export const handleCastopodLeaderboard = createProtocolLeaderboardHandler('castopod');

// GoToSocial
export const handleGoToSocialTipCreate = createProtocolTipHandler('gotosocial');
export const handleGoToSocialTipStats = createProtocolTipStatsHandler('gotosocial');
export const handleGoToSocialLeaderboard = createProtocolLeaderboardHandler('gotosocial');

// Bluesky PDS
export const handleBlueskyPdsTipCreate = createProtocolTipHandler('blueskypds');
export const handleBlueskyPdsTipStats = createProtocolTipStatsHandler('blueskypds');
export const handleBlueskyPdsLeaderboard = createProtocolLeaderboardHandler('blueskypds');

// Misskey
export const handleMisskeyTipCreate = createProtocolTipHandler('misskey');
export const handleMisskeyTipStats = createProtocolTipStatsHandler('misskey');
export const handleMisskeyLeaderboard = createProtocolLeaderboardHandler('misskey');

// Pleroma
export const handlePleromaTipCreate = createProtocolTipHandler('pleroma');
export const handlePleromaTipStats = createProtocolTipStatsHandler('pleroma');
export const handlePleromaLeaderboard = createProtocolLeaderboardHandler('pleroma');

// ─── Enhanced PeerTube & Owncast (existing route additions) ───────────────

export async function handleEnhancedPeerTubeTipCreate(
  request: Request,
  env: Env,
): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const videoId = sanitizeEntityId(body.videoId);
    const creatorName = sanitizeString(body.creatorName, 256);
    const creatorChannel = sanitizeString(body.creatorChannel, 256);
    const videoTitle = sanitizeString(body.videoTitle, 512);
    const instanceDomain = sanitizeString(body.instanceDomain, 128);
    const amountStr = sanitizeString(body.amount, 64);
    const from = sanitizeString(body.sender ?? body.from, 128);

    if (!videoId || !creatorName || !creatorChannel || !amountStr || !isValidAmount(amountStr)) {
      return jsonResponse(
        { error: 'videoId, creatorName, creatorChannel, and amount required' },
        400,
      );
    }

    const amountNum = Number.parseFloat(amountStr);
    if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
      return jsonResponse({ error: 'Amount must be between 0.01 and 10,000' }, 400);
    }

    const result = await recordNativeProtocolTip(env, {
      protocolKey: 'peertube',
      entityId: videoId,
      entityType: 'video',
      creatorName,
      creatorChannel,
      instanceDomain: instanceDomain || 'https://video.degenfeed.xyz',
      amountUsd: amountNum,
      currency: 'sol',
      from: from || undefined,
      fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
      toLabel: creatorName,
      entityLabel: videoTitle || videoId,
      recipientUserId: sanitizeString(body.recipientUserId, 128) || undefined,
      nativePayload: { videoTitle, instanceDomain },
    });

    return jsonResponse({
      success: true,
      tip: { id: result.tipId, videoId, amount: amountNum, totalAmount: result.totalUsd },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

export async function handleEnhancedOwncastTipCreate(
  request: Request,
  env: Env,
): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const streamId = sanitizeEntityId(body.streamId);
    const streamerName = sanitizeString(body.streamerName, 256);
    const streamTitle = sanitizeString(body.streamTitle, 512);
    const instanceDomain = sanitizeString(body.instanceDomain, 128);
    const amountStr = sanitizeString(body.amount, 64);
    const from = sanitizeString(body.sender ?? body.from, 128);
    const message = sanitizeString(body.message, 512);

    if (!streamId || !streamerName || !amountStr || !isValidAmount(amountStr)) {
      return jsonResponse({ error: 'streamId, streamerName, and amount required' }, 400);
    }

    const amountNum = Number.parseFloat(amountStr);
    if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
      return jsonResponse({ error: 'Amount must be between 0.01 and 10,000' }, 400);
    }

    const result = await recordNativeProtocolTip(env, {
      protocolKey: 'owncast',
      entityId: streamId,
      entityType: 'space',
      creatorName: streamerName,
      creatorChannel: streamerName,
      instanceDomain: instanceDomain || 'https://owncast.degenfeed.xyz',
      amountUsd: amountNum,
      currency: 'sol',
      from: from || undefined,
      fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
      toLabel: streamerName,
      entityLabel: streamTitle || `Live stream: ${streamerName}`,
      nativePayload: { streamTitle, message, instanceDomain },
    });

    return jsonResponse({
      success: true,
      tip: { id: result.tipId, streamId, amount: amountNum, totalAmount: result.totalUsd },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

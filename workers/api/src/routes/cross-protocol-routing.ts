/**
 * @degenfeed/api-worker — Cross-Protocol Tip Routing
 *
 * When someone tips on ANY protocol, this system:
 *   1. Detects if recipient has a DegenFeed wallet (any chain)
 *   2. Routes tip to their preferred chain/wallet
 *   3. If no wallet, creates a claimable tip link
 *   4. Notifies recipient on ALL connected protocols
 *   5. Shows in unified tipping dashboard
 *
 * KV schema:
 *   cross:route:{userId}                 → { preferredChain, wallets, protocols }
 *   cross:claim:{claimCode}              → { amount, from, protocol, claimed, claimedAt, txHash }
 *   cross:claim:by:{userId}              → [ claimCode, ... ]
 *   cross:notification:{userId}:{proto}  → tip notification payload
 */

import { identityKey } from '@degenfeed/utils';
import type { Env } from '../types';
import { jsonResponse } from '../response-helpers';
import { sendTipNotification } from '../lib/tip-notifications';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import {
  CHAIN_ROUTES,
  recordUnifiedTip,
  type SupportedChain,
  type TipEntityType,
  type TipPlatform,
} from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrossProtocolRouteConfig {
  /** User's preferred chain for receiving tips */
  preferredChain: SupportedChain;
  /** Wallet addresses across chains */
  wallets: {
    evm?: string;
    solana?: string;
    lightning?: string;
  };
  /** Protocols this user is active on */
  protocols: string[];
  /** Whether to auto-claim tips */
  autoClaim: boolean;
  /** Minimum tip amount to route (below this = hold for claiming) */
  minRouteAmount: number;
  /** Notification preferences per protocol */
  notifyOnProtocol: string[];
}

export interface CrossProtocolTipInput {
  /** The protocol the tip was initiated from */
  sourceProtocol: string;
  /** Recipient identifier (handle, DID, wallet, etc.) */
  recipientId: string;
  /** USD amount of the tip */
  amountUsd: number;
  /** Original currency/symbol */
  currency: string;
  /** Sender identifier */
  fromUserId?: string;
  fromLabel?: string;
  /** Entity being tipped */
  entityId?: string;
  entityType?: TipEntityType;
  entityLabel?: string;
  /** Method used */
  method?: string;
}

export interface CrossProtocolTipResult {
  routed: boolean;
  /** How the tip was handled */
  action: 'direct_wallet' | 'claim_link' | 'held_for_resolution' | 'error';
  /** Resolved wallet address if direct */
  resolvedAddress?: string;
  /** Resolved chain */
  resolvedChain?: SupportedChain;
  /** Claim code if claim link generated */
  claimCode?: string;
  /** Claim URL */
  claimUrl?: string;
  /** Activity ID in unified ledger */
  activityId?: string;
  /** Which protocols were notified */
  notifiedProtocols: string[];
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CLAIM_TTL = 60 * 60 * 24 * 30; // 30 days
const MIN_AUTO_ROUTE_USD = 0.5; // Tips under $0.50 create claim links

// ─── Main Router ────────────────────────────────────────────────────────────

export async function routeCrossProtocolTip(
  env: Env,
  input: CrossProtocolTipInput,
): Promise<CrossProtocolTipResult> {
  const notifiedProtocols: string[] = [];

  // Step 1: Look up recipient's routing config and wallet info
  const routeConfig = await lookupRouteConfig(env, input.recipientId);
  const walletInfo = await resolveWallets(env, input.recipientId);

  // Step 2: Determine how to route
  const hasWallet = walletInfo.solana || walletInfo.evm || walletInfo.lightning;
  const amountBelowThreshold = input.amountUsd < MIN_AUTO_ROUTE_USD;

  if (hasWallet && !amountBelowThreshold) {
    // Direct to wallet
    return await routeDirectToWallet(env, input, routeConfig, walletInfo, notifiedProtocols);
  }

  if (routeConfig && routeConfig.protocols.length > 0) {
    // Has protocol identity but no wallet or small amount — create claim link
    return await createClaimLink(env, input, routeConfig, walletInfo, notifiedProtocols);
  }

  // Step 3: No wallet, no identity — try to identify who they are
  const identityInfo = await resolveIdentity(env, input.recipientId);
  if (identityInfo) {
    // Create a claim link and notify on known protocols
    const claimResult = await createClaimLink(
      env,
      input,
      identityInfo.routeConfig,
      identityInfo.wallets,
      notifiedProtocols,
    );
    return claimResult;
  }

  // Step 4: Nothing known — create generic claim link
  return await createClaimLink(
    env,
    input,
    null,
    { solana: undefined, evm: undefined, lightning: undefined },
    notifiedProtocols,
  );
}

// ─── Route Direct to Wallet ───────────────────────────────────────────────

async function routeDirectToWallet(
  env: Env,
  input: CrossProtocolTipInput,
  routeConfig: CrossProtocolRouteConfig | null,
  wallets: CrossProtocolRouteConfig['wallets'],
  notifiedProtocols: string[],
): Promise<CrossProtocolTipResult> {
  const { preferredChain, chainConfig, resolvedAddress } = pickBestWallet(wallets, routeConfig);

  // Record in unified ledger
  const activity = await recordUnifiedTip(env, {
    platform: mapProtocolToTipPlatform(input.sourceProtocol),
    entityId: input.entityId ?? `cross:${input.sourceProtocol}:${input.recipientId}`,
    entityType: input.entityType ?? 'post',
    amountUsd: input.amountUsd,
    fromUserId: input.fromUserId,
    toUserId: resolvedAddress ?? input.recipientId,
    fromLabel: input.fromLabel || 'Anonymous',
    toLabel: routeConfig
      ? `${resolvedAddress?.slice(0, 6) ?? input.recipientId}…`
      : input.recipientId,
    entityLabel: input.entityLabel,
    method: input.method ?? `cross-${preferredChain}`,
  });

  // Notify on all recipient protocols
  await notifyAllProtocols(env, input, wallets, routeConfig, notifiedProtocols, activity?.id);

  return {
    routed: true,
    action: 'direct_wallet',
    resolvedAddress,
    resolvedChain: preferredChain,
    activityId: activity?.id,
    notifiedProtocols,
    message: `Routed $${input.amountUsd} to ${preferredChain} wallet ${resolvedAddress?.slice(0, 6)}…`,
  };
}

// ─── Create Claim Link ────────────────────────────────────────────────────

async function createClaimLink(
  env: Env,
  input: CrossProtocolTipInput,
  routeConfig: CrossProtocolRouteConfig | null,
  wallets: CrossProtocolRouteConfig['wallets'],
  notifiedProtocols: string[],
): Promise<CrossProtocolTipResult> {
  const claimCode = `claim:${Date.now().toString(36)}:${crypto.randomUUID().slice(0, 8)}`;

  // Store claim
  const claimData = {
    code: claimCode,
    amountUsd: input.amountUsd,
    originalCurrency: input.currency,
    sourceProtocol: input.sourceProtocol,
    fromUserId: input.fromUserId,
    fromLabel: input.fromLabel,
    recipientId: input.recipientId,
    entityId: input.entityId,
    entityType: input.entityType,
    entityLabel: input.entityLabel,
    method: input.method,
    wallets,
    createdAt: Date.now(),
    claimed: false,
    claimedAt: null,
    claimedBy: null,
    txHash: null,
  };

  try {
    await env.CACHE?.put(`cross:claim:${claimCode}`, JSON.stringify(claimData), {
      expirationTtl: CLAIM_TTL,
    });

    // Index by recipient
    const existingClaimsRaw = await env.CACHE?.get(`cross:claim:by:${input.recipientId}`);
    const existingClaims: string[] = existingClaimsRaw ? JSON.parse(existingClaimsRaw) : [];
    existingClaims.push(claimCode);
    await env.CACHE?.put(
      `cross:claim:by:${input.recipientId}`,
      JSON.stringify(existingClaims.slice(-100)),
      { expirationTtl: CLAIM_TTL },
    );
  } catch {
    // Non-critical
  }

  // Record in unified ledger
  const activity = await recordUnifiedTip(env, {
    platform: mapProtocolToTipPlatform(input.sourceProtocol),
    entityId: input.entityId ?? `cross:claim:${claimCode}`,
    entityType: input.entityType ?? 'post',
    amountUsd: input.amountUsd,
    fromUserId: input.fromUserId,
    toUserId: input.recipientId,
    fromLabel: input.fromLabel || 'Anonymous',
    toLabel: input.recipientId,
    entityLabel: input.entityLabel,
    method: `claim:${input.sourceProtocol}`,
  });

  // Notify on all known protocols
  await notifyAllProtocols(
    env,
    input,
    wallets,
    routeConfig,
    notifiedProtocols,
    activity?.id,
    claimCode,
  );

  const baseUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz';
  const claimUrl = `${baseUrl}/tip/claim/${claimCode}`;

  return {
    routed: false,
    action: 'claim_link',
    claimCode,
    claimUrl,
    activityId: activity?.id,
    notifiedProtocols,
    message: `Claim link created at ${claimUrl}`,
  };
}

// ─── Wallet & Identity Resolution ─────────────────────────────────────────

async function lookupRouteConfig(
  env: Env,
  userId: string,
): Promise<CrossProtocolRouteConfig | null> {
  try {
    const raw = await env.CACHE?.get(`cross:route:${userId}`);
    if (raw) return JSON.parse(raw) as CrossProtocolRouteConfig;
  } catch {
    // Fall through
  }
  return null;
}

async function resolveWallets(
  env: Env,
  userId: string,
): Promise<CrossProtocolRouteConfig['wallets']> {
  const wallets: CrossProtocolRouteConfig['wallets'] = {};

  // Direct wallet address detection
  const EVM_RE = /^0x[a-f0-9]{40}$/i;
  const SOL_RE = /^[1-9a-hj-z]{32,44}$/;

  if (EVM_RE.test(userId)) {
    wallets.evm = userId.toLowerCase();
    return wallets;
  }
  if (SOL_RE.test(userId)) {
    wallets.solana = userId;
    return wallets;
  }

  // Try identity lookup
  try {
    const key = identityKey(userId);
    const raw = await env.IDENTITIES?.get(key);
    if (raw) {
      const identity = JSON.parse(raw) as Record<string, unknown>;
      const walletAddr = identity.walletAddress as string | undefined;
      if (walletAddr) {
        if (EVM_RE.test(walletAddr)) wallets.evm = walletAddr.toLowerCase();
        else if (SOL_RE.test(walletAddr)) wallets.solana = walletAddr;
      }

      const farcaster = identity.farcaster as Record<string, unknown> | undefined;
      if (farcaster?.custodyAddress && !wallets.evm) {
        wallets.evm = (farcaster.custodyAddress as string).toLowerCase();
      }

      // Check linked profiles
      const profiles = identity.linkedProfiles as Record<string, unknown> | undefined;
      if (profiles) {
        for (const [, profile] of Object.entries(profiles)) {
          const p = profile as Record<string, unknown>;
          if (p.evmAddress && !wallets.evm) wallets.evm = (p.evmAddress as string).toLowerCase();
          if (p.solanaAddress && !wallets.solana) wallets.solana = p.solanaAddress as string;
          if (p.lightningAddress && !wallets.lightning)
            wallets.lightning = p.lightningAddress as string;
        }
      }
    }
  } catch {
    // Best-effort
  }

  return wallets;
}

async function resolveIdentity(
  env: Env,
  userId: string,
): Promise<{
  routeConfig: CrossProtocolRouteConfig | null;
  wallets: CrossProtocolRouteConfig['wallets'];
} | null> {
  // Check if user has a routing config
  const routeConfig = await lookupRouteConfig(env, userId);
  const wallets = await resolveWallets(env, userId);

  if (routeConfig || wallets.evm || wallets.solana || wallets.lightning) {
    return { routeConfig, wallets };
  }

  return null;
}

// ─── Wallet Selection ─────────────────────────────────────────────────────

function pickBestWallet(
  wallets: CrossProtocolRouteConfig['wallets'],
  routeConfig: CrossProtocolRouteConfig | null,
): {
  preferredChain: SupportedChain;
  chainConfig: (typeof CHAIN_ROUTES)[SupportedChain];
  resolvedAddress?: string;
} {
  const preferred = routeConfig?.preferredChain;

  // Check preferred chain
  if (preferred === 'lightning' && wallets.lightning) {
    return {
      preferredChain: 'lightning',
      chainConfig: CHAIN_ROUTES.lightning,
      resolvedAddress: wallets.lightning,
    };
  }
  if (preferred === 'solana' && wallets.solana) {
    return {
      preferredChain: 'solana',
      chainConfig: CHAIN_ROUTES.solana,
      resolvedAddress: wallets.solana,
    };
  }
  if (preferred && preferred !== 'solana' && preferred !== 'lightning' && wallets.evm) {
    return {
      preferredChain: preferred,
      chainConfig: CHAIN_ROUTES[preferred],
      resolvedAddress: wallets.evm,
    };
  }

  // Priority: solana > lightning > evm
  if (wallets.solana) {
    return {
      preferredChain: 'solana',
      chainConfig: CHAIN_ROUTES.solana,
      resolvedAddress: wallets.solana,
    };
  }
  if (wallets.lightning) {
    return {
      preferredChain: 'lightning',
      chainConfig: CHAIN_ROUTES.lightning,
      resolvedAddress: wallets.lightning,
    };
  }
  if (wallets.evm) {
    return { preferredChain: 'base', chainConfig: CHAIN_ROUTES.base, resolvedAddress: wallets.evm };
  }

  // Fallback
  return { preferredChain: 'solana', chainConfig: CHAIN_ROUTES.solana };
}

// ─── Multi-Protocol Notification ──────────────────────────────────────────

async function notifyAllProtocols(
  env: Env,
  input: CrossProtocolTipInput,
  _wallets: CrossProtocolRouteConfig['wallets'],
  routeConfig: CrossProtocolRouteConfig | null,
  notifiedProtocols: string[],
  activityId?: string,
  claimCode?: string,
): Promise<void> {
  const protocolsToNotify = routeConfig?.protocols ?? [input.sourceProtocol];
  const notifyOn = routeConfig?.notifyOnProtocol ?? protocolsToNotify;

  for (const protocol of notifyOn) {
    try {
      // Store notification in protocol-specific KV
      const notifKey = `cross:notification:${input.recipientId}:${protocol}`;
      const notification = {
        id: activityId ?? `cross:${Date.now()}`,
        type: 'tip' as const,
        sourceProtocol: input.sourceProtocol,
        actorName: input.fromLabel ?? 'Someone',
        actorHandle: input.fromUserId ?? '',
        amount: String(input.amountUsd),
        currency: 'USD',
        message: claimCode
          ? `💸 You received $${input.amountUsd}! Claim at degenfeed.xyz/tip/claim/${claimCode}`
          : `💸 You received $${input.amountUsd} via ${input.sourceProtocol}!`,
        createdAt: Date.now(),
        read: false,
        amountUsd: input.amountUsd,
      };

      const existingRaw = await env.CACHE?.get(notifKey);
      const existing: unknown[] = existingRaw ? JSON.parse(existingRaw) : [];
      await env.CACHE?.put(notifKey, JSON.stringify([notification, ...existing].slice(0, 100)), {
        expirationTtl: 60 * 60 * 24 * 30,
      });

      // Also send via unified notification pipeline
      if (activityId) {
        try {
          await sendTipNotification(env, {
            id: activityId,
            type: 'tip',
            sourceProtocol: protocol,
            actorName: input.fromLabel ?? 'Someone',
            actorHandle: input.fromUserId ?? '',
            amount: String(input.amountUsd),
            currency: 'USD',
            protocolBadge: getProtocolBadge(input.sourceProtocol),
            entityId: input.entityId,
            entityType: input.entityType,
            message: `💸 Cross-protocol tip of $${input.amountUsd}`,
            createdAt: Date.now(),
            read: false,
            amountUsd: input.amountUsd,
          });
        } catch {
          // Non-fatal
        }
      }

      notifiedProtocols.push(protocol);
    } catch {
      // Best-effort per protocol
    }
  }
}

function getProtocolBadge(protocol: string): string | undefined {
  const badges: Record<string, string> = {
    nostr: '⚡',
    farcaster: '◈',
    lens: '◎',
    bluesky: '☁️',
    mastodon: '🐘',
    peertube: '🎬',
    owncast: '📡',
    lemmy: '🤖',
    pixelfed: '📷',
    writefreely: '✍️',
    bookwyrm: '📚',
    mobilizon: '📅',
    funkwhale: '🎵',
    castopod: '🎙️',
    gotosocial: '🐘',
    misskey: '🔮',
    pleroma: '🌀',
    github: '🐙',
    telegram: '✈️',
    solana: '◎',
  };
  return badges[protocol];
}

// ─── Tip Platform Mapper ─────────────────────────────────────────────────

function mapProtocolToTipPlatform(protocol: string): TipPlatform {
  const map: Record<string, TipPlatform> = {
    nostr: 'degenfeed',
    farcaster: 'degenfeed',
    lens: 'degenfeed',
    bluesky: 'bluesky',
    mastodon: 'mastodon',
    peertube: 'peertube',
    lemmy: 'lemmy',
    solana: 'solana',
    pixelfed: 'degenfeed',
    writefreely: 'degenfeed',
    bookwyrm: 'degenfeed',
    mobilizon: 'degenfeed',
    owncast: 'degenfeed',
    funkwhale: 'degenfeed',
    castopod: 'degenfeed',
    gotosocial: 'mastodon',
    misskey: 'degenfeed',
    pleroma: 'degenfeed',
  };
  return map[protocol] ?? 'degenfeed';
}

// ─── API Handlers ─────────────────────────────────────────────────────────

// POST /api/tip/cross-protocol/route — Route an incoming tip
export async function handleCrossProtocolRoute(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as CrossProtocolTipInput & {
      sourceProtocol?: string;
      recipientId?: string;
      amountUsd?: number;
    };

    const sourceProtocol = sanitizeString(body.sourceProtocol, 32);
    const recipientId = sanitizeString(body.recipientId, 256);
    const amountUsd =
      typeof body.amountUsd === 'number' && body.amountUsd > 0 ? body.amountUsd : null;
    const currency = sanitizeString(body.currency, 16) || 'USD';

    if (!sourceProtocol || !recipientId || !amountUsd) {
      return jsonResponse({ error: 'sourceProtocol, recipientId, and amountUsd required' }, 400);
    }

    const result = await routeCrossProtocolTip(env, {
      sourceProtocol,
      recipientId,
      amountUsd,
      currency,
      fromUserId: sanitizeString(body.fromUserId, 128) || undefined,
      fromLabel: sanitizeString(body.fromLabel, 64) || undefined,
      entityId: sanitizeString(body.entityId, 256) || undefined,
      entityType: body.entityType ?? undefined,
      entityLabel: sanitizeString(body.entityLabel, 200) || undefined,
      method: sanitizeString(body.method, 32) || `cross:${sourceProtocol}`,
    });

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// POST /api/tip/claim/:code — Claim a tip
export async function handleClaimTip(
  request: Request,
  env: Env,
  claimCode: string,
): Promise<Response> {
  if (request.method === 'GET') {
    // Look up claim info
    try {
      const raw = await env.CACHE?.get(`cross:claim:${claimCode}`);
      if (!raw) return jsonResponse({ error: 'Claim not found or expired' }, 404);

      const claim = JSON.parse(raw) as Record<string, unknown>;
      return jsonResponse({
        code: claim.code,
        amountUsd: claim.amountUsd,
        originalCurrency: claim.originalCurrency,
        sourceProtocol: claim.sourceProtocol,
        fromLabel: claim.fromLabel ?? 'Anonymous',
        createdAt: claim.createdAt,
        claimed: claim.claimed,
      });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  }

  if (request.method === 'POST') {
    // Claim the tip
    let body: { address?: string; chain?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const address = sanitizeString(body.address, 128);
    const chain = sanitizeString(body.chain, 32) || 'solana';

    if (!address) {
      return jsonResponse({ error: 'Address required to claim' }, 400);
    }

    try {
      const raw = await env.CACHE?.get(`cross:claim:${claimCode}`);
      if (!raw) return jsonResponse({ error: 'Claim not found or expired' }, 404);

      const claim = JSON.parse(raw) as Record<string, unknown>;
      if (claim.claimed) {
        return jsonResponse(
          { error: 'This tip has already been claimed', claimedAt: claim.claimedAt },
          400,
        );
      }

      // Mark as claimed
      claim.claimed = true;
      claim.claimedAt = Date.now();
      claim.claimedBy = address;
      claim.claimedChain = chain;

      await env.CACHE?.put(`cross:claim:${claimCode}`, JSON.stringify(claim), {
        expirationTtl: CLAIM_TTL,
      });

      // Record the claim in unified ledger
      await recordUnifiedTip(env, {
        platform: mapProtocolToTipPlatform(claim.sourceProtocol as string),
        entityId: `claim:${claimCode}`,
        entityType: 'post',
        amountUsd: claim.amountUsd as number,
        fromUserId: claim.fromUserId as string | undefined,
        toUserId: address,
        fromLabel: (claim.fromLabel as string) ?? 'Anonymous',
        toLabel: `${address.slice(0, 6)}…`,
        method: `claim_to_${chain}`,
      });

      return jsonResponse({
        success: true,
        claimCode,
        amountUsd: claim.amountUsd,
        claimedBy: address,
        chain,
        message: `Successfully claimed $${claim.amountUsd} to ${address.slice(0, 6)}…`,
      });
    } catch (err) {
      return jsonResponse({ error: String(err) }, 500);
    }
  }

  const { methodNotAllowed } = await import('../response-helpers');
  return methodNotAllowed(['GET', 'POST']);
}

// GET /api/tip/cross-protocol/claims?userId=... — List user's claims
export async function handleUserClaims(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 256);

  if (!userId) {
    return jsonResponse({ error: 'userId required' }, 400);
  }

  try {
    const raw = await env.CACHE?.get(`cross:claim:by:${userId}`);
    const claimCodes: string[] = raw ? JSON.parse(raw) : [];

    const claims = [];
    for (const code of claimCodes) {
      const claimRaw = await env.CACHE?.get(`cross:claim:${code}`);
      if (claimRaw) {
        const claim = JSON.parse(claimRaw);
        claims.push({
          code: claim.code,
          amountUsd: claim.amountUsd,
          sourceProtocol: claim.sourceProtocol,
          fromLabel: claim.fromLabel ?? 'Anonymous',
          createdAt: claim.createdAt,
          claimed: claim.claimed,
          claimedAt: claim.claimedAt,
        });
      }
    }

    return jsonResponse({
      claims,
      total: claims.length,
      unclaimed: claims.filter((c) => !c.claimed).length,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// POST /api/tip/cross-protocol/config — Save user's routing config
export async function handleSaveRouteConfig(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 5 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as Partial<CrossProtocolRouteConfig> & { userId?: string };
    const userId = sanitizeString(body.userId, 256);

    if (!userId) {
      return jsonResponse({ error: 'userId required' }, 400);
    }

    const existing = await lookupRouteConfig(env, userId);
    const config: CrossProtocolRouteConfig = {
      preferredChain:
        (body.preferredChain as SupportedChain) ?? existing?.preferredChain ?? 'solana',
      wallets: body.wallets ?? existing?.wallets ?? {},
      protocols: body.protocols ?? existing?.protocols ?? [],
      autoClaim: body.autoClaim ?? existing?.autoClaim ?? true,
      minRouteAmount: body.minRouteAmount ?? existing?.minRouteAmount ?? MIN_AUTO_ROUTE_USD,
      notifyOnProtocol: body.notifyOnProtocol ?? existing?.notifyOnProtocol ?? [],
    };

    await env.CACHE?.put(`cross:route:${userId}`, JSON.stringify(config), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    return jsonResponse({ success: true, config });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// GET /api/tip/cross-protocol/dashboard?userId=... — Unified tipping dashboard
export async function handleCrossProtocolDashboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 256);

  if (!userId) {
    return jsonResponse({ error: 'userId required' }, 400);
  }

  try {
    const [config, sent, received, claims, badges] = await Promise.all([
      lookupRouteConfig(env, userId),
      env.CACHE?.get(`tip:user:${userId}:sent`)
        .then((r) => (r ? JSON.parse(r) : null))
        .catch(() => null),
      env.CACHE?.get(`tip:user:${userId}:received`)
        .then((r) => (r ? JSON.parse(r) : null))
        .catch(() => null),
      env.CACHE?.get(`cross:claim:by:${userId}`)
        .then((r) => (r ? (JSON.parse(r) as string[]) : []))
        .catch(() => [] as string[]),
      env.CACHE?.get(`badges:${userId}`)
        .then((r) => (r ? (JSON.parse(r) as string[]) : []))
        .catch(() => [] as string[]),
    ]);

    // Get claim details
    const claimDetails = [];
    for (const code of claims.slice(0, 20)) {
      const raw = await env.CACHE?.get(`cross:claim:${code}`);
      if (raw) claimDetails.push(JSON.parse(raw));
    }

    return jsonResponse({
      config,
      stats: {
        sent: {
          totalUsd: sent?.totalUsd ?? 0,
          count: sent?.count ?? 0,
          byPlatform: sent?.byPlatform ?? {},
        },
        received: {
          totalUsd: received?.totalUsd ?? 0,
          count: received?.count ?? 0,
          byPlatform: received?.byPlatform ?? {},
          tipperCount: received?.tippers?.length ?? 0,
        },
        pendingClaims: claimDetails.filter((c) => !c.claimed).length,
        totalClaimed: claimDetails
          .filter((c) => c.claimed)
          .reduce((s, c) => s + (c.amountUsd ?? 0), 0),
      },
      claims: claimDetails.slice(0, 10),
      badges,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

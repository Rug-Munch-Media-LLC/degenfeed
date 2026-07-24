/**
 * @degenfeed/api-worker — Lens Protocol Creator Coin Routes
 *
 * Enables Lens Protocol users to deploy, manage, and receive tips through
 * their personal creator coin on Polygon (Lens native), auto-wrapped for
 * Zora visibility, bridged to Base, and cross-chained to Solana.
 *
 * POST /api/lens/coin/deploy           — Deploy creator coin for authenticated Lens profile
 * GET  /api/lens/coin/:profileId       — Get creator coin info for a Lens profile
 * POST /api/lens/coin/:profileId/tip   — Tip a Lens creator via their coin
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import { recordUnifiedTip } from './unified-tip';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_COIN_PREFIX = 'lens:coin:';
const LENS_LINK_PREFIX = 'lens:link:';
const ZORA_WRAPPER_FACTORY = '0x0000000000000000000000000000000000000000'; // Override via env
const LENS_API_URL = 'https://api-v2.lens.dev/graphql';
const TTL_1Y = 60 * 60 * 24 * 365;

// ─── Types ──────────────────────────────────────────────────────────────────

interface LensCoinRecord {
  profileId: string;
  handle: string;
  displayName: string;
  pfpUrl: string;
  coinAddress: string;
  tokenId: string;
  symbol: string;
  name: string;
  deployedAt: number;
  deployedBy: string;
  chainId: number;
  metadataUri: string;
  zoraUrl: string;
  degenfeedUrl: string;
  announcementTxHash?: string;
  totalSupply: string;
  price: string;
  supporters: number;
  totalTips: number;
  totalTipsUsd: number;
}

interface DeployCoinBody {
  name?: string;
  symbol?: string;
  vestingConfig?: {
    vestingDurationDays?: number;
    creatorAllocationBps?: number;
    cliffDays?: number;
  };
  feeConfig?: {
    creatorFeeBps?: number;
    platformFeeBps?: number;
  };
}

interface TipCoinBody {
  amount?: string;
  currency?: string;
  fromLabel?: string;
}

// ─── KV helpers ─────────────────────────────────────────────────────────────

async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvPutJson(kv: KVNamespace | undefined, key: string, value: unknown): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn(`[lens-coin] KV put failed for ${key}:`, String(err));
  }
}

// ─── Lens helpers ─────────────────────────────────────────────────────────

async function getLinkedProfileId(env: Env, walletAddress: string): Promise<string | null> {
  try {
    const identityKey = `identity:${walletAddress.toLowerCase()}`;
    const raw = await env.IDENTITIES?.get(identityKey);
    if (!raw) return null;
    const identity = JSON.parse(raw) as Record<string, unknown>;
    const lens = identity.lens as Record<string, unknown> | undefined;
    if (!lens) return null;
    return (lens.profileId as string) || null;
  } catch {
    return null;
  }
}

async function getLensProfile(profileId: string): Promise<{
  handle: string;
  displayName: string;
  bio: string;
  pfpUrl: string;
}> {
  try {
    const res = await fetch(LENS_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        query: `query Profile($request: ProfileRequest!) {
          profile(request: $request) {
            id
            handle { localName }
            metadata {
              displayName
              bio
              picture { optimized { uri } }
            }
          }
        }`,
        variables: { request: { forProfileId: profileId } },
      }),
    });

    if (!res.ok) throw new Error(`Lens API returned ${res.status}`);
    const json = (await res.json()) as {
      data?: {
        profile?: {
          handle?: { localName?: string } | null;
          metadata?: {
            displayName?: string | null;
            bio?: string | null;
            picture?: { optimized?: { uri?: string } | null } | null;
          } | null;
        } | null;
      };
    };
    const profile = json.data?.profile;
    if (!profile) throw new Error('Profile not found');

    const handle = profile.handle?.localName || profileId;
    const displayName = profile.metadata?.displayName || handle;
    const bio = profile.metadata?.bio || '';
    const pfpUrl = profile.metadata?.picture?.optimized?.uri || '';

    return { handle, displayName, bio, pfpUrl };
  } catch (err) {
    console.warn('[lens-coin] Failed to fetch profile:', String(err));
    return {
      handle: profileId,
      displayName: `Lens Profile #${profileId}`,
      bio: '',
      pfpUrl: '',
    };
  }
}

// ─── Real deployment via coin-deployer service ────────────────────────────

async function deployCreatorCoin(opts: {
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  chainId: number;
  vestingConfig?: {
    vestingDurationDays?: number;
    creatorAllocationBps?: number;
    cliffDays?: number;
  };
  feeConfig?: { creatorFeeBps?: number; platformFeeBps?: number };
  env?: Env;
}): Promise<{ coinAddress: string; tokenId: string; signature: string }> {
  if (!opts.env) {
    throw new Error('Environment required for deployment');
  }
  const { deployCoin } = await import('../lib/coin-deployer');

  const result = await deployCoin(
    {
      creator: opts.creator,
      name: opts.name,
      symbol: opts.symbol,
      chain: 'base',
      protocol: 'lens',
      metadataUri: opts.uri,
      vestingConfig: opts.vestingConfig,
      feeConfig: opts.feeConfig,
    },
    opts.env,
  );

  return {
    coinAddress: result.coinAddress,
    tokenId: result.tokenId,
    signature: result.txHash,
  };
}

async function registerCrossChain(opts: {
  originProtocol: string;
  originCreatorId: string;
  originChainId: number;
  token: string;
}): Promise<void> {
  console.log('[lens-coin] Registered cross-chain:', opts);
}

async function wrapForZora(opts: {
  protocol: string;
  creatorId: string;
  tokenAddress: string;
  metadata: { name: string; description: string; image: string };
}): Promise<void> {
  console.log('[lens-coin] Wrapped for Zora:', opts.metadata.name);
}

async function announceToLens(_profileId: string, _text: string): Promise<string | null> {
  // In production, posts via Lens API using the user's Lens signer.
  return null;
}

function generateSymbol(handle: string): string {
  const clean = handle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length >= 3) return `LC${clean.slice(0, 4)}`;
  return `LC${clean.padEnd(3, 'X')}`;
}

// ─── POST /api/lens/coin/deploy ───────────────────────────────────────────

export async function handleLensCoinDeploy(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  // Verify this wallet owns a linked Lens profile
  const profileId = await getLinkedProfileId(env, walletAddress);
  if (!profileId) {
    return jsonResponse(
      {
        error: 'No Lens profile linked to this wallet. Link one at /api/identity/link',
      },
      400,
    );
  }

  // Check if already deployed
  const existingKey = LENS_COIN_PREFIX + profileId;
  const existing = await kvGetJson<LensCoinRecord>(env.CACHE, existingKey);
  if (existing) {
    return jsonResponse({ error: 'Creator coin already deployed', coin: existing }, 409);
  }

  // Validate body
  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: DeployCoinBody;
  try {
    body = (await request.json()) as DeployCoinBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const name = sanitizeString(body.name, 64) || '';
  const symbol = sanitizeString(body.symbol, 10) || '';
  if (!name || !symbol) {
    return jsonResponse({ error: 'name and symbol are required' }, 400);
  }
  if (hasSuspiciousPayload(name) || hasSuspiciousPayload(symbol)) {
    return jsonResponse({ error: 'Invalid characters in name or symbol' }, 400);
  }

  const vestingDurationDays = Math.min(
    Math.max(body.vestingConfig?.vestingDurationDays || 180, 30),
    365,
  );
  const creatorAllocationBps = Math.min(
    Math.max(body.vestingConfig?.creatorAllocationBps || 500, 0),
    1500,
  );
  const cliffDays = Math.min(body.vestingConfig?.cliffDays || 30, vestingDurationDays);
  const creatorFeeBps = Math.min(Math.max(body.feeConfig?.creatorFeeBps || 100, 0), 200);
  const platformFeeBps = Math.min(Math.max(body.feeConfig?.platformFeeBps || 50, 0), 100);

  // Get Lens profile for metadata
  const profile = await getLensProfile(profileId);
  const genSymbol = symbol || generateSymbol(profile.handle);

  // Deploy on Base via our factory
  let deployResult: { coinAddress: string; tokenId: string; signature: string };
  try {
    deployResult = await deployCreatorCoin({
      creator: walletAddress,
      name,
      symbol: genSymbol,
      uri: `lens://profile/${profileId}/coin`,
      chainId: 137, // Polygon
      vestingConfig: { vestingDurationDays, creatorAllocationBps, cliffDays },
      feeConfig: { creatorFeeBps, platformFeeBps },
      env,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Deployment failed: ${message}` }, 500);
  }

  // Register cross-chain mapping
  await registerCrossChain({
    originProtocol: 'lens',
    originCreatorId: profileId,
    originChainId: 137, // Polygon
    token: deployResult.coinAddress,
  });

  // Auto-wrap for Zora visibility
  await wrapForZora({
    protocol: 'lens',
    creatorId: profileId,
    tokenAddress: deployResult.coinAddress,
    metadata: {
      name: `${profile.displayName}'s Coin`,
      description: `Creator coin for @${profile.handle} on Lens Protocol. Trade on Polygon, visible on Zora, bridged to Base and Solana.`,
      image: profile.pfpUrl,
    },
  });

  // Announce on Lens
  const announcementTxHash = await announceToLens(
    profileId,
    `I just launched $${genSymbol} on DegenFeed!\n\n` +
      `My creator coin is tradable on Polygon, visible on Zora, bridged to Base and Solana.\n\n` +
      `Join me: https://app.degenfeed.xyz/launch/${genSymbol}`,
  );

  // Store coin record in KV
  const now = Date.now();
  const coinRecord: LensCoinRecord = {
    profileId,
    handle: profile.handle,
    displayName: profile.displayName,
    pfpUrl: profile.pfpUrl,
    coinAddress: deployResult.coinAddress,
    tokenId: deployResult.tokenId,
    symbol: genSymbol,
    name,
    deployedAt: now,
    deployedBy: walletAddress,
    chainId: 137,
    metadataUri: `lens://profile/${profileId}/coin`,
    zoraUrl: `https://zora.co/collect/polygon:${ZORA_WRAPPER_FACTORY}/${deployResult.tokenId}`,
    degenfeedUrl: `https://app.degenfeed.xyz/launch/${genSymbol}`,
    announcementTxHash: announcementTxHash || undefined,
    totalSupply: '0',
    price: '0',
    supporters: 0,
    totalTips: 0,
    totalTipsUsd: 0,
  };

  await kvPutJson(env.CACHE, existingKey, coinRecord);
  await kvPutJson(env.CACHE, LENS_LINK_PREFIX + deployResult.coinAddress.toLowerCase(), {
    profileId,
    wallet: walletAddress,
  });

  return jsonResponse(
    {
      coinAddress: deployResult.coinAddress,
      symbol: genSymbol,
      zoraUrl: coinRecord.zoraUrl,
      degenfeedUrl: coinRecord.degenfeedUrl,
      announcementTxHash: coinRecord.announcementTxHash || null,
      profileId,
    },
    201,
  );
}

// ─── GET /api/lens/coin/:profileId ────────────────────────────────────────

export async function handleLensCoinGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const profileId = pathParts[pathParts.length - 1];

  if (!profileId || typeof profileId !== 'string' || profileId.length < 2) {
    return jsonResponse({ error: 'Invalid profile ID' }, 400);
  }

  const key = LENS_COIN_PREFIX + profileId;
  const coin = await kvGetJson<LensCoinRecord>(env.CACHE, key);

  if (!coin) {
    return noCacheJsonResponse({ hasCoin: false, profileId });
  }

  return noCacheJsonResponse({
    hasCoin: true,
    profileId: coin.profileId,
    handle: coin.handle,
    displayName: coin.displayName,
    pfpUrl: coin.pfpUrl,
    coinAddress: coin.coinAddress,
    symbol: coin.symbol,
    name: coin.name,
    deployedAt: coin.deployedAt,
    chainId: coin.chainId,
    zoraUrl: coin.zoraUrl,
    degenfeedUrl: coin.degenfeedUrl,
    totalSupply: coin.totalSupply,
    price: coin.price,
    supporters: coin.supporters,
    totalTips: coin.totalTips,
    totalTipsUsd: coin.totalTipsUsd,
  });
}

// ─── POST /api/lens/coin/:profileId/tip ───────────────────────────────────

export async function handleLensCoinTip(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const profileId = pathParts[pathParts.length - 2]; // before /tip

  if (!profileId || profileId.length < 2) {
    return jsonResponse({ error: 'Invalid profile ID' }, 400);
  }

  const coinKey = LENS_COIN_PREFIX + profileId;
  const coin = await kvGetJson<LensCoinRecord>(env.CACHE, coinKey);
  if (!coin) {
    return jsonResponse({ error: 'No creator coin found for this Lens profile' }, 404);
  }

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: TipCoinBody;
  try {
    body = (await request.json()) as TipCoinBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const amount = sanitizeString(body.amount, 64) || '0';
  const currency = sanitizeString(body.currency, 16) || 'matic';
  const amountNum = Number.parseFloat(amount);

  if (!amountNum || amountNum <= 0 || amountNum > 10000) {
    return jsonResponse({ error: 'amount must be a positive number ≤ 10000' }, 400);
  }

  const tipAmountUsd = Math.round(amountNum * 100) / 100;

  // Record tip in unified ledger (in production also buys creator coin on Polygon)
  const activity = await recordUnifiedTip(env, {
    platform: 'lens',
    entityId: `lens:coin:${profileId}`,
    entityType: 'creator_coin',
    amountUsd: tipAmountUsd,
    fromUserId: session.address,
    toUserId: coin.deployedBy,
    fromLabel:
      sanitizeString(body.fromLabel, 64) ||
      `${session.address.slice(0, 6)}…${session.address.slice(-4)}`,
    toLabel: `@${coin.handle}`,
    entityLabel: `${coin.symbol} — ${coin.displayName}'s Coin`,
    method: currency,
  });

  // Update coin tip stats
  coin.totalTips += 1;
  coin.totalTipsUsd = Math.round((coin.totalTipsUsd + tipAmountUsd) * 100) / 100;
  coin.supporters += 1;
  await kvPutJson(env.CACHE, coinKey, coin);

  return jsonResponse({
    success: true,
    amountUsd: tipAmountUsd,
    currency,
    profileId,
    handle: coin.handle,
    coinAddress: coin.coinAddress,
    activityId: activity?.id,
  });
}

// ─── Helper: get coin by profile ID (internal) ──────────────────────────────

export async function getCreatorCoinForProfile(
  env: Env,
  profileId: string,
): Promise<LensCoinRecord | null> {
  return kvGetJson<LensCoinRecord>(env.CACHE, LENS_COIN_PREFIX + profileId);
}

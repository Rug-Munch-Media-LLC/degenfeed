/**
 * @degenfeed/api-worker — Farcaster Creator Coin Routes
 *
 * Enables Farcaster users to deploy, manage, and receive tips through
 * their personal creator coin on Base, auto-wrapped for Zora visibility
 * and cross-chained to Solana.
 *
 * POST /api/farcaster/coin/deploy      — Deploy a creator coin for authenticated Farcaster user
 * GET  /api/farcaster/coin/:fid        — Get creator coin info for a FID
 * POST /api/farcaster/coin/:fid/tip    — Tip a Farcaster creator via their coin
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { sanitizeString, validateBodySize } from '../sanitize';
import { hasSuspiciousPayload } from '../sanitize';
import { recordUnifiedTip } from './unified-tip';

// ─── Constants ──────────────────────────────────────────────────────────────

const FARCASTER_COIN_PREFIX = 'farcaster:coin:';
const FARCASTER_LINK_PREFIX = 'farcaster:link:';
const ZORA_WRAPPER_FACTORY = '0x0000000000000000000000000000000000000000'; // Override via env
const TTL_1Y = 60 * 60 * 24 * 365;

// ─── Types ──────────────────────────────────────────────────────────────────

interface FarcasterCoinRecord {
  fid: number;
  username: string;
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
  announcementHash?: string;
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
    console.warn(`[farcaster-coin] KV put failed for ${key}:`, String(err));
  }
}

// ─── Farcaster Hub helpers ─────────────────────────────────────────────────

async function getLinkedFid(env: Env, walletAddress: string): Promise<number | null> {
  try {
    const identityKey = `identity:${walletAddress.toLowerCase()}`;
    const raw = await env.IDENTITIES?.get(identityKey);
    if (!raw) return null;
    const identity = JSON.parse(raw) as Record<string, unknown>;
    const farcaster = identity.farcaster as Record<string, unknown> | undefined;
    if (!farcaster || typeof farcaster.fid !== 'number') return null;
    return farcaster.fid;
  } catch {
    return null;
  }
}

async function getFarcasterProfile(fid: number): Promise<{
  username: string;
  displayName: string;
  bio: string;
  pfpUrl: string;
  metadataUri: string;
}> {
  const hubUrl = 'https://hub.farcaster.standardcrypto.vc:2281';
  try {
    const res = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
      headers: { 'user-agent': 'DegenFeed/0.1' },
    });
    if (!res.ok) throw new Error(`Hub returned ${res.status}`);

    const messages = (await res.json()) as Array<{
      data: { type: string; fid: number; userDataBody: { type: string; value: string } };
    }>;

    const username =
      messages.find((m) => m.data.type === 'USER_DATA_TYPE_USERNAME')?.data.userDataBody
        .value || `fid:${fid}`;
    const displayName =
      messages.find((m) => m.data.type === 'USER_DATA_TYPE_DISPLAY')?.data.userDataBody.value ||
      username;
    const bio =
      messages.find((m) => m.data.type === 'USER_DATA_TYPE_BIO')?.data.userDataBody.value || '';
    const pfpUrl =
      messages.find((m) => m.data.type === 'USER_DATA_TYPE_PFP')?.data.userDataBody.value || '';

    return {
      username,
      displayName,
      bio,
      pfpUrl,
      metadataUri: `farcaster://user/${fid}`,
    };
  } catch (err) {
    console.warn('[farcaster-coin] Failed to fetch profile:', String(err));
    return {
      username: `fid:${fid}`,
      displayName: `Farcaster User #${fid}`,
      bio: '',
      pfpUrl: '',
      metadataUri: `farcaster://user/${fid}`,
    };
  }
}

// ─── Simulation helpers (placeholders for on-chain integration) ────────────

async function deployCreatorCoin(opts: {
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  vestingConfig?: { vestingDurationDays?: number; creatorAllocationBps?: number; cliffDays?: number };
  feeConfig?: { creatorFeeBps?: number; platformFeeBps?: number };
}): Promise<{ coinAddress: string; tokenId: string; signature: string }> {
  // In production, calls the Zora/Base creator coin factory contract.
  // Deterministic address derived from creator + seed for consistency.
  const input = `${opts.creator}:${opts.symbol}:${Date.now()}`;
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hashArr = Array.from(new Uint8Array(hashBytes));
  const addr = '0x' + hashArr.slice(0, 20).map((b) => b.toString(16).padStart(2, '0')).join('');
  return {
    coinAddress: addr,
    tokenId: '1',
    signature: `0x${crypto.randomUUID().replace(/-/g, '')}`,
  };
}

async function registerCrossChain(opts: {
  originProtocol: string;
  originCreatorId: string;
  originChainId: number;
  token: string;
}): Promise<void> {
  // In production, calls CrossChainRegistry.register via a microservice or KV.
  console.log('[farcaster-coin] Registered cross-chain:', opts);
}

async function wrapForZora(opts: {
  protocol: string;
  creatorId: string;
  tokenAddress: string;
  metadata: { name: string; description: string; image: string };
}): Promise<void> {
  // In production, calls Zora's wrapper contract to make the coin visible on Zora.
  console.log('[farcaster-coin] Wrapped for Zora:', opts.metadata.name);
}

async function postToFarcaster(
  _fid: number,
  text: string,
): Promise<string | null> {
  // In production, builds + signs a Farcaster cast using the user's signer.
  console.log('[farcaster-coin] Would post cast:', text.slice(0, 100));
  return null;
}

function generateSymbol(username: string): string {
  const clean = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length >= 3) return `FC${clean.slice(0, 4)}`;
  return `FC${clean.padEnd(3, 'X')}`;
}

// ─── POST /api/farcaster/coin/deploy ──────────────────────────────────────

export async function handleFarcasterCoinDeploy(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  // Verify this wallet owns a linked Farcaster account
  const fid = await getLinkedFid(env, walletAddress);
  if (!fid) {
    return jsonResponse(
      {
        error:
          'No Farcaster account linked to this wallet. Link one at /api/identity/link',
      },
      400,
    );
  }

  // Check if already deployed
  const existingKey = FARCASTER_COIN_PREFIX + fid;
  const existing = await kvGetJson<FarcasterCoinRecord>(env.CACHE, existingKey);
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

  // Get Farcaster profile for metadata
  const profile = await getFarcasterProfile(fid);
  const genSymbol = symbol || generateSymbol(profile.username);

  // Deploy on Base via our factory
  let deployResult: { coinAddress: string; tokenId: string; signature: string };
  try {
    deployResult = await deployCreatorCoin({
      creator: walletAddress,
      name,
      symbol: genSymbol,
      uri: `farcaster://user/${fid}/coin`,
      vestingConfig: { vestingDurationDays, creatorAllocationBps, cliffDays },
      feeConfig: { creatorFeeBps, platformFeeBps },
    });
  } catch (err) {
    return jsonResponse({ error: `Deployment failed: ${String(err)}` }, 500);
  }

  // Register cross-chain: this is a farcaster:{fid} coin on Base
  await registerCrossChain({
    originProtocol: 'farcaster',
    originCreatorId: fid.toString(),
    originChainId: 8453, // Base
    token: deployResult.coinAddress,
  });

  // Auto-wrap for Zora visibility
  await wrapForZora({
    protocol: 'farcaster',
    creatorId: fid.toString(),
    tokenAddress: deployResult.coinAddress,
    metadata: {
      name: `${profile.displayName}'s Coin`,
      description: `Creator coin for @${profile.username} on Farcaster. Trade on Base, visible on Zora, bridged to Solana.`,
      image: profile.pfpUrl,
    },
  });

  // Announce to Farcaster
  const announcementHash = await postToFarcaster(
    fid,
    `I just launched $${genSymbol} on DegenFeed!\n\n` +
      `My creator coin is now visible on Zora, tradable on Base, and bridged to Solana.\n\n` +
      `Join me: https://app.degenfeed.xyz/launch/${genSymbol}`,
  );

  // Store coin record in KV
  const now = Date.now();
  const coinRecord: FarcasterCoinRecord = {
    fid,
    username: profile.username,
    displayName: profile.displayName,
    pfpUrl: profile.pfpUrl,
    coinAddress: deployResult.coinAddress,
    tokenId: deployResult.tokenId,
    symbol: genSymbol,
    name,
    deployedAt: now,
    deployedBy: walletAddress,
    chainId: 8453,
    metadataUri: `farcaster://user/${fid}/coin`,
    zoraUrl: `https://zora.co/collect/base:${ZORA_WRAPPER_FACTORY}/${deployResult.tokenId}`,
    degenfeedUrl: `https://app.degenfeed.xyz/launch/${genSymbol}`,
    announcementHash: announcementHash || undefined,
    totalSupply: '0',
    price: '0',
    supporters: 0,
    totalTips: 0,
    totalTipsUsd: 0,
  };

  await kvPutJson(env.CACHE, existingKey, coinRecord);
  await kvPutJson(env.CACHE, FARCASTER_LINK_PREFIX + deployResult.coinAddress.toLowerCase(), {
    fid,
    wallet: walletAddress,
  });

  return jsonResponse(
    {
      coinAddress: deployResult.coinAddress,
      symbol: genSymbol,
      zoraUrl: coinRecord.zoraUrl,
      degenfeedUrl: coinRecord.degenfeedUrl,
      announcementHash: coinRecord.announcementHash || null,
      fid,
    },
    201,
  );
}

// ─── GET /api/farcaster/coin/:fid ─────────────────────────────────────────

export async function handleFarcasterCoinGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const fidStr = pathParts[pathParts.length - 1];
  const fid = Number(fidStr);

  if (!fid || fid <= 0 || !Number.isFinite(fid)) {
    return jsonResponse({ error: 'Invalid FID' }, 400);
  }

  const key = FARCASTER_COIN_PREFIX + fid;
  const coin = await kvGetJson<FarcasterCoinRecord>(env.CACHE, key);

  if (!coin) {
    return noCacheJsonResponse({ hasCoin: false, fid });
  }

  return noCacheJsonResponse({
    hasCoin: true,
    fid: coin.fid,
    username: coin.username,
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

// ─── POST /api/farcaster/coin/:fid/tip ────────────────────────────────────

export async function handleFarcasterCoinTip(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const fidStr = pathParts[pathParts.length - 2]; // before /tip
  const fid = Number(fidStr);

  if (!fid || fid <= 0 || !Number.isFinite(fid)) {
    return jsonResponse({ error: 'Invalid FID' }, 400);
  }

  const coinKey = FARCASTER_COIN_PREFIX + fid;
  const coin = await kvGetJson<FarcasterCoinRecord>(env.CACHE, coinKey);
  if (!coin) {
    return jsonResponse({ error: 'No creator coin found for this Farcaster user' }, 404);
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
  const currency = sanitizeString(body.currency, 16) || 'usdc';
  const amountNum = Number.parseFloat(amount);

  if (!amountNum || amountNum <= 0 || amountNum > 10000) {
    return jsonResponse({ error: 'amount must be a positive number ≤ 10000' }, 400);
  }

  const tipAmountUsd = Math.round(amountNum * 100) / 100;

  // Record tip in unified ledger (in production also buys creator coin on Base)
  const activity = await recordUnifiedTip(env, {
    platform: 'farcaster',
    entityId: `farcaster:coin:${fid}`,
    entityType: 'creator_coin',
    amountUsd: tipAmountUsd,
    fromUserId: session.address,
    toUserId: coin.deployedBy,
    fromLabel:
      sanitizeString(body.fromLabel, 64) ||
      `${session.address.slice(0, 6)}…${session.address.slice(-4)}`,
    toLabel: `@${coin.username}`,
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
    fid,
    username: coin.username,
    coinAddress: coin.coinAddress,
    activityId: activity?.id,
  });
}

// ─── Helper: get coin by FID (internal) ────────────────────────────────────

export async function getCreatorCoinForFid(
  env: Env,
  fid: number,
): Promise<FarcasterCoinRecord | null> {
  return kvGetJson<FarcasterCoinRecord>(env.CACHE, FARCASTER_COIN_PREFIX + fid);
}

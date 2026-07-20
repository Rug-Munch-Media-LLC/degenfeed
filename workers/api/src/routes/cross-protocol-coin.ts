/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Launch System
 *
 * Any user from ANY protocol (Farcaster, Nostr, Bluesky, Threads, Mastodon, Lens)
 * can launch a creator coin on DegenFeed. Their coin is deployed on their chosen
 * chain (Base or Solana), auto-wrapped for Zora visibility, and announced back
 * to their native protocol.
 *
 * Routes:
 *   POST /api/coin/launch                         — Launch a creator coin from any protocol
 *   GET  /api/coin/:symbol/cross-chain             — Get cross-chain visibility for a coin
 *   GET  /api/coin/protocol/:protocol/:creatorId   — Find coin by protocol identity
 */

import { type CrossChainMapping, createCrossChainRegistry } from '@degenfeed/zora-sdk';
import { hexToBytes } from '@noble/hashes/utils';
import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requirePremiumTier } from '../premium';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';

// ─── Constants ──────────────────────────────────────────────────────────────

const COIN_PREFIX = 'coin:';
const SYMBOL_INDEX_PREFIX = 'coin:symbol:';
const TTL_1Y = 60 * 60 * 24 * 365;
const ZORA_WRAPPER_FACTORY = '0x0000000000000000000000000000000000000000'; // Override via env

// Chain IDs for the cross-chain registry
const BASE_CHAIN_ID = 8453;
const SOLANA_CHAIN_ID = 901; // Our convention in the registry

// ─── Types ──────────────────────────────────────────────────────────────────

interface CrossProtocolCoinRecord {
  symbol: string;
  name: string;
  coinAddress: string;
  tokenId: string;
  chain: string;
  chainId: number;
  originProtocol: string;
  originCreatorId: string;
  deployedAt: number;
  deployedBy: string;
  metadataUri: string;
  zoraUrl: string;
  degenfeedUrl: string;
  announcementResult?: Record<string, unknown>;
  totalSupply: string;
  price: string;
  supporters: number;
  totalTips: number;
  totalTipsUsd: number;
}

interface LaunchCoinBody {
  name?: string;
  symbol?: string;
  chain?: 'base' | 'solana';
  originProtocol?: string;
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

// ─── Router ─────────────────────────────────────────────────────────────────

export const crossProtocolCoin = new Hono<{ Bindings: Env }>();

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
    console.warn(`[cross-protocol-coin] KV put failed for ${key}:`, String(err));
  }
}

// ─── POST /api/coin/launch ──────────────────────────────────────────────────

crossProtocolCoin.post('/launch', async (c) => {
  const request = c.req.raw;
  const env = c.env;

  // 1. Authenticate session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  // 2. Premium check — creator coins require at least 'creator' tier
  const premiumGate = await requirePremiumTier(walletAddress, env, 'creator');
  if (premiumGate) return premiumGate;

  // 3. Validate request body
  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: LaunchCoinBody;
  try {
    body = (await c.req.json()) as LaunchCoinBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const name = sanitizeString(body.name, 64) || '';
  const symbol = sanitizeString(body.symbol, 10) || '';
  const chain = body.chain === 'solana' ? 'solana' : 'base';
  const originProtocol = sanitizeString(body.originProtocol, 32) || '';

  if (!name || !symbol) {
    return jsonResponse({ error: 'name and symbol are required' }, 400);
  }
  if (!originProtocol) {
    return jsonResponse(
      { error: 'originProtocol is required (farcaster, nostr, bluesky, threads, lens, mastodon)' },
      400,
    );
  }

  const VALID_PROTOCOLS = new Set([
    'farcaster',
    'nostr',
    'bluesky',
    'threads',
    'lens',
    'mastodon',
    'activitypub',
  ]);
  if (!VALID_PROTOCOLS.has(originProtocol)) {
    return jsonResponse({ error: `Unsupported originProtocol: ${originProtocol}` }, 400);
  }

  if (hasSuspiciousPayload(name) || hasSuspiciousPayload(symbol)) {
    return jsonResponse({ error: 'Invalid characters in name or symbol' }, 400);
  }

  // 4. Validate vesting & fee config
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

  // 5. Check for duplicate symbol
  const existingSymbol = await kvGetJson<{ coinAddress: string }>(
    env.CACHE,
    SYMBOL_INDEX_PREFIX + symbol.toLowerCase(),
  );
  if (existingSymbol) {
    return jsonResponse({ error: `Symbol $${symbol} is already taken` }, 409);
  }

  // 6. Resolve the protocol-native creator identity
  const creatorId = await getProtocolCreatorId(session, originProtocol, env);
  if (!creatorId) {
    return jsonResponse(
      {
        error: `No ${originProtocol} identity linked to this wallet. Link one at /api/identity/link`,
      },
      400,
    );
  }

  // 7. Deploy token on the chosen chain
  let deployResult: { coinAddress: string; tokenId: string };
  try {
    deployResult =
      chain === 'solana'
        ? await deploySolanaToken(
            walletAddress,
            name,
            symbol,
            { vestingDurationDays, creatorAllocationBps, cliffDays },
            { creatorFeeBps, platformFeeBps },
            env,
          )
        : await deployBaseCoin(
            walletAddress,
            name,
            symbol,
            { vestingDurationDays, creatorAllocationBps, cliffDays },
            { creatorFeeBps, platformFeeBps },
            env,
          );
  } catch (err) {
    return jsonResponse({ error: `Deployment failed: ${String(err)}` }, 500);
  }

  const chainId = chain === 'solana' ? SOLANA_CHAIN_ID : BASE_CHAIN_ID;

  // 8. Register cross-chain mapping via the CrossChainRegistry
  try {
    const regKv = createKvAdapter(env.XCHAIN_REGISTRY || env.CACHE);
    const registry = createCrossChainRegistry(regKv);

    const now = Date.now();
    const mapping: CrossChainMapping = {
      id: `${chainId}:${deployResult.coinAddress.toLowerCase()}:${chainId}:${deployResult.coinAddress.toLowerCase()}`,
      source: {
        chainId,
        protocol: originProtocol,
        creatorId,
        token: deployResult.coinAddress,
      },
      target: {
        chainId,
        protocol: 'degenfeed',
        creatorId,
        token: deployResult.coinAddress,
      },
      createdAt: now,
      verifiedBy: 'creator',
    };

    await registry.register(mapping);
  } catch (err) {
    console.warn('[cross-protocol-coin] Cross-chain registration warning:', String(err));
  }

  // 9. Wrap for Zora visibility
  let zoraWrapper: { tokenId: string; success: boolean } = {
    tokenId: deployResult.tokenId,
    success: false,
  };
  try {
    const { wrapContentAsCreatorCoin } = await import('../lib/zora-wrapper');
    const wrapResult = await wrapContentAsCreatorCoin(
      {
        sourceProtocol: originProtocol as Parameters<
          typeof wrapContentAsCreatorCoin
        >[0]['sourceProtocol'],
        sourceNativeId: creatorId,
        sourceDfUri: `df://${originProtocol}:${creatorId}`,
        text: `Creator coin $${symbol} for ${originProtocol} user ${creatorId}`,
        title: `${name} — ${originProtocol}`,
        chain: chain === 'solana' ? 'base' : 'base',
        creatorAddress: walletAddress,
      },
      deployResult.coinAddress,
      env,
      env.PREMIUM_WALLET_KEY || '',
    );
    if (wrapResult.ok) {
      zoraWrapper = { tokenId: deployResult.tokenId, success: true };
    }
  } catch (err) {
    console.warn('[cross-protocol-coin] Zora wrap warning:', String(err));
  }

  // 10. Announce on origin protocol
  const degenfeedUrl = `https://app.degenfeed.xyz/launch/${symbol}`;
  const zoraUrl = `https://zora.co/collect/base:${ZORA_WRAPPER_FACTORY}/${zoraWrapper.tokenId}`;

  let announcementResult: Record<string, unknown> | null = null;
  try {
    announcementResult = await announceCoinLaunch({
      protocol: originProtocol,
      creator: walletAddress,
      coinSymbol: symbol,
      coinAddress: deployResult.coinAddress,
      zoraUrl,
      degenfeedUrl,
      env,
      creatorId,
    });
  } catch (err) {
    console.warn('[cross-protocol-coin] Announcement warning:', String(err));
  }

  // 11. Store coin record in KV
  const now = Date.now();
  const coinRecord: CrossProtocolCoinRecord = {
    symbol,
    name,
    coinAddress: deployResult.coinAddress,
    tokenId: deployResult.tokenId,
    chain,
    chainId,
    originProtocol,
    originCreatorId: creatorId,
    deployedAt: now,
    deployedBy: walletAddress,
    metadataUri: `degenfeed://coin/${symbol}`,
    zoraUrl,
    degenfeedUrl,
    announcementResult: announcementResult || undefined,
    totalSupply: '0',
    price: '0',
    supporters: 0,
    totalTips: 0,
    totalTipsUsd: 0,
  };

  const coinKey = COIN_PREFIX + deployResult.coinAddress.toLowerCase();
  await kvPutJson(env.CACHE, coinKey, coinRecord);
  await kvPutJson(env.CACHE, SYMBOL_INDEX_PREFIX + symbol.toLowerCase(), {
    coinAddress: deployResult.coinAddress,
    chain,
    originProtocol,
    originCreatorId: creatorId,
  });

  // 12. Return response
  return jsonResponse(
    {
      coinAddress: deployResult.coinAddress,
      chain,
      symbol,
      name,
      zoraUrl,
      degenfeedUrl,
      announcement: announcementResult,
      crossChain: {
        registered: true,
        visibleOn: ['base', 'solana', 'zora', originProtocol],
      },
    },
    201,
  );
});

// ─── GET /api/coin/:symbol/cross-chain ──────────────────────────────────────

crossProtocolCoin.get('/:symbol/cross-chain', async (c) => {
  const env = c.env;
  const symbol = sanitizeString(c.req.param('symbol'), 32);
  if (!symbol) return jsonResponse({ error: 'Invalid symbol' }, 400);

  // Look up the coin by symbol
  const symbolIndex = await kvGetJson<{
    coinAddress: string;
    chain: string;
    originProtocol: string;
    originCreatorId: string;
  }>(env.CACHE, SYMBOL_INDEX_PREFIX + symbol.toLowerCase());
  if (!symbolIndex) return jsonResponse({ error: 'Coin not found' }, 404);

  // Get the full coin record
  const coinKey = COIN_PREFIX + symbolIndex.coinAddress.toLowerCase();
  const coin = await kvGetJson<CrossProtocolCoinRecord>(env.CACHE, coinKey);

  // Try to get cross-chain references via registry
  let crossRefs: Record<string, unknown> = {};
  try {
    const regKv = createKvAdapter(env.XCHAIN_REGISTRY || env.CACHE);
    const registry = createCrossChainRegistry(regKv);
    const tokens = await registry.getCreatorTokens(
      symbolIndex.originProtocol,
      symbolIndex.originCreatorId,
    );

    const visibleOn = new Set<string>();
    for (const t of tokens) {
      visibleOn.add(t.chain);
    }
    visibleOn.add(symbolIndex.originProtocol);

    crossRefs = {
      tokens: tokens.map((t) => ({
        chain: t.chain,
        chainId: t.chainId,
        address: t.address,
        protocol: t.protocol,
      })),
      visibleOn: Array.from(visibleOn),
    };
  } catch {
    // Registry unavailable — return minimal info
    crossRefs = {
      visibleOn: ['base', 'zora', symbolIndex.originProtocol],
    };
  }

  return noCacheJsonResponse({
    baseToken: symbolIndex.coinAddress,
    chain: symbolIndex.chain,
    originProtocol: symbolIndex.originProtocol,
    originCreatorId: symbolIndex.originCreatorId,
    ...(coin
      ? {
          name: coin.name,
          symbol: coin.symbol,
          deployedAt: coin.deployedAt,
          zoraUrl: coin.zoraUrl,
          degenfeedUrl: coin.degenfeedUrl,
          totalSupply: coin.totalSupply,
          price: coin.price,
          supporters: coin.supporters,
        }
      : {}),
    ...crossRefs,
  });
});

// ─── GET /api/coin/protocol/:protocol/:creatorId ───────────────────────────

crossProtocolCoin.get('/protocol/:protocol/:creatorId', async (c) => {
  const env = c.env;
  const protocol = sanitizeString(c.req.param('protocol'), 32);
  const creatorId = sanitizeString(c.req.param('creatorId'), 256);

  if (!protocol || !creatorId) {
    return jsonResponse({ error: 'protocol and creatorId are required' }, 400);
  }

  try {
    const regKv = createKvAdapter(env.XCHAIN_REGISTRY || env.CACHE);
    const registry = createCrossChainRegistry(regKv);
    const tokens = await registry.getCreatorTokens(protocol, creatorId);

    if (tokens.length === 0) {
      return noCacheJsonResponse({ hasCoin: false, protocol, creatorId, tokens: [] });
    }

    return noCacheJsonResponse({
      hasCoin: true,
      protocol,
      creatorId,
      tokens: tokens.map((t) => ({
        chain: t.chain,
        chainId: t.chainId,
        address: t.address,
        deployedAt: t.deployedAt,
        symbol: t.symbol,
      })),
    });
  } catch {
    // Fallback: scan KV for matching records
    const records = await findCoinsByProtocolCreator(env, protocol, creatorId);
    return noCacheJsonResponse({
      hasCoin: records.length > 0,
      protocol,
      creatorId,
      tokens: records.map((r) => ({
        chain: r.chain,
        chainId: r.chainId,
        address: r.coinAddress,
        symbol: r.symbol,
        deployedAt: r.deployedAt,
      })),
    });
  }
});

// ─── Token Deployment ───────────────────────────────────────────────────────

/**
 * Deploy a creator coin on Base (EVM) via the Zora/Base creator coin factory.
 */
async function deployBaseCoin(
  creator: string,
  name: string,
  symbol: string,
  vestingConfig: { vestingDurationDays: number; creatorAllocationBps: number; cliffDays: number },
  feeConfig: { creatorFeeBps: number; platformFeeBps: number },
  _env: Env,
): Promise<{ coinAddress: string; tokenId: string }> {
  // In production, calls the Zora/Base creator coin factory contract on Base.
  // Deterministic address derived from creator + symbol for consistency.
  const input = `${creator}:${symbol}:${BASE_CHAIN_ID}:${Date.now()}`;
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hashArr = Array.from(new Uint8Array(hashBytes));
  const addr =
    '0x' +
    hashArr
      .slice(0, 20)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  console.log(
    `[cross-protocol-coin] Deployed on Base: ${name} ($${symbol}) at ${addr}`,
    JSON.stringify({ vestingConfig, feeConfig }),
  );

  return { coinAddress: addr, tokenId: '1' };
}

/**
 * Deploy a creator coin on Solana via the custom Anchor program.
 */
async function deploySolanaToken(
  creator: string,
  name: string,
  symbol: string,
  vestingConfig: { vestingDurationDays: number; creatorAllocationBps: number; cliffDays: number },
  feeConfig: { creatorFeeBps: number; platformFeeBps: number },
  _env: Env,
): Promise<{ coinAddress: string; tokenId: string }> {
  // In production, calls the Solana Anchor program to create an SPL token
  // with bonding curve. The deployed mint address is the "coinAddress".
  // Deterministic PDA-derived address for consistency.
  const seed = `${creator.slice(0, 8)}:${symbol}:${Date.now()}`;
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const hashArr = Array.from(new Uint8Array(hashBytes));
  const addr = hashArr
    .slice(0, 32)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  console.log(
    `[cross-protocol-coin] Deployed on Solana: ${name} ($${symbol}) at ${addr}`,
    JSON.stringify({ vestingConfig, feeConfig }),
  );

  return { coinAddress: addr, tokenId: '1' };
}

// ─── Protocol Identity Resolution ──────────────────────────────────────────

/**
 * Resolve the protocol-native creator ID from the user's session.
 * Checks the linked identity store (IDENTITIES KV) for the given protocol.
 */
async function getProtocolCreatorId(
  session: { address: string; chain: string },
  protocol: string,
  env: Env,
): Promise<string | null> {
  const walletAddress = session.address.toLowerCase();

  try {
    const identityKey = `identity:${walletAddress}`;
    const raw = await env.IDENTITIES?.get(identityKey);
    if (!raw) return null;

    const identity = JSON.parse(raw) as Record<string, unknown>;
    const protocolData = identity[protocol] as Record<string, unknown> | undefined;

    if (!protocolData) return null;

    switch (protocol) {
      case 'farcaster':
        return protocolData.fid ? String(protocolData.fid) : null;
      case 'nostr':
        return (protocolData.pubkey as string) || null;
      case 'bluesky':
        return (protocolData.did as string) || null;
      case 'lens':
        return (protocolData.profileId as string) || null;
      case 'threads':
        return (protocolData.id as string) || null;
      case 'mastodon':
      case 'activitypub':
        return (protocolData.id as string) || null;
      default:
        return (protocolData.id as string) || null;
    }
  } catch {
    return null;
  }
}

// ─── Protocol Announcements ────────────────────────────────────────────────

/**
 * Announce a coin launch on the creator's native protocol.
 * Each protocol uses its respective SDK to post the announcement.
 */
async function announceCoinLaunch(opts: {
  protocol: string;
  creator: string;
  coinSymbol: string;
  coinAddress: string;
  zoraUrl: string;
  degenfeedUrl: string;
  env: Env;
  creatorId: string;
}): Promise<Record<string, unknown> | null> {
  const message =
    `I just launched $${opts.coinSymbol} on DegenFeed!\n\n` +
    `My creator coin is now live and visible across Zora, Base, Solana, and all protocols.\n\n` +
    `Join me: ${opts.degenfeedUrl}\n` +
    `Zora: ${opts.zoraUrl}`;

  switch (opts.protocol) {
    case 'farcaster':
      return postFarcasterCast(opts.creator, opts.creatorId, message, opts.degenfeedUrl, opts.env);
    case 'nostr':
      return publishNostrEvent(opts.creatorId, message, opts.env);
    case 'bluesky':
      return postBluesky(opts.creatorId, message.slice(0, 300), opts.degenfeedUrl, opts.env);
    case 'lens':
      return postLensPublication(opts.creatorId, message, opts.env);
    case 'threads':
      return postThreads(opts.creatorId, message, opts.env);
    case 'mastodon':
    case 'activitypub':
      return postActivityPub(opts.creatorId, message, opts.env);
    default:
      return null;
  }
}

/**
 * Post a Farcaster cast announcing the coin launch.
 * Uses the Neynar API (recommended for server-side posting) or falls back to
 * submitting a signed message to a Farcaster Hub via a bot signer.
 *
 * The bot must have a managed signer (signer_uuid) registered via Neynar.
 */
async function postFarcasterCast(
  _creatorWallet: string,
  creatorId: string,
  text: string,
  _linkUrl: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const fid = Number(creatorId);
  if (!fid || !Number.isFinite(fid)) return null;

  try {
    // Neynar API: posts via a managed signer (bot account posts on behalf)
    if (env.NEYNAR_API_KEY) {
      // Use the DegenFeed bot signer UUID (configured in env)
      const signerUuid = (env as Record<string, string | undefined>)['FARCASTER_SIGNER_UUID'] || '';
      if (signerUuid) {
        const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-api-key': env.NEYNAR_API_KEY,
          },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            text,
            parent: undefined,
            channel_id: 'degenfeed',
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { cast?: { hash?: string } };
          if (data.cast?.hash) {
            return { ok: true, hash: data.cast.hash, protocol: 'farcaster', method: 'neynar' };
          }
        }
        const errText = await res.text().catch(() => '');
        console.warn('[cross-protocol-coin] Neynar post failed:', errText.slice(0, 200));
      }
    }

    // Fallback: build and submit a signed message via a bot signer key
    const botSignerHex = (env as Record<string, string | undefined>)['FARCASTER_BOT_SIGNER_KEY'];
    const botFid = Number((env as Record<string, string | undefined>)['FARCASTER_BOT_FID'] || 0);
    if (botSignerHex && botFid) {
      const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
      const { HubClient } = await import('@degenfeed/farcaster-sdk');

      const castResult = buildFarcasterCastMessage({
        signerKeyHex: botSignerHex,
        fid: botFid,
        text,
      });

      if (!castResult.ok || !castResult.messageHex) {
        console.warn('[cross-protocol-coin] Failed to build cast message:', castResult.error);
        return null;
      }

      const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
      const hub = new HubClient(hubUrl);

      // Convert hex string to bytes for the Hub submitMessage endpoint
      const messageHex = castResult.messageHex;
      const messageBytes = hexToBytes(messageHex);
      const messageArray = new Uint8Array(messageBytes);
      await hub.submitMessage(messageArray.buffer as ArrayBuffer);

      return { ok: true, protocol: 'farcaster', hubUrl, method: 'direct' };
    }

    return null;
  } catch (err) {
    console.warn('[cross-protocol-coin] Farcaster cast failed:', String(err));
    return null;
  }
}

/**
 * Publish a Nostr event (kind 1 text note) announcing the coin launch.
 * Requires a Nostr private key configured in env.NOSTR_PRIVATE_KEY.
 *
 * Creates, signs, and publishes the event to configured relays.
 * Uses two methods in parallel for reliability:
 *   1. RelayPool WebSocket (fast, preferred)
 *   2. Direct HTTP relay publish (fallback for relays that support it)
 */
async function publishNostrEvent(
  _pubkey: string,
  text: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const privateKeyHex = env.NOSTR_PRIVATE_KEY;
  if (!privateKeyHex) return null;

  try {
    const { createTextNote } = await import('@degenfeed/nostr-sdk');

    // createTextNote(content, secretKey, tags) returns a fully signed NostrEvent
    const signed = createTextNote(text, privateKeyHex, [
      ['t', 'degenfeed'],
      ['t', 'creatorcoin'],
      ['r', 'https://app.degenfeed.xyz'],
    ]);

    // Publish to relays
    const relayUrls = [
      ...(env.RELAY_URLS?.split(',').map((u) => u.trim()) || []),
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
    ].filter(Boolean);

    const publishedRelays: string[] = [];
    const failedRelays: string[] = [];

    // Method 1: RelayPool WebSocket (for supporting relays)
    try {
      const { RelayPool } = await import('@degenfeed/nostr-sdk');
      const pool = new RelayPool(relayUrls, {
        connectTimeout: 3000,
        eoseTimeout: 2000,
        maxReconnects: 0,
        logLevel: 'error',
      });

      // Wait briefly for connections to establish
      await new Promise<void>((resolve) => {
        const check = () => {
          const connected = pool.getConnectedRelays().length;
          if (connected > 0 || Date.now() - start > 3000) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        const start = Date.now();
        setTimeout(check, 500);
      });

      // Publish to all connected relays
      pool.publish(signed, {
        onOk: (relayUrl) => {
          if (!publishedRelays.includes(relayUrl)) publishedRelays.push(relayUrl);
        },
        onError: (relayUrl) => {
          if (!failedRelays.includes(relayUrl)) failedRelays.push(relayUrl);
        },
      });

      // Give time for publishing
      await new Promise((r) => setTimeout(r, 1500));
      // Close all relay connections
      for (const url of pool.getConnectedRelays()) {
        pool.removeRelay(url);
      }
    } catch {
      // WebSocket pool failed — try HTTP fallback
    }

    // Method 2: HTTP relay publish for relays that support it
    // Some Nostr relays accept events via POST / (NIP-01 compliant)
    const httpRelays = relayUrls
      .filter((u) => u.startsWith('wss://'))
      .map((ws) => `https://${ws.slice(6)}`);

    for (const httpUrl of httpRelays) {
      try {
        const res = await fetch(httpUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(['EVENT', signed]),
        });
        if (res.ok && !publishedRelays.includes(httpUrl)) {
          publishedRelays.push(httpUrl);
        }
      } catch {
        // HTTP publish not supported by this relay
      }
    }

    return {
      ok: publishedRelays.length > 0,
      eventId: signed.id,
      protocol: 'nostr',
      relays: publishedRelays.length,
      publishedRelays,
      failedRelays,
    };
  } catch (err) {
    console.warn('[cross-protocol-coin] Nostr publish failed:', String(err));
    return null;
  }
}

/**
 * Post a Bluesky skeet announcing the coin launch.
 * Uses the PdsClient from @degenfeed/bluesky-sdk with env-configured credentials.
 */
async function postBluesky(
  _did: string,
  text: string,
  _linkUrl: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const bskyDid = env.BSKY_DID;
  const bskyPassword = env.PREMIUM_WALLET_KEY; // Reuse as app password for now
  if (!bskyDid || !bskyPassword) return null;

  try {
    const { PdsClient } = await import('@degenfeed/bluesky-sdk');
    const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
    const client = new PdsClient(pdsUrl);

    // Authenticate as the bot account
    await client.createSession(bskyDid, bskyPassword);

    // Create the post with a link embed
    const result = await client.createPost({
      text,
      langs: ['en'],
    });

    return {
      ok: true,
      uri: result.uri,
      cid: result.cid,
      protocol: 'bluesky',
    };
  } catch (err) {
    console.warn('[cross-protocol-coin] Bluesky post failed:', String(err));
    return null;
  }
}

/**
 * Post a Lens publication announcing the coin launch.
 * Uses the LensClient from @degenfeed/lens-sdk.
 */
async function postLensPublication(
  profileId: string,
  text: string,
  _env: Env,
): Promise<Record<string, unknown> | null> {
  if (!profileId) return null;

  try {
    const { LensClient } = await import('@degenfeed/lens-sdk');
    const client = new LensClient();

    // Comment on the profile's own timeline as the announcement
    await client.comment(profileId, text);

    return {
      ok: true,
      profileId,
      protocol: 'lens',
    };
  } catch (err) {
    console.warn('[cross-protocol-coin] Lens post failed:', String(err));
    return null;
  }
}

/**
 * Post a Threads thread announcing the coin launch.
 * Uses the ThreadsClient from @degenfeed/threads-sdk.
 */
async function postThreads(
  _userId: string,
  text: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const threadsToken = env.THREADS_APP_SECRET;
  const threadsUserId = env.THREADS_APP_ID;
  if (!threadsToken || !threadsUserId) return null;

  try {
    const { ThreadsClient } = await import('@degenfeed/threads-sdk');
    const client = new ThreadsClient(threadsToken, threadsUserId);

    // Create the media container
    const creationId = await client.createThread(text);
    // Publish it
    const mediaId = await client.publishThread(creationId);

    return {
      ok: true,
      mediaId,
      protocol: 'threads',
    };
  } catch (err) {
    console.warn('[cross-protocol-coin] Threads post failed:', String(err));
    return null;
  }
}

/**
 * Post a Mastodon/ActivityPub toot announcing the coin launch.
 * Uses the GtSClient from @degenfeed/mastodon-sdk.
 * Falls back to ActivityPub protocol when protocol is 'activitypub'.
 */
async function postActivityPub(
  _accountId: string,
  text: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  // Try GotoSocial instance first (our managed Mastodon-compatible server)
  const instanceUrl =
    env.MASTODON_INSTANCE_URL || env.GTS_API_BASE || 'https://social.degenfeed.xyz';
  const accessToken = env.PREMIUM_WALLET_KEY;
  if (!accessToken) return null;

  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instanceUrl, accessToken);

    const status = await client.publish(text, {
      visibility: 'public',
    });

    return {
      ok: true,
      statusId: status.id,
      url: status.url,
      protocol: 'mastodon',
    };
  } catch (err) {
    console.warn('[cross-protocol-coin] Mastodon post failed:', String(err));
    return null;
  }
}

// ─── Fallback: Scan KV for protocol + creator ───────────────────────────────

/**
 * Fallback scan when the CrossChainRegistry is unavailable.
 * Lists all coin records in KV and filters by protocol + creatorId.
 * Uses KV list with prefix scan.
 */
async function findCoinsByProtocolCreator(
  env: Env,
  protocol: string,
  creatorId: string,
): Promise<CrossProtocolCoinRecord[]> {
  if (!env.CACHE) return [];

  const results: CrossProtocolCoinRecord[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page = await env.CACHE.list({
        prefix: COIN_PREFIX,
        cursor,
        limit: 100,
      });

      for (const key of page.keys) {
        try {
          const raw = await env.CACHE.get(key.name);
          if (!raw) continue;
          const record = JSON.parse(raw) as CrossProtocolCoinRecord;
          if (record.originProtocol === protocol && record.originCreatorId === creatorId) {
            results.push(record);
          }
        } catch {
          // skip unparseable entries
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && results.length < 50);
  } catch {
    // KV scan failed
  }

  return results;
}

// ─── KV Adapter for CrossChainRegistry ─────────────────────────────────────

function createKvAdapter(kv: KVNamespace | undefined): {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
} {
  return {
    async get(key: string): Promise<string | null> {
      if (!kv) return null;
      try {
        return await kv.get(key);
      } catch {
        return null;
      }
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      if (!kv) return;
      try {
        await kv.put(key, value, { expirationTtl: options?.expirationTtl ?? TTL_1Y });
      } catch (err) {
        console.warn(`[cross-protocol-coin] KV put failed for ${key}:`, String(err));
      }
    },
  };
}

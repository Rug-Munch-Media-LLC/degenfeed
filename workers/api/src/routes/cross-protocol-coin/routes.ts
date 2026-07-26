/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Route Handlers
 *
 * Route handlers for the crossProtocolCoin Hono router.
 */

import { createCrossChainRegistry } from '@degenfeed/zora-sdk';
import { requirePremiumTier } from '../../premium';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../../sanitize';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import { deployBaseCoin, deploySolanaToken } from './deploy';
import {
  COIN_PREFIX,
  type CrossProtocolCoinRecord,
  type LaunchCoinBody,
  SOLANA_CHAIN_ID,
  SYMBOL_INDEX_PREFIX,
  VALID_PROTOCOLS,
} from './types';
import {
  createKvAdapter,
  findCoinsByProtocolCreator,
  getProtocolCreatorId,
  kvGetJson,
  kvPutJson,
} from './utils';

// ─── POST /api/coin/launch ──────────────────────────────────────────────────

export async function handleLaunchCoin(c: { req: { raw: Request }; env: Env }): Promise<Response> {
  const request = c.req.raw;
  const env = c.env;

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  const premiumGate = await requirePremiumTier(walletAddress, env, 'creator');
  if (premiumGate) return premiumGate;

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
  const chain = body.chain ?? 'base';
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
  if (!VALID_PROTOCOLS.has(originProtocol)) {
    return jsonResponse({ error: `Unsupported originProtocol: ${originProtocol}` }, 400);
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

  const existingSymbol = await kvGetJson<{ coinAddress: string }>(
    env.CACHE,
    SYMBOL_INDEX_PREFIX + symbol.toLowerCase(),
  );
  if (existingSymbol) {
    return jsonResponse({ error: `Symbol $${symbol} is already taken` }, 409);
  }

  const creatorId = await getProtocolCreatorId(session, originProtocol, env);
  if (!creatorId) {
    return jsonResponse(
      {
        error: `No ${originProtocol} identity linked to this wallet. Link one at /api/identity/link`,
      },
      400,
    );
  }

  let deployResult: { coinAddress: string; tokenId: string };
  try {
    deployResult =
      chain === 'solana' || chain === 'solana_devnet'
        ? await deploySolanaToken(
            walletAddress,
            name,
            symbol,
            chain,
            { vestingDurationDays, creatorAllocationBps, cliffDays },
            { creatorFeeBps, platformFeeBps },
            env,
          )
        : await deployBaseCoin(
            walletAddress,
            name,
            symbol,
            chain,
            { vestingDurationDays, creatorAllocationBps, cliffDays },
            { creatorFeeBps, platformFeeBps },
            env,
          );
  } catch (err) {
    return jsonResponse({ error: `Deployment failed: ${String(err)}` }, 500);
  }

  const chainId = chain === 'solana' || chain === 'solana_devnet' ? SOLANA_CHAIN_ID : 8453;

  // Register cross-chain mapping
  try {
    const regKv = createKvAdapter(env.XCHAIN_REGISTRY || env.CACHE);
    const registry = createCrossChainRegistry(regKv);
    const now = Date.now();
    const mapping = {
      id: `${chainId}:${deployResult.coinAddress.toLowerCase()}:${chainId}:${deployResult.coinAddress.toLowerCase()}`,
      source: { chainId, protocol: originProtocol, creatorId, token: deployResult.coinAddress },
      target: { chainId, protocol: 'degenfeed', creatorId, token: deployResult.coinAddress },
      createdAt: now,
      verifiedBy: 'creator',
    };
    await registry.register(mapping);
  } catch (err) {
    console.warn('[cross-protocol-coin] Cross-chain registration warning:', String(err));
  }

  // Wrap for Zora
  let _zoraWrapper = { tokenId: deployResult.tokenId, success: false };
  try {
    const { wrapContentAsCreatorCoin } = await import('../../lib/zora-wrapper');
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
    if (wrapResult.ok) _zoraWrapper = { tokenId: deployResult.tokenId, success: true };
  } catch (err) {
    console.warn('[cross-protocol-coin] Zora wrap warning:', String(err));
  }

  // Announce on all connected protocols
  const degenfeedUrl = `${env.APP_BASE_URL || 'https://app.degenfeed.xyz'}/launch/${symbol}`;
  const explorerUrl =
    chain === 'solana' || chain === 'solana_devnet'
      ? `https://solscan.io/token/${deployResult.coinAddress}`
      : `https://basescan.org/token/${deployResult.coinAddress}`;

  const announcementResults: Record<string, unknown>[] = [];
  try {
    const { announceOnAllProtocols, resolveAnnouncementTargets } = await import(
      '../../lib/cross-protocol-announcer'
    );
    const targets = await resolveAnnouncementTargets(walletAddress, env);
    const hasOrigin = targets.some((t) => t.protocol === originProtocol);
    if (!hasOrigin && creatorId) {
      targets.push({ protocol: originProtocol, identity: creatorId });
    }
    if (targets.length > 0) {
      const allResults = await announceOnAllProtocols(
        {
          symbol,
          name,
          coinAddress: deployResult.coinAddress,
          chain,
          degenfeedUrl,
          explorerUrl,
          price: 'TBD',
          marketCap: 'TBD',
          creatorName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        },
        targets,
        env,
      );
      for (const r of allResults) announcementResults.push(r as Record<string, unknown>);
    }
  } catch (err) {
    console.warn('[cross-protocol-coin] Multi-protocol announcement warning:', String(err));
  }

  // Store coin record in KV
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
    zoraUrl: degenfeedUrl,
    degenfeedUrl,
    announcements: announcementResults,
    totalSupply: '0',
    price: '0',
    supporters: 0,
    totalTips: 0,
    totalTipsUsd: 0,
  };

  await kvPutJson(env.CACHE, COIN_PREFIX + deployResult.coinAddress.toLowerCase(), coinRecord);
  await kvPutJson(env.CACHE, SYMBOL_INDEX_PREFIX + symbol.toLowerCase(), {
    coinAddress: deployResult.coinAddress,
    chain,
    originProtocol,
    originCreatorId: creatorId,
  });

  return jsonResponse(
    {
      coinAddress: deployResult.coinAddress,
      chain,
      symbol,
      name,
      zoraUrl: degenfeedUrl,
      degenfeedUrl,
      announcements: announcementResults,
      crossChain: { registered: true, visibleOn: ['base', 'solana', 'zora', originProtocol] },
    },
    201,
  );
}

// ─── GET /api/coin/:symbol/cross-chain ──────────────────────────────────────

export async function handleCrossChainStatus(c: {
  req: { param: (s: string) => string };
  env: Env;
}): Promise<Response> {
  const env = c.env;
  const symbol = sanitizeString(c.req.param('symbol'), 32);
  if (!symbol) return jsonResponse({ error: 'Invalid symbol' }, 400);

  const symbolIndex = await kvGetJson<{
    coinAddress: string;
    chain: string;
    originProtocol: string;
    originCreatorId: string;
  }>(env.CACHE, SYMBOL_INDEX_PREFIX + symbol.toLowerCase());
  if (!symbolIndex) return jsonResponse({ error: 'Coin not found' }, 404);

  const coinKey = COIN_PREFIX + symbolIndex.coinAddress.toLowerCase();
  const coin = await kvGetJson<CrossProtocolCoinRecord>(env.CACHE, coinKey);

  let crossRefs: Record<string, unknown> = {};
  try {
    const regKv = createKvAdapter(env.XCHAIN_REGISTRY || env.CACHE);
    const registry = createCrossChainRegistry(regKv);
    const tokens = await registry.getCreatorTokens(
      symbolIndex.originProtocol,
      symbolIndex.originCreatorId,
    );
    const visibleOn = new Set<string>();
    for (const t of tokens) visibleOn.add(t.chain);
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
    crossRefs = { visibleOn: ['base', 'zora', symbolIndex.originProtocol] };
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
}

// ─── GET /api/coin/deploy/status ────────────────────────────────────────────

export async function handleDeployStatus(c: {
  req: { query: (s: string) => string | undefined };
  env: Env;
}): Promise<Response> {
  const env = c.env;
  const txHash = c.req.query('txHash');
  const creator = c.req.query('creator');

  if (!txHash && !creator) {
    return jsonResponse({ error: 'Provide txHash or creator query parameter' }, 400);
  }

  try {
    const { getDeployStatus } = await import('../../lib/coin-deployer');
    const result = await getDeployStatus(env, {
      txHash: txHash || undefined,
      creator: creator || undefined,
      limit: 10,
    });

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return noCacheJsonResponse({ found: false, deployments: [] });
    }

    return noCacheJsonResponse({ found: true, deployments: result });
  } catch (err) {
    console.warn('[cross-protocol-coin] Deploy status query failed:', String(err));
    return jsonResponse({ error: 'Failed to query deployment status' }, 500);
  }
}

// ─── GET /api/coin/deploy/monitor ──────────────────────────────────────────

export async function handleDeployMonitor(c: {
  req: { query: (s: string) => string | undefined };
  env: Env;
}): Promise<Response> {
  const env = c.env;
  const txHash = c.req.query('txHash');
  const chain = c.req.query('chain') || 'base';

  if (!txHash) {
    return jsonResponse({ error: 'txHash query parameter is required' }, 400);
  }

  try {
    let confirmations = 0;
    let status: 'pending' | 'confirmed' | 'failed' = 'pending';

    if (chain === 'base' || chain === 'base_sepolia') {
      const { createPublicClient, http } = await import('viem');
      const { base, baseSepolia } = await import('viem/chains');
      const isTestnet = chain === 'base_sepolia';
      const rpcUrl = isTestnet
        ? env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
        : env.BASE_RPC_URL || 'https://mainnet.base.org';

      const publicClient = createPublicClient({
        chain: isTestnet ? baseSepolia : base,
        transport: http(rpcUrl),
      });

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        confirmations = receipt.blockNumber
          ? Number((await publicClient.getBlockNumber()) - receipt.blockNumber)
          : 0;
        if (receipt.status === 'reverted') status = 'failed';
        else if (confirmations >= 1) status = 'confirmed';
      } catch {
        status = 'pending';
      }
    } else if (chain === 'solana' || chain === 'solana_devnet') {
      try {
        const solanaWeb3 = await import('@solana/web3.js');
        const isDevnet = chain === 'solana_devnet';
        const rpcUrl = isDevnet
          ? env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com'
          : env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

        const connection = new solanaWeb3.Connection(rpcUrl, 'confirmed');
        const sig = await connection.getSignatureStatus(txHash);

        if (sig?.value) {
          confirmations = sig.value.confirmations ?? 0;
          if (sig.value.err) status = 'failed';
          else if (
            sig.value.confirmationStatus === 'finalized' ||
            sig.value.confirmationStatus === 'confirmed'
          )
            status = 'confirmed';
        }
      } catch {
        status = 'pending';
      }
    }

    return noCacheJsonResponse({ txHash, chain, status, confirmations, timestamp: Date.now() });
  } catch (err) {
    console.warn('[cross-protocol-coin] Deploy monitor failed:', String(err));
    return jsonResponse({ error: 'Failed to check deployment status' }, 500);
  }
}

// ─── GET /api/coin/protocol/:protocol/:creatorId ───────────────────────────

export async function handleProtocolCoin(c: {
  req: { param: (s: string) => string };
  env: Env;
}): Promise<Response> {
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
}

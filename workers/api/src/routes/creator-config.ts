/**
 * /api/creator/config — Creator Coin Configuration & Cross-Chain Registry
 *
 * Creators control EVERY parameter of their coin:
 * - Vesting schedule (initial unlock, cliff, duration)
 * - Fee configuration (platform, creator, referral)
 * - Revenue recipients (splits)
 * - Cross-chain token registration (Base ↔ Solana ↔ Farcaster ↔ Lens)
 *
 * GET  /api/creator/config              — Get creator's full configuration
 * PUT  /api/creator/config/vesting      — Update vesting (before coin launch only)
 * PUT  /api/creator/config/fees         — Update fee configuration
 * POST /api/creator/config/cross-chain  — Register a cross-chain token mapping
 * GET  /api/creator/:id/tokens          — Get all creator tokens across chains
 * POST /api/creator/coin/farcaster      — Deploy a Farcaster creator coin
 * POST /api/creator/coin/lens           — Deploy a Lens creator coin
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { requireSession } from '../session';
import { jsonResponse, noCacheJsonResponse } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VestingConfig {
  initialUnlockBps: number;   // 0-3000 (0-30%)
  cliffDuration: number;      // seconds (0-7776000)
  vestingDuration: number;    // seconds (604800-63072000)
}

interface CreatorConfig {
  /** Wallet address of the creator */
  creatorAddress: string;
  /** Whether the creator has deployed a coin */
  hasDeployed: boolean;
  /** Current vesting config (settable before deployment) */
  vesting: VestingConfig | null;
  /** Creator fee in bps (0-200 = 0-2%) */
  feeBps: number;
  /** Revenue recipients */
  recipients: RevenueRecipient[];
  /** Platform fee override (null = use default 50 bps) */
  platformFeeBps: number | null;
  /** Registered cross-chain tokens */
  crossChainTokens: CrossChainMapping[];
  /** Farcaster FID if linked */
  farcasterFid: number | null;
  /** Lens profile ID if linked */
  lensProfileId: string | null;
}

interface RevenueRecipient {
  address: string;
  percentage: number;
  label: string;
}

interface CrossChainMapping {
  chainId: number;
  protocol: string;
  creatorId: string;
  tokenAddress: string;
  isOrigin: boolean;
}

interface CoinConfig {
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  supply: number;
  creatorAllocation: number;
  feeBps: number;
  revenueSplits: RevenueRecipient[];
  vestingConfig: VestingConfig;
}

// ─── Presets (must match packages/zora-sdk/src/vesting/types.ts) ─────────────

const VESTING_PRESETS: Record<string, { config: VestingConfig; minReputation: number }> = {
  trustless: {
    config: { initialUnlockBps: 0, cliffDuration: 2_592_000, vestingDuration: 7_776_000 },
    minReputation: 0,
  },
  balanced: {
    config: { initialUnlockBps: 500, cliffDuration: 604_800, vestingDuration: 5_184_000 },
    minReputation: 50,
  },
  community: {
    config: { initialUnlockBps: 1_000, cliffDuration: 0, vestingDuration: 2_592_000 },
    minReputation: 50,
  },
  fast: {
    config: { initialUnlockBps: 2_000, cliffDuration: 0, vestingDuration: 604_800 },
    minReputation: 90,
  },
};

// ─── KV Key Prefixes ────────────────────────────────────────────────────────

const CREATOR_CONFIG_PREFIX = 'creator:config:';
const CROSS_CHAIN_PREFIX = 'cross-chain:';

// ─── Router ─────────────────────────────────────────────────────────────────

const creatorConfig = new Hono<{ Bindings: Env }>();

// ─── Middleware ──────────────────────────────────────────────────────────────

async function requireCreatorAuth(c: any, env: Env): Promise<{ address: string } | Response> {
  const req = c.req.raw;
  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  const address = (session as any).walletAddress as string;
  if (!address) {
    return jsonResponse({ error: 'Wallet address not found in session' }, 401);
  }

  return { address };
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/creator/config — Get creator's full configuration
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.get('/config', async (c) => {
  const auth = await requireCreatorAuth(c, c.env);
  if (auth instanceof Response) return auth;

  const config = await getCreatorConfig(c.env, auth.address);

  return noCacheJsonResponse({ ok: true, config });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/creator/config/vesting — Update vesting (before coin launch only)
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.put('/config/vesting', async (c) => {
  const auth = await requireCreatorAuth(c, c.env);
  if (auth instanceof Response) return auth;

  let body: { presetId?: string; config?: VestingConfig };
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Get current config to check deployment status
  const config = await getCreatorConfig(c.env, auth.address);
  if (config.hasDeployed) {
    return jsonResponse({ error: 'Cannot change vesting after coin deployment — vesting is immutable on-chain' }, 400);
  }

  // Resolve vesting config
  let vestingConfig: VestingConfig;

  if (body.presetId) {
    const preset = VESTING_PRESETS[body.presetId];
    if (!preset) {
      return jsonResponse({ error: `Invalid preset: ${body.presetId}. Valid: ${Object.keys(VESTING_PRESETS).join(', ')}` }, 400);
    }
    vestingConfig = preset.config;
  } else if (body.config) {
    vestingConfig = body.config;
  } else {
    return jsonResponse({ error: 'Must provide presetId or config' }, 400);
  }

  // Get reputation for gating
  const repScore = await getCreatorReputation(c.env, auth.address);

  // Validate vesting config against reputation
  const validationErrors = validateVesting(vestingConfig, repScore);
  if (validationErrors.length > 0) {
    return jsonResponse({ error: 'Vesting config validation failed', details: validationErrors }, 400);
  }

  // Store the config
  const key = CREATOR_CONFIG_PREFIX + auth.address;
  const existing = await c.env.CACHE?.get(key, 'json').catch(() => null) as Partial<CreatorConfig> | null;

  const updated: Partial<CreatorConfig> = {
    ...(existing || {}),
    vesting: vestingConfig,
  };

  await c.env.CACHE?.put(key, JSON.stringify(updated), {
    expirationTtl: 60 * 60 * 24 * 365, // 1 year
  });

  return noCacheJsonResponse({
    ok: true,
    vesting: vestingConfig,
    message: 'Vesting configuration saved. This will be deployed immutably on-chain.',
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/creator/config/fees — Update fee configuration
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.put('/config/fees', async (c) => {
  const auth = await requireCreatorAuth(c, c.env);
  if (auth instanceof Response) return auth;

  let body: { feeBps?: number; recipients?: RevenueRecipient[]; platformFeeBps?: number };
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const config = await getCreatorConfig(c.env, auth.address);
  if (config.hasDeployed) {
    return jsonResponse({ error: 'Fee changes after deployment must use on-chain governance' }, 400);
  }

  // Validate fee
  if (body.feeBps !== undefined) {
    if (body.feeBps < 0 || body.feeBps > 200) {
      return jsonResponse({ error: 'Creator fee must be 0-200 bps (0-2%)' }, 400);
    }
  }

  // Validate recipients
  if (body.recipients) {
    const totalPct = body.recipients.reduce((s, r) => s + r.percentage, 0);
    if (totalPct > 100) {
      return jsonResponse({ error: 'Recipient percentages must sum to ≤ 100%' }, 400);
    }
    for (const r of body.recipients) {
      if (r.percentage < 0 || r.percentage > 100) {
        return jsonResponse({ error: `Invalid percentage for recipient ${r.label || r.address}` }, 400);
      }
    }
  }

  // Validate platform fee
  if (body.platformFeeBps !== undefined) {
    if (body.platformFeeBps < 0 || body.platformFeeBps > 200) {
      return jsonResponse({ error: 'Platform fee must be 0-200 bps (0-2%)' }, 400);
    }
  }

  // Store
  const key = CREATOR_CONFIG_PREFIX + auth.address;
  const existing = await c.env.CACHE?.get(key, 'json').catch(() => null) as Partial<CreatorConfig> | null;

  const updated: Partial<CreatorConfig> = {
    ...(existing || {}),
    ...(body.feeBps !== undefined ? { feeBps: body.feeBps } : {}),
    ...(body.recipients !== undefined ? { recipients: body.recipients } : {}),
    ...(body.platformFeeBps !== undefined ? { platformFeeBps: body.platformFeeBps } : {}),
  };

  await c.env.CACHE?.put(key, JSON.stringify(updated), {
    expirationTtl: 60 * 60 * 24 * 365,
  });

  return noCacheJsonResponse({ ok: true, message: 'Fee configuration saved' });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/creator/config/cross-chain — Register cross-chain token
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.post('/config/cross-chain', async (c) => {
  const auth = await requireCreatorAuth(c, c.env);
  if (auth instanceof Response) return auth;

  let body: {
    originChainId: number;
    originProtocol: string;
    originCreatorId: string;
    originToken: string;
    localToken: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.originProtocol || !body.originCreatorId || !body.localToken) {
    return jsonResponse({ error: 'originProtocol, originCreatorId, and localToken are required' }, 400);
  }

  if (!['base', 'solana', 'farcaster', 'lens', 'zora'].includes(body.originProtocol)) {
    return jsonResponse({ error: 'originProtocol must be: base, solana, farcaster, lens, or zora' }, 400);
  }

  // Store cross-chain mapping in KV
  const mappingKey = CROSS_CHAIN_PREFIX + `${body.originChainId}:${body.originProtocol}:${body.originCreatorId}`;
  const existingMappings = await c.env.CACHE?.get(mappingKey, 'json').catch(() => null) as CrossChainMapping[] | null;

  const newMapping: CrossChainMapping = {
    chainId: body.originChainId,
    protocol: body.originProtocol,
    creatorId: body.originCreatorId,
    tokenAddress: body.localToken,
    isOrigin: !existingMappings || existingMappings.length === 0,
  };

  const updatedMappings = [...(existingMappings || []), newMapping];
  await c.env.CACHE?.put(mappingKey, JSON.stringify(updatedMappings), {
    expirationTtl: 60 * 60 * 24 * 365,
  });

  // Also update creator config
  const configKey = CREATOR_CONFIG_PREFIX + auth.address;
  const config = await c.env.CACHE?.get(configKey, 'json').catch(() => null) as Partial<CreatorConfig> | null;
  const crossChainTokens = [...(config?.crossChainTokens || []), newMapping];
  await c.env.CACHE?.put(configKey, JSON.stringify({
    ...(config || {}),
    creatorAddress: auth.address,
    crossChainTokens,
  }), { expirationTtl: 60 * 60 * 24 * 365 });

  // In production, this would also call the CrossChainRegistry contract on-chain:
  // const registry = getContract({ address: CROSS_CHAIN_REGISTRY_ADDRESS, abi: CROSS_CHAIN_REGISTRY_ABI, client });
  // await registry.write.registerCrossChain([body.originChainId, body.originProtocol, body.originCreatorId, body.originToken || '0x0000000000000000000000000000000000000000', body.localToken]);

  return noCacheJsonResponse({
    ok: true,
    mapping: newMapping,
    message: `Registered ${body.originProtocol}:${body.originCreatorId} → ${body.localToken}`,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/creator/:id/tokens — Get all creator tokens across chains
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.get('/:id/tokens', async (c) => {
  const creatorId = c.req.param('id');

  // This could be a wallet address, Farcaster FID, or Lens profile ID
  // Search all cross-chain mappings for this creator

  const allMappings: Record<string, CrossChainMapping[]> = {};

  // Search by wallet address
  const walletKey = CREATOR_CONFIG_PREFIX + creatorId.toLowerCase();
  const walletConfig = await c.env.CACHE?.get(walletKey, 'json').catch(() => null) as Partial<CreatorConfig> | null;

  if (walletConfig?.crossChainTokens) {
    allMappings['base'] = walletConfig.crossChainTokens.filter((t) => t.protocol === 'base');
    allMappings['solana'] = walletConfig.crossChainTokens.filter((t) => t.protocol === 'solana');
  }

  // Search by Farcaster FID
  const fcKey = CROSS_CHAIN_PREFIX + `8453:farcaster:${creatorId}`;
  const fcMapping = await c.env.CACHE?.get(fcKey, 'json').catch(() => null) as CrossChainMapping[] | null;
  if (fcMapping) {
    allMappings['farcaster'] = fcMapping;
  }

  // Search by Lens profile ID
  const lensKey = CROSS_CHAIN_PREFIX + `8453:lens:${creatorId}`;
  const lensMapping = await c.env.CACHE?.get(lensKey, 'json').catch(() => null) as CrossChainMapping[] | null;
  if (lensMapping) {
    allMappings['lens'] = lensMapping;
  }

  return noCacheJsonResponse({
    ok: true,
    creatorId,
    tokens: allMappings,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/creator/coin/farcaster — Deploy a Farcaster creator coin
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.post('/coin/farcaster', async (c) => {
  const auth = await requireCreatorAuth(c, c.env);
  if (auth instanceof Response) return auth;

  let body: { fid: number; config: CoinConfig };
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.fid || !body.config) {
    return jsonResponse({ error: 'fid and config are required' }, 400);
  }

  // Validate Farcaster FID ownership
  const fidOwner = await verifyFarcasterFid(body.fid, c.env);
  if (fidOwner?.toLowerCase() !== auth.address.toLowerCase()) {
    return jsonResponse({ error: 'FID not owned by this wallet' }, 400);
  }

  // Validate vesting config
  const repScore = await getCreatorReputation(c.env, auth.address);
  const validationErrors = validateVesting(body.config.vestingConfig, repScore);
  if (validationErrors.length > 0) {
    return jsonResponse({ error: 'Vesting config validation failed', details: validationErrors }, 400);
  }

  // Deploy the coin on Base
  // In production, this would call the factory contract:
  // const factory = getContract({ address: FACTORY_ADDRESS, abi: FACTORY_ABI, client: walletClient });
  // const deployTx = await factory.write.createCoin([...body.config, vestingConfigStruct]);

  // Register in CrossChainRegistry
  // const registry = getContract({ address: REGISTRY_ADDRESS, abi: REGISTRY_ABI, client });
  // await registry.write.registerCrossChain([8453, 'farcaster', body.fid.toString(), '0x...', '0x...']);

  const mockAddress = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`;

  // Store Farcaster mapping
  const mappingKey = CROSS_CHAIN_PREFIX + `8453:farcaster:${body.fid}`;
  await c.env.CACHE?.put(mappingKey, JSON.stringify([{
    chainId: 8453,
    protocol: 'farcaster',
    creatorId: body.fid.toString(),
    tokenAddress: mockAddress,
    isOrigin: true,
  }]), { expirationTtl: 60 * 60 * 24 * 365 });

  return noCacheJsonResponse({
    ok: true,
    coinAddress: mockAddress,
    protocol: 'farcaster',
    creatorId: body.fid.toString(),
    message: `Farcaster creator coin deployed on Base. Registered as farcaster:${body.fid} in cross-chain registry.`,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/creator/coin/lens — Deploy a Lens creator coin
// ═════════════════════════════════════════════════════════════════════════════

creatorConfig.post('/coin/lens', async (c) => {
  const auth = await requireCreatorAuth(c, c.env);
  if (auth instanceof Response) return auth;

  let body: { profileId: string; config: CoinConfig };
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.profileId || !body.config) {
    return jsonResponse({ error: 'profileId and config are required' }, 400);
  }

  // Validate Lens profile ownership
  const profileOwner = await verifyLensProfile(body.profileId, c.env);
  if (profileOwner?.toLowerCase() !== auth.address.toLowerCase()) {
    return jsonResponse({ error: 'Lens profile not owned by this wallet' }, 400);
  }

  const repScore = await getCreatorReputation(c.env, auth.address);
  const validationErrors = validateVesting(body.config.vestingConfig, repScore);
  if (validationErrors.length > 0) {
    return jsonResponse({ error: 'Vesting config validation failed', details: validationErrors }, 400);
  }

  const mockAddress = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`;

  const mappingKey = CROSS_CHAIN_PREFIX + `8453:lens:${body.profileId}`;
  await c.env.CACHE?.put(mappingKey, JSON.stringify([{
    chainId: 8453,
    protocol: 'lens',
    creatorId: body.profileId,
    tokenAddress: mockAddress,
    isOrigin: true,
  }]), { expirationTtl: 60 * 60 * 24 * 365 });

  return noCacheJsonResponse({
    ok: true,
    coinAddress: mockAddress,
    protocol: 'lens',
    creatorId: body.profileId,
    message: `Lens creator coin deployed on Base. Registered as lens:${body.profileId} in cross-chain registry.`,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════

async function getCreatorConfig(env: Env, address: string): Promise<CreatorConfig> {
  const key = CREATOR_CONFIG_PREFIX + address.toLowerCase();
  const raw = await env.CACHE?.get(key, 'json').catch(() => null) as Partial<CreatorConfig> | null;

  return {
    creatorAddress: address,
    hasDeployed: raw?.hasDeployed ?? false,
    vesting: raw?.vesting ?? null,
    feeBps: raw?.feeBps ?? 100, // default 1%
    recipients: raw?.recipients ?? [],
    platformFeeBps: raw?.platformFeeBps ?? null,
    crossChainTokens: raw?.crossChainTokens ?? [],
    farcasterFid: raw?.farcasterFid ?? null,
    lensProfileId: raw?.lensProfileId ?? null,
    ...raw,
  };
}

async function getCreatorReputation(env: Env, address: string): Promise<number> {
  // In production, query the reputation service or rmi-backend
  // For now, return a default score
  try {
    const repKey = `reputation:${address.toLowerCase()}`;
    const raw = await env.CACHE?.get(repKey).catch(() => null);
    if (raw) return Number.parseInt(raw, 10);
  } catch {
    // Fall through
  }
  return 0; // Default: lowest reputation
}

async function verifyFarcasterFid(fid: number, env: Env): Promise<string | null> {
  // In production, query Neynar or the Farcaster hub to verify FID owner
  // For now, return a mock
  return null;
}

async function verifyLensProfile(profileId: string, env: Env): Promise<string | null> {
  // In production, query Lens API to verify profile owner
  return null;
}

function validateVesting(config: VestingConfig, repScore: number): string[] {
  const errors: string[] = [];

  if (config.initialUnlockBps < 0 || config.initialUnlockBps > 3000) {
    errors.push('Initial unlock must be 0-3000 bps (0-30%)');
  }

  if (config.cliffDuration < 0 || config.cliffDuration > 7_776_000) {
    errors.push('Cliff must be 0-7,776,000 seconds (0-90 days)');
  }

  if (config.vestingDuration < 604_800 || config.vestingDuration > 63_072_000) {
    errors.push('Vesting duration must be 604,800-63,072,000 seconds (7 days-2 years)');
  }

  // Reputation-based gating
  const availablePresets = Object.entries(VESTING_PRESETS).filter(
    ([_, p]) => repScore >= p.minReputation,
  );
  const mostLiberal = availablePresets[availablePresets.length - 1];
  if (mostLiberal) {
    const liberalConfig = mostLiberal[1].config;
    if (config.initialUnlockBps > liberalConfig.initialUnlockBps) {
      errors.push(`Initial unlock cannot exceed ${liberalConfig.initialUnlockBps} bps for your reputation (${repScore})`);
    }
    if (config.vestingDuration < liberalConfig.vestingDuration && config.cliffDuration < liberalConfig.cliffDuration) {
      // Custom config is more aggressive than available presets
      errors.push(`Vesting schedule is too aggressive for your reputation (${repScore}). Consider using presets.`);
    }
  }

  return errors;
}

// ═════════════════════════════════════════════════════════════════════════════
// Export
// ═════════════════════════════════════════════════════════════════════════════

export { creatorConfig };
export type { CreatorConfig, CoinConfig, VestingConfig, RevenueRecipient, CrossChainMapping };

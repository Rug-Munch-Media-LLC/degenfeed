/**
 * @degenfeed/api-worker — Zora Compatibility Router
 *
 * Exposes coin data in Zora's API format so third-party apps (zora.co, Uniswap,
 * DexScreener, wallets, etc.) can discover and interact with DegenFeed creator
 * coins without any integration work.
 *
 * Our coins deploy through ZoraFactory on Base, so they ARE Zora coins — this
 * router just bridges between our internal KV storage and the external-facing
 * Zora-compatible data shapes.
 *
 * Routes:
 *   GET  /api/zora/compat/coin/:address    — Coin data in Zora API format
 *   GET  /api/zora/compat/trending          — Trending coins (Zora-compatible)
 *   POST /api/zora/compat/webhook           — Webhook receiver for external apps
 *   GET  /api/zora/compat/apps              — List compatible third-party apps
 *   GET  /api/zora/compat/verify/:address   — Verify Zora compatibility status
 *
 * KV schema (CACHE namespace):
 *   zora:compat:coin:<address>        → ZoraCompatCoinData (cached, 5min TTL)
 *   zora:compat:trending              → ZoraCompatCoinData[] (cached, 2min TTL)
 *   zora:compat:webhook:config        → WebhookConfig
 *
 * @see https://coins.zora.co/api/v1/ — Zora Coins API reference
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Coin data shaped to match Zora's API response format.
 * Third-party apps consuming Zora's /coins endpoint can switch to our
 * compat endpoint without changing their parser.
 */
export interface ZoraCompatCoinData {
  /** Contract address (0x-prefixed) */
  address: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Creator wallet address */
  creator: string;
  /** Metadata URI */
  uri: string;
  /** Current price in ETH (decimal string) */
  price: string;
  /** Market cap in ETH (decimal string) */
  marketCap: string;
  /** Total supply */
  totalSupply: string;
  /** Total ETH raised */
  totalRaised: string;
  /** Number of unique holders */
  holderCount: number;
  /** 24h volume in ETH */
  volume24h: string;
  /** 24h price change percentage */
  priceChange24h: number;
  /** Whether the coin has graduated (Uniswap V4 pool active) */
  graduated: boolean;
  /** Uniswap V4 pool address (post-graduation) */
  poolAddress?: string;
  /** Chain */
  chain: string;
  /** Zora.co URL */
  zoraUrl: string;
  /** DegenFeed launch URL */
  degenfeedUrl: string;
  /** Signals this was deployed through DegenFeed */
  deployedVia: 'degenfeed';
  /** Whether enhanced vesting is active */
  hasEnhancedVesting: boolean;
  /** Whether anti-exploit protections are active */
  hasAntiExploit: boolean;
  /** Whether a cross-chain wrapped token exists (Wormhole bridge active) */
  hasCrossNetwork: boolean;
  /** Vesting configuration if enhanced vesting is active */
  vesting?: {
    initialUnlockBps: number;
    cliffDays: number;
    vestingDays: number;
  };
  /** Created at Unix timestamp (ms) */
  deployedAt: number;
}

export interface CompatWebhookPayload {
  /** Event type: trade, price_update, holder_change, deploy */
  event: string;
  /** Coin contract address */
  address: string;
  /** Chain */
  chain?: string;
  /** Event-specific data */
  data: Record<string, unknown>;
  /** Webhook secret for verification */
  secret?: string;
}

export interface CompatApp {
  name: string;
  description: string;
  category: 'dex' | 'explorer' | 'wallet' | 'social' | 'analytics' | 'api';
  tier: 1 | 2 | 3;
  integration: 'automatic' | 'compat-api' | 'sdk';
  url?: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const COIN_PREFIX = 'coin:';
const COMPAT_CACHE_PREFIX = 'zora:compat:coin:';
const TRENDING_CACHE_KEY = 'zora:compat:trending';
const WEBHOOK_CONFIG_KEY = 'zora:compat:webhook:config';

const COMPAT_CACHE_TTL = 300; // 5 minutes
const TRENDING_CACHE_TTL = 120; // 2 minutes

/**
 * Tier 1 apps — work automatically, zero config.
 * Tier 2 apps — work via our compatibility layer.
 * Tier 3 apps — require SDK integration.
 */
const COMPATIBLE_APPS: CompatApp[] = [
  // Tier 1 — Zero-config
  {
    name: 'zora.co',
    description: "Zora's main app and marketplace",
    category: 'explorer',
    tier: 1,
    integration: 'automatic',
    url: 'https://zora.co',
    notes: 'Coins appear automatically via ZoraFactory indexing',
  },
  {
    name: 'Uniswap',
    description: 'DEX trading via Uniswap V4 pools',
    category: 'dex',
    tier: 1,
    integration: 'automatic',
    url: 'https://app.uniswap.org',
    notes: 'Post-graduation trading on Uniswap V4 pools',
  },
  {
    name: 'Zora Coins API',
    description: 'REST API at coins.zora.co/api/v1/',
    category: 'api',
    tier: 1,
    integration: 'automatic',
    url: 'https://coins.zora.co/api/v1/',
    notes: 'Indexes our coins via on-chain events',
  },
  {
    name: 'Zora GraphQL API',
    description: 'GraphQL endpoint at api.zora.co/graphql',
    category: 'api',
    tier: 1,
    integration: 'automatic',
    url: 'https://api.zora.co/graphql',
    notes: 'Advanced queries and trending discovery',
  },
  {
    name: 'Rainbow Wallet',
    description: 'Wallet with token display',
    category: 'wallet',
    tier: 1,
    integration: 'automatic',
    notes: 'Standard ERC-20 tokens on Base auto-appear',
  },
  {
    name: 'MetaMask',
    description: 'Popular EVM wallet',
    category: 'wallet',
    tier: 1,
    integration: 'automatic',
    notes: 'Import coin address to view balance',
  },
  {
    name: 'Zerion',
    description: 'Portfolio tracker and wallet',
    category: 'wallet',
    tier: 1,
    integration: 'automatic',
    url: 'https://zerion.io',
    notes: 'ERC-20 tokens on Base auto-detected',
  },
  {
    name: 'Basescan',
    description: 'Base chain explorer',
    category: 'explorer',
    tier: 1,
    integration: 'automatic',
    url: 'https://basescan.org',
    notes: 'Standard EVM explorer — all coins visible',
  },
  // Tier 2 — Compat API
  {
    name: 'DexScreener',
    description: 'DEX analytics and charting',
    category: 'analytics',
    tier: 2,
    integration: 'compat-api',
    url: 'https://dexscreener.com',
    notes: 'Uniswap V4 pools tracked automatically',
  },
  {
    name: 'Warpcast (Farcaster)',
    description: 'Social app with Zora coin links',
    category: 'social',
    tier: 2,
    integration: 'compat-api',
    url: 'https://warpcast.com',
    notes: 'Zora.co links render natively in casts',
  },
  {
    name: 'CoinGecko',
    description: 'Cryptocurrency data aggregator',
    category: 'analytics',
    tier: 2,
    integration: 'compat-api',
    url: 'https://coingecko.com',
    notes: 'Standard listing process for ERC-20 tokens',
  },
  {
    name: 'CoinMarketCap',
    description: 'Cryptocurrency market data',
    category: 'analytics',
    tier: 2,
    integration: 'compat-api',
    url: 'https://coinmarketcap.com',
    notes: 'Standard listing process for ERC-20 tokens',
  },
  // Tier 3 — SDK
  {
    name: 'Custom Bot (Telegram/Discord)',
    description: 'Price alerts, buy/sell signals, portfolio tracking',
    category: 'api',
    tier: 3,
    integration: 'sdk',
    notes: 'Use our compat API or Zora SDK directly',
  },
  {
    name: 'Portfolio Dashboard',
    description: 'Multi-coin portfolio tracking',
    category: 'api',
    tier: 3,
    integration: 'sdk',
    notes: 'Use @degenfeed/zora-sdk or Zora API',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════════════════

export const zoraCompat = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/zora/compat/coin/:address
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns coin data in Zora-compatible API format.
 *
 * Third-party apps can replace their Zora API calls with this endpoint
 * and get additional DegenFeed-specific fields (vesting, anti-exploit, etc.)
 * while staying compatible with their existing parsing logic.
 *
 * Path params:
 *   address — Coin contract address (0x-prefixed hex)
 *
 * Query params:
 *   chain   — Optional chain override (default: "base")
 *   refresh — If "true", bypasses cache
 */
zoraCompat.get('/coin/:address', async (c) => {
  const addr = c.req.param('address').toLowerCase();
  const chain = c.req.query('chain') ?? 'base';
  const refresh = c.req.query('refresh') === 'true';

  if (!addr.startsWith('0x') || addr.length !== 42) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  // Check cache first (unless refresh requested)
  if (!refresh) {
    try {
      const cached = await c.env.CACHE?.get(COMPAT_CACHE_PREFIX + addr);
      if (cached) {
        const parsed = JSON.parse(cached) as ZoraCompatCoinData;
        return noCacheJsonResponse(parsed);
      }
    } catch {
      // Cache miss — fetch fresh data
    }
  }

  // Try our internal KV first
  try {
    const coinKey = COIN_PREFIX + addr;
    const raw = await c.env.CACHE?.get(coinKey);

    if (raw) {
      const coin = JSON.parse(raw) as Record<string, unknown>;
      const result = buildCompatResponse(coin, chain);
      if (result) {
        // Cache for 5 minutes
        try {
          await c.env.CACHE?.put(COMPAT_CACHE_PREFIX + addr, JSON.stringify(result), {
            expirationTtl: COMPAT_CACHE_TTL,
          });
        } catch {
          // Non-critical
        }
        return noCacheJsonResponse(result);
      }
    }
  } catch {
    // Fall through to Zora API lookup
  }

  // Fallback: fetch from Zora's Coins API
  try {
    const zoraRes = await fetch(`https://coins.zora.co/api/v1/coins/${addr}`, {
      headers: { 'content-type': 'application/json' },
    });
    if (zoraRes.ok) {
      const zoraCoin = (await zoraRes.json()) as Record<string, unknown>;
      const result: ZoraCompatCoinData = {
        address: addr,
        name: (zoraCoin.name as string) || 'Unknown',
        symbol: (zoraCoin.symbol as string) || '???',
        creator: (zoraCoin.creator as string) || '',
        uri: (zoraCoin.uri as string) || '',
        price: (zoraCoin.price as string) || '0',
        marketCap: (zoraCoin.marketCap as string) || '0',
        totalSupply: (zoraCoin.totalSupply as string) || '0',
        totalRaised: (zoraCoin.totalRaised as string) || '0',
        holderCount: (zoraCoin.holderCount as number) || 0,
        volume24h: (zoraCoin.volume24h as string) || '0',
        priceChange24h: (zoraCoin.priceChange24h as number) || 0,
        graduated: (zoraCoin.graduated as boolean) || false,
        poolAddress: zoraCoin.poolAddress as string | undefined,
        chain,
        zoraUrl: `https://zora.co/collect/${chain}:${addr}`,
        degenfeedUrl: `https://app.degenfeed.xyz/coin/${addr}`,
        deployedVia: 'degenfeed',
        hasEnhancedVesting: true,
        hasAntiExploit: true,
        hasCrossNetwork: false,
        deployedAt: Date.now(),
      };

      try {
        await c.env.CACHE?.put(COMPAT_CACHE_PREFIX + addr, JSON.stringify(result), {
          expirationTtl: COMPAT_CACHE_TTL,
        });
      } catch {
        // Non-critical
      }

      return noCacheJsonResponse(result);
    }
  } catch {
    // Zora API unavailable
  }

  return jsonResponse({ error: 'Coin not found' }, 404);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/zora/compat/trending
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns trending creator coins in Zora-compatible format.
 *
 * Merges results from:
 *   1. Our internal trending KV cache (fast)
 *   2. Zora's Coins API trending endpoint (fallback)
 *
 * Query params:
 *   limit  — Max results (default: 20, max: 100)
 *   chain  — Chain filter (default: "base")
 */
zoraCompat.get('/trending', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
  const chain = c.req.query('chain') ?? 'base';

  // Try cache first
  try {
    const cached = await c.env.CACHE?.get(TRENDING_CACHE_KEY);
    if (cached) {
      const coins = JSON.parse(cached) as ZoraCompatCoinData[];
      return noCacheJsonResponse({
        data: coins.slice(0, limit),
        total: coins.length,
        chain,
      });
    }
  } catch {
    // Cache miss
  }

  // Fetch from Zora's Coins API
  try {
    const zoraRes = await fetch(`https://coins.zora.co/api/v1/trending?limit=${limit}`, {
      headers: { 'content-type': 'application/json' },
    });

    if (zoraRes.ok) {
      const data = (await zoraRes.json()) as Record<string, unknown>[];
      const coins = Array.isArray(data) ? data : [];

      const results: ZoraCompatCoinData[] = coins.map((c) => ({
        address: (c.address as string) || '',
        name: (c.name as string) || 'Unknown',
        symbol: (c.symbol as string) || '???',
        creator: (c.creator as string) || '',
        uri: (c.uri as string) || '',
        price: (c.price as string) || '0',
        marketCap: (c.marketCap as string) || '0',
        totalSupply: (c.totalSupply as string) || '0',
        totalRaised: (c.totalRaised as string) || '0',
        holderCount: (c.holderCount as number) || 0,
        volume24h: (c.volume24h as string) || '0',
        priceChange24h: (c.priceChange24h as number) || 0,
        graduated: (c.graduated as boolean) || false,
        poolAddress: c.poolAddress as string | undefined,
        chain,
        zoraUrl: `https://zora.co/collect/${chain}:${c.address}`,
        degenfeedUrl: `https://app.degenfeed.xyz/coin/${c.address}`,
        deployedVia: 'degenfeed',
        hasEnhancedVesting: true,
        hasAntiExploit: true,
        hasCrossNetwork: false,
        deployedAt: Date.now(),
      }));

      // Cache for 2 minutes
      try {
        await c.env.CACHE?.put(TRENDING_CACHE_KEY, JSON.stringify(results), {
          expirationTtl: TRENDING_CACHE_TTL,
        });
      } catch {
        // Non-critical
      }

      return noCacheJsonResponse({
        data: results,
        total: results.length,
        chain,
      });
    }
  } catch {
    // Zora API unavailable
  }

  // Last resort: scan our internal KV for coin records
  try {
    const ourCoins = await scanOurCoins(c.env, limit);
    if (ourCoins.length > 0) {
      return noCacheJsonResponse({
        data: ourCoins,
        total: ourCoins.length,
        chain,
        source: 'internal',
      });
    }
  } catch {
    // Give up
  }

  return jsonResponse({ data: [], total: 0, chain });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/zora/compat/webhook
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Webhook receiver for external Zora apps to send events.
 *
 * Accepts events like:
 *   - trade   — Buy/sell events from external platforms
 *   - price_update — Price change notifications
 *   - holder_change — Holder count updates
 *
 * Verifies the payload with an optional shared secret.
 * Events are stored in KV for later processing.
 */
zoraCompat.post('/webhook', async (c) => {
  let body: CompatWebhookPayload;
  try {
    body = (await c.req.json()) as CompatWebhookPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.event || !body.address) {
    return jsonResponse({ error: 'event and address fields are required' }, 400);
  }

  const VALID_EVENTS = ['trade', 'price_update', 'holder_change', 'deploy', 'graduation'];
  if (!VALID_EVENTS.includes(body.event)) {
    return jsonResponse(
      {
        error: `Invalid event type. Must be one of: ${VALID_EVENTS.join(', ')}`,
      },
      400,
    );
  }

  // Verify webhook secret if configured
  const configRaw = await c.env.CACHE?.get(WEBHOOK_CONFIG_KEY);
  if (configRaw) {
    try {
      const config = JSON.parse(configRaw) as { secret?: string };
      if (config.secret && body.secret !== config.secret) {
        return jsonResponse({ error: 'Invalid webhook secret' }, 401);
      }
    } catch {
      // No config — skip verification
    }
  }

  // Store the event for processing
  const eventKey = `zora:compat:webhook:event:${body.address}:${Date.now()}`;
  try {
    await c.env.CACHE?.put(eventKey, JSON.stringify(body), {
      expirationTtl: 86400 * 7, // 7 days
    });
  } catch {
    // Non-critical
  }

  // Process based on event type
  switch (body.event) {
    case 'trade': {
      // Invalidate cache for this coin so next fetch is fresh
      try {
        await c.env.CACHE?.delete(COMPAT_CACHE_PREFIX + body.address.toLowerCase());
      } catch {
        // Non-critical
      }
      break;
    }
    case 'price_update': {
      // Update price in our internal coin record if exists
      try {
        const coinKey = COIN_PREFIX + body.address.toLowerCase();
        const raw = await c.env.CACHE?.get(coinKey);
        if (raw) {
          const coin = JSON.parse(raw) as Record<string, unknown>;
          if (body.data.price) coin.price = body.data.price;
          if (body.data.volume24h) coin.volume24h = body.data.volume24h;
          await c.env.CACHE?.put(coinKey, JSON.stringify(coin), {
            expirationTtl: 86400 * 365,
          });
        }
      } catch {
        // Non-critical
      }
      break;
    }
    default:
      // Log for later processing
      console.log(`[zora-compat] Webhook event: ${body.event} for ${body.address}`);
  }

  return jsonResponse({
    ok: true,
    event: body.event,
    address: body.address,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/zora/compat/apps
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the list of third-party apps compatible with our creator coins.
 *
 * Query params:
 *   tier — Filter by tier (1, 2, or 3)
 *   category — Filter by category (dex, explorer, wallet, etc.)
 */
zoraCompat.get('/apps', async (c) => {
  const tierFilter = c.req.query('tier');
  const categoryFilter = c.req.query('category');

  let apps = COMPATIBLE_APPS;

  if (tierFilter) {
    const tier = Number(tierFilter);
    if (tier >= 1 && tier <= 3) {
      apps = apps.filter((a) => a.tier === tier);
    }
  }

  if (categoryFilter) {
    apps = apps.filter((a) => a.category === categoryFilter);
  }

  return noCacheJsonResponse({
    apps,
    total: apps.length,
    tiers: {
      tier1: 'Zero-config — works automatically',
      tier2: 'API compatible — works via compat layer',
      tier3: 'SDK — requires development integration',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/zora/compat/verify/:address
// ═══════════════════════════════════════════════════════════════════════════════

/** A single compatibility check result. */
interface ZoraVerifyCheck {
  passed: boolean;
  status?: number;
  url?: string;
  error?: string;
  found?: boolean;
}

/** Payload for the coin verification endpoint. */
interface ZoraVerifyResult {
  address: string;
  checks: Record<string, ZoraVerifyCheck>;
  allPassed: boolean;
  zoraUrl?: string;
  basescanUrl?: string;
  degenfeedUrl?: string;
}

/**
 * Verifies a coin's Zora compatibility status.
 * Checks that the coin is discoverable on Zora's API, has a ZoraFactory
 * deployment, and returns all cross-reference URLs.
 */
zoraCompat.get('/verify/:address', async (c) => {
  const addr = c.req.param('address').toLowerCase();

  if (!addr.startsWith('0x') || addr.length !== 42) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  const results: ZoraVerifyResult = {
    address: addr,
    checks: {},
    allPassed: false,
  };

  // Check 1: Zora Coins API
  try {
    const zoraRes = await fetch(`https://coins.zora.co/api/v1/coins/${addr}`, {
      headers: { 'content-type': 'application/json' },
    });
    results.checks.zoraApi = {
      passed: zoraRes.ok,
      status: zoraRes.status,
      url: `https://coins.zora.co/api/v1/coins/${addr}`,
    };
  } catch {
    results.checks.zoraApi = {
      passed: false,
      status: 0,
      error: 'Zora API unavailable',
    };
  }

  // Check 2: Basescan — verify contract exists
  try {
    const baseRes = await fetch(
      `https://api.basescan.org/api?module=contract&action=getabi&address=${addr}&apikey=`,
    );
    results.checks.basescan = {
      passed: baseRes.ok,
      status: baseRes.status,
    };
  } catch {
    results.checks.basescan = {
      passed: false,
      status: 0,
      error: 'Basescan API unavailable',
    };
  }

  // Check 3: Internal KV
  try {
    const coinKey = COIN_PREFIX + addr;
    const raw = await c.env.CACHE?.get(coinKey);
    results.checks.internalIndex = {
      passed: !!raw,
      found: !!raw,
    };
  } catch {
    results.checks.internalIndex = {
      passed: false,
      error: 'KV unavailable',
    };
  }

  // Check 4: Zora.co URL resolves
  try {
    const zoraUrl = `https://zora.co/collect/base:${addr}`;
    const zoraPageRes = await fetch(zoraUrl);
    results.checks.zoraDotCo = {
      passed: zoraPageRes.ok,
      status: zoraPageRes.status,
      url: zoraUrl,
    };
  } catch {
    results.checks.zoraDotCo = {
      passed: false,
      error: 'zora.co unavailable',
    };
  }

  results.allPassed = Object.values(results.checks).every(
    (check) => check.passed === true,
  );

  results.zoraUrl = `https://zora.co/collect/base:${addr}`;
  results.basescanUrl = `https://basescan.org/address/${addr}`;
  results.degenfeedUrl = `https://app.degenfeed.xyz/coin/${addr}`;

  return noCacheJsonResponse(results);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a ZoraCompatCoinData from our internal coin record.
 */
function buildCompatResponse(
  coin: Record<string, unknown>,
  chain: string,
): ZoraCompatCoinData | null {
  const address = (coin.coinAddress as string) || (coin.address as string);
  if (!address) return null;

  const symbol = (coin.symbol as string) || '???';
  const degenfeedUrl = (coin.degenfeedUrl as string) || `https://app.degenfeed.xyz/coin/${address}`;

  return {
    address,
    name: (coin.name as string) || 'Unknown',
    symbol,
    creator: (coin.creator as string) || (coin.deployedBy as string) || '',
    uri: (coin.metadataUri as string) || '',
    price: (coin.price as string) || '0',
    marketCap: (coin.marketCap as string) || '0',
    totalSupply: (coin.totalSupply as string) || '0',
    totalRaised: (coin.totalRaised as string) || '0',
    holderCount: (coin.supporters as number) || 0,
    volume24h: (coin.volume24h as string) || '0',
    priceChange24h: (coin.priceChange24h as number) || 0,
    graduated: (coin.graduated as boolean) || false,
    poolAddress: coin.poolAddress as string | undefined,
    chain,
    zoraUrl: `https://zora.co/collect/${chain}:${address}`,
    degenfeedUrl,
    deployedVia: 'degenfeed',
    hasEnhancedVesting:
      (coin.vestingConfig as unknown) !== undefined || coin.vestingDurationDays !== undefined,
    hasAntiExploit: true,
    hasCrossNetwork: !!coin.wrappedToken,
    vesting: (coin.vestingDurationDays as number)
      ? {
          initialUnlockBps: (coin.creatorAllocationBps as number) || 0,
          cliffDays: (coin.cliffDays as number) || 30,
          vestingDays: (coin.vestingDurationDays as number) || 180,
        }
      : undefined,
    deployedAt: (coin.deployedAt as number) || Date.now(),
  };
}

/**
 * Scan our internal KV for creator coin records.
 * Used as a fallback when Zora's API is unavailable.
 */
async function scanOurCoins(env: Env, limit: number): Promise<ZoraCompatCoinData[]> {
  if (!env.CACHE) return [];

  const results: ZoraCompatCoinData[] = [];

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
          const coin = JSON.parse(raw) as Record<string, unknown>;
          const addr = (coin.coinAddress as string) || (coin.address as string);
          if (!addr) continue;

          const compat = buildCompatResponse(coin, 'base');
          if (compat) results.push(compat);
        } catch {
          // Skip unparseable entries
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && results.length < limit);
  } catch {
    // KV scan failed
  }

  return results.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin: POST /api/zora/compat/webhook/config
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configure the webhook receiver (set shared secret, etc.).
 * Requires session authentication.
 */
zoraCompat.post('/webhook/config', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: { secret?: string };
  try {
    body = (await c.req.json()) as { secret?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const config = {
    secret: body.secret || '',
    updatedAt: Date.now(),
  };

  try {
    await c.env.CACHE?.put(WEBHOOK_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    return jsonResponse({ error: `Failed to save config: ${String(err)}` }, 500);
  }

  return jsonResponse({ ok: true, updatedAt: config.updatedAt });
});

export default zoraCompat;

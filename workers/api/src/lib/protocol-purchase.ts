/**
 * @degenfeed/api-worker — Multi-Protocol Purchase System
 *
 * Buy creator coins from ANY protocol. All purchases route through
 * DegenFeed's unified tipping/payment system.
 *
 * Protocol-specific purchase methods:
 *   - Nostr: NIP-57 zap → converts to coin purchase
 *   - Farcaster: frame with buy button → POST to purchase endpoint
 *   - Bluesky: link → DegenFeed buy page → purchase
 *   - Mastodon: toot with buy link → DegenFeed buy page
 *   - Lens: publication with collect module → collect triggers purchase
 *   - Telegram: bot command `/buy $TICKER` → purchase
 *   - Discord: slash command `/buy $TICKER` → purchase
 */

import type { Env } from '../index';
import { recordHolderPurchase, resolveWalletFromProtocol } from './cross-protocol-holder';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PurchaseRequest {
  /** Coin symbol or address */
  coinId: string;
  /** Amount to spend in smallest unit (wei/lamports/sats) */
  amountIn: string;
  /** Minimum tokens to receive (slippage protection) */
  minTokensOut?: string;
  /** Buyer identifier on the source protocol */
  buyerProtocol: string;
  buyerIdentity: string;
  /** Destination chain */
  chain: 'base' | 'base_sepolia' | 'solana' | 'solana_devnet';
  /** Referrer (optional) */
  referrer?: string;
}

export interface PurchaseResult {
  ok: boolean;
  txHash?: string;
  coinAddress?: string;
  tokensReceived?: string;
  totalUsd?: number;
  explorerUrl?: string;
  error?: string;
}

export interface ProtocolPurchaseQuote {
  coinAddress: string;
  symbol: string;
  name: string;
  amountIn: string;
  estimatedTokensOut: string;
  price: string;
  totalUsd: number;
  platformFee: string;
  chain: string;
  expiresAt: number;
}

// ─── Unified Purchase Handler ──────────────────────────────────────────

/**
 * Process a purchase from ANY protocol.
 * Routes through the appropriate chain handler.
 */
export async function processProtocolPurchase(
  req: PurchaseRequest,
  env: Env,
): Promise<PurchaseResult> {
  try {
    // 1. Resolve coin address from symbol
    const coinAddress = await resolveCoinAddress(req.coinId, env);
    if (!coinAddress) {
      return { ok: false, error: `Coin not found: ${req.coinId}` };
    }

    // 2. Resolve buyer wallet from protocol identity
    const buyerWallet = await resolveWalletFromProtocol(req.buyerProtocol, req.buyerIdentity, env);
    if (!buyerWallet) {
      return { ok: false, error: `No wallet linked to ${req.buyerProtocol}:${req.buyerIdentity}` };
    }

    // 3. Route to chain-specific purchase handler
    const { deployCoin } = await import('./coin-deployer');

    // For now, use the tip system as a unified purchase endpoint
    const result = await executeTrade({
      buyer: buyerWallet,
      coinAddress,
      amountIn: req.amountIn,
      minTokensOut: req.minTokensOut,
      chain: req.chain,
      env,
    });

    // 4. Record the holder for cross-protocol identity
    if (result.ok && result.txHash) {
      await recordHolderPurchase(
        buyerWallet,
        coinAddress,
        result.tokensReceived || '0',
        result.totalUsd || 0,
        0, // supplyPercent — computed elsewhere
        [req.buyerProtocol],
        env,
      );
    }

    return result;
  } catch (err) {
    return { ok: false, error: `Purchase failed: ${String(err)}` };
  }
}

// ─── Nostr NIP-57 Zap Purchase ─────────────────────────────────────────

/**
 * Process a NIP-57 zap invoice as a coin purchase.
 * The zap amount is converted to a coin buy on DegenFeed.
 */
export async function processNostrZapPurchase(
  zapInvoice: {
    zapRequest: {
      pubkey: string;
      content: string;
      tags: string[][];
      created_at: number;
    };
    amount: number; // in millisats
    preimage: string;
  },
  env: Env,
): Promise<PurchaseResult> {
  // Parse the zap content for a coin symbol
  const content = zapInvoice.zapRequest.content || '';
  const match = content.match(/\$([A-Za-z0-9]{2,10})/);
  const symbol = match?.[1]?.toUpperCase();

  if (!symbol) {
    // General tip — not a coin purchase
    return { ok: false, error: 'No coin symbol found in zap content. Use /$TICKER' };
  }

  // Convert millisats to appropriate chain units
  const amountIn = String(Math.floor(zapInvoice.amount * 1000)); // convert to smallest unit approximation

  return processProtocolPurchase(
    {
      coinId: symbol,
      amountIn,
      buyerProtocol: 'nostr',
      buyerIdentity: zapInvoice.zapRequest.pubkey,
      chain: 'base',
    },
    env,
  );
}

// ─── Farcaster Frame Purchase ──────────────────────────────────────────

/**
 * Process a purchase from a Farcaster frame interaction.
 */
export async function processFarcasterFramePurchase(
  frameData: {
    fid: number;
    castId: { fid: number; hash: string };
    buttonIndex: number;
    inputText?: string;
    state?: string;
  },
  env: Env,
): Promise<PurchaseResult> {
  // Parse coin symbol from state or input
  const state = frameData.state ? JSON.parse(frameData.state) : {};
  const symbol = state.symbol || frameData.inputText?.toUpperCase();

  if (!symbol) {
    return { ok: false, error: 'No coin symbol provided' };
  }

  // Default amount: $1 worth
  const amountIn = state.amountIn || '1000000000000000000'; // 1 ETH in wei

  return processProtocolPurchase(
    {
      coinId: symbol,
      amountIn,
      buyerProtocol: 'farcaster',
      buyerIdentity: String(frameData.fid),
      chain: 'base',
    },
    env,
  );
}

// ─── Telegram Bot Purchase ─────────────────────────────────────────────

/**
 * Handle a Telegram /buy command.
 */
export async function processTelegramPurchase(
  symbol: string,
  userId: string,
  chatId: string,
  amountIn?: string,
  env?: Env,
): Promise<PurchaseResult> {
  if (!env) return { ok: false, error: 'Environment not available' };

  return processProtocolPurchase(
    {
      coinId: symbol.toUpperCase(),
      amountIn: amountIn || '1000000000000000000', // default $1
      buyerProtocol: 'telegram',
      buyerIdentity: userId,
      chain: 'base',
    },
    env,
  );
}

// ─── Price Quotes ──────────────────────────────────────────────────────

/**
 * Get a purchase quote for a coin from any protocol.
 */
export async function getProtocolPurchaseQuote(
  coinId: string,
  amountIn: string,
  chain: string,
  env: Env,
): Promise<ProtocolPurchaseQuote | null> {
  try {
    const coinAddress = await resolveCoinAddress(coinId, env);
    if (!coinAddress) return null;

    // Get coin info from KV
    const coinKey = `coin:${coinAddress.toLowerCase()}`;
    const raw = await env.CACHE?.get(coinKey);
    if (!raw) return null;

    const coin = JSON.parse(raw) as Record<string, unknown>;

    // Estimate tokens out from bonding curve
    const { calculateTokensOut } = await import('@degenfeed/creator-coin');
    const estimatedTokens = calculateTokensOut(
      BigInt(amountIn),
      BigInt(String(coin.currentPrice || '0')),
    );

    const platformFeeBps = 50; // 0.5%
    const platformFee = String((BigInt(amountIn) * BigInt(platformFeeBps)) / BigInt(10000));

    return {
      coinAddress: coinAddress,
      symbol: String(coin.symbol || coinId),
      name: String(coin.name || ''),
      amountIn,
      estimatedTokensOut: String(estimatedTokens),
      price: String(coin.price || '0'),
      totalUsd: (Number(coin.priceUsd || 0) * Number(amountIn)) / 1e18,
      platformFee,
      chain,
      expiresAt: Date.now() + 30_000, // 30 second quote
    };
  } catch (err) {
    console.warn('[protocol-purchase] Quote failed:', String(err));
    return null;
  }
}

// ─── Internal trade execution ─────────────────────────────────────────

interface TradeInput {
  buyer: string;
  coinAddress: string;
  amountIn: string;
  minTokensOut?: string;
  chain: string;
  env: Env;
}

async function executeTrade(input: TradeInput): Promise<PurchaseResult> {
  try {
    const chain = input.chain as 'base' | 'solana';
    const { CreatorCoinClient } = await import('@degenfeed/creator-coin');

    const client = new CreatorCoinClient({
      evmPrivateKey: input.env.PREMIUM_WALLET_KEY as `0x${string}` | undefined,
      baseRpcUrl: input.env.BASE_RPC_URL || 'https://mainnet.base.org',
    });

    const result = await client.buy(
      {
        tokenAddress: input.coinAddress as `0x${string}`,
        amountIn: BigInt(input.amountIn),
        minTokensOut: input.minTokensOut ? BigInt(input.minTokensOut) : BigInt(0),
      },
      chain,
    );

    return {
      ok: true,
      txHash: result.txHash,
      coinAddress: input.coinAddress,
      tokensReceived: result.tokensAmount,
      totalUsd: result.nativeAmount ? Number(result.nativeAmount) : 0,
      explorerUrl: result.explorerUrl,
    };
  } catch (err) {
    return { ok: false, error: `Trade failed: ${String(err)}` };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

async function resolveCoinAddress(coinId: string, env: Env): Promise<string | null> {
  if (!env.CACHE) return null;

  // If it looks like an address, return it directly
  if (/^0x[a-fA-F0-9]{40}$/.test(coinId) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(coinId)) {
    return coinId;
  }

  // Look up by symbol
  try {
    const symbolKey = `coin:symbol:${coinId.toLowerCase()}`;
    const raw = await env.CACHE.get(symbolKey);
    if (!raw) return null;
    const index = JSON.parse(raw) as { coinAddress: string };
    return index.coinAddress;
  } catch {
    return null;
  }
}

// ─── Purchase validation ───────────────────────────────────────────────

export function validatePurchaseAmount(amount: string, chain: string): string | null {
  const num = BigInt(amount);
  if (num <= 0n) return 'Amount must be positive';

  switch (chain) {
    case 'base':
    case 'base_sepolia':
      if (num < 1000000000000000n) return 'Minimum purchase: 0.001 ETH (1000000000000000 wei)';
      if (num > 100000000000000000000n) return 'Maximum purchase: 100 ETH';
      break;
    case 'solana':
    case 'solana_devnet':
      if (num < 1000n) return 'Minimum purchase: 0.000001 SOL (1000 lamports)';
      if (num > 10000000000000n) return 'Maximum purchase: 10000 SOL';
      break;
  }

  return null;
}

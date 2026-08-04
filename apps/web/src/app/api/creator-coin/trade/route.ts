import { NextResponse } from 'next/server';
import {
  evmClientFromEnv,
  isValidEvmAddress,
  isValidSolanaAddress,
  solanaClientFromEnv,
} from '../lib';

/**
 * POST /api/creator-coin/trade
 *
 * Executes a REAL buy/sell against a deployed creator coin:
 *  - EVM (Base): DegenFeedCoinV4 `buy()`/`sell()` signed by CREATOR_COIN_PRIVATE_KEY.
 *  - Solana: Anchor `buyTokens()`/`sellTokens()` signed by SOLANA_PRIVATE_KEY.
 *
 * Request body: `{ symbol, action: 'buy'|'sell', amount, tokenAddress, chain? }`
 *  - `tokenAddress` may be omitted when DEPLOYED_COIN_ADDRESS is set (it is used).
 *  - `chain` is inferred from the address format (0x… → base, base58 → solana)
 *    unless explicitly provided.
 *
 * Responses:
 *  - `{ configured: false, error }` — no contract deployed / env not configured.
 *    The UI must show an explicit setup message, never fake success.
 *  - `{ txHash, explorerUrl, tokensAmount, ... }` — real transaction submitted.
 *  - `{ error, code }` — request or execution failure.
 */

const TRADE_ACTIONS = new Set(['buy', 'sell']);

/** Convert a decimal string amount to the smallest unit (wei / lamports). */
function toSmallestUnit(amount: string, decimals: number): bigint {
  const [whole = '0', frac = ''] = String(amount).trim().split('.');
  const scale = BigInt(10) ** BigInt(decimals);
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * scale + BigInt(padded || '0');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, action, amount, tokenAddress, chain } = body as {
      symbol?: string;
      action?: string;
      amount?: string | number;
      tokenAddress?: string;
      chain?: string;
    };

    const normalizedAction = String(action ?? '').toLowerCase();
    if (!TRADE_ACTIONS.has(normalizedAction)) {
      return NextResponse.json(
        { error: 'Missing or invalid "action" — must be "buy" or "sell"' },
        { status: 400 },
      );
    }
    if (amount === undefined || Number(amount) <= 0 || Number.isNaN(Number(amount))) {
      return NextResponse.json(
        { error: 'Missing or invalid "amount" — must be a positive number' },
        { status: 400 },
      );
    }

    const deployedAddress = process.env.DEPLOYED_COIN_ADDRESS?.trim();
    const target = (tokenAddress ?? deployedAddress ?? '').trim();

    if (!target) {
      return NextResponse.json({
        configured: false,
        error:
          'CONTRACTS NOT DEPLOYED — set DEPLOYED_COIN_ADDRESS env var or pass tokenAddress in the request body',
      });
    }

    const chainParam = chain ? String(chain).toLowerCase() : undefined;

    // ─── EVM (Base) ──────────────────────────────────────────────────────
    if (chainParam === 'base' || (!chainParam && isValidEvmAddress(target))) {
      if (!isValidEvmAddress(target)) {
        return NextResponse.json({
          configured: false,
          error: `CONTRACTS NOT DEPLOYED — "${target}" is not a valid EVM (0x) contract address`,
        });
      }

      const { client, missing } = evmClientFromEnv({ requireWallet: true });
      if (!client) {
        return NextResponse.json({
          configured: false,
          error: `Trading not configured — set ${missing.join(', ')} env vars`,
          missing,
        });
      }

      const amountIn = toSmallestUnit(String(amount), 18);
      const result =
        normalizedAction === 'buy'
          ? await client.buy({ tokenAddress: target, amountIn, minTokensOut: 0n })
          : await client.sell({ tokenAddress: target, amountIn, minOut: 0n });

      return NextResponse.json({ ...result, symbol, action: normalizedAction, chain: 'base' });
    }

    // ─── Solana ──────────────────────────────────────────────────────────
    if (chainParam === 'solana' || (!chainParam && isValidSolanaAddress(target))) {
      if (!isValidSolanaAddress(target)) {
        return NextResponse.json({
          configured: false,
          error: `CONTRACTS NOT DEPLOYED — "${target}" is not a valid Solana address`,
        });
      }

      const { client, missing } = solanaClientFromEnv({ requireWallet: true });
      if (!client) {
        return NextResponse.json({
          configured: false,
          error: `Trading not configured — set ${missing.join(', ')} env vars`,
          missing,
        });
      }

      // Solana token amounts use 9 decimals (lamports).
      const amountIn = toSmallestUnit(String(amount), 9);
      const result =
        normalizedAction === 'buy'
          ? await client.buy({ tokenAddress: target, amountIn, minTokensOut: 0n })
          : await client.sell({ tokenAddress: target, amountIn, minOut: 0n });

      return NextResponse.json({ ...result, symbol, action: normalizedAction, chain: 'solana' });
    }

    return NextResponse.json({
      configured: false,
      error: `CONTRACTS NOT DEPLOYED — "${target}" is not a valid token address. Set DEPLOYED_COIN_ADDRESS env var or pass tokenAddress.`,
    });
  } catch (err) {
    console.error('[creator-coin/trade] Trade error:', err);
    const message = err instanceof Error ? err.message : 'Trade failed';
    return NextResponse.json({ error: message, code: 'TRADE_FAILED' }, { status: 500 });
  }
}

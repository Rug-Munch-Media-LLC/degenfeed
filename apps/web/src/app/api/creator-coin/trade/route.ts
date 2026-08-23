import type { TradeResult } from '@degenfeed/creator-coin';
import { NextResponse } from 'next/server';
import { getSessionFromRequest, requireSession } from '../../_auth';
import {
  evmClientFromEnv,
  isValidEvmAddress,
  isValidSolanaAddress,
  solanaClientFromEnv,
} from '../lib';

/**
 * POST /api/creator-coin/trade
 *
 * Executes a REAL buy/sell against the deployed creator coin:
 *  - EVM (Base): DegenFeedCoinV4 `buy()`/`sell()` signed by CREATOR_COIN_PRIVATE_KEY.
 *  - Solana: Anchor `buyTokens()`/`sellTokens()` signed by SOLANA_PRIVATE_KEY.
 *
 * SECURITY CONTRACT (2026-08-23 hardening, TOP-100 #1):
 *  1. AUTH        — valid `__Host-dfid` session required (requireSession).
 *  2. ALLOWLIST   — only DEPLOYED_COIN_ADDRESS is tradeable. Caller-supplied
 *                   tokenAddress values are rejected; the hot wallet can never
 *                   be directed at an arbitrary contract.
 *  3. SLIPPAGE    — EVM trades quote expected output on-chain (getTokenAmount /
 *                   getEthAmount views) and derive minTokensOut/minOut from a
 *                   server-side slippageBps margin. Zero-min-out trades are
 *                   impossible. Solana buys require an explicit positive
 *                   minTokensOut from the client (no on-chain quote view);
 *                   Solana sells have no program-level min-out parameter.
 *  4. IDEMPOTENCY — optional clientRequestId dedupes replays for 5 minutes.
 *  5. RATE LIMIT  — 10 trades/min per session address.
 *
 * Request body: `{ action: 'buy'|'sell', amount, slippageBps?, clientRequestId?, minTokensOut?(solana buy) }`
 *
 * Responses:
 *  - `{ configured: false, error }` — no contract deployed / env not configured.
 *    The UI must show an explicit setup message, never fake success.
 *  - `{ txHash, explorerUrl, tokensAmount, ... }` — real transaction submitted.
 *  - `{ error, code }` — request or execution failure.
 */

const TRADE_ACTIONS = new Set(['buy', 'sell']);
const DEFAULT_SLIPPAGE_BPS = 100; // 1%
const MIN_SLIPPAGE_BPS = 10; // 0.1%
const MAX_SLIPPAGE_BPS = 1500; // 15% — beyond this the user is their own MEV victim
const RATE_LIMIT_PER_WINDOW = 10;
const RATE_WINDOW_MS = 60_000;
const IDEMPOTENCY_TTL_MS = 300_000;

/** Convert a decimal string amount to the smallest unit (wei / lamports). */
function toSmallestUnit(amount: string, decimals: number): bigint {
  const [whole = '0', frac = ''] = String(amount).trim().split('.');
  const scale = BigInt(10) ** BigInt(decimals);
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * scale + BigInt(padded || '0');
}

/** Apply slippage margin to a quoted output amount. */
function applySlippage(quote: bigint, slippageBps: number): bigint {
  return (quote * BigInt(10_000 - slippageBps)) / BigInt(10_000);
}

// ─── Per-process rate limit + idempotency caches ─────────────────────────────
// Single-instance guards. For multi-instance deployments move both to Redis.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const idempotencyMap = new Map<string, { ts: number; result: unknown }>();

let lastSweep = Date.now();
function maybeSweep(): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of rateLimitMap) if (now > v.resetAt) rateLimitMap.delete(k);
  for (const [k, v] of idempotencyMap)
    if (now - v.ts > IDEMPOTENCY_TTL_MS) idempotencyMap.delete(k);
}

function checkRateLimit(sessionAddress: string): boolean {
  maybeSweep();
  const now = Date.now();
  const entry = rateLimitMap.get(sessionAddress);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sessionAddress, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  // ── 1. Authentication ──────────────────────────────────────────────────────
  const authError = await requireSession(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action, amount, tokenAddress, chain, slippageBps, clientRequestId, minTokensOut } =
      body as {
        action?: string;
        amount?: string | number;
        tokenAddress?: string;
        chain?: string;
        slippageBps?: number;
        clientRequestId?: string;
        minTokensOut?: string | number;
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

    // ── 2. Session identity → rate limit + idempotency key ───────────────────
    const session = await getSessionFromRequest(request);
    const sessionAddress = session?.address ?? 'unknown';
    if (!checkRateLimit(sessionAddress)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded — max 10 trades per minute' },
        { status: 429 },
      );
    }
    const idemKey = clientRequestId
      ? `${sessionAddress}:${String(clientRequestId).slice(0, 128)}`
      : null;
    if (idemKey) {
      const prior = idempotencyMap.get(idemKey);
      if (prior && Date.now() - prior.ts < IDEMPOTENCY_TTL_MS) {
        return NextResponse.json({ ...(prior.result as object), deduplicated: true });
      }
    }

    // Slippage (EVM only): clamp to sane bounds.
    const slip = Math.min(
      MAX_SLIPPAGE_BPS,
      Math.max(
        MIN_SLIPPAGE_BPS,
        Number(slippageBps ?? DEFAULT_SLIPPAGE_BPS) || DEFAULT_SLIPPAGE_BPS,
      ),
    );

    // ── 3. Token allowlist: ONLY the platform-deployed coin is tradeable ─────
    const deployedAddress = process.env.DEPLOYED_COIN_ADDRESS?.trim();
    if (!deployedAddress) {
      return NextResponse.json({
        configured: false,
        error: 'CONTRACTS NOT DEPLOYED — set DEPLOYED_COIN_ADDRESS env var',
      });
    }
    if (tokenAddress && tokenAddress.trim() !== deployedAddress) {
      return NextResponse.json(
        {
          error:
            'Caller-supplied tokenAddress rejected — only the platform-deployed creator coin is tradeable via this endpoint',
          code: 'TOKEN_NOT_ALLOWED',
        },
        { status: 400 },
      );
    }
    const target = deployedAddress;

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

      // ── Server-side quote → real min-out (never 0n) ─────────────────────
      let result: TradeResult;
      if (normalizedAction === 'buy') {
        const quote = await client.quoteBuy(target, amountIn);
        if (quote <= 0n) {
          return NextResponse.json(
            {
              error: 'Quote returned zero tokens for this amount — trade refused',
              code: 'BAD_QUOTE',
            },
            { status: 409 },
          );
        }
        result = await client.buy({
          tokenAddress: target,
          amountIn,
          minTokensOut: applySlippage(quote, slip),
        });
      } else {
        const quote = await client.quoteSell(target, amountIn);
        if (quote <= 0n) {
          return NextResponse.json(
            {
              error: 'Quote returned zero proceeds for this amount — trade refused',
              code: 'BAD_QUOTE',
            },
            { status: 409 },
          );
        }
        result = await client.sell({
          tokenAddress: target,
          amountIn,
          minOut: applySlippage(quote, slip),
        });
      }

      const payload = { ...result, action: normalizedAction, chain: 'base' as const };
      if (idemKey) idempotencyMap.set(idemKey, { ts: Date.now(), result: payload });
      return NextResponse.json(payload);
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

      let result: TradeResult;
      if (normalizedAction === 'buy') {
        // No on-chain quote view in the Solana program yet — require the
        // client to supply an explicit positive minTokensOut (0n is refused).
        const minOut = BigInt(String(minTokensOut ?? '0'));
        if (minOut <= 0n) {
          return NextResponse.json(
            {
              error:
                'Solana buys require a positive "minTokensOut" from a client-side simulation — zero-slippage-guard trades are refused',
              code: 'MIN_OUT_REQUIRED',
            },
            { status: 400 },
          );
        }
        result = await client.buy({ tokenAddress: target, amountIn, minTokensOut: minOut });
      } else {
        // NOTE: sellTokens program interface has no min-out parameter —
        // sandwich protection on Solana sells requires a program upgrade.
        result = await client.sell({ tokenAddress: target, amountIn });
      }

      const payload = { ...result, action: normalizedAction, chain: 'solana' as const };
      if (idemKey) idempotencyMap.set(idemKey, { ts: Date.now(), result: payload });
      return NextResponse.json(payload);
    }

    return NextResponse.json({
      configured: false,
      error: `CONTRACTS NOT DEPLOYED — "${target}" is not a valid token address.`,
    });
  } catch (err) {
    console.error('[creator-coin/trade] Trade error:', err);
    const message = err instanceof Error ? err.message : 'Trade failed';
    return NextResponse.json({ error: message, code: 'TRADE_FAILED' }, { status: 500 });
  }
}

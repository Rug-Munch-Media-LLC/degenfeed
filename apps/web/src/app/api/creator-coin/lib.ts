/**
 * Shared client construction for creator-coin API routes.
 *
 * All routes read their chain configuration from server-side env vars.
 * Nothing is hardcoded — if the required env vars are missing the route
 * returns a clear `NOT_CONFIGURED` error instead of a fake placeholder.
 */
import { CreatorCoinEVMClient, createCreatorCoinSolanaClient } from '@degenfeed/creator-coin';
import type { CreatorChain } from '@degenfeed/creator-coin/types';
import { NextResponse } from 'next/server';

/**
 * EVM address literal type — mirrors viem's `Address` (`0x${string}`) without
 * pulling viem into the web app's dependency graph.
 */
export type EvmAddress = `0x${string}`;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as EvmAddress;

export interface ChainConfigResult<T> {
  client: T | null;
  missing: string[];
}

/**
 * Parse a Solana secret key from a solana-keygen JSON array string.
 * e.g. `SOLANA_PRIVATE_KEY="[1,2,3,...]"` (64 numbers).
 */
export function parseSecretKey(raw: string | undefined): number[] | undefined {
  if (!raw || raw.trim().length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 64 &&
      parsed.every((n) => typeof n === 'number' && Number.isInteger(n))
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return undefined;
}

export function isValidEvmAddress(value: string | undefined): value is EvmAddress {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isValidSolanaAddress(value: string | undefined): boolean {
  return !!value && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

/**
 * Build the EVM client from env vars.
 * `requireWallet` is true for trade/deploy (needs CREATOR_COIN_PRIVATE_KEY).
 */
export function evmClientFromEnv(opts: {
  requireWallet: boolean;
  rpcUrl?: string;
}): ChainConfigResult<CreatorCoinEVMClient> {
  const rpcUrl = opts.rpcUrl ?? process.env.BASE_RPC_URL;
  const privateKey = process.env.CREATOR_COIN_PRIVATE_KEY;

  const missing: string[] = [];
  if (!rpcUrl) missing.push('BASE_RPC_URL');
  if (opts.requireWallet && !privateKey) missing.push('CREATOR_COIN_PRIVATE_KEY');

  if (missing.length > 0) return { client: null, missing };

  return {
    client: new CreatorCoinEVMClient({
      rpcUrl,
      privateKey: opts.requireWallet ? privateKey : undefined,
    }),
    missing: [],
  };
}

/**
 * Build the Solana client from env vars.
 * `requireWallet` is true for trade/deploy (needs SOLANA_PRIVATE_KEY).
 */
export function solanaClientFromEnv(opts: {
  requireWallet: boolean;
  rpcUrl?: string;
}): ChainConfigResult<ReturnType<typeof createCreatorCoinSolanaClient>> {
  const rpcUrl = opts.rpcUrl ?? process.env.SOLANA_RPC_URL;
  const secretKey = parseSecretKey(process.env.SOLANA_PRIVATE_KEY);

  const missing: string[] = [];
  if (!rpcUrl) missing.push('SOLANA_RPC_URL');
  if (opts.requireWallet && !secretKey) missing.push('SOLANA_PRIVATE_KEY');

  if (missing.length > 0) return { client: null, missing };

  return {
    client: createCreatorCoinSolanaClient({
      rpcUrl,
      secretKey: opts.requireWallet ? secretKey : undefined,
    }),
    missing: [],
  };
}

/**
 * Standard 503 response for routes that are not configured yet.
 * Replaces the old placeholder-hash / mock-address responses.
 */
export function notConfigured(missing: string[], mode: string): NextResponse {
  return NextResponse.json(
    {
      error: `${mode} not configured — set ${missing.join(', ')} env vars`,
      code: 'NOT_CONFIGURED',
      missing,
    },
    { status: 503 },
  );
}

export type { CreatorChain };

import { NextResponse } from 'next/server';
import {
  evmClientFromEnv,
  isValidEvmAddress,
  isValidSolanaAddress,
  solanaClientFromEnv,
} from '../lib';

/**
 * GET /api/creator-coin/onchain?address=0x...&chain=base
 * GET /api/creator-coin/onchain?symbol=BTC           (uses DEPLOYED_COIN_ADDRESS)
 *
 * Reads REAL on-chain state from a deployed creator coin:
 *  - EVM (Base): reads DegenFeedCoinV4 (price, supply, curve progress,
 *    phase, raised, buyers, graduated, creator, timestamps).
 *  - Solana: reads the Anchor TokenState account.
 *
 * If no coin is deployed / configured the route returns
 * `{ configured: false }` — the UI must NOT synthesize fake data.
 *
 * Required env vars:
 *  - DEPLOYED_COIN_ADDRESS — the reference deployed coin (for symbol lookups)
 *  - BASE_RPC_URL (EVM) or SOLANA_RPC_URL (Solana)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim() || undefined;
  const chainParam = (searchParams.get('chain')?.trim() || 'base').toLowerCase();
  const deployedAddress = process.env.DEPLOYED_COIN_ADDRESS?.trim() || undefined;

  const resolveAddress = (): string | undefined => {
    if (address) return address;
    if (deployedAddress) return deployedAddress;
    return undefined;
  };

  try {
    // ─── EVM (Base) ──────────────────────────────────────────────────────
    if (chainParam === 'base') {
      const target = resolveAddress();
      if (!target || !isValidEvmAddress(target)) {
        return NextResponse.json({
          configured: false,
          error:
            'CONTRACTS NOT DEPLOYED — set DEPLOYED_COIN_ADDRESS env var (0x address) or pass ?address=',
        });
      }

      const { client, missing } = evmClientFromEnv({ requireWallet: false });
      if (!client) {
        return NextResponse.json({
          configured: false,
          error: `On-chain reads not configured — set ${missing.join(', ')} env vars`,
          missing,
        });
      }

      const state = await client.readV4State(target);
      return NextResponse.json({ configured: true, chain: 'base', ...state });
    }

    // ─── Solana ──────────────────────────────────────────────────────────
    if (chainParam === 'solana') {
      const target = resolveAddress();
      if (!target || !isValidSolanaAddress(target)) {
        return NextResponse.json({
          configured: false,
          error:
            'CONTRACTS NOT DEPLOYED — set DEPLOYED_COIN_ADDRESS env var (base58 mint) or pass ?address=',
        });
      }

      const { client, missing } = solanaClientFromEnv({ requireWallet: false });
      if (!client) {
        return NextResponse.json({
          configured: false,
          error: `On-chain reads not configured — set ${missing.join(', ')} env vars`,
          missing,
        });
      }

      const info = await client.getTokenInfo(target);
      return NextResponse.json({ configured: true, ...info, chain: 'solana' });
    }

    return NextResponse.json({ error: 'Unsupported chain (base|solana)' }, { status: 400 });
  } catch (err) {
    console.error('[creator-coin/onchain] Read error:', err);
    const message = err instanceof Error ? err.message : 'On-chain read failed';
    // A read failure (RPC down, contract not deployed, wrong address) is NOT
    // fake data — surface it so the UI can show a real error state.
    return NextResponse.json(
      { configured: false, error: message, code: 'ONCHAIN_READ_FAILED' },
      { status: 200 },
    );
  }
}

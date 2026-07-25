/**
 * @degenfeed/web3 — RPC Fallback Router
 *
 * Zero paid RPCs. Every chain has multiple free public fallbacks.
 * callWithFallback() tries each RPC in order until one succeeds.
 *
 * EVM chains use standard JSON-RPC POST.
 * Solana uses its own JSON-RPC format.
 *
 * Sources:
 *   - LlamaRPC (DefiLlama) — free, no API key
 *   - dRPC — free tier, no API key
 *   - 1RPC — free, no API key
 *   - Ankr Public — free tier
 *   - PublicNode — free, no API key
 *   - Official chain RPCs (base.org, optimism.io, arb1.arbitrum.io)
 *   - Solana public mainnet-beta
 */

export type Chain = 'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'optimism' | 'solana' | 'zora';

export const RPC_FALLBACKS: Record<Chain, string[]> = {
  ethereum: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://eth.drpc.org',
    'https://1rpc.io/eth',
    'https://ethereum.publicnode.com',
    'https://eth.drpc.org',
  ],
  base: [
    'https://base.llamarpc.com',
    'https://base.drpc.org',
    'https://1rpc.io/base',
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
  ],
  polygon: [
    'https://polygon.llamarpc.com',
    'https://polygon.drpc.org',
    'https://polygon-rpc.com',
    'https://1rpc.io/matic',
    'https://rpc.ankr.com/polygon',
  ],
  arbitrum: [
    'https://arbitrum.llamarpc.com',
    'https://arbitrum.drpc.org',
    'https://arb1.arbitrum.io/rpc',
    'https://1rpc.io/arb',
    'https://rpc.ankr.com/arbitrum',
  ],
  optimism: [
    'https://optimism.llamarpc.com',
    'https://optimism.drpc.org',
    'https://mainnet.optimism.io',
    'https://1rpc.io/op',
    'https://rpc.ankr.com/optimism',
  ],
  solana: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://solana.drpc.org',
  ],
  zora: ['https://rpc.zora.energy', 'https://zora-rpc.publicnode.com', 'https://1rpc.io/zora'],
};

/**
 * Pick the first RPC URL for a chain (quick access).
 */
export function getRpcUrl(chain: Chain): string {
  const urls = RPC_FALLBACKS[chain];
  if (!urls || urls.length === 0) {
    throw new Error(`No RPC URLs configured for chain: ${chain}`);
  }
  return urls[0];
}

/**
 * Call an EVM JSON-RPC method with automatic fallback across all RPCs.
 * Tries each URL in order; if one fails (network error or non-ok status),
 * moves to the next. Throws only after ALL RPCs have been exhausted.
 */
export async function callWithFallback<T = unknown>(
  chain: Chain,
  method: string,
  params: unknown[],
  options?: { timeoutMs?: number },
): Promise<{ result?: T; error?: { code: number; message: string } }> {
  const urls = RPC_FALLBACKS[chain];
  const timeout = options?.timeoutMs ?? 10_000;
  const lastError: Error[] = [];

  for (const rpc of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        lastError.push(new Error(`${rpc} returned status ${res.status}`));
        continue;
      }

      const json = (await res.json()) as { result?: T; error?: { code: number; message: string } };

      // RPC-level error is not a retry condition — return it
      if (json.error) {
        return json;
      }

      return json;
    } catch (err) {
      lastError.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // All RPCs failed
  throw new Error(
    `All RPCs failed for ${chain} (${urls.length} tried): ${lastError.map((e) => e.message).join('; ')}`,
  );
}

/**
 * Convenience: eth_call with fallback.
 */
export async function ethCall(chain: Chain, to: string, data: string): Promise<string | null> {
  try {
    const res = await callWithFallback(chain, 'eth_call', [{ to, data }, 'latest']);
    return (res.result as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Convenience: eth_getBalance with fallback.
 */
export async function ethGetBalance(chain: Chain, address: string): Promise<bigint | null> {
  try {
    const res = await callWithFallback(chain, 'eth_getBalance', [address, 'latest']);
    if (typeof res.result === 'string') {
      return BigInt(res.result);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convenience: eth_blockNumber with fallback.
 */
export async function ethBlockNumber(chain: Chain): Promise<bigint | null> {
  try {
    const res = await callWithFallback(chain, 'eth_blockNumber', []);
    if (typeof res.result === 'string') {
      return BigInt(res.result);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convenience: getTokenAccounts (Solana) with fallback.
 */
export async function solanaGetTokenAccounts(
  owner: string,
  mint?: string,
): Promise<Array<{ mint: string; amount: bigint }>> {
  const params: Record<string, unknown> = mint
    ? { owner, mint }
    : { owner, programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' };

  try {
    const res = await callWithFallback('solana', 'getTokenAccountsByOwner', [
      owner,
      params,
      { encoding: 'jsonParsed' },
    ]);

    const value = (res.result as { value?: Array<unknown> } | undefined)?.value;
    if (!value) return [];

    return value.map((v: unknown) => {
      const account = v as {
        account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } };
      };
      return {
        mint: account.account.data.parsed.info.mint,
        amount: BigInt(account.account.data.parsed.info.tokenAmount.amount),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get a healthy RPC URL for a chain (first one that responds to eth_blockNumber).
 * Useful for initializing viem/ethers clients.
 */
export async function discoverHealthyRpc(chain: Chain): Promise<string | null> {
  const urls = RPC_FALLBACKS[chain];
  for (const rpc of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);

      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const json = (await res.json()) as { result?: string };
        if (json.result) return rpc;
      }
    } catch {}
  }
  return null;
}

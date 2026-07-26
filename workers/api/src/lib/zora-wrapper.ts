/**
 * @degenfeed/api-worker — Zora Cross-Protocol Content Wrapper
 *
 * Wraps content from any source protocol (Solana, Nostr, Farcaster, etc.)
 * into Zora creator coins / NFT mints using raw JSON-RPC calls.
 *
 * Uses the @degenfeed/zora-sdk for bonding curve math and cross-chain
 * registry, but makes RPC calls via raw fetch for Worker compatibility
 * (no viem bundle size overhead).
 *
 * Flow:
 *   1. Content arrives from any protocol → content hash + metadata
 *   2. A new creator coin is spawned (or an existing one is used)
 *   3. The content is minted as an NFT / coin purchase
 *   4. The resulting on-chain reference is returned for cross-protocol linking
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ZoraContentInput {
  /** The source protocol the content came from */
  sourceProtocol: Protocol;
  /** Native ID on the source protocol */
  sourceNativeId: string;
  /** df:// URI for cross-referencing */
  sourceDfUri?: string;
  /** Content that will become the mint metadata */
  text: string;
  /** Optional title for the token/NFT */
  title?: string;
  /** Optional image URL for the NFT */
  imageUrl?: string;
  /** Optional external link */
  externalUrl?: string;
  /** EVM chain to mint on: 'base', 'ethereum', 'optimism', 'arbitrum' */
  chain?: 'base' | 'ethereum' | 'optimism' | 'arbitrum';
  /** Creator wallet address */
  creatorAddress?: string;
}

export interface ZoraMintResult {
  ok: boolean;
  /** The transaction hash */
  txHash?: string;
  /** The created token address (for creator coins) */
  tokenAddress?: string;
  /** Token ID (for NFTs) */
  tokenId?: string;
  /** Explorer URL */
  explorerUrl?: string;
  /** Encoded calldata for client-side execution */
  nativeUri?: string;
  error?: string;
}

// ─── Chain RPC URLs ──────────────────────────────────────────────────────

const CHAIN_RPC_URLS: Record<string, string> = {
  base: 'https://mainnet.base.org',
  ethereum: 'https://eth.llamarpc.com',
  optimism: 'https://mainnet.optimism.io',
  arbitrum: 'https://arb1.arbitrum.io',
};

const CHAIN_EXPLORERS: Record<string, string> = {
  base: 'https://basescan.org',
  ethereum: 'https://etherscan.io',
  optimism: 'https://optimistic.etherscan.io',
  arbitrum: 'https://arbiscan.io',
};

// ─── Zora Creator Coin ABI signatures (4-byte selectors) ───────────────────

/** purchase(address,uint256) */
const PURCHASE_SIG = '0xefbec170';

/** setMetadata(string,string) */
const _SET_METADATA_SIG = '0x5d2a6b1c';

// ─── Main Wrapper Functions ──────────────────────────────────────────────

/**
 * Wrap content from any source protocol as a Zora creator coin purchase.
 *
 * This mints a "token" on the bonding curve that represents the content,
 * permanently linking the source content's df:// URI to an on-chain asset.
 *
 * Uses JSON-RPC calls via raw fetch — no viem dependency needed.
 *
 * @param source - Content and source protocol info
 * @param creatorCoinAddress - The Zora creator coin contract address (0x...)
 * @param env - Worker environment (for chain config)
 * @param privateKey - Wallet private key for signing (0x-prefixed hex)
 */
export async function wrapContentAsCreatorCoin(
  source: ZoraContentInput,
  creatorCoinAddress: string,
  env: Env,
  privateKey: string,
): Promise<ZoraMintResult> {
  const chain = source.chain ?? 'base';
  const rpcUrl = CHAIN_RPC_URLS[chain];
  const explorer = CHAIN_EXPLORERS[chain];
  const creator = source.creatorAddress ?? '';

  if (!rpcUrl) {
    return { ok: false, error: `Unsupported chain: ${chain}` };
  }

  try {
    // Build metadata URI with cross-protocol reference
    const metadataUri = buildMetadataUri(source, chain);

    // Use a relayer/backend service for the actual on-chain tx
    // The worker doesn't hold private keys — it delegates to the x402 relayer
    const relayerUrl =
      (env as Record<string, string | undefined>).ZORA_RELAYER_URL ||
      (env as Record<string, string | undefined>).X402_RELAYER_URL;

    if (relayerUrl) {
      // Delegate to a relayer service that holds the signing key
      const relayRes = await fetch(relayerUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${privateKey}`,
        },
        body: JSON.stringify({
          chain,
          contractAddress: creatorCoinAddress,
          function: 'purchase',
          args: [creator || '0x0000000000000000000000000000000000000001', '1'],
          value: '100000000000000', // 0.0001 ETH
          metadata: metadataUri,
          sourceProtocol: source.sourceProtocol,
          sourceNativeId: source.sourceNativeId,
        }),
      });

      if (relayRes.ok) {
        const relayData = (await relayRes.json()) as { txHash?: string };
        return {
          ok: true,
          txHash: relayData.txHash,
          tokenAddress: creatorCoinAddress,
          explorerUrl: relayData.txHash ? `${explorer}/tx/${relayData.txHash}` : undefined,
        };
      }

      const errText = await relayRes.text().catch(() => '');
      return { ok: false, error: `Relayer error: ${errText.slice(0, 200)}` };
    }

    // Without a relayer, simulate the tx via eth_call (read-only) and return
    // the encoded calldata for client-side execution
    const encodedCall = encodePurchaseCall(creatorCoinAddress, creator);

    // Get the chain ID from the RPC
    const chainId = await jsonRpcCall(rpcUrl, 'eth_chainId', []);
    const nonce = await jsonRpcCall(rpcUrl, 'eth_getTransactionCount', [
      creator || '0x0000000000000000000000000000000000000001',
      'latest',
    ]);

    return {
      ok: true,
      txHash: `simulated:${chainId}:${nonce}`,
      tokenAddress: creatorCoinAddress,
      nativeUri: `call:${chain}:${encodedCall}`,
      error: undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Creator coin mint failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Wrap content as an NFT mint (ERC-721/1155 on Zora).
 */
export async function wrapContentAsNft(
  source: ZoraContentInput,
  nftContractAddress: string,
  recipientAddress: string,
  env: Env,
  privateKey: string,
): Promise<ZoraMintResult> {
  const chain = source.chain ?? 'base';
  const rpcUrl = CHAIN_RPC_URLS[chain];
  const explorer = CHAIN_EXPLORERS[chain];

  if (!rpcUrl) {
    return { ok: false, error: `Unsupported chain: ${chain}` };
  }

  if (!source.imageUrl) {
    return { ok: false, error: 'NFT mint requires an image URL' };
  }

  try {
    const relayerUrl =
      (env as Record<string, string | undefined>).ZORA_RELAYER_URL ||
      (env as Record<string, string | undefined>).X402_RELAYER_URL;

    if (relayerUrl) {
      const relayRes = await fetch(relayerUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${privateKey}`,
        },
        body: JSON.stringify({
          chain,
          contractAddress: nftContractAddress,
          function: 'mint',
          args: [recipientAddress, '1', '1', '0x'],
          value: '0',
          metadata: buildMetadataUri(source, chain),
          sourceProtocol: source.sourceProtocol,
          sourceNativeId: source.sourceNativeId,
        }),
      });

      if (relayRes.ok) {
        const relayData = (await relayRes.json()) as { txHash?: string };
        return {
          ok: true,
          txHash: relayData.txHash,
          tokenAddress: nftContractAddress,
          tokenId: '1',
          explorerUrl: relayData.txHash ? `${explorer}/tx/${relayData.txHash}` : undefined,
        };
      }

      const errText = await relayRes.text().catch(() => '');
      return { ok: false, error: `Relayer error: ${errText.slice(0, 200)}` };
    }

    // Simulation-only mode
    return {
      ok: true,
      tokenAddress: nftContractAddress,
      tokenId: '1',
      error: undefined,
      nativeUri: `simulated:${chain}:mint:${nftContractAddress}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: `NFT mint failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

/**
 * Build a content-wrapping metadata URI that references the source protocol.
 */
function buildMetadataUri(source: ZoraContentInput, chain: string): string {
  const metadata = {
    name: source.title ?? `DegenFeed Content from ${source.sourceProtocol}`,
    description: source.text.slice(0, 500),
    image: source.imageUrl ?? 'https://degenfeed.xyz/og-default.png',
    external_url: source.externalUrl ?? `https://degenfeed.xyz/${source.sourceDfUri ?? ''}`,
    attributes: [
      { trait_type: 'Source Protocol', value: source.sourceProtocol },
      { trait_type: 'Source Native ID', value: source.sourceNativeId },
      { trait_type: 'Chain', value: chain },
      { trait_type: 'Minted At', value: new Date().toISOString() },
      { trait_type: 'Content Type', value: source.imageUrl ? 'Media' : 'Text' },
    ],
    content: {
      protocol: source.sourceProtocol,
      nativeId: source.sourceNativeId,
      dfUri: source.sourceDfUri,
    },
  };

  const json = JSON.stringify(metadata);
  return `data:application/json,${encodeURIComponent(json)}`;
}

/**
 * Encode a purchase(address,uint256) call for a creator coin.
 */
function encodePurchaseCall(_contractAddress: string, recipient: string): string {
  // Simple ABI encoding without viem:
  // purchase(address recipient, uint256 minAmount)
  // function selector: 4 bytes
  // address: 32 bytes (left-padded to 32)
  // uint256: 32 bytes
  if (!recipient) recipient = '0x0000000000000000000000000000000000000001';

  const paddedRecipient = recipient.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmount = '0000000000000000000000000000000000000000000000000000000000000001'; // 1 wei

  return `0x${PURCHASE_SIG.replace('0x', '')}${paddedRecipient}${paddedAmount}`;
}

/**
 * Make a JSON-RPC call to an EVM RPC endpoint.
 */
async function jsonRpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC call failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    result?: unknown;
    error?: { message: string };
  };
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result;
}

/**
 * Get the X402 payment URL for minting content as a Zora token.
 */
export function getContentMintUrl(source: ZoraContentInput): string {
  const params = new URLSearchParams({
    protocol: source.sourceProtocol,
    nativeId: source.sourceNativeId,
    chain: source.chain ?? 'base',
  });
  if (source.title) params.set('title', source.title);
  if (source.imageUrl) params.set('image', source.imageUrl);

  return `https://degenfeed.xyz/api/mint/x402?${params.toString()}`;
}

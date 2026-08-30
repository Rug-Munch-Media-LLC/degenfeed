/**
 * Client-side contract interaction for DegenFeed on-chain tipping.
 *
 * All functions work with raw EIP-1193 providers (window.ethereum).
 * No ethers.js / viem dependency required — keeps bundle small.
 */

import {
  encodeTipData,
  encodeTipWithMessageData,
  getTipChainConfig,
  getTipContractAddress,
} from './tip-contract-data';

// ─── Types ────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    ethereum?: ethersProvider;
  }
}

export interface OnChainTip {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string; // wei as string
  message: string;
  transactionHash: string;
  blockNumber: number;
  timestamp?: number;
}

export interface TipOnChainOptions {
  /** Target L2: 'base' | 'optimism' | 'arbitrum' */
  chain: string;
  /** Recipient wallet address */
  recipient: `0x${string}`;
  /** Amount in ETH (e.g. "0.001") */
  amount: string;
  /** Optional on-chain memo */
  message?: string;
  /** Community treasury address for split tipping */
  communityAddress?: `0x${string}`;
}

export interface TipResult {
  /** Transaction hash */
  txHash: string;
  /** Chain explorer URL */
  explorerUrl: string;
  /** Chain name */
  chain: string;
}

// ─── Provider helpers ─────────────────────────────────────────────────────

function getProvider(): ethersProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) {
    console.warn('[tipContract] No Ethereum wallet detected (window.ethereum)');
    return null;
  }
  return window.ethereum;
}

type ethersProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  selectedAddress?: string;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isRainbow?: boolean;
  isCoinbaseWallet?: boolean;
};

// ─── Chain switching ──────────────────────────────────────────────────────

/**
 * Switch the wallet to the chain required by the tip contract.
 * Adds the chain if it's not already configured in the wallet.
 */
export async function switchToTipChain(chain: string): Promise<void> {
  const provider = getProvider();
  if (!provider) throw new Error('No Ethereum wallet detected');

  const config = getTipChainConfig(chain);

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainId }],
    });
  } catch (switchError: unknown) {
    const err = switchError as { code?: number; message?: string };
    // 4902 = chain not added
    if (err.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: config.chainId,
            chainName: config.name,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [config.rpc],
            blockExplorerUrls: [config.explorer],
          },
        ],
      });
    } else {
      throw new Error(`Failed to switch to ${config.name}: ${err.message ?? String(err)}`);
    }
  }
}

// ─── Tip: send on-chain ──────────────────────────────────────────────────

/**
 * Send a direct on-chain tip through the DegenFeedTips contract.
 *
 * Bypasses the DegenFeed backend entirely — goes straight to the L2 contract.
 * The caller pays only L2 gas. 0% platform fee.
 *
 * @returns The transaction hash + explorer link.
 */
export async function tipOnChain(options: TipOnChainOptions): Promise<TipResult> {
  const { chain, recipient, amount, message, communityAddress } = options;
  const provider = getProvider();
  if (!provider)
    throw new Error('No Ethereum wallet detected. Install MetaMask, Rabby, or Rainbow.');

  // 1. Get current account
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts?.[0]) throw new Error('Wallet not connected');

  // 2. Switch to the correct chain
  await switchToTipChain(chain);

  // 3. Get contract address
  const contractAddress = getTipContractAddress(chain);
  const config = getTipChainConfig(chain);

  // 4. Encode value in wei
  const valueWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18));
  if (valueWei <= 0n) throw new Error('Amount must be > 0');

  // 5. Encode function data
  let data: `0x${string}`;
  if (message) {
    data = encodeTipWithMessageData(recipient, message);
  } else if (communityAddress) {
    // tipWithSplit(address,address) — selector verified via `cast sig`
    const sig = '0x8feb66d9';
    const addr1 = recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const addr2 = communityAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    data = `${sig}${addr1}${addr2}` as `0x${string}`;
  } else {
    data = encodeTipData(recipient);
  }

  // 6. Send transaction
  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: accounts[0],
        to: contractAddress,
        value: `0x${valueWei.toString(16)}`,
        data,
      },
    ],
  })) as string;

  const explorerUrl = `${config.explorer}/tx/${txHash}`;

  return { txHash, explorerUrl, chain };
}

// ─── Event: query TipSent events for an address ───────────────────────────

/**
 * Query past `TipSent` events from the contract.
 *
 * Returns tips where the given address was either the sender (`from`)
 * or the recipient (`to`).
 */
export async function getOnChainTips(
  chain: string,
  address: `0x${string}`,
  options?: {
    fromBlock?: number;
    toBlock?: number | 'latest';
    maxResults?: number;
  },
): Promise<OnChainTip[]> {
  const provider = getProvider();
  if (!provider) throw new Error('No Ethereum wallet detected');

  const contractAddress = getTipContractAddress(chain);

  // Build filter: TipSent event. indexed params:
  //   topic0 = keccak("TipSent(address,address,uint256,string)")
  //   topic1 = from (indexed)
  //   topic2 = to (indexed)
  // topic0 verified 2026-08-30 via `cast sig-event "TipSent(address,address,uint256,string)"`
  // (the previous value was fabricated and matched no real logs).
  const tipSentTopic =
    '0x47699a4a144a6ecb85d9f1d3f809cbb382de4ad771c46d73422dd419cebec465' as `0x${string}`;

  const fromBlock = options?.fromBlock ?? 0;
  const toBlock = options?.toBlock ?? 'latest';

  // Address → 32-byte event topic ("0x" + 64 hex chars). The previous
  // `padStart(66, '0x')` interleaved "0x" pairs into the topic and corrupted
  // every filter, so no tip could ever be resolved.
  const addressTopic = (addr: `0x${string}`): `0x${string}` =>
    `0x${addr.toLowerCase().replace(/^0x/, '').padStart(64, '0')}` as `0x${string}`;

  // We need to query both directions: address as sender and as recipient
  const [sentLogs, receivedLogs] = await Promise.all([
    provider.request({
      method: 'eth_getLogs',
      params: [
        {
          address: contractAddress,
          fromBlock: typeof fromBlock === 'number' ? `0x${fromBlock.toString(16)}` : '0x0',
          toBlock: toBlock === 'latest' ? 'latest' : `0x${(toBlock as number).toString(16)}`,
          topics: [tipSentTopic, addressTopic(address), null],
        },
      ],
    }) as Promise<LogEntry[]>,
    provider.request({
      method: 'eth_getLogs',
      params: [
        {
          address: contractAddress,
          fromBlock: typeof fromBlock === 'number' ? `0x${fromBlock.toString(16)}` : '0x0',
          toBlock: toBlock === 'latest' ? 'latest' : `0x${(toBlock as number).toString(16)}`,
          topics: [tipSentTopic, null, addressTopic(address)],
        },
      ],
    }) as Promise<LogEntry[]>,
  ]);

  // Parse logs
  const allLogs = [...sentLogs, ...receivedLogs];
  const seen = new Set<string>();
  const tips: OnChainTip[] = [];

  for (const log of allLogs) {
    if (seen.has(log.transactionHash)) continue;
    seen.add(log.transactionHash);

    try {
      const tip = decodeTipSentEvent(log);
      if (tip) tips.push(tip);
    } catch {
      // Skip unparseable logs
    }
  }

  // Sort by block number descending (newest first)
  tips.sort((a, b) => b.blockNumber - a.blockNumber);

  const max = options?.maxResults ?? 50;
  return tips.slice(0, max);
}

// ─── Log decoding ─────────────────────────────────────────────────────────

interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  blockHash?: string;
  removed?: boolean;
}

/**
 * Decode a raw TipSent event log into an OnChainTip.
 *
 * TipSent(address indexed from, address indexed to, uint256 amount, string message)
 *
 * topics[1] = from (indexed, padded to 32 bytes)
 * topics[2] = to (indexed, padded to 32 bytes)
 * data      = abi.encode(amount, message) — dynamic string after a 32-byte uint256
 */
function decodeTipSentEvent(log: LogEntry): OnChainTip | null {
  const from = `0x${log.topics[1]?.slice(26)}` as `0x${string}`;
  const to = `0x${log.topics[2]?.slice(26)}` as `0x${string}`;

  // data layout: uint256 amount (32 bytes) | offset to string (32 bytes) | string length (32 bytes) | string data
  const data = log.data.replace('0x', '');
  const amountHex = data.slice(0, 64);
  const amount = BigInt(`0x${amountHex}`).toString();

  // Decode string message
  const stringOffsetHex = data.slice(64, 128);
  const stringOffset = Number(BigInt(`0x${stringOffsetHex}`));
  const messageStart = stringOffset * 2; // offset from data start in hex chars
  const stringLenHex = data.slice(messageStart, messageStart + 64);
  const stringLen = Number(BigInt(`0x${stringLenHex}`));
  const stringData = data.slice(messageStart + 64, messageStart + 64 + stringLen * 2);
  const bytes = new Uint8Array(
    stringData.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? [],
  );
  const message = new TextDecoder().decode(bytes);

  return {
    from,
    to,
    amount,
    message,
    transactionHash: log.transactionHash,
    blockNumber: Number.parseInt(log.blockNumber, 16),
  };
}

// ─── Estimate gas for a tip call ─────────────────────────────────────────

/**
 * Estimate gas required for a tip transaction.
 * Useful for showing users estimated fees before they confirm.
 */
export async function estimateTipGas(
  chain: string,
  recipient: `0x${string}`,
  amount: string,
): Promise<bigint | null> {
  const provider = getProvider();
  if (!provider) return null;

  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
  if (!accounts?.[0]) return null;

  const contractAddress = getTipContractAddress(chain);
  const valueWei = BigInt(Math.floor(Number.parseFloat(amount) * 1e18));

  try {
    const gasEstimate = (await provider.request({
      method: 'eth_estimateGas',
      params: [
        {
          from: accounts[0],
          to: contractAddress,
          value: `0x${valueWei.toString(16)}`,
          data: encodeTipData(recipient),
        },
      ],
    })) as string;

    return BigInt(gasEstimate);
  } catch {
    return null;
  }
}

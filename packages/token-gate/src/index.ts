/**
 * @degenfeed/token-gate — Token/NFT Gating System
 *
 * Core types and on-chain verification logic for ERC20, ERC721, ERC1155,
 * and Solana SPL token gating. Used by both the API worker and client-side UI.
 *
 * The verification cache runs in-memory (5-min TTL). For CF Workers,
 * use the KV-backed cache in the API route handler instead.
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type TokenGateChain = 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism';
export type TokenGateType = 'erc20' | 'erc721' | 'erc1155';

export interface TokenGate {
  type: TokenGateType;
  chain: TokenGateChain;
  contractAddress: string;
  tokenId?: string; // For ERC721/1155
  minBalance?: number; // For ERC20
  minBalanceDecimals?: number;
}

export interface TokenGateInfo {
  symbol: string;
  name: string;
  /** For NFTs, the resolved metadata name/image */
  metadata?: { name: string; image: string } | null;
}

/** Human-readable labels for chains and types */
export const CHAIN_LABELS: Record<TokenGateChain, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  polygon: 'Polygon',
  solana: 'Solana',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
};

export const TYPE_LABELS: Record<TokenGateType, string> = {
  erc20: 'Token (ERC-20)',
  erc721: 'NFT (ERC-721)',
  erc1155: 'Multi Token (ERC-1155)',
};

// ─── RPC Configuration ────────────────────────────────────────────────────

const RPC_URLS: Record<TokenGateChain, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  base: 'https://base-mainnet.g.alchemy.com/v2/demo',
  polygon: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/demo',
  optimism: 'https://opt-mainnet.g.alchemy.com/v2/demo',
  solana: 'https://api.mainnet-beta.solana.com',
};

function getRpcUrl(chain: TokenGateChain): string {
  const envKey = `${chain.toUpperCase()}_RPC_URL`;
  if (typeof process !== 'undefined' && process.env?.[envKey]) {
    return process.env[envKey]!;
  }
  return RPC_URLS[chain];
}

// ─── EVM helpers ──────────────────────────────────────────────────────────

const ERC20_BALANCE_OF = '0x70a08231';
const ERC721_OWNER_OF = '0x6352211e';
const ERC1155_BALANCE_OF = '0x00fdd58e';
const ERC20_SYMBOL = '0x95d89b41';
const ERC721_TOKEN_URI = '0xc87b56dd';
const ERC1155_URI = '0x0e89341c';

async function ethCall(
  chain: TokenGateChain,
  to: string,
  data: string,
): Promise<string | null> {
  const url = getRpcUrl(chain);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string; error?: unknown };
    return json.result ?? null;
  } catch {
    return null;
  }
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex);
}

function decodeString(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length < 64) return '';
  const dataOffset = parseInt(clean.slice(0, 64), 16);
  const lengthStart = 64 + dataOffset * 2;
  const length = parseInt(clean.slice(lengthStart, lengthStart + 64), 16);
  const dataStart = lengthStart + 64;
  const raw = clean.slice(dataStart, dataStart + length * 2);
  let str = '';
  for (let i = 0; i < raw.length; i += 2) {
    const code = parseInt(raw.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

// ─── Solana helpers ────────────────────────────────────────────────────────

async function solanaGetTokenAccounts(
  owner: string,
  mint?: string,
): Promise<Array<{ mint: string; amount: bigint }>> {
  const url = getRpcUrl('solana');
  try {
    const params: Record<string, unknown> =
      mint ? { owner, mint } : { owner, programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [owner, params, { encoding: 'jsonParsed' }],
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      result?: { value?: Array<{ account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } } }> };
    };
    if (!json.result?.value) return [];
    return json.result.value.map((v) => ({
      mint: v.account.data.parsed.info.mint,
      amount: BigInt(v.account.data.parsed.info.tokenAmount.amount),
    }));
  } catch {
    return [];
  }
}

// ─── Core verification ─────────────────────────────────────────────────────

/**
 * Check whether a wallet holds the required token/NFT specified by the gate.
 * Queries the chain via RPC calls:
 *   - EVM  : eth_call balanceOf() / ownerOf()
 *   - Solana: getTokenAccountsByOwner
 *
 * Returns true if the wallet satisfies the gate requirements.
 */
export async function checkTokenGate(
  gate: TokenGate,
  walletAddress: string,
): Promise<boolean> {
  if (!walletAddress) return false;

  // Solana chain
  if (gate.chain === 'solana') {
    const accounts = await solanaGetTokenAccounts(walletAddress, gate.contractAddress);
    if (accounts.length === 0) return false;

    const total = accounts.reduce((sum, acc) => sum + acc.amount, 0n);

    if (gate.type === 'erc721') {
      return total >= 1n;
    }

    const minBalance = gate.minBalance ?? 1;
    const decimals = gate.minBalanceDecimals ?? 0;
    const required = BigInt(minBalance) * BigInt(10n ** BigInt(decimals));
    return total >= required;
  }

  // EVM chains
  const addr = walletAddress.toLowerCase();

  switch (gate.type) {
    case 'erc20': {
      const data = `${ERC20_BALANCE_OF}${addr.slice(2).padStart(64, '0')}`;
      const result = await ethCall(gate.chain, gate.contractAddress, data);
      if (!result || result === '0x') return false;
      const balance = decodeUint256(result);
      const minBalance = BigInt(gate.minBalance ?? 1);
      const decimals = gate.minBalanceDecimals ?? 0;
      const required = minBalance * BigInt(10n ** BigInt(decimals));
      return balance >= required;
    }

    case 'erc721': {
      if (gate.tokenId) {
        const tokenIdHex = BigInt(gate.tokenId).toString(16).padStart(64, '0');
        const data = `${ERC721_OWNER_OF}${tokenIdHex}`;
        const result = await ethCall(gate.chain, gate.contractAddress, data);
        if (!result || result === '0x') return false;
        const owner = `0x${result.slice(-40)}`.toLowerCase();
        return owner === addr;
      }
      // No tokenId — check if they hold at least 1
      const data = `${ERC20_BALANCE_OF}${addr.slice(2).padStart(64, '0')}`;
      const result = await ethCall(gate.chain, gate.contractAddress, data);
      if (!result || result === '0x') return false;
      return decodeUint256(result) >= 1n;
    }

    case 'erc1155': {
      if (!gate.tokenId) return false;
      const tokenIdHex = BigInt(gate.tokenId).toString(16).padStart(64, '0');
      const data = `${ERC1155_BALANCE_OF}${addr.slice(2).padStart(64, '0')}${tokenIdHex}`;
      const result = await ethCall(gate.chain, gate.contractAddress, data);
      if (!result || result === '0x') return false;
      return decodeUint256(result) >= 1n;
    }

    default:
      return false;
  }
}

/**
 * Resolve a human-readable symbol for the token gate contract.
 * ERC20: calls symbol() on chain
 * ERC721/1155: returns "NFT" fallback
 * Solana: returns shortened mint address
 */
export async function resolveTokenGateSymbol(gate: TokenGate): Promise<string> {
  if (gate.chain === 'solana') {
    return `${gate.contractAddress.slice(0, 8)}...`;
  }

  const result = await ethCall(gate.chain, gate.contractAddress, ERC20_SYMBOL);
  if (result && result !== '0x') {
    try {
      const sym = decodeString(result);
      if (sym) return sym;
    } catch {
      /* fall through */
    }
  }

  if (gate.type === 'erc721') return 'NFT';
  if (gate.type === 'erc1155') return 'Multi-Token';

  return gate.contractAddress.slice(0, 8);
}

/**
 * Resolve NFT metadata (name + image) from tokenURI.
 * Only works for ERC721 and ERC1155 with a tokenId.
 * Fetches the tokenURI, then fetches the JSON metadata from that URI.
 */
export async function resolveNFTMetadata(
  gate: TokenGate,
): Promise<{ name: string; image: string } | null> {
  if (!gate.tokenId || gate.type === 'erc20' || gate.chain === 'solana') {
    return null;
  }

  const selector =
    gate.type === 'erc1155' ? ERC1155_URI : ERC721_TOKEN_URI;
  const tokenIdHex = BigInt(gate.tokenId).toString(16).padStart(64, '0');
  const data = `${selector}${tokenIdHex}`;
  const result = await ethCall(gate.chain, gate.contractAddress, data);
  if (!result || result === '0x') return null;

  let uri: string;
  try {
    uri = decodeString(result);
  } catch {
    return null;
  }
  if (!uri) return null;

  // Handle IPFS URIs
  if (uri.startsWith('ipfs://')) {
    uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }

  try {
    const res = await fetch(uri);
    if (!res.ok) return null;
    const meta = (await res.json()) as { name?: string; image?: string };
    let image = meta.image ?? '';
    if (image.startsWith('ipfs://')) {
      image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return { name: meta.name ?? `NFT #${gate.tokenId}`, image };
  } catch {
    return null;
  }
}

// ─── Verification cache (in-memory, 5-min TTL) ────────────────────────────

interface CacheEntry {
  result: boolean;
  expiresAt: number;
}

const verificationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(gate: TokenGate, walletAddress: string): string {
  return `${gate.chain}:${gate.contractAddress}:${gate.tokenId ?? ''}:${gate.type}:${walletAddress.toLowerCase()}`;
}

/**
 * Check token gate with in-memory caching (5-minute TTL).
 * Use this for client-side checks. For server-side, use the KV-backed
 * approach in the API route handler.
 */
export async function checkTokenGateCached(
  gate: TokenGate,
  walletAddress: string,
): Promise<boolean> {
  if (!walletAddress) return false;

  const key = cacheKey(gate, walletAddress);
  const cached = verificationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = await checkTokenGate(gate, walletAddress);
  verificationCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  // Evict oldest entry when cache grows too large
  if (verificationCache.size > 1000) {
    const entries = [...verificationCache.entries()];
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const oldest = entries[0];
    if (oldest) verificationCache.delete(oldest[0]);
  }

  return result;
}

/**
 * Build a human-readable gate description string.
 */
export function formatGateDescription(
  gate: TokenGate,
  symbol: string,
): string {
  const chainLabel = CHAIN_LABELS[gate.chain];

  if (gate.type === 'erc721' && gate.tokenId) {
    return `Requires ownership of ${symbol} #${gate.tokenId} on ${chainLabel}`;
  }

  if (gate.type === 'erc721') {
    return `Requires any ${symbol} on ${chainLabel}`;
  }

  if (gate.type === 'erc1155' && gate.tokenId) {
    return `Requires ${symbol} #${gate.tokenId} on ${chainLabel}`;
  }

  const balance = gate.minBalance ?? 1;
  return `Requires ${balance} ${symbol} on ${chainLabel}`;
}

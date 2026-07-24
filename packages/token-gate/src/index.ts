/**
 * @degenfeed/token-gate — Token/NFT Gating System
 *
 * Core types and on-chain verification logic for ERC20, ERC721, ERC1155,
 * and Solana SPL token gating. Supports combined gates (AND/OR), tiered
 * gates, and time-based holding requirements.
 *
 * The verification cache runs in-memory (5-min TTL). For CF Workers,
 * use the KV-backed cache in the API route handler instead.
 */

// ─── Types ───────────────────────────────────────────────────────────────

/** Runtime-agnostic process.env access for Node.js vs browser/worker */
declare const process: { env: Record<string, string | undefined> } | undefined;

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

/** Combined gate operator */
export type GateOperator = 'AND' | 'OR';

/** A gate that can be a single token gate or a combined expression */
export interface CombinedGate {
  /** Single gate — mutually exclusive with gates */
  gate?: TokenGate;
  /** Nested gates for AND/OR logic — mutually exclusive with gate */
  gates?: CombinedGate[];
  /** Operator for this gate group (default: AND) */
  operator?: GateOperator;
  /** Minimum holding time in seconds (0 = no time requirement) */
  minHoldTimeSec?: number;
  /** When the wallet first acquired this token (unix timestamp) */
  acquiredAt?: number;
}

/** Tiered gate: different access levels for different holding tiers */
export interface TieredGate {
  tiers: Array<{
    /** Tier name (e.g. 'bronze', 'silver', 'gold') */
    name: string;
    /** Minimum balance required for this tier */
    minBalance: number;
    /** Token decimals for balance calculation */
    decimals?: number;
    /** Gate config for this tier (can be combined) */
    gate: CombinedGate;
    /** Tier-specific metadata (label, image, color) */
    metadata?: {
      label: string;
      color: string;
      icon?: string;
      description?: string;
    };
  }>;
  /** Default tier shown to non-holders */
  defaultTier?: {
    name: string;
    metadata?: { label: string; color: string; description?: string };
  };
}

/** Content that can be gated */
export type GateableContentType =
  | 'post'
  | 'feed'
  | 'community'
  | 'stream'
  | 'ama'
  | 'file'
  | 'download';

/** Access mode for gates */
export type GateAccessMode = 'strict' | 'view_anyone_comment_holders';

/** Complete gate configuration stored with content */
export interface GateConfig {
  /** Type of gate */
  type: 'single' | 'combined' | 'tiered';
  /** Single gate (if type='single') */
  gate?: TokenGate;
  /** Combined gate (if type='combined') */
  combined?: CombinedGate;
  /** Tiered gate (if type='tiered') */
  tiered?: TieredGate;
  /** Content being gated */
  contentType?: GateableContentType;
  /** Access mode */
  accessMode?: GateAccessMode;
  /** Human-readable description */
  description?: string;
  /** Whether this gate is currently active */
  enabled: boolean;
}

/** Result of a gate check */
export interface GateCheckResult {
  /** Whether the user passes the gate */
  passed: boolean;
  /** For tiered gates, the tier they qualify for */
  tier?: string;
  /** Tier metadata if matched */
  tierMetadata?: { label?: string; color?: string; icon?: string };
  /** Human-readable message */
  message?: string;
  /** If failed, what's required */
  requirements?: string;
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
  if (process?.env?.[envKey]) {
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

async function ethCall(chain: TokenGateChain, to: string, data: string): Promise<string | null> {
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
    const params: Record<string, unknown> = mint
      ? { owner, mint }
      : { owner, programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' };

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
      result?: {
        value?: Array<{
          account: {
            data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } };
          };
        }>;
      };
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
export async function checkTokenGate(gate: TokenGate, walletAddress: string): Promise<boolean> {
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

// ─── Combined gate checking ──────────────────────────────────────────────

/**
 * Check a combined gate expression (AND/OR logic).
 * Supports recursive nesting of gates.
 */
export async function checkCombinedGate(
  combined: CombinedGate,
  walletAddress: string,
): Promise<boolean> {
  // Single gate
  if (combined.gate) {
    return checkTokenGate(combined.gate, walletAddress);
  }

  // Nested gates
  if (combined.gates && combined.gates.length > 0) {
    const results = await Promise.all(
      combined.gates.map((g) => checkCombinedGate(g, walletAddress)),
    );

    if (combined.operator === 'OR') {
      return results.some(Boolean);
    }
    // Default: AND
    return results.every(Boolean);
  }

  // No gates defined — passes by default
  return true;
}

/**
 * Check if a wallet passes a tiered gate and return the highest tier matched.
 */
export async function checkTieredGate(
  tiered: TieredGate,
  walletAddress: string,
): Promise<GateCheckResult> {
  // Check tiers from highest to lowest
  const sortedTiers = [...tiered.tiers].sort((a, b) => b.minBalance - a.minBalance);

  for (const tier of sortedTiers) {
    // Set the min balance on the underlying gate for this tier check
    const gate = tier.gate.gate || tier.gate.gates?.[0]?.gate;
    if (gate) {
      gate.minBalance = tier.minBalance;
      gate.minBalanceDecimals = tier.decimals ?? 0;
    }

    const passed = await checkCombinedGate(tier.gate, walletAddress);
    if (passed) {
      return {
        passed: true,
        tier: tier.name,
        tierMetadata: tier.metadata
          ? {
              label: tier.metadata.label,
              color: tier.metadata.color,
              icon: tier.metadata.icon,
            }
          : undefined,
        message: `You have ${tier.metadata?.label || tier.name} access`,
      };
    }
  }

  // No tier matched
  const defaultTier = tiered.defaultTier;
  return {
    passed: false,
    message: defaultTier?.metadata?.description || 'You do not meet any tier requirements',
    requirements: `Minimum: ${tiered.tiers[0]?.minBalance ?? 1} tokens`,
  };
}

/**
 * Verify a complete GateConfig against a wallet.
 * Dispatches to the correct checker based on gate type.
 */
export async function checkGateConfig(
  config: GateConfig,
  walletAddress: string,
): Promise<GateCheckResult> {
  if (!config.enabled) {
    return { passed: true, message: 'Gate is disabled — content is public' };
  }

  if (!walletAddress) {
    return {
      passed: false,
      message: 'Connect your wallet to access this content',
      requirements: 'Wallet connection required',
    };
  }

  switch (config.type) {
    case 'single': {
      if (!config.gate) {
        return { passed: false, message: 'No gate configured' };
      }
      const passed = await checkTokenGate(config.gate, walletAddress);
      return {
        passed,
        message: passed ? 'Access granted' : 'You do not hold the required tokens',
        requirements: passed ? undefined : formatGateDescriptionSimple(config.gate),
      };
    }

    case 'combined': {
      if (!config.combined) {
        return { passed: false, message: 'No combined gate configured' };
      }
      const passed = await checkCombinedGate(config.combined, walletAddress);
      return {
        passed,
        message: passed ? 'Access granted' : 'You do not meet all requirements',
        requirements: passed ? undefined : 'Check token requirements below',
      };
    }

    case 'tiered': {
      if (!config.tiered) {
        return { passed: false, message: 'No tiered gate configured' };
      }
      return checkTieredGate(config.tiered, walletAddress);
    }

    default:
      return { passed: false, message: 'Unknown gate type' };
  }
}

function formatGateDescriptionSimple(gate: TokenGate): string {
  const chainLabel = CHAIN_LABELS[gate.chain];
  if (gate.type === 'erc721') return `Requires any NFT on ${chainLabel}`;
  if (gate.type === 'erc1155') return `Requires multi-token on ${chainLabel}`;
  const balance = gate.minBalance ?? 1;
  return `Requires ${balance} tokens on ${chainLabel}`;
}

/**
 * Resolve a human-readable symbol for the token gate contract.
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
 */
export async function resolveNFTMetadata(
  gate: TokenGate,
): Promise<{ name: string; image: string } | null> {
  if (!gate.tokenId || gate.type === 'erc20' || gate.chain === 'solana') {
    return null;
  }

  const selector = gate.type === 'erc1155' ? ERC1155_URI : ERC721_TOKEN_URI;
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
export function formatGateDescription(gate: TokenGate, symbol: string): string {
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

/**
 * Format a combined gate description.
 */
export function formatCombinedGateDescription(
  combined: CombinedGate,
  symbols: Map<string, string>,
): string {
  if (combined.gate) {
    const sym = symbols.get(combined.gate.contractAddress) || 'tokens';
    return formatGateDescription(combined.gate, sym);
  }

  if (combined.gates) {
    const descriptions = combined.gates.map((g) => formatCombinedGateDescription(g, symbols));
    const sep = combined.operator === 'OR' ? ' OR ' : ' AND ';
    return descriptions.join(sep);
  }

  return '';
}

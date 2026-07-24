/**
 * @degenfeed/zora-sdk — Cross-Chain Registry
 *
 * Maps creator identities across chains and protocols.
 * Solves: "I have a coin on Base. How do I find it on Solana?"
 *
 * Stores mappings in Cloudflare Workers KV under the prefix `xchain:`.
 * Each mapping is a bidirectional link between a (chain, protocol, creatorId, token) tuple.
 */

import type { Chain } from '../types';

// ─── Portable KV interface (works with CF Workers, Node, Deno) ──────────────

export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const XCHAIN_PREFIX = 'xchain:';
const TTL_1Y = 60 * 60 * 24 * 365;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrossChainMapping {
  /** Unique mapping ID */
  id: string;
  /** Source protocol + creator identity */
  source: {
    chainId: number;
    protocol: string;
    creatorId: string;
    token: string;
  };
  /** Target protocol + creator identity */
  target: {
    chainId: number;
    protocol: string;
    creatorId: string;
    token: string;
  };
  /** When the mapping was created */
  createdAt: number;
  /** Verification method */
  verifiedBy: 'creator' | 'bridge' | 'governance';
}

export interface CrossChainToken {
  chain: Chain;
  chainId: number;
  protocol: string;
  creatorId: string;
  address: string;
  deployedAt: number;
  symbol?: string;
  price?: string;
  volume24h?: string;
  supporters?: number;
}

export interface UnifiedCreatorProfile {
  protocol: string;
  creatorId: string;
  displayName: string;
  tokens: {
    base?: { address: string; symbol: string; price: string; volume: string };
    solana?: { mint: string; symbol: string; price: string; volume: string };
    polygon?: { address: string; symbol: string; price: string; volume: string };
    farcaster?: { fid: number; coinAddress: string };
    lens?: { profileId: string; coinAddress: string };
  };
  totalVolume: string;
  totalSupporters: number;
  crossChainTips: number;
}

// ─── Key builders ───────────────────────────────────────────────────────────

function creatorKey(protocol: string, creatorId: string): string {
  return `${XCHAIN_PREFIX}creator:${protocol}:${creatorId}`;
}

function chainTokenKey(chainId: number, token: string): string {
  return `${XCHAIN_PREFIX}chain:${chainId}:${token.toLowerCase()}`;
}

function resolveKey(sourceChain: number, sourceToken: string, targetChain: number): string {
  return `${XCHAIN_PREFIX}resolve:${sourceChain}:${sourceToken.toLowerCase()}:${targetChain}`;
}

// ─── KV helpers ─────────────────────────────────────────────────────────────

async function kvGetJson<T>(kv: KVStore, key: string): Promise<T | null> {
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvPutJson(kv: KVStore, key: string, value: unknown): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn(`[xchain] KV put failed for ${key}:`, String(err));
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

export class CrossChainRegistry {
  private kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;
  }

  /**
   * Register a cross-chain token mapping.
   * Creates bidirectional links so either chain can find the other.
   */
  async register(opts: CrossChainMapping): Promise<void> {
    const now = Date.now();
    const mapping: CrossChainMapping = {
      ...opts,
      createdAt: opts.createdAt || now,
    };

    const id = `${opts.source.chainId}:${opts.source.token.toLowerCase()}:${opts.target.chainId}:${opts.target.token.toLowerCase()}`;
    mapping.id = id;

    // Store under creator key (source protocol)
    const cKey = creatorKey(opts.source.protocol, opts.source.creatorId);
    const existing = (await kvGetJson<CrossChainMapping[]>(this.kv, cKey)) || [];
    const idx = existing.findIndex((m) => m.id === id);
    if (idx >= 0) {
      existing[idx] = mapping;
    } else {
      existing.push(mapping);
    }
    await kvPutJson(this.kv, cKey, existing);

    // Also store under target protocol's creator key
    const tKey = creatorKey(opts.target.protocol, opts.target.creatorId);
    const tExisting = (await kvGetJson<CrossChainMapping[]>(this.kv, tKey)) || [];
    const tIdx = tExisting.findIndex((m) => m.id === id);
    if (tIdx >= 0) {
      tExisting[tIdx] = mapping;
    } else {
      tExisting.push(mapping);
    }
    await kvPutJson(this.kv, tKey, tExisting);

    // Resolve key: source chain + token → target chain
    await kvPutJson(
      this.kv,
      resolveKey(opts.source.chainId, opts.source.token, opts.target.chainId),
      {
        token: opts.target.token,
        chainId: opts.target.chainId,
        protocol: opts.target.protocol,
        creatorId: opts.target.creatorId,
      },
    );

    // Resolve key: target chain + token → source chain (bidirectional)
    await kvPutJson(
      this.kv,
      resolveKey(opts.target.chainId, opts.target.token, opts.source.chainId),
      {
        token: opts.source.token,
        chainId: opts.source.chainId,
        protocol: opts.source.protocol,
        creatorId: opts.source.creatorId,
      },
    );

    // Chain-token lookup (source)
    await kvPutJson(this.kv, chainTokenKey(opts.source.chainId, opts.source.token), {
      protocol: opts.source.protocol,
      creatorId: opts.source.creatorId,
      chainId: opts.source.chainId,
    });

    // Chain-token lookup (target)
    await kvPutJson(this.kv, chainTokenKey(opts.target.chainId, opts.target.token), {
      protocol: opts.target.protocol,
      creatorId: opts.target.creatorId,
      chainId: opts.target.chainId,
    });
  }

  /**
   * Get all tokens for a creator across all chains.
   */
  async getCreatorTokens(protocol: string, creatorId: string): Promise<CrossChainToken[]> {
    const key = creatorKey(protocol, creatorId);
    const mappings = await kvGetJson<CrossChainMapping[]>(this.kv, key);
    if (!mappings) return [];

    const tokenMap = new Map<string, CrossChainToken>();

    for (const m of mappings) {
      // Source token
      const sId = `${m.source.chainId}:${m.source.token}`;
      if (!tokenMap.has(sId)) {
        tokenMap.set(sId, {
          chain: this.chainIdToName(m.source.chainId),
          chainId: m.source.chainId,
          protocol: m.source.protocol,
          creatorId: m.source.creatorId,
          address: m.source.token,
          deployedAt: m.createdAt,
        });
      }

      // Target token
      const tId = `${m.target.chainId}:${m.target.token}`;
      if (!tokenMap.has(tId)) {
        tokenMap.set(tId, {
          chain: this.chainIdToName(m.target.chainId),
          chainId: m.target.chainId,
          protocol: m.target.protocol,
          creatorId: m.target.creatorId,
          address: m.target.token,
          deployedAt: m.createdAt,
        });
      }
    }

    return Array.from(tokenMap.values());
  }

  /**
   * Find the equivalent token on another chain.
   */
  async resolveToken(
    sourceChain: number,
    sourceToken: string,
    targetChain: number,
  ): Promise<{ token: string; chainId: number; protocol: string; creatorId: string } | null> {
    const key = resolveKey(sourceChain, sourceToken, targetChain);
    return kvGetJson<{ token: string; chainId: number; protocol: string; creatorId: string }>(
      this.kv,
      key,
    );
  }

  /**
   * Get a unified creator profile with all cross-chain token info.
   */
  async getUnifiedProfile(
    protocol: string,
    creatorId: string,
    displayName?: string,
  ): Promise<UnifiedCreatorProfile | null> {
    const tokens = await this.getCreatorTokens(protocol, creatorId);
    if (tokens.length === 0) return null;

    const profile: UnifiedCreatorProfile = {
      protocol,
      creatorId,
      displayName: displayName || `${protocol}:${creatorId}`,
      tokens: {},
      totalVolume: '0',
      totalSupporters: 0,
      crossChainTips: 0,
    };

    for (const t of tokens) {
      switch (t.chain) {
        case 'base':
          profile.tokens.base = {
            address: t.address,
            symbol: t.symbol || '',
            price: t.price || '0',
            volume: t.volume24h || '0',
          };
          break;
        case 'solana':
          profile.tokens.solana = {
            mint: t.address,
            symbol: t.symbol || '',
            price: t.price || '0',
            volume: t.volume24h || '0',
          };
          break;
        case 'polygon':
          profile.tokens.polygon = {
            address: t.address,
            symbol: t.symbol || '',
            price: t.price || '0',
            volume: t.volume24h || '0',
          };
          break;
      }
      if (t.protocol === 'farcaster') {
        profile.tokens.farcaster = { fid: Number(t.creatorId), coinAddress: t.address };
      }
      if (t.protocol === 'lens') {
        profile.tokens.lens = { profileId: t.creatorId, coinAddress: t.address };
      }
    }

    return profile;
  }

  /**
   * Look up what protocol + creator owns a specific token on a chain.
   */
  async lookupToken(
    chainId: number,
    token: string,
  ): Promise<{ protocol: string; creatorId: string; chainId: number } | null> {
    return kvGetJson<{ protocol: string; creatorId: string; chainId: number }>(
      this.kv,
      chainTokenKey(chainId, token),
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private chainIdToName(chainId: number): Chain {
    switch (chainId) {
      case 8453:
        return 'base';
      case 1:
        return 'ethereum';
      case 10:
        return 'optimism';
      case 42161:
        return 'arbitrum';
      case 137:
        return 'polygon';
      case 901:
        return 'solana'; // Solana convention in our registry
      default:
        return 'ethereum';
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createCrossChainRegistry(kv: KVStore): CrossChainRegistry {
  return new CrossChainRegistry(kv);
}

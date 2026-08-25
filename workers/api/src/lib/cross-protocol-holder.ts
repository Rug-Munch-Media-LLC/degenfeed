/**
 * @degenfeed/api-worker — Cross-Protocol Holder Identity System
 *
 * ONE identity across ALL protocols. A holder on Nostr, Farcaster, Bluesky,
 * Lens, Mastodon — all resolve to the same wallet, same identity.
 *
 * Features:
 *   - Multi-protocol holder merge: same wallet across protocols
 *   - Cross-protocol leaderboard: top holders across all platforms
 *   - Holder badges: shows which protocols a holder is active on
 *   - Protocol verification: verify a holder's identity on any protocol
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolIdentity {
  protocol: string;
  /** Native identity (FID, pubkey, DID, profileId, etc.) */
  identity: string;
  /** Display name on this protocol (optional) */
  displayName?: string;
  /** Avatar URL on this protocol (optional) */
  avatarUrl?: string;
  /** Whether this identity is verified */
  verified: boolean;
  /** Last verified timestamp */
  lastVerifiedAt?: number;
}

export interface CrossProtocolHolder {
  /** Primary wallet address (lowercase) */
  wallet: string;
  /** All protocol identities linked to this wallet */
  identities: ProtocolIdentity[];
  /** Total amount of a specific coin held */
  balance: string;
  /** USD value of holdings */
  usdValue: number;
  /** Percentage of total supply held */
  supplyPercent: number;
  /** Rank on the leaderboard */
  rank?: number;
  /** First purchase timestamp */
  firstPurchaseAt?: number;
  /** Total volume traded */
  totalVolume: string;
  /** Protocols this holder is active on (detected activity) */
  activeProtocols: string[];
}

export interface CrossProtocolLeaderboardEntry {
  wallet: string;
  rank: number;
  balance: string;
  usdValue: number;
  supplyPercent: number;
  /** Primary display name (best guess from available protocols) */
  displayName: string;
  /** Protocols they're active on */
  activeProtocols: string[];
  /** Their best avatar */
  avatarUrl?: string;
  /** Total volume traded */
  totalVolume: string;
}

// ─── KV Key Patterns ───────────────────────────────────────────────────

const HOLDER_PREFIX = 'holder:';
const HOLDER_PROTOCOL_INDEX = 'holder:protocol:';
const LEADERBOARD_KEY = 'leaderboard:cross-protocol';
const TTL_1H = 60 * 60;
const TTL_24H = 60 * 60 * 24;

// ─── Identity Resolution ───────────────────────────────────────────────

/**
 * Resolve all protocol identities linked to a wallet address.
 */
export async function getHolderIdentities(
  walletAddress: string,
  env: Env,
): Promise<ProtocolIdentity[]> {
  const identities: ProtocolIdentity[] = [];
  if (!env.IDENTITIES) return identities;

  try {
    const identityKey = `identity:${walletAddress.toLowerCase()}`;
    const raw = await env.IDENTITIES.get(identityKey);
    if (!raw) return identities;

    const identity = JSON.parse(raw) as Record<string, Record<string, string>>;

    for (const [protocol, data] of Object.entries(identity)) {
      let identityStr: string | null = null;

      switch (protocol) {
        case 'farcaster':
          identityStr = data.fid || null;
          break;
        case 'nostr':
          identityStr = data.pubkey || null;
          break;
        case 'bluesky':
          identityStr = data.did || null;
          break;
        case 'lens':
          identityStr = data.profileId || null;
          break;
        case 'mastodon':
        case 'activitypub':
          identityStr = data.id || data.username || null;
          break;
        case 'telegram':
          identityStr = data.chatId || data.username || null;
          break;
        case 'discord':
          identityStr = data.id || data.username || null;
          break;
        default:
          identityStr = data.id || null;
      }

      if (identityStr) {
        identities.push({
          protocol,
          identity: identityStr,
          displayName: data.displayName || data.username || data.name,
          avatarUrl: data.avatarUrl || data.picture,
          verified: data.verified === 'true',
          lastVerifiedAt: data.lastVerified ? Number(data.lastVerified) : undefined,
        });
      }
    }
  } catch {
    // Non-critical
  }

  return identities;
}

/**
 * Look up a wallet address by protocol identity.
 * Reverse lookup — "who owns this FID / Nostr pubkey?"
 */
export async function resolveWalletFromProtocol(
  protocol: string,
  identity: string,
  env: Env,
): Promise<string | null> {
  if (!env.IDENTITIES) return null;

  try {
    const indexKey = `${HOLDER_PROTOCOL_INDEX}${protocol}:${identity}`;
    const raw = await env.IDENTITIES.get(indexKey);
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Check if two protocol identities belong to the same person.
 * Returns the shared wallet if found.
 */
export async function resolveCommonWallet(
  identityA: { protocol: string; identity: string },
  identityB: { protocol: string; identity: string },
  env: Env,
): Promise<string | null> {
  // Check if identityA resolves to a wallet
  const walletA = await resolveWalletFromProtocol(identityA.protocol, identityA.identity, env);
  if (!walletA) return null;

  // Check if identityB resolves to the same wallet
  const walletB = await resolveWalletFromProtocol(identityB.protocol, identityB.identity, env);
  if (walletB === walletA) return walletA;

  return null;
}

// ─── Cross-Protocol Leaderboard ────────────────────────────────────────

/**
 * Get cross-protocol holder leaderboard for a specific coin.
 * Merges the same wallet across protocols into one entry.
 */
export async function getCrossProtocolLeaderboard(
  coinAddress: string,
  env: Env,
  limit: number = 50,
): Promise<CrossProtocolLeaderboardEntry[]> {
  try {
    // Try to get cached leaderboard
    const cacheKey = `${LEADERBOARD_KEY}:${coinAddress.toLowerCase()}:${limit}`;
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CrossProtocolLeaderboardEntry[];
    }

    // Fetch holders from the coin's holder list
    const holders = await fetchCoinHolders(coinAddress, env);
    const enriched: CrossProtocolLeaderboardEntry[] = [];

    for (let i = 0; i < Math.min(holders.length, limit); i++) {
      const h = holders[i];
      if (!h) continue;
      const identities = await getHolderIdentities(h.wallet, env);

      // Count active protocols (those with recent activity)
      const activeProtocols = identities.map((id) => id.protocol);

      // Best display name and avatar
      const displayName =
        identities.find((id) => id.displayName)?.displayName ||
        `${h.wallet.slice(0, 6)}...${h.wallet.slice(-4)}`;
      const avatarUrl = identities.find((id) => id.avatarUrl)?.avatarUrl;

      enriched.push({
        wallet: h.wallet,
        rank: i + 1,
        balance: h.balance,
        usdValue: h.usdValue,
        supplyPercent: h.supplyPercent,
        displayName,
        activeProtocols,
        avatarUrl,
        totalVolume: h.totalVolume || '0',
      });
    }

    // Cache for 1 hour
    if (env.CACHE) {
      await env.CACHE.put(cacheKey, JSON.stringify(enriched), { expirationTtl: TTL_1H });
    }

    return enriched;
  } catch (err) {
    console.warn('[cross-protocol-holder] Leaderboard fetch failed:', String(err));
    return [];
  }
}

// ─── Holder Badges ─────────────────────────────────────────────────────

export interface HolderBadge {
  type: string;
  label: string;
  icon: string;
  description: string;
}

/**
 * Get badges for a holder based on their protocol activity.
 */
export async function getHolderBadges(
  walletAddress: string,
  coinAddress: string,
  env: Env,
): Promise<HolderBadge[]> {
  const badges: HolderBadge[] = [];
  const identities = await getHolderIdentities(walletAddress, env);

  // Badge: Multi-Protocol — active on 3+ protocols
  if (identities.length >= 3) {
    badges.push({
      type: 'multi_protocol',
      label: 'Multi-Protocol',
      icon: '🌐',
      description: `Active on ${identities.length} protocols`,
    });
  }

  // Badge: Full-Spectrum — active on 5+ protocols
  if (identities.length >= 5) {
    badges.push({
      type: 'full_spectrum',
      label: 'Full Spectrum',
      icon: '🌈',
      description: 'Active on 5+ protocols',
    });
  }

  // Badge: OG Farcaster — if they have Farcaster identity
  if (identities.some((id) => id.protocol === 'farcaster')) {
    badges.push({
      type: 'farcaster_native',
      label: 'Farcaster Native',
      icon: '⬡',
      description: 'Connected on Farcaster',
    });
  }

  // Badge: Nostr Purist — if they have Nostr identity
  if (identities.some((id) => id.protocol === 'nostr')) {
    badges.push({
      type: 'nostr_purist',
      label: 'Nostr Purist',
      icon: '⚡',
      description: 'Connected on Nostr',
    });
  }

  // Badge: OG Collector — if first purchase was early
  const holder = await getHolderRecord(walletAddress, coinAddress, env);
  if (holder?.firstPurchaseAt) {
    const daysSince = (Date.now() - holder.firstPurchaseAt) / 86400000;
    if (daysSince > 30) {
      badges.push({
        type: 'og_collector',
        label: 'OG Collector',
        icon: '🏆',
        description: 'Holding for 30+ days',
      });
    }
  }

  return badges;
}

// ─── Internal helpers ──────────────────────────────────────────────────

interface RawHolderEntry {
  wallet: string;
  balance: string;
  usdValue: number;
  supplyPercent: number;
  totalVolume?: string;
  firstPurchaseAt?: number;
}

async function fetchCoinHolders(coinAddress: string, env: Env): Promise<RawHolderEntry[]> {
  if (!env.CACHE) return [];

  try {
    const holderKey = `${HOLDER_PREFIX}${coinAddress.toLowerCase()}`;
    const raw = await env.CACHE.get(holderKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RawHolderEntry[];
    return parsed.sort((a, b) => Number(b.balance) - Number(a.balance));
  } catch {
    return [];
  }
}

async function getHolderRecord(
  wallet: string,
  coinAddress: string,
  env: Env,
): Promise<RawHolderEntry | null> {
  const holders = await fetchCoinHolders(coinAddress, env);
  return holders.find((h) => h.wallet.toLowerCase() === wallet.toLowerCase()) || null;
}

// ─── KV write helpers ─────────────────────────────────────────────────

/**
 * Record a holder's purchase for cross-protocol identity tracking.
 * Called when a purchase happens from any protocol.
 */
export async function recordHolderPurchase(
  walletAddress: string,
  coinAddress: string,
  balance: string,
  usdValue: number,
  supplyPercent: number,
  _protocols: string[],
  env: Env,
): Promise<void> {
  if (!env.CACHE) return;

  try {
    const holderKey = `${HOLDER_PREFIX}${coinAddress.toLowerCase()}`;
    const raw = await env.CACHE.get(holderKey);
    const holders: RawHolderEntry[] = raw ? JSON.parse(raw) : [];

    const existing = holders.findIndex(
      (h) => h.wallet.toLowerCase() === walletAddress.toLowerCase(),
    );

    if (existing >= 0 && holders[existing]) {
      holders[existing].balance = balance;
      holders[existing].usdValue = usdValue;
      holders[existing].supplyPercent = supplyPercent;
    } else {
      holders.push({
        wallet: walletAddress.toLowerCase(),
        balance,
        usdValue,
        supplyPercent,
        totalVolume: '0',
        firstPurchaseAt: Date.now(),
      });
    }

    await env.CACHE.put(holderKey, JSON.stringify(holders), { expirationTtl: TTL_24H });

    // Invalidate leaderboard cache
    const leaderboardKey = `${LEADERBOARD_KEY}:${coinAddress.toLowerCase()}`;
    await env.CACHE.delete(leaderboardKey).catch(() => {});
  } catch (err) {
    console.warn('[cross-protocol-holder] recordHolderPurchase failed:', String(err));
  }
}

// ─── Protocol index for reverse lookups ───────────────────────────────

/**
 * Index a protocol identity → wallet mapping.
 * This lets us resolve "who owns this FID" to a wallet address.
 */
export async function indexProtocolIdentity(
  walletAddress: string,
  protocol: string,
  identity: string,
  env: Env,
): Promise<void> {
  if (!env.IDENTITIES) return;

  try {
    const indexKey = `${HOLDER_PROTOCOL_INDEX}${protocol}:${identity}`;
    await env.IDENTITIES.put(indexKey, walletAddress.toLowerCase(), { expirationTtl: TTL_24H });
  } catch (err) {
    console.warn('[cross-protocol-holder] Index identity failed:', String(err));
  }
}

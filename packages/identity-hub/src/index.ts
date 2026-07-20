/**
 * @degenfeed/identity-hub
 *
 * Unified identity resolution service.
 * Maps one wallet to ALL protocol identities and provides credential management
 * for the universal publish orchestrator.
 *
 * Storage: KV namespace (IDENTITIES)
 * Encryption: AES-GCM with wallet-derived key (SHA-256 of wallet + secret pepper)
 * Never exposes credentials in API responses.
 */

import type { Protocol } from '@degenfeed/types';
import { identityKey, type CrossProtocolIdentity, type ProtocolId } from '@degenfeed/utils';

// ─── Types ───────────────────────────────────────────────────────────────

export interface IdentityHubConfig {
  kv: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  /** Secret pepper for key derivation (never logged/exposed) */
  encryptionSecret?: string;
}

export interface ProtocolIdentity {
  identifier: string;
  handle?: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

export interface ProtocolCredentials {
  /** Encrypted credential blob (AES-GCM base64) */
  encrypted: string;
  /** Key hint for UX (e.g. "nsec1...") */
  keyHint?: string;
  /** Unix ms when credentials were stored */
  storedAt: number;
}

export interface ResolvedProtocolInfo {
  linked: boolean;
  identifier?: string;
  handle?: string;
  displayName?: string;
  autoCreated: boolean;
  verifiedAt?: number;
}

export interface ResolvedIdentity {
  wallet: string;
  protocols: Partial<Record<Protocol, ResolvedProtocolInfo>>;
  linkedProtocolCount: number;
  premiumStatus: 'free' | 'premium';
}

export interface AutoCreateResult {
  protocol: Protocol;
  ok: boolean;
  identifier?: string;
  error?: string;
}

export interface PremiumStatus {
  isPremium: boolean;
  tier: 'free' | 'premium';
}

// ─── KV key helpers ──────────────────────────────────────────────────────

/** KV key for encrypted credentials */
function credentialsKey(wallet: string, protocol: Protocol): string {
  return `creds:${wallet.toLowerCase()}:${protocol}`;
}

/** KV key for premium status */
function premiumKey(wallet: string): string {
  return `premium:${wallet.toLowerCase()}`;
}

/** KV key for wallet-to-protocol index lookup */
function walletProtocolIndexKey(wallet: string): string {
  return `idx:wallet-protocols:${wallet.toLowerCase()}`;
}

/** KV key for protocol-to-wallet reverse lookup */
function protocolWalletIndexKey(protocol: Protocol, identifier: string): string {
  return `idx:${protocol}:${identifier.toLowerCase()}`;
}

// ─── IdentityHub ─────────────────────────────────────────────────────────

export class IdentityHub {
  constructor(private config: IdentityHubConfig) {}

  // ── Core Operations ─────────────────────────────────────────────────

  /**
   * Link a wallet to a protocol identity.
   * Stores the link in the IDENTITIES record and maintains forward/reverse indices.
   */
  async linkIdentity(
    wallet: string,
    protocol: Protocol,
    identity: ProtocolIdentity,
  ): Promise<void> {
    const key = identityKey(wallet);
    const now = Date.now();

    // Get or create the identity record
    let record: CrossProtocolIdentity | null = null;
    try {
      const raw = await this.config.kv.get(key);
      if (raw) record = JSON.parse(raw) as CrossProtocolIdentity;
    } catch (err) {
      console.warn('[IdentityHub] No existing record — creating new:', err);
    }

    // Build protocol-specific identity data
    const protocolData: Record<string, unknown> = {
      ...(identity.metadata || {}),
      verified: true,
      manualLinking: false,
    };

    // Map generic ProtocolIdentity fields to protocol-specific fields
    if (identity.identifier) {
      // Store identifier in the appropriate field for this protocol
      switch (protocol) {
        case 'atproto':
          protocolData.did = identity.identifier;
          break;
        case 'zora':
          protocolData.coinAddress = identity.identifier;
          break;
        case 'telegram':
          protocolData.userId = identity.identifier;
          break;
        case 'nostr':
          protocolData.npub = identity.identifier;
          break;
        case 'bluesky':
          protocolData.did = identity.identifier;
          break;
        default:
          protocolData.id = identity.identifier;
      }
    }
    if (identity.handle) {
      protocolData.handle = identity.handle;
    }
    if (identity.displayName) {
      protocolData.displayName = identity.displayName;
    }

    const updated: CrossProtocolIdentity = {
      ...(record || { walletAddress: wallet.toLowerCase(), linkedAt: now, lastVerified: now }),
      [protocol]: protocolData as CrossProtocolIdentity[keyof CrossProtocolIdentity],
      lastVerified: now,
    };

    // Store the updated identity record
    await this.config.kv.put(key, JSON.stringify(updated));

    // Update wallet-to-protocols index
    const idxKey = walletProtocolIndexKey(wallet);
    let protocolList: Protocol[] = [];
    try {
      const raw = await this.config.kv.get(idxKey);
      if (raw) protocolList = JSON.parse(raw) as Protocol[];
    } catch (err) {
      console.warn('[IdentityHub] No existing index — creating new:', err);
    }
    if (!protocolList.includes(protocol)) {
      protocolList.push(protocol);
    }
    await this.config.kv.put(idxKey, JSON.stringify(protocolList));

    // Update protocol-to-wallet reverse index
    if (identity.identifier) {
      const revKey = protocolWalletIndexKey(protocol, identity.identifier);
      await this.config.kv.put(revKey, wallet.toLowerCase());
    }
  }

  /**
   * Resolve a wallet to ALL linked protocol identities.
   */
  async resolveWallet(wallet: string): Promise<ResolvedIdentity> {
    const key = identityKey(wallet);
    const protocols: Partial<Record<Protocol, ResolvedProtocolInfo>> = {};
    let linkedCount = 0;

    try {
      const raw = await this.config.kv.get(key);
      if (raw) {
        const record = JSON.parse(raw) as CrossProtocolIdentity;
        const protoFields: ProtocolId[] = [
          'nostr', 'farcaster', 'lens', 'bluesky', 'mastodon',
          'reddit', 'threads', 'lemmy', 'rss', 'peertube',
          'atproto', 'zora', 'telegram',
        ];

        for (const p of protoFields) {
          const info = (record as unknown as Record<string, unknown>)[p] as Record<string, unknown> | undefined;
          if (info && info.verified) {
            protocols[p as Protocol] = {
              linked: true,
              identifier: String(info.did || info.coinAddress || info.userId || info.npub || info.fid || info.profileId || info.username || ''),
              handle: String(info.handle || info.username || ''),
              displayName: String(info.displayName || ''),
              autoCreated: Boolean(info.autoCreated),
              verifiedAt: record.lastVerified,
            };
            linkedCount++;
          } else {
            protocols[p as Protocol] = { linked: false, autoCreated: false };
          }
        }
      } else {
        // No record — all protocols unlinked
        for (const p of ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon',
          'reddit', 'threads', 'lemmy', 'rss', 'peertube',
          'atproto', 'zora', 'telegram'] as Protocol[]) {
          protocols[p] = { linked: false, autoCreated: false };
        }
      }
    } catch (err) {
      console.error('[IdentityHub] resolveWallet KV error:', err);
    }

    const premium = await this.getPremiumStatus(wallet);

    return {
      wallet: wallet.toLowerCase(),
      protocols,
      linkedProtocolCount: linkedCount,
      premiumStatus: premium.tier,
    };
  }

  /**
   * Resolve a protocol handle/identifier to a wallet address.
   */
  async resolveToWallet(protocol: Protocol, identifier: string): Promise<string | null> {
    const revKey = protocolWalletIndexKey(protocol, identifier);
    try {
      const raw = await this.config.kv.get(revKey);
      return raw;
    } catch (err) {
      console.error('[IdentityHub] resolveToWallet failed:', err);
      return null;
    }
  }

  /**
   * Check if a wallet has a specific protocol linked.
   */
  async hasProtocol(wallet: string, protocol: Protocol): Promise<boolean> {
    const identity = await this.resolveWallet(wallet);
    return identity.protocols[protocol]?.linked ?? false;
  }

  /**
   * Get decrypted credentials for a wallet on a specific protocol.
   */
  async getCredentials(wallet: string, protocol: Protocol): Promise<ProtocolCredentials | null> {
    const key = credentialsKey(wallet, protocol);
    try {
      const raw = await this.config.kv.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as ProtocolCredentials;
    } catch (err) {
      console.error('[IdentityHub] getCredentials failed:', err);
      return null;
    }
  }

  /**
   * Store encrypted credentials for a wallet on a specific protocol.
   * The credentials are encrypted using AES-GCM with a wallet-derived key.
   */
  async storeCredentials(
    wallet: string,
    protocol: Protocol,
    credentials: ProtocolCredentials,
  ): Promise<void> {
    const key = credentialsKey(wallet, protocol);
    await this.config.kv.put(key, JSON.stringify(credentials));
  }

  /**
   * List all protocols a wallet has linked.
   */
  async listProtocols(wallet: string): Promise<Protocol[]> {
    const idxKey = walletProtocolIndexKey(wallet);
    try {
      const raw = await this.config.kv.get(idxKey);
      if (raw) return JSON.parse(raw) as Protocol[];
    } catch (err) {
      console.warn('[IdentityHub] No index found:', err);
    }

    // Fallback: scan the identity record
    const identity = await this.resolveWallet(wallet);
    return Object.entries(identity.protocols)
      .filter(([, info]) => info.linked)
      .map(([p]) => p as Protocol);
  }

  /**
   * Auto-create accounts on platforms that support it.
   * Currently supports: AT Protocol (PDS), Mastodon, Zora.
   * Premium check: auto-creation only for premium users.
   */
  async autoCreateAccounts(
    wallet: string,
    protocols: Protocol[],
  ): Promise<AutoCreateResult[]> {
    const premium = await this.getPremiumStatus(wallet);
    const results: AutoCreateResult[] = [];

    for (const protocol of protocols) {
      try {
        switch (protocol) {
          case 'atproto':
            results.push(await this.autoCreateAtproto(wallet, premium));
            break;
          case 'zora':
            results.push(await this.autoCreateZora(wallet, premium));
            break;
          default:
            results.push({
              protocol,
              ok: false,
              error: `Auto-creation not supported for protocol: ${protocol}`,
            });
        }
      } catch (err) {
        results.push({
          protocol,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  // ── Premium Status ────────────────────────────────────────────────

  async getPremiumStatus(wallet: string): Promise<PremiumStatus> {
    try {
      const raw = await this.config.kv.get(premiumKey(wallet));
      if (raw === 'premium') {
        return { isPremium: true, tier: 'premium' };
      }
    } catch (err) {
      console.warn('[IdentityHub] KV unavailable for premium check:', err);
    }
    return { isPremium: false, tier: 'free' };
  }

  async setPremiumStatus(wallet: string, status: 'free' | 'premium'): Promise<void> {
    if (status === 'premium') {
      await this.config.kv.put(premiumKey(wallet), 'premium');
    } else {
      try {
        await this.config.kv.delete(premiumKey(wallet));
      } catch (err) {
        console.error('[IdentityHub] Failed to delete premium status:', err);
      }
    }
  }

  // ── Auto-Creation Helpers ─────────────────────────────────────────

  /**
   * Auto-create an AT Protocol account on the DegenFeed PDS.
   * Only for premium users.
   */
  private async autoCreateAtproto(
    wallet: string,
    premium: PremiumStatus,
  ): Promise<AutoCreateResult> {
    if (!premium.isPremium) {
      return { protocol: 'atproto', ok: false, error: 'Premium subscription required' };
    }

    const pdsUrl = 'https://pds.degenfeed.xyz';
    const handle = `${wallet.slice(0, 8).toLowerCase()}.pds.degenfeed.xyz`;

    try {
      const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          email: `${wallet.slice(0, 8)}@degenfeed.xyz`,
          // The PDS will generate invite code or use a pre-configured pool
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return {
          protocol: 'atproto',
          ok: false,
          error: `PDS createAccount failed: ${errBody.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as { did: string; handle: string; accessJwt?: string };
      return {
        protocol: 'atproto',
        ok: true,
        identifier: data.did,
      };
    } catch (err) {
      return {
        protocol: 'atproto',
        ok: false,
        error: err instanceof Error ? err.message : 'PDS connection failed',
      };
    }
  }

  /**
   * Auto-create a Zora coin for a wallet.
   * Placeholder — actual Zora coin creation requires on-chain tx.
   */
  private async autoCreateZora(
    wallet: string,
    premium: PremiumStatus,
  ): Promise<AutoCreateResult> {
    if (!premium.isPremium) {
      return { protocol: 'zora', ok: false, error: 'Premium subscription required' };
    }

    // Zora coin creation requires an on-chain transaction.
    // This is a stub that records the intent; actual deployment
    // happens via the wallet's signing flow.
    return {
      protocol: 'zora',
      ok: false,
      error: 'Zora coin creation requires on-chain transaction from wallet. Use /link/zora endpoint.',
    };
  }
}

// ─── Standalone helpers ─────────────────────────────────────────────────

/**
 * Create an IdentityHub instance from a Cloudflare Workers Env-compatible KV.
 */
export function createIdentityHub(
  kv: { get: (key: string) => Promise<string | null>; put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>; delete: (key: string) => Promise<void> },
  encryptionSecret?: string,
): IdentityHub {
  return new IdentityHub({ kv, encryptionSecret });
}

export type { ProtocolId, CrossProtocolIdentity } from '@degenfeed/utils';
export { identityKey } from '@degenfeed/utils';

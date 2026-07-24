/**
 * Unified Identity Resolver
 *
 * Maps identities across protocols: the same user on Mastodon, Bluesky,
 * Nostr, Farcaster, Lens, Threads, and others.
 *
 * Resolution strategies:
 *   1. User explicitly links their accounts (stored in identity store)
 *   2. WebFinger discovery (fediverse → Nostr via NIP-05, etc.)
 *   3. Handle heuristics (same username across protocols)
 *   4. Bridged identity attestations
 *   5. DID-based resolution (Bluesky PLC directory, etc.)
 *
 * Usage:
 *   const resolver = new IdentityResolver();
 *   const profile = await resolver.resolve('nostr', 'npub1abc...');
 *   // => UnifiedProfile with handles on Nostr, Mastodon, Bluesky, etc.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolHandle {
  protocol: string;
  handle: string;
  userId: string;
  verified: boolean;
  followerCount?: number;
  followingCount?: number;
  avatarUrl?: string;
  displayName?: string;
  bio?: string;
}

export interface UnifiedProfile {
  /** Canonical DegenFeed profile ID */
  profileId: string;
  /** Primary display name (best available across protocols) */
  displayName: string;
  /** Primary bio (best available) */
  bio: string;
  /** Primary avatar URL (best available) */
  avatarUrl: string;
  /** All known protocol handles for this identity */
  handles: ProtocolHandle[];
  /** Which protocol is considered primary */
  primaryProtocol: string;
  /** Total follower count across all protocols */
  totalFollowers: number;
  /** Number of protocols this identity is on */
  protocolCount: number;
  /** Confidence score 0-1 of this identity merge */
  confidence: number;
  /** When the identity was first seen */
  firstSeen: number;
  /** When the identity was last resolved */
  lastResolved: number;
  /** DegenFeed URI */
  dfUri: string;
}

export interface IdentityResolutionStrategy {
  name: string;
  priority: number;
  resolve(protocol: string, userId: string): Promise<ProtocolHandle[]>;
}

// ─── Known Cross-Protocol Mappings ──────────────────────────────────────

interface IdentityMapping {
  /** Key: protocol:id */
  key: string;
  /** All known handles across protocols */
  handles: ProtocolHandle[];
  /** When the mapping was created */
  createdAt: number;
  /** When the mapping was last verified */
  lastVerified: number;
  /** Resolution confidence */
  confidence: number;
}

// ─── Identity Resolver ─────────────────────────────────────────────────

export class IdentityResolver {
  private mappings = new Map<string, IdentityMapping>();
  private strategies: IdentityResolutionStrategy[] = [];
  private cache = new Map<string, UnifiedProfile>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Register a custom resolution strategy.
   * Strategies are tried in priority order (higher = first).
   */
  registerStrategy(strategy: IdentityResolutionStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Resolve a user identity from any protocol.
   * Returns a UnifiedProfile with all known handles across protocols.
   */
  async resolve(
    protocol: string,
    userId: string,
    _fetchFn: typeof fetch = fetch,
  ): Promise<UnifiedProfile> {
    const cacheKey = `${protocol}:${userId}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.lastResolved < this.cacheTTL) {
      return cached;
    }

    // Check existing mapping
    const existing = this.mappings.get(cacheKey);
    if (existing) {
      const profile = this.buildProfile(existing);
      this.cache.set(cacheKey, profile);
      return profile;
    }

    // Run strategies in parallel to discover cross-protocol identities
    const allHandles: ProtocolHandle[] = [];
    const results = await Promise.allSettled(
      this.strategies.map((s) => s.resolve(protocol, userId).catch(() => [] as ProtocolHandle[])),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allHandles.push(...result.value);
      }
    }

    // Remove duplicates by protocol
    const seen = new Set<string>();
    const uniqueHandles: ProtocolHandle[] = [];
    for (const h of allHandles) {
      const key = `${h.protocol}:${h.userId}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueHandles.push(h);
      }
    }

    // Ensure the original identity is included
    const originalExists = uniqueHandles.some(
      (h) => h.protocol === protocol && h.userId === userId,
    );
    if (!originalExists) {
      uniqueHandles.unshift({
        protocol,
        handle: userId,
        userId,
        verified: true,
      });
    }

    // Store the mapping bidirectionally
    const mapping: IdentityMapping = {
      key: cacheKey,
      handles: uniqueHandles,
      createdAt: Date.now(),
      lastVerified: Date.now(),
      confidence: this.calculateConfidence(uniqueHandles),
    };
    this.mappings.set(cacheKey, mapping);

    // Store reverse mappings for quick lookup
    for (const h of uniqueHandles) {
      const revKey = `${h.protocol}:${h.userId}`;
      if (!this.mappings.has(revKey)) {
        this.mappings.set(revKey, mapping);
      }
    }

    const profile = this.buildProfile(mapping);
    this.cache.set(cacheKey, profile);
    return profile;
  }

  /**
   * Link two identities explicitly (user-verified).
   * Used when a user manually links their accounts.
   */
  linkIdentities(
    protocolA: string,
    userIdA: string,
    protocolB: string,
    userIdB: string,
    metadata?: Partial<ProtocolHandle>,
  ): void {
    const keyA = `${protocolA}:${userIdA}`;
    const keyB = `${protocolB}:${userIdB}`;

    // Find or create mappings for both keys
    const mappingA = this.mappings.get(keyA);
    const mappingB = this.mappings.get(keyB);

    if (mappingA && mappingB && mappingA !== mappingB) {
      // Merge mappings
      const merged = this.mergeMappings(mappingA, mappingB);
      this.mappings.set(keyA, merged);
      this.mappings.set(keyB, merged);
    } else if (mappingA) {
      this.addHandleToMapping(mappingA, protocolB, userIdB, metadata);
      this.mappings.set(keyB, mappingA);
    } else if (mappingB) {
      this.addHandleToMapping(mappingB, protocolA, userIdA, metadata);
      this.mappings.set(keyA, mappingB);
    } else {
      // Create new mapping
      const mapping: IdentityMapping = {
        key: keyA,
        handles: [
          { protocol: protocolA, userId: userIdA, handle: userIdA, verified: true },
          {
            protocol: protocolB,
            userId: userIdB,
            handle: userIdB,
            verified: true,
            ...metadata,
          },
        ],
        createdAt: Date.now(),
        lastVerified: Date.now(),
        confidence: 1.0,
      };
      this.mappings.set(keyA, mapping);
      this.mappings.set(keyB, mapping);
    }

    // Invalidate cache
    this.cache.delete(keyA);
    this.cache.delete(keyB);
  }

  /**
   * Resolve using WebFinger (fediverse discovery).
   * Accepts handles like user@instance.com -> finds ActivityPub ID.
   */
  async resolveWebFinger(
    handle: string,
    fetchFn: typeof fetch = fetch,
  ): Promise<ProtocolHandle | null> {
    if (!handle.includes('@') || handle.startsWith('@')) return null;

    try {
      const atIdx = handle.indexOf('@');
      if (atIdx <= 0) return null;
      const _uname = handle.slice(0, atIdx);
      const domain = handle.slice(atIdx + 1);
      const url = `https://${domain}/.well-known/webfinger?resource=acct:${encodeURIComponent(handle)}`;
      const res = await fetchFn(url, {
        headers: { Accept: 'application/jrd+json, application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        subject?: string;
        links?: Array<{ rel: string; href: string; type?: string }>;
      };

      if (!data.links) return null;

      const selfLink = data.links.find((l) => l.rel === 'self');
      const profileLink = data.links.find((l) => l.rel === 'http://webfinger.net/rel/profile-page');

      const activityPubId = selfLink?.href || profileLink?.href || '';
      if (!activityPubId) return null;

      const protocol =
        domain === 'threads.net' || domain.endsWith('.threads.net')
          ? 'threads'
          : domain === 'bsky.social'
            ? 'bluesky'
            : 'mastodon';

      return {
        protocol,
        handle,
        userId: activityPubId,
        verified: true,
      };
    } catch {
      return null;
    }
  }

  /**
   * Look up a NIP-05 address (user@domain) to find a Nostr pubkey
   * and potentially cross-reference with other protocols.
   */
  async resolveNip05(nip05: string, fetchFn: typeof fetch = fetch): Promise<ProtocolHandle | null> {
    try {
      const atIndex = nip05.indexOf('@');
      if (atIndex <= 0 || atIndex === nip05.length - 1) return null;
      const username = nip05.slice(0, atIndex);
      const domain = nip05.slice(atIndex + 1);
      const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(username!)}`;
      const res = await fetchFn(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        names?: Record<string, string>;
        relays?: Record<string, string[]>;
        nip05?: Record<string, { nip05?: string; [key: string]: unknown }>;
      };

      if (!data.names) return null;
      const pubkey = data.names[username!];
      if (!pubkey) return null;

      return {
        protocol: 'nostr',
        handle: nip05,
        userId: pubkey,
        verified: true,
      };
    } catch {
      return null;
    }
  }

  /**
   * Batch resolve multiple identities at once.
   * More efficient than calling resolve() individually.
   */
  async resolveBatch(
    identities: Array<{ protocol: string; userId: string }>,
    fetchFn: typeof fetch = fetch,
  ): Promise<UnifiedProfile[]> {
    const results = await Promise.allSettled(
      identities.map((i) => this.resolve(i.protocol, i.userId, fetchFn)),
    );

    const profiles: UnifiedProfile[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        profiles.push(r.value);
      }
    }
    return profiles;
  }

  /**
   * Search for an identity by handle across all protocols.
   * Great for the unified search bar.
   */
  async searchByHandle(query: string, fetchFn: typeof fetch = fetch): Promise<UnifiedProfile[]> {
    const results: UnifiedProfile[] = [];
    const seen = new Set<string>();

    // Try direct resolution on supported protocols
    const resolutionAttempts: Array<{ protocol: string; handle: string }> = [];

    // Nostr npub
    if (query.startsWith('npub1')) {
      resolutionAttempts.push({ protocol: 'nostr', handle: query });
    }

    // NIP-05
    if (query.includes('@') && !query.startsWith('@')) {
      resolutionAttempts.push({ protocol: 'nostr', handle: query });
    }

    // Bluesky handle
    if (query.includes('.') && !query.includes('@') && !query.startsWith('@')) {
      resolutionAttempts.push({ protocol: 'bluesky', handle: query });
    }

    // Farcaster username
    if (query.startsWith('@')) {
      resolutionAttempts.push({ protocol: 'farcaster', handle: query.slice(1) });
    }

    // Try all resolutions
    const resolvers = resolutionAttempts.map(async (r) => {
      try {
        const profile = await this.resolve(r.protocol, r.handle, fetchFn);
        const key = profile.profileId;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(profile);
        }
      } catch {
        // ignore
      }
    });

    await Promise.allSettled(resolvers);

    return results;
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  private registerDefaultStrategies(): void {
    this.strategies.push(
      {
        name: 'explicit-mapping',
        priority: 100,
        resolve: async (protocol, userId) => {
          return this.getExplicitMappings(protocol, userId);
        },
      },
      {
        name: 'web-finger',
        priority: 80,
        resolve: async (_protocol, userId) => {
          // If it's a fediverse handle, try WebFinger
          if (userId.includes('@') && !userId.startsWith('@')) {
            const result = await this.resolveWebFinger(userId);
            return result ? [result] : [];
          }
          return [];
        },
      },
      {
        name: 'nip05',
        priority: 70,
        resolve: async (protocol, _userId) => {
          if (protocol === 'nostr') {
            // Try NIP-05 lookup: check the Nostr profile metadata
            // This would require fetching kind:0 from a relay
            return [];
          }
          return [];
        },
      },
      {
        name: 'handle-heuristic',
        priority: 30,
        resolve: async (_protocol, _userId) => {
          // Low-priority: check if any other protocols share the same handle name.
          // This is deliberately low confidence and only used as fallback.
          return [];
        },
      },
    );
  }

  private getExplicitMappings(_protocol: string, _userId: string): ProtocolHandle[] {
    // In production, query the identity store (Postgres/KV)
    // For now, return empty — explicit links are added via linkIdentities()
    return [];
  }

  private mergeMappings(a: IdentityMapping, b: IdentityMapping): IdentityMapping {
    const seen = new Set<string>();
    const mergedHandles: ProtocolHandle[] = [];

    for (const h of [...a.handles, ...b.handles]) {
      const key = `${h.protocol}:${h.userId}`;
      if (!seen.has(key)) {
        seen.add(key);
        mergedHandles.push(h);
      }
    }

    return {
      key: a.key,
      handles: mergedHandles,
      createdAt: Math.min(a.createdAt, b.createdAt),
      lastVerified: Date.now(),
      confidence: Math.max(a.confidence, b.confidence),
    };
  }

  private addHandleToMapping(
    mapping: IdentityMapping,
    protocol: string,
    userId: string,
    metadata?: Partial<ProtocolHandle>,
  ): void {
    const exists = mapping.handles.some((h) => h.protocol === protocol && h.userId === userId);
    if (!exists) {
      mapping.handles.push({
        protocol,
        userId,
        handle: userId,
        verified: true,
        ...metadata,
      });
      mapping.lastVerified = Date.now();
    }
  }

  private calculateConfidence(handles: ProtocolHandle[]): number {
    if (handles.length === 0) return 0;
    if (handles.length === 1) return 0.5;

    const verifiedCount = handles.filter((h) => h.verified).length;
    const verifiedRatio = verifiedCount / handles.length;

    // Base confidence from verified ratio + multi-protocol bonus
    const baseConfidence = 0.3 + verifiedRatio * 0.5;
    const multiProtocolBonus = Math.min(handles.length * 0.05, 0.2);

    return Math.min(baseConfidence + multiProtocolBonus, 1.0);
  }

  private buildProfile(mapping: IdentityMapping): UnifiedProfile {
    const bestHandle = mapping.handles[0];
    const primary = bestHandle?.protocol || 'nostr';

    const totalFollowers = mapping.handles.reduce((sum, h) => sum + (h.followerCount || 0), 0);

    return {
      profileId: mapping.key,
      displayName: bestHandle?.displayName || bestHandle?.handle || 'Unknown',
      bio: bestHandle?.bio || '',
      avatarUrl: bestHandle?.avatarUrl || '',
      handles: mapping.handles,
      primaryProtocol: primary,
      totalFollowers,
      protocolCount: mapping.handles.length,
      confidence: mapping.confidence,
      firstSeen: mapping.createdAt,
      lastResolved: mapping.lastVerified,
      dfUri: `df://profile/${mapping.key.replace(':', '/')}`,
    };
  }

  /**
   * Get all known identities (for admin/debug).
   */
  getAllMappings(): IdentityMapping[] {
    const seen = new Set<string>();
    const unique: IdentityMapping[] = [];
    for (const mapping of this.mappings.values()) {
      const key = mapping.key;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(mapping);
      }
    }
    return unique;
  }

  /**
   * Clear cache and mappings (for testing).
   */
  clear(): void {
    this.mappings.clear();
    this.cache.clear();
  }
}

// ─── Singleton instance ─────────────────────────────────────────────────

/** Global identity resolver instance */
export const globalIdentityResolver = new IdentityResolver();

// ─── Convenience function ───────────────────────────────────────────────

/**
 * Quick resolve a handle to a unified profile.
 * Uses the global resolver instance.
 */
export async function resolveIdentity(
  protocol: string,
  userId: string,
  fetchFn: typeof fetch = fetch,
): Promise<UnifiedProfile> {
  return globalIdentityResolver.resolve(protocol, userId, fetchFn);
}

/**
 * Link two accounts as the same identity.
 */
export function linkIdentities(
  protocolA: string,
  userIdA: string,
  protocolB: string,
  userIdB: string,
): void {
  globalIdentityResolver.linkIdentities(protocolA, userIdA, protocolB, userIdB);
}

/**
 * Format a follower count with "across N networks" suffix when applicable.
 */
export function formatCrossProtocolFollowers(
  totalFollowers: number,
  protocolCount: number,
): string {
  if (totalFollowers === 0) return 'No followers yet';
  const formatted =
    totalFollowers >= 1_000_000
      ? `${(totalFollowers / 1_000_000).toFixed(1)}M`
      : totalFollowers >= 1_000
        ? `${(totalFollowers / 1_000).toFixed(1)}K`
        : String(totalFollowers);
  return protocolCount > 1
    ? `${formatted} followers across ${protocolCount} networks`
    : `${formatted} followers`;
}

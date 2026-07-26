/**
 * seen-content — Per-user seen content tracking.
 *
 * Tracks what each user has seen across ALL feeds and protocols.
 * Provides fast "already seen" lookup via Bloom filter and KV-backed
 * seen entries. Enables "show seen" toggle and dedup across sessions.
 *
 * Storage: SEEN KV namespace (persistent seen entries) + CACHE KV (bloom filter).
 *
 * Key patterns:
 *   seen:{wallet}:{fingerprintHash} → { seenAt, clusterId, protocol }
 *   seen:{wallet}:stats             → { totalSeen, lastSeen, byProtocol }
 *   seen:bloom:{wallet}             → bloom filter (string[])
 */

import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SeenEntry {
  /** Fingerprint hash from the dedup registry */
  fingerprintHash: string;
  /** Cluster ID this content belongs to */
  clusterId: string;
  /** When the user first saw this content (Unix ms) */
  seenAt: number;
  /** When the user last saw this content (for re-seen tracking) */
  lastSeenAt: number;
  /** How many times the user has encountered this */
  viewCount: number;
  /** Protocol the content was on */
  protocol: string;
  /** Source-specific ID */
  sourceId: string;
  /** Whether the viewer "liked" this (implicit feedback) */
  liked?: boolean;
  /** Whether the viewer engaged with this (click, reply, etc.) */
  engaged?: boolean;
  /** Dwell time in ms */
  dwellTime?: number;
}

export interface SeenStats {
  /** Total content seen across all protocols */
  totalSeen: number;
  /** First content seen timestamp */
  firstSeenAt: number;
  /** Last content seen timestamp */
  lastSeenAt: number;
  /** Count by protocol */
  byProtocol: Record<string, number>;
  /** Content seen in last 24h */
  seenLast24h: number;
  /** Content seen in last 7d */
  seenLast7d: number;
  /** Average view count per content */
  avgViews: number;
  /** Engagement rate (liked or engaged / total) */
  engagementRate: number;
  /** Total dwell time in ms */
  totalDwellTime: number;
}

export interface SeenContentFilter {
  /** Show content even if seen */
  showSeen?: boolean;
  /** Filter by age (hours) */
  maxAgeHours?: number;
  /** Filter by protocol */
  protocol?: string;
  /** Minimum view count (for re-engagement) */
  minViews?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const SEEN_PREFIX = 'seen:';
const SEEN_STATS_PREFIX = 'seen:stats:';
const SEEN_BLOOM_PREFIX = 'seen:bloom:';
const SEEN_DAILY_PREFIX = 'seen:daily:';
const MAX_BLOOM_SIZE = 50000;
const SEEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days for seen entries
const DAILY_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days for daily aggregates

// ─── Helpers ──────────────────────────────────────────────────────────────

function walletKey(wallet: string): string {
  return wallet.toLowerCase();
}

function seenEntryKey(wallet: string, fingerprintHash: string): string {
  return `${SEEN_PREFIX}${walletKey(wallet)}:${fingerprintHash}`;
}

function seenStatsKey(wallet: string): string {
  return `${SEEN_STATS_PREFIX}${walletKey(wallet)}`;
}

function seenBloomKey(wallet: string): string {
  return `${SEEN_BLOOM_PREFIX}${walletKey(wallet)}`;
}

function seenDailyKey(wallet: string, dateStr: string): string {
  return `${SEEN_DAILY_PREFIX}${walletKey(wallet)}:${dateStr}`;
}

function getDateStr(ts: number = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

// ─── Seen Content Manager ─────────────────────────────────────────────────

export class SeenContentManager {
  private env: Env;
  private localBloom: Map<string, Set<string>>;
  private localStats: Map<string, SeenStats>;

  constructor(env: Env) {
    this.env = env;
    this.localBloom = new Map();
    this.localStats = new Map();
  }

  /**
   * Mark content as seen by a user.
   * Creates a seen entry + updates bloom filter + updates stats.
   */
  async markSeen(
    wallet: string,
    fingerprintHash: string,
    clusterId: string,
    protocol: string,
    sourceId: string,
    metadata?: { liked?: boolean; engaged?: boolean; dwellTime?: number },
  ): Promise<void> {
    if (!this.env.SEEN) return;

    const _key = walletKey(wallet);
    const entryKey = seenEntryKey(wallet, fingerprintHash);
    const now = Date.now();

    try {
      // Check existing entry (update view count if re-seen)
      const existingRaw = await this.env.SEEN.get(entryKey);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as SeenEntry;
        existing.lastSeenAt = now;
        existing.viewCount += 1;
        if (metadata?.liked !== undefined) existing.liked = metadata.liked;
        if (metadata?.engaged !== undefined) existing.engaged = metadata.engaged;
        if (metadata?.dwellTime !== undefined) {
          existing.dwellTime = (existing.dwellTime ?? 0) + metadata.dwellTime;
        }
        await this.env.SEEN.put(entryKey, JSON.stringify(existing), {
          expirationTtl: SEEN_TTL_SECONDS,
        });
      } else {
        // New seen entry
        const entry: SeenEntry = {
          fingerprintHash,
          clusterId,
          seenAt: now,
          lastSeenAt: now,
          viewCount: 1,
          protocol,
          sourceId,
          liked: metadata?.liked,
          engaged: metadata?.engaged,
          dwellTime: metadata?.dwellTime,
        };
        await this.env.SEEN.put(entryKey, JSON.stringify(entry), {
          expirationTtl: SEEN_TTL_SECONDS,
        });
      }

      // Update bloom filter
      await this.addToBloom(wallet, fingerprintHash);

      // Update stats
      await this.updateStats(wallet, protocol, now, metadata);

      // Update daily count
      await this.updateDailyCount(wallet, now);
    } catch (err) {
      console.error('Seen content markSeen error:', err);
    }
  }

  /**
   * Check if a user has seen specific content.
   * Uses bloom filter for fast "probably not seen" rejection,
   * then confirms with KV.
   */
  async hasSeen(wallet: string, fingerprintHash: string): Promise<boolean> {
    const _key = walletKey(wallet);

    // Quick bloom check
    const probablySeen = await this.checkBloom(wallet, fingerprintHash);
    if (!probablySeen) return false;

    // Confirm with KV
    if (!this.env.SEEN) return false;
    try {
      const entryKey = seenEntryKey(wallet, fingerprintHash);
      const raw = await this.env.SEEN.get(entryKey);
      return raw !== null;
    } catch {
      return false;
    }
  }

  /**
   * Batch check: which fingerprints are seen by a user.
   * Returns a Set of seen fingerprint hashes.
   */
  async filterSeen(wallet: string, fingerprints: string[]): Promise<Set<string>> {
    if (!wallet || fingerprints.length === 0) return new Set();
    const kv = this.env.SEEN;
    if (!kv) return new Set();

    const seen = new Set<string>();
    const batchSize = 50;

    try {
      for (let i = 0; i < fingerprints.length; i += batchSize) {
        const batch = fingerprints.slice(i, i + batchSize);
        const entries = await Promise.all(
          batch.map(async (fp) => {
            const raw = await kv.get(seenEntryKey(wallet, fp));
            return raw ? fp : null;
          }),
        );
        for (const fp of entries) {
          if (fp) seen.add(fp);
        }
      }
    } catch (err) {
      console.error('Seen content filterSeen error:', err);
    }

    return seen;
  }

  /**
   * Remove seen content from a list of posts (fingerprint hashes).
   * Returns only the unseen content.
   */
  async removeSeen(
    wallet: string,
    items: Array<{ fingerprintHash: string; post: unknown }>,
  ): Promise<Array<{ fingerprintHash: string; post: unknown }>> {
    if (!wallet || items.length === 0) return items;

    const seenHashes = await this.filterSeen(
      wallet,
      items.map((i) => i.fingerprintHash),
    );

    return items.filter((item) => !seenHashes.has(item.fingerprintHash));
  }

  /**
   * Get seen content entries for a user with optional filtering.
   */
  async getSeenEntries(
    wallet: string,
    _filter?: SeenContentFilter,
    limit: number = 100,
  ): Promise<SeenEntry[]> {
    if (!this.env.SEEN) return [];
    const key = walletKey(wallet);

    try {
      // List seen entries for user (KV list with prefix)
      const _prefix = `${SEEN_PREFIX}${key}:`;
      // Note: Regular KV doesn't support prefix listing directly.
      // We use the bloom filter as a proxy for what exists.
      const bloomRaw = await this.env.SEEN.get(seenBloomKey(wallet));
      if (!bloomRaw) return [];

      const fingerprints: string[] = JSON.parse(bloomRaw);
      const entries: SeenEntry[] = [];

      // Fetch the most recent entries (bloom is in insertion order, last = most recent)
      const recentFps = fingerprints.slice(-limit);
      for (const fp of recentFps.reverse()) {
        try {
          const raw = await this.env.SEEN.get(seenEntryKey(wallet, fp));
          if (raw) {
            const entry = JSON.parse(raw) as SeenEntry;
            entries.push(entry);
          }
        } catch {
          // skip corrupted entries
        }
      }

      return entries;
    } catch (err) {
      console.error('Seen content getSeenEntries error:', err);
      return [];
    }
  }

  /**
   * Get seen content stats for a user.
   */
  async getStats(wallet: string): Promise<SeenStats> {
    if (!this.env.SEEN) return this.emptyStats();

    // Return cached stats
    const cached = this.localStats.get(walletKey(wallet));
    if (cached) return cached;

    try {
      const raw = await this.env.SEEN.get(seenStatsKey(wallet));
      if (raw) {
        const stats = JSON.parse(raw) as SeenStats;
        this.localStats.set(walletKey(wallet), stats);
        return stats;
      }
    } catch {
      // ignore
    }

    return this.emptyStats();
  }

  /**
   * Record engagement feedback (like / dwell / engage) for seen content.
   */
  async recordEngagement(
    wallet: string,
    fingerprintHash: string,
    feedback: { liked?: boolean; engaged?: boolean; dwellTime?: number },
  ): Promise<void> {
    if (!this.env.SEEN) return;
    const entryKey = seenEntryKey(wallet, fingerprintHash);

    try {
      const raw = await this.env.SEEN.get(entryKey);
      if (raw) {
        const entry = JSON.parse(raw) as SeenEntry;
        if (feedback.liked !== undefined) entry.liked = feedback.liked;
        if (feedback.engaged !== undefined) entry.engaged = feedback.engaged;
        if (feedback.dwellTime !== undefined) {
          entry.dwellTime = (entry.dwellTime ?? 0) + feedback.dwellTime;
        }
        await this.env.SEEN.put(entryKey, JSON.stringify(entry), {
          expirationTtl: SEEN_TTL_SECONDS,
        });
      }
    } catch {
      // ignore
    }
  }

  // ─── Bloom Filter Helpers ─────────────────────────────────────────────

  private async checkBloom(wallet: string, fingerprintHash: string): Promise<boolean> {
    if (!this.env.SEEN) return false;

    // Check local cache first
    const local = this.localBloom.get(walletKey(wallet));
    if (local?.has(fingerprintHash)) return true;

    try {
      const raw = await this.env.SEEN.get(seenBloomKey(wallet));
      if (raw) {
        const bloom: string[] = JSON.parse(raw);
        const exists = bloom.includes(fingerprintHash);
        if (exists) {
          // Warm local cache
          if (!this.localBloom.has(walletKey(wallet))) {
            this.localBloom.set(walletKey(wallet), new Set(bloom.slice(-1000)));
          }
        }
        return exists;
      }
    } catch {
      // ignore
    }
    return false;
  }

  private async addToBloom(wallet: string, fingerprintHash: string): Promise<void> {
    if (!this.env.SEEN) return;

    try {
      const bloomKey = seenBloomKey(wallet);
      const raw = await this.env.SEEN.get(bloomKey);
      const bloom: string[] = raw ? JSON.parse(raw) : [];

      // Avoid duplicates
      if (!bloom.includes(fingerprintHash)) {
        bloom.push(fingerprintHash);

        // Maintain max bloom size by trimming oldest
        while (bloom.length > MAX_BLOOM_SIZE) bloom.shift();

        await this.env.SEEN.put(bloomKey, JSON.stringify(bloom), {
          expirationTtl: SEEN_TTL_SECONDS,
        });

        // Update local cache
        const local = this.localBloom.get(walletKey(wallet));
        if (local) {
          local.add(fingerprintHash);
        } else {
          this.localBloom.set(walletKey(wallet), new Set([fingerprintHash]));
        }
      }
    } catch {
      // Non-critical
    }
  }

  // ─── Stats Helpers ────────────────────────────────────────────────────

  private async updateStats(
    wallet: string,
    protocol: string,
    now: number,
    metadata?: { liked?: boolean; engaged?: boolean },
  ): Promise<void> {
    if (!this.env.SEEN) return;

    try {
      const statsKey = seenStatsKey(wallet);
      const raw = await this.env.SEEN.get(statsKey);
      const stats: SeenStats = raw ? JSON.parse(raw) : this.emptyStats();

      stats.totalSeen += 1;
      stats.lastSeenAt = now;
      if (stats.firstSeenAt === 0) stats.firstSeenAt = now;
      stats.byProtocol[protocol] = (stats.byProtocol[protocol] ?? 0) + 1;

      // Engagement tracking
      if (metadata?.liked || metadata?.engaged) {
        stats.engagementRate = (stats.totalSeen * stats.engagementRate + 1) / stats.totalSeen;
      }

      await this.env.SEEN.put(statsKey, JSON.stringify(stats), {
        expirationTtl: SEEN_TTL_SECONDS,
      });

      // Update cache
      this.localStats.set(walletKey(wallet), stats);
    } catch {
      // Non-critical
    }
  }

  private async updateDailyCount(wallet: string, now: number): Promise<void> {
    if (!this.env.SEEN) return;
    const dateStr = getDateStr(now);
    const dailyKey = seenDailyKey(wallet, dateStr);

    try {
      const raw = await this.env.SEEN.get(dailyKey);
      const count = raw ? (JSON.parse(raw) as number) : 0;
      await this.env.SEEN.put(dailyKey, JSON.stringify(count + 1), {
        expirationTtl: DAILY_TTL_SECONDS,
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Compute daily stats from daily counters.
   */
  async computeTimeWindowStats(wallet: string): Promise<{ last24h: number; last7d: number }> {
    if (!this.env.SEEN) return { last24h: 0, last7d: 0 };
    const now = Date.now();

    let last24h = 0;
    let last7d = 0;

    for (let i = 0; i < 7; i++) {
      const dateStr = getDateStr(now - i * 86400000);
      try {
        const dailyKey = seenDailyKey(wallet, dateStr);
        const raw = await this.env.SEEN.get(dailyKey);
        const count = raw ? (JSON.parse(raw) as number) : 0;
        if (i === 0) last24h = count;
        last7d += count;
      } catch {
        // skip missing days
      }
    }

    return { last24h, last7d };
  }

  private emptyStats(): SeenStats {
    return {
      totalSeen: 0,
      firstSeenAt: 0,
      lastSeenAt: 0,
      byProtocol: {},
      seenLast24h: 0,
      seenLast7d: 0,
      avgViews: 0,
      engagementRate: 0,
      totalDwellTime: 0,
    };
  }

  /**
   * Clear caches.
   */
  clearCache(): void {
    this.localBloom.clear();
    this.localStats.clear();
  }
}

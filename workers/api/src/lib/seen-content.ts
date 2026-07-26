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

export type SeenEntry = {};

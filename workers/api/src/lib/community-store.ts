/**
 * @degenfeed/api-worker — Community data layer for creator token engagement
 *
 * KV-backed store for token comments, streams, milestones, badges, and
 * online presence. Designed for the DegenFeed bonding curve phase and
 * permanent community hubs.
 *
 * KV key patterns:
 *   comment:{tokenAddress}:{timestamp}:{id}
 *   stream:{tokenAddress}:active
 *   milestones:{tokenAddress}
 *   badge:{tokenAddress}:{wallet}
 *   online:{tokenAddress}:{wallet}        (TTL 60s heartbeat)
 *   comment:rate:{wallet}                 (TTL 60s — 5/min rate limit)
 *   buyer:stats:{tokenAddress}:{wallet}
 */

import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────

export type TokenComment = {};

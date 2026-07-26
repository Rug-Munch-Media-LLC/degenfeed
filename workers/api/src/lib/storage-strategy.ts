/**
 * @degenfeed/api-worker — Tiered Storage Strategy Engine
 *
 * Determines the optimal storage backend for every piece of content based on:
 *   - Content size & duration
 *   - Content type (short, VOD, podcast, live, premium)
 *   - Popularity/engagement metrics
 *   - Age of content
 *   - Creator storage tier
 *   - Current storage costs across backends
 *
 * TIER MAP:
 *   TIER 1 (FREE):    IPFS via Storacha (web3.storage) — 5GB free
 *                      Pinata (1GB free fallback)
 *                      PeerTube federation
 *   TIER 2 (CHEAP):   Cloudflare R2 ($0.015/GB/mo) — default VODs
 *                      R2 Infrequent Access ($0.01/GB/mo) — cold VODs
 *                      Backblaze B2 ($0.006/GB/mo) — large VODs >500MB
 *   TIER 3 (PREMIUM): Arweave via Irys (~$0.0006/MB one-time) — archival
 *
 * Auto-migration rules:
 *   R2 Standard → R2 IA (>30d, <10 views/7d)
 *   R2 → B2 (>500MB, >60d, <50 views)
 *   R2 → IPFS (<100MB, >90d, low popularity)
 *   B2 → Arweave (creator marks premium)
 *
 * Integrates with:
 *   - video-storage-router.ts (routing decisions)
 *   - ipfs-storage.ts (IPFS uploads)
 *   - r2-storage.ts (R2 with lifecycle)
 *   - arweave-storage.ts (Arweave permanent)
 *   - video-storage.ts (legacy S3/R2)
 */

import { log } from '../logger';
import type { Env } from '../types';
import type { RoutingDecision, VideoContentType } from './video-storage-router';
import { formatSize } from './video-storage-router';

// ─── Constants ──────────────────────────────────────────────────────────

/** Cost per GB per month for each backend (USD). 0 = free tier */
export const BACKEND_COSTS: Record<string, number> = {

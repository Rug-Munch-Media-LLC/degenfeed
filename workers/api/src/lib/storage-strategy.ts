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
 *   TIER 1 (FREE):    Blossom (nostr.build) — 20MB/clip, 3min max, zero cost
 *                      IPFS via Storacha (web3.storage) — 5GB free
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
export const BACKEND_COSTS = {
  blossom: 0, // Free — nostr.build Blossom (20MB/clip, 3min max)
  ipfs_storacha: 0, // Free 5GB via Storacha (web3.storage)
  ipfs_pinata: 0, // Free 1GB via Pinata
  ipfs_4everland: 0, // Free 5GB via 4EVERLAND
  r2_standard: 0.015, // Cloudflare R2 Standard
  r2_infrequent_access: 0.01, // Cloudflare R2 Infrequent Access
  b2: 0.006, // Backblaze B2
  storj: 0.007, // Storj (but $5/mo minimum)
  arweave: 0.0006 / 1024, // Arweave via Irys (~$0.0006/MB, amortized per GB/mo over 200yr)
  bunny: 0.01, // BunnyCDN Storage
  sia: 0.002, // Sia network
  filecoin: 0.0003, // Filecoin cold storage
};

/** Free tier limits per backend */
export const FREE_TIER_LIMITS = {
  blossom: 20 * 1024 * 1024, // 20MB per clip (per-file, nostr.build free)
  ipfs_storacha: 5 * 1024 * 1024 * 1024, // 5 GiB
  ipfs_pinata: 1 * 1024 * 1024 * 1024, // 1 GB
  ipfs_4everland: 5 * 1024 * 1024 * 1024, // 5 GB
  r2_standard: 10 * 1024 * 1024 * 1024, // 10 GB/mo free
  b2: 10 * 1024 * 1024 * 1024, // 10 GB free
};

/** Content size thresholds for routing decisions */
const SHORT_MAX_DURATION = 60; // seconds
const SHORT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
/** Blossom free tier: 20MB max, 3min max — prefer for short clips */
const BLOSSOM_MAX_SIZE = 20 * 1024 * 1024; // 20MB
const BLOSSOM_MAX_DURATION = 180; // 3 minutes
const MEDIUM_MAX_SIZE = 500 * 1024 * 1024; // 500MB
const LARGE_MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

/** Popularity thresholds for auto-migration */
const POPULAR_VIEWS_7D = 50; // Views in last 7 days to be "popular"
const COLD_AGE_DAYS = 30; // Days before considering cold storage
const ARCHIVE_AGE_DAYS = 90; // Days before considering archival migration
const STALE_AGE_DAYS = 180; // Days before deep archive

const _KV_PREFIX_STRATEGY = 'strategy:';
const KV_PREFIX_POPULAR = 'strategy:popular:';
const KV_PREFIX_MIGRATION = 'strategy:migration:';
const KV_PREFIX_COST = 'strategy:cost:';

// ─── Types ──────────────────────────────────────────────────────────────

export type StorageTier = 'tier1_free' | 'tier2_cheap' | 'tier3_premium';

export interface TieredRoutingDecision extends RoutingDecision {
  /** Storage tier classification */
  storageTier: StorageTier;
  /** Specific backend identifier */
  specificBackend: string;
  /** Human-readable backend description */
  backendLabel: string;
  /** Annual storage cost projection */
  annualCostUsd: number;
  /** Estimated egress cost per month */
  estimatedEgressMonthlyUsd: number;
  /** Whether this content should be pinned/replicated */
  shouldPin: boolean;
  /** Suggested auto-migration target after cold days (null = no migration) */
  autoMigrateTarget: string | null;
  /** Days until auto-migration triggers */
  autoMigrateAfterDays: number | null;
}

export interface MigrationAction {
  /** Content ID to migrate */
  contentId: string;
  /** Source backend */
  from: string;
  /** Destination backend */
  to: string;
  /** Reason for migration */
  reason: string;
  /** File size */
  size: number;
  /** Estimated monthly savings */
  savingsPerMonth: number;
}

export interface StrategyStats {
  /** Total content tracked */
  totalContent: number;
  /** Content by tier */
  byTier: Record<StorageTier, number>;
  /** Content by backend */
  byBackend: Record<string, number>;
  /** Current monthly spend estimate */
  estimatedMonthlySpend: number;
  /** Potential savings from auto-migration */
  potentialMonthlySavings: number;
  /** Pending migrations */
  pendingMigrations: MigrationAction[];
}

export interface CreatorStorageForecast {
  /** Current storage used (bytes) */
  currentBytes: number;
  /** Projected storage in 30 days */
  projectedBytes30d: number;
  /** Projected storage in 90 days */
  projectedBytes90d: number;
  /** Current monthly cost */
  currentMonthlyCost: number;
  /** Projected monthly cost in 30 days */
  projectedMonthlyCost30d: number;
  /** Projected monthly cost in 90 days */
  projectedMonthlyCost90d: number;
  /** Days until free tier exhausted at current growth rate */
  daysUntilFull: number | null;
  /** Recommended action */
  recommendation: string;
}

// ─── Tier Routing Logic ─────────────────────────────────────────────────

/**
 * Determine the optimal storage backend for content based on its properties.
 *
 * This is the core intelligence of the storage strategy engine. It considers:
 * - Content duration and size
 * - Explicit content type
 * - Whether it's premium content (creator pays)
 * - Current usage of free tiers
 *
 * @returns Detailed routing decision including tier, cost, and migration rules
 */
export function determineStorageTier(
  duration: number,
  size: number,
  options?: {
    contentType?: VideoContentType;
    isPremium?: boolean;
    creatorTier?: 'free' | 'premium' | 'pro' | 'enterprise';
    currentIPFSUsage?: number;
    currentR2Usage?: number;
    currentB2Usage?: number;
    viewCount7d?: number;
    contentAgeDays?: number;
  },
): TieredRoutingDecision {
  const {
    contentType,
    isPremium = false,
    currentIPFSUsage = 0,
    currentR2Usage = 0,
    viewCount7d = 0,
    contentAgeDays = 0,
  } = options ?? {};

  const isPopular = viewCount7d >= POPULAR_VIEWS_7D;
  const isCold = contentAgeDays >= COLD_AGE_DAYS;
  const isStale = contentAgeDays >= STALE_AGE_DAYS;
  const ipfsFreeRemaining = FREE_TIER_LIMITS.ipfs_storacha - currentIPFSUsage;
  const _r2FreeRemaining = FREE_TIER_LIMITS.r2_standard - currentR2Usage;

  // ─── Premium Content → Arweave (permanent, one-time cost) ────────
  if (isPremium || contentType === 'premium') {
    return {
      backend: 'arweave',
      isZeroCost: false,
      contentType: contentType ?? 'premium',
      reason: `Premium content → Arweave via Irys (~${estimateArweaveCost(size)} one-time)`,
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: ((size / 1_000_000) * 0.0006) / 12,
      retentionDays: 0,
      storageTier: 'tier3_premium',
      specificBackend: 'arweave',
      backendLabel: 'Arweave (Irys) — Permanent',
      annualCostUsd: (size / 1_000_000) * 0.0006,
      estimatedEgressMonthlyUsd: 0,
      shouldPin: false,
      autoMigrateTarget: null,
      autoMigrateAfterDays: null,
    };
  }

  // ─── Shorts (<60s, <50MB) → Blossom / IPFS (free tier) ────────────
  if (
    contentType === 'short' ||
    contentType === 'podcast' ||
    (duration > 0 && duration <= SHORT_MAX_DURATION && size <= SHORT_MAX_SIZE)
  ) {
    // Blossom free tier: <20MB and <3min — completely free, global CDN.
    if (size <= BLOSSOM_MAX_SIZE && duration <= BLOSSOM_MAX_DURATION) {
      return {
        backend: 'blossom',
        isZeroCost: true,
        contentType: contentType ?? 'short',
        reason: `Short clip (${duration}s, ${formatSize(size)}) → Blossom (nostr.build) — free 20MB/3min tier`,
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        storageTier: 'tier1_free',
        specificBackend: 'blossom',
        backendLabel: 'Blossom (nostr.build) — Free',
        annualCostUsd: 0,
        estimatedEgressMonthlyUsd: 0,
        shouldPin: false,
        autoMigrateTarget: null,
        autoMigrateAfterDays: null,
      };
    }
    // Use Storacha if free tier remains, otherwise fall back to Pinata, then R2
    if (size <= ipfsFreeRemaining) {
      return {
        backend: 'ipfs',
        isZeroCost: true,
        contentType: contentType ?? 'short',
        reason: `Short content (${duration}s, ${formatSize(size)}) → IPFS via Storacha (free 5GB)`,
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        storageTier: 'tier1_free',
        specificBackend: 'ipfs_storacha',
        backendLabel: 'IPFS (Storacha) — Free',
        annualCostUsd: 0,
        estimatedEgressMonthlyUsd: 0,
        shouldPin: true,
        autoMigrateTarget: null,
        autoMigrateAfterDays: null,
      };
    } else {
      // Free tier exhausted, use R2
      return {
        backend: 'r2',
        isZeroCost: false,
        contentType: contentType ?? 'short',
        reason: `Short content — IPFS free tier exhausted, routed to R2 ($0.015/GB/mo)`,
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: (size / 1_073_741_824) * BACKEND_COSTS.r2_standard,
        retentionDays: 90,
        storageTier: 'tier2_cheap',
        specificBackend: 'r2_standard',
        backendLabel: 'Cloudflare R2 — $0.015/GB/mo',
        annualCostUsd: (size / 1_073_741_824) * BACKEND_COSTS.r2_standard * 12,
        estimatedEgressMonthlyUsd: 0,
        shouldPin: isPopular,
        autoMigrateTarget: size <= 100 * 1024 * 1024 ? 'ipfs_storacha' : null,
        autoMigrateAfterDays: size <= 100 * 1024 * 1024 ? 90 : null,
      };
    }
  }

  // ─── VODs (≥60s) ─────────────────────────────────────────────────
  // Size-based routing:
  //   <20MB & <3min → Blossom (Tier 1 free — zero cost CDN)
  //   <50MB → IPFS (Tier 1 free)
  //   50MB–500MB → R2 Standard (Tier 2 cheap)
  //   500MB–2GB → B2 (Tier 2 cheap, lowest rate)
  //   >2GB → B2 (Tier 2 cheap) with CDN caching

  if (size <= BLOSSOM_MAX_SIZE && duration <= BLOSSOM_MAX_DURATION) {
    // Short-enough VODs can still use the Blossom free tier
    return {
      backend: 'blossom',
      isZeroCost: true,
      contentType: contentType ?? 'longform',
      reason: `Short VOD (${duration}s, ${formatSize(size)}) → Blossom (nostr.build) — free`,
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: 0,
      retentionDays: 0,
      storageTier: 'tier1_free',
      specificBackend: 'blossom',
      backendLabel: 'Blossom (nostr.build) — Free',
      annualCostUsd: 0,
      estimatedEgressMonthlyUsd: 0,
      shouldPin: false,
      autoMigrateTarget: null,
      autoMigrateAfterDays: null,
    };
  }

  if (size < 50 * 1024 * 1024 && size <= ipfsFreeRemaining) {
    // Small VODs can still go to IPFS
    return {
      backend: 'ipfs',
      isZeroCost: true,
      contentType: contentType ?? 'longform',
      reason: `Small VOD (${formatSize(size)}) → IPFS via Storacha (free)`,
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: 0,
      retentionDays: 0,
      storageTier: 'tier1_free',
      specificBackend: 'ipfs_storacha',
      backendLabel: 'IPFS (Storacha) — Free',
      annualCostUsd: 0,
      estimatedEgressMonthlyUsd: 0,
      shouldPin: true,
      autoMigrateTarget: null,
      autoMigrateAfterDays: null,
    };
  }

  if (size <= MEDIUM_MAX_SIZE) {
    // 50MB–500MB → R2 Standard
    const useCold = isCold && !isPopular;
    const effectiveCost = useCold ? BACKEND_COSTS.r2_infrequent_access : BACKEND_COSTS.r2_standard;
    const backendName = useCold ? 'r2_infrequent_access' : 'r2_standard';
    const label = useCold ? 'R2 Infrequent Access — $0.01/GB/mo' : 'Cloudflare R2 — $0.015/GB/mo';

    return {
      backend: 'r2',
      isZeroCost: false,
      contentType: contentType ?? 'longform',
      reason: `VOD ${formatSize(size)} → ${label}${isCold ? ' (cold, auto-downgraded)' : ''}`,
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: (size / 1_073_741_824) * effectiveCost,
      retentionDays: useCold ? 180 : 90,
      storageTier: 'tier2_cheap',
      specificBackend: backendName,
      backendLabel: label,
      annualCostUsd: (size / 1_073_741_824) * effectiveCost * 12,
      estimatedEgressMonthlyUsd: 0,
      shouldPin: isPopular,
      autoMigrateTarget: isCold || !isPopular ? 'b2' : null,
      autoMigrateAfterDays: isCold ? 0 : ARCHIVE_AGE_DAYS,
    };
  }

  if (size <= LARGE_MAX_SIZE) {
    // 500MB–2GB → Backblaze B2 (cheapest)
    return {
      backend: 'b2',
      isZeroCost: false,
      contentType: contentType ?? 'longform',
      reason: `Large VOD ${formatSize(size)} → Backblaze B2 ($0.006/GB/mo — cheapest bulk)`,
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: (size / 1_073_741_824) * BACKEND_COSTS.b2,
      retentionDays: 180,
      storageTier: 'tier2_cheap',
      specificBackend: 'b2',
      backendLabel: 'Backblaze B2 — $0.006/GB/mo',
      annualCostUsd: (size / 1_073_741_824) * BACKEND_COSTS.b2 * 12,
      estimatedEgressMonthlyUsd: 0,
      shouldPin: isPopular,
      autoMigrateTarget: isStale ? 'arweave' : null,
      autoMigrateAfterDays: isStale ? 0 : 365,
    };
  }

  // >2GB → B2 (cold bulk storage)
  return {
    backend: 'b2',
    isZeroCost: false,
    contentType: contentType ?? 'longform',
    reason: `Very large VOD ${formatSize(size)} → Backblaze B2 (cheapest bulk, CDN-cached)`,
    mirrorToIPFS: false,
    mirrorToArweave: false,
    estimatedMonthlyCostUsd: (size / 1_073_741_824) * BACKEND_COSTS.b2,
    retentionDays: 365,
    storageTier: 'tier2_cheap',
    specificBackend: 'b2',
    backendLabel: 'Backblaze B2 — $0.006/GB/mo',
    annualCostUsd: (size / 1_073_741_824) * BACKEND_COSTS.b2 * 12,
    estimatedEgressMonthlyUsd: 0,
    shouldPin: isPopular,
    autoMigrateTarget: isStale ? 'arweave' : null,
    autoMigrateAfterDays: isStale ? 0 : 365,
  };
}

// ─── Cost Estimation ────────────────────────────────────────────────────

/**
 * Estimate the monthly cost for a given file size and backend.
 */
export function estimateMonthlyCost(sizeBytes: number, backend: string): number {
  const table = BACKEND_COSTS as Record<string, number>;
  const costPerGBmo = table[backend] ?? 0.015;
  return (sizeBytes / 1_073_741_824) * costPerGBmo;
}

/**
 * Estimate the one-time cost for Arweave upload.
 */
export function estimateArweaveCost(sizeBytes: number): string {
  const cost = (sizeBytes / 1_000_000) * 0.0006;
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

/**
 * Estimate annual storage cost for a creator based on their current usage.
 */
export function estimateCreatorAnnualCost(
  _totalBytes: number,
  byBackend: Record<string, number>,
): { monthly: number; annual: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let totalMonthly = 0;

  for (const [backend, bytes] of Object.entries(byBackend)) {
    const cost = estimateMonthlyCost(bytes, backend);
    breakdown[backend] = cost;
    totalMonthly += cost;
  }

  return {
    monthly: totalMonthly,
    annual: totalMonthly * 12,
    breakdown,
  };
}

// ─── Auto-Migration Engine ──────────────────────────────────────────────

/**
 * Find candidates for auto-migration to cheaper storage tiers.
 *
 * Examines content metadata and current storage state, then returns
 * a prioritized list of migration actions sorted by savings potential.
 */
export async function findMigrationCandidates(
  _env: Env,
  storageItems: Array<{
    contentId: string;
    size: number;
    backend: string;
    uploadedAt: number;
    viewCount7d?: number;
    contentType?: string;
    creatorWallet?: string;
  }>,
): Promise<MigrationAction[]> {
  const now = Date.now();
  const migrations: MigrationAction[] = [];

  for (const item of storageItems) {
    const ageDays = (now - item.uploadedAt) / (86400 * 1000);
    const views = item.viewCount7d ?? 0;
    const currentCost = estimateMonthlyCost(item.size, item.backend);

    // Skip premium/archival content
    if (item.backend === 'arweave') continue;
    if (item.contentType === 'premium') continue;

    // Rule 1: R2 Standard → R2 Infrequent Access (>30d, cold)
    if (item.backend === 'r2_standard' && ageDays >= COLD_AGE_DAYS && views < POPULAR_VIEWS_7D) {
      const newCost = estimateMonthlyCost(item.size, 'r2_infrequent_access');
      migrations.push({
        contentId: item.contentId,
        from: 'r2_standard',
        to: 'r2_infrequent_access',
        reason: `Cold (${Math.round(ageDays)}d, ${views} views/7d) → R2 IA saves ${(((currentCost - newCost) / currentCost) * 100).toFixed(0)}%`,
        size: item.size,
        savingsPerMonth: currentCost - newCost,
      });
    }

    // Rule 2: R2 → B2 for large files (>500MB, >60d, not popular)
    if (
      (item.backend === 'r2_standard' || item.backend === 'r2_infrequent_access') &&
      item.size > MEDIUM_MAX_SIZE &&
      ageDays >= 60 &&
      views < 50
    ) {
      const newCost = estimateMonthlyCost(item.size, 'b2');
      migrations.push({
        contentId: item.contentId,
        from: item.backend,
        to: 'b2',
        reason: `Large file (${formatSize(item.size)}) → B2 saves ${currentCost > 0 ? (((currentCost - newCost) / currentCost) * 100).toFixed(0) : 100}%`,
        size: item.size,
        savingsPerMonth: currentCost - newCost,
      });
    }

    // Rule 3: R2 → IPFS for small files (<100MB, >90d, low traffic)
    if (
      (item.backend === 'r2_standard' || item.backend === 'r2_infrequent_access') &&
      item.size <= 100 * 1024 * 1024 &&
      ageDays >= ARCHIVE_AGE_DAYS &&
      views < 10
    ) {
      migrations.push({
        contentId: item.contentId,
        from: item.backend,
        to: 'ipfs_storacha',
        reason: `Small cold file (${formatSize(item.size)}) → IPFS (free, saves $${currentCost.toFixed(4)}/mo)`,
        size: item.size,
        savingsPerMonth: currentCost,
      });
    }

    // Rule 4: B2 stale → Arweave (>180d, <5 views, creator approved)
    if (item.backend === 'b2' && ageDays >= STALE_AGE_DAYS && views < 5) {
      const arweaveCost = estimateArweaveCost(item.size);
      migrations.push({
        contentId: item.contentId,
        from: 'b2',
        to: 'arweave',
        reason: `Stale content (${Math.round(ageDays)}d) → Arweave permanent (${arweaveCost} one-time vs $${currentCost.toFixed(4)}/mo ongoing)`,
        size: item.size,
        savingsPerMonth: currentCost,
      });
    }
  }

  // Sort by savings (highest first)
  migrations.sort((a, b) => b.savingsPerMonth - a.savingsPerMonth);
  return migrations;
}

/**
 * Track migration actions in KV for persistence and monitoring.
 */
export async function persistMigrationPlan(env: Env, migrations: MigrationAction[]): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    await kv.put(
      `${KV_PREFIX_MIGRATION}pending`,
      JSON.stringify(migrations),
      { expirationTtl: 86400 * 7 }, // 1 week TTL
    );
    log('info', `[storage-strategy] Persisted ${migrations.length} migration candidates`);
  } catch (err) {
    log('warn', '[storage-strategy] Failed to persist migration plan', err);
  }
}

/**
 * Get the current pending migration plan from KV.
 */
export async function getMigrationPlan(env: Env): Promise<MigrationAction[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const raw = await kv.get(`${KV_PREFIX_MIGRATION}pending`);
    return raw ? (JSON.parse(raw) as MigrationAction[]) : [];
  } catch {
    return [];
  }
}

// ─── Popularity Tracking ────────────────────────────────────────────────

/**
 * Track an individual content view for popularity scoring.
 */
export async function trackContentView(env: Env, contentId: string): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const key = `${KV_PREFIX_POPULAR}${contentId}`;
  try {
    const raw = await kv.get(key);
    const data = raw ? (JSON.parse(raw) as { views: number[] }) : { views: [] as number[] };
    data.views.push(Date.now());

    // Keep only last 7 days
    const cutoff = Date.now() - 7 * 86400 * 1000;
    data.views = data.views.filter((t: number) => t > cutoff);

    await kv.put(key, JSON.stringify(data), { expirationTtl: 86400 * 30 });
  } catch {
    // Best effort
  }
}

/**
 * Get the view count for content in the last 7 days.
 */
export async function getViewCount7d(env: Env, contentId: string): Promise<number> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return 0;

  try {
    const raw = await kv.get(`${KV_PREFIX_POPULAR}${contentId}`);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { views: number[] };
    const cutoff = Date.now() - 7 * 86400 * 1000;
    return data.views.filter((t: number) => t > cutoff).length;
  } catch {
    return 0;
  }
}

// ─── Cost Tracking ──────────────────────────────────────────────────────

/**
 * Track storage cost for a creator per billing period.
 */
export async function trackCreatorCost(
  env: Env,
  wallet: string,
  cost: number,
  bytes: number,
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const month = new Date().toISOString().substring(0, 7); // "2026-07"
  const key = `${KV_PREFIX_COST}${wallet.toLowerCase()}:${month}`;

  try {
    const raw = await kv.get(key);
    const data = raw ? (JSON.parse(raw) as { cost: number; bytes: number }) : { cost: 0, bytes: 0 };
    data.cost += cost;
    data.bytes += bytes;
    await kv.put(key, JSON.stringify(data), { expirationTtl: 86400 * 92 }); // 3 months
  } catch {
    // Best effort
  }
}

/**
 * Get monthly storage cost history for a creator.
 */
export async function getCreatorCostHistory(
  env: Env,
  wallet: string,
): Promise<Array<{ month: string; cost: number; bytes: number }>> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  const prefix = `${KV_PREFIX_COST}${wallet.toLowerCase()}:`;
  try {
    const items = await kv.list({ prefix });
    const results: Array<{ month: string; cost: number; bytes: number }> = [];

    for (const key of items.keys) {
      const raw = await kv.get(key.name);
      if (raw) {
        const data = JSON.parse(raw) as { cost: number; bytes: number };
        const month = key.name.replace(prefix, '');
        results.push({ month, ...data });
      }
    }

    return results.sort((a, b) => a.month.localeCompare(b.month));
  } catch {
    return [];
  }
}

// ─── Storage Forecasting ────────────────────────────────────────────────

/**
 * Project future storage usage and costs for a creator.
 *
 * Uses a simple linear projection based on historical data.
 * Returns a forecast with current usage, projected growth, and recommendations.
 */
export function forecastStorage(
  currentBytes: number,
  monthlyCost: number,
  usageHistory?: Array<{ bytes: number }>,
): CreatorStorageForecast {
  // Calculate growth rate from history (if available)
  let growthRate = 0.15; // Default: 15% monthly growth

  if (usageHistory && usageHistory.length >= 2) {
    const oldest = usageHistory[0]?.bytes ?? currentBytes;
    const newest = usageHistory[usageHistory.length - 1]?.bytes ?? currentBytes;
    const months = usageHistory.length;

    if (oldest > 0 && months > 0) {
      const totalGrowth = newest / oldest;
      growthRate = totalGrowth ** (1 / months) - 1;
      // Cap at reasonable bounds
      growthRate = Math.max(0.01, Math.min(3.0, growthRate));
    }
  }

  const projected30d = currentBytes * (1 + growthRate);
  const projected90d = currentBytes * (1 + growthRate) ** 3;

  const averageCostPerByte = currentBytes > 0 ? monthlyCost / currentBytes : 0;
  const projectedMonthly30d = projected30d * averageCostPerByte;
  const projectedMonthly90d = projected90d * averageCostPerByte;

  const freeLimit = 5 * 1_073_741_824; // 5GB free tier
  const monthlyGrowth = currentBytes * growthRate;
  const daysUntilFull =
    monthlyGrowth > 0 ? Math.ceil(((freeLimit - currentBytes) / monthlyGrowth) * 30) : null;

  let recommendation: string;
  if (daysUntilFull !== null && daysUntilFull <= 0) {
    recommendation =
      '⚠️ You have exceeded your free storage tier. Upgrade to Premium ($5/mo) to continue uploading.';
  } else if (daysUntilFull !== null && daysUntilFull <= 30) {
    recommendation = `⚠️ You will exhaust your free storage in ~${daysUntilFull} days. Consider upgrading to Premium ($5/mo) for 50GB.`;
  } else if (daysUntilFull !== null && daysUntilFull <= 90) {
    recommendation = `📈 At your current rate, you'll use ${formatSize(projected90d)} in 3 months. Plan to upgrade or clean up old content.`;
  } else {
    recommendation = `✅ Your current storage usage of ${formatSize(currentBytes)} is well within the free tier. Keep creating!`;
  }

  return {
    currentBytes,
    projectedBytes30d: projected30d,
    projectedBytes90d: projected90d,
    currentMonthlyCost: monthlyCost,
    projectedMonthlyCost30d: projectedMonthly30d,
    projectedMonthlyCost90d: projectedMonthly90d,
    daysUntilFull,
    recommendation,
  };
}

// ─── Strategy Stats ─────────────────────────────────────────────────────

/**
 * Get overall strategy statistics.
 */
export async function getStrategyStats(
  env: Env,
  storageItems: Array<{
    size: number;
    backend: string;
    contentType?: string;
  }>,
): Promise<StrategyStats> {
  const stats: StrategyStats = {
    totalContent: storageItems.length,
    byTier: {
      tier1_free: 0,
      tier2_cheap: 0,
      tier3_premium: 0,
    },
    byBackend: {},
    estimatedMonthlySpend: 0,
    potentialMonthlySavings: 0,
    pendingMigrations: [],
  };

  for (const item of storageItems) {
    stats.byBackend[item.backend] = (stats.byBackend[item.backend] ?? 0) + 1;
    stats.estimatedMonthlySpend += estimateMonthlyCost(item.size, item.backend);

    // Classify into tiers
    if (
      ['ipfs_storacha', 'ipfs_pinata', 'ipfs_4everland', 'ipfs', 'blossom'].includes(item.backend)
    ) {
      stats.byTier.tier1_free++;
    } else if (['arweave'].includes(item.backend)) {
      stats.byTier.tier3_premium++;
    } else {
      stats.byTier.tier2_cheap++;
    }
  }

  // Get pending migrations for savings projection
  const migrations = await getMigrationPlan(env);
  stats.pendingMigrations = migrations;
  stats.potentialMonthlySavings = migrations.reduce((sum, m) => sum + m.savingsPerMonth, 0);

  return stats;
}

// ─── Backend Labels ─────────────────────────────────────────────────────

/**
 * Get a human-readable label for any backend identifier.
 */
export function getBackendLabel(backend: string): string {
  const labels: Record<string, string> = {
    blossom: 'Blossom (nostr.build) — free CDN',
    ipfs: 'IPFS (decentralized)',
    ipfs_storacha: 'IPFS via Storacha (web3.storage)',
    ipfs_pinata: 'IPFS via Pinata',
    ipfs_4everland: 'IPFS via 4EVERLAND',
    r2: 'Cloudflare R2',
    r2_standard: 'Cloudflare R2 Standard',
    r2_infrequent_access: 'Cloudflare R2 Infrequent Access',
    b2: 'Backblaze B2',
    storj: 'Storj (decentralized)',
    arweave: 'Arweave (permanent)',
    bunny: 'BunnyCDN Storage',
    sia: 'Sia Network',
    filecoin: 'Filecoin (cold archive)',
    'r2+ipfs': 'R2 + IPFS mirror',
    'r2+arweave': 'R2 + Arweave permanent',
    peertube: 'PeerTube federation',
    lbry: 'LBRY/Odysee (P2P)',
  };
  return labels[backend] ?? backend;
}

/**
 * Get cost tier color for dashboard display.
 */
export function getTierColor(tier: StorageTier): string {
  switch (tier) {
    case 'tier1_free':
      return '#00ff41'; // Green — free
    case 'tier2_cheap':
      return '#f7931a'; // Orange — cheap
    case 'tier3_premium':
      return '#8a63d2'; // Purple — premium
  }
}

/**
 * Get emoji for a backend.
 */
export function getBackendEmoji(backend: string): string {
  const emojis: Record<string, string> = {
    blossom: '🌸',
    ipfs: '🌐',
    ipfs_storacha: '🌐',
    ipfs_pinata: '📌',
    r2: '☁️',
    r2_standard: '☁️',
    r2_infrequent_access: '❄️',
    b2: '💾',
    storj: '🔗',
    arweave: '⛓️',
    bunny: '🐰',
    sia: '📡',
    filecoin: '🗄️',
    peertube: '🎥',
    lbry: '📺',
  };
  return emojis[backend] ?? '📁';
}

/**
 * Check if a content ID is currently pinned (popular).
 */
export async function isContentPopular(env: Env, contentId: string): Promise<boolean> {
  const views = await getViewCount7d(env, contentId);
  return views >= POPULAR_VIEWS_7D;
}

/**
 * Mark content as pinned for popular retention.
 */
export async function markContentPinned(env: Env, contentId: string): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  await kv
    .put(`${KV_PREFIX_POPULAR}${contentId}:pinned`, JSON.stringify({ pinnedAt: Date.now() }), {
      expirationTtl: 86400 * 90,
    })
    .catch(() => {});
}

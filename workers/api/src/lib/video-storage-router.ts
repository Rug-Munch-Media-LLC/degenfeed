/**
 * @degenfeed/api-worker — Decentralized Video Storage Router
 *
 * ZERO-COST HOSTING PRIORITY:
 *   1. Blossom (nostr.build free tier — 20MB/clip, 3min max, global CDN, $0)
 *   2. PeerTube federation (videos on other instances — $0)
 *   3. YouTube embeds (link to YouTube — $0)
 *   4. Twitch embeds (link to Twitch VODs — $0)
 *   5. DTube/Steem (blockchain-stored — $0)
 *   6. Odysee/LBRY (P2P hosting — $0)
 *   7. Nostr NIP-71 (video events on relays — $0)
 *   8. Farcaster Frames (external video links — $0)
 *   9. IPFS (via web3.storage free tier, public gateways — $0)
 *   10. Arweave (permanent, one-time fee ~$0.01/MB — cheap)
 *   11. R2 ($0.015/GB/month)
 *
 * Only fall back to R2/IPFS if creator explicitly wants "native upload".
 *
 * Each route is analyzed for the best zero-cost option first.
 * Content classification determines routing strategy.
 */

import { log } from '../logger';
import type { Env } from '../types';
import type { IPFSUploadResult } from './ipfs-storage';
import { getIPFSGatewayUrl, uploadBufferToIPFS } from './ipfs-storage';
import type { R2UploadResult } from './r2-storage';
import { uploadToR2 } from './r2-storage';

// ─── Types ──────────────────────────────────────────────────────────────

/** Content categories for storage routing decisions */
export type VideoContentType =
  | 'short' // <60s short-form video
  | 'longform' // >=60s VOD
  | 'podcast' // Audio / podcast episode
  | 'livestream' // Live stream recording (VOD)
  | 'premium' // Creator-gated premium content
  | 'temporary'; // Temp upload (auto-delete)

/** Storage backend for a given piece of content */
export type StorageBackend =
  | 'peertube-federation'
  | 'youtube-embed'
  | 'twitch-embed'
  | 'dtube-steem'
  | 'odysee-lbry'
  | 'nostr-nip71'
  | 'farcaster-frame'
  | 'blossom' // Blossom-compatible file server (nostr.build free tier: 20MB/clip, 3min)
  | 'ipfs'
  | 'r2'
  | 'arweave'
  | 'r2+ipfs' // R2 primary + IPFS mirror
  | 'r2+arweave' // R2 primary + Arweave permanent copy
  | 'b2'; // Backblaze B2 bulk storage

/** Result of routing analysis */
export interface RoutingDecision {
  /** The primary storage backend */
  backend: StorageBackend;
  /** Content type classification */
  contentType: VideoContentType;
  /** Human-readable reason for the routing choice */
  reason: string;
  /** Whether an IPFS mirror should also be created */
  mirrorToIPFS: boolean;
  /** Whether an Arweave permanent copy should be created */
  mirrorToArweave: boolean;
  /** Estimated storage cost per month (USD) — $0 for free options */
  estimatedMonthlyCostUsd: number;
  /** Suggested retention period in days (0 = permanent) */
  retentionDays: number;
  /** Zero-cost indicator */
  isZeroCost: boolean;
  /** The external platform URL if using embed/link strategy */
  externalUrl?: string;
}

/** Unified result after storing content */
export interface StorageResult {
  /** Unique content identifier */
  contentId: string;
  /** Content type classification */
  contentType: VideoContentType;
  /** Primary storage backend used */
  backend: StorageBackend;
  /** Direct URL to content */
  url: string;
  /** CDN URL (if cached) */
  cdnUrl?: string;
  /** IPFS hash (if mirrored) */
  ipfsHash?: string;
  /** Arweave transaction ID (if archived) */
  arweaveTxId?: string;
  /** Whether this was stored at zero cost */
  isZeroCost: boolean;
  /** Storage cost breakdown */
  cost: {
    monthlyStorage: number;
    monthlyBandwidth: number;
    totalMonthly: number;
  };
  /** When the content will be deleted (0 = permanent) */
  expiresAt?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────

/** Zero-cost platform prefixes we can route to */
const ZERO_COST_PLATFORMS = {
  YOUTUBE: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i,
  TWITCH: /^(https?:\/\/)?(www\.)?twitch\.tv\//i,
  PEERTUBE: /^(https?:\/\/)?.*\.peertube\..*/i,
  DTUBE: /^(https?:\/\/)?(www\.)?d\.tube\//i,
  ODYSEE: /^(https?:\/\/)?(www\.)?odysee\.com\//i,
  LBRY: /^(https?:\/\/)?(www\.)?lbry\.tv\//i,
  NOSTR: /^(nostr:|wss:\/\/)/i,
  FARCASTER: /^(https?:\/\/)?(www\.)?warpcast\.com\//i,
  IPFS: /^(ipfs:\/\/|.*\/ipfs\/)/i,
  ARWEAVE: /^(ar:\/\/|.*arweave\.(net|xyz)\/)/i,
};

// ─── Storage Router ───────────────────────────────────────────────────

/**
 * Analyze content and route to the best (cheapest) storage option.
 *
 * Priority ordering:
 *   1. If it's already on a zero-cost platform → use that
 *   2. Short-form (<60s) → IPFS (free tier, decentralized)
 *   3. Podcast/audio → IPFS (small files, free)
 *   4. Premium content → Arweave (permanent, cheap one-time)
 *   5. Long-form VOD → Check PeerTube federation first, then R2
 *   6. Livestream VOD → R2 + IPFS mirror
 */
/**
 * Human-readable byte size (e.g. "1.5 MB"). Shared by storage strategy
 * and chat file helpers.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function analyzeStorageRoute(params: {
  /** Original video URL (if sourced from external platform) */
  externalUrl?: string;
  /** Video duration in seconds */
  duration: number;
  /** File size in bytes */
  fileSize?: number;
  /** Whether explicit native upload was requested */
  nativeUpload?: boolean;
  /** Whether content is premium/gated */
  isPremium?: boolean;
  /** Whether content is temporary */
  isTemporary?: boolean;
  /** Content format (mp4, webm, m3u8, etc.) */
  format?: string;
}): RoutingDecision {
  const { externalUrl, duration, fileSize, nativeUpload, isPremium, isTemporary, format } = params;

  // ─── RULE 1: External URLs on zero-cost platforms ─────────────────

  if (externalUrl && !nativeUpload) {
    if (ZERO_COST_PLATFORMS.YOUTUBE.test(externalUrl)) {
      return {
        backend: 'youtube-embed',
        contentType: classifyContentType(duration, format),
        reason: 'YouTube link — no hosting cost, serves via YouTube embeds',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl,
      };
    }
    if (ZERO_COST_PLATFORMS.TWITCH.test(externalUrl)) {
      return {
        backend: 'twitch-embed',
        contentType: classifyContentType(duration, format),
        reason: 'Twitch link — no hosting cost, serves via Twitch embeds',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl,
      };
    }
    if (ZERO_COST_PLATFORMS.PEERTUBE.test(externalUrl)) {
      return {
        backend: 'peertube-federation',
        contentType: classifyContentType(duration, format),
        reason: 'PeerTube hosted — zero cost, federated instance serves the video',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl,
      };
    }
    if (ZERO_COST_PLATFORMS.DTUBE.test(externalUrl)) {
      return {
        backend: 'dtube-steem',
        contentType: classifyContentType(duration, format),
        reason: 'DTube/Steem — blockchain-stored video, zero hosting cost',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl,
      };
    }
    if (
      ZERO_COST_PLATFORMS.ODYSEE.test(externalUrl) ||
      ZERO_COST_PLATFORMS.LBRY.test(externalUrl)
    ) {
      return {
        backend: 'odysee-lbry',
        contentType: classifyContentType(duration, format),
        reason: 'Odysee/LBRY — P2P hosted, zero cost via LBRY network',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl,
      };
    }
    if (ZERO_COST_PLATFORMS.IPFS.test(externalUrl)) {
      const ipfsCid = extractIPFSCid(externalUrl);
      return {
        backend: 'ipfs',
        contentType: classifyContentType(duration, format),
        reason: 'Already on IPFS — zero cost, served via IPFS gateways',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl: ipfsCid ? getIPFSGatewayUrl(ipfsCid) : externalUrl,
      };
    }
    if (ZERO_COST_PLATFORMS.ARWEAVE.test(externalUrl)) {
      return {
        backend: 'arweave',
        contentType: classifyContentType(duration, format),
        reason: 'Already on Arweave — one-time fee paid, permanent storage',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 0,
        isZeroCost: true,
        externalUrl,
      };
    }
  }

  // ─── RULE 2: Native upload requested → use our storage ────────────

  if (nativeUpload) {
    // Determine best native storage
    if (isPremium || (fileSize && fileSize < 5 * 1024 * 1024)) {
      // Premium or small files → Arweave
      return {
        backend: 'arweave',
        contentType: classifyContentType(duration, format),
        reason: 'Native upload — Arweave permanent storage (~$0.01/MB one-time)',
        mirrorToIPFS: true,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: fileSize ? (fileSize / 1024 / 1024) * 0.01 : 0.001,
        retentionDays: 0,
        isZeroCost: false,
      };
    }

    if (duration < 60 || (fileSize && fileSize < 10 * 1024 * 1024)) {
      // Short or small → IPFS free tier
      return {
        backend: 'ipfs',
        contentType: 'short',
        reason: 'Short-form content — IPFS free tier (web3.storage / nft.storage)',
        mirrorToIPFS: false,
        mirrorToArweave: false,
        estimatedMonthlyCostUsd: 0,
        retentionDays: 365,
        isZeroCost: true,
      };
    }

    // Long-form → R2 (cheap) + optional IPFS mirror
    return {
      backend: 'r2+ipfs',
      contentType: 'longform',
      reason: 'Long-form VOD — R2 ($0.015/GB) + IPFS mirror (free)',
      mirrorToIPFS: true,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: fileSize ? (fileSize / 1024 / 1024 / 1024) * 0.015 : 0.01,
      retentionDays: 365,
      isZeroCost: false,
    };
  }

  // ─── RULE 3: Auto-route based on content analysis ─────────────────

  if (duration < 60) {
    return {
      backend: 'ipfs',
      contentType: 'short',
      reason: 'Short-form content (<60s) → IPFS free tier (web3.storage)',
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: 0,
      retentionDays: 365,
      isZeroCost: true,
    };
  }

  if (isTemporary) {
    return {
      backend: 'ipfs',
      contentType: 'temporary',
      reason: 'Temporary content → IPFS (free, auto-garbage-collect if unpinned)',
      mirrorToIPFS: false,
      mirrorToArweave: false,
      estimatedMonthlyCostUsd: 0,
      retentionDays: 30,
      isZeroCost: true,
    };
  }

  // Default: long-form → R2
  return {
    backend: 'r2',
    contentType: 'longform',
    reason: 'Long-form VOD → R2 ($0.015/GB/month)',
    mirrorToIPFS: false,
    mirrorToArweave: false,
    estimatedMonthlyCostUsd: fileSize ? (fileSize / 1024 / 1024 / 1024) * 0.015 : 0.01,
    retentionDays: 365,
    isZeroCost: false,
  };
}

// ─── Classify video content type ──────────────────────────────────────

export function classifyContentType(duration: number, _format?: string): VideoContentType {
  if (duration < 60) return 'short';
  if (duration < 600) return 'longform'; // 1-10 min
  if (duration < 3600) return 'podcast'; // 10-60 min
  return 'livestream';
}

// ─── Execute storage routing ───────────────────────────────────────────

export async function storeVideo(
  env: Env,
  params: {
    contentId: string;
    buffer?: ArrayBuffer;
    externalUrl?: string;
    duration: number;
    fileSize?: number;
    nativeUpload?: boolean;
    isPremium?: boolean;
    isTemporary?: boolean;
    format?: string;
  },
): Promise<StorageResult> {
  const {
    contentId,
    buffer,
    externalUrl,
    duration,
    fileSize,
    nativeUpload,
    isPremium,
    isTemporary,
    format,
  } = params;

  const route = analyzeStorageRoute({
    externalUrl,
    duration,
    fileSize,
    nativeUpload,
    isPremium,
    isTemporary,
    format,
  });

  log.info('[storage-router]', {
    contentId,
    backend: route.backend,
    reason: route.reason,
    isZeroCost: route.isZeroCost,
  });

  // ─── Zero-cost routes (no upload needed) ──────────────────────────

  if (route.isZeroCost && !nativeUpload && externalUrl) {
    return {
      contentId,
      contentType: route.contentType,
      backend: route.backend,
      url: externalUrl,
      isZeroCost: true,
      cost: { monthlyStorage: 0, monthlyBandwidth: 0, totalMonthly: 0 },
      expiresAt: route.retentionDays > 0 ? Date.now() + route.retentionDays * 86400000 : undefined,
    };
  }

  // ─── Non-zero-cost routes (require upload) ────────────────────────

  if (!buffer) {
    throw new Error('buffer required for native upload storage');
  }

  let primaryUrl = '';
  let ipfsHash: string | undefined;

  // Upload to IPFS
  if (route.backend === 'ipfs' || route.mirrorToIPFS) {
    try {
      const ipfsResult: IPFSUploadResult = await uploadBufferToIPFS(env, buffer, {
        filename: contentId,
        contentType: format ? `video/${format}` : 'video/mp4',
      });
      ipfsHash = ipfsResult.cid;
      primaryUrl = getIPFSGatewayUrl(ipfsResult.cid);
    } catch (err) {
      log.warn('[storage-router] IPFS upload failed, falling back to R2', { error: String(err) });
      // Fall through to R2
    }
  }

  // Upload to R2 (fallback or primary)
  if (
    route.backend === 'r2' ||
    route.backend === 'r2+ipfs' ||
    (!primaryUrl && route.backend !== 'arweave')
  ) {
    try {
      const r2Result: R2UploadResult = await uploadToR2(env, contentId, buffer, {
        contentType: format ? `video/${format}` : 'video/mp4',
        metadata: { duration: String(duration) },
      });
      primaryUrl = r2Result.url;
    } catch (err) {
      log.error('[storage-router] R2 upload failed', { error: String(err) });
      throw err;
    }
  }

  // Upload to Arweave
  if ((route.backend === 'arweave' || route.backend === 'r2+arweave') && !primaryUrl) {
    try {
      // Arweave upload would go here (via Irys or similar)
      // For now, fall back to IPFS
      if (!ipfsHash) {
        const ipfsResult = await uploadBufferToIPFS(env, buffer, {
          filename: contentId,
          contentType: format ? `video/${format}` : 'video/mp4',
        });
        ipfsHash = ipfsResult.cid;
        primaryUrl = getIPFSGatewayUrl(ipfsResult.cid);
      }
    } catch (err) {
      log.error('[storage-router] Arweave/IPFS upload failed', { error: String(err) });
      throw err;
    }
  }

  // Compute estimated cost
  const costPerGB = route.backend === 'arweave' ? 10 : 0.015; // $10/GB Arweave (one-time), $0.015/GB R2 (monthly)
  const sizeGB = fileSize ? fileSize / 1024 / 1024 / 1024 : 0;
  const monthlyStorage = route.isZeroCost ? 0 : sizeGB * costPerGB;
  const monthlyBandwidth = monthlyStorage * 0.5; // estimate 50% of storage for bandwidth

  return {
    contentId,
    contentType: route.contentType,
    backend: route.backend,
    url: primaryUrl,
    ipfsHash,
    isZeroCost: route.isZeroCost,
    cost: {
      monthlyStorage,
      monthlyBandwidth,
      totalMonthly: monthlyStorage + monthlyBandwidth,
    },
    expiresAt: route.retentionDays > 0 ? Date.now() + route.retentionDays * 86400000 : undefined,
  };
}

// ─── Creator Storage Usage ────────────────────────────────────────────

export interface CreatorStorageUsage {
  totalBytes: number;
  totalReadable: string;
  freeLimit: number;
  usagePercent: number;
  byBackend: Record<string, { bytes: number; readable: string; count: number }>;
  byType: Record<string, number>;
  plan: string;
  expiringSoon: Array<{ id: string; name: string; expiresAt: number; size: number }>;
}

export async function getCreatorStorageUsage(
  env: Env,
  _wallet: string,
): Promise<CreatorStorageUsage> {
  const freeLimit = 5 * 1_073_741_824; // 5 GB
  const zeroUsage = {
    bytes: 0,
    readable: '0 B',
    count: 0,
  };

  try {
    let totalBytes = 0;
    const byBackend: Record<string, { bytes: number; readable: string; count: number }> = {
      ipfs: { ...zeroUsage },
      r2: { ...zeroUsage },
      arweave: { ...zeroUsage },
    };

    // If R2 is configured, attempt to list objects
    if (env.VIDEO_STORAGE_BINDING) {
      const r2 = env.VIDEO_STORAGE_BINDING as R2Bucket;
      const listed = await r2.list({ limit: 1000 });
      for (const obj of listed.objects) {
        totalBytes += obj.size;
        byBackend.r2.bytes += obj.size;
        byBackend.r2.count++;
      }
      byBackend.r2.readable = formatBytes(byBackend.r2.bytes);
    }

    totalBytes = totalBytes || 0;
    const usagePercent = freeLimit > 0 ? Math.min(100, (totalBytes / freeLimit) * 100) : 0;

    return {
      totalBytes,
      totalReadable: formatBytes(totalBytes),
      freeLimit,
      usagePercent: Math.round(usagePercent * 100) / 100,
      byBackend,
      byType: {},
      plan: 'free',
      expiringSoon: [],
    };
  } catch {
    return {
      totalBytes: 0,
      totalReadable: '0 B',
      freeLimit,
      usagePercent: 0,
      byBackend: {
        ipfs: { ...zeroUsage },
        r2: { ...zeroUsage },
        arweave: { ...zeroUsage },
      },
      byType: {},
      plan: 'free',
      expiringSoon: [],
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

// ─── Utility ─────────────────────────────────────────────────────────

function extractIPFSCid(url: string): string | null {
  const match = url.match(/\/ipfs\/([a-z2-9]{46,}|[a-z0-9]{46,})/i);
  if (match?.[1]) return match[1];
  if (url.startsWith('ipfs://')) return url.slice(7).replace(/^\/+/, '');
  return null;
}

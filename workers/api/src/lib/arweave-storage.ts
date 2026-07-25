/**
 * @degenfeed/api-worker — Arweave Permanent Storage Integration
 *
 * Upload video content to Arweave via Irys (formerly Bundlr) for permanent
 * decentralized storage. One-time fee ~$0.01/MB.
 *
 * Designed for premium/permanent creator content where the creator pays
 * the upload fee (via connected wallet) or the platform covers it for
 * high-value content.
 *
 * Uses the same Irys gateway as permanence.ts but adapted for video files.
 */

import type { Env } from '../index';
import { log } from '../index';

// ─── Constants ──────────────────────────────────────────────────────────

const IRYS_NODE = 'https://node1.irys.xyz';
const ARWEAVE_GATEWAY = 'https://arweave.net';
const FALLBACK_GATEWAYS = [
  'https://arweave.dev',
  'https://gateway.irys.xyz',
  'https://arweave.net',
];

// ─── Types ──────────────────────────────────────────────────────────────

export interface ArweaveUploadResult {
  /** Arweave transaction ID */
  txId: string;
  /** Gateway URL for playback */
  gatewayUrl: string;
  /** All available gateway URLs */
  allGateways: string[];
  /** Upload cost in USD (estimated) */
  costUsd: number;
  /** File size in bytes */
  size: number;
  /** Timestamp of upload */
  uploadedAt: number;
  /** Tags applied to the transaction */
  tags: Array<{ name: string; value: string }>;
}

export interface ArweaveUploadOptions {
  /** Content title (stored as tag) */
  title?: string;
  /** Additional tags to attach */
  tags?: string[];
  /** Content type for the transaction tag */
  contentType?: string;
  /** Currency to pay with (default: matic for low fees) */
  currency?: 'matic' | 'ethereum' | 'solana';
  /** Wallet address to pay from (if creator pays) */
  payerWallet?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Estimate the cost of uploading to Arweave via Irys.
 * Current approximate: $0.01/MB (one-time, permanent).
 */
export function estimateArweaveCost(bytes: number): number {
  return (bytes / 1_000_000) * 0.01;
}

/**
 * Get the Arweave gateway URL for a transaction ID.
 */
export function getArweaveUrl(txId: string): string {
  return `${ARWEAVE_GATEWAY}/${txId}`;
}

/**
 * Get all gateway URLs for a transaction ID.
 */
export function getAllArweaveUrls(txId: string): string[] {
  return FALLBACK_GATEWAYS.map((gw) => `${gw}/${txId}`);
}

// ─── Upload ─────────────────────────────────────────────────────────────

/**
 * Upload a video/file to Arweave via Irys for permanent storage.
 *
 * @param buffer - File data as ArrayBuffer
 * @param mimeType - MIME type of the file
 * @param options - Upload options (title, tags, currency)
 * @returns ArweaveUploadResult with transaction ID and URLs
 *
 * NOTE: In production, this requires either:
 *   a) Irys node funding (platform pays, added to creator's bill)
 *   b) Creator pays via connected wallet (client-side upload to Irys)
 *
 * For client-side uploads, use the Irys SDK directly in the browser.
 * This server-side path handles platform-paid uploads.
 */
export async function storeVideoOnArweave(
  buffer: ArrayBuffer,
  mimeType: string,
  options?: ArweaveUploadOptions,
): Promise<ArweaveUploadResult> {
  const {
    title,
    tags: extraTags = [],
    contentType = mimeType,
    currency = 'matic',
  } = options ?? {};

  const size = buffer.byteLength;
  const costUsd = estimateArweaveCost(size);

  // Build Irys-compatible tags
  const tags: Array<{ name: string; value: string }> = [
    { name: 'App-Name', value: 'DegenFeed-Video' },
    { name: 'Content-Type', value: contentType },
    { name: 'Unix-Time', value: String(Math.floor(Date.now() / 1000)) },
    { name: 'Video-Platform', value: 'degenfeed' },
    ...(title ? [{ name: 'Title', value: title.substring(0, 128) }] : []),
    ...extraTags.map((t) => ({ name: 'Tag', value: t.substring(0, 128) })),
  ];

  log('info', `[arweave-storage] Uploading ${size} bytes to Arweave via Irys (est. $${costUsd.toFixed(4)})`);

  // Upload via Irys HTTP API
  // For large files, the client should use Irys SDK directly.
  // This server path handles moderate-sized files (<50MB).
  const response = await fetch(`${IRYS_NODE}/tx/${currency}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: (() => {
      // Irys expects the raw bytes with JSON metadata prepended
      const meta = JSON.stringify({ tags });
      const metaBytes = new TextEncoder().encode(meta);
      const combined = new Uint8Array(metaBytes.length + buffer.byteLength);
      combined.set(metaBytes, 0);
      combined.set(new Uint8Array(buffer), metaBytes.length);
      return combined;
    })(),
    signal: AbortSignal.timeout(300_000), // 5 min for Arweave uploads
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`Arweave/Irys upload failed (${response.status}): ${errText}`);
  }

  const result = (await response.json()) as { id?: string };
  if (!result.id) {
    throw new Error('Arweave/Irys upload returned no transaction ID');
  }

  const txId = result.id;
  log('info', `[arweave-storage] Upload complete: ${txId}`);

  return {
    txId,
    gatewayUrl: getArweaveUrl(txId),
    allGateways: getAllArweaveUrls(txId),
    costUsd,
    size,
    uploadedAt: Date.now(),
    tags,
  };
}

/**
 * Check if an Arweave transaction is confirmed/available.
 */
export async function verifyArweaveContent(txId: string): Promise<boolean> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    // Try fallback
    for (const gw of FALLBACK_GATEWAYS.slice(1)) {
      try {
        const res = await fetch(`${gw}/${txId}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return true;
      } catch {
        continue;
      }
    }
    return false;
  }
}

/**
 * Get the transaction status from Irys.
 */
export async function getArweaveTxStatus(
  txId: string,
): Promise<{ confirmed: boolean; blockHeight?: number } | null> {
  try {
    const response = await fetch(
      `${IRYS_NODE}/tx/${txId}/status`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { confirmed?: boolean; blockHeight?: number };
    return {
      confirmed: data.confirmed ?? false,
      blockHeight: data.blockHeight,
    };
  } catch {
    return null;
  }
}

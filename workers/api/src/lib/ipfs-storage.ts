/**
 * @degenfeed/api-worker — IPFS Storage Integration
 *
 * Upload video content to IPFS via multiple providers:
 *   - web3.storage (primary — free tier: 1TB, no API key required for small uploads)
 *   - Pinata (fallback — requires PINATA_API_KEY + PINATA_SECRET_KEY)
 *   - Public Infura IPFS (last resort — no pinning guarantee)
 *
 * Generates gateway URLs for content delivery:
 *   - ipfs.io
 *   - dweb.link
 *   - Our own gateway if configured
 *
 * Tracks pin status in KV for monitoring.
 */

import type { Env } from '../index';
import { log } from '../index';

// ─── Constants ──────────────────────────────────────────────────────────

const WEB3_STORAGE_API = 'https://api.web3.storage/upload';
const PINATA_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const INFURA_IPFS_API = 'https://ipfs.infura.io:5001/api/v0/add';

export const IPFS_GATEWAYS = [
  { url: 'https://{cid}.ipfs.dweb.link', name: 'dweb', priority: 1 },
  { url: 'https://ipfs.io/ipfs/{cid}', name: 'ipfs-io', priority: 2 },
  { url: 'https://cloudflare-ipfs.com/ipfs/{cid}', name: 'cf-ipfs', priority: 3 },
  { url: 'https://gateway.pinata.cloud/ipfs/{cid}', name: 'pinata-gw', priority: 4 },
] as const;

const KV_PREFIX = 'ipfs:pin:';

// ─── Types ──────────────────────────────────────────────────────────────

export interface IPFSUploadResult {
  /** Content Identifier (CID) */
  cid: string;
  /** Primary gateway URL for playback */
  gatewayUrl: string;
  /** All available gateway URLs */
  allGateways: string[];
  /** Which provider was used for the upload */
  provider: 'web3-storage' | 'pinata' | 'infura' | 'none';
  /** Whether the content is actively pinned */
  pinned: boolean;
  /** Size in bytes as reported by the provider */
  size: number;
  /** Timestamp of upload */
  uploadedAt: number;
}

export interface PinStatus {
  cid: string;
  provider: string;
  pinned: boolean;
  pinnedAt: number | null;
  lastChecked: number;
  error?: string;
}

// ─── Gateway Helpers ────────────────────────────────────────────────────

/**
 * Get the best IPFS gateway URL for a CID.
 * Falls back through priority-ordered gateways if preferDegenFeed is set.
 */
export function getIPFSGatewayUrl(cid: string, preferLocalGateway = true): string {
  const gateways = preferLocalGateway ? IPFS_GATEWAYS : IPFS_GATEWAYS.slice(1);
  const best = gateways[0];
  if (!best) return `https://ipfs.io/ipfs/${cid}`;
  return best.url.replace('{cid}', cid);
}

/**
 * Get all gateway URLs for a CID.
 */
export function getAllGatewayUrls(cid: string): string[] {
  return IPFS_GATEWAYS.map((gw) => gw.url.replace('{cid}', cid));
}

// ─── Provider Implementations ──────────────────────────────────────────

/**
 * Upload a file buffer to web3.storage (free tier).
 * Returns the CID on success, null on failure.
 */
async function uploadViaWeb3Storage(
  file: Blob,
  fileName: string,
  apiKey?: string,
): Promise<{ cid: string; size: number } | null> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const formData = new FormData();
    formData.append('file', file, fileName);

    const response = await fetch(WEB3_STORAGE_API, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(120_000), // 2 min for uploads
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      log('warn', `[ipfs-storage] web3.storage upload failed: ${response.status} ${errText}`);
      return null;
    }

    const result = (await response.json()) as { cid?: string };
    if (!result.cid) return null;

    return { cid: result.cid, size: file.size };
  } catch (err) {
    log('warn', `[ipfs-storage] web3.storage error:`, err);
    return null;
  }
}

/**
 * Upload via Pinata (requires PINATA_API_KEY + PINATA_SECRET_KEY in env).
 */
async function uploadViaPinata(
  file: Blob,
  fileName: string,
  apiKey: string,
  secretKey: string,
): Promise<{ cid: string; size: number } | null> {
  try {
    const formData = new FormData();
    formData.append('file', file, fileName);

    const response = await fetch(PINATA_API, {
      method: 'POST',
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: secretKey,
      },
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      log('warn', `[ipfs-storage] Pinata upload failed: ${response.status} ${errText}`);
      return null;
    }

    const result = (await response.json()) as { IpfsHash?: string };
    if (!result.IpfsHash) return null;

    return { cid: result.IpfsHash, size: file.size };
  } catch (err) {
    log('warn', `[ipfs-storage] Pinata error:`, err);
    return null;
  }
}

/**
 * Last-resort upload via Infura IPFS API (no pinning guarantee).
 */
async function uploadViaInfura(
  file: Blob,
  fileName: string,
): Promise<{ cid: string; size: number } | null> {
  try {
    const formData = new FormData();
    formData.append('file', file, fileName);

    const response = await fetch(INFURA_IPFS_API, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as { Hash?: string };
    if (!result.Hash) return null;

    return { cid: result.Hash, size: file.size };
  } catch {
    return null;
  }
}

// ─── KV Pin Tracking ───────────────────────────────────────────────────

async function trackPinStatus(
  kv: KVNamespace | undefined,
  cid: string,
  status: Omit<PinStatus, 'cid'>,
): Promise<void> {
  if (!kv) return;
  const key = `${KV_PREFIX}${cid}`;
  const record: PinStatus = { cid, ...status, lastChecked: Date.now() };
  try {
    await kv.put(key, JSON.stringify(record), { expirationTtl: 86400 * 365 }); // 1 year
  } catch (err) {
    log('warn', `[ipfs-storage] Failed to store pin status: ${cid}`, err);
  }
}

/**
 * Get the current pin status for a CID from KV.
 */
export async function getPinStatus(
  kv: KVNamespace | undefined,
  cid: string,
): Promise<PinStatus | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(`${KV_PREFIX}${cid}`);
    return raw ? (JSON.parse(raw) as PinStatus) : null;
  } catch {
    return null;
  }
}

// ─── Main Upload Function ──────────────────────────────────────────────

/**
 * Upload a video/file to IPFS.
 *
 * Provider priority:
 *   1. web3.storage (free, generous tier)
 *   2. Pinata (if API keys configured)
 *   3. Infura (last resort, no pinning)
 *
 * Stores pin status in KV (env.CACHE or env.CONTENT_LIBRARY) for monitoring.
 *
 * @param file - The file to upload (Blob)
 * @param fileName - File name for IPFS metadata
 * @param env - Worker env (for API keys and KV)
 * @returns IPFSUploadResult with CID and gateway URLs
 */
export async function uploadToIPFS(
  file: Blob,
  fileName: string,
  env: Env,
): Promise<IPFSUploadResult> {
  const uploadResult =
    (await uploadViaWeb3Storage(file, fileName, env.WEB3_STORAGE_API_KEY)) ??
    (env.PINATA_API_KEY && env.PINATA_SECRET_KEY
      ? await uploadViaPinata(file, fileName, env.PINATA_API_KEY, env.PINATA_SECRET_KEY)
      : null) ??
    (await uploadViaInfura(file, fileName));

  if (!uploadResult) {
    return {
      cid: '',
      gatewayUrl: '',
      allGateways: [],
      provider: 'none',
      pinned: false,
      size: file.size,
      uploadedAt: Date.now(),
    };
  }

  const { cid, size } = uploadResult;
  const pinned = uploadResult.provider !== 'infura';
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;

  // Track pin status in KV
  await trackPinStatus(kv, cid, {
    provider: uploadResult.provider,
    pinned,
    pinnedAt: pinned ? Date.now() : null,
  });

  return {
    cid,
    gatewayUrl: getIPFSGatewayUrl(cid),
    allGateways: getAllGatewayUrls(cid),
    provider: uploadResult.provider,
    pinned,
    size,
    uploadedAt: Date.now(),
  };
}

/**
 * Upload raw bytes to IPFS.
 * Convenience wrapper that converts ArrayBuffer to Blob.
 */
export async function uploadBufferToIPFS(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  env: Env,
): Promise<IPFSUploadResult> {
  const blob = new Blob([buffer], { type: mimeType });
  return uploadToIPFS(blob, fileName, env);
}

/**
 * Check if IPFS is reachable/healthy by hitting the web3.storage API.
 * Returns true if the service is accessible (not a full upload test).
 */
export async function checkIPFSHealth(): Promise<boolean> {
  try {
    const response = await fetch('https://up.web3.storage', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Verify that an IPFS CID resolves through at least one gateway.
 */
export async function verifyIPFSContent(cid: string): Promise<boolean> {
  const urls = [
    `https://ipfs.io/ipfs/${cid}`,
    `https://${cid}.ipfs.dweb.link`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return true;
    } catch {
      continue;
    }
  }

  return false;
}

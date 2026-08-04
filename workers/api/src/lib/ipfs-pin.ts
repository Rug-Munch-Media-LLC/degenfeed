/**
 * @degenfeed/api-worker — IPFS Pinning Helper
 *
 * Lightweight pinning utility for creator content:
 *   - Pinata free tier (1GB, 500 files, 10GB bandwidth/mo) — primary
 *   - web3.storage (free, generous tier) — fallback
 *   - Our own CF gateway (ipfs.degenfeed.xyz) — URL generation
 *
 * The returned gateway URL always prefers our own CF gateway first, so
 * playback traffic stays on our free 50GB/mo allocation.
 *
 * Usage:
 *   const { cid, gatewayUrl } = await pinToIPFS(buffer, 'clip.mp4', env);
 */

import { log } from '../logger';
import type { Env } from '../types';
import { DEGENFEED_IPFS_GATEWAY, getAllGatewayUrls, getIPFSGatewayUrl } from './ipfs-storage';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PinResult {
  /** Content Identifier (CID) */
  cid: string;
  /** Primary gateway URL (our own CF gateway) */
  gatewayUrl: string;
  /** All available gateway URLs */
  allGateways: string[];
  /** Which provider pinned the content */
  provider: 'pinata' | 'web3-storage' | 'none';
  /** Size in bytes */
  size: number;
  /** Timestamp of upload */
  uploadedAt: number;
  /** Error message when provider is 'none' */
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const PINATA_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const WEB3_STORAGE_API = 'https://api.web3.storage/upload';

// ─── Providers ──────────────────────────────────────────────────────────

/**
 * Pin via Pinata (free tier: 1GB, 500 files, 10GB bandwidth/mo).
 * Requires PINATA_API_KEY + PINATA_SECRET_KEY.
 */
async function pinViaPinata(
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
      log('warn', `[ipfs-pin] Pinata pin failed: ${response.status} ${errText}`);
      return null;
    }

    const result = (await response.json()) as { IpfsHash?: string };
    if (!result.IpfsHash) return null;
    return { cid: result.IpfsHash, size: file.size };
  } catch (err) {
    log('warn', '[ipfs-pin] Pinata error:', err);
    return null;
  }
}

/**
 * Pin via web3.storage (free tier — works without an API key for small files).
 */
async function pinViaWeb3Storage(
  file: Blob,
  fileName: string,
  apiKey?: string,
): Promise<{ cid: string; size: number } | null> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const formData = new FormData();
    formData.append('file', file, fileName);

    const response = await fetch(WEB3_STORAGE_API, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      log('warn', `[ipfs-pin] web3.storage pin failed: ${response.status} ${errText}`);
      return null;
    }

    const result = (await response.json()) as { cid?: string };
    if (!result.cid) return null;
    return { cid: result.cid, size: file.size };
  } catch (err) {
    log('warn', '[ipfs-pin] web3.storage error:', err);
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

/**
 * Pin a file to IPFS and return its CID + gateway URL.
 *
 * Provider priority (zero paid providers):
 *   1. Pinata (free tier — requires env keys)
 *   2. web3.storage (free, generous tier)
 *
 * Gateway URLs always prefer our own CF gateway (ipfs.degenfeed.xyz).
 *
 * @param buffer - File bytes to pin
 * @param filename - File name for IPFS metadata
 * @param env - Worker env (Pinata keys, web3.storage key)
 * @param mimeType - Optional MIME type for the blob
 * @returns PinResult with CID + gateway URLs
 */
export async function pinToIPFS(
  buffer: ArrayBuffer,
  filename: string,
  env: Env,
  mimeType = 'application/octet-stream',
): Promise<PinResult> {
  const blob = new Blob([buffer], { type: mimeType });

  const pinned =
    (env.PINATA_API_KEY && env.PINATA_SECRET_KEY
      ? await pinViaPinata(blob, filename, env.PINATA_API_KEY, env.PINATA_SECRET_KEY)
      : null) ?? (await pinViaWeb3Storage(blob, filename, env.WEB3_STORAGE_API_KEY));

  if (!pinned) {
    return {
      cid: '',
      gatewayUrl: '',
      allGateways: [],
      provider: 'none',
      size: buffer.byteLength,
      uploadedAt: Date.now(),
      error:
        'IPFS pin failed on all free providers. Set PINATA_API_KEY/PINATA_SECRET_KEY or WEB3_STORAGE_API_KEY, or use the Blossom provider for clips <20MB.',
    };
  }

  return {
    cid: pinned.cid,
    gatewayUrl: getIPFSGatewayUrl(pinned.cid),
    allGateways: getAllGatewayUrls(pinned.cid),
    provider: env.PINATA_API_KEY && env.PINATA_SECRET_KEY ? 'pinata' : 'web3-storage',
    size: pinned.size,
    uploadedAt: Date.now(),
  };
}

/**
 * Convenience: pin raw bytes to IPFS.
 * Alias of pinToIPFS that keeps a stable public API.
 */
export async function pinBytesToIPFS(
  buffer: ArrayBuffer,
  filename: string,
  env: Env,
  mimeType = 'application/octet-stream',
): Promise<PinResult> {
  return pinToIPFS(buffer, filename, env, mimeType);
}

/**
 * Resolve the best gateway URL for a CID, preferring our own CF gateway.
 */
export function gatewayUrlFor(cid: string): string {
  return getIPFSGatewayUrl(cid);
}

/** Our own CF gateway base (for display / health checks). */
export function degenfeedGatewayBase(): string {
  return DEGENFEED_IPFS_GATEWAY.replace('{cid}', '');
}

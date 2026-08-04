/**
 * @degenfeed/api-worker — Blossom Storage Integration (free tier)
 *
 * Uploads short video clips to a Blossom-compatible file server
 * (nostr.build's free tier: 20MB max, 3min max, global CDN, zero cost)
 * using NIP-98 HTTP auth (kind 27235) signed with the platform Nostr key.
 *
 * Blossom protocol (see https://github.com/hzrd149/blossom):
 *   PUT /upload/{sha256}  with `Authorization: Nostr <base64 event>`
 *   Request body  = raw file bytes
 *   Response body = { "url": "...", "sha256": "...", "size": N, "type": "mime" }
 *
 * Worker-compatible: uses Web Crypto (crypto.subtle), TextEncoder and
 * fetch only — no Node Buffer / process.env. Config comes from Env.
 *
 * First choice for clips <20MB (see storage-strategy.ts TIER 1 FREE).
 */

import { getPublicKey, signEvent } from '@degenfeed/nostr-sdk';
import { log } from '../logger';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

const DEFAULT_BLOSSOM_SERVER = 'https://blossom.nostr.build';

/** Maximum upload size: 20MB (nostr.build free tier) */
export const BLOSSOM_MAX_BYTES = 20 * 1024 * 1024;
/** Maximum clip duration: 3 minutes */
export const BLOSSOM_MAX_DURATION_SECONDS = 180;

// ─── Types ──────────────────────────────────────────────────────────────

export type VideoContainer = 'mp4' | 'webm' | 'mov';

export interface BlossomUploadResult {
  ok: boolean;
  /** Blossom CDN URL for playback (served via global CDN, zero cost) */
  url?: string;
  /** SHA-256 content hash (the Blossom blob id) */
  sha256?: string;
  /** Detected container */
  container?: VideoContainer;
  /** MIME type used for the upload */
  mimeType?: string;
  /** Server that accepted the upload */
  server?: string;
  error?: string;
}

// ─── Container Detection ────────────────────────────────────────────────

/**
 * Detect the video container from magic bytes.
 * Returns 'mp4' | 'webm' | 'mov' or null when unsupported.
 * Container check only — we never re-encode.
 */
export function detectVideoContainer(buffer: ArrayBuffer | Uint8Array): VideoContainer | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  // MP4 / MOV: 'ftyp' box at offset 4
  if (
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 //   p
  ) {
    const brand =
      String.fromCharCode(bytes[8] ?? 0) +
      String.fromCharCode(bytes[9] ?? 0) +
      String.fromCharCode(bytes[10] ?? 0) +
      String.fromCharCode(bytes[11] ?? 0);
    // QuickTime brand → mov, everything else with ftyp → mp4
    return brand === 'qt  ' ? 'mov' : 'mp4';
  }

  // WebM: EBML magic 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'webm';
  }

  return null;
}

/** Map a container to its standard MIME type. */
export function containerToMimeType(container: VideoContainer): string {
  switch (container) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
  }
}

// ─── SHA-256 / Base64 Helpers (Workers-compatible) ─────────────────────

/** Compute the SHA-256 hex digest of a buffer. */
export async function sha256Hex(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Base64-encode a UTF-8 string (replaces Node Buffer.toString('base64')). */
function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ─── NIP-98 HTTP Auth ───────────────────────────────────────────────────

/**
 * Create the NIP-98 HTTP auth header value for a Blossom request.
 *
 * Signs a kind 27235 event with the platform Nostr key and base64-encodes it.
 * Returns `Nostr <base64 event JSON>` ready to use as the Authorization header.
 */
export async function createNip98AuthHeader(
  url: string,
  method: string,
  secretKey: string,
  payload?: ArrayBuffer | Uint8Array,
): Promise<string> {
  const pubkey = getPublicKey(secretKey);

  const tags: string[][] = [
    ['u', url],
    ['method', method],
  ];
  if (payload) {
    tags.push(['payload', await sha256Hex(payload)]);
  }

  const signed = signEvent(
    {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 27235,
      tags,
      content: '',
    },
    secretKey,
  ) as unknown as Record<string, unknown>;

  const encoded = base64EncodeUtf8(JSON.stringify(signed));
  return `Nostr ${encoded}`;
}

// ─── Upload ─────────────────────────────────────────────────────────────

/**
 * Upload a video clip to the Blossom server (nostr.build free tier).
 *
 * First-choice storage for clips <20MB (and <3min when duration known).
 *
 * @param buffer - Raw video bytes (mp4 / webm / mov — never re-encoded)
 * @param fileName - Original file name (used as a hint only)
 * @param mimeType - Optional MIME override (auto-detected from container when omitted)
 * @param env - Worker env (BLOSSOM_SERVER_URL override, NOSTR_NSEC for NIP-98 auth)
 * @returns BlossomUploadResult with the CDN URL on success
 */
export async function uploadBufferToBlossom(
  buffer: ArrayBuffer | Uint8Array,
  _fileName: string,
  mimeType: string | undefined,
  env: Env,
  opts: { duration?: number } = {},
): Promise<BlossomUploadResult> {
  const server = (env.BLOSSOM_SERVER_URL || DEFAULT_BLOSSOM_SERVER).replace(/\/+$/, '');
  const secretKey = env.NOSTR_NSEC || env.NOSTR_PRIVATE_KEY || '';

  // ─── Validation ────────────────────────────────────────────────────
  const container = detectVideoContainer(buffer);
  if (!container) {
    return {
      ok: false,
      error:
        'Unsupported video container. Only mp4, webm, mov are accepted (container check, no re-encode).',
    };
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const size = bytes.byteLength;
  if (size > BLOSSOM_MAX_BYTES) {
    return {
      ok: false,
      error: `Video too large: ${(size / 1024 / 1024).toFixed(1)}MB. Blossom free tier max is 20MB.`,
    };
  }

  if (opts.duration !== undefined && opts.duration > BLOSSOM_MAX_DURATION_SECONDS) {
    return {
      ok: false,
      error: `Video too long: ${opts.duration}s. Blossom free tier max is 180s (3min).`,
    };
  }

  if (!secretKey) {
    return {
      ok: false,
      error:
        'No Nostr key configured for NIP-98 auth. Set NOSTR_NSEC (or NOSTR_PRIVATE_KEY) on the worker.',
    };
  }

  // ─── Upload ────────────────────────────────────────────────────────
  const resolvedMime = mimeType || containerToMimeType(container);
  const sha256 = await sha256Hex(bytes);
  const uploadUrl = `${server}/upload/${sha256}`;
  const authHeader = await createNip98AuthHeader(uploadUrl, 'PUT', secretKey, bytes);

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': resolvedMime,
        Accept: 'application/json',
      },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(120_000), // 2 min for uploads
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      log(
        'warn',
        `[blossom-storage] upload failed: HTTP ${response.status}`,
        errText.slice(0, 300),
      );
      return {
        ok: false,
        error: `Blossom upload failed: HTTP ${response.status} ${errText.slice(0, 300)}`,
      };
    }

    // Parse the Blossom response. The spec returns JSON with a `url` field;
    // some servers return the blob URL in the body or via the Location header.
    let url: string | undefined;

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await response.json().catch(() => null)) as {
        url?: string;
        sha256?: string;
        size?: number;
        type?: string;
      } | null;
      url = data?.url;
    }
    if (!url) {
      url = response.headers.get('Location') ?? undefined;
    }
    // Fallback: blob is served at /{sha256} on the same server
    if (!url) {
      url = `${server}/${sha256}`;
    }

    return {
      ok: true,
      url,
      sha256,
      container,
      mimeType: resolvedMime,
      server,
    };
  } catch (err) {
    log('error', '[blossom-storage] upload error', err);
    return {
      ok: false,
      error: `Blossom upload error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Quick eligibility check: can this clip use the Blossom free tier?
 */
export function isBlossomEligible(size: number, duration?: number): boolean {
  if (size <= 0 || size > BLOSSOM_MAX_BYTES) return false;
  if (duration !== undefined && duration > BLOSSOM_MAX_DURATION_SECONDS) return false;
  return true;
}

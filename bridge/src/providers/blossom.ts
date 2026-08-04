/**
 * @degenfeed/local-bridge — Blossom Provider (Decentralized Video Hosting)
 *
 * Uploads short video clips to a Blossom-compatible file server
 * (nostr.build's free tier: 20MB max, global CDN, zero cost) using
 * NIP-98 HTTP auth signed with the user's Nostr key. After a successful
 * upload, the caller can publish a NIP-71 video event (kind 34235) that
 * references the Blossom URL so the clip is discoverable across Nostr.
 *
 * Supported containers: mp4, webm, mov (magic-byte check — never re-encode).
 *
 * Blossom protocol (see https://github.com/hzrd149/blossom):
 *   PUT /upload/{sha256}  with `Authorization: Nostr <base64 event>`
 *   Request body  = raw file bytes
 *   Response body = { "url": "...", "sha256": "...", "size": N, "type": "mime" }
 *
 * NIP-98 HTTP auth event (kind 27235):
 *   {
 *     kind: 27235, created_at: <now>,
 *     tags: [["u", "<full URL>"], ["method", "PUT"], ["payload", "<sha256 of body>"]],
 *     content: ""
 *   }
 */

import type { NostrEvent } from '@degenfeed/nostr-sdk';

const _$fetch = globalThis.fetch;

// ─── Config ─────────────────────────────────────────────────────────────

const BLOSSOM_SERVER = process.env.BLOSSOM_SERVER_URL || 'https://blossom.nostr.build';
const NOSTR_NSEC = process.env.DEGENFEED_NOSTR_NSEC || process.env.NOSTR_PRIVATE_KEY_HEX || '';

/** Maximum upload size: 20MB (nostr.build free tier) */
export const BLOSSOM_MAX_BYTES = 20 * 1024 * 1024;
/** Maximum clip duration: 3 minutes */
export const BLOSSOM_MAX_DURATION_SECONDS = 180;

/** Default relays to publish NIP-71 video events to (our relay first). */
export const DEFAULT_VIDEO_RELAYS = [
  'ws://127.0.0.1:8085',
  'wss://relay.degenfeed.xyz',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://purplepag.es',
];

// ─── Types ──────────────────────────────────────────────────────────────

export type VideoContainer = 'mp4' | 'webm' | 'mov';

export interface BlossomUploadOptions {
  /** Override the Blossom server base URL (default: https://blossom.nostr.build) */
  serverUrl?: string;
  /** Nostr secret key (hex) for NIP-98 auth. Falls back to env config. */
  secretKey?: string;
  /** MIME type of the video (detected from container when omitted) */
  mimeType?: string;
  /** File size in bytes (used to enforce the 20MB free tier) */
  size?: number;
  /** Clip duration in seconds (used to enforce the 3min cap) */
  duration?: number;
}

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
  /** Size in bytes as reported by the server */
  size?: number;
  /** Server that accepted the upload */
  server?: string;
  error?: string;
}

export interface VideoEventPublishResult {
  ok: boolean;
  eventId?: string;
  /** Blossom URL the event points at */
  videoUrl?: string;
  /** Relays that accepted the event */
  successfulRelays: string[];
  /** Relays that rejected / timed out */
  failedRelays: string[];
  error?: string;
}

// ─── Container Detection ────────────────────────────────────────────────

/**
 * Detect the video container from magic bytes.
 * Returns 'mp4' | 'webm' | 'mov' or null when unsupported.
 * This is a container check only — we never re-encode.
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

// ─── SHA-256 Helpers ────────────────────────────────────────────────────

/** Compute the SHA-256 hex digest of a buffer. */
export async function sha256Hex(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── NIP-98 HTTP Auth ───────────────────────────────────────────────────

/**
 * Create the NIP-98 HTTP auth header value for a Blossom request.
 *
 * Signs a kind 27235 event with the user's Nostr key and base64-encodes it.
 * Returns `Nostr <base64 event JSON>` ready to use as the Authorization header.
 */
export async function createNip98AuthHeader(
  url: string,
  method: string,
  secretKey: string,
  payload?: ArrayBuffer | Uint8Array,
): Promise<string> {
  const { getPublicKey, signEvent } = await import('@degenfeed/nostr-sdk');
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

  const encoded = Buffer.from(JSON.stringify(signed), 'utf8').toString('base64');
  return `Nostr ${encoded}`;
}

// ─── Upload ─────────────────────────────────────────────────────────────

/**
 * Upload a video clip to the Blossom server (nostr.build free tier).
 *
 * @param buffer - Raw video bytes (mp4 / webm / mov — never re-encoded)
 * @param filename - Original file name (used as a hint only)
 * @param options - Overrides for server URL, secret key, mime type, size, duration
 * @returns BlossomUploadResult with the CDN URL on success
 */
export async function uploadVideoToBlossom(
  buffer: ArrayBuffer | Uint8Array,
  _filename: string,
  options: BlossomUploadOptions = {},
): Promise<BlossomUploadResult> {
  const server = (options.serverUrl || BLOSSOM_SERVER).replace(/\/+$/, '');
  const secretKey = options.secretKey || NOSTR_NSEC;

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
  const size = options.size ?? bytes.byteLength;
  if (size > BLOSSOM_MAX_BYTES) {
    return {
      ok: false,
      error: `Video too large: ${(size / 1024 / 1024).toFixed(1)}MB. Blossom free tier max is 20MB.`,
    };
  }

  if (options.duration !== undefined && options.duration > BLOSSOM_MAX_DURATION_SECONDS) {
    return {
      ok: false,
      error: `Video too long: ${options.duration}s. Blossom free tier max is 180s (3min).`,
    };
  }

  if (!secretKey) {
    return {
      ok: false,
      error:
        'No Nostr key configured for NIP-98 auth. Set DEGENFEED_NOSTR_NSEC (or NOSTR_PRIVATE_KEY_HEX).',
    };
  }

  // ─── Upload ────────────────────────────────────────────────────────
  const mimeType = options.mimeType || containerToMimeType(container);
  const sha256 = await sha256Hex(bytes);
  const uploadUrl = `${server}/upload/${sha256}`;
  const authHeader = await createNip98AuthHeader(uploadUrl, 'PUT', secretKey, bytes);

  try {
    const response = await _$fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': mimeType,
        Accept: 'application/json',
      },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(120_000), // 2 min for uploads
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        ok: false,
        error: `Blossom upload failed: HTTP ${response.status} ${errText.slice(0, 300)}`,
      };
    }

    // Parse the Blossom response. The spec returns JSON with a `url` field;
    // some servers return the blob URL in the body or via the Location header.
    let url: string | undefined;
    let serverSize: number | undefined;
    let serverType: string | undefined;

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await response.json().catch(() => null)) as {
        url?: string;
        sha256?: string;
        size?: number;
        type?: string;
      } | null;
      url = data?.url;
      serverSize = data?.size;
      serverType = data?.type;
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
      mimeType: serverType || mimeType,
      size: serverSize ?? size,
      server,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Blossom upload error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── NIP-71 Video Event Publishing ──────────────────────────────────────

/**
 * Publish a NIP-71 video event (kind 34235) after a successful Blossom upload.
 *
 * @param params - Video metadata (title, description, thumbnail, Blossom URL, duration, dimensions)
 * @param secretKey - Nostr secret key for signing (falls back to env)
 * @param relays - Relays to publish to (defaults to our relay + popular relays)
 */
export async function publishVideoEventToNostr(
  params: {
    /** Unique event id (d tag). Auto-generated when omitted. */
    id?: string;
    title: string;
    description?: string;
    /** Blossom URL returned from uploadVideoToBlossom */
    videoUrl: string;
    thumbnailUrl?: string;
    mimeType?: string;
    duration?: number;
    /** Video dimensions as WxH (e.g. "1080x1920") */
    dimensions?: string;
    /** SHA-256 content hash of the video file */
    contentHash?: string;
    /** Hashtags (without the leading #) */
    tags?: string[];
    /** Whether this is a short-form clip (<120s) — publishes kind 34236 */
    isShort?: boolean;
    contentWarning?: string;
  },
  options: {
    secretKey?: string;
    relays?: string[];
    timeoutMs?: number;
  } = {},
): Promise<VideoEventPublishResult> {
  const secretKey = options.secretKey || NOSTR_NSEC;
  if (!secretKey) {
    return {
      ok: false,
      successfulRelays: [],
      failedRelays: [],
      error:
        'No Nostr key configured for signing. Set DEGENFEED_NOSTR_NSEC (or NOSTR_PRIVATE_KEY_HEX).',
    };
  }

  try {
    const { createVideoEvent, publishVideoEvent } = await import('@degenfeed/nostr-sdk');
    const id = params.id || `df-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const event = createVideoEvent(
      {
        id,
        title: params.title,
        url: params.videoUrl,
        mimeType: params.mimeType,
        thumbnailUrl: params.thumbnailUrl,
        duration: params.duration,
        summary: params.description,
        isShort: params.isShort,
        tags: params.tags,
        contentWarning: params.contentWarning,
        dimensions: params.dimensions,
        contentHash: params.contentHash,
      },
      secretKey,
    ) as unknown as NostrEvent;

    const relays = options.relays ?? DEFAULT_VIDEO_RELAYS;
    const result = await publishVideoEvent(
      event as unknown as Parameters<typeof publishVideoEvent>[0],
      relays,
      options.timeoutMs,
    );

    return {
      ok: result.successful.length > 0,
      eventId: result.eventId,
      videoUrl: params.videoUrl,
      successfulRelays: result.successful,
      failedRelays: result.failed,
      error:
        result.successful.length > 0
          ? undefined
          : `Video event rejected on all ${result.results.length} relays`,
    };
  } catch (err) {
    return {
      ok: false,
      successfulRelays: [],
      failedRelays: [],
      error: `Video event publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Full pipeline: upload a clip to Blossom, then publish a NIP-71 video event.
 * Convenience wrapper for the common "upload then publish" flow.
 */
export async function uploadAndPublishClip(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
  metadata: {
    title: string;
    description?: string;
    thumbnailUrl?: string;
    duration?: number;
    dimensions?: string;
    tags?: string[];
    isShort?: boolean;
  },
  options: BlossomUploadOptions & {
    relays?: string[];
    timeoutMs?: number;
  } = {},
): Promise<{ upload: BlossomUploadResult; publish?: VideoEventPublishResult }> {
  const upload = await uploadVideoToBlossom(buffer, filename, options);
  if (!upload.ok || !upload.url) {
    return { upload };
  }

  const publish = await publishVideoEventToNostr(
    {
      title: metadata.title,
      description: metadata.description,
      videoUrl: upload.url,
      thumbnailUrl: metadata.thumbnailUrl,
      mimeType: upload.mimeType,
      duration: metadata.duration,
      dimensions: metadata.dimensions,
      contentHash: upload.sha256,
      tags: metadata.tags,
      isShort: metadata.isShort,
    },
    { secretKey: options.secretKey, relays: options.relays, timeoutMs: options.timeoutMs },
  );

  return { upload, publish };
}

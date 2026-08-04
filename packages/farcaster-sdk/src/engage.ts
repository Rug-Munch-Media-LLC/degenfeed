import { ed25519 } from '@noble/curves/ed25519';
import { blake3 } from '@noble/hashes/blake3';

const FARCASTER_NETWORK_MAINNET = 1;
/** Farcaster epoch = Jan 1, 2021 00:00:00 UTC. Message timestamps are
 *  seconds since this epoch, NOT unix seconds. */
export const FARCASTER_EPOCH_SECONDS = 1609459200;

const MESSAGE_TYPE_CAST_ADD = 1;
const MESSAGE_TYPE_REACTION_ADD = 6;
const MESSAGE_TYPE_REACTION_REMOVE = 7;

const REACTION_TYPE_LIKE = 1;

const HASH_SCHEME_BLAKE3 = 1;
const SIGNATURE_SCHEME_ED25519 = 1;

function encodeVarint(value: number): Uint8Array {
  const out: number[] = [];
  let v = value >>> 0;
  while (v > 127) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return new Uint8Array(out);
}

function encodeField(wireType: number, fieldNumber: number, payload: Uint8Array): Uint8Array {
  const key = encodeVarint((fieldNumber << 3) | wireType);
  const out = new Uint8Array(key.length + payload.length);
  out.set(key);
  out.set(payload, key.length);
  return out;
}

function encodeLengthDelimited(fieldNumber: number, payload: Uint8Array): Uint8Array {
  const len = encodeVarint(payload.length);
  const field = encodeField(2, fieldNumber, new Uint8Array([...len, ...payload]));
  return field;
}

function encodeVarintField(fieldNumber: number, value: number): Uint8Array {
  return encodeField(0, fieldNumber, encodeVarint(value));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function encodeCastId(fid: number, hashHex: string): Uint8Array {
  const hashBytes = hexToBytes(hashHex);
  if (hashBytes.length !== 20) {
    throw new Error(`Cast hash must be 20 bytes (40 hex chars), got ${hashBytes.length} bytes`);
  }
  const inner = concatBytes(encodeVarintField(1, fid), encodeLengthDelimited(2, hashBytes));
  return inner;
}

function encodeEmbedCastId(fid: number, hashHex: string): Uint8Array {
  const castId = encodeCastId(fid, hashHex);
  return encodeLengthDelimited(2, castId);
}

/**
 * Encode a URL embed for CastAddBody (current protocol: `repeated Embed
 * embeds = 6`, where `Embed { string url = 1 }`). Without this, casts that
 * pass `embeds` to buildFarcasterCastMessage silently lose their embeds —
 * which breaks Frames (the frame URL is only delivered as an embed).
 */
function encodeEmbedUrl(url: string): Uint8Array {
  const embedInner = encodeLengthDelimited(1, new TextEncoder().encode(url)); // Embed.url = 1
  return encodeLengthDelimited(6, embedInner); // CastAddBody.embeds = 6
}

function encodeReactionBody(
  reactionType: number,
  targetFid: number,
  targetHashHex: string,
): Uint8Array {
  const inner = concatBytes(
    encodeVarintField(1, reactionType),
    encodeLengthDelimited(2, encodeCastId(targetFid, targetHashHex)),
  );
  return inner;
}

/**
 * CastAddBody wire layout (current protocol):
 *   1 = embeds_deprecated (skip)
 *   2 = mentions (skip)
 *   3 = parent_cast_id (CastId)
 *   4 = text
 *   5 = mentions_positions (skip)
 *   6 = embeds (repeated Embed)
 *   7 = parent_url
 */
function encodeCastAddBody(opts: {
  text?: string;
  parentFid?: number;
  parentHashHex?: string;
  embedCastFid?: number;
  embedCastHashHex?: string;
  /** URL embeds (field 6: repeated Embed). Encoded via encodeEmbedUrl so
   *  frames and video links survive cast submission. */
  embeds?: { url: string }[];
}): Uint8Array {
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  if (opts.text) {
    parts.push(encodeLengthDelimited(4, encoder.encode(opts.text)));
  }
  if (opts.embedCastFid !== undefined && opts.embedCastHashHex) {
    parts.push(
      encodeLengthDelimited(6, encodeEmbedCastId(opts.embedCastFid, opts.embedCastHashHex)),
    );
  }
  if (opts.parentFid !== undefined && opts.parentHashHex) {
    parts.push(encodeLengthDelimited(3, encodeCastId(opts.parentFid, opts.parentHashHex)));
  }
  if (opts.embeds) {
    for (const embed of opts.embeds) {
      if (embed.url) parts.push(encodeEmbedUrl(embed.url));
    }
  }

  return concatBytes(...parts);
}

function encodeMessageData(opts: {
  type: number;
  fid: number;
  body: Uint8Array;
  bodyField: number;
  timestamp?: number;
}): Uint8Array {
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000) - FARCASTER_EPOCH_SECONDS;
  const parts = [
    encodeVarintField(1, opts.type),
    encodeVarintField(2, opts.fid),
    encodeVarintField(3, ts),
    encodeVarintField(4, FARCASTER_NETWORK_MAINNET),
    encodeLengthDelimited(opts.bodyField, opts.body),
  ];
  return concatBytes(...parts);
}

export interface FarcasterEngageResult {
  ok: boolean;
  error?: string;
}

export interface BuildCastMessageOpts {
  signerKeyHex: string;
  fid: number;
  text: string;
  /** Optional parent cast (only when replying to a real Farcaster cast) */
  parentFid?: number;
  parentHashHex?: string;
  /** Optional embedded URLs to attach to the cast */
  embeds?: { url: string }[];
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * Build and sign a CastAdd Message protobuf WITHOUT submitting it.
 * Returns the signed message as a hex string, suitable for passing to
 * server endpoints (e.g. /api/cross-reply) that submit to a Hub.
 */
export function buildFarcasterCastMessage(opts: BuildCastMessageOpts): {
  ok: boolean;
  messageHex?: string;
  error?: string;
} {
  try {
    const signerBytes = hexToBytes(opts.signerKeyHex);
    if (signerBytes.length !== 32) {
      return { ok: false, error: 'Invalid signer key (must be 32 bytes / 64 hex chars)' };
    }
    const pubKey = ed25519.getPublicKey(signerBytes);

    const body = encodeCastAddBody({
      text: opts.text,
      parentFid: opts.parentFid,
      parentHashHex: opts.parentHashHex,
      embeds: opts.embeds,
    });
    const messageData = encodeMessageData({
      type: MESSAGE_TYPE_CAST_ADD,
      fid: opts.fid,
      body,
      bodyField: 5,
    });
    const hash = blake3(messageData, { dkLen: 20 });
    const signature = ed25519.sign(hash, signerBytes);
    // Top-level Message wire layout (current protocol):
    //   1 = data, 2 = hash, 3 = hash_scheme, 4 = signature,
    //   5 = signature_scheme (ed25519), 6 = signer (pubkey)
    const message = concatBytes(
      encodeLengthDelimited(1, messageData),
      encodeLengthDelimited(2, hash),
      encodeVarintField(3, HASH_SCHEME_BLAKE3),
      encodeLengthDelimited(4, signature),
      encodeVarintField(5, SIGNATURE_SCHEME_ED25519),
      encodeLengthDelimited(6, pubKey),
    );
    return { ok: true, messageHex: bytesToHex(message) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cast build failed' };
  }
}

export interface FarcasterEngageOpts {
  action: 'like' | 'unlike' | 'repost' | 'reply';
  signerKeyHex: string;
  fid: number;
  targetFid: number;
  castHashHex: string;
  content?: string;
}

export async function engageFarcaster(opts: FarcasterEngageOpts): Promise<FarcasterEngageResult> {
  try {
    const signerBytes = hexToBytes(opts.signerKeyHex);
    if (signerBytes.length !== 32) {
      return { ok: false, error: 'Invalid signer key (must be 32 bytes / 64 hex chars)' };
    }

    const pubKey = ed25519.getPublicKey(signerBytes);

    let messageType: number;
    let bodyField: number;
    let body: Uint8Array;

    if (opts.action === 'like') {
      messageType = MESSAGE_TYPE_REACTION_ADD;
      bodyField = 7;
      body = encodeReactionBody(REACTION_TYPE_LIKE, opts.targetFid, opts.castHashHex);
    } else if (opts.action === 'unlike') {
      messageType = MESSAGE_TYPE_REACTION_REMOVE;
      bodyField = 7;
      body = encodeReactionBody(REACTION_TYPE_LIKE, opts.targetFid, opts.castHashHex);
    } else if (opts.action === 'repost') {
      messageType = MESSAGE_TYPE_CAST_ADD;
      bodyField = 5;
      body = encodeCastAddBody({
        embedCastFid: opts.targetFid,
        embedCastHashHex: opts.castHashHex,
      });
    } else if (opts.action === 'reply') {
      messageType = MESSAGE_TYPE_CAST_ADD;
      bodyField = 5;
      body = encodeCastAddBody({
        text: opts.content ?? '',
        parentFid: opts.targetFid,
        parentHashHex: opts.castHashHex,
      });
    } else {
      return { ok: false, error: `Unknown action: ${opts.action}` };
    }

    const messageData = encodeMessageData({
      type: messageType,
      fid: opts.fid,
      body,
      bodyField,
    });

    const hash = blake3(messageData, { dkLen: 20 });

    const signature = ed25519.sign(hash, signerBytes);

    // Top-level Message wire layout (current protocol):
    //   1 = data, 2 = hash, 3 = hash_scheme, 4 = signature,
    //   5 = signature_scheme (ed25519), 6 = signer (pubkey)
    const message = concatBytes(
      encodeLengthDelimited(1, messageData),
      encodeLengthDelimited(2, hash),
      encodeVarintField(3, HASH_SCHEME_BLAKE3),
      encodeLengthDelimited(4, signature),
      encodeVarintField(5, SIGNATURE_SCHEME_ED25519),
      encodeLengthDelimited(6, pubKey),
    );

    await submitToHub(message);

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Farcaster engagement failed';
    return { ok: false, error: message };
  }
}

async function submitToHub(signedMessage: Uint8Array): Promise<void> {
  const hubUrl = 'https://hub.farcaster.standardcrypto.vc:2281';
  const res = await fetch(`${hubUrl}/v1/submitMessage`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/octet-stream',
      'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
    },
    body: signedMessage.buffer as ArrayBuffer,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Farcaster Hub rejected: ${res.status} ${errText.slice(0, 200)}`);
  }
}

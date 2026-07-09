import { blake3 } from "@noble/hashes/blake3";
import { ed25519 } from "@noble/curves/ed25519";

const FARCASTER_NETWORK_MAINNET = 1;

const MESSAGE_TYPE_CAST_ADD = 1;
const MESSAGE_TYPE_REACTION_ADD = 6;
const MESSAGE_TYPE_REACTION_REMOVE = 7;

const REACTION_TYPE_LIKE = 1;
const REACTION_TYPE_RECAST = 2;

const HASH_SCHEME_BLAKE3 = 1;

function varintLen(value: number): number {
  if (value < 128) return 1;
  if (value < 16384) return 2;
  if (value < 2097152) return 3;
  if (value < 268435456) return 4;
  if (value < 34359738368) return 5;
  return 6;
}

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

function encodeReactionBody(
  reactionType: number,
  targetFid: number,
  targetHashHex: string
): Uint8Array {
  const inner = concatBytes(
    encodeVarintField(1, reactionType),
    encodeLengthDelimited(2, encodeCastId(targetFid, targetHashHex))
  );
  return inner;
}

function encodeCastAddBody(opts: {
  text?: string;
  parentFid?: number;
  parentHashHex?: string;
  embedCastFid?: number;
  embedCastHashHex?: string;
}): Uint8Array {
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  if (opts.text) {
    parts.push(encodeLengthDelimited(1, encoder.encode(opts.text)));
  }
  if (opts.embedCastFid !== undefined && opts.embedCastHashHex) {
    parts.push(encodeLengthDelimited(2, encodeEmbedCastId(opts.embedCastFid, opts.embedCastHashHex)));
  }
  if (opts.parentFid !== undefined && opts.parentHashHex) {
    parts.push(encodeLengthDelimited(5, encodeCastId(opts.parentFid, opts.parentHashHex)));
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
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000);
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

export interface FarcasterEngageOpts {
  action: "like" | "unlike" | "repost" | "reply";
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
      return { ok: false, error: "Invalid signer key (must be 32 bytes / 64 hex chars)" };
    }

    const pubKey = ed25519.getPublicKey(signerBytes);

    let messageType: number;
    let bodyField: number;
    let body: Uint8Array;

    if (opts.action === "like") {
      messageType = MESSAGE_TYPE_REACTION_ADD;
      bodyField = 7;
      body = encodeReactionBody(REACTION_TYPE_LIKE, opts.targetFid, opts.castHashHex);
    } else if (opts.action === "unlike") {
      messageType = MESSAGE_TYPE_REACTION_REMOVE;
      bodyField = 7;
      body = encodeReactionBody(REACTION_TYPE_LIKE, opts.targetFid, opts.castHashHex);
    } else if (opts.action === "repost") {
      messageType = MESSAGE_TYPE_CAST_ADD;
      bodyField = 5;
      body = encodeCastAddBody({
        embedCastFid: opts.targetFid,
        embedCastHashHex: opts.castHashHex,
      });
    } else if (opts.action === "reply") {
      messageType = MESSAGE_TYPE_CAST_ADD;
      bodyField = 5;
      body = encodeCastAddBody({
        text: opts.content ?? "",
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

    const message = concatBytes(
      encodeLengthDelimited(1, messageData),
      encodeLengthDelimited(2, hash),
      encodeVarintField(3, HASH_SCHEME_BLAKE3),
      encodeLengthDelimited(4, signature),
      encodeLengthDelimited(5, pubKey),
    );

    await submitToHub(message);

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Farcaster engagement failed";
    return { ok: false, error: message };
  }
}

async function submitToHub(signedMessage: Uint8Array): Promise<void> {
  const hubUrl = "https://hub.farcaster.standardcrypto.vc:2281";
  const res = await fetch(`${hubUrl}/v1/submitMessage`, {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream",
      "user-agent": "DegenFeed/0.1 (+https://degenfeed.xyz)",
    },
    body: signedMessage.buffer as ArrayBuffer,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Farcaster Hub rejected: ${res.status} ${errText.slice(0, 200)}`);
  }
}

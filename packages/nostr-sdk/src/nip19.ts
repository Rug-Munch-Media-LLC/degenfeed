/**
 * NIP-19: bech32-encoded entities (nsec, npub, note, nevent, nprofile).
 *
 * Uses @noble/curves for secp256k1 key operations and @noble/hashes for bech32.
 */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { bech32 } from '@scure/base';

const BECH32_LIMIT = 5000;

export type Nip19Type = 'npub' | 'nsec' | 'note' | 'nevent' | 'nprofile';

interface DecodedResult {
  type: Nip19Type;
  data: Uint8Array;
  /** For nevent/nprofile: the relay hint and author (if present) */
  relays?: string[];
  author?: Uint8Array;
}

/**
 * Decode a bech32-encoded Nostr string.
 */
export function decodeNip19(bech32str: string): DecodedResult {
  const decoded = bech32.decode(bech32str as unknown as `${string}1${string}`, BECH32_LIMIT);
  const type = decoded.prefix as Nip19Type;
  const data = bech32.fromWords(decoded.words);

  // For nevent/nprofile, there are TLV fields after the main data.
  if (type === 'nevent' || type === 'nprofile') {
    return decodeTlv(type, data);
  }

  return { type, data };
}

function decodeTlv(type: 'nevent' | 'nprofile', bytes: Uint8Array): DecodedResult {
  let offset = 0;
  let mainData: Uint8Array | null = null;
  let author: Uint8Array | null = null;
  const relays: string[] = [];

  while (offset + 1 < bytes.length) {
    const t = bytes[offset];
    const len = bytes[offset + 1]!;
    const value = bytes.slice(offset + 2, offset + 2 + len);
    offset += 2 + len;

    if (t === 0) {
      mainData = value; // event id or pubkey
    } else if (t === 1) {
      relays.push(new TextDecoder().decode(value)); // relay
    } else if (t === 2) {
      author = value; // author pubkey (for nevent)
    }
  }

  return {
    type,
    data: mainData ?? new Uint8Array(),
    relays: relays.length > 0 ? relays : undefined,
    author: author ?? undefined,
  };
}

/** Encode raw bytes as a bech32 string with the given prefix. */
export function encodeNip19(prefix: Nip19Type, data: Uint8Array): string {
  const words = bech32.toWords(data);
  return bech32.encode(prefix, words, BECH32_LIMIT);
}

// ─── Convenience helpers ────────────────────────────────────────────────

export function npubEncode(hexPubkey: string): string {
  return encodeNip19('npub', hexToBytes(hexPubkey));
}

export function npubDecode(npub: string): string {
  const { data } = decodeNip19(npub);
  return bytesToHex(data);
}

export function nsecEncode(hexSecret: string): string {
  return encodeNip19('nsec', hexToBytes(hexSecret));
}

export interface NsecDecodeResult {
  hex: string;
}

export function nsecDecode(nsec: string): NsecDecodeResult {
  const { data } = decodeNip19(nsec);
  return { hex: bytesToHex(data) };
}

export function noteEncode(hexEventId: string): string {
  return encodeNip19('note', hexToBytes(hexEventId));
}

export function noteDecode(note: string): string {
  const { data } = decodeNip19(note);
  return bytesToHex(data);
}

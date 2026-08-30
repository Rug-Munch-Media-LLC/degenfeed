import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('@degenfeed/farcaster-sdk', () => {
  it('should construct HubClient from an explicit URL', async () => {
    const { HubClient } = await import('./index');
    const client = new HubClient('https://hub.example.com');
    expect(client).toBeInstanceOf(HubClient);
  });

  it('should resolve DEFAULT_HUB_URL from FARCASTER_HUB_URL (no localhost default)', async () => {
    vi.stubEnv('FARCASTER_HUB_URL', 'https://hub-from-env.example.com:2281');
    vi.resetModules();
    const { DEFAULT_HUB_URL } = await import('./index');
    expect(DEFAULT_HUB_URL).toBe('https://hub-from-env.example.com:2281');
  });

  it('should throw when no hub URL is configured (no silent localhost fallback)', async () => {
    vi.stubEnv('FARCASTER_HUB_URL', '');
    vi.stubEnv('NEXT_PUBLIC_FARCASTER_HUB_URL', '');
    vi.resetModules();
    const { HubClient } = await import('./index');
    expect(() => new HubClient()).toThrow(/not configured/);
  });

  it('should export curated FIDs', async () => {
    const { CURATED_FARCASTER_FIDS } = await import('./index');
    expect(CURATED_FARCASTER_FIDS.length).toBeGreaterThan(10);
    expect(CURATED_FARCASTER_FIDS).toContain(1);
    expect(CURATED_FARCASTER_FIDS).toContain(5650);
  });

  it('should convert profile to UnifiedIdentity', async () => {
    const { HubClient } = await import('./index');
    const client = new HubClient();
    const identity = client.profileToIdentity({
      fid: 1,
      username: 'dwr',
      displayName: 'Dan Romero',
      bio: 'Building Farcaster',
      avatarUrl: 'https://example.com/avatar.png',
      pfp: 'https://example.com/avatar.png',
      followerCount: 1000,
      followingCount: 500,
    });
    expect(identity.displayName).toBe('Dan Romero');
    expect(identity.handles.farcaster).toBe('dwr');
    expect(identity.keys.fid).toBe(1);
  });

  it('should encode URL embeds into the cast body (video embed support)', async () => {
    const { buildFarcasterCastMessage } = await import('./engage');

    // 32-byte signer key (all zeros is fine for structural encoding tests)
    const signerKeyHex = '11'.repeat(32);
    const result = buildFarcasterCastMessage({
      signerKeyHex,
      fid: 1,
      text: '🎬 New video',
      embeds: [{ url: 'https://bridge.degenfeed.xyz/media/abc.mp4' }],
    });

    expect(result.ok).toBe(true);
    const hex = result.messageHex as string;
    // CastAddBody embeds is field 6 — the protobuf tag byte for field 6
    // length-delimited is 0x32. The body is wrapped in field 5 of the
    // MessageData; verify the embed tag exists somewhere in the wire.
    expect(hex).toContain('32');
    // The video URL must appear in the encoded bytes (base64-free hex).
    // NOTE: Buffer is unavailable in the browser/worker runtime — use
    // TextEncoder + manual hex encoding instead.
    const urlHex = Array.from(
      new TextEncoder().encode('https://bridge.degenfeed.xyz/media/abc.mp4'),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    expect(hex).toContain(urlHex);
  });

  it('should encode text at CastAddBody field 4 and signer at Message field 6', async () => {
    const { buildFarcasterCastMessage } = await import('./engage');

    const signerKeyHex = '22'.repeat(32);
    const result = buildFarcasterCastMessage({
      signerKeyHex,
      fid: 2,
      text: 'hello world',
    });
    expect(result.ok).toBe(true);
    const bytes = new Uint8Array(
      ((result.messageHex as string).match(/.{1,2}/g) ?? []).map((b) => Number.parseInt(b, 16)),
    );

    // Parse the TOP-LEVEL Message fields only (skip nested payloads).
    const top = parseTopLevel(bytes);
    expect(top.get(1)).toBeDefined(); // data
    expect(top.get(3)).toBe(0x01); // hash_scheme = BLAKE3
    expect(top.get(5)).toBe(0x01); // signature_scheme = ED25519
    const signer = top.get(6) as Uint8Array;
    expect(signer.length).toBe(32); // signer pubkey

    // ── CastAddBody inside data ────────────────────────────────────────
    const data = top.get(1) as Uint8Array;
    const dataFields = parseTopLevel(data);
    const body = dataFields.get(5) as Uint8Array; // cast_add_body
    expect(body).toBeDefined();
    const bodyFields = parseTopLevel(body);
    // text = field 4, "hello world"
    const textBytes = bodyFields.get(4) as Uint8Array;
    expect(new TextDecoder().decode(textBytes)).toBe('hello world');
  });

  it('should encode timestamps in Farcaster epoch (unix minus 2021-01-01)', async () => {
    const { buildFarcasterCastMessage } = await import('./engage');
    const { FARCASTER_EPOCH_SECONDS } = await import('./engage');

    const signerKeyHex = '33'.repeat(32);
    const result = buildFarcasterCastMessage({
      signerKeyHex,
      fid: 3,
      text: 'epoch check',
    });
    expect(result.ok).toBe(true);
    const bytes = new Uint8Array(
      ((result.messageHex as string).match(/.{1,2}/g) ?? []).map((b) => Number.parseInt(b, 16)),
    );
    // MessageData.field 3 is the timestamp varint.
    const top = parseTopLevel(bytes);
    const data = top.get(1) as Uint8Array;
    const dataFields = parseTopLevel(data);
    const ts = dataFields.get(3) as number;
    expect(typeof ts).toBe('number');
    const unixNow = Math.floor(Date.now() / 1000);
    const expected = unixNow - FARCASTER_EPOCH_SECONDS;
    // Allow clock skew of a few seconds
    expect(Math.abs(ts - expected)).toBeLessThan(10);
  });
});

/**
 * Minimal protobuf wire decoder: parses length-delimited fields (returns
 * Uint8Array) and varint fields (returns number) at ONE message level,
 * skipping nested payloads. Field numbers > 15 unsupported (unused here).
 */
function parseTopLevel(bytes: Uint8Array): Map<number, number | Uint8Array> {
  const fields = new Map<number, number | Uint8Array>();
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i];
    if (tag === undefined) break;
    i++;
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;
    if (fieldNumber === 0) break;
    if (wireType === 0) {
      // varint
      let value = 0;
      let shift = 0;
      for (; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === undefined) break;
        value += (b & 0x7f) * 2 ** shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      i++;
      fields.set(fieldNumber, value);
    } else if (wireType === 2) {
      // length-delimited
      let len = 0;
      let shift = 0;
      for (; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === undefined) break;
        len += (b & 0x7f) * 2 ** shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      i++;
      const payload = bytes.slice(i, i + len);
      fields.set(fieldNumber, payload);
      i += len;
    } else {
      // skip unsupported wire types (not used in this message)
      break;
    }
  }
  return fields;
}

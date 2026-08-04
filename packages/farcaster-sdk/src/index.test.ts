import { describe, expect, it } from 'vitest';

describe('@degenfeed/farcaster-sdk', () => {
  it('should export HubClient class', async () => {
    const { HubClient } = await import('./index');
    const client = new HubClient();
    expect(client).toBeInstanceOf(HubClient);
  });

  it('should export DEFAULT_HUB_URL constant', async () => {
    const { DEFAULT_HUB_URL } = await import('./index');
    expect(DEFAULT_HUB_URL).toContain('farcaster');
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
    // CastAddBody embeds field is encoded as field 7 — the protobuf tag byte
    // for field 7 length-delimited is 0x3a. The body is wrapped in field 5
    // of the MessageData; verify the embed tag exists somewhere in the wire.
    expect(hex).toContain('3a');
    // The video URL must appear in the encoded bytes (base64-free hex).
    const urlHex = Buffer.from('https://bridge.degenfeed.xyz/media/abc.mp4', 'utf8').toString(
      'hex',
    );
    expect(hex).toContain(urlHex);
  });
});

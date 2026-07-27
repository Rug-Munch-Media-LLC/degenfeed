/**
 * @degenfeed/identity — Cross-protocol identity resolver tests
 *
 * Tests: resolveFediverseHandle, resolveHandle, buildUnifiedProfile,
 * formatCrossProtocolFollowers, and mergeIdentities edge cases.
 *
 * External fetches are mocked via the optional fetchFn parameter.
 * The @degenfeed/nostr-sdk module is mocked via vi.mock for NIP-05/npub paths.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CrossProtocolIdentity } from '@degenfeed/utils';

// Mock nostr-sdk for NIP-05 and npub resolution
vi.mock('@degenfeed/nostr-sdk', () => ({
  resolveNip05: vi.fn(),
  npubDecode: vi.fn(),
}));

// ─── resolveFediverseHandle ──────────────────────────────────────────────

describe('resolveFediverseHandle', () => {
  it('should resolve a valid Mastodon handle via WebFinger', async () => {
    const { resolveFediverseHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          subject: 'acct:user@mastodon.social',
          links: [
            {
              rel: 'self',
              type: 'application/activity+json',
              href: 'https://mastodon.social/users/user',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await resolveFediverseHandle('user@mastodon.social', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('mastodon');
    expect(result!.id).toBe('https://mastodon.social/users/user');
    expect(result!.handle).toBe('user@mastodon.social');

    // Verify correct WebFinger URL was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('.well-known/webfinger');
    expect(callUrl).toContain('resource=acct:user%40mastodon.social');
  });

  it('should detect Threads.net handles', async () => {
    const { resolveFediverseHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          subject: 'acct:user@threads.net',
          links: [
            {
              rel: 'self',
              type: 'application/activity+json',
              href: 'https://threads.net/@user',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await resolveFediverseHandle('user@threads.net', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('threads');
    expect(result!.id).toBe('https://threads.net/@user');
  });

  it('should return null if WebFinger returns 404', async () => {
    const { resolveFediverseHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const result = await resolveFediverseHandle('missing@example.com', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null if WebFinger has no self link', async () => {
    const { resolveFediverseHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          subject: 'acct:user@example.com',
          links: [{ rel: 'http://webfinger.net/rel/profile-page', href: 'https://example.com/@user' }],
        }),
        { status: 200 },
      ),
    );

    const result = await resolveFediverseHandle('user@example.com', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null on network error', async () => {
    const { resolveFediverseHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('Network failure'));

    const result = await resolveFediverseHandle('user@example.com', mockFetch);
    expect(result).toBeNull();
  });

  it('should return null for invalid handle format', async () => {
    const { resolveFediverseHandle } = await import('../index');

    // No @ sign case already handled by resolveHandle caller
    // Check edge case: empty username or domain
    const mockFetch = vi.fn();

    // handle with @ at start
    const result1 = await resolveFediverseHandle('@domain.com', mockFetch);
    expect(result1).toBeNull();

    // handle with @ at end
    const result2 = await resolveFediverseHandle('user@', mockFetch);
    expect(result2).toBeNull();
  });
});

// ─── resolveHandle — NIP-05 ──────────────────────────────────────────────

describe('resolveHandle — NIP-05', () => {
  beforeEach(async () => {
    const nostrSdk = await import('@degenfeed/nostr-sdk');
    vi.mocked(nostrSdk.resolveNip05).mockReset();
    vi.mocked(nostrSdk.npubDecode).mockReset();
  });

  it('should resolve a NIP-05 handle to a Nostr pubkey', async () => {
    const nostrSdk = await import('@degenfeed/nostr-sdk');
    const mockResolveNip05 = vi.mocked(nostrSdk.resolveNip05);
    mockResolveNip05.mockResolvedValue({
      pubkey: '7e2e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
      relays: ['wss://relay.damus.io'],
    });

    const { resolveHandle } = await import('../index');
    // fetchFn won't be used because resolveNip05 is mocked
    const mockFetch = vi.fn();

    const result = await resolveHandle('user@example.com', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('nostr');
    expect(result!.id).toBe('7e2e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9');
    expect(result!.handle).toBe('user@example.com');

    expect(mockResolveNip05).toHaveBeenCalledWith('user@example.com', mockFetch);
  });

  it('should return null when NIP-05 resolution fails', async () => {
    const nostrSdk = await import('@degenfeed/nostr-sdk');
    const mockResolveNip05 = vi.mocked(nostrSdk.resolveNip05);
    mockResolveNip05.mockResolvedValue(null);

    const { resolveHandle } = await import('../index');
    const result = await resolveHandle('missing@example.com', vi.fn());

    expect(result).toBeNull();
  });
});

// ─── resolveHandle — Nostr npub ──────────────────────────────────────────

describe('resolveHandle — npub', () => {
  it('should decode an npub to a hex pubkey', async () => {
    const nostrSdk = await import('@degenfeed/nostr-sdk');
    const mockNpubDecode = vi.mocked(nostrSdk.npubDecode);
    mockNpubDecode.mockReturnValue('7e2e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9');

    const { resolveHandle } = await import('../index');
    const result = await resolveHandle('npub1abc123def456');

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('nostr');
    expect(result!.id).toBe('7e2e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9');
    expect(result!.handle).toBe('npub1abc123def456');

    expect(mockNpubDecode).toHaveBeenCalledWith('npub1abc123def456');
  });

  it('should return null on npub decode error', async () => {
    const nostrSdk = await import('@degenfeed/nostr-sdk');
    const mockNpubDecode = vi.mocked(nostrSdk.npubDecode);
    mockNpubDecode.mockImplementation(() => {
      throw new Error('Invalid bech32');
    });

    const { resolveHandle } = await import('../index');
    const result = await resolveHandle('npub1invalid');

    expect(result).toBeNull();
  });
});

// ─── resolveHandle — Farcaster ───────────────────────────────────────────

describe('resolveHandle — Farcaster', () => {
  it('should resolve a numeric FID', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const result = await resolveHandle('12345', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('farcaster');
    expect(result!.id).toBe('12345');

    // Should call the Farcaster hub
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('hub.farcaster.standardcrypto.vc');
    expect(callUrl).toContain('fid=12345');
  });

  it('should resolve a @username', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ fid: 67890 }), { status: 200 }),
    );

    const result = await resolveHandle('@vitalik', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('farcaster');
    expect(result!.id).toBe('67890');
    expect(result!.handle).toBe('@vitalik');

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('username=vitalik');
  });

  it('should return null when Farcaster hub returns 404', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const result = await resolveHandle('@nonexistent', mockFetch);
    expect(result).toBeNull();
  });
});

// ─── resolveHandle — Bluesky ─────────────────────────────────────────────

describe('resolveHandle — Bluesky', () => {
  it('should resolve a DID to Bluesky', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const result = await resolveHandle('did:plc:abc123def456', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('bluesky');
    expect(result!.id).toBe('did:plc:abc123def456');

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('plc.directory');
  });

  it('should resolve a domain handle (like bsky.app)', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ did: 'did:plc:xyz789' }),
        { status: 200 },
      ),
    );

    const result = await resolveHandle('alice.bsky.social', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('bluesky');
    expect(result!.id).toBe('did:plc:xyz789');

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('public.api.bsky.app');
  });

  it('should return null when Bluesky resolve fails', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const result = await resolveHandle('missing.bsky.social', mockFetch);
    expect(result).toBeNull();
  });
});

// ─── resolveHandle — Lens ────────────────────────────────────────────────

describe('resolveHandle — Lens', () => {
  it('should fall back to Lens resolution for plain names', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { profile: { id: '0x1234', handle: 'stani.lens' } },
        }),
        { status: 200 },
      ),
    );

    const result = await resolveHandle('stani', mockFetch);

    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('lens');
    expect(result!.id).toBe('0x1234');
    expect(result!.handle).toBe('lens/stani.lens');

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('api.lens.xyz');
  });

  it('should return null when Lens profile not found', async () => {
    const { resolveHandle } = await import('../index');
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { profile: null } }),
        { status: 200 },
      ),
    );

    const result = await resolveHandle('nonexistent', mockFetch);
    expect(result).toBeNull();
  });
});

// ─── formatCrossProtocolFollowers ────────────────────────────────────────

describe('formatCrossProtocolFollowers', () => {
  it('should return "No followers yet" for count 0', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(0, 1)).toBe('No followers yet');
  });

  it('should format small numbers directly', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(500, 1)).toBe('500 followers');
  });

  it('should format thousands as K', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(1500, 1)).toBe('1.5K followers');
  });

  it('should format millions as M', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(2500000, 1)).toBe('2.5M followers');
  });

  it('should include network count when > 1', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(5000, 3)).toBe(
      '5.0K followers across 3 networks',
    );
  });

  it('should handle edge case count of 1', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(1, 1)).toBe('1 followers');
  });

  it('should handle exactly 1,000,000', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(1000000, 1)).toBe('1.0M followers');
  });

  it('should handle exactly 1,000', async () => {
    const { formatCrossProtocolFollowers } = await import('../index');
    expect(formatCrossProtocolFollowers(1000, 1)).toBe('1.0K followers');
  });
});

// ─── buildUnifiedProfile ─────────────────────────────────────────────────

describe('buildUnifiedProfile', () => {
  it('should build a profile from a single protocol identity', async () => {
    const { buildUnifiedProfile } = await import('../index');
    const identity: CrossProtocolIdentity = {
      walletAddress: '0x1234',
      nostr: { npub: 'npub1abc', relays: [], verified: true },
      linkedAt: 1700000000000,
      lastVerified: 1700000000000,
    };

    const profile = buildUnifiedProfile(identity);

    expect(profile.walletAddress).toBe('0x1234');
    expect(profile.networkCount).toBe(1);
    expect(profile.handles).toHaveLength(1);
    expect(profile.handles[0].protocol).toBe('nostr');
    expect(profile.handles[0].handle).toBe('npub1abc');
    expect(profile.handles[0].verified).toBe(true);
    expect(profile.primaryProtocol).toBe('nostr');
    expect(profile.dfUri).toBe('df://profile/0x1234');
  });

  it('should build a profile from multiple protocol identities', async () => {
    const { buildUnifiedProfile } = await import('../index');
    const identity: CrossProtocolIdentity = {
      walletAddress: '0xabcd',
      nostr: { npub: 'npub1xyz', relays: [], verified: true },
      farcaster: { fid: 123, username: 'alice', custodyAddress: '0x', verified: true },
      lens: { profileId: '0x42', handle: 'alice.lens', verified: false },
      linkedAt: 1700000000000,
      lastVerified: 1700000000000,
    };

    const profile = buildUnifiedProfile(identity);

    expect(profile.networkCount).toBe(3);
    expect(profile.handles).toHaveLength(3);
    expect(profile.walletAddress).toBe('0xabcd');
    expect(profile.primaryProtocol).toBe('nostr');
  });

  it('should incorporate follower counts', async () => {
    const { buildUnifiedProfile } = await import('../index');
    const identity: CrossProtocolIdentity = {
      walletAddress: '0xdead',
      nostr: { npub: 'npub1xyz', relays: [], verified: true },
      farcaster: { fid: 456, username: 'bob', custodyAddress: '0x', verified: true },
      linkedAt: 1700000000000,
      lastVerified: 1700000000000,
    };

    const profile = buildUnifiedProfile(identity, {
      nostr: 500,
      farcaster: 1200,
    });

    expect(profile.totalFollowerCount).toBe(1700);
    // Each handle should have its follower count
    const nostrHandle = profile.handles.find((h) => h.protocol === 'nostr');
    expect(nostrHandle?.followerCount).toBe(500);

    const fcHandle = profile.handles.find((h) => h.protocol === 'farcaster');
    expect(fcHandle?.followerCount).toBe(1200);
  });

  it('should skip protocols with no identity', async () => {
    const { buildUnifiedProfile } = await import('../index');
    const identity: CrossProtocolIdentity = {
      walletAddress: '0xbeef',
      // Only bluesky, no others
      bluesky: { did: 'did:plc:abc', handle: 'alice.bsky.social', verified: true },
      linkedAt: 1700000000000,
      lastVerified: 1700000000000,
    };

    const profile = buildUnifiedProfile(identity);

    expect(profile.networkCount).toBe(1);
    expect(profile.handles).toHaveLength(1);
    expect(profile.handles[0].protocol).toBe('bluesky');
    expect(profile.primaryProtocol).toBe('bluesky');
  });

  it('should set displayName as joined handles', async () => {
    const { buildUnifiedProfile } = await import('../index');
    const identity: CrossProtocolIdentity = {
      walletAddress: '0xf00d',
      nostr: { npub: 'npub1aaa', relays: [], verified: false },
      telegram: { userId: '123', username: 'alice_tg', verified: true },
      linkedAt: 1700000000000,
      lastVerified: 1700000000000,
    };

    const profile = buildUnifiedProfile(identity);

    expect(profile.displayName).toContain('npub1aaa');
    expect(profile.displayName).toContain('alice_tg');
  });
});

// ─── mergeIdentities (extended) ─────────────────────────────────────────

describe('mergeIdentities', () => {
  it('should merge handles from multiple identities', async () => {
    const { mergeIdentities } = await import('../index');
    const merged = mergeIdentities([
      {
        id: 'merged-id',
        primary: { protocol: 'nostr', id: 'pubkey1' },
        handles: {
          nostr: 'npub1abc',
          farcaster: '123',
          lens: null,
          bluesky: null,
          threads: null,
          rss: null,
          mastodon: null,
        },
        displayName: 'Alice',
        avatarUrl: 'https://example.com/avatar1.png',
        verified: [{ protocol: 'nostr', badge: 'NIP-05' }],
        followerCount: 100,
        followingCount: 50,
        links: [{ label: 'Website', url: 'https://alice.com' }],
        keys: { nostrPubkey: 'pubkey1' },
      },
      {
        handles: {
          nostr: null,
          farcaster: '123',
          lens: null,
          bluesky: 'did:plc:abc',
          threads: null,
          rss: null,
          mastodon: null,
        },
        displayName: 'Alice Onchain',
        verified: [{ protocol: 'farcaster', badge: 'FID' }],
        followerCount: 500,
        keys: { farcasterFid: 123 },
      },
    ]);

    expect(merged.id).toBe('merged-id');
    expect(merged.handles.nostr).toBe('npub1abc');
    expect(merged.handles.farcaster).toBe('123');
    expect(merged.handles.bluesky).toBe('did:plc:abc');
    // Later displayName overrides
    expect(merged.displayName).toBe('Alice Onchain');
    expect(merged.verified).toHaveLength(2);
    // Later followerCount overrides
    expect(merged.followerCount).toBe(500);
    expect(merged.keys).toMatchObject({
      nostrPubkey: 'pubkey1',
      farcasterFid: 123,
    });
  });

  it('should preserve empty arrays when no verified/links', async () => {
    const { mergeIdentities } = await import('../index');
    const merged = mergeIdentities([
      {
        id: 'test',
        primary: { protocol: 'nostr', id: 'key' },
        handles: { nostr: 'npub1x', farcaster: null, lens: null, bluesky: null },
        displayName: 'Test',
        bio: '',
        avatarUrl: '',
        verified: [],
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
    ]);

    expect(merged.verified).toEqual([]);
    expect(merged.links).toEqual([]);
    expect(merged.keys).toEqual({});
  });
});

/**
 * @degenfeed/identity — BYOA verification tests
 *
 * Network calls are mocked via the fetchFn parameter. The @degenfeed/nostr-sdk
 * module is mocked for NIP-05 / npub paths.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/nostr-sdk', () => ({
  npubDecode: vi.fn(
    (_npub: string) => 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  ),
  resolveNip05: vi.fn(),
  verifyNip05: vi.fn(),
}));

import {
  verifyBlueskyIdentity,
  verifyExternalIdentity,
  verifyFarcasterIdentity,
  verifyFediverseIdentity,
  verifyIdentity,
  verifyLensIdentity,
  verifyNostrIdentity,
} from './verify';

const HEX_PUBKEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Nostr ──────────────────────────────────────────────────────────────

describe('verifyNostrIdentity', () => {
  it('should decode a valid npub to a pubkey hex', async () => {
    const result = await verifyNostrIdentity({ input: 'npub1hello' });
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('nostr');
    expect(result!.identifier).toBe(HEX_PUBKEY);
    expect(result!.verification).toBe('npub-decode');
  });

  it('should accept a bare hex pubkey', async () => {
    const result = await verifyNostrIdentity({ input: HEX_PUBKEY });
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe(HEX_PUBKEY);
  });

  it('should reject invalid npub', async () => {
    const result = await verifyNostrIdentity({ input: 'notanpub' });
    expect(result).toBeNull();
  });

  it('should resolve a NIP-05 identifier', async () => {
    const { resolveNip05 } = await import('@degenfeed/nostr-sdk');
    vi.mocked(resolveNip05).mockResolvedValue({ pubkey: HEX_PUBKEY, relays: [] });
    const result = await verifyNostrIdentity({ input: 'alice@example.com' });
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('nostr');
    expect(result!.identifier).toBe(HEX_PUBKEY);
    expect(result!.verification).toBe('nip05');
  });

  it('should return null when NIP-05 resolution fails', async () => {
    const { resolveNip05 } = await import('@degenfeed/nostr-sdk');
    vi.mocked(resolveNip05).mockResolvedValue(null);
    const result = await verifyNostrIdentity({ input: 'alice@example.com' });
    expect(result).toBeNull();
  });

  it('should cross-check the NIP-05 owner when provided', async () => {
    const { verifyNip05 } = await import('@degenfeed/nostr-sdk');
    vi.mocked(verifyNip05).mockResolvedValue(true);
    const result = await verifyNostrIdentity({
      input: `npub1hello`,
      nip05: 'alice@example.com',
    });
    expect(result).not.toBeNull();
    expect(result!.handle).toBe('alice@example.com');
    expect(result!.verification).toBe('nip05');
    expect(verifyNip05).toHaveBeenCalledWith('alice@example.com', HEX_PUBKEY, expect.any(Function));
  });

  it('should return null when the NIP-05 owner mismatch', async () => {
    const { verifyNip05 } = await import('@degenfeed/nostr-sdk');
    vi.mocked(verifyNip05).mockResolvedValue(false);
    const result = await verifyNostrIdentity({
      input: `npub1hello`,
      nip05: 'alice@example.com',
    });
    expect(result).toBeNull();
  });
});

// ─── Bluesky ────────────────────────────────────────────────────────────

describe('verifyBlueskyIdentity', () => {
  it('should resolve a handle to its DID', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ did: 'did:plc:abc123' }), { status: 200 }));
    const result = await verifyBlueskyIdentity('alice.bsky.social', mockFetch);
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('bluesky');
    expect(result!.identifier).toBe('did:plc:abc123');
    expect(result!.handle).toBe('@alice.bsky.social');
    expect(result!.verification).toBe('did');
  });

  it('should return null for unresolvable handles', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Handle not found', { status: 400 }));
    const result = await verifyBlueskyIdentity('nobody@example.com', mockFetch);
    expect(result).toBeNull();
  });

  it('should reject invalid handle format', async () => {
    const result = await verifyBlueskyIdentity('not a handle', vi.fn());
    expect(result).toBeNull();
  });
});

// ─── Farcaster ──────────────────────────────────────────────────────────

describe('verifyFarcasterIdentity', () => {
  it('should resolve an FID', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ fid: 123 }), { status: 200 }));
    const result = await verifyFarcasterIdentity('123', mockFetch);
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('farcaster');
    expect(result!.identifier).toBe('123');
    expect(result!.verification).toBe('fid');
  });

  it('should resolve a username to its FID', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ fid: 456 }), { status: 200 }));
    const result = await verifyFarcasterIdentity('vitalik', mockFetch);
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe('456');
    expect(result!.handle).toBe('@vitalik');
  });

  it('should return null when the hub has no match', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Not found', { status: 404 }));
    const result = await verifyFarcasterIdentity('nobody', mockFetch);
    expect(result).toBeNull();
  });
});

// ─── Lens ───────────────────────────────────────────────────────────────

describe('verifyLensIdentity', () => {
  it('should resolve a Lens handle via the Lens API', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { profile: { id: '0x01', handle: 'stani.lens' } },
        }),
        { status: 200 },
      ),
    );
    const result = await verifyLensIdentity('stani.lens', mockFetch);
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('lens');
    expect(result!.identifier).toBe('0x01');
    expect(result!.handle).toBe('lens/stani.lens');
  });

  it('should return null for unknown handles', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { profile: null } }), { status: 200 }),
      );
    const result = await verifyLensIdentity('nobody.lens', mockFetch);
    expect(result).toBeNull();
  });
});

// ─── Fediverse / Mastodon ───────────────────────────────────────────────

describe('verifyFediverseIdentity', () => {
  it('should verify a Mastodon handle via WebFinger', async () => {
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
    const result = await verifyFediverseIdentity('user@mastodon.social', mockFetch);
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('mastodon');
    expect(result!.identifier).toBe('https://mastodon.social/users/user');
    expect(result!.handle).toBe('user@mastodon.social');
    expect(result!.verification).toBe('webfinger');
  });

  it('should return null when WebFinger fails', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Not found', { status: 404 }));
    const result = await verifyFediverseIdentity('missing@example.com', mockFetch);
    expect(result).toBeNull();
  });

  it('should reject malformed handles', async () => {
    const result = await verifyFediverseIdentity('noatsign', vi.fn());
    expect(result).toBeNull();
  });
});

// ─── External platforms ─────────────────────────────────────────────────

describe('verifyExternalIdentity', () => {
  it('should verify an X handle', () => {
    const result = verifyExternalIdentity('twitter', '@alice');
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('twitter');
    expect(result!.handle).toBe('alice');
    expect(result!.profileUrl).toBe('https://x.com/alice');
  });

  it('should extract a handle from a YouTube URL', () => {
    const result = verifyExternalIdentity('youtube', 'https://youtube.com/@channel');
    expect(result).not.toBeNull();
    expect(result!.handle).toBe('channel');
    expect(result!.profileUrl).toBe('https://youtube.com/@channel');
  });

  it('should verify a GitHub username', () => {
    const result = verifyExternalIdentity('github', 'octocat');
    expect(result).not.toBeNull();
    expect(result!.handle).toBe('octocat');
  });

  it('should verify a Discord username or user id', () => {
    expect(verifyExternalIdentity('discord', 'alice#1234')).not.toBeNull();
    expect(verifyExternalIdentity('discord', '123456789012345678')).not.toBeNull();
    expect(verifyExternalIdentity('discord', 'invalid')).toBeNull();
  });

  it('should reject invalid external handles', () => {
    expect(verifyExternalIdentity('twitter', 'this username is way too long!!!')).toBeNull();
    expect(verifyExternalIdentity('github', '-bad-')).toBeNull();
    expect(verifyExternalIdentity('telegram', 'ab')).toBeNull();
  });
});

// ─── Dispatcher ─────────────────────────────────────────────────────────

describe('verifyIdentity dispatcher', () => {
  it('should route verifyable protocols', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ did: 'did:plc:xyz' }), { status: 200 }));
    const result = await verifyIdentity('bluesky', 'alice.bsky.social', { fetchFn: mockFetch });
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('bluesky');
  });

  it('should route external protocols without network', async () => {
    const result = await verifyIdentity('github', 'octocat');
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('github');
  });

  it('should return null for unknown protocols', async () => {
    const result = await verifyIdentity('unknown', 'anything');
    expect(result).toBeNull();
  });
});

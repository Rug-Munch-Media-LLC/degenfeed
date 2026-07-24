// @ts-nocheck
import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatCrossProtocolFollowers,
  globalIdentityResolver,
  IdentityResolver,
  linkIdentities,
  resolveIdentity,
} from './identity-resolver';

describe('IdentityResolver', () => {
  let resolver: IdentityResolver;

  beforeEach(() => {
    resolver = new IdentityResolver();
  });

  it('should resolve a single protocol identity', async () => {
    const profile = await resolver.resolve('nostr', 'npub1abc');
    expect(profile).toBeDefined();
    expect(profile!.primaryProtocol).toBe('nostr');
    expect(profile.handles).toHaveLength(1);
    expect(profile.handles[0].protocol).toBe('nostr');
    expect(profile.handles[0].userId).toBe('npub1abc');
  });

  it('should link two identities', async () => {
    resolver.linkIdentities('nostr', 'npub1abc', 'mastodon', 'alice@social.degenfeed.xyz');

    const profile = await resolver.resolve('nostr', 'npub1abc');
    expect(profile.handles).toHaveLength(2);
    expect(profile.protocolCount).toBe(2);
    expect(profile.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should return the same profile from either linked identity', async () => {
    resolver.linkIdentities('nostr', 'npub1abc', 'bluesky', 'did:plc:alice');

    const profileA = await resolver.resolve('nostr', 'npub1abc');
    const profileB = await resolver.resolve('bluesky', 'did:plc:alice');

    expect(profileA.profileId).toBe(profileB.profileId);
    expect(profileA.handles.sort((a, b) => a.protocol.localeCompare(b.protocol))).toEqual(
      profileB.handles.sort((a, b) => a.protocol.localeCompare(b.protocol)),
    );
  });

  it('should link to multiple identities', async () => {
    resolver.linkIdentities('nostr', 'npub1abc', 'farcaster', 'fid:123');
    resolver.linkIdentities('nostr', 'npub1abc', 'bluesky', 'did:plc:alice');
    resolver.linkIdentities('nostr', 'npub1abc', 'mastodon', 'alice@instance.com');

    const profile = await resolver.resolve('nostr', 'npub1abc');
    expect(profile.protocolCount).toBe(4);
    expect(profile.confidence).toBeGreaterThan(0.5);
  });

  it('should cache results', async () => {
    const profile1 = await resolver.resolve('nostr', 'npub1abc');
    expect(profile1.protocolCount).toBe(1);

    // Second resolve without changes should return cached profile
    const profile2 = await resolver.resolve('nostr', 'npub1abc');
    expect(profile2.protocolCount).toBe(1);

    // After linking, cache is invalidated and we get updated data
    resolver.linkIdentities('nostr', 'npub1abc', 'bluesky', 'did:plc:alice');
    const profile3 = await resolver.resolve('nostr', 'npub1abc');
    expect(profile3.protocolCount).toBe(2); // Cache invalidated, now has bluesky
  });

  it('should handle batch resolution', async () => {
    resolver.linkIdentities('nostr', 'npub1abc', 'mastodon', 'alice@fediverse.com');
    resolver.linkIdentities('farcaster', 'fid:123', 'bluesky', 'did:plc:bob');

    const profiles = await resolver.resolveBatch([
      { protocol: 'nostr', userId: 'npub1abc' },
      { protocol: 'farcaster', userId: 'fid:123' },
      { protocol: 'nostr', userId: 'npub_unknown' },
    ]);

    expect(profiles).toHaveLength(3);
    const alice = profiles.find((p) => p.handles.some((h) => h.userId === 'npub1abc'));
    expect(alice).toBeDefined();
    expect(alice!.protocolCount).toBe(2);
  });

  it('should search by handle', async () => {
    resolver.linkIdentities('nostr', 'npub1abc', 'bluesky', 'did:plc:alice');

    const results = await resolver.searchByHandle('npub1abc');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should maintain bidirectional mappings', async () => {
    resolver.linkIdentities('nostr', 'npub1abc', 'mastodon', 'alice@instance.com');

    // Resolving from either side should give the same data
    const fromNostr = await resolver.resolve('nostr', 'npub1abc');
    const fromMasto = await resolver.resolve('mastodon', 'alice@instance.com');

    expect(fromNostr.handles).toHaveLength(fromMasto.handles.length);
  });

  it('should resolve WebFinger-style handles', async () => {
    // This tests the method directly without network
    const result = await resolver.resolveWebFinger('alice@localhost');
    // Without a real server, it should return null gracefully
    expect(result).toBeNull();
  });

  it('should calculate confidence correctly', async () => {
    // Single identity = low confidence
    const single = await resolver.resolve('nostr', 'npub_lone');
    expect(single.confidence).toBe(0.5);

    // Linked = higher confidence
    resolver.linkIdentities('nostr', 'npub_multi', 'bluesky', 'did:plc:multi');
    const multi = await resolver.resolve('nostr', 'npub_multi');
    expect(multi.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

describe('formatCrossProtocolFollowers', () => {
  it('should format with network count', () => {
    expect(formatCrossProtocolFollowers(1500, 2)).toBe('1.5K followers across 2 networks');
  });

  it('should format without network count', () => {
    expect(formatCrossProtocolFollowers(500, 1)).toBe('500 followers');
  });

  it('should handle zero', () => {
    expect(formatCrossProtocolFollowers(0, 0)).toBe('No followers yet');
  });

  it('should format millions', () => {
    expect(formatCrossProtocolFollowers(2500000, 3)).toBe('2.5M followers across 3 networks');
  });
});

describe('globalIdentityResolver', () => {
  it('should be a singleton', () => {
    expect(globalIdentityResolver).toBeInstanceOf(IdentityResolver);
  });

  it('should work with convenience function', async () => {
    linkIdentities('nostr', 'npub_conv1', 'mastodon', 'conv@instance.com');
    const profile = await resolveIdentity('nostr', 'npub_conv1');
    expect(profile.protocolCount).toBe(2);
  });
});

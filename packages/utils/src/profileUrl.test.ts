/**
 * @degenfeed/utils — profileUrl tests
 *
 * Verifies internal (/profile/{protocol}/{id}) and external (platform-native)
 * profile URL generation for every supported protocol. These URLs power the
 * author click-through on post cards (PostHeader) and the "View on {protocol}"
 * link on profile pages.
 */

import type { UnifiedIdentity } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import {
  getAuthorProfileHref,
  getExternalProfileUrl,
  getInternalProfileId,
  getInternalProfilePath,
} from './profileUrl';

function identity(overrides: Partial<UnifiedIdentity> & { protocol: string }): UnifiedIdentity {
  const { protocol, ...rest } = overrides;
  return {
    id: `${protocol}:${rest.primary?.id ?? rest.id ?? ''}`,
    primary: rest.primary ?? {
      protocol: protocol as UnifiedIdentity['primary']['protocol'],
      id: rest.id ?? '',
    },
    handles: rest.handles ?? {},
    displayName: rest.displayName ?? 'anon',
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
    ...rest,
  };
}

describe('getInternalProfileId', () => {
  it('prefers primary.id for id-based protocols', () => {
    const a = identity({
      protocol: 'bluesky',
      primary: { protocol: 'bluesky', id: 'did:plc:abc123' },
      handles: { bluesky: 'alice.bsky.social' },
    });
    expect(getInternalProfileId(a, 'bluesky')).toBe('did:plc:abc123');
  });

  it('prefers the handle for mastodon (acct over account UUID)', () => {
    const a = identity({
      protocol: 'mastodon',
      primary: { protocol: 'mastodon', id: '01AVGSNDCJ3P0YA0FN7H82K9T6' },
      handles: { mastodon: 'alice@mastodon.social' },
    });
    expect(getInternalProfileId(a, 'mastodon')).toBe('alice@mastodon.social');
  });

  it('prefers the handle for lens (handle over EVM address)', () => {
    const a = identity({
      protocol: 'lens',
      primary: { protocol: 'lens', id: '0xEacBaFBC0A015b5c23549a109D2750fB955f378b' },
      handles: { lens: 'frames943345' },
    });
    expect(getInternalProfileId(a, 'lens')).toBe('frames943345');
  });

  it('prefers the handle for lemmy (user@instance)', () => {
    const a = identity({
      protocol: 'lemmy',
      primary: { protocol: 'lemmy', id: '12345' },
      handles: { lemmy: 'alice@lemmy.world' },
    });
    expect(getInternalProfileId(a, 'lemmy')).toBe('alice@lemmy.world');
  });

  it('strips the protocol: prefix from author.id as a fallback', () => {
    const a = identity({
      protocol: 'reddit',
      primary: { protocol: 'reddit', id: '' },
      id: 'reddit:alice',
      handles: {},
    });
    expect(getInternalProfileId(a, 'reddit')).toBe('alice');
  });
});

describe('getInternalProfilePath', () => {
  it('nostr: /profile/nostr/{pubkey}', () => {
    const a = identity({
      protocol: 'nostr',
      primary: {
        protocol: 'nostr',
        id: '43d48afb9404e413b11572cf067050aea210b2f17a5842eaff51b772f78023bf',
      },
      handles: { nostr: '43d48afb9404' },
    });
    expect(getInternalProfilePath(a, 'nostr')).toBe(
      '/profile/nostr/43d48afb9404e413b11572cf067050aea210b2f17a5842eaff51b772f78023bf',
    );
  });

  it('mastodon: /profile/mastodon/{acct} with encoded @', () => {
    const a = identity({
      protocol: 'mastodon',
      primary: { protocol: 'mastodon', id: '01AVGSNDCJ3P0YA0FN7H82K9T6' },
      handles: { mastodon: 'degenfeed_bot@social.degenfeed.xyz' },
    });
    expect(getInternalProfilePath(a, 'mastodon')).toBe(
      '/profile/mastodon/degenfeed_bot%40social.degenfeed.xyz',
    );
  });

  it('bluesky: /profile/bluesky/{did}', () => {
    const a = identity({
      protocol: 'bluesky',
      primary: { protocol: 'bluesky', id: 'did:plc:abc123' },
      handles: { bluesky: 'alice.bsky.social' },
    });
    expect(getInternalProfilePath(a, 'bluesky')).toBe('/profile/bluesky/did%3Aplc%3Aabc123');
  });

  it('farcaster: /profile/farcaster/{fid}', () => {
    const a = identity({
      protocol: 'farcaster',
      primary: { protocol: 'farcaster', id: '12345' },
      handles: { farcaster: 'alice' },
    });
    expect(getInternalProfilePath(a, 'farcaster')).toBe('/profile/farcaster/12345');
  });

  it('lens: /profile/lens/{handle}', () => {
    const a = identity({
      protocol: 'lens',
      primary: { protocol: 'lens', id: '0xEacBaFBC0A015b5c23549a109D2750fB955f378b' },
      handles: { lens: 'frames943345' },
    });
    expect(getInternalProfilePath(a, 'lens')).toBe('/profile/lens/frames943345');
  });

  it('reddit: /profile/reddit/{username}', () => {
    const a = identity({
      protocol: 'reddit',
      primary: { protocol: 'reddit', id: '' },
      id: 'reddit:alice',
      handles: { reddit: 'alice' },
    });
    expect(getInternalProfilePath(a, 'reddit')).toBe('/profile/reddit/alice');
  });

  it('youtube: /profile/youtube/{channelId}', () => {
    const a = identity({
      protocol: 'youtube',
      primary: { protocol: 'youtube', id: 'UCabc123' },
      handles: { youtube: '@alice' },
    });
    expect(getInternalProfilePath(a, 'youtube')).toBe('/profile/youtube/UCabc123');
  });

  it('soundcloud: /profile/soundcloud/{id}', () => {
    const a = identity({
      protocol: 'soundcloud',
      primary: { protocol: 'soundcloud', id: '' },
      id: 'soundcloud:alice',
      handles: { soundcloud: 'alice' },
    });
    expect(getInternalProfilePath(a, 'soundcloud')).toBe('/profile/soundcloud/alice');
  });

  it('lemmy: /profile/lemmy/{instance}/{username} (nested)', () => {
    const a = identity({
      protocol: 'lemmy',
      primary: { protocol: 'lemmy', id: '12345' },
      handles: { lemmy: 'alice@lemmy.world' },
    });
    expect(getInternalProfilePath(a, 'lemmy')).toBe('/profile/lemmy/lemmy.world/alice');
  });

  it('lemmy with single-part id falls back to the flat form', () => {
    const a = identity({
      protocol: 'lemmy',
      primary: { protocol: 'lemmy', id: '12345' },
      handles: { lemmy: null },
    });
    expect(getInternalProfilePath(a, 'lemmy')).toBe('/profile/lemmy/12345');
  });
});

describe('getExternalProfileUrl', () => {
  it('nostr: njump.me with hex pubkey', () => {
    const a = identity({
      protocol: 'nostr',
      primary: {
        protocol: 'nostr',
        id: '43d48afb9404e413b11572cf067050aea210b2f17a5842eaff51b772f78023bf',
      },
      handles: { nostr: '43d48afb9404' },
    });
    expect(getExternalProfileUrl(a, 'nostr')).toBe(
      'https://njump.me/43d48afb9404e413b11572cf067050aea210b2f17a5842eaff51b772f78023bf',
    );
  });

  it('nostr: njump.me with npub handle when no hex', () => {
    const a = identity({
      protocol: 'nostr',
      primary: { protocol: 'nostr', id: '' },
      handles: { nostr: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' },
    });
    expect(getExternalProfileUrl(a, 'nostr')).toBe(
      'https://njump.me/npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    );
  });

  it('mastodon: https://{instance}/@{user}', () => {
    const a = identity({
      protocol: 'mastodon',
      primary: { protocol: 'mastodon', id: '01AVGSNDCJ3P0YA0FN7H82K9T6' },
      handles: { mastodon: 'degenfeed_bot@social.degenfeed.xyz' },
    });
    expect(getExternalProfileUrl(a, 'mastodon')).toBe(
      'https://social.degenfeed.xyz/@degenfeed_bot',
    );
  });

  it('mastodon: tolerates a leading @ on the handle', () => {
    const a = identity({
      protocol: 'mastodon',
      primary: { protocol: 'mastodon', id: 'x' },
      handles: { mastodon: '@alice@mastodon.social' },
    });
    expect(getExternalProfileUrl(a, 'mastodon')).toBe('https://mastodon.social/@alice');
  });

  it('bluesky: https://bsky.app/profile/{handle}', () => {
    const a = identity({
      protocol: 'bluesky',
      primary: { protocol: 'bluesky', id: 'did:plc:abc123' },
      handles: { bluesky: 'alice.bsky.social' },
    });
    expect(getExternalProfileUrl(a, 'bluesky')).toBe('https://bsky.app/profile/alice.bsky.social');
  });

  it('bluesky: https://bsky.app/profile/{did} when no handle', () => {
    const a = identity({
      protocol: 'bluesky',
      primary: { protocol: 'bluesky', id: 'did:plc:abc123' },
      handles: {},
    });
    expect(getExternalProfileUrl(a, 'bluesky')).toBe('https://bsky.app/profile/did%3Aplc%3Aabc123');
  });

  it('farcaster: https://warpcast.com/{username}', () => {
    const a = identity({
      protocol: 'farcaster',
      primary: { protocol: 'farcaster', id: '12345' },
      handles: { farcaster: 'alice' },
    });
    expect(getExternalProfileUrl(a, 'farcaster')).toBe('https://warpcast.com/alice');
  });

  it('farcaster: profile fallback by fid', () => {
    const a = identity({
      protocol: 'farcaster',
      primary: { protocol: 'farcaster', id: '12345' },
      handles: {},
    });
    expect(getExternalProfileUrl(a, 'farcaster')).toBe('https://warpcast.com/~/profiles/12345');
  });

  it('lens: https://hey.xyz/u/{handle}', () => {
    const a = identity({
      protocol: 'lens',
      primary: { protocol: 'lens', id: '0xabc' },
      handles: { lens: 'lens/@alice' },
    });
    expect(getExternalProfileUrl(a, 'lens')).toBe('https://hey.xyz/u/alice');
  });

  it('reddit: https://reddit.com/user/{username}', () => {
    const a = identity({
      protocol: 'reddit',
      primary: { protocol: 'reddit', id: '' },
      handles: { reddit: 'u/alice' },
    });
    expect(getExternalProfileUrl(a, 'reddit')).toBe('https://reddit.com/user/alice');
  });

  it('youtube: channel URL for UC ids', () => {
    const a = identity({
      protocol: 'youtube',
      primary: { protocol: 'youtube', id: 'UCabc123' },
      handles: { youtube: '@alice' },
    });
    expect(getExternalProfileUrl(a, 'youtube')).toBe('https://www.youtube.com/channel/UCabc123');
  });

  it('youtube: @handle URL without UC id', () => {
    const a = identity({
      protocol: 'youtube',
      primary: { protocol: 'youtube', id: '' },
      handles: { youtube: '@alice' },
    });
    expect(getExternalProfileUrl(a, 'youtube')).toBe('https://www.youtube.com/@alice');
  });

  it('soundcloud: https://soundcloud.com/{handle}', () => {
    const a = identity({
      protocol: 'soundcloud',
      primary: { protocol: 'soundcloud', id: '' },
      handles: { soundcloud: '@alice' },
    });
    expect(getExternalProfileUrl(a, 'soundcloud')).toBe('https://soundcloud.com/alice');
  });

  it('lemmy: https://{instance}/u/{user}', () => {
    const a = identity({
      protocol: 'lemmy',
      primary: { protocol: 'lemmy', id: '12345' },
      handles: { lemmy: 'alice@lemmy.world' },
    });
    expect(getExternalProfileUrl(a, 'lemmy')).toBe('https://lemmy.world/u/alice');
  });

  it('prefers an explicitly stamped author.url', () => {
    const a = identity({
      protocol: 'farcaster',
      primary: { protocol: 'farcaster', id: '12345' },
      handles: { farcaster: 'alice' },
      url: 'https://warpcast.com/alice',
    });
    expect(getExternalProfileUrl(a, 'farcaster')).toBe('https://warpcast.com/alice');
  });
});

describe('getAuthorProfileHref', () => {
  it('returns the internal path when a stable id exists', () => {
    const a = identity({
      protocol: 'nostr',
      primary: {
        protocol: 'nostr',
        id: '43d48afb9404e413b11572cf067050aea210b2f17a5842eaff51b772f78023bf',
      },
      handles: { nostr: '43d48afb9404' },
    });
    expect(getAuthorProfileHref(a, 'nostr')).toBe(
      '/profile/nostr/43d48afb9404e413b11572cf067050aea210b2f17a5842eaff51b772f78023bf',
    );
  });

  it('falls back to the external URL when no stable internal id exists', () => {
    const a = identity({
      protocol: 'mastodon',
      primary: { protocol: 'mastodon', id: '' },
      id: '',
      handles: {},
      url: 'https://mastodon.social/@alice',
    });
    expect(getAuthorProfileHref(a, 'mastodon')).toBe('https://mastodon.social/@alice');
  });
});

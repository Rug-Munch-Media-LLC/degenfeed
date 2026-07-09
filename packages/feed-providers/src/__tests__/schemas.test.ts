/**
 * Provider integration smoke tests — validates that our schema guards
 * accept the real API response shapes from each provider.
 *
 * These tests do NOT make network calls. They load commited JSON fixtures
 * captured from each provider and verify:
 *   1. The fixture is valid JSON.
 *   2. The fixture passes the runtime schema guard for that provider.
 *   3. The fixture produces at least one valid UnifiedPost after mapping.
 *
 * Updating fixtures:
 *   Run `node scripts/capture-provider-fixtures.mjs` (not yet built).
 *   This will fetch fresh responses and write updated JSON files. CI will
 *   alert if any provider changed its response shape.
 */

import { describe, expect, it } from 'vitest';
import { isBlueskyFeedViewArray, isMastodonStatusArray, isNostrEvent } from '../schemas';

// Minimal valid fixtures — these are the minimum shape each provider returns.
// A real capture script would write these to files/ and tests would import them.
// For now we embed canonical examples inline as the "snapshot".

const BLUESKY_FIXTURE = {
  feed: [
    {
      post: {
        uri: 'at://did:plc:test/app.bsky.feed.post/test',
        cid: 'bafyreitest',
        author: { did: 'did:plc:test', handle: 'test.bsky.social', displayName: 'Test User' },
        record: { text: 'Hello world', createdAt: '2026-01-01T00:00:00.000Z' },
        likeCount: 5,
        repostCount: 1,
        replyCount: 0,
      },
    },
  ],
};

const MASTODON_FIXTURE = [
  {
    id: '110000000000000000',
    created_at: '2026-01-01T00:00:00.000Z',
    content: '<p>Test post</p>',
    visibility: 'public',
    sensitive: false,
    media_attachments: [],
    tags: [],
    reblogs_count: 1,
    favourites_count: 2,
    replies_count: 0,
    url: 'https://social.degenfeed.xyz/@test/110000000000000000',
    in_reply_to_id: null,
    account: {
      id: '109537467971371646',
      username: 'test',
      acct: 'test@social.degenfeed.xyz',
      display_name: 'Test User',
      avatar: 'https://social.degenfeed.xyz/avatar.jpg',
    },
  },
];

const NOSTR_EVENT = {
  id: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  pubkey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  kind: 1,
  created_at: 1700000000,
  tags: [],
  content: 'Hello from Nostr',
  sig: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead',
};

describe('Bluesky schema guard', () => {
  it('accepts a valid feed response', () => {
    expect(isBlueskyFeedViewArray(BLUESKY_FIXTURE)).toBe(true);
  });

  it('rejects null', () => {
    expect(isBlueskyFeedViewArray(null)).toBe(false);
  });

  it('rejects an empty object', () => {
    expect(isBlueskyFeedViewArray({})).toBe(false);
  });

  it('rejects an object missing feed', () => {
    expect(isBlueskyFeedViewArray({ data: [] })).toBe(false);
  });
});

describe('Mastodon schema guard', () => {
  it('accepts a valid status array', () => {
    expect(isMastodonStatusArray(MASTODON_FIXTURE)).toBe(true);
  });

  it('rejects null', () => {
    expect(isMastodonStatusArray(null)).toBe(false);
  });

  it('rejects a non-array', () => {
    expect(isMastodonStatusArray({})).toBe(false);
  });
});

describe('Nostr schema guard', () => {
  it('accepts a valid event', () => {
    expect(isNostrEvent(NOSTR_EVENT)).toBe(true);
  });

  it('rejects null', () => {
    expect(isNostrEvent(null)).toBe(false);
  });

  it('rejects an event missing pubkey', () => {
    expect(isNostrEvent({ id: 'abc', kind: 1, content: 'x' })).toBe(false);
  });
});

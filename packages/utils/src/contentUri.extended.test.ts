/**
 * @degenfeed/utils — Extended contentUri tests
 *
 * Covers additional edge cases beyond the existing test file.
 */

import { describe, expect, it } from 'vitest';
import { decodeContentUri, encodeContentUri, getPostContentUri } from './contentUri';

describe('encodeContentUri', () => {
  it('should encode simple protocol:id format', () => {
    expect(encodeContentUri('nostr', 'note1abc')).toBe('df://nostr:note1abc');
  });

  it('should encode with instance for federated protocols', () => {
    expect(encodeContentUri('mastodon', '1098765432', 'mastodon.social'))
      .toBe('df://mastodon/mastodon.social/1098765432');
  });

  it('should encode lemmy with community instance', () => {
    expect(encodeContentUri('lemmy', '123', 'community.degenfeed.xyz'))
      .toBe('df://lemmy/community.degenfeed.xyz/123');
  });
});

describe('decodeContentUri', () => {
  it('should decode simple protocol:id format', () => {
    const result = decodeContentUri('df://nostr:note1abc');
    expect(result).toEqual({ protocol: 'nostr', id: 'note1abc' });
  });

  it('should decode protocol/instance/id format', () => {
    const result = decodeContentUri('df://mastodon/mastodon.social/1098765432');
    expect(result).toEqual({
      protocol: 'mastodon',
      instance: 'mastodon.social',
      id: '1098765432',
    });
  });

  it('should return null for invalid URI', () => {
    expect(decodeContentUri('')).toBeNull();
    expect(decodeContentUri('df://')).toBeNull();
  });

  it('should handle ETH addresses with protocol:id format', () => {
    const result = decodeContentUri('df://ethereum:0xabc123def456');
    expect(result?.protocol).toBe('ethereum');
    expect(result?.id).toBe('0xabc123def456');
  });

  it('should handle ipfs:// URIs gracefully', () => {
    const result = decodeContentUri('df://bluesky:at://did:plc:abc/app.bsky.feed.post/1');
    expect(result?.protocol).toBe('bluesky');
    // The id includes everything after the first colon after protocol
    expect(result?.id).toContain('at://');
  });

  it('should handle URIs without df:// prefix', () => {
    const result = decodeContentUri('nostr:note1abc');
    expect(result).toEqual({ protocol: 'nostr', id: 'note1abc' });
  });
});

describe('getPostContentUri', () => {
  it('should generate content URI for nostr posts', () => {
    const post = { protocol: 'nostr', id: 'note1abc' } as any;
    const uri = getPostContentUri(post);
    expect(uri).toBe('df://nostr:note1abc');
  });

  it('should generate content URI for farcaster posts', () => {
    const post = { protocol: 'farcaster', id: '0xabc123' } as any;
    const uri = getPostContentUri(post);
    expect(uri).toBe('df://farcaster:0xabc123');
  });

  it('should generate content URI for mastodon posts', () => {
    const post = {
      protocol: 'mastodon',
      id: '1098765432',
      raw: { instance: 'mastodon.social' },
    } as any;
    const uri = getPostContentUri(post);
    expect(uri).toBe('df://mastodon/mastodon.social/1098765432');
  });
});

/**
 * @degenfeed/utils — df:// URI unit tests
 */

import { describe, expect, it } from 'vitest';

describe('contentUri', () => {
  describe('encodeContentUri', () => {
    it('should encode simple protocol:id format', async () => {
      const { encodeContentUri } = await import('./contentUri');
      expect(encodeContentUri('nostr', 'note1abc123')).toBe('df://nostr:note1abc123');
      expect(encodeContentUri('farcaster', '0xabc123')).toBe('df://farcaster:0xabc123');
      expect(encodeContentUri('lens', '0x01-0x02')).toBe('df://lens:0x01-0x02');
      expect(encodeContentUri('reddit', 'r/crypto/comments/abc123')).toBe(
        'df://reddit:r/crypto/comments/abc123',
      );
    });

    it('should encode protocol/instance/id format when instance is provided', async () => {
      const { encodeContentUri } = await import('./contentUri');
      expect(encodeContentUri('mastodon', '1098765432', 'mastodon.social')).toBe(
        'df://mastodon/mastodon.social/1098765432',
      );
      expect(encodeContentUri('lemmy', 'post/123', 'community.degenfeed.xyz')).toBe(
        'df://lemmy/community.degenfeed.xyz/post/123',
      );
      expect(encodeContentUri('peertube', 'w/abc123', 'video.degenfeed.xyz')).toBe(
        'df://peertube/video.degenfeed.xyz/w/abc123',
      );
    });

    it('should handle bluesky AT URIs', async () => {
      const { encodeContentUri } = await import('./contentUri');
      expect(encodeContentUri('bluesky', 'at://did:plc:abc/app.bsky.feed.post/123')).toBe(
        'df://bluesky:at://did:plc:abc/app.bsky.feed.post/123',
      );
    });
  });

  describe('decodeContentUri', () => {
    it('should decode simple protocol:id format', async () => {
      const { decodeContentUri } = await import('./contentUri');
      const result = decodeContentUri('df://nostr:note1abc123');
      expect(result).toEqual({ protocol: 'nostr', id: 'note1abc123' });
    });

    it('should decode protocol/instance/id format', async () => {
      const { decodeContentUri } = await import('./contentUri');
      const result = decodeContentUri('df://mastodon/mastodon.social/1098765432');
      expect(result).toEqual({
        protocol: 'mastodon',
        instance: 'mastodon.social',
        id: '1098765432',
      });
    });

    it('should decode bluesky AT URI (colon in id)', async () => {
      const { decodeContentUri } = await import('./contentUri');
      const result = decodeContentUri(
        'df://bluesky:at://did:plc:abc/app.bsky.feed.post/123',
      );
      expect(result).toEqual({
        protocol: 'bluesky',
        id: 'at://did:plc:abc/app.bsky.feed.post/123',
      });
    });

    it('should decode lemmy URI (slashes in id after instance)', async () => {
      const { decodeContentUri } = await import('./contentUri');
      const result = decodeContentUri(
        'df://lemmy/community.degenfeed.xyz/post/123',
      );
      expect(result).toEqual({
        protocol: 'lemmy',
        instance: 'community.degenfeed.xyz',
        id: 'post/123',
      });
    });

    it('should return null for invalid URIs', async () => {
      const { decodeContentUri } = await import('./contentUri');
      expect(decodeContentUri('')).toBeNull();
      expect(decodeContentUri('not-a-df-uri')).toBeNull();
      expect(decodeContentUri('df://')).toBeNull();
      expect(decodeContentUri('df:///')).toBeNull();
    });

    it('should be the inverse of encodeContentUri for simple format', async () => {
      const { encodeContentUri, decodeContentUri } = await import('./contentUri');
      const uri = encodeContentUri('nostr', 'note1abc123');
      const decoded = decodeContentUri(uri);
      expect(decoded).toEqual({ protocol: 'nostr', id: 'note1abc123' });
    });

    it('should be the inverse of encodeContentUri for instance format', async () => {
      const { encodeContentUri, decodeContentUri } = await import('./contentUri');
      const uri = encodeContentUri('mastodon', '1098765432', 'mastodon.social');
      const decoded = decodeContentUri(uri);
      expect(decoded).toEqual({
        protocol: 'mastodon',
        instance: 'mastodon.social',
        id: '1098765432',
      });
    });
  });

  describe('getPostContentUri', () => {
    it('should derive URI from a simple post', async () => {
      const { getPostContentUri } = await import('./contentUri');
      const uri = getPostContentUri({ protocol: 'nostr', id: 'note1abc123' });
      expect(uri).toBe('df://nostr:note1abc123');
    });

    it('should use provided instance', async () => {
      const { getPostContentUri } = await import('./contentUri');
      const uri = getPostContentUri({
        protocol: 'mastodon',
        id: '1098765432',
        instance: 'mastodon.social',
      });
      expect(uri).toBe('df://mastodon/mastodon.social/1098765432');
    });

    it('should extract mastodon instance from raw URI', async () => {
      const { getPostContentUri } = await import('./contentUri');
      const uri = getPostContentUri({
        protocol: 'mastodon',
        id: '1098765432',
        raw: { uri: 'https://mastodon.social/users/test/statuses/1098765432' },
      });
      expect(uri).toBe('df://mastodon/mastodon.social/1098765432');
    });

    it('should strip protocol prefix from id', async () => {
      const { getPostContentUri } = await import('./contentUri');
      const uri = getPostContentUri({ protocol: 'nostr', id: 'nostr:note1abc123' });
      expect(uri).toBe('df://nostr:note1abc123');
    });

    it('should not double-encode bluesky AT URIs', async () => {
      const { getPostContentUri } = await import('./contentUri');
      const uri = getPostContentUri({
        protocol: 'bluesky',
        id: 'at://did:plc:abc/app.bsky.feed.post/123',
      });
      expect(uri).toBe('df://bluesky:at://did:plc:abc/app.bsky.feed.post/123');
    });
  });
});

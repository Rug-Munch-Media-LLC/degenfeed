// @ts-nocheck
import { beforeEach, describe, expect, it } from 'vitest';
import type { CrossProtocolReply } from './cross-protocol';
import {
  assembleCrossProtocolReplies,
  buildAlsoPostedIndicator,
  clearThreadStore,
  getAlsoPostedOn,
  getCrossPostLinks,
  getThreadMeta,
  pruneThreads,
  registerCrossPostLink,
  registerReply,
} from './cross-protocol';

describe('CrossProtocolLink', () => {
  beforeEach(() => {
    clearThreadStore();
  });

  it('should register a cross-post link', () => {
    const link = registerCrossPostLink('mastodon', 'post-1', 'nostr', 'note-1', 'user');
    expect(link.sourceProtocol).toBe('mastodon');
    expect(link.targetProtocol).toBe('nostr');
    expect(link.verified).toBe(true);
    expect(link.method).toBe('user');
  });

  it('should retrieve cross-post links', () => {
    registerCrossPostLink('mastodon', 'post-1', 'nostr', 'note-1');
    registerCrossPostLink('mastodon', 'post-1', 'bluesky', 'record-1');

    const links = getCrossPostLinks('mastodon', 'post-1');
    expect(links).toHaveLength(2);
  });

  it('should correctly report alsoPostedOn', () => {
    registerCrossPostLink('mastodon', 'post-1', 'nostr', 'note-1');
    registerCrossPostLink('mastodon', 'post-1', 'bluesky', 'record-1');

    const also = getAlsoPostedOn('mastodon', 'post-1');
    expect(also).toContain('nostr');
    expect(also).toContain('bluesky');
    expect(also).not.toContain('mastodon');
  });

  it('should handle reverse lookups', () => {
    registerCrossPostLink('mastodon', 'post-1', 'nostr', 'note-1');

    // Looking up the nostr target should return the source
    const links = getCrossPostLinks('nostr', 'note-1');
    expect(links).toHaveLength(1);
    expect(links[0].sourceProtocol).toBe('mastodon');
  });
});

describe('CrossProtocolThread', () => {
  beforeEach(() => {
    clearThreadStore();
  });

  const makeReply = (
    id: string,
    protocol: string,
    overrides: Partial<CrossProtocolReply> = {},
  ): CrossProtocolReply => ({
    id,
    protocol,
    text: `Reply ${id}`,
    createdAt: Date.now(),
    author: { id: `author-${id}`, displayName: `Author ${id}` },
    metrics: { likes: 0, replies: 0 },
    bridged: false,
    parentUri: 'df://post-1',
    depth: 0,
    ...overrides,
  });

  it('should register a reply and build a thread', () => {
    const reply = makeReply('reply-1', 'nostr');
    const thread = registerReply('mastodon', 'post-1', reply);

    expect(thread).toBeDefined();
    expect(thread?.replies).toHaveLength(1);
    expect(thread.replies[0].id).toBe('reply-1');
  });

  it('should not duplicate replies', () => {
    const reply = makeReply('reply-1', 'nostr');
    registerReply('mastodon', 'post-1', reply);
    registerReply('mastodon', 'post-1', reply);

    const thread = registerReply('mastodon', 'post-1', reply);
    expect(thread.replies).toHaveLength(1);
  });

  it('should track bridged replies', () => {
    const reply = makeReply('reply-1', 'nostr', { bridged: true, bridgeFrom: 'nostr' });
    const thread = registerReply('mastodon', 'post-1', reply);

    expect(thread.bridgeCount).toBe(1);
  });

  it('should count protocols', () => {
    registerReply('mastodon', 'post-1', makeReply('r1', 'nostr'));
    registerReply('mastodon', 'post-1', makeReply('r2', 'nostr'));
    registerReply('mastodon', 'post-1', makeReply('r3', 'farcaster'));

    // Need to get thread again
    const thread = registerReply('mastodon', 'post-1', makeReply('r4', 'bluesky'));
    expect(thread.protocols).toHaveLength(3);
    expect(thread.byProtocol.nostr).toBe(2);
    expect(thread.byProtocol.farcaster).toBe(1);
    expect(thread.byProtocol.bluesky).toBe(1);
  });

  it('should build alsoPostedIndicator correctly', () => {
    registerCrossPostLink('mastodon', 'post-1', 'nostr', 'note-1');
    registerCrossPostLink('mastodon', 'post-1', 'bluesky', 'record-1');

    const indicator = buildAlsoPostedIndicator('mastodon', 'post-1');
    expect(indicator.show).toBe(true);
    expect(indicator.protocols).toHaveLength(2);
    expect(indicator.protocols[0].name).toBe('Nostr');
    expect(indicator.protocols[1].name).toBe('Bluesky');
  });

  it('should not show indicator when no cross-posts exist', () => {
    const indicator = buildAlsoPostedIndicator('mastodon', 'unknown-post');
    expect(indicator.show).toBe(false);
    expect(indicator.protocols).toHaveLength(0);
  });

  it('should assemble replies from multiple protocols', () => {
    const thread = assembleCrossProtocolReplies('mastodon', 'post-1', {
      nostr: [makeReply('r1', 'nostr')],
      farcaster: [makeReply('r2', 'farcaster')],
    });

    expect(thread.replies).toHaveLength(2);
    // Cross-protocol replies should be marked as bridged
    expect(thread.replies.filter((r) => r.bridged).length).toBe(2);
    expect(thread.protocols).toHaveLength(2);
  });

  it('should return thread metadata', () => {
    registerReply('mastodon', 'post-1', makeReply('r1', 'nostr', { bridged: true }));
    registerReply('mastodon', 'post-1', makeReply('r2', 'farcaster'));
    registerCrossPostLink('mastodon', 'post-1', 'nostr', 'note-1');

    const meta = getThreadMeta('mastodon', 'post-1');
    expect(meta).not.toBeNull();
    expect(meta?.replyCount).toBe(2);
    expect(meta?.bridgeCount).toBe(1);
    expect(meta?.protocolCount).toBe(2);
  });

  it('should prune old threads', () => {
    registerReply('mastodon', 'post-1', makeReply('r1', 'nostr'));
    registerReply('mastodon', 'post-2', makeReply('r2', 'nostr'));

    // Set a large cutoff to prune everything
    const pruned = pruneThreads(-1_000_000_000); // huge negative = prune all
    expect(pruned).toBe(2);
  });
});

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { buildUnifiedPost, emptyIdentity } from './index';
import { computeProtocolQuality, QUALITY_BADGE_THRESHOLD } from './protocol-quality';

function makePost(
  protocol: Protocol,
  overrides: {
    text?: string;
    raw?: unknown;
    metrics?: Partial<UnifiedPost['metrics']>;
    author?: Partial<UnifiedPost['author']>;
    embeds?: UnifiedPost['embeds'];
    parentNativeId?: string;
  } = {},
): UnifiedPost {
  const post = buildUnifiedPost({
    protocol,
    nativeId: `test-${Math.random().toString(36).slice(2)}`,
    author: { ...emptyIdentity(), ...overrides.author },
    text: overrides.text ?? 'A thoughtful post about ethereum scaling',
    createdAt: Date.now(),
    metrics: overrides.metrics,
    raw: overrides.raw ?? {},
    parentNativeId: overrides.parentNativeId,
  });
  if (overrides.embeds) post.embeds = overrides.embeds;
  return post;
}

describe('computeProtocolQuality', () => {
  // ── Farcaster ────────────────────────────────────────────────────
  it('scores farcaster: verified + power badge + replies + frame + no degen spam = 8/8', () => {
    const post = makePost('farcaster', {
      raw: { author: { power_badge: true, verified_addresses: { eth_addresses: ['0x1'] } } },
      metrics: { replies: 3 },
      embeds: [{ kind: 'frame', url: 'https://frame.example/f' }],
    });
    const q = computeProtocolQuality(post);
    expect(q.score).toBe(8);
    expect(q.maxScore).toBe(8);
    expect(q.badge).toBe('verified');
    expect(q.reasons).toContain('power-badge');
  });

  it('penalizes farcaster $DEGEN tip spam', () => {
    const clean = makePost('farcaster', { text: 'great analysis of L2 fees' });
    const spam = makePost('farcaster', { text: '100 $DEGEN' });
    expect(computeProtocolQuality(clean).reasons).toContain('no-degen-spam');
    expect(computeProtocolQuality(spam).reasons).not.toContain('no-degen-spam');
  });

  // ── Lens ─────────────────────────────────────────────────────────
  it('scores lens original publication above a mirror', () => {
    const original = makePost('lens', {
      raw: { stats: { collects: 4 } },
      metrics: { replies: 2 },
      author: { followerCount: 100 },
    });
    const mirror = makePost('lens', { raw: { __typename: 'Mirror', mirrorOf: { id: 'x' } } });
    const qo = computeProtocolQuality(original);
    const qm = computeProtocolQuality(mirror);
    expect(qo.score).toBe(7);
    expect(qo.badge).toBe('verified');
    expect(qm.reasons).not.toContain('original-publication');
    expect(qo.ratio).toBeGreaterThan(qm.ratio);
  });

  // ── Bluesky ──────────────────────────────────────────────────────
  it('scores bluesky custom domain + media + top-level + followed = 5/5', () => {
    const author = emptyIdentity();
    author.id = 'bluesky:did:plc:abc';
    author.handles.bluesky = 'alice.dev';
    const post = makePost('bluesky', {
      author,
      embeds: [{ kind: 'image', url: 'https://cdn.example/img.jpg' }],
    });
    const q = computeProtocolQuality(post, { followed: new Set(['bluesky:did:plc:abc']) });
    expect(q.score).toBe(5);
    expect(q.badge).toBe('verified');
  });

  it('gives bluesky replies no not-reply-spam point', () => {
    const reply = makePost('bluesky', { parentNativeId: 'at://parent' });
    expect(computeProtocolQuality(reply).reasons).not.toContain('not-reply-spam');
  });

  // ── Nostr ────────────────────────────────────────────────────────
  it('scores nostr kind-1 long-form multi-relay nip05 = 6/6', () => {
    const author = emptyIdentity();
    author.handles.nostr = 'jack@cash.app';
    const post = makePost('nostr', {
      author,
      text: 'x'.repeat(300),
      raw: { kind: 1, __relayCount: 3 },
    });
    const q = computeProtocolQuality(post);
    expect(q.score).toBe(6);
    expect(q.badge).toBe('verified');
    expect(q.reasons).toEqual(
      expect.arrayContaining(['kind-1', 'long-form', 'multi-relay', 'nip05-verified']),
    );
  });

  it('does not treat a raw pubkey prefix as NIP-05', () => {
    const author = emptyIdentity();
    author.handles.nostr = '3bf0c63fcb93';
    const post = makePost('nostr', { author, raw: { kind: 1 } });
    expect(computeProtocolQuality(post).reasons).not.toContain('nip05-verified');
  });

  // ── Mastodon ─────────────────────────────────────────────────────
  it('scores mastodon alt-text + CW + human + known instance = 5/5', () => {
    const author = emptyIdentity();
    author.handles.mastodon = 'alice@mastodon.social';
    const post = makePost('mastodon', {
      author,
      raw: {
        spoiler_text: 'food',
        sensitive: true,
        media_attachments: [{ type: 'image', url: 'https://x/img.png', description: 'a cake' }],
        account: { bot: false, created_at: '2020-01-01T00:00:00Z' },
      },
    });
    const q = computeProtocolQuality(post);
    expect(q.score).toBe(5);
    expect(q.badge).toBe('verified');
  });

  it('gives mastodon bots no not-bot point', () => {
    const post = makePost('mastodon', {
      raw: { account: { bot: true, created_at: '2020-01-01T00:00:00Z' } },
    });
    expect(computeProtocolQuality(post).reasons).not.toContain('not-bot');
  });

  it('withholds alt-text points when an image lacks a description', () => {
    const post = makePost('mastodon', {
      raw: {
        media_attachments: [
          { type: 'image', url: 'https://x/a.png', description: 'alt' },
          { type: 'image', url: 'https://x/b.png', description: '' },
        ],
        account: { bot: false },
      },
    });
    expect(computeProtocolQuality(post).reasons).not.toContain('alt-text');
  });

  // ── Generic ──────────────────────────────────────────────────────
  it('falls back to generic scoring for other protocols', () => {
    const post = makePost('lemmy' as Protocol, {
      text: 'x'.repeat(150),
      metrics: { replies: 1 },
      author: { followerCount: 10 },
    });
    const q = computeProtocolQuality(post);
    expect(q.score).toBe(3);
    expect(q.maxScore).toBe(3);
  });

  it('normalizes ratio into 0..1 and applies the badge threshold', () => {
    const post = makePost('nostr', { text: 'short', raw: { kind: 7 } });
    const q = computeProtocolQuality(post);
    expect(q.ratio).toBeGreaterThanOrEqual(0);
    expect(q.ratio).toBeLessThanOrEqual(1);
    expect(q.badge).toBe(q.ratio >= QUALITY_BADGE_THRESHOLD ? 'verified' : null);
  });
});

/**
 * @degenfeed/feed-core — Spam detection tests
 *
 * Covers spamScore, spamTier, contentQualityScore, and isSpamPost
 * across a wide range of inputs including edge cases.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { buildUnifiedPost, emptyIdentity } from './index';
import { contentQualityScore, spamScore, spamTier } from './spam';

function makePost(text: string, overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return buildUnifiedPost({
    protocol: 'nostr',
    nativeId: `spam-test-${Math.random().toString(36).slice(2)}`,
    author: emptyIdentity(),
    text,
    createdAt: Date.now(),
    raw: {},
    ...overrides,
  });
}

describe('spamScore', () => {
  it('should return 0 for clean regular text', () => {
    const post = makePost('Bitcoin is the future of decentralized finance');
    const result = spamScore(post);
    expect(result.score).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it('should flag very short text', () => {
    const post = makePost('Hi');
    const result = spamScore(post);
    expect(result.score).toBeGreaterThanOrEqual(0.25);
    expect(result.signals).toContain('too-short');
  });

  it('should flag hex-only content', () => {
    const hex = 'a'.repeat(64);
    const post = makePost(hex);
    const result = spamScore(post);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.signals).toContain('hex-only');
  });

  it('should flag gibberish text', () => {
    const post = makePost('test');
    const result = spamScore(post);
    expect(result.signals).toContain('gibberish');
  });

  it('should flag emoji-only content', () => {
    const post = makePost('🚀🚀🚀🚀🚀');
    const result = spamScore(post);
    expect(result.signals).toContain('emoji-only');
  });

  it('should flag repeated characters', () => {
    const post = makePost('a'.repeat(20));
    const result = spamScore(post);
    expect(result.signals).toContain('repeated-chars');
  });

  it('should flag all-caps content', () => {
    const post = makePost('THIS IS A VERY LOUD POST THAT IS SCREAMING AT EVERYONE');
    const result = spamScore(post);
    expect(result.signals).toContain('all-caps');
  });

  it('should flag classic spam patterns (make money)', () => {
    const post = makePost('Make money fast with this guaranteed profit system!');
    const result = spamScore(post);
    expect(result.signals).toContain('spam-patterns:1');
  });

  it('should flag crypto scam patterns (giveaway)', () => {
    const post = makePost('FREE ETH GIVEAWAY! Send 1 ETH to get 2 ETH back!');
    const result = spamScore(post);
    expect(result.signals).toContain('scam-patterns:2');
  });

  it('should flag excessive URLs', () => {
    const post = makePost(
      'Check https://a.com https://b.com https://c.com https://d.com for more info',
    );
    const result = spamScore(post);
    expect(result.signals).toContain('excessive-urls');
  });

  it('should flag hashtag-heavy content', () => {
    const post = makePost('#crypto #bitcoin #eth #nft #defi #web3 #blockchain #solana #btc #ai');
    const result = spamScore(post);
    expect(result.signals).toContain('hashtag-heavy');
  });

  it('should flag link-only posts with no substantive text', () => {
    const post = makePost('https://example.com/spam-link');
    const result = spamScore(post);
    expect(result.signals).toContain('bare-link');
  });

  it('should flag duplicate content when context is provided', () => {
    const text = 'This is a duplicated post in the feed window';
    const post = makePost(text);
    const dupPost = makePost(text);
    dupPost.id = 'dup-2'; // override to test duplicate detection
    const result = spamScore(post, { recentPosts: [dupPost] });
    expect(result.signals).toContain('duplicate-content:1');
  });

  it('should flag new account with high frequency', () => {
    const post = makePost('Some content');
    const recentAgeMs = 60 * 60 * 1000; // 1 hour old account
    const result = spamScore(post, { accountAgeMs: recentAgeMs, authorPostCount: 10 });
    expect(result.signals).toContain('new-account-high-frequency');
  });

  it('should not flag old accounts with high frequency', () => {
    const post = makePost('Some content');
    const oldAgeMs = 365 * 24 * 60 * 60 * 1000; // 1 year old
    const result = spamScore(post, { accountAgeMs: oldAgeMs, authorPostCount: 10 });
    expect(result.signals).not.toContain('new-account-high-frequency');
  });

  it('should cap score at 1.0', () => {
    const post = makePost('a'.repeat(64));
    const result = spamScore(post, { accountAgeMs: 0, authorPostCount: 100 });
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});

describe('spamTier', () => {
  it('should return "clean" for scores below 0.3', () => {
    const post = makePost(
      'A thoughtful discussion about blockchain technology and its future impact',
    );
    expect(spamTier(post)).toBe('clean');
  });

  it('should return "definite" for clear hex-only content', () => {
    const post = makePost('f'.repeat(64));
    expect(spamTier(post)).toBe('definite');
  });

  it('should return "borderline" for combined spam signals', () => {
    const post = makePost('FREE ETH GIVEAWAY! Make money fast!!! 🚀🚀🚀🚀🚀');
    expect(spamTier(post)).toBe('borderline');
  });

  it('should return "borderline" for moderate signals', () => {
    const post = makePost('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');
    expect(spamTier(post)).toBe('borderline');
  });
});

describe('contentQualityScore', () => {
  it('should return 0.5 for empty/whitespace text', () => {
    expect(contentQualityScore('')).toBe(0.5);
    expect(contentQualityScore('  ')).toBe(0.5);
  });

  it('should return 0.3 for single word under 20 chars', () => {
    expect(contentQualityScore('hello')).toBe(0.3);
  });

  it('should return 0.3 for high emoji ratio (single-word emoji hits word-length check first)', () => {
    expect(contentQualityScore('🚀🚀🚀🚀🚀🚀🚀')).toBe(0.3);
  });

  it('should return 0.3 for high caps ratio', () => {
    expect(contentQualityScore('THIS IS ALL CAPS AND SHOULD BE FLAGGED')).toBe(0.3);
  });

  it('should return 0.4 for hashtag-heavy content', () => {
    const text = '#crypto #bitcoin #eth #nft #defi #web3';
    expect(contentQualityScore(text)).toBe(0.4);
  });

  it('should return 0.4 for bare-link posts (no substantive text)', () => {
    expect(contentQualityScore('https://example.com/article')).toBe(0.4);
  });

  it('should return 1.0 for high-quality text', () => {
    const text =
      'Just published my analysis of the latest Ethereum L2 scaling solutions. ' +
      'Arbitrum and Optimism are seeing significant adoption, while zkSync and StarkNet ' +
      'are pushing the boundaries of zero-knowledge proofs.';
    expect(contentQualityScore(text)).toBe(1.0);
  });
});

import { describe, expect, it } from 'vitest';
import { buildUnifiedPost, emptyIdentity } from './index';
import { contentQualityScore, spamScore, spamTier } from './spam';

function makePost(text: string) {
  return buildUnifiedPost({
    protocol: 'nostr',
    nativeId: `test-${Math.random()}`,
    author: emptyIdentity(),
    text,
    createdAt: Date.now(),
    raw: {},
  });
}

describe('debug', () => {
  it('debug spam', () => {
    const text = 'FREE ETH GIVEAWAY! Make money fast!!! 🚀🚀🚀🚀🚀';
    const post = makePost(text);
    const result = spamScore(post);
    console.log('text:', JSON.stringify(text));
    console.log('score:', result.score);
    console.log('signals:', result.signals);
    console.log('tier:', spamTier(post));
    console.log('cq empty:', contentQualityScore(''));
    console.log('cq spaces:', contentQualityScore('  '));
    expect(result.score).toBeGreaterThan(0);
  });
});

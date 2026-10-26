import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import type { Candidate, ShortCandidate } from './dedup-similarity';
import { isNearDuplicate } from './dedup-similarity';
import type { PostSignals } from './dedup-state';
import { JACCARD_THRESHOLD } from './dedup-thresholds';

/** Frozen fixture: the exact cut-off the algorithm shipped with before the seam. */
const FIXTURE_JACCARD_THRESHOLD = 0.7;

const SHARED = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf'];

function post(text: string): UnifiedPost {
  return { text, protocol: 'rss' } as unknown as UnifiedPost;
}

function signals(words: string[], text: string): PostSignals {
  return { qid: null, words: new Set(words), cleanText: text } as unknown as PostSignals;
}

function candidateAt(words: string[]): Candidate {
  return { words: new Set(words), index: 0 };
}

function run(words: string[]): boolean {
  const text = 'a sufficiently long duplicate candidate body used by the fixture';
  return isNearDuplicate(
    post(text),
    signals(words, text),
    [candidateAt([...SHARED, 'hotel', 'india', 'juliet'])],
    [] as ShortCandidate[],
    [],
  );
}

describe('dedup-similarity threshold seam', () => {
  it('loads the shipped cut-off from the data seam (fixture equality)', () => {
    expect(JACCARD_THRESHOLD).toBe(FIXTURE_JACCARD_THRESHOLD);
  });

  it('keeps behaviour identical at and just below the fixture cut-off', () => {
    // 7 shared / 10 union = 0.70 -> duplicate (>= cut-off)
    expect(run(SHARED)).toBe(true);
    // 7 shared / 11 union ~= 0.636 -> not a duplicate
    expect(run([...SHARED, 'kilo'])).toBe(false);
  });
});

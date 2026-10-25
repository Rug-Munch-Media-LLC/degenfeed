/**
 * @degenfeed/utils — niche classification contract tests
 *
 * `guessNiches` feeds discovery ranking, so the contract that matters is:
 * it never returns an empty list, it matches whole words only, and `extra`
 * context participates in the match.
 */

import { describe, expect, it } from 'vitest';
import { guessNiches } from './niches';

describe('guessNiches', () => {
  it('defaults to social when nothing matches', () => {
    expect(guessNiches('just a regular post')).toEqual(['social']);
    expect(guessNiches('')).toEqual(['social']);
  });

  it('detects crypto vocabulary', () => {
    expect(guessNiches('Bitcoin and blockchain technology')).toContain('crypto');
    expect(guessNiches('a thread about solana')).toContain('crypto');
  });

  it('returns every matching niche in stable registry order', () => {
    expect(guessNiches('crypto dev writing about bitcoin code')).toEqual([
      'crypto',
      'tech',
      'art',
      'writing',
    ]);
  });

  it('matches whole words only — substrings do not trigger a niche', () => {
    // "btc" inside "btdc", "ai" inside "said", "art" inside "start"
    expect(guessNiches('btdc said start')).toEqual(['social']);
  });

  it('uses the optional extra context in the match', () => {
    expect(guessNiches('hello', 'gaming stream')).toContain('gaming');
    expect(guessNiches('hello')).toEqual(['social']);
  });

  it('is case-insensitive', () => {
    expect(guessNiches('BITCOIN')).toEqual(guessNiches('bitcoin'));
  });

  it('never returns duplicates', () => {
    const out = guessNiches('crypto crypto crypto bitcoin blockchain');
    expect(out).toEqual([...new Set(out)]);
  });
});

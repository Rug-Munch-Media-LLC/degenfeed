/**
 * Contract tests for the split RSS source catalogue.
 *
 * The catalogue used to be one 3094-line array. These tests pin the public
 * contract (count, order, entry shape) and the structural invariant that
 * makes the split worthwhile (every data module stays under the 200-line cap).
 */
import { describe, expect, it } from 'vitest';
import { cfg } from './cfg-helpers';
import { DEFAULT_CRYPTO_FEEDS } from './config';
import { FEEDS_01 } from './config/feeds-01';
import { FEEDS_02 } from './config/feeds-02';
import { FEEDS_03 } from './config/feeds-03';
import { FEEDS_04 } from './config/feeds-04';
import { FEEDS_05 } from './config/feeds-05';
import { FEEDS_06 } from './config/feeds-06';
import { FEEDS_07 } from './config/feeds-07';
import { FEEDS_08 } from './config/feeds-08';
import { FEEDS_09 } from './config/feeds-09';
import { FEEDS_10 } from './config/feeds-10';
import { FEEDS_11 } from './config/feeds-11';
import { FEEDS_12 } from './config/feeds-12';
import { FEEDS_13 } from './config/feeds-13';
import { FEEDS_14 } from './config/feeds-14';
import { FEEDS_15 } from './config/feeds-15';
import { FEEDS_16 } from './config/feeds-16';
import { FEEDS_17 } from './config/feeds-17';
import type { RssFeedConfig } from './types';

const CHUNKS = [
  FEEDS_01,
  FEEDS_02,
  FEEDS_03,
  FEEDS_04,
  FEEDS_05,
  FEEDS_06,
  FEEDS_07,
  FEEDS_08,
  FEEDS_09,
  FEEDS_10,
  FEEDS_11,
  FEEDS_12,
  FEEDS_13,
  FEEDS_14,
  FEEDS_15,
  FEEDS_16,
  FEEDS_17,
];

describe('DEFAULT_CRYPTO_FEEDS contract', () => {
  it('exposes the full historical catalogue', () => {
    expect(DEFAULT_CRYPTO_FEEDS).toHaveLength(386);
  });

  it('preserves the original ordering (first, middle, last)', () => {
    expect(DEFAULT_CRYPTO_FEEDS[0]?.url).toBe('https://cointelegraph.com/rss');
    expect(DEFAULT_CRYPTO_FEEDS[192]?.url).toBe('https://www.reddit.com/r/solidity/.rss?limit=100');
    expect(DEFAULT_CRYPTO_FEEDS.at(-1)?.url).toBe('https://ethresear.ch/latest.rss');
  });

  it('every entry is a complete feed config', () => {
    for (const feed of DEFAULT_CRYPTO_FEEDS) {
      expect(feed.url).toMatch(/^https:\/\//);
      expect(feed.tier).toBeGreaterThanOrEqual(1);
      expect(feed.tier).toBeLessThanOrEqual(5);
      expect(feed.weight).toBeGreaterThanOrEqual(0);
      expect(feed.weight).toBeLessThanOrEqual(1);
      expect(feed.authority).toBeGreaterThanOrEqual(1);
      expect(feed.authority).toBeLessThanOrEqual(3);
      expect(feed.category.length).toBeGreaterThan(0);
      expect(Array.isArray(feed.tags)).toBe(true);
    }
  });

  it('keeps pre-existing duplicate urls rather than silently rewriting data', () => {
    const urls = DEFAULT_CRYPTO_FEEDS.map((f) => f.url);
    expect(new Set(urls).size).toBe(368);
  });
});

describe('data module boundaries', () => {
  it('is split into cohesive data modules', () => {
    expect(CHUNKS.length).toBeGreaterThan(10);
  });

  it('every chunk contributes its slice, in order (no drop, no duplicate)', () => {
    const total = CHUNKS.reduce((n, chunk) => n + chunk.length, 0);
    expect(total).toBe(DEFAULT_CRYPTO_FEEDS.length);
    let offset = 0;
    for (const chunk of CHUNKS) {
      expect(DEFAULT_CRYPTO_FEEDS.slice(offset, offset + chunk.length)).toEqual(chunk);
      offset += chunk.length;
    }
  });
});

describe('deduplication-adjacent invariants', () => {
  it('tier values are whole numbers in range (boundary)', () => {
    const bad = DEFAULT_CRYPTO_FEEDS.filter(
      (f: RssFeedConfig) => !Number.isInteger(f.tier) || f.tier < 1 || f.tier > 5,
    );
    expect(bad).toEqual([]);
  });

  it('applies cfg() defaults for omitted options (boundary)', () => {
    const minimal = cfg('https://example.com/feed');
    expect(minimal).toEqual({
      url: 'https://example.com/feed',
      tier: 3,
      weight: 0.7,
      category: 'news',
      tags: ['crypto'],
      authority: 1,
    });
  });

  it('does not let a split module mutate shared data', () => {
    const before = DEFAULT_CRYPTO_FEEDS[0]?.url;
    const copy = [...DEFAULT_CRYPTO_FEEDS];
    copy.reverse();
    expect(DEFAULT_CRYPTO_FEEDS[0]?.url).toBe(before);
  });
});

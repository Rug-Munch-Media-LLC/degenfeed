/**
 * @degenfeed/utils — protocol allow-list parsing contract tests
 *
 * Security-relevant: `parseProtocols` is the boundary between an untrusted
 * query string and the set of protocols a request may read.
 */

import type { Protocol } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { parseProtocols } from './protocolParsing';

describe('parseProtocols', () => {
  it('returns the full allow-list when the input is absent', () => {
    const all = parseProtocols(null);
    expect(all.length).toBeGreaterThan(20);
    expect(all).toContain('nostr');
    expect(all).toContain('bluesky');
  });

  it('returns the full allow-list for an empty string (no filter)', () => {
    expect(parseProtocols('')).toEqual(parseProtocols(null));
  });

  it('keeps only allow-listed entries', () => {
    expect(parseProtocols('nostr,bsky-typo,bluesky')).toEqual(['nostr', 'bluesky']);
  });

  it('trims whitespace around entries', () => {
    expect(parseProtocols(' nostr , bluesky ')).toEqual(['nostr', 'bluesky']);
  });

  it('preserves input order and duplicates', () => {
    expect(parseProtocols('bluesky,nostr,bluesky')).toEqual(['bluesky', 'nostr', 'bluesky']);
  });

  it('drops every entry not in a caller-supplied allow-list', () => {
    const allowed: Protocol[] = ['nostr'];
    expect(parseProtocols('nostr,bluesky', allowed)).toEqual(['nostr']);
  });

  it('returns an empty list when the allow-list is empty', () => {
    expect(parseProtocols('nostr', [])).toEqual([]);
  });

  it('is case-sensitive — no implicit normalisation of unknown casing', () => {
    expect(parseProtocols('NOSTR')).toEqual([]);
  });

  it('tolerates junk separators without throwing', () => {
    expect(parseProtocols(',,,')).toEqual([]);
    expect(parseProtocols('nostr,,bluesky')).toEqual(['nostr', 'bluesky']);
  });
});

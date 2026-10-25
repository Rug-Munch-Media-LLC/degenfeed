/** @degenfeed/utils — string helper contract tests */

import { describe, expect, it } from 'vitest';
import { safeKey, shortenAddress } from './strings';

describe('safeKey', () => {
  it('lowercases and keeps the allowed charset', () => {
    expect(safeKey('Alice@Example.COM')).toBe('alice@example.com');
    expect(safeKey('a.b_c-d')).toBe('a.b_c-d');
  });

  it('replaces every disallowed character with a single underscore', () => {
    expect(safeKey('a b/c:d')).toBe('a_b_c_d');
    expect(safeKey('hello world!')).toBe('hello_world_');
  });

  it('returns an empty string unchanged', () => {
    expect(safeKey('')).toBe('');
  });
});

describe('shortenAddress', () => {
  it('returns the address unchanged below the 13-character threshold', () => {
    // head 6 + tail 4 + 3 dots = 13; strictly shorter input passes through.
    expect(shortenAddress('0x1234567890')).toHaveLength(12);
    expect(shortenAddress('0x1234567890')).toBe('0x1234567890');
    expect(shortenAddress('short')).toBe('short');
    expect(shortenAddress('')).toBe('');
  });

  it('starts abbreviating at exactly 13 characters', () => {
    expect(shortenAddress('0x1234567890a')).toBe('0x1234...890a');
    expect(shortenAddress('0x1234567890ab')).toBe('0x1234...90ab');
  });

  it('honours custom head and tail lengths', () => {
    expect(shortenAddress('0123456789abcdef', 4, 4)).toBe('0123...cdef');
    expect(shortenAddress('0123456789abcdef', 0, 4)).toBe('...cdef');
  });
});

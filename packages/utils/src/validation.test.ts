/** @degenfeed/utils — email shape validation contract tests */

import { describe, expect, it } from 'vitest';
import { isValidEmail } from './validation';

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.example.org')).toBe(true);
  });

  it('rejects structurally invalid addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('two@at@example.com')).toBe(false);
    expect(isValidEmail('nodot@example')).toBe(false);
    expect(isValidEmail('spaces in@example.com')).toBe(false);
  });

  it('rejects a one-character TLD', () => {
    expect(isValidEmail('a@b.c')).toBe(false);
  });

  it('accepts a 254-character address and rejects 255', () => {
    const local = 'a'.repeat(254 - '@example.com'.length);
    expect(`${local}@example.com`).toHaveLength(254);
    expect(isValidEmail(`${local}@example.com`)).toBe(true);
    expect(isValidEmail(`a${local}@example.com`)).toBe(false);
  });
});

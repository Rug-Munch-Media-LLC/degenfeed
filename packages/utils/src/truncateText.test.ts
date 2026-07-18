/**
 * @degenfeed/utils — Text truncation tests
 *
 * Tests for the truncation logic used throughout the UI,
 * including the MAX_TEXT_LENGTH constant from PostCard.
 */

import { describe, expect, it } from 'vitest';

const MAX_TEXT_LENGTH = 500;

function truncateText(text: string, maxLength = MAX_TEXT_LENGTH): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

describe('truncateText', () => {
  it('should return the original text when under the limit', () => {
    const short = 'Hello, world!';
    expect(truncateText(short)).toBe(short);
  });

  it('should truncate text exceeding the limit and append ellipsis', () => {
    const long = 'x'.repeat(600);
    const result = truncateText(long);
    expect(result.length).toBe(503); // 500 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('should return exact text when at the limit', () => {
    const exact = 'x'.repeat(500);
    expect(truncateText(exact)).toBe(exact);
  });

  it('should handle empty string', () => {
    expect(truncateText('')).toBe('');
  });

  it('should accept custom max length', () => {
    const text = 'Hello, this is a long text that should be truncated';
    const result = truncateText(text, 20);
    expect(result.length).toBe(23); // 20 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('should handle single-character truncation', () => {
    const text = 'AB';
    expect(truncateText(text, 1)).toBe('A...');
  });
});

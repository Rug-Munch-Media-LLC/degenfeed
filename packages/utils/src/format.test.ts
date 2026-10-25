/**
 * @degenfeed/utils — formatting contract tests
 *
 * Time is frozen with fake timers so bucket boundaries are asserted exactly
 * rather than against a drifting `Date.now()` (the previous `index.test.ts`
 * behaviour that made this suite flaky).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCount, formatDate, formatDuration, formatTimeAgo, formatTimestamp } from './format';

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();
const SEC = 1_000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatTimeAgo', () => {
  it('renders sub-minute ages as now', () => {
    expect(formatTimeAgo(NOW)).toBe('now');
    expect(formatTimeAgo(NOW - SEC)).toBe('now');
    expect(formatTimeAgo(NOW - 59 * SEC)).toBe('now');
  });

  it('renders the first minute boundary as 1m ago', () => {
    expect(formatTimeAgo(NOW - MIN)).toBe('1m ago');
    expect(formatTimeAgo(NOW - 59 * MIN)).toBe('59m ago');
  });

  it('renders the first hour boundary as 1h ago', () => {
    expect(formatTimeAgo(NOW - HOUR)).toBe('1h ago');
    expect(formatTimeAgo(NOW - 23 * HOUR)).toBe('23h ago');
  });

  it('renders the first day boundary as 1d ago', () => {
    expect(formatTimeAgo(NOW - DAY)).toBe('1d ago');
    expect(formatTimeAgo(NOW - 6 * DAY)).toBe('6d ago');
  });

  it('falls back to a short calendar date at exactly 7 days', () => {
    expect(formatTimeAgo(NOW - 7 * DAY)).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('treats future timestamps as now instead of negative ages', () => {
    expect(formatTimeAgo(NOW + 5 * MIN)).toBe('now');
  });
});

describe('formatCount', () => {
  it('leaves counts below 1000 untouched', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1)).toBe('1');
    expect(formatCount(999)).toBe('999');
  });

  it('switches to K at exactly 1000', () => {
    expect(formatCount(1_000)).toBe('1.0K');
    expect(formatCount(1_500)).toBe('1.5K');
    expect(formatCount(999_999)).toBe('1000.0K');
  });

  it('switches to M at exactly one million', () => {
    expect(formatCount(1_000_000)).toBe('1.0M');
    expect(formatCount(2_450_000)).toBe('2.5M');
  });

  it('renders negative counts as-is', () => {
    expect(formatCount(-5)).toBe('-5');
  });
});

describe('formatDuration', () => {
  it('renders zero and sub-minute durations as M:SS', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(59.9)).toBe('0:59');
  });

  it('renders minutes with zero-padded seconds', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(3_599)).toBe('59:59');
  });

  it('renders hours with zero-padded minutes and seconds', () => {
    expect(formatDuration(3_600)).toBe('1:00:00');
    expect(formatDuration(3_661)).toBe('1:01:01');
    expect(formatDuration(86_399)).toBe('23:59:59');
  });

  it('clamps negative input to 0:00', () => {
    expect(formatDuration(-1)).toBe('0:00');
    expect(formatDuration(-3_600)).toBe('0:00');
  });
});

describe('formatDate', () => {
  it('delegates relative style to formatTimeAgo', () => {
    expect(formatDate(NOW - 5 * MIN, 'relative')).toBe('5m ago');
  });

  it('renders today as a time without a date', () => {
    const out = formatDate(NOW, 'short');
    expect(out).toMatch(/^\d{2}:\d{2}\s?(AM|PM)$/i);
    expect(out).not.toMatch(/\d{4}/);
  });

  it('renders an earlier month in the same year without the year', () => {
    const out = formatDate(new Date('2026-01-05T12:00:00.000Z').getTime(), 'long');
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('includes the year for dates from a previous year', () => {
    const out = formatDate(new Date('2024-03-05T12:00:00.000Z').getTime(), 'long');
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });
});

describe('formatTimestamp', () => {
  it('always includes month, day, hour and minute', () => {
    const out = formatTimestamp(NOW);
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2}\s?(AM|PM)$/i);
  });
});

/**
 * @degenfeed/utils — unit tests
 *
 * Tests for formatTimeAgo, formatCount, stripHtml, isValidEmail,
 * shortenAddress, and other exported pure functions.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ─── formatTimeAgo ───────────────────────────────────────────────────
describe('formatTimeAgo', () => {
  let now: number;

  beforeAll(() => {
    now = Date.now();
  });

  afterAll(() => {
    // no-op
  });

  it('should return "now" for timestamps less than 1 minute ago', async () => {
    const { formatTimeAgo } = await import('./index');
    expect(formatTimeAgo(now - 10_000)).toBe('now');
    expect(formatTimeAgo(now - 59_000)).toBe('now');
    expect(formatTimeAgo(now - 1_000)).toBe('now');
    expect(formatTimeAgo(now)).toBe('now');
  });

  it('should display minutes for timestamps 1–59 minutes ago', async () => {
    const { formatTimeAgo } = await import('./index');
    expect(formatTimeAgo(now - 60_000)).toBe('1m ago');
    expect(formatTimeAgo(now - 30 * 60_000)).toBe('30m ago');
    expect(formatTimeAgo(now - 59 * 60_000)).toBe('59m ago');
  });

  it('should display hours for timestamps 1–23 hours ago', async () => {
    const { formatTimeAgo } = await import('./index');
    expect(formatTimeAgo(now - 60 * 60_000)).toBe('1h ago');
    expect(formatTimeAgo(now - 6 * 60 * 60_000)).toBe('6h ago');
    expect(formatTimeAgo(now - 23 * 60 * 60_000)).toBe('23h ago');
  });

  it('should display days for timestamps 1–6 days ago', async () => {
    const { formatTimeAgo } = await import('./index');
    expect(formatTimeAgo(now - 24 * 60 * 60_000)).toBe('1d ago');
    expect(formatTimeAgo(now - 3 * 24 * 60 * 60_000)).toBe('3d ago');
    expect(formatTimeAgo(now - 6 * 24 * 60 * 60_000)).toBe('6d ago');
  });

  it('should return a formatted date for timestamps 7+ days ago', async () => {
    const { formatTimeAgo } = await import('./index');
    const sevenDaysAgo = now - 7 * 24 * 60 * 60_000;
    const result = formatTimeAgo(sevenDaysAgo);
    expect(result).not.toBe('now');
    expect(result).not.toMatch(/^\d+[mhd] ago$/);
    expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}$/);
  });

  it('should return a date for timestamps in the far past', async () => {
    const { formatTimeAgo } = await import('./index');
    const farPast = new Date('2024-01-15T00:00:00Z').getTime();
    const result = formatTimeAgo(farPast);
    expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}$/);
  });

  it('should handle future timestamps gracefully (negative diff)', async () => {
    const { formatTimeAgo } = await import('./index');
    const future = now + 60_000;
    const result = formatTimeAgo(future);
    expect(result).toBe('now');
  });

  it('should handle epoch-zero timestamp (Jan 1 1970)', async () => {
    const { formatTimeAgo } = await import('./index');
    const result = formatTimeAgo(0);
    expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}$/);
  });

  it('should handle NaN gracefully without crashing', async () => {
    const { formatTimeAgo } = await import('./index');
    const result = formatTimeAgo(Number.NaN);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── formatCount ─────────────────────────────────────────────────────
describe('formatCount', () => {
  it('should format numbers less than 1000 as-is', async () => {
    const { formatCount } = await import('./index');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(42)).toBe('42');
    expect(formatCount(999)).toBe('999');
  });

  it('should format thousands with K suffix', async () => {
    const { formatCount } = await import('./index');
    expect(formatCount(1_000)).toBe('1.0K');
    expect(formatCount(1_500)).toBe('1.5K');
    expect(formatCount(10_000)).toBe('10.0K');
    expect(formatCount(999_999)).toBe('1000.0K'); // debatable but consistent
  });

  it('should format millions with M suffix', async () => {
    const { formatCount } = await import('./index');
    expect(formatCount(1_000_000)).toBe('1.0M');
    expect(formatCount(2_500_000)).toBe('2.5M');
    expect(formatCount(100_000_000)).toBe('100.0M');
  });
});

// ─── stripHtml ───────────────────────────────────────────────────────
describe('stripHtml', () => {
  it('should remove HTML tags', async () => {
    const { stripHtml } = await import('./index');
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    expect(stripHtml('<div><span>nested</span></div>')).toBe('nested');
  });

  it('should replace <br> tags with newlines', async () => {
    const { stripHtml } = await import('./index');
    // The function collapses all whitespace (including the \n from <br>) into a single space
    expect(stripHtml('line1<br>line2')).toBe('line1 line2');
    expect(stripHtml('line1<br/>line2')).toBe('line1 line2');
    expect(stripHtml('line1<br />line2')).toBe('line1 line2');
  });

  it('should decode common HTML entities', async () => {
    const { stripHtml } = await import('./index');
    expect(stripHtml('&amp;')).toBe('&');
    expect(stripHtml('&lt;hello&gt;')).toBe('<hello>');
    expect(stripHtml('&quot;quoted&quot;')).toBe('"quoted"');
  });

  it('should return empty string for falsy input', async () => {
    const { stripHtml } = await import('./index');
    expect(stripHtml('')).toBe('');
    // @ts-expect-error — testing runtime resilience with nullish input
    expect(stripHtml(null)).toBe('');
    // @ts-expect-error — testing runtime resilience with undefined input
    expect(stripHtml(undefined)).toBe('');
  });

  it('should trim whitespace and collapse multiple spaces', async () => {
    const { stripHtml } = await import('./index');
    const input = '  <p>Hello   world</p>  ';
    expect(stripHtml(input)).toBe('Hello world');
  });
});

// ─── decodeXmlEntities ───────────────────────────────────────────────
describe('decodeXmlEntities', () => {
  it('should decode named entities', async () => {
    const { decodeXmlEntities } = await import('./index');
    expect(decodeXmlEntities('&amp;lt;')).toBe('&lt;');
  });

  it('should decode numeric entities', async () => {
    const { decodeXmlEntities } = await import('./index');
    expect(decodeXmlEntities('&#65;')).toBe('A');
    expect(decodeXmlEntities('&#x41;')).toBe('A');
  });

  it('should unwrap CDATA sections', async () => {
    const { decodeXmlEntities } = await import('./index');
    expect(decodeXmlEntities('<![CDATA[hello]]>')).toBe('hello');
  });
});

// ─── isValidEmail ────────────────────────────────────────────────────
describe('isValidEmail', () => {
  it('should accept valid email addresses', async () => {
    const { isValidEmail } = await import('./index');
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a.b@c.co')).toBe(true);
    expect(isValidEmail('test+label@domain.org')).toBe(true);
  });

  it('should reject invalid email addresses', async () => {
    const { isValidEmail } = await import('./index');
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should reject strings exceeding 254 chars', async () => {
    const { isValidEmail } = await import('./index');
    const long = `${'a'.repeat(250)}@b.co`;
    expect(long.length).toBeGreaterThan(254);
    expect(isValidEmail(long)).toBe(false);
  });
});

// ─── shortenAddress ──────────────────────────────────────────────────
describe('shortenAddress', () => {
  it('should shorten an Ethereum address with default head/tail', async () => {
    const { shortenAddress } = await import('./index');
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    const short = shortenAddress(addr);
    expect(short).toBe('0x1234...5678');
    expect(short.length).toBeLessThan(addr.length);
  });

  it('should return the original string when it is too short to shorten', async () => {
    const { shortenAddress } = await import('./index');
    expect(shortenAddress('0x1234', 6, 4)).toBe('0x1234');
  });

  it('should accept custom head/tail lengths', async () => {
    const { shortenAddress } = await import('./index');
    const addr = '0x1234567890abcdef';
    expect(shortenAddress(addr, 4, 3)).toBe('0x12...def');
  });
});

// ─── parseProtocols ──────────────────────────────────────────────────
describe('parseProtocols', () => {
  it('should return default protocols for null input', async () => {
    const { parseProtocols } = await import('./index');
    const result = parseProtocols(null);
    expect(result).toContain('nostr');
    expect(result).toContain('farcaster');
    expect(result).toContain('ethereum');
    expect(result).toContain('solana');
  });

  it('should parse comma-separated protocol string', async () => {
    const { parseProtocols } = await import('./index');
    const result = parseProtocols('nostr,farcaster');
    expect(result).toEqual(['nostr', 'farcaster']);
  });

  it('should filter out invalid protocol names', async () => {
    const { parseProtocols } = await import('./index');
    const result = parseProtocols('nostr,invalid,bluesky');
    expect(result).toEqual(['nostr', 'bluesky']);
  });

  it('should respect allowed list', async () => {
    const { parseProtocols } = await import('./index');
    const result = parseProtocols('nostr,farcaster,lens', ['nostr']);
    expect(result).toEqual(['nostr']);
  });
});

// ─── buildUrl ─────────────────────────────────────────────────────────
describe('buildUrl', () => {
  it('should build a URL with query parameters', async () => {
    const { buildUrl } = await import('./index');
    const url = buildUrl('https://example.com', '/api/feed', {
      limit: '50',
      protocol: 'nostr',
    });
    expect(url).toBe('https://example.com/api/feed?limit=50&protocol=nostr');
  });

  it('should skip undefined parameters', async () => {
    const { buildUrl } = await import('./index');
    const url = buildUrl('https://example.com', '/path', {
      keep: 'yes',
      skip: undefined,
    });
    expect(url).toBe('https://example.com/path?keep=yes');
    expect(url).not.toContain('skip');
  });

  it('should handle paths with leading slash', async () => {
    const { buildUrl } = await import('./index');
    const url = buildUrl('https://example.com', 'relative/path');
    expect(url).toBe('https://example.com/relative/path');
  });
});

// ─── safeKey ──────────────────────────────────────────────────────────
describe('safeKey', () => {
  it('should lowercase and replace special chars', async () => {
    const { safeKey } = await import('./index');
    expect(safeKey('Hello World!')).toBe('hello_world_');
    expect(safeKey('User@Domain.Example')).toBe('user@domain.example');
    expect(safeKey('ABC-123_def')).toBe('abc-123_def');
  });
});

// ─── getProtocolColor / getProtocolEmoji ──────────────────────────────
describe('protocol display helpers', () => {
  it('should return known color for known protocols', async () => {
    const { getProtocolColor } = await import('./index');
    expect(getProtocolColor('nostr')).toBe('#8e30eb');
    expect(getProtocolColor('bluesky')).toBe('#1185fe');
    expect(getProtocolColor('solana')).toBe('#9945ff');
  });

  it('should return fallback color for unknown protocols', async () => {
    const { getProtocolColor } = await import('./index');
    expect(getProtocolColor('unknown')).toBe('#666');
  });

  it('should return emoji for known protocols', async () => {
    const { getProtocolEmoji } = await import('./index');
    expect(getProtocolEmoji('nostr')).toBe('⚡');
    expect(getProtocolEmoji('farcaster')).toBe('🟣');
  });

  it('should return fallback emoji for unknown protocols', async () => {
    const { getProtocolEmoji } = await import('./index');
    expect(getProtocolEmoji('unknown')).toBe('●');
  });
});

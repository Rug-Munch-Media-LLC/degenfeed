import { describe, expect, it } from 'vitest';

import { sanitizePrefs } from '../routes/preferences';

describe('sanitizePrefs', () => {
  it('applies sensible defaults when given empty body', () => {
    const out = sanitizePrefs({});
    expect(out.hideLowQuality).toBe(false);
    expect(out.diversityBoost).toBe(true);
    expect(out.preferredNiches).toEqual([]);
    expect(out.preferredPlatforms).toEqual([]);
    expect(out.mutedNiches).toEqual([]);
    expect(out.recencyWeight).toBe(1);
    expect(out.engagementWeight).toBe(1);
    expect(out.updatedAt).toBeGreaterThan(0);
  });

  it('lowercases niches and drops empty strings', () => {
    const out = sanitizePrefs({
      preferredNiches: ['Bitcoin', 'ETHEREUM', '', '  ', 'defi'],
      mutedNiches: ['ScamCoin'],
    });
    expect(out.preferredNiches).toEqual(['bitcoin', 'ethereum', 'defi']);
    expect(out.mutedNiches).toEqual(['scamcoin']);
  });

  it('clamps out-of-range weights to [0.1, 5]', () => {
    const out = sanitizePrefs({ recencyWeight: 99, engagementWeight: -2 });
    expect(out.recencyWeight).toBe(5);
    expect(out.engagementWeight).toBe(0.1);
  });

  it('falls back to defaults for non-numeric weights', () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input shape
    const out = sanitizePrefs({ recencyWeight: 'foo', engagementWeight: NaN } as any);
    expect(out.recencyWeight).toBe(1);
    expect(out.engagementWeight).toBe(1);
  });

  it('preserves hideLowQuality boolean', () => {
    expect(sanitizePrefs({ hideLowQuality: true }).hideLowQuality).toBe(true);
    expect(sanitizePrefs({ hideLowQuality: false }).hideLowQuality).toBe(false);
  });

  it('filters non-string platforms', () => {
    const out = sanitizePrefs({
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
      preferredPlatforms: ['nostr', 42, null, 'bluesky'] as any,
    });
    expect(out.preferredPlatforms).toEqual(['nostr', 'bluesky']);
  });
});

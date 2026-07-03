import { describe, expect, it } from 'vitest';

describe('@degenfeed/ranking', () => {
  it('should export constants and functions', async () => {
    const mod = await import('./index');
    expect(mod.WEIGHTS).toBeDefined();
    expect(typeof mod.score).toBe('function');
    expect(typeof mod.rank).toBe('function');
    expect(typeof mod.recencyDecay).toBe('function');
  });

  it('should have correct weight defaults', async () => {
    const { WEIGHTS } = await import('./index');
    expect(WEIGHTS.w1).toBe(1.0);
    expect(WEIGHTS.w2).toBe(1.5);
    expect(WEIGHTS.w6).toBe(3.0);
  });

  it('should calculate recency decay', async () => {
    const { recencyDecay } = await import('./index');
    // At age = halfLife, decay should be 0.5
    const now = Date.now();
    const halfLifeHours = 12;
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
    expect(recencyDecay(twelveHoursAgo, now, halfLifeHours)).toBeCloseTo(0.5, 1);
  });

  it('should return empty array for empty rank input', async () => {
    const { rank } = await import('./index');
    const ctx = {
      viewer: null,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      viewerNiches: new Set<string>(),
      followed: new Set<string>(),
      now: Date.now(),
    };
    expect(rank([], ctx)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyEarnMultipliers,
  applyEvent,
  computeDailyTotals,
  computeLevel,
  createDefaultScore,
  defaultMultipliers,
  EARN_RULES,
  LOSE_RULES,
  nextLevelThreshold,
  resolveStake,
  stakeOnPost,
  TIER_BENEFITS,
  TIER_LABELS,
  TIER_THRESHOLDS,
  wouldExceedDailyCap,
} from '../index';

describe('Reputation Constants', () => {
  it('defines all expected tier thresholds', () => {
    expect(TIER_THRESHOLDS).toEqual({
      newcomer: 0,
      contributor: 50,
      active: 200,
      trusted: 500,
      veteran: 1000,
      elite: 2500,
      legend: 5000,
    });
  });

  it('defines earn rules with positive base amounts and daily caps', () => {
    expect(EARN_RULES).toHaveLength(5);
    for (const rule of EARN_RULES) {
      expect(rule.baseAmount).toBeGreaterThan(0);
      expect(rule.dailyCap).toBeGreaterThan(0);
      expect(rule.kind).toMatch(/^earn:/);
    }
  });

  it('defines lose rules with negative or zero base amounts', () => {
    expect(LOSE_RULES['slash:spam'].baseAmount).toBe(-25);
    expect(LOSE_RULES['slash:report'].baseAmount).toBe(-10);
    expect(LOSE_RULES['slash:ban'].baseAmount).toBe(0);
  });

  it('has tier labels with icons for all tiers', () => {
    const tiers = Object.keys(TIER_THRESHOLDS);
    expect(tiers).toHaveLength(7);
    for (const tier of tiers) {
      expect(TIER_LABELS[tier]).toBeDefined();
      expect(TIER_LABELS[tier].icon).toBeTruthy();
      expect(TIER_LABELS[tier].label).toBeTruthy();
      expect(TIER_LABELS[tier].minRep).toBeGreaterThanOrEqual(0);
    }
  });

  it('has tier benefits for all tiers', () => {
    const tiers = Object.keys(TIER_THRESHOLDS);
    for (const tier of tiers) {
      expect(TIER_BENEFITS[tier]).toBeDefined();
      expect(typeof TIER_BENEFITS[tier].enhancedDiscovery).toBe('boolean');
    }
  });

  it('only legend tier has all benefits enabled', () => {
    expect(TIER_BENEFITS.legend).toEqual({
      enhancedDiscovery: true,
      customFeed: true,
      badgeDisplay: true,
      prioritySupport: true,
      analyticsAccess: true,
    });
  });
});

describe('computeLevel', () => {
  it('returns "newcomer" for total 0', () => {
    expect(computeLevel(0)).toBe('newcomer');
  });

  it('returns "contributor" for total 50', () => {
    expect(computeLevel(50)).toBe('contributor');
  });

  it('returns "active" for total 200', () => {
    expect(computeLevel(200)).toBe('active');
  });

  it('returns "trusted" for total 500', () => {
    expect(computeLevel(500)).toBe('trusted');
  });

  it('returns "veteran" for total 1000', () => {
    expect(computeLevel(1000)).toBe('veteran');
  });

  it('returns "elite" for total 2500', () => {
    expect(computeLevel(2500)).toBe('elite');
  });

  it('returns "legend" for total 5000 and above', () => {
    expect(computeLevel(5000)).toBe('legend');
    expect(computeLevel(10000)).toBe('legend');
  });

  it('returns "contributor" for a value between thresholds', () => {
    expect(computeLevel(75)).toBe('contributor');
    expect(computeLevel(150)).toBe('contributor');
  });

  it('handles negative totals gracefully', () => {
    expect(computeLevel(-10)).toBe('newcomer');
  });
});

describe('createDefaultScore', () => {
  it('creates a score with zeroed fields for a given userId', () => {
    const score = createDefaultScore('user-abc');
    expect(score.userId).toBe('user-abc');
    expect(score.total).toBe(0);
    expect(score.earned).toBe(0);
    expect(score.staked).toBe(0);
    expect(score.slashed).toBe(0);
    expect(score.level).toBe('newcomer');
  });

  it('copies default multipliers', () => {
    const score = createDefaultScore('user-xyz');
    expect(score.multipliers.base).toBe(1.0);
    expect(score.multipliers.crossProtocolBonus).toBe(1.2);
    expect(score.multipliers).not.toBe(defaultMultipliers);
  });
});

describe('nextLevelThreshold', () => {
  it('computes progress from newcomer to contributor', () => {
    const result = nextLevelThreshold('newcomer', 25);
    expect(result.current).toBe('newcomer');
    expect(result.next).toBe('contributor');
    expect(result.currentMin).toBe(0);
    expect(result.nextMin).toBe(50);
    expect(result.progress).toBe(50);
  });

  it('returns 100% progress at max tier', () => {
    const result = nextLevelThreshold('legend', 5000);
    expect(result.current).toBe('legend');
    expect(result.next).toBe('legend');
    expect(result.progress).toBe(100);
  });

  it('returns 0% progress at the very start', () => {
    const result = nextLevelThreshold('newcomer', 0);
    expect(result.progress).toBe(0);
  });
});

describe('applyEarnMultipliers', () => {
  it('applies single multiplier correctly', () => {
    const result = applyEarnMultipliers(100, 'earn:post', { base: 2.0 });
    expect(result).toBe(200);
  });

  it('compounds multiple multipliers', () => {
    const result = applyEarnMultipliers(100, 'earn:post', {
      base: 1.5,
      contentQuality: 2.0,
    });
    expect(result).toBe(300);
  });

  it('returns base amount with no multipliers', () => {
    const result = applyEarnMultipliers(50, 'earn:like', {});
    expect(result).toBe(50);
  });

  it('rounds to nearest integer', () => {
    const result = applyEarnMultipliers(10, 'earn:tip', { base: 1.33 });
    expect(result).toBe(13);
  });
});

describe('applyEvent', () => {
  it('adds positive amount to total and earned', () => {
    const score = createDefaultScore('user-1');
    const { score: updated, event } = applyEvent(score, 'earn:post', 60);

    expect(updated.total).toBe(60);
    expect(updated.earned).toBe(60);
    expect(updated.level).toBe('contributor');
    expect(event.kind).toBe('earn:post');
    expect(event.amount).toBe(60);
    expect(event.total).toBe(60);
  });

  it('adds negative amount to slashed', () => {
    const score = createDefaultScore('user-1');
    score.total = 100;
    const { score: updated } = applyEvent(score, 'slash:spam', -25);

    expect(updated.total).toBe(75);
    expect(updated.slashed).toBe(25);
    expect(updated.earned).toBe(0);
  });

  it('never lets total go below 0', () => {
    const score = createDefaultScore('user-1');
    const { score: updated } = applyEvent(score, 'slash:spam', -100);

    expect(updated.total).toBe(0);
  });

  it('generates a unique event id', () => {
    const score = createDefaultScore('user-1');
    const { event: e1 } = applyEvent(score, 'earn:like', 5);
    const { event: e2 } = applyEvent(score, 'earn:like', 5);

    expect(e1.id).not.toBe(e2.id);
    expect(e1.id).toContain('earn:like');
  });

  it('attaches ref and reason when provided', () => {
    const score = createDefaultScore('user-1');
    const { event } = applyEvent(score, 'earn:post', 10, 'post-123', 'Great content');

    expect(event.ref).toBe('post-123');
    expect(event.reason).toBe('Great content');
  });
});

describe('computeDailyTotals', () => {
  it('returns empty map for empty history', () => {
    const totals = computeDailyTotals([]);
    expect(totals.size).toBe(0);
  });

  it('only includes events from today', () => {
    const yesterday = Date.now() - 86400000;
    const history = [
      { id: '1', kind: 'earn:post', amount: 10, total: 10, timestamp: yesterday },
      { id: '2', kind: 'earn:post', amount: 10, total: 20, timestamp: Date.now() },
    ] as any;

    const totals = computeDailyTotals(history);
    expect(totals.get('earn:post')).toBe(10);
  });

  it('aggregates same kind events within today', () => {
    const now = Date.now();
    const history = [
      { id: '1', kind: 'earn:like', amount: 2, total: 2, timestamp: now - 1000 },
      { id: '2', kind: 'earn:like', amount: 3, total: 5, timestamp: now - 500 },
      { id: '3', kind: 'earn:post', amount: 10, total: 15, timestamp: now },
    ] as any;

    const totals = computeDailyTotals(history);
    expect(totals.get('earn:like')).toBe(5);
    expect(totals.get('earn:post')).toBe(10);
  });
});

describe('wouldExceedDailyCap', () => {
  it('returns false when kind has no rule', () => {
    const totals = new Map<string, number>();
    const result = wouldExceedDailyCap('slash:spam' as any, 10, totals);
    expect(result).toBe(false);
  });

  it('returns true when adding would exceed cap', () => {
    const totals = new Map<string, number>([['earn:post', 45]]);
    const result = wouldExceedDailyCap('earn:post', 10, totals);
    expect(result).toBe(true);
  });

  it('returns false when within cap', () => {
    const totals = new Map<string, number>([['earn:post', 30]]);
    const result = wouldExceedDailyCap('earn:post', 10, totals);
    expect(result).toBe(false);
  });
});

describe('stakeOnPost', () => {
  it('returns error for non-positive amount', () => {
    const score = createDefaultScore('user-1');
    score.earned = 100;
    const result = stakeOnPost(score, 'post-1', 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('positive');
  });

  it('returns error when stake exceeds earned', () => {
    const score = createDefaultScore('user-1');
    score.earned = 10;
    const result = stakeOnPost(score, 'post-1', 20);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Insufficient');
  });

  it('creates an active stake on success', () => {
    const score = createDefaultScore('user-1');
    score.earned = 100;
    const result = stakeOnPost(score, 'post-1', 30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stake.postId).toBe('post-1');
      expect(result.stake.amount).toBe(30);
      expect(result.stake.status).toBe('active');
    }
  });
});

describe('resolveStake', () => {
  it('returns stake amount on "return"', () => {
    const stake = {
      postId: 'post-1',
      amount: 50,
      status: 'active' as const,
      createdAt: Date.now(),
    };
    const { stake: resolved, delta } = resolveStake(stake, 'return');
    expect(resolved.status).toBe('returned');
    expect(delta).toBe(50);
  });

  it('returns stake plus bonus on "return-bonus"', () => {
    const stake = {
      postId: 'post-1',
      amount: 100,
      status: 'active' as const,
      createdAt: Date.now(),
    };
    const { stake: resolved, delta } = resolveStake(stake, 'return-bonus', 10);
    expect(resolved.status).toBe('returned');
    expect(resolved.bonus).toBe(20);
    expect(delta).toBe(120);
  });

  it('returns no delta on "slash"', () => {
    const stake = {
      postId: 'post-1',
      amount: 50,
      status: 'active' as const,
      createdAt: Date.now(),
    };
    const { stake: resolved, delta } = resolveStake(stake, 'slash');
    expect(resolved.status).toBe('slashed');
    expect(delta).toBe(0);
  });
});

/**
 * @degenfeed/creator-coin — Token Creation & Fee Tests
 *
 * Tests fee calculation, fee split logic, deployment costs, creator controls,
 * token configuration, and validation.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateFeeSplit,
  calculateFeeSplitFromConfig,
  calculateNetProceeds,
  DEFAULT_FEES,
  formatFee,
  getDeploymentCost,
  getFeeSummary,
  getFeeSummaryFromConfig,
  TOKEN_GENERATION_FEE,
} from '../index';
import { createFeeConfig } from '../types';
import type { FeeConfig, FeeStructure } from '../types';

// ─── Fee Split (Legacy FeeStructure) ──────────────────────────────────────

describe('Token Fees: calculateFeeSplit (legacy)', () => {
  it('splits fees into platform, creator, and referral components', () => {
    const amount = 1_000_000_000_000_000_000n; // 1e18 wei
    const split = calculateFeeSplit(amount, DEFAULT_FEES);
    expect(split.platformFee).toBeGreaterThan(0n);
    expect(split.creatorFee).toBeGreaterThan(0n);
    expect(split.referralFee).toBe(0n); // no referrer by default
    expect(split.total).toBe(split.platformFee + split.creatorFee + split.referralFee);
  });

  it('includes referral fee when hasReferrer is true', () => {
    const amount = 1_000_000_000_000_000_000n;
    const withoutReferrer = calculateFeeSplit(amount, DEFAULT_FEES, false);
    const withReferrer = calculateFeeSplit(amount, DEFAULT_FEES, true);
    expect(withReferrer.referralFee).toBeGreaterThan(withoutReferrer.referralFee);
    expect(withReferrer.total).toBeGreaterThan(withoutReferrer.total);
  });

  it('platform fee is 50 bps (0.5%) of amount', () => {
    const amount = 1_000_000_000_000_000_000n;
    const split = calculateFeeSplit(amount, DEFAULT_FEES);
    expect(split.platformFee).toBe((amount * 50n) / 10_000n);
  });

  it('creator fee is 100 bps (1%) of amount by default', () => {
    const amount = 1_000_000_000_000_000_000n;
    const split = calculateFeeSplit(amount, DEFAULT_FEES);
    expect(split.creatorFee).toBe((amount * 100n) / 10_000n);
  });

  it('total = platform + creator + referral', () => {
    const amount = 1_000_000_000_000_000_000n;
    const split = calculateFeeSplit(amount, DEFAULT_FEES, true);
    expect(split.total).toBe(split.platformFee + split.creatorFee + split.referralFee);
  });

  it('throws when total exceeds maxTotalFeeBps', () => {
    const overLimitFees: FeeStructure = {
      platformFeeBps: 300,
      creatorFeeBps: 400,
      referralFeeBps: 5,
      maxTotalFeeBps: 500,
    };
    const amount = 1_000_000n;
    expect(() => calculateFeeSplit(amount, overLimitFees)).toThrow('Total fees exceed max');
  });
});

// ─── Fee Split (FeeConfig) ────────────────────────────────────────────────

describe('Token Fees: calculateFeeSplitFromConfig', () => {
  const defaultFeeConfig = createFeeConfig();

  it('splits fees using FeeConfig with platform and creator components', () => {
    const amount = 1_000_000_000_000_000_000n;
    const result = calculateFeeSplitFromConfig(amount, defaultFeeConfig);
    expect(result.platformFee).toBeGreaterThan(0n);
    expect(result.creatorFee).toBeGreaterThan(0n);
    expect(result.total).toBe(result.platformFee + result.creatorFee + result.referralFee);
  });

  it('returns referralFee > 0 when hasReferrer is true', () => {
    const amount = 1_000_000_000_000_000_000n;
    const withReferrer = calculateFeeSplitFromConfig(amount, defaultFeeConfig, true);
    expect(withReferrer.referralFee).toBe((amount * 5n) / 10_000n);
  });

  it('returns creatorRecipient when feeRecipient is creator', () => {
    const config = createFeeConfig({ feeRecipient: 'creator', feeWallet: '0xabc' });
    const result = calculateFeeSplitFromConfig(1_000_000n, config);
    expect(result.creatorRecipient).toBe('0xabc');
  });

  it('returns null creatorRecipient when feeRecipient is dao_treasury', () => {
    const config = createFeeConfig({ feeRecipient: 'dao_treasury' });
    const result = calculateFeeSplitFromConfig(1_000_000n, config);
    expect(result.creatorRecipient).toBeNull();
  });

  it('includes platformRecipient as empty string when env not set', () => {
    const result = calculateFeeSplitFromConfig(1_000_000n, defaultFeeConfig);
    expect(result.platformRecipient).toBe('');
  });
});

// ─── Net Proceeds ─────────────────────────────────────────────────────────

describe('Token Fees: calculateNetProceeds', () => {
  it('returns gross minus total fee', () => {
    const gross = 1_000_000_000_000_000_000n;
    const feeSplit = { total: 50_000_000_000_000_000n };
    expect(calculateNetProceeds(gross, feeSplit)).toBe(gross - feeSplit.total);
  });

  it('returns gross when fees are zero', () => {
    const gross = 1_000_000_000_000_000_000n;
    expect(calculateNetProceeds(gross, { total: 0n })).toBe(gross);
  });
});

// ─── Format Fee ───────────────────────────────────────────────────────────

describe('Token Fees: formatFee', () => {
  it('formats 50 bps as 0.50%', () => {
    expect(formatFee(50)).toBe('0.50%');
  });

  it('formats 100 bps as 1.00%', () => {
    expect(formatFee(100)).toBe('1.00%');
  });

  it('formats 1000 bps as 10.00%', () => {
    expect(formatFee(1000)).toBe('10.00%');
  });

  it('formats 0 bps as 0.00%', () => {
    expect(formatFee(0)).toBe('0.00%');
  });

  it('formats 500 bps as 5.00%', () => {
    expect(formatFee(500)).toBe('5.00%');
  });
});

// ─── Fee Summary ──────────────────────────────────────────────────────────

describe('Token Fees: getFeeSummary', () => {
  it('returns 4 lines of fee breakdown', () => {
    const summary = getFeeSummary(DEFAULT_FEES);
    expect(summary).toHaveLength(4);
    expect(summary[0]).toContain('Platform fee');
    expect(summary[1]).toContain('Creator fee');
    expect(summary[2]).toContain('Referral fee');
    expect(summary[3]).toContain('Max total');
  });

  it('uses default fees when not provided', () => {
    const summary = getFeeSummary();
    expect(summary).toHaveLength(4);
  });
});

// ─── Fee Summary From Config ──────────────────────────────────────────────

describe('Token Fees: getFeeSummaryFromConfig', () => {
  it('returns platform, creator, and total fee lines', () => {
    const config = createFeeConfig();
    const summary = getFeeSummaryFromConfig(config);
    expect(summary.length).toBeGreaterThanOrEqual(3);
    expect(summary.some((l) => l.includes('Platform fee'))).toBe(true);
    expect(summary.some((l) => l.includes('Creator fee'))).toBe(true);
    expect(summary.some((l) => l.includes('Total fee'))).toBe(true);
  });

  it('includes DAO changeable info', () => {
    const config = createFeeConfig({ daoChangeable: true });
    const summary = getFeeSummaryFromConfig(config);
    expect(summary.some((l) => l.includes('DAO changeable'))).toBe(true);
    expect(summary.some((l) => l.includes('Yes'))).toBe(true);
  });

  it('includes change threshold when daoChangeable is true', () => {
    const config = createFeeConfig({ daoChangeable: true, feeChangeThresholdBps: 5000 });
    const summary = getFeeSummaryFromConfig(config);
    expect(summary.some((l) => l.includes('vote'))).toBe(true);
  });
});

// ─── Deployment Cost ──────────────────────────────────────────────────────

describe('Token Fees: getDeploymentCost', () => {
  it('returns costs for solana chain', () => {
    const cost = getDeploymentCost('solana');
    expect(cost.tokenGeneration.currency).toBe('USD');
    expect(cost.tokenGeneration.amount).toBe(TOKEN_GENERATION_FEE.usd);
    expect(cost.gas.currency).toBe('SOL');
    expect(cost.gas.amount).toBe(TOKEN_GENERATION_FEE.sol);
    expect(cost.total.currency).toBe('USD');
    expect(cost.total.amount).toBeGreaterThan(0);
  });

  it('returns costs for base/ethereum chain', () => {
    const cost = getDeploymentCost('base');
    expect(cost.gas.currency).toBe('ETH');
    expect(cost.gas.amount).toBe(TOKEN_GENERATION_FEE.eth);
  });

  it('returns costs for polygon chain', () => {
    const cost = getDeploymentCost('polygon');
    expect(cost.gas.currency).toBe('MATIC');
    expect(cost.gas.amount).toBe(TOKEN_GENERATION_FEE.matic);
  });

  it('returns default costs for unknown chain', () => {
    const cost = getDeploymentCost('unknown-chain');
    expect(cost.gas.currency).toBe('ETH');
    expect(cost.gas.amount).toBe(0.001);
  });
});

// ─── TOKEN_GENERATION_FEE ─────────────────────────────────────────────────

describe('Token Generation Fee Constants', () => {
  it('is $20 USD', () => {
    expect(TOKEN_GENERATION_FEE.usd).toBe(20);
  });

  it('has gas fee estimates for each chain', () => {
    expect(TOKEN_GENERATION_FEE.sol).toBeGreaterThan(0);
    expect(TOKEN_GENERATION_FEE.eth).toBeGreaterThan(0);
    expect(TOKEN_GENERATION_FEE.matic).toBeGreaterThan(0);
  });
});

// ─── createFeeConfig ──────────────────────────────────────────────────────

describe('Token Config: createFeeConfig', () => {
  it('creates a default FeeConfig with 1% creator fee', () => {
    const config = createFeeConfig();
    expect(config.platformFeeBps).toBe(50);
    expect(config.creatorFeeBps).toBe(100);
    expect(config.totalFeeBps).toBe(150);
    expect(config.feeRecipient).toBe('creator');
    expect(config.daoChangeable).toBe(true);
  });

  it('overrides creatorFeeBps', () => {
    const config = createFeeConfig({ creatorFeeBps: 250 });
    expect(config.creatorFeeBps).toBe(250);
    expect(config.totalFeeBps).toBe(50 + 250);
  });

  it('overrides feeRecipient', () => {
    const config = createFeeConfig({ feeRecipient: 'dao_treasury' });
    expect(config.feeRecipient).toBe('dao_treasury');
  });

  it('sets feeWallet when provided', () => {
    const config = createFeeConfig({ feeWallet: '0x1234' });
    expect(config.feeWallet).toBe('0x1234');
  });

  it('sets feeChangeThresholdBps when provided', () => {
    const config = createFeeConfig({ feeChangeThresholdBps: 6000 });
    expect(config.feeChangeThresholdBps).toBe(6000);
  });

  it('totalFeeBps always equals platformFeeBps + creatorFeeBps', () => {
    const config = createFeeConfig({ creatorFeeBps: 450 }); // max 4.5%
    expect(config.totalFeeBps).toBe(50 + 450);
  });
});

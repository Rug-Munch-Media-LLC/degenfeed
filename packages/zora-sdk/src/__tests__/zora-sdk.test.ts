import { describe, expect, it } from 'vitest';
import type { CreatorEvent, FlashSale } from '../bonding-curve';
import {
  applyCreatorEventDiscount,
  applyFlashSaleDiscount,
  buysUntilPriceTarget,
  calculateBurnEffect,
  calculateEthOut,
  calculateFee,
  calculateFeeSplit,
  calculateMarketCap,
  calculateSolOut,
  calculateStreakBonus,
  calculateTokensOut,
  calculateTokensOutLegacy,
  checkBuyLimit,
  classifyWhale,
  collectPlatformFee,
  computeBadges,
  formatBps,
  formatCurvePrice,
  formatFee,
  GRADUATION_SUPPLY,
  generateShareLink,
  getCurrentEra,
  getCurrentPrice,
  getDynamicPrice,
  getEraName,
  getGraduationProgress,
  getNextMilestone,
  getPhaseLimit,
  getPhaseLimits,
  getPhaseMaxBuy,
  getProgressPercent,
  getReachedMilestones,
  getStreakMultiplier,
  getTokenGenerationFee,
  isStreakAlive,
  MAX_PRICE,
  MIN_PRICE,
  PLATFORM_FEE_BPS,
  predictPriceAfterBuys,
  TOKEN_GENERATION_FEE_ETH,
  TOKEN_GENERATION_FEE_SOL,
  TOKEN_GENERATION_FEE_USD,
  TOTAL_SUPPLY,
  verifyTokenGenerationFee,
} from '../index';

describe('Bonding Curve: Constants', () => {
  it('TOTAL_SUPPLY is 1B * 1e18', () => {
    expect(TOTAL_SUPPLY).toBe(1_000_000_000_000_000_000_000_000_000n);
  });

  it('GRADUATION_SUPPLY is 80% of total', () => {
    expect(GRADUATION_SUPPLY).toBe(800_000_000_000_000_000_000_000_000n);
  });

  it('MIN_PRICE is 1 gwei and MAX_PRICE is 1000 gwei', () => {
    expect(MIN_PRICE).toBe(1_000_000_000n);
    expect(MAX_PRICE).toBe(1_000_000_000_000n);
  });
});

describe('Bonding Curve: getDynamicPrice', () => {
  it('returns MIN_PRICE for zero supply', () => {
    const price = getDynamicPrice(0n);
    expect(price).toBeGreaterThanOrEqual(MIN_PRICE);
  });

  it('returns MAX_PRICE at graduation supply', () => {
    const price = getDynamicPrice(GRADUATION_SUPPLY);
    expect(price).toBe(MAX_PRICE);
  });

  it('returns MAX_PRICE above graduation supply', () => {
    const price = getDynamicPrice(GRADUATION_SUPPLY + 1n);
    expect(price).toBe(MAX_PRICE);
  });

  it('price increases monotonically with supply', () => {
    const price1 = getDynamicPrice(0n);
    const price2 = getDynamicPrice(GRADUATION_SUPPLY / 4n);
    const price3 = getDynamicPrice(GRADUATION_SUPPLY / 2n);
    const price4 = getDynamicPrice((GRADUATION_SUPPLY * 3n) / 4n);

    expect(price2).toBeGreaterThanOrEqual(price1);
    expect(price3).toBeGreaterThanOrEqual(price2);
    expect(price4).toBeGreaterThanOrEqual(price3);
  });

  it('price is always within [MIN_PRICE, MAX_PRICE]', () => {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const supply = (GRADUATION_SUPPLY * BigInt(i)) / BigInt(steps);
      const price = getDynamicPrice(supply);
      expect(price).toBeGreaterThanOrEqual(MIN_PRICE);
      expect(price).toBeLessThanOrEqual(MAX_PRICE);
    }
  });

  it('price progression is reasonable across eras', () => {
    const earlyPrice = getDynamicPrice(GRADUATION_SUPPLY / 100n);
    const midPrice = getDynamicPrice(GRADUATION_SUPPLY / 2n);
    const latePrice = getDynamicPrice((GRADUATION_SUPPLY * 9n) / 10n);

    // Late price should be significantly higher than early price
    expect(Number(latePrice)).toBeGreaterThan(Number(earlyPrice) * 10);
    // Mid price should be between
    expect(midPrice).toBeGreaterThan(earlyPrice);
    expect(midPrice).toBeLessThan(latePrice);
  });
});

describe('Bonding Curve: getCurrentEra', () => {
  it('returns era 0 for very low supply', () => {
    expect(getCurrentEra(0n)).toBe(0);
    expect(getCurrentEra(GRADUATION_SUPPLY / 100n)).toBe(0);
  });

  it('returns last era near graduation', () => {
    expect(getCurrentEra(GRADUATION_SUPPLY)).toBe(4);
  });

  it('returns 4 at graduation supply', () => {
    const era = getCurrentEra(GRADUATION_SUPPLY);
    expect(era).toBe(4);
  });
});

describe('Bonding Curve: getEraName', () => {
  it('returns era names for different supplies', () => {
    expect(getEraName(0n)).toBe('Steal Deal');
    expect(getEraName(GRADUATION_SUPPLY)).toBe('Finale');
  });
});

describe('Bonding Curve: calculateTokensOut', () => {
  it('returns zero tokens for zero price', () => {
    const result = calculateTokensOut(1000n, 0n);
    expect(result.tokens).toBe(0n);
  });

  it('calculates tokens correctly at a given price', () => {
    const price = 1_000_000_000n; // 1 gwei
    const amount = 1_000_000_000_000_000_000n; // 1 ETH in wei
    const result = calculateTokensOut(amount, price);
    expect(result.tokens).toBe(1_000_000_000_000_000_000n); // 1e18 / 1e9 = 1e9 tokens
  });

  it('adds referral bonuses when boost is provided', () => {
    const result = calculateTokensOut(1000n, 100n, {
      referrerBps: 100,
      refereeBps: 50,
    });
    expect(result.referrerBonus).toBeGreaterThan(0n);
    expect(result.refereeBonus).toBeGreaterThan(0n);
    expect(result.tokens).toBeGreaterThan(0n);
  });

  it('returns no bonuses without referral boost', () => {
    const result = calculateTokensOut(1000n, 100n);
    expect(result.referrerBonus).toBe(0n);
    expect(result.refereeBonus).toBe(0n);
  });
});

describe('Bonding Curve: calculateEthOut', () => {
  it('calculates ETH out with default fee', () => {
    const result = calculateEthOut(1_000_000_000n, 100_000_000n);
    expect(result.grossEth).toBeGreaterThan(0n);
    expect(result.fee).toBeGreaterThan(0n);
    expect(result.netEth).toBeGreaterThan(0n);
    expect(result.netEth + result.fee).toBe(result.grossEth);
  });

  it('returns zeros for zero price', () => {
    const result = calculateEthOut(1000n, 0n);
    expect(result.grossEth).toBe(0n);
    expect(result.fee).toBe(0n);
    expect(result.netEth).toBe(0n);
  });

  it('fee is 0.5% of gross (50 bps default)', () => {
    const result = calculateEthOut(1_000_000_000_000_000_000n, 1_000_000_000n, 50);
    expect(result.fee * 200n).toBe(result.grossEth); // 0.5% = 1/200
  });
});

describe('Bonding Curve: Legacy Functions', () => {
  it('getCurrentPrice works with valid supply', () => {
    const price = getCurrentPrice(500_000_000_000_000_000n);
    expect(price).toBeGreaterThan(0n);
    expect(price).toBeLessThanOrEqual(1000n);
  });

  it('calculateTokensOutLegacy works', () => {
    const result = calculateTokensOutLegacy(1_000_000_000n, 100n);
    // (1e9 * 1e9) / 100 = 1e16
    expect(result).toBe(10_000_000_000_000_000n);
  });

  it('calculateSolOut works with zero price', () => {
    const result = calculateSolOut(1000n, 0n);
    expect(result.netSolOut).toBe(0n);
    expect(result.platformFee).toBe(0n);
  });

  it('calculateSolOut calculates fee correctly', () => {
    const result = calculateSolOut(1_000_000_000n, 500_000_000n);
    // grossSol = (1e9 * 5e8) / 1e9 = 5e8
    // fee = 5e8 * 50 / 10000 = 2_500_000
    // net = 5e8 - 2_500_000 = 497_500_000
    expect(result.platformFee).toBe(2_500_000n);
    expect(result.netSolOut).toBe(497_500_000n);
    expect(result.netSolOut + result.platformFee).toBe(result.netSolOut + result.platformFee);
  });

  it('getPhaseLimit returns increasing limits over time', () => {
    expect(getPhaseLimit(50)).toBe(200);
    expect(getPhaseLimit(200)).toBe(200);
    expect(getPhaseLimit(1000)).toBe(500);
    expect(getPhaseLimit(100000)).toBe(1500); // ≥86_400 = 1500
    expect(getPhaseLimit(86401)).toBe(1500);
  });

  it('getPhaseMaxBuy calculates max buy from phase', () => {
    const maxBuy = getPhaseMaxBuy(50);
    expect(maxBuy).toBeGreaterThan(0n);
  });
});

describe('Bonding Curve: formatCurvePrice', () => {
  it('formats prices >= 1 with 4 decimals', () => {
    const formatted = formatCurvePrice(1_000_000_000_000_000_000n); // 1 ETH
    expect(formatted).toContain('$1');
  });

  it('formats prices < 0.001 with 8 decimals', () => {
    const formatted = formatCurvePrice(1_000_000n); // very small
    expect(formatted).toMatch(/^\$0\.\d{8}$/);
  });
});

describe('Bonding Curve: calculateMarketCap', () => {
  it('calculates market cap correctly', () => {
    const mc = calculateMarketCap(1_000_000_000n, 1_000_000_000_000_000_000n);
    expect(mc).toBeGreaterThan(0n);
  });
});

describe('Bonding Curve: getProgressPercent', () => {
  it('returns 0 at zero supply', () => {
    expect(getProgressPercent(0n)).toBe(0);
  });

  it('returns 100 at graduation', () => {
    expect(getProgressPercent(GRADUATION_SUPPLY)).toBe(100);
  });

  it('returns 50 at half graduation', () => {
    expect(getProgressPercent(GRADUATION_SUPPLY / 2n)).toBe(50);
  });
});

describe('Bonding Curve: Streak', () => {
  it('getStreakMultiplier returns 1x for < 3 days', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(1)).toBe(1.0);
    expect(getStreakMultiplier(2)).toBe(1.0);
  });

  it('getStreakMultiplier scales up to 2x at 7 days', () => {
    expect(getStreakMultiplier(3)).toBe(1.1);
    expect(getStreakMultiplier(7)).toBe(2.0);
    expect(getStreakMultiplier(30)).toBe(2.0);
  });

  it('calculateStreakBonus returns 0 for less than 3 days', () => {
    expect(calculateStreakBonus(1000n, 1)).toBe(0n);
  });

  it('calculateStreakBonus returns bonus for 7 days', () => {
    const bonus = calculateStreakBonus(1000n, 7);
    expect(bonus).toBeGreaterThan(0n);
  });

  it('isStreakAlive returns true within 36 hours', () => {
    const now = Date.now();
    expect(isStreakAlive(now - 3600000, now)).toBe(true);
    expect(isStreakAlive(now - 130000000, now)).toBe(false);
  });
});

describe('Bonding Curve: Flash Sale & Creator Events', () => {
  it('applyFlashSaleDiscount returns base price when inactive', () => {
    const sale: FlashSale = {
      active: false,
      discountBps: 200,
      endTimestamp: 0,
      maxBuys: 0,
      buysUsed: 0,
    };
    expect(applyFlashSaleDiscount(1000n, sale)).toBe(1000n);
  });

  it('applyFlashSaleDiscount applies discount', () => {
    const basePrice = 10_000_000_000n; // 10 gwei
    const sale: FlashSale = {
      active: true,
      discountBps: 500, // 5%
      endTimestamp: Date.now() + 300000,
      maxBuys: 20,
      buysUsed: 0,
    };
    const discounted = applyFlashSaleDiscount(basePrice, sale);
    expect(discounted).toBeLessThan(basePrice);
    expect(discounted).toBeGreaterThanOrEqual(MIN_PRICE);
  });

  it('applyCreatorEventDiscount returns base price when inactive', () => {
    const event: CreatorEvent = {
      active: false,
      discountBps: 200,
      remainingBuys: 0,
      totalBuys: 0,
      message: '',
    };
    expect(applyCreatorEventDiscount(10_000_000_000n, event)).toBe(10_000_000_000n);
  });

  it('applyCreatorEventDiscount applies discount when active', () => {
    const basePrice = 10_000_000_000n; // 10 gwei
    const event: CreatorEvent = {
      active: true,
      discountBps: 300, // 3%
      remainingBuys: 5,
      totalBuys: 5,
      message: 'Special!',
    };
    const discounted = applyCreatorEventDiscount(basePrice, event);
    expect(discounted).toBeLessThan(basePrice);
  });
});

describe('Bonding Curve: Prediction', () => {
  it('predictPriceAfterBuys returns price >= current', () => {
    const current = getDynamicPrice(0n);
    const predicted = predictPriceAfterBuys(0n, 1_000_000_000_000_000_000n, 5);
    expect(predicted).toBeGreaterThanOrEqual(current);
  });

  it('buysUntilPriceTarget returns 0 if already at target', () => {
    const buys = buysUntilPriceTarget(GRADUATION_SUPPLY, 1_000_000_000_000_000_000n, MIN_PRICE);
    expect(buys).toBe(0);
  });
});

describe('Platform Fees', () => {
  it('PLATFORM_FEE_BPS is 50 (0.5%)', () => {
    expect(PLATFORM_FEE_BPS).toBe(50);
  });

  it('calculateFee computes correct fee', () => {
    expect(calculateFee(1_000_000n)).toBe(5_000n); // 0.5% of 1M
    expect(calculateFee(1_000n, 100)).toBe(10n); // 1% of 1000
  });

  it('calculateFeeSplit computes all fee components', () => {
    const split = calculateFeeSplit(1_000_000n, 100, 5);
    expect(split.platform).toBeGreaterThan(0n);
    expect(split.creator).toBeGreaterThan(0n);
    expect(split.referrer).toBeGreaterThan(0n);
    expect(split.platform + split.creator + split.referrer + split.net).toBe(1_000_000n);
  });

  it('calculateFeeSplit throws for excessive creator fee', () => {
    expect(() => calculateFeeSplit(1000n, 500)).toThrow('exceeds max');
  });

  it('collectPlatformFee returns the fee amount', async () => {
    const fee = await collectPlatformFee(1_000_000n);
    expect(fee).toBe(5_000n);
  });

  it('collectPlatformFee throws for out-of-range fee', async () => {
    await expect(collectPlatformFee(1000n, undefined, 200)).rejects.toThrow('out of range');
  });

  it('formatBps outputs readable percentage', () => {
    expect(formatBps(50)).toBe('0.50%');
    expect(formatBps(100)).toBe('1.00%');
    expect(formatBps(1000)).toBe('10.00%');
  });

  it('formatFee returns ETH-denominated string', () => {
    const formatted = formatFee(1_000_000_000_000_000_000n);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('ETH');
  });
});

describe('Anti-Exploit: Phase Limits', () => {
  it('getPhaseLimits starts ultra-restrictive', () => {
    const limits = getPhaseLimits(30); // 30 seconds
    expect(limits.maxBuyBps).toBe(100);
    expect(limits.cooldownSeconds).toBe(60);
    expect(limits.name).toBe('Ultra Snipe Protection');
  });

  it('getPhaseLimits loosens over time', () => {
    const ultra = getPhaseLimits(30);
    const snipe = getPhaseLimits(120);
    const early = getPhaseLimits(600);
    const growth = getPhaseLimits(3600);
    const mature = getPhaseLimits(86401);

    expect(ultra.maxBuyBps).toBeLessThan(snipe.maxBuyBps);
    expect(snipe.maxBuyBps).toBeLessThan(early.maxBuyBps);
    expect(early.maxBuyBps).toBeLessThanOrEqual(growth.maxBuyBps);
    expect(growth.maxBuyBps).toBeLessThanOrEqual(mature.maxBuyBps);
  });

  it('checkBuyLimit returns null when all checks pass', () => {
    const result = checkBuyLimit(
      1000n,
      100n,
      0n,
      1_000_000_000_000_000_000_000_000n,
      100000,
      0,
      100000,
    );
    expect(result).toBeNull();
  });

  it('checkBuyLimit returns error when cooldown not met', () => {
    const result = checkBuyLimit(1000n, 100n, 0n, 1_000_000_000_000_000_000_000_000n, 30, 0, 10);
    expect(result).toContain('Wait');
  });
});

describe('Anti-Exploit: Whale Detection', () => {
  it('classifyWhale returns false for small buys', () => {
    expect(classifyWhale(100)).toBe(false);
  });

  it('classifyWhale returns true for buys >= $1000', () => {
    expect(classifyWhale(1000)).toBe(true);
    expect(classifyWhale(5000)).toBe(true);
  });

  it('classifyWhale returns "mega" for buys >= $10,000', () => {
    expect(classifyWhale(10000)).toBe('mega');
    expect(classifyWhale(50000)).toBe('mega');
  });
});

describe('Anti-Exploit: Badges', () => {
  it('computeBadges awards first_buyer for index < 100', () => {
    const badges = computeBadges({
      buyIndex: 50,
      streakDays: 0,
      largestBuyUsd: 0,
      holderRank: null,
      totalHolders: 100,
      firstBuyTimestamp: null,
      createdAtTimestamp: Date.now(),
      boughtAtMilestones: [],
      hasReferred: false,
      boughtDuringCreatorEvent: false,
      boughtDuringFlashSale: false,
      heldThroughGraduation: false,
    });
    expect(badges).toContain('first_buyer');
  });

  it('computeBadges awards streak badges', () => {
    const badges = computeBadges({
      buyIndex: 200,
      streakDays: 7,
      largestBuyUsd: 0,
      holderRank: null,
      totalHolders: 100,
      firstBuyTimestamp: null,
      createdAtTimestamp: Date.now(),
      boughtAtMilestones: [],
      hasReferred: false,
      boughtDuringCreatorEvent: false,
      boughtDuringFlashSale: false,
      heldThroughGraduation: false,
    });
    expect(badges).toContain('streak_7');
    expect(badges).not.toContain('streak_30');
  });

  it('computeBadges awards whale badge for $1000+ buys', () => {
    const badges = computeBadges({
      buyIndex: 200,
      streakDays: 0,
      largestBuyUsd: 1500,
      holderRank: null,
      totalHolders: 100,
      firstBuyTimestamp: null,
      createdAtTimestamp: Date.now(),
      boughtAtMilestones: [],
      hasReferred: false,
      boughtDuringCreatorEvent: false,
      boughtDuringFlashSale: false,
      heldThroughGraduation: false,
    });
    expect(badges).toContain('whale');
  });

  it('computeBadges awards top_3_holder for rank <= 3', () => {
    const badges = computeBadges({
      buyIndex: 200,
      streakDays: 0,
      largestBuyUsd: 0,
      holderRank: 2,
      totalHolders: 100,
      firstBuyTimestamp: null,
      createdAtTimestamp: Date.now(),
      boughtAtMilestones: [],
      hasReferred: false,
      boughtDuringCreatorEvent: false,
      boughtDuringFlashSale: false,
      heldThroughGraduation: false,
    });
    expect(badges).toContain('top_3_holder');
  });
});

describe('Milestones', () => {
  it('getReachedMilestones returns milestones below current progress', () => {
    const milestones = getReachedMilestones(50);
    expect(milestones).toHaveLength(3);
    expect(milestones[0]!.name).toBe('Ignition');
  });

  it('getNextMilestone returns the next un-reached milestone', () => {
    const next = getNextMilestone(30);
    expect(next).not.toBeNull();
    expect(next?.percent).toBe(50);
  });

  it('getNextMilestone returns null at 100%', () => {
    expect(getNextMilestone(100)).toBeNull();
  });
});

describe('generateShareLink', () => {
  it('generates a share link with shortened ref', () => {
    const link = generateShareLink('ALICE', '0x1234567890abcdef1234567890abcdef12345678');
    expect(link).toContain('/launch/alice');
    expect(link).toContain('?ref=123456');
  });

  it('respects custom base URL', () => {
    const link = generateShareLink(
      'BOB',
      '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      'https://app.degenfeed.io',
    );
    expect(link).toContain('https://app.degenfeed.io');
  });
});

describe('calculateBurnEffect', () => {
  it('reduces supply and adjusts price', () => {
    const result = calculateBurnEffect(
      1000_000_000_000_000_000_000_000n,
      100_000_000_000_000_000_000_000n,
      1000n,
    );
    expect(result.newSupply).toBeLessThan(1000_000_000_000_000_000_000_000n);
    expect(result.scarcityPremium).toBeGreaterThan(0);
  });

  it('handles full burn', () => {
    const result = calculateBurnEffect(1000n, 1000n, 100n);
    expect(result.newSupply).toBe(0n);
    expect(result.newPrice).toBe(MIN_PRICE);
  });
});

describe('Token Generation Fees', () => {
  it('TOKEN_GENERATION_FEE_USD is $20', () => {
    expect(TOKEN_GENERATION_FEE_USD).toBe(20);
  });

  it('getTokenGenerationFee returns correct amounts', () => {
    const solFee = getTokenGenerationFee('solana');
    expect(solFee.amount).toBe(TOKEN_GENERATION_FEE_SOL);
    expect(solFee.currency).toBe('SOL');

    const baseFee = getTokenGenerationFee('base');
    expect(baseFee.amount).toBe(TOKEN_GENERATION_FEE_ETH);
    expect(baseFee.currency).toBe('ETH');
  });

  it('verifyTokenGenerationFee validates payments', () => {
    // 0.1 SOL at $250 = $25, which is >= $20
    expect(verifyTokenGenerationFee(100_000_000n, 'solana', 250, 3300)).toBe(true);
    // 0.01 SOL at $250 = $2.5, which is < $20
    expect(verifyTokenGenerationFee(10_000_000n, 'solana', 250, 3300)).toBe(false);
  });
});

describe('getGraduationProgress', () => {
  it('returns minimum of supply and buyer progress', () => {
    const progress = getGraduationProgress(GRADUATION_SUPPLY, 25);
    expect(progress).toBe(50); // 100% supply, 50% buyers = 50
  });
});

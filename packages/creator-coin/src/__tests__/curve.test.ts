/**
 * @degenfeed/creator-coin — Bonding Curve Tests
 *
 * Tests the super-linear bonding curve with 5 named phases, price calculations,
 * token calculations, visual progress, and utility functions.
 */
import { describe, expect, it } from 'vitest';
import {
  applyLiveBoost,
  calculateMarketCap,
  calculateNativeOut,
  calculateNativeOutWithFees,
  calculateTokensOut,
  calculateTokensOutWithFees,
  CURVE_ERAS,
  estimateTimeToNextPhase,
  formatPrice,
  generateCurveSvgPath,
  getBondingPhaseInfo,
  getCurrentEra,
  getDynamicPrice,
  getEraColor,
  getEraIcon,
  getEraName,
  getNextPhase,
  getPhaseByProgress,
  getProgressPercent,
  getVisualProgress,
  GRADUATION_SUPPLY,
  MAX_PRICE,
  MIN_PRICE,
  PHASE_ACHIEVEMENTS,
  PRICE_DECIMALS,
  predictPriceAfterBuys,
  SCALING,
  TOTAL_SUPPLY,
} from '../index';
import { createFeeConfig } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

describe('Bonding Curve: Constants', () => {
  it('TOTAL_SUPPLY is 1B * 1e18', () => {
    expect(TOTAL_SUPPLY).toBe(1_000_000_000_000_000_000_000_000_000n);
  });

  it('GRADUATION_SUPPLY is 80% of total supply', () => {
    expect(GRADUATION_SUPPLY).toBe(800_000_000_000_000_000_000_000_000n);
    expect(GRADUATION_SUPPLY).toBe((TOTAL_SUPPLY * 80n) / 100n);
  });

  it('MIN_PRICE is 1 gwei and MAX_PRICE is 1000 gwei', () => {
    expect(MIN_PRICE).toBe(1_000_000_000n);
    expect(MAX_PRICE).toBe(1_000_000_000_000n);
    expect(MAX_PRICE).toBe(MIN_PRICE * 1000n);
  });

  it('PRICE_DECIMALS is 1e9', () => {
    expect(PRICE_DECIMALS).toBe(1_000_000_000n);
  });

  it('SCALING is 1e6', () => {
    expect(SCALING).toBe(1_000_000n);
  });
});

// ─── Dynamic Price ─────────────────────────────────────────────────────────

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
    const farAbove = getDynamicPrice(GRADUATION_SUPPLY * 2n);
    expect(farAbove).toBe(MAX_PRICE);
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

  it('price is always within [MIN_PRICE, MAX_PRICE] for all supply levels', () => {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const supply = (GRADUATION_SUPPLY * BigInt(i)) / BigInt(steps);
      const price = getDynamicPrice(supply);
      expect(price).toBeGreaterThanOrEqual(MIN_PRICE);
      expect(price).toBeLessThanOrEqual(MAX_PRICE);
    }
  });

  it('price progression shows significant growth from early to late phases', () => {
    const earlyPrice = getDynamicPrice(GRADUATION_SUPPLY / 100n);
    const midPrice = getDynamicPrice(GRADUATION_SUPPLY / 2n);
    const latePrice = getDynamicPrice((GRADUATION_SUPPLY * 9n) / 10n);

    expect(Number(latePrice)).toBeGreaterThan(Number(earlyPrice) * 10);
    expect(midPrice).toBeGreaterThan(earlyPrice);
    expect(midPrice).toBeLessThan(latePrice);
  });

  it('returns a non-zero price for a small initial supply', () => {
    const price = getDynamicPrice(1_000_000_000_000_000_000n); // tiny supply
    expect(price).toBeGreaterThan(0n);
    expect(price).toBeGreaterThanOrEqual(MIN_PRICE);
  });
});

// ─── Current Era ──────────────────────────────────────────────────────────

describe('Bonding Curve: getCurrentEra', () => {
  it('returns era 0 (Steal Deal) for very low supply', () => {
    expect(getCurrentEra(0n)).toBe(0);
    expect(getCurrentEra(GRADUATION_SUPPLY / 100n)).toBe(0);
  });

  it('returns era 4 (Moonshot) near and at graduation', () => {
    expect(getCurrentEra(GRADUATION_SUPPLY)).toBe(4);
    expect(getCurrentEra(GRADUATION_SUPPLY - 1n)).toBe(4);
  });

  it('era progresses through all phases as supply increases', () => {
    const increments = 5;
    const seenEras = new Set<number>();
    for (let i = 0; i <= increments; i++) {
      const supply = (GRADUATION_SUPPLY * BigInt(i)) / BigInt(increments);
      seenEras.add(getCurrentEra(supply));
    }
    // Should have visited multiple eras
    expect(seenEras.size).toBeGreaterThan(1);
  });
});

// ─── Era Names / Colors / Icons ──────────────────────────────────────────

describe('Bonding Curve: Era Metadata', () => {
  it('getEraName returns correct names for all eras', () => {
    const expectedNames = ['Steal Deal', 'Early Bird', 'Cruise Control', 'Final Call', 'Moonshot'];
    for (let i = 0; i < expectedNames.length; i++) {
      expect(getEraName(i)).toBe(expectedNames[i]);
    }
  });

  it('getEraName returns Unknown for invalid index', () => {
    expect(getEraName(-1)).toBe('Unknown');
    expect(getEraName(99)).toBe('Unknown');
  });

  it('getEraColor returns a non-empty string for each era', () => {
    for (let i = 0; i < 5; i++) {
      const color = getEraColor(i);
      expect(color).toBeTruthy();
      expect(color).toContain('from-');
    }
  });

  it('getEraColor returns fallback for out-of-range index', () => {
    expect(getEraColor(-1)).toBeTruthy();
  });

  it('getEraIcon returns an emoji for each era', () => {
    for (let i = 0; i < 5; i++) {
      const icon = getEraIcon(i);
      expect(icon).toBeTruthy();
    }
  });

  it('getEraIcon returns rocket emoji for out-of-range', () => {
    expect(getEraIcon(99)).toBe('🚀');
  });
});

// ─── Token Calculations ───────────────────────────────────────────────────

describe('Bonding Curve: calculateTokensOut', () => {
  it('returns 0 tokens for zero price', () => {
    expect(calculateTokensOut(1000n, 0n)).toBe(0n);
  });

  it('calculates tokens correctly at a given price', () => {
    const price = 1_000_000_000n; // 1 gwei
    const amount = 1_000_000_000_000_000_000n; // 1 ETH in wei
    const tokens = calculateTokensOut(amount, price);
    // (1e18 * 1e9) / 1e9 = 1e18
    expect(tokens).toBe(1_000_000_000_000_000_000n);
  });

  it('calculates small amounts accurately', () => {
    const price = 10_000_000_000n; // 10 gwei
    const amount = 1_000_000_000_000_000_000n; // 1 ETH
    const tokens = calculateTokensOut(amount, price);
    // (1e18 * 1e9) / 1e10 = 1e17
    expect(tokens).toBe(100_000_000_000_000_000n);
  });

  it('returns 0 for zero amount', () => {
    const tokens = calculateTokensOut(0n, 1_000_000_000n);
    expect(tokens).toBe(0n);
  });
});

// ─── Native Out Calculations ──────────────────────────────────────────────

describe('Bonding Curve: calculateNativeOut', () => {
  it('returns zeros for zero price', () => {
    const result = calculateNativeOut(1000n, 0n);
    expect(result.gross).toBe(0n);
    expect(result.fee).toBe(0n);
    expect(result.net).toBe(0n);
  });

  it('calculates with default 50 bps fee', () => {
    const tokensIn = 1_000_000_000_000_000_000n; // 1e18 tokens
    const price = 1_000_000_000n; // 1 gwei
    const result = calculateNativeOut(tokensIn, price);
    // gross = (1e18 * 1e9) / 1e9 = 1e18
    expect(result.gross).toBe(1_000_000_000_000_000_000n);
    // fee = gross * 50 / 10000 = 1e18 * 50 / 10000 = 5e15
    expect(result.fee).toBe(5_000_000_000_000_000n);
    // net = gross - fee
    expect(result.net).toBe(result.gross - result.fee);
  });

  it('accepts custom feeBps', () => {
    const result = calculateNativeOut(1_000_000_000_000_000_000n, 1_000_000_000n, 200);
    // fee = gross * 200 / 10000 = 2%
    expect(result.fee * 50n).toBe(result.gross); // 2% = 1/50
  });

  it('fee is proportional to feeBps value', () => {
    const lowFee = calculateNativeOut(1_000_000_000_000_000_000n, 1_000_000_000n, 50);
    const highFee = calculateNativeOut(1_000_000_000_000_000_000n, 1_000_000_000n, 500);
    expect(lowFee.fee).toBeLessThan(highFee.fee);
  });
});

// ─── Native Out With Fees ─────────────────────────────────────────────────

describe('Bonding Curve: calculateNativeOutWithFees', () => {
  const defaultFeeConfig = createFeeConfig();

  it('returns zeros for zero price', () => {
    const result = calculateNativeOutWithFees(1000n, 0n, defaultFeeConfig);
    expect(result.gross).toBe(0n);
    expect(result.platformFee).toBe(0n);
    expect(result.creatorFee).toBe(0n);
    expect(result.totalFee).toBe(0n);
    expect(result.net).toBe(0n);
  });

  it('splits fees between platform and creator', () => {
    const tokensIn = 1_000_000_000_000_000_000n;
    const price = 1_000_000_000n;
    const result = calculateNativeOutWithFees(tokensIn, price, defaultFeeConfig);
    // platformFee = 50 bps = 0.5%
    expect(result.platformFee).toBeGreaterThan(0n);
    // creatorFee = 100 bps = 1% (default)
    expect(result.creatorFee).toBeGreaterThan(0n);
    // Platform + creator = total
    expect(result.totalFee).toBe(result.platformFee + result.creatorFee);
    // net = gross - total
    expect(result.net).toBe(result.gross - result.totalFee);
  });

  it('includes totalFeePercent in result', () => {
    const result = calculateNativeOutWithFees(1_000_000_000_000_000_000n, 1_000_000_000n, defaultFeeConfig);
    expect(result.totalFeePercent).toMatch(/^\d+\.\d{2}%$/);
  });

  it('works with zero creator fee', () => {
    const config = createFeeConfig({ creatorFeeBps: 0 });
    const result = calculateNativeOutWithFees(1_000_000_000_000_000_000n, 1_000_000_000n, config);
    expect(result.creatorFee).toBe(0n);
    expect(result.platformFee).toBeGreaterThan(0n);
    expect(result.totalFee).toBe(result.platformFee);
  });

  it('net + totalFee equals gross', () => {
    const result = calculateNativeOutWithFees(1_000_000_000_000_000_000n, 1_000_000_000n, defaultFeeConfig);
    expect(result.net + result.totalFee).toBe(result.gross);
  });
});

// ─── Tokens Out With Fees ─────────────────────────────────────────────────

describe('Bonding Curve: calculateTokensOutWithFees', () => {
  const defaultFeeConfig = createFeeConfig();

  it('returns zeros for zero price', () => {
    const result = calculateTokensOutWithFees(1000n, 0n, defaultFeeConfig);
    expect(result.grossTokens).toBe(0n);
    expect(result.platformFee).toBe(0n);
    expect(result.creatorFee).toBe(0n);
    expect(result.totalFee).toBe(0n);
    expect(result.netAmount).toBe(0n);
    expect(result.netTokens).toBe(0n);
  });

  it('subtracts fees from native amount before calculating tokens', () => {
    const result = calculateTokensOutWithFees(1_000_000_000_000_000_000n, 1_000_000_000n, defaultFeeConfig);
    // Fees reduce the amount available to buy tokens
    expect(result.netAmount).toBeLessThan(1_000_000_000_000_000_000n);
    expect(result.platformFee).toBeGreaterThan(0n);
    expect(result.creatorFee).toBeGreaterThan(0n);
    // netTokens should be less than grossTokens
    expect(result.netTokens).toBeLessThan(result.grossTokens);
  });

  it('netTokens = (netAmount * PRICE_DECIMALS) / price', () => {
    const result = calculateTokensOutWithFees(1_000_000_000_000_000_000n, 1_000_000_000n, defaultFeeConfig);
    const expectedNetTokens = (result.netAmount * PRICE_DECIMALS) / 1_000_000_000n;
    expect(result.netTokens).toBe(expectedNetTokens);
  });

  it('platform fee is exactly 50 bps', () => {
    const amount = 1_000_000_000_000_000_000n;
    const result = calculateTokensOutWithFees(amount, 1_000_000_000n, defaultFeeConfig);
    expect(result.platformFee).toBe((amount * 50n) / 10_000n);
  });
});

// ─── Format Price ─────────────────────────────────────────────────────────

describe('Bonding Curve: formatPrice', () => {
  it('formats values >= 1 with 4 decimal places', () => {
    const oneToken = 1_000_000_000_000_000_000n; // 1 token in wei-equivalent
    expect(formatPrice(oneToken)).toMatch(/^1\.\d{4}/);
  });

  it('formats values >= 0.001 with 6 decimal places', () => {
    const smallPrice = 1_000_000_000_000n; // 0.000001 in ETH
    const formatted = formatPrice(smallPrice);
    expect(formatted.split('.')[1]?.length).toBeLessThanOrEqual(8);
  });

  it('formats very small values with high precision', () => {
    const tiny = 1_000_000n; // extremely small
    const formatted = formatPrice(tiny);
    expect(formatted).toMatch(/^0\.\d+/);
  });

  it('formats zero', () => {
    expect(formatPrice(0n)).toBe('0.00000000');
  });
});

// ─── Market Cap ───────────────────────────────────────────────────────────

describe('Bonding Curve: calculateMarketCap', () => {
  it('calculates market cap = price * supply / PRICE_DECIMALS', () => {
    const price = 1_000_000_000n; // 1 gwei
    const supply = 1_000_000_000_000_000_000_000_000n; // 1M tokens
    const mc = calculateMarketCap(price, supply);
    expect(mc).toBe((price * supply) / PRICE_DECIMALS);
  });

  it('returns 0 for zero supply', () => {
    expect(calculateMarketCap(1_000_000_000n, 0n)).toBe(0n);
  });

  it('returns 0 for zero price', () => {
    expect(calculateMarketCap(0n, 1_000_000_000_000_000_000n)).toBe(0n);
  });
});

// ─── Progress Percentage ──────────────────────────────────────────────────

describe('Bonding Curve: getProgressPercent', () => {
  it('returns 0 for zero supply', () => {
    expect(getProgressPercent(0n)).toBe(0);
  });

  it('returns 100 at graduation supply', () => {
    expect(getProgressPercent(GRADUATION_SUPPLY)).toBe(100);
  });

  it('returns 100 above graduation supply', () => {
    expect(getProgressPercent(GRADUATION_SUPPLY + 100n)).toBe(100);
  });

  it('returns 50 at half graduation supply', () => {
    const halfSupply = GRADUATION_SUPPLY / 2n;
    expect(getProgressPercent(halfSupply)).toBe(50);
  });

  it('returns proportional progress', () => {
    const quarterSupply = GRADUATION_SUPPLY / 4n;
    expect(getProgressPercent(quarterSupply)).toBe(25);
  });
});

// ─── Price Prediction ─────────────────────────────────────────────────────

describe('Bonding Curve: predictPriceAfterBuys', () => {
  it('returns price >= current after simulated buys', () => {
    const currentPrice = getDynamicPrice(0n);
    const predicted = predictPriceAfterBuys(0n, 1_000_000_000_000_000_000n, 5);
    expect(predicted).toBeGreaterThanOrEqual(currentPrice);
  });

  it('returns a price within bounds', () => {
    const predicted = predictPriceAfterBuys(0n, 1_000_000_000_000_000_000n, 10);
    expect(predicted).toBeGreaterThanOrEqual(MIN_PRICE);
    expect(predicted).toBeLessThanOrEqual(MAX_PRICE);
  });

  it('returns current price for 0 buys', () => {
    const current = getDynamicPrice(GRADUATION_SUPPLY / 2n);
    const predicted = predictPriceAfterBuys(GRADUATION_SUPPLY / 2n, 1_000_000_000_000_000_000n, 0);
    expect(predicted).toBe(current);
  });
});

// ─── Visual Progress ──────────────────────────────────────────────────────

describe('Bonding Curve: getVisualProgress', () => {
  it('returns phase progress data for zero supply', () => {
    const price = getDynamicPrice(0n);
    const visual = getVisualProgress(0n, price);
    expect(visual.colorGradient).toBeTruthy();
    expect(visual.icon).toBeTruthy();
    expect(typeof visual.phaseProgress).toBe('number');
    expect(visual.phaseProgress).toBeGreaterThanOrEqual(0);
  });

  it('returns phase progress data at graduation (still in Moonshot phase)', () => {
    const visual = getVisualProgress(GRADUATION_SUPPLY, MAX_PRICE);
    // At GRADUATION_SUPPLY, we're still in the Moonshot phase (era 4)
    // Phase progress should be 100 (fully through Moonshot)
    expect(visual.phaseProgress).toBe(100);
    expect(visual.icon).toBe('🚀');
    expect(typeof visual.priceChangePercent).toBe('number');
    expect(visual.urgencyMessage).toContain('MOONSHOT');
  });

  it('price change percent is 0 at phase start', () => {
    const phaseStartSupply = (GRADUATION_SUPPLY * 0n) / 100n;
    const price = getDynamicPrice(phaseStartSupply);
    const visual = getVisualProgress(phaseStartSupply, price);
    expect(visual.priceChangePercent).toBe(0);
  });

  it('returns phase progress within 0-100', () => {
    const steps = [0n, GRADUATION_SUPPLY / 4n, GRADUATION_SUPPLY / 2n, (GRADUATION_SUPPLY * 3n) / 4n];
    for (const supply of steps) {
      const price = getDynamicPrice(supply);
      const visual = getVisualProgress(supply, price);
      expect(visual.phaseProgress).toBeGreaterThanOrEqual(0);
      expect(visual.phaseProgress).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Bonding Phase Info ───────────────────────────────────────────────────

describe('Bonding Curve: getBondingPhaseInfo', () => {
  it('returns correct phase for zero supply', () => {
    const info = getBondingPhaseInfo(0n);
    expect(info.name).toBe('Steal Deal');
    expect(info.index).toBe(0);
  });

  it('returns last phase at graduation', () => {
    const info = getBondingPhaseInfo(GRADUATION_SUPPLY);
    expect(info.name).toBe('Moonshot');
    expect(info.index).toBe(4);
  });

  it('returns Moonshot phase at and just above graduation supply', () => {
    // At and above GRADUATION_SUPPLY, getCurrentEra returns 4 (Moonshot)
    // because CURVE_ERAS[4] is the last era that covers 80-100%.
    const info = getBondingPhaseInfo(GRADUATION_SUPPLY + 1000n);
    expect(info.name).toBe('Moonshot');
    expect(info.index).toBe(4);
    expect(info.progress).toBe(100);
  });
});

// ─── Phase By Progress ────────────────────────────────────────────────────

describe('Bonding Curve: getPhaseByProgress', () => {
  it('returns Steal Deal for 0% progress', () => {
    const phase = getPhaseByProgress(0);
    expect(phase.name).toBe('Steal Deal');
  });

  it('returns Early Bird for progress in the 20-40% range', () => {
    const phase = getPhaseByProgress(30);
    expect(phase.name).toBe('Early Bird');
  });

  it('returns Moonshot for 95% progress', () => {
    const phase = getPhaseByProgress(95);
    expect(phase.name).toBe('Moonshot');
  });

  it('returns a phase for all progress values 0-100', () => {
    for (let p = 0; p <= 100; p += 10) {
      const phase = getPhaseByProgress(p);
      expect(phase).toBeDefined();
      expect(phase.name).toBeTruthy();
    }
  });
});

// ─── Next Phase ───────────────────────────────────────────────────────────

describe('Bonding Curve: getNextPhase', () => {
  it('returns Early Bird for Steal Deal index', () => {
    const next = getNextPhase(0);
    expect(next).not.toBeNull();
    expect(next!.name).toBe('Early Bird');
  });

  it('returns null for the last phase', () => {
    const next = getNextPhase(4);
    expect(next).toBeNull();
  });

  it('returns a phase for mid indices', () => {
    const next = getNextPhase(2);
    expect(next).not.toBeNull();
    expect(next!.index).toBe(3);
  });
});

// ─── Time To Next Phase ───────────────────────────────────────────────────

describe('Bonding Curve: estimateTimeToNextPhase', () => {
  it('returns 0 seconds and null phase when already at max', () => {
    const result = estimateTimeToNextPhase(GRADUATION_SUPPLY, 1_000_000_000_000_000_000n);
    expect(result.nextPhase).toBeNull();
    expect(result.estimatedSeconds).toBe(0);
  });

  it('returns -1 when buy rate is zero', () => {
    const result = estimateTimeToNextPhase(0n, 0n);
    expect(result.estimatedSeconds).toBe(-1);
  });

  it('returns a positive estimate with valid inputs', () => {
    const result = estimateTimeToNextPhase(0n, 1_000_000_000_000_000_000n);
    expect(result.nextPhase).not.toBeNull();
    expect(result.estimatedSeconds).toBeGreaterThan(0);
  });
});

// ─── SVG Path ─────────────────────────────────────────────────────────────

describe('Bonding Curve: generateCurveSvgPath', () => {
  it('generates a valid SVG path string', () => {
    const path = generateCurveSvgPath(800, 400, 0n);
    expect(path).toContain('M0,');
    expect(path).toContain('L');
  });

  it('generates a path with multiple points', () => {
    const path = generateCurveSvgPath(800, 400, 0n);
    const points = path.split(' L');
    expect(points.length).toBeGreaterThan(50); // ~100 points
  });

  it('starts from bottom-left corner', () => {
    const path = generateCurveSvgPath(800, 400, 0n);
    expect(path).toMatch(/^M0,400/);
  });
});

// ─── Live Boost ───────────────────────────────────────────────────────────

describe('Bonding Curve: applyLiveBoost', () => {
  it('returns base price for zero boost', () => {
    expect(applyLiveBoost(1_000_000_000n, 0)).toBe(1_000_000_000n);
  });

  it('returns base price for negative boost', () => {
    expect(applyLiveBoost(1_000_000_000n, -100)).toBe(1_000_000_000n);
  });

  it('returns base price for boost > 1000', () => {
    expect(applyLiveBoost(1_000_000_000n, 2000)).toBe(1_000_000_000n);
  });

  it('applies discount for valid boost', () => {
    const base = 10_000_000_000n; // 10 gwei
    const boosted = applyLiveBoost(base, 200); // 2% discount
    expect(boosted).toBeLessThan(base);
  });

  it('floors at MIN_PRICE', () => {
    const boosted = applyLiveBoost(MIN_PRICE, 500); // 5% off MIN_PRICE
    expect(boosted).toBe(MIN_PRICE);
  });

  it('boost is proportional to bps', () => {
    const base = 100_000_000_000n;
    const smallBoost = applyLiveBoost(base, 100); // 1%
    const largeBoost = applyLiveBoost(base, 500); // 5%
    const diffSmall = base - smallBoost;
    const diffLarge = base - largeBoost;
    expect(diffLarge).toBeGreaterThan(diffSmall);
  });
});

// ─── Curve Eras ───────────────────────────────────────────────────────────

describe('Bonding Curve: CURVE_ERAS', () => {
  it('has exactly 5 eras', () => {
    expect(CURVE_ERAS).toHaveLength(5);
  });

  it('each era has required properties', () => {
    for (const era of CURVE_ERAS) {
      expect(era).toHaveProperty('endSupply');
      expect(era).toHaveProperty('exponent');
      expect(era).toHaveProperty('slopeMultiplier');
      expect(era).toHaveProperty('name');
      expect(era).toHaveProperty('color');
      expect(era).toHaveProperty('icon');
      expect(era.endSupply).toBeGreaterThan(0n);
    }
  });

  it('endSupply increases across eras', () => {
    for (let i = 1; i < CURVE_ERAS.length; i++) {
      const prev = CURVE_ERAS[i - 1]!;
      const curr = CURVE_ERAS[i]!;
      expect(curr.endSupply).toBeGreaterThan(prev.endSupply);
    }
  });
});

// ─── Phase Achievements ───────────────────────────────────────────────────

describe('Bonding Curve: PHASE_ACHIEVEMENTS', () => {
  it('has exactly 5 achievements', () => {
    expect(PHASE_ACHIEVEMENTS).toHaveLength(5);
  });

  it('each achievement has a badge', () => {
    for (const achievement of PHASE_ACHIEVEMENTS) {
      expect(achievement.badge).toHaveProperty('type');
      expect(achievement.badge).toHaveProperty('name');
      expect(achievement.badge).toHaveProperty('icon');
      expect(achievement.badge).toHaveProperty('description');
      expect(achievement.badge).toHaveProperty('rarity');
    }
  });

  it('phase 0 has legendary rarity', () => {
    expect(PHASE_ACHIEVEMENTS[0]?.badge.rarity).toBe('legendary');
  });
});

/**
 * Creator Coin — Bonding Curve Math
 *
 * Implements a super-linear bonding curve with 5 eras.
 * Mirrors the Zora-style curve from @degenfeed/zora-sdk but
 * with additional live-stream boost support.
 *
 * All math uses BigInt with 18-decimal precision (EVM-compatible).
 */

// ─── Constants ───────────────────────────────────────────────────────────

export const TOTAL_SUPPLY = 1_000_000_000_000_000_000_000_000_000n; // 1B * 1e18
export const GRADUATION_SUPPLY = 800_000_000_000_000_000_000_000_000n; // 80%
export const MIN_PRICE = 1_000_000_000n; // 1 gwei
export const MAX_PRICE = 1_000_000_000_000n; // 1000 gwei
export const SCALING = 1_000_000n; // 1e6 fixed-point
export const PRICE_DECIMALS = 1_000_000_000n; // 1e9

// ─── Era Definitions ─────────────────────────────────────────────────────

export interface CurveEra {
  endSupply: bigint;
  exponent: number;
  slopeMultiplier: number;
  name: string;
  color: string;
}

export const CURVE_ERAS: CurveEra[] = [
  {
    endSupply: (GRADUATION_SUPPLY * 5n) / 100n,
    exponent: 2.2,
    slopeMultiplier: 3.0,
    name: 'Steal Deal',
    color: 'from-cyan-500 to-degen-400',
  },
  {
    endSupply: (GRADUATION_SUPPLY * 15n) / 100n,
    exponent: 1.6,
    slopeMultiplier: 1.8,
    name: 'Early Bird',
    color: 'from-degen-500 to-degen-400',
  },
  {
    endSupply: (GRADUATION_SUPPLY * 40n) / 100n,
    exponent: 1.0,
    slopeMultiplier: 1.0,
    name: 'Cruise',
    color: 'from-degen-400 to-yellow-400',
  },
  {
    endSupply: (GRADUATION_SUPPLY * 70n) / 100n,
    exponent: 1.5,
    slopeMultiplier: 1.5,
    name: 'FOMO Zone',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    endSupply: GRADUATION_SUPPLY,
    exponent: 2.0,
    slopeMultiplier: 2.2,
    name: 'Finale',
    color: 'from-orange-500 to-red-500',
  },
];

// ─── Core Price Functions ────────────────────────────────────────────────

export function getDynamicPrice(supply: bigint): bigint {
  if (supply >= GRADUATION_SUPPLY) return MAX_PRICE;

  const linearProgress = (supply * SCALING) / GRADUATION_SUPPLY;
  const era = getCurrentEra(supply);
  const curveEra = CURVE_ERAS[era];
  if (!curveEra) return MIN_PRICE;

  const eraStart = era === 0 ? 0n : (CURVE_ERAS[era - 1]?.endSupply ?? 0n);
  const eraEnd = curveEra.endSupply;
  const eraRange = eraEnd - eraStart;

  const rawPrice = MIN_PRICE + ((MAX_PRICE - MIN_PRICE) * linearProgress) / SCALING;
  const progressFraction =
    eraRange > 0n ? Number(((supply - eraStart) * SCALING) / eraRange) / Number(SCALING) : 0;

  const adjustedProgress = Math.max(0.001, progressFraction) ** curveEra.exponent;
  const eraBoost = 1 + (curveEra.slopeMultiplier - 1) * adjustedProgress;
  const adjustedPrice = Number(rawPrice) * eraBoost;

  if (adjustedPrice > Number(MAX_PRICE)) return MAX_PRICE;
  if (adjustedPrice < Number(MIN_PRICE)) return MIN_PRICE;

  return BigInt(Math.round(adjustedPrice));
}

export function getCurrentEra(supply: bigint): number {
  for (let i = 0; i < CURVE_ERAS.length; i++) {
    const era = CURVE_ERAS[i];
    if (era && supply <= era.endSupply) return i;
  }
  return CURVE_ERAS.length - 1;
}

export function getEraName(eraIndex: number): string {
  return CURVE_ERAS[eraIndex]?.name ?? 'Unknown';
}

export function getEraColor(eraIndex: number): string {
  return CURVE_ERAS[eraIndex]?.color ?? CURVE_ERAS[0]?.color;
}

// ─── Token Calculations ──────────────────────────────────────────────────

export function calculateTokensOut(amountNative: bigint, price: bigint): bigint {
  if (price === 0n) return 0n;
  return (amountNative * PRICE_DECIMALS) / price;
}

export function calculateNativeOut(
  tokensIn: bigint,
  price: bigint,
  feeBps: number = 50,
): { gross: bigint; fee: bigint; net: bigint } {
  if (price === 0n) return { gross: 0n, fee: 0n, net: 0n };
  const gross = (tokensIn * price) / PRICE_DECIMALS;
  const fee = (gross * BigInt(feeBps)) / 10_000n;
  return { gross, fee, net: gross - fee };
}

// ─── Live Stream Boost ───────────────────────────────────────────────────

/**
 * Apply a live-stream boost discount to the price.
 * When creator is live, buyers get a temporary discount.
 */
export function applyLiveBoost(basePrice: bigint, boostBps: number): bigint {
  if (boostBps <= 0 || boostBps > 1000) return basePrice;
  const discount = (basePrice * BigInt(boostBps)) / 10_000n;
  const boosted = basePrice - discount;
  return boosted < MIN_PRICE ? MIN_PRICE : boosted;
}

// ─── Utility ─────────────────────────────────────────────────────────────

export function formatPrice(price: bigint): string {
  const priceNum = Number(price) / 1e18;
  if (priceNum >= 1) return `${priceNum.toFixed(4)}`;
  if (priceNum >= 0.001) return `${priceNum.toFixed(6)}`;
  return `${priceNum.toFixed(8)}`;
}

export function calculateMarketCap(price: bigint, supply: bigint): bigint {
  return (price * supply) / PRICE_DECIMALS;
}

export function getProgressPercent(supply: bigint): number {
  if (supply >= GRADUATION_SUPPLY) return 100;
  return Number((supply * 100n) / GRADUATION_SUPPLY);
}

export function predictPriceAfterBuys(
  currentSupply: bigint,
  avgBuySizeWei: bigint,
  numBuys: number,
): bigint {
  let simulatedSupply = currentSupply;
  for (let i = 0; i < numBuys; i++) {
    const price = getDynamicPrice(simulatedSupply);
    const tokens = (avgBuySizeWei * PRICE_DECIMALS) / price;
    simulatedSupply += tokens;
  }
  return getDynamicPrice(simulatedSupply);
}

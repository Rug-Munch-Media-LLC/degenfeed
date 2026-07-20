/**
 * DegenFeed Dynamic Bonding Curve Math
 *
 * NOT just linear — this library implements:
 *   - Super-linear (quadratic) base curve: early buyers get disproportionately better prices
 *   - Stepped curve with "eras": each era has a different slope
 *   - Flash sales: time-limited price dips that decay back up
 *   - Creator-triggered events: "post → N buys at discount"
 *   - Referral boost: referrer and referee both get bonus tokens
 *   - Buy-streak multiplier: consecutive daily buys compound
 *
 * All math uses BigInt for EVM compatibility (18-decimal precision).
 * SCALING = 1_000_000n (1e6) for intermediate fixed-point math to avoid overflow.
 * PRICE_DECIMALS = 1_000_000_000n (1e9) for gwei-level precision.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const TOTAL_SUPPLY = 1_000_000_000_000_000_000_000_000_000n; // 1B * 1e18
export const GRADUATION_SUPPLY = 800_000_000_000_000_000_000_000_000n; // 80%
export const MIN_PRICE = 1_000_000_000n; // 1 gwei
export const MAX_PRICE = 1_000_000_000_000n; // 1000 gwei
export const SCALING = 1_000_000n; // 1e6 for internal fixed-point
export const PRICE_DECIMALS = 1_000_000_000n; // 1e9 (gwei)

// ─── Curve Era Definitions ───────────────────────────────────────────────────

/**
 * Bonding curve eras — each covers a supply range with its own slope coefficient.
 * Era 0 (0-5%):     steepest — early buyers get best deals (super-linear start)
 * Era 1 (5-15%):    moderate steep
 * Era 2 (15-40%):   gentle (linear-ish)
 * Era 3 (40-70%):   moderate steep again (FOMO acceleration)
 * Era 4 (70-100%):  steepest final push (scarcity)
 */
export interface CurveEra {
  /** Supply threshold (absolute, in wei-adjusted) at which this era ends */
  endSupply: bigint;
  /** Exponent for the price curve in this era (>1 = super-linear, 1 = linear, <1 = sub-linear) */
  exponent: number;
  /** Multiplier for the slope relative to linear baseline */
  slopeMultiplier: number;
}

export const CURVE_ERAS: CurveEra[] = [
  { endSupply: (GRADUATION_SUPPLY * 5n) / 100n, exponent: 2.2, slopeMultiplier: 3.0 },   // 0-5% — steal deal
  { endSupply: (GRADUATION_SUPPLY * 15n) / 100n, exponent: 1.6, slopeMultiplier: 1.8 },  // 5-15% — early
  { endSupply: (GRADUATION_SUPPLY * 40n) / 100n, exponent: 1.0, slopeMultiplier: 1.0 },  // 15-40% — cruise
  { endSupply: (GRADUATION_SUPPLY * 70n) / 100n, exponent: 1.5, slopeMultiplier: 1.5 },  // 40-70% — FOMO
  { endSupply: GRADUATION_SUPPLY, exponent: 2.0, slopeMultiplier: 2.2 },                  // 70-100% — finale
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlashSale {
  /** Whether a flash sale is currently active */
  active: boolean;
  /** Discount in bps (e.g., 200 = 2% off) */
  discountBps: number;
  /** When the flash sale ends (unix ms) */
  endTimestamp: number;
  /** Maximum number of discounted buys */
  maxBuys: number;
  /** How many discounted buys have been used */
  buysUsed: number;
}

export interface CreatorEvent {
  /** Whether a creator-triggered event is active */
  active: boolean;
  /** Discount in bps for the next N buys */
  discountBps: number;
  /** Number of buys this event covers */
  remainingBuys: number;
  /** Total buys this event covers */
  totalBuys: number;
  /** Creator's message/description */
  message: string;
}

export interface ReferralBoost {
  /** Bonus tokens for referrer (basis points of purchase) */
  referrerBps: number;
  /** Bonus tokens for referee (basis points of purchase) */
  refereeBps: number;
}

export interface CurveState {
  /** Current supply minted */
  supply: bigint;
  /** Current price per token (wei) */
  currentPrice: bigint;
  /** Which era the curve is in */
  currentEra: number;
  /** Progress to graduation (0-1e18 fixed-point) */
  progress: bigint;
  /** Active flash sale (if any) */
  flashSale: FlashSale | null;
  /** Active creator event (if any) */
  creatorEvent: CreatorEvent | null;
  /** Price prediction if N more people buy (average buy size) */
  predictPriceAfterBuys: (n: number, avgBuySize: bigint) => bigint;
}

// ─── Core Price Calculation ──────────────────────────────────────────────────

/**
 * Calculate the current price on the **dynamic** bonding curve.
 *
 * For a given supply, finds the era and computes:
 *   eraProgress = (supply - eraStart) / (eraEnd - eraStart)  [0-1]
 *   rawPrice = MIN_PRICE + (MAX_PRICE - MIN_PRICE) * overallProgress^exponent
 *
 * The exponent makes it super-linear: early era → higher exponent → price
 * stays lower longer, then accelerates.
 */
export function getDynamicPrice(supply: bigint): bigint {
  if (supply >= GRADUATION_SUPPLY) return MAX_PRICE;

  // Overall linear progress (0 to SCALING)
  const linearProgress = (supply * SCALING) / GRADUATION_SUPPLY;

  // Find current era
  const era = getCurrentEra(supply);

  // Compute era-local progress for the exponent adjustment
  const eraStart = era === 0 ? 0n : CURVE_ERAS[era - 1]!.endSupply;
  const eraEnd = CURVE_ERAS[era]!.endSupply;
  const eraRange = eraEnd - eraStart;

  // Spline: blend the linear progress with an era-local exponent
  // This gives smooth acceleration across eras
  const rawPrice = MIN_PRICE + ((MAX_PRICE - MIN_PRICE) * linearProgress) / SCALING;

  // Apply era exponent to make it super-linear
  // At low progress, price stays lower; at high progress, it accelerates
  const progressFraction = eraRange > 0n
    ? Number((supply - eraStart) * SCALING / eraRange) / Number(SCALING)
    : 0;

  const exponent = CURVE_ERAS[era]!.exponent;
  const slopeMul = CURVE_ERAS[era]!.slopeMultiplier;

  // Era-adjusted price: amplify by slope multiplier, shaped by exponent
  const adjustedProgress = Math.pow(Math.max(0.001, progressFraction), exponent);
  const eraBoost = 1 + (slopeMul - 1) * adjustedProgress;
  const adjustedPrice = Number(rawPrice) * eraBoost;

  // Clamp
  if (adjustedPrice > Number(MAX_PRICE)) return MAX_PRICE;
  if (adjustedPrice < Number(MIN_PRICE)) return MIN_PRICE;

  return BigInt(Math.round(adjustedPrice));
}

/**
 * Get the current era index for a given supply.
 */
export function getCurrentEra(supply: bigint): number {
  for (let i = 0; i < CURVE_ERAS.length; i++) {
    if (supply <= CURVE_ERAS[i]!.endSupply) return i;
  }
  return CURVE_ERAS.length - 1;
}

/**
 * Get the current era's human-readable name.
 */
export function getEraName(supply: bigint): string {
  const i = getCurrentEra(supply);
  const names = ['Steal Deal', 'Early Bird', 'Cruise', 'FOMO Zone', 'Finale'];
  return names[i] ?? 'Unknown';
}

/**
 * Get the current era's color for UI.
 */
export function getEraColor(supply: bigint): string {
  const colors = ['from-cyan-500 to-degen-400', 'from-degen-500 to-degen-400', 'from-degen-400 to-yellow-400', 'from-yellow-400 to-orange-500', 'from-orange-500 to-red-500'];
  return colors[getCurrentEra(supply)] ?? colors[0]!;
}

// ─── Token/SOL Calculations ──────────────────────────────────────────────────

/**
 * Calculate tokens out for a given ETH/SOL amount at the current price.
 * Includes referral boost if active.
 */
export function calculateTokensOut(
  amountWei: bigint,
  price: bigint,
  referralBoost?: ReferralBoost | null,
): { tokens: bigint; referrerBonus: bigint; refereeBonus: bigint } {
  if (price === 0n) return { tokens: 0n, referrerBonus: 0n, refereeBonus: 0n };

  const tokens = (amountWei * PRICE_DECIMALS) / price;

  let referrerBonus = 0n;
  let refereeBonus = 0n;

  if (referralBoost) {
    referrerBonus = (tokens * BigInt(referralBoost.referrerBps)) / 10_000n;
    refereeBonus = (tokens * BigInt(referralBoost.refereeBps)) / 10_000n;
  }

  return { tokens, referrerBonus, refereeBonus };
}

/**
 * Calculate ETH out for a given token amount at the current price.
 */
export function calculateEthOut(
  tokensIn: bigint,
  price: bigint,
  feeBps: number = 50, // default 0.5%
): { grossEth: bigint; fee: bigint; netEth: bigint } {
  if (price === 0n) return { grossEth: 0n, fee: 0n, netEth: 0n };

  const grossEth = (tokensIn * price) / PRICE_DECIMALS;
  const fee = (grossEth * BigInt(feeBps)) / 10_000n;
  const netEth = grossEth - fee;

  return { grossEth, fee, netEth };
}

// ─── Flash Sale Math ─────────────────────────────────────────────────────────

/**
 * Apply flash sale discount to a price.
 * Discount decays linearly over the flash sale window.
 */
export function applyFlashSaleDiscount(
  basePrice: bigint,
  flashSale: FlashSale,
): bigint {
  if (!flashSale.active) return basePrice;

  const now = Date.now();
  const elapsed = now - (flashSale.endTimestamp - 300_000); // assume 5-min window
  const totalDuration = 300_000; // 5 minutes
  const decay = Math.min(1, Math.max(0, elapsed / totalDuration));
  const effectiveDiscount = flashSale.discountBps * (1 - decay);

  const discount = (basePrice * BigInt(Math.round(effectiveDiscount))) / 10_000n;
  return basePrice - discount > MIN_PRICE ? basePrice - discount : MIN_PRICE;
}

/**
 * Calculate the optimal flash sale discount to create FOMO.
 * Targets: price dips 3-8% below current curve price.
 */
export function calculateFlashSaleDiscount(price: bigint): FlashSale {
  // Random-ish discount between 3% and 8% (300-800 bps)
  const discountBps = 300 + Math.floor(Math.random() * 500);
  return {
    active: true,
    discountBps,
    endTimestamp: Date.now() + 300_000, // 5 minutes
    maxBuys: 20,
    buysUsed: 0,
  };
}

// ─── Creator Event Math ──────────────────────────────────────────────────────

/**
 * Calculate the price with a creator event discount applied.
 */
export function applyCreatorEventDiscount(
  basePrice: bigint,
  event: CreatorEvent,
): bigint {
  if (!event.active || event.remainingBuys <= 0) return basePrice;

  const discount = (basePrice * BigInt(event.discountBps)) / 10_000n;
  return basePrice - discount > MIN_PRICE ? basePrice - discount : MIN_PRICE;
}

// ─── Streak & Gamification Math ──────────────────────────────────────────────

/**
 * Calculate streak multiplier for buy amount.
 * Day 1-2: 1x, Day 3: 1.1x, Day 4: 1.2x, Day 5: 1.3x, Day 6: 1.4x, Day 7+: 2x
 */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 2.0;
  if (streakDays >= 6) return 1.4;
  if (streakDays >= 5) return 1.3;
  if (streakDays >= 4) return 1.2;
  if (streakDays >= 3) return 1.1;
  return 1.0;
}

/**
 * Calculate bonus tokens from a streak.
 */
export function calculateStreakBonus(
  baseTokens: bigint,
  streakDays: number,
): bigint {
  const multiplier = getStreakMultiplier(streakDays);
  if (multiplier <= 1.0) return 0n;
  const bonusFraction = BigInt(Math.round((multiplier - 1) * 10000));
  return (baseTokens * bonusFraction) / 10_000n;
}

/**
 * Check if a streak is still alive (buy within 36 hours of last buy).
 */
export function isStreakAlive(lastBuyTimestamp: number, now: number = Date.now()): boolean {
  return (now - lastBuyTimestamp) < 36 * 60 * 60 * 1000; // 36 hours grace
}

// ─── Price Prediction ────────────────────────────────────────────────────────

/**
 * Predict the price after N more buys of a given average size.
 * Useful for "If 10 more people buy, price goes to X" overlay.
 */
export function predictPriceAfterBuys(
  currentSupply: bigint,
  avgBuySizeWei: bigint,
  numBuys: number,
): bigint {
  let simulatedSupply = currentSupply;
  let finalPrice = getDynamicPrice(simulatedSupply);

  for (let i = 0; i < numBuys; i++) {
    const price = getDynamicPrice(simulatedSupply);
    const tokens = (avgBuySizeWei * PRICE_DECIMALS) / price;
    simulatedSupply += tokens;
    finalPrice = getDynamicPrice(simulatedSupply);
  }

  return finalPrice;
}

/**
 * Calculate how many more buys (of average size) until the next price milestone.
 */
export function buysUntilPriceTarget(
  currentSupply: bigint,
  avgBuySizeWei: bigint,
  targetPrice: bigint,
): number {
  let simulatedSupply = currentSupply;
  let buys = 0;

  // Cap at 1000 iterations to prevent infinite loops
  while (buys < 1000) {
    const price = getDynamicPrice(simulatedSupply);
    if (price >= targetPrice) return buys;
    const tokens = (avgBuySizeWei * PRICE_DECIMALS) / price;
    simulatedSupply += tokens;
    buys++;
  }

  return 1000; // More than 1000 buys needed
}

// ─── Graduation Math ─────────────────────────────────────────────────────────

/**
 * Calculate the graduation threshold (80% supply + unique buyers >= 50).
 */
export function getGraduationProgress(supply: bigint, uniqueBuyers: number): number {
  const supplyProgress = Number((supply * 100n) / GRADUATION_SUPPLY);
  const buyerProgress = Math.min(100, (uniqueBuyers / 50) * 100);
  // Graduation requires BOTH conditions
  return Math.min(supplyProgress, buyerProgress);
}

/**
 * Calculate what the price would be post-graduation on Uniswap V4.
 * Assumes initial liquidity = remaining ETH + remaining tokens at current curve price.
 */
export function estimateUniswapPrice(
  curveEthBalance: bigint,
  curveTokenSupply: bigint,
  currentPrice: bigint,
): bigint {
  // Rough estimate: the AMM price after migrating liquidity
  // Simplified: assuming equivalent value on both sides
  return currentPrice; // In practice, depends on pool initialization
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Format a price for display — auto-scales.
 */
export function formatCurvePrice(price: bigint): string {
  const priceNum = Number(price) / 1e18;
  if (priceNum >= 1) return `$${priceNum.toFixed(4)}`;
  if (priceNum >= 0.001) return `$${priceNum.toFixed(6)}`;
  return `$${priceNum.toFixed(8)}`;
}

/**
 * Calculate market cap from price and total supply.
 */
export function calculateMarketCap(price: bigint, totalSupply: bigint): bigint {
  return (price * totalSupply) / PRICE_DECIMALS;
}

/**
 * Get the bonding curve progress as a 0-100 number.
 */
export function getProgressPercent(supply: bigint): number {
  if (supply >= GRADUATION_SUPPLY) return 100;
  return Number((supply * 100n) / GRADUATION_SUPPLY);
}

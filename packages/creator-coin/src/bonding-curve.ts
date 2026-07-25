/**
 * Creator Coin 2.0 — Bonding Curve (Phase System)
 *
 * Super-linear bonding curve with 5 named phases:
 * 0: "Steal Deal"     (0-20%)    — lowest price, FOMO-inducing
 * 1: "Early Bird"     (20-40%)   — still cheap, bragging rights
 * 2: "Cruise Control" (40-60%)   — steady growth
 * 3: "Final Call"     (60-80%)   — last chance, urgency
 * 4: "Moonshot"       (80-100%)  — graduation imminent!
 *
 * Features:
 * - Visual progress data for animated UI
 * - Phase-specific colors and icons
 * - Urgency messaging
 * - Sound effect triggers
 * - Leaderboard-style price predictions
 */

import {
  BONDING_PHASES,
  type BondingPhase,
  type BondingPhaseInfo,
  type VisualProgress,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────

export const TOTAL_SUPPLY = 1_000_000_000_000_000_000_000_000_000n; // 1B * 1e18
export const GRADUATION_SUPPLY = 800_000_000_000_000_000_000_000_000n; // 80%
export const MIN_PRICE = 1_000_000_000n; // 1 gwei
export const MAX_PRICE = 1_000_000_000_000n; // 1000 gwei
export const SCALING = 1_000_000n; // 1e6 fixed-point
export const PRICE_DECIMALS = 1_000_000_000n; // 1e9

// ─── Phase Definitions ───────────────────────────────────────────────────

export interface CurveEra {
  endSupply: bigint;
  exponent: number;
  slopeMultiplier: number;
  name: string;
  color: string;
  icon: string;
}

export const CURVE_ERAS: CurveEra[] = BONDING_PHASES.map((phase) => {
  const _startSupply = (GRADUATION_SUPPLY * BigInt(phase.startPercent)) / 100n;
  const endSupply = (GRADUATION_SUPPLY * BigInt(phase.endPercent)) / 100n;

  // Different exponents for each phase to create the desired feel:
  // Steal Deal: very steep rise (low entry, quick gains for first buyers)
  // Early Bird: moderate rise
  // Cruise Control: linear/slight curve (steady)
  // Final Call: steepening (FOMO)
  // Moonshot: very steep (urgency)
  const exponentMap: Record<number, number> = {
    0: 2.2, // Steal Deal — aggressive early curve
    1: 1.6, // Early Bird — moderate
    2: 1.0, // Cruise Control — linear
    3: 1.5, // Final Call — steepening
    4: 2.0, // Moonshot — very steep
  };

  const slopeMap: Record<number, number> = {
    0: 3.0,
    1: 1.8,
    2: 1.0,
    3: 1.5,
    4: 2.2,
  };

  return {
    endSupply,
    exponent: exponentMap[phase.index] ?? 1.0,
    slopeMultiplier: slopeMap[phase.index] ?? 1.0,
    name: phase.name,
    color: phase.color,
    icon: phase.icon,
  };
});

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
  return CURVE_ERAS[eraIndex]?.color ?? CURVE_ERAS[0]?.color ?? '';
}

export function getEraIcon(eraIndex: number): string {
  return CURVE_ERAS[eraIndex]?.icon ?? '🚀';
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

// ─── Bonding Curve 2.0: Visual Progress ─────────────────────────────────

/**
 * Get the visual progress data for the animated UI.
 */
export function getVisualProgress(supply: bigint, currentPrice: bigint): VisualProgress {
  const eraIndex = getCurrentEra(supply);
  const phase = BONDING_PHASES[eraIndex];
  const progressPercent = getProgressPercent(supply);

  if (!phase) {
    return {
      colorGradient: 'from-green-500 to-green-500',
      icon: '✅',
      phaseProgress: 100,
      priceChangePercent: 0,
      urgencyMessage: 'Graduated!',
    };
  }

  const phaseProgress =
    progressPercent >= phase.endPercent
      ? 100
      : Math.round(
          ((progressPercent - phase.startPercent) / (phase.endPercent - phase.startPercent)) * 100,
        );

  // Calculate price change since phase start
  const phaseStartSupply = (GRADUATION_SUPPLY * BigInt(phase.startPercent)) / 100n;
  const phaseStartPrice = phaseStartSupply > 0n ? getDynamicPrice(phaseStartSupply) : MIN_PRICE;
  const priceChangePercent =
    phaseStartPrice > 0n
      ? Math.round((Number(currentPrice - phaseStartPrice) / Number(phaseStartPrice)) * 100)
      : 0;

  return {
    colorGradient: phase.color,
    icon: phase.icon,
    phaseProgress,
    priceChangePercent,
    urgencyMessage: phase.urgencyMessage,
  };
}

/**
 * Get current bonding phase info for display.
 */
export function getBondingPhaseInfo(supply: bigint): BondingPhaseInfo {
  const index = getCurrentEra(supply);
  const phase = BONDING_PHASES[index];
  const progress = getProgressPercent(supply);

  if (!phase) {
    return {
      index: 4,
      name: 'Graduated',
      progress: 100,
      color: 'from-green-500 to-green-500',
      icon: '✅',
    };
  }

  return {
    index: phase.index,
    name: phase.name,
    progress,
    color: phase.color,
    icon: phase.icon,
  };
}

/**
 * Get the phase for a given progress percent.
 */
export function getPhaseByProgress(progressPercent: number): BondingPhase {
  const phase = BONDING_PHASES.find(
    (p) => progressPercent >= p.startPercent && progressPercent < p.endPercent,
  );
  return phase ?? BONDING_PHASES[BONDING_PHASES.length - 1]!;
}

/**
 * Get next phase (for "coming soon" display).
 */
export function getNextPhase(currentPhaseIndex: number): BondingPhase | null {
  if (currentPhaseIndex >= BONDING_PHASES.length - 1) return null;
  return BONDING_PHASES[currentPhaseIndex + 1] ?? null;
}

/**
 * Get estimated time to next phase (requires historical data).
 */
export function estimateTimeToNextPhase(
  currentSupply: bigint,
  averageBuyRateWeiPerSecond: bigint,
): { estimatedSeconds: number; nextPhase: BondingPhase | null } {
  const currentEra = getCurrentEra(currentSupply);
  const nextPhase = getNextPhase(currentEra);

  if (!nextPhase) return { estimatedSeconds: 0, nextPhase: null };

  const targetSupply = (GRADUATION_SUPPLY * BigInt(nextPhase.endPercent)) / 100n;
  const supplyRemaining = targetSupply - currentSupply;

  if (supplyRemaining <= 0n) return { estimatedSeconds: 0, nextPhase };
  if (averageBuyRateWeiPerSecond <= 0n) return { estimatedSeconds: -1, nextPhase };

  // Rough estimate: convert wei/second to tokens/second at current price
  const currentPrice = getDynamicPrice(currentSupply);
  const tokensPerSecond = (averageBuyRateWeiPerSecond * PRICE_DECIMALS) / currentPrice;
  if (tokensPerSecond <= 0n) return { estimatedSeconds: -1, nextPhase };

  const estimatedSeconds = Number(supplyRemaining / tokensPerSecond);
  return { estimatedSeconds, nextPhase };
}

/**
 * Generate the animated SVG path for the bonding curve visualization.
 */
export function generateCurveSvgPath(
  width: number,
  height: number,
  _currentSupply: bigint,
): string {
  const points: string[] = [];
  const totalPoints = 100; // resolution

  for (let i = 0; i <= totalPoints; i++) {
    const supplyAtPoint = (GRADUATION_SUPPLY * BigInt(i)) / BigInt(totalPoints);
    const priceAtPoint = getDynamicPrice(supplyAtPoint);

    const x = (width * i) / totalPoints;
    const y = height - Number((priceAtPoint * BigInt(height)) / MAX_PRICE);

    points.push(`${x},${y}`);
  }

  return `M0,${height} L${points.join(' L')}`;
}

/**
 * Phase achievements/badges that unlock at each phase.
 */
export const PHASE_ACHIEVEMENTS = BONDING_PHASES.map((phase) => ({
  phaseIndex: phase.index,
  phaseName: phase.name,
  badge: {
    type:
      phase.index === 0
        ? ('early_adopter' as const)
        : phase.index === 3
          ? ('early_adopter' as const)
          : ('super_fan' as const),
    name: `Phase ${phase.index + 1}: ${phase.name}`,
    icon: phase.icon,
    description: `Bought during ${phase.name} phase`,
    rarity: (phase.index === 0
      ? 'legendary'
      : phase.index <= 1
        ? 'epic'
        : phase.index <= 2
          ? 'rare'
          : 'uncommon') as 'legendary' | 'epic' | 'rare' | 'uncommon',
  },
}));

/**
 * @degenfeed/monetization — FeatureGate
 *
 * Client and server-side feature gating for premium features.
 * Provides React components (PremiumGate, FeatureGuard) and
 * pure utility functions for checking access.
 *
 * Server-side usage:
 *   import { checkAccess } from '@degenfeed/monetization/feature-gate';
 *   if (!checkAccess('pro', 'cross_platform_publishing')) {
 *     return new Response('Upgrade required', { status: 402 });
 *   }
 *
 * Client-side usage:
 *   import { PremiumGate } from '@degenfeed/monetization/feature-gate';
 *   <PremiumGate tier="pro" feature="Cross-Platform Publishing">
 *     <YourComponent />
 *   </PremiumGate>
 */

import React from 'react';
import { TierManager } from './TierManager';
import {
  FEATURE_LABELS,
  FEATURE_TIER_MAP,
  type FeatureFlag,
  type SubscriptionTier,
  TIER_NAMES,
  TIER_RANK,
} from './types';

// ─── Pure Feature Checks ─────────────────────────────────────────────────

export interface FeatureCheckResult {
  /** Whether the user can access this feature */
  allowed: boolean;
  /** The user's current tier */
  userTier: SubscriptionTier;
  /** The minimum tier required */
  requiredTier: SubscriptionTier;
  /** Human-readable required tier name */
  requiredTierName: string;
  /** Human-readable feature name */
  featureName: string;
  /** Suggested upgrade path */
  upgradeTo: SubscriptionTier | null;
  /** URL-friendly upgrade path */
  upgradeUrl: string | null;
}

/**
 * Pure function: check if a user on a given tier can access a feature.
 * Works on both client and server.
 */
export function checkAccess(
  userTier: SubscriptionTier | string,
  feature: FeatureFlag,
): FeatureCheckResult {
  const normalizedTier = normalizeTier(userTier);
  const requiredTier = FEATURE_TIER_MAP[feature];
  const allowed = TIER_RANK[normalizedTier] >= TIER_RANK[requiredTier];

  // Find the cheapest tier that grants access
  const upgradeTo = allowed ? null : findUpgradeTier(normalizedTier, requiredTier);

  return {
    allowed,
    userTier: normalizedTier,
    requiredTier,
    requiredTierName: TIER_NAMES[requiredTier],
    featureName: FEATURE_LABELS[feature] ?? feature,
    upgradeTo,
    upgradeUrl: upgradeTo ? `/pricing?upgrade=${upgradeTo}` : null,
  };
}

/**
 * Check multiple features at once. Useful for route guards.
 */
export function checkAllAccess(
  userTier: SubscriptionTier,
  features: FeatureFlag[],
): Record<string, FeatureCheckResult> {
  const results: Record<string, FeatureCheckResult> = {};
  for (const f of features) {
    results[f] = checkAccess(userTier, f);
  }
  return results;
}

/**
 * Check if user has a bulk set of features (AND logic — all must pass).
 */
export function requireAll(
  userTier: SubscriptionTier,
  features: FeatureFlag[],
): { allowed: boolean; failing: FeatureCheckResult[] } {
  const failing: FeatureCheckResult[] = [];
  for (const f of features) {
    const result = checkAccess(userTier, f);
    if (!result.allowed) failing.push(result);
  }
  return { allowed: failing.length === 0, failing };
}

/**
 * Check if user has at least one of the features (OR logic).
 */
export function requireAny(
  userTier: SubscriptionTier,
  features: FeatureFlag[],
): { allowed: boolean; passing: FeatureCheckResult[] } {
  const passing: FeatureCheckResult[] = [];
  for (const f of features) {
    const result = checkAccess(userTier, f);
    if (result.allowed) passing.push(result);
  }
  return { allowed: passing.length > 0, passing };
}

/**
 * Get a summary of all features accessible at a given tier.
 */
export function getAccessibleFeatures(tier: SubscriptionTier): FeatureFlag[] {
  return (Object.keys(FEATURE_TIER_MAP) as FeatureFlag[]).filter((f) =>
    TierManager.canAccess(tier, f),
  );
}

/**
 * Get a list of features the user CANNOT access, grouped by upgrade path.
 */
export function getBlockedFeatures(
  userTier: SubscriptionTier,
): Map<SubscriptionTier, FeatureFlag[]> {
  const blocked = new Map<SubscriptionTier, FeatureFlag[]>();
  for (const [feature, requiredTier] of Object.entries(FEATURE_TIER_MAP)) {
    if (TIER_RANK[userTier] < TIER_RANK[requiredTier]) {
      const existing = blocked.get(requiredTier) ?? [];
      existing.push(feature as FeatureFlag);
      blocked.set(requiredTier, existing);
    }
  }
  return blocked;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function normalizeTier(tier: string): SubscriptionTier {
  const validTiers: SubscriptionTier[] = ['free', 'creator', 'pro', 'enterprise'];
  if (validTiers.includes(tier as SubscriptionTier)) {
    return tier as SubscriptionTier;
  }
  // Map legacy tier names
  const legacyMap: Record<string, SubscriptionTier> = {
    basic: 'free',
    platinum: 'pro',
  };
  return legacyMap[tier.toLowerCase()] ?? 'free';
}

function findUpgradeTier(
  currentTier: SubscriptionTier,
  requiredTier: SubscriptionTier,
): SubscriptionTier | null {
  const allTiers: SubscriptionTier[] = ['creator', 'pro', 'enterprise'];
  for (const t of allTiers) {
    if (TIER_RANK[t] >= TIER_RANK[requiredTier] && TIER_RANK[t] > TIER_RANK[currentTier]) {
      return t;
    }
  }
  return null;
}

// ─── React Components (Client-side only wrappers) ────────────────────────

/**
 * Props for the PremiumGate component.
 */
export interface PremiumGateProps {
  /** The user's current tier (from usePremium or context) */
  userTier: SubscriptionTier;
  /** Feature to check access for */
  feature: FeatureFlag;
  /** What to render when access IS granted */
  children: React.ReactNode;
  /** What to render when access is NOT granted (optional) */
  fallback?: React.ReactNode;
  /** Whether to blur the children instead of hiding them */
  blur?: boolean;
  /** Icon to show in the upgrade prompt */
  icon?: string;
}

/**
 * Client-side gate component. Wraps premium features.
 * Shows an upgrade prompt when user doesn't have access.
 *
 * Usage:
 *   <PremiumGate userTier={tier} feature="cross_platform_publishing">
 *     <CrossPostScheduler />
 *   </PremiumGate>
 *
 * NOTE: This is a pure logic component. The actual UI rendering
 * of the upgrade prompt should be handled by the consuming app.
 * This component simply calls checkAccess() and conditionally renders.
 */
export function PremiumGate({
  userTier,
  feature,
  children,
  fallback,
  blur = true,
}: PremiumGateProps) {
  const { allowed, requiredTierName, featureName } = checkAccess(userTier, feature);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (blur) {
    return (
      <div className="relative group">
        <div className="pointer-events-none select-none blur-sm opacity-40">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-amber-500/20 bg-[var(--color-card)]/95 backdrop-blur-sm p-5 text-center mx-4 max-w-xs shadow-xl">
            <div className="mb-2 text-2xl">⭐</div>
            <p className="text-sm font-bold text-[var(--color-fg)] mb-1">{featureName}</p>
            <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
              Upgrade to {requiredTierName} to unlock {featureName}.
            </p>
            <a
              href={`/pricing?upgrade=${userTier}`}
              className="inline-block w-full rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors text-center"
            >
              Upgrade to {requiredTierName}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

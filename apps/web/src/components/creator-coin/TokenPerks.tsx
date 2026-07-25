'use client';

/**
 * TokenPerks — Creator token-gated perks (TASK 5)
 *
 * Shows what holders get at each tier level:
 *   Tier 1 (1+):     Holder posts, community polls, badge
 *   Tier 2 (100+):   AMA access, early content, Discord role
 *   Tier 3 (1k+):    Revenue share, governance, flair, 1-on-1 call
 *   Tier 4 (10k+):   Co-create, hall of fame, whitelist, private chat
 *
 * Includes animated progress bars for next tier and auto-scroll to highlight.
 */

import { useEffect, useMemo, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TokenPerksProps {
  symbol: string;
  userBalance?: number;
  className?: string;
}

interface Tier {
  level: number;
  minTokens: number;
  label: string;
  icon: string;
  color: string;
  perks: string[];
}

// ─── Tier Definitions ──────────────────────────────────────────────────────

const TIERS: Tier[] = [
  {
    level: 1,
    minTokens: 1,
    label: 'Holder',
    icon: '🥉',
    color: 'from-gray-500 to-gray-400',
    perks: ['Access to holder-only posts', 'Vote in community polls', 'Holder badge on profile'],
  },
  {
    level: 2,
    minTokens: 100,
    label: 'Believer',
    icon: '🥈',
    color: 'from-slate-300 to-gray-200',
    perks: [
      'Everything in Tier 1',
      'Monthly AMA with creator',
      'Early access to new content',
      'Discord/Telegram holder role',
    ],
  },
  {
    level: 3,
    minTokens: 1000,
    label: 'Diamond',
    icon: '🥇',
    color: 'from-yellow-400 to-amber-500',
    perks: [
      'Everything in Tier 2',
      'Revenue share (% of creator tips)',
      'Governance voting power',
      'Custom holder color/flair',
      '1-on-1 call with creator (once)',
    ],
  },
  {
    level: 4,
    minTokens: 10000,
    label: 'Legend',
    icon: '👑',
    color: 'from-purple-500 to-pink-500',
    perks: [
      'Everything in Tier 3',
      'Co-create content with creator',
      'Name in credits / Hall of Fame',
      'Whitelist for future drops',
      'Private chat with creator',
    ],
  },
];

// ─── Perk Row ──────────────────────────────────────────────────────────────

function PerkRow({ perk, unlocked }: { perk: string; unlocked: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 text-[11px] ${unlocked ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)] opacity-50'}`}
    >
      <span className={`shrink-0 ${unlocked ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}>
        {unlocked ? '✓' : '○'}
      </span>
      <span>{perk}</span>
    </div>
  );
}

// ─── Tier Card ─────────────────────────────────────────────────────────────

function TierCard({
  tier,
  isUnlocked,
  isNext,
  userBalance,
  symbol,
  tierRef,
}: {
  tier: Tier;
  isUnlocked: boolean;
  isNext: boolean;
  userBalance: number;
  symbol: string;
  tierRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // Animated progress for the next tier
  const prevTierMin = TIERS[Math.max(0, tier.level - 2)]?.minTokens ?? 0;
  const nextProgress =
    isNext && !isUnlocked
      ? Math.min(
          100,
          Math.round(((userBalance - prevTierMin) / (tier.minTokens - prevTierMin)) * 100),
        )
      : 0;

  return (
    <div
      ref={tierRef}
      className={`rounded-xl border p-4 transition-all duration-500 ${
        isUnlocked
          ? 'border-degen-500/30 bg-degen-500/5 shadow-[0_0_15px_rgba(0,255,65,0.06)] animate-scale-in'
          : isNext
            ? 'border-amber-500/20 bg-amber-500/5 ring-1 ring-amber-500/10'
            : 'border-[var(--color-glass-border)] bg-[var(--color-card)] opacity-60'
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{tier.icon}</span>
          <div>
            <div className="text-xs font-bold text-[var(--color-fg)]">{tier.label}</div>
            <div className="text-[9px] text-[var(--color-muted)]">
              {tier.minTokens.toLocaleString()}+ {symbol}
            </div>
          </div>
        </div>
        {isUnlocked && (
          <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
            Unlocked
          </span>
        )}
        {isNext && !isUnlocked && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
            Next
          </span>
        )}
      </div>

      {/* Animated Progress bar for next tier */}
      {isNext && !isUnlocked && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[9px] text-[var(--color-muted)] mb-1">
            <span>Progress</span>
            <span className="tabular-nums">
              {userBalance.toLocaleString()} / {tier.minTokens.toLocaleString()} {symbol}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 transition-all duration-700 ease-out"
              style={{ width: `${nextProgress}%` }}
            />
          </div>
          {nextProgress > 0 && (
            <p className="mt-0.5 text-right text-[8px] text-amber-400/70">
              {nextProgress}% of the way — {tier.minTokens - userBalance} to go
            </p>
          )}
        </div>
      )}

      {/* Perks */}
      <div className="space-y-1.5">
        {tier.perks.map((perk) => (
          <PerkRow key={perk} perk={perk} unlocked={isUnlocked} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function TokenPerks({ symbol, userBalance = 0, className = '' }: TokenPerksProps) {
  const nextTierRef = useRef<HTMLDivElement | null>(null);

  const userTier = useMemo(() => {
    let highest = 0;
    for (const tier of TIERS) {
      if (userBalance >= tier.minTokens) highest = tier.level;
    }
    return highest;
  }, [userBalance]);

  const nextTierLevel = useMemo(() => {
    for (const tier of TIERS) {
      if (userBalance < tier.minTokens) return tier.level;
    }
    return null;
  }, [userBalance]);

  // Auto-scroll next tier into view on mount and when balance crosses a threshold
  useEffect(() => {
    if (nextTierRef.current && nextTierLevel !== null) {
      nextTierRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [nextTierLevel]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Token-Gated Perks</h3>
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              Hold ${symbol} to unlock exclusive benefits
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-black tabular-nums text-degen-400">
              {userBalance.toLocaleString()}
            </div>
            <div className="text-[9px] text-[var(--color-muted)]">your balance</div>
          </div>
        </div>

        {/* Your tier badge */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--color-overlay)] px-3 py-2 transition-all duration-300">
          <span className="text-lg">{userTier >= 1 ? TIERS[userTier - 1]?.icon : '🔒'}</span>
          <div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              {userTier >= 1 ? `${TIERS[userTier - 1]?.label ?? ''} Tier` : 'No perks yet'}
            </div>
            <div className="text-[9px] text-[var(--color-muted)]">
              {userTier >= 1
                ? `${TIERS[userTier - 1]?.perks.length ?? 0} perks unlocked`
                : `Buy ${symbol} to unlock holder perks`}
            </div>
          </div>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid gap-3">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.level}
            tier={tier}
            isUnlocked={userBalance >= tier.minTokens}
            isNext={nextTierLevel === tier.level}
            userBalance={userBalance}
            symbol={symbol}
            tierRef={nextTierLevel === tier.level ? nextTierRef : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export type { Tier };
export { TIERS };

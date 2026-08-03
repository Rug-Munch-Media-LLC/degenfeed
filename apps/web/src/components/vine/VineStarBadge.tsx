'use client';

/**
 * VineStarBadge — Vine Star tier badge for top creators.
 *
 * Tiers:
 *   🥉 Bronze — 500+ total vibe score
 *   🥈 Silver — 1000+ total vibe score
 *   🥇 Gold — 2000+ total vibe score
 *   💎 Platinum — 5000+ total vibe score
 *   👑 Diamond — 10000+ total vibe score
 *
 * Each tier has distinct visual styling, emoji, and glow effects.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type VineStarTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface VineStarBadgeProps {
  tier: VineStarTier;
  compact?: boolean;
  showLabel?: boolean;
  animate?: boolean;
}

// ─── Tier Config ──────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  VineStarTier,
  {
    label: string;
    emoji: string;
    color: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
    minScore: number;
  }
> = {
  bronze: {
    label: 'Bronze Vine Star',
    emoji: '🥉',
    color: '#CD7F32',
    bgColor: 'rgba(205, 127, 50, 0.15)',
    borderColor: 'rgba(205, 127, 50, 0.4)',
    glowColor: 'rgba(205, 127, 50, 0.3)',
    minScore: 500,
  },
  silver: {
    label: 'Silver Vine Star',
    emoji: '🥈',
    color: '#C0C0C0',
    bgColor: 'rgba(192, 192, 192, 0.15)',
    borderColor: 'rgba(192, 192, 192, 0.4)',
    glowColor: 'rgba(192, 192, 192, 0.3)',
    minScore: 1000,
  },
  gold: {
    label: 'Gold Vine Star',
    emoji: '🥇',
    color: '#FFD700',
    bgColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
    glowColor: 'rgba(255, 215, 0, 0.3)',
    minScore: 2000,
  },
  platinum: {
    label: 'Platinum Vine Star',
    emoji: '💎',
    color: '#00FFFF',
    bgColor: 'rgba(0, 255, 255, 0.1)',
    borderColor: 'rgba(0, 255, 255, 0.4)',
    glowColor: 'rgba(0, 255, 255, 0.3)',
    minScore: 5000,
  },
  diamond: {
    label: 'Diamond Vine Star',
    emoji: '👑',
    color: '#B9F2FF',
    bgColor: 'rgba(185, 242, 255, 0.1)',
    borderColor: 'rgba(185, 242, 255, 0.4)',
    glowColor: 'rgba(185, 242, 255, 0.4)',
    minScore: 10000,
  },
};

// ─── Component ────────────────────────────────────────────────────────────

export function VineStarBadge({
  tier,
  compact = false,
  showLabel = false,
  animate = true,
}: VineStarBadgeProps) {
  const config = TIER_CONFIG[tier];

  if (compact) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          backgroundColor: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          boxShadow: animate ? `0 0 8px ${config.glowColor}` : undefined,
        }}
        title={config.label}
      >
        <span className="text-[10px] leading-none px-1">{config.emoji}</span>
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        boxShadow: animate ? `0 0 12px ${config.glowColor}` : undefined,
      }}
      title={`${config.label} (${config.minScore}+ vibe score)`}
    >
      <span className="text-sm">{config.emoji}</span>
      {showLabel && (
        <span className="text-[10px] font-bold tracking-wide" style={{ color: config.color }}>
          Vine Star
        </span>
      )}
    </div>
  );
}

// ─── Helper: Get tier from vibe score ────────────────────────────────────

export function getTierFromScore(totalVibeScore: number): VineStarTier {
  if (totalVibeScore >= 10000) return 'diamond';
  if (totalVibeScore >= 5000) return 'platinum';
  if (totalVibeScore >= 2000) return 'gold';
  if (totalVibeScore >= 1000) return 'silver';
  return 'bronze';
}

export { TIER_CONFIG };

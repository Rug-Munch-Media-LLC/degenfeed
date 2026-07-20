'use client';

/**
 * @degenfeed/web — YouTubeSourceBadge
 *
 * Source badge that clearly labels content origin.
 * YouTube: Red badge
 * PeerTube: Purple badge
 * Shorts: Pink badge
 * DegenFeed: Green badge
 *
 * Ensures users always know they're watching YouTube content (not PeerTube).
 */

import { memo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export type SourceType = 'youtube' | 'peertube' | 'shorts' | 'degenfeed';

interface SourceBadgeConfig {
  label: string;
  color: string;
  bgClass: string;
  icon: string;
}

const SOURCE_CONFIG: Record<SourceType, SourceBadgeConfig> = {
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    bgClass: 'bg-red-600/80',
    icon: '\u25B6',
  },
  peertube: {
    label: 'PeerTube',
    color: '#d22d23',
    bgClass: 'bg-purple-600/80',
    icon: '\uD83D\uDCF9',
  },
  shorts: {
    label: 'Shorts',
    color: '#ec4899',
    bgClass: 'bg-pink-500/80',
    icon: '\uD83D\uDCBF',
  },
  degenfeed: {
    label: 'DegenFeed',
    color: '#22c55e',
    bgClass: 'bg-green-600/80',
    icon: '\uD83E\uDE99',
  },
};

// ─── Component ───────────────────────────────────────────────────────────

export interface YouTubeSourceBadgeProps {
  source: SourceType;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show icon before label */
  showIcon?: boolean;
  /** Additional className overrides */
  className?: string;
}

export const YouTubeSourceBadge = memo(function YouTubeSourceBadge({
  source,
  size = 'sm',
  showIcon = true,
  className = '',
}: YouTubeSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.degenfeed;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold tracking-wide text-white backdrop-blur-sm ${sizeClasses[size]} ${config.bgClass} ${className}`}
      style={{ backgroundColor: `${config.color}cc` }}
      title={config.label}
    >
      {showIcon && <span className="text-[0.8em]">{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
});

// ─── Inline badge for within-text usage ─────────────────────────────────

export function YouTubeSourceText({ source }: { source: SourceType }) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.degenfeed;
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold">
      <span className="text-[0.8em]">{config.icon}</span>
      <span style={{ color: config.color }}>{config.label}</span>
    </span>
  );
}

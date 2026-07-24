'use client';

import { useState } from 'react';

interface SubscriberBadgeProps {
  tier: 'fan' | 'supporter' | 'patron';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  /** Show detailed tooltip on hover */
  showTooltip?: boolean;
}

const tierConfig = {
  fan: {
    color: '#1aff6e',
    bg: 'rgba(0,255,65,0.12)',
    borderColor: 'rgba(0,255,65,0.25)',
    stars: 1,
    label: 'Fan',
    gradient: 'from-degen-500/20 to-transparent',
    glow: 'rgba(0,255,65,0.15)',
    benefits: ['Subscriber badge', 'Exclusive posts', 'Ad-free browsing'],
  },
  supporter: {
    color: '#8a63d2',
    bg: 'rgba(138,99,210,0.12)',
    borderColor: 'rgba(138,99,210,0.25)',
    stars: 2,
    label: 'Supporter',
    gradient: 'from-purple-500/20 to-transparent',
    glow: 'rgba(138,99,210,0.15)',
    benefits: ['Everything in Fan', 'Early access to content', 'Priority replies'],
  },
  patron: {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.25)',
    stars: 3,
    label: 'Patron',
    gradient: 'from-amber-500/20 to-transparent',
    glow: 'rgba(245,158,11,0.15)',
    benefits: ['Everything in Supporter', 'Private creator chat', 'Direct influence on content'],
  },
};

const sizeClasses = {
  sm: 'gap-1 px-2 py-0.5 text-[10px]',
  md: 'gap-1.5 px-2.5 py-0.5 text-xs',
  lg: 'gap-1.5 px-3 py-1 text-sm',
} as const;

function SparkleStars({ count, color }: { count: number; color: string }) {
  return (
    <span className="relative inline-flex gap-0.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="relative"
          style={{
            animation: `sparkle-star 2s ease-in-out ${i * 0.3}s infinite`,
            color,
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function SubscriberBadge({
  tier,
  size = 'sm',
  showLabel = true,
  showTooltip = false,
}: SubscriberBadgeProps) {
  const config = tierConfig[tier];
  const sizeClass = sizeClasses[size];
  const [showTip, setShowTip] = useState(false);

  const label = showLabel ? config.label : undefined;

  const badge = (
    <span
      className={`relative inline-flex items-center rounded-full font-medium ${sizeClass}`}
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        animation: 'badge-mount 0.3s ease-out',
        boxShadow: `0 0 8px ${config.glow}`,
      }}
      onMouseEnter={() => showTooltip && setShowTip(true)}
      onMouseLeave={() => showTooltip && setShowTip(false)}
      aria-label={`${config.label} subscriber`}
    >
      <SparkleStars count={config.stars} color={config.color} />
      {label && <span className="ml-0.5">{label}</span>}
    </span>
  );

  return (
    <>
      {badge}

      {/* Tooltip */}
      {showTip && showTooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border px-3 py-2 backdrop-blur-xl"
          style={{
            backgroundColor: config.bg,
            borderColor: config.borderColor,
            color: config.color,
            animation: 'tooltip-in 0.15s ease-out',
          }}
        >
          <p className="mb-1 text-xs font-bold">{config.label}</p>
          <ul className="space-y-0.5">
            {config.benefits.map((b) => (
              <li key={b} className="flex items-center gap-1 text-[10px]" style={{ opacity: 0.8 }}>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes badge-mount {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes sparkle-star {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.7; }
          50% { transform: scale(1.2) rotate(10deg); opacity: 1; }
        }
        @keyframes tooltip-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

export const SUB_TIER_NAMES: Record<string, string> = {
  fan: 'Fan',
  supporter: 'Supporter',
  patron: 'Patron',
};

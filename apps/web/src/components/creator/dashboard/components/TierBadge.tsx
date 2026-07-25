'use client';

import { TIER_COLORS, TIER_LABELS } from '../constants';

export function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#888';
  const label = TIER_LABELS[tier] ?? tier;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

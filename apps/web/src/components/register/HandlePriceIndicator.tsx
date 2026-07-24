'use client';

import { getHandleTier } from './utils';

export function HandlePriceIndicator({ length, premium }: { length: number; premium: boolean }) {
  const tier = getHandleTier(length);
  if (length === 0) return null;

  const colorMap = {
    green: 'text-degen-400',
    yellow: 'text-yellow-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
    muted: 'text-[var(--color-muted)]',
  };

  return (
    <p className={`mt-1.5 text-xs ${colorMap[tier.color]}`}>
      {tier.label}: {premium ? 'Covered by Premium' : tier.price}
    </p>
  );
}

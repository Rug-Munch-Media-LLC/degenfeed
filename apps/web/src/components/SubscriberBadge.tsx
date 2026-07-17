'use client';

interface SubscriberBadgeProps {
  tier: 'supporter' | 'member' | 'patron';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const tierConfig = {
  supporter: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    stars: 1,
    label: 'Supporter',
  },
  member: {
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    stars: 2,
    label: 'Member',
  },
  patron: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    stars: 3,
    label: 'Patron',
  },
} as const;

const sizeClasses = {
  sm: 'gap-1 px-2 py-0.5 text-xs',
  md: 'gap-1.5 px-2.5 py-0.5 text-sm',
  lg: 'gap-1.5 px-3 py-1 text-base',
} as const;

function Stars({ count, className }: { count: number; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {'★'.repeat(count)}
    </span>
  );
}

export default function SubscriberBadge({
  tier,
  size = 'sm',
  showLabel = true,
}: SubscriberBadgeProps) {
  const config = tierConfig[tier];
  const sizeClass = sizeClasses[size];
  const label = showLabel ? config.label : undefined;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.color} ${sizeClass}`}
      aria-label={`${config.label} subscriber`}
    >
      <Stars count={config.stars} className={config.color} />
      {label && <span>{label}</span>}
    </span>
  );
}

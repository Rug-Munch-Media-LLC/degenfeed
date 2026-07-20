'use client';

/**
 * ProtocolBadge — Source indicator chip for Pixelfed/Zora/Bluesky/etc.
 */

interface ProtocolBadgeProps {
  badge: string;
  color: string;
  label: string;
  size?: 'sm' | 'md';
}

export function ProtocolBadge({ badge, color, label, size = 'sm' }: ProtocolBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2 py-1 gap-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium leading-none ${sizeClasses}`}
      style={{
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="text-[inherit]" aria-hidden="true">{badge}</span>
      <span className="sr-only">{label}</span>
      {size === 'md' && <span className="ml-0.5">{label}</span>}
    </span>
  );
}

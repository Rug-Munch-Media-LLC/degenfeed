'use client';

import { CHAT_BADGES, type ChatBadge } from './types';

/* === Single Badge Display ===================================== */

interface StreamBadgeProps {
  badge: ChatBadge;
  size?: 'sm' | 'md';
}

export function StreamBadge({ badge, size = 'sm' }: StreamBadgeProps) {
  const info = CHAT_BADGES[badge];
  if (!info) return null;

  const sizeClasses = size === 'md' ? 'px-1.5 py-0.5 text-[9px]' : 'px-1 py-[1px] text-[7px]';

  return (
    <span
      className={`inline-flex items-center rounded font-bold uppercase leading-none ${sizeClasses}`}
      style={{ backgroundColor: `${info.color}20`, color: info.color }}
      title={info.tooltip}
    >
      {info.label}
    </span>
  );
}

/* === Badge Showcase =========================================== */

export function BadgeShowcase() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(CHAT_BADGES) as ChatBadge[]).map((badge) => (
        <div
          key={badge}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
        >
          <StreamBadge badge={badge} size="md" />
          <span className="text-[9px] text-white/40">{badge}</span>
        </div>
      ))}
    </div>
  );
}

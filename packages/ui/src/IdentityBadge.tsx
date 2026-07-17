/**
 * @degenfeed/ui — IdentityBadge
 *
 * Small protocol badge shown next to a user's display name.
 * Unlike ProtocolBadge (which shows the source protocol of a post),
 * IdentityBadge shows which OTHER protocols a user has linked.
 *
 * Example: `[⚡ Nostr] [◈ Farcaster] [☁ Bluesky]`
 */

import { getProtocolColor, getProtocolLabel } from './ProtocolBadge';

export const CROSS_PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '◈',
  lens: '◎',
  bluesky: '☁',
  mastodon: '🐘',
  reddit: '🔴',
};

export interface IdentityBadgeProps {
  protocol: string;
  handle?: string;
  size?: 'sm' | 'xs';
}

export function IdentityBadge({ protocol, handle, size = 'xs' }: IdentityBadgeProps) {
  const color = getProtocolColor(protocol);
  const label = getProtocolLabel(protocol);
  const icon = CROSS_PROTOCOL_ICONS[protocol] || '●';
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass}`}
      style={{ backgroundColor: `${color}18`, color }}
      title={handle ? `${label}: ${handle}` : label}
    >
      <span className="text-[0.8em]">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

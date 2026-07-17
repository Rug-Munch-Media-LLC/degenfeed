/**
 * @degenfeed/ui — SubscriberBadge
 *
 * Small color-coded badge shown next to a creator's name when the viewer
 * is subscribed to them.
 *
 * Colors: Supporter=green, Member=blue, Patron=purple
 */

export interface SubscriberBadgeProps {
  tier: string;
  size?: 'sm' | 'xs';
}

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  supporter: { bg: '#22c55e22', text: '#22c55e', label: 'Supporter' },
  member: { bg: '#3b82f622', text: '#3b82f6', label: 'Member' },
  patron: { bg: '#a855f722', text: '#a855f7', label: 'Patron' },
};

const TIER_ICONS: Record<string, string> = {
  supporter: '⭐',
  member: '💎',
  patron: '👑',
};

export function SubscriberBadge({ tier, size = 'xs' }: SubscriberBadgeProps) {
  const config = (TIER_COLORS[tier] ?? TIER_COLORS.supporter)!;
  const icon = TIER_ICONS[tier] ?? '⭐';
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass}`}
      style={{ backgroundColor: config.bg, color: config.text }}
      title={`${config.label} subscriber`}
    >
      <span className="text-[0.8em]">{icon}</span>
      <span className="whitespace-nowrap">{config.label}</span>
    </span>
  );
}

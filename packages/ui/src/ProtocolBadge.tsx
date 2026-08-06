/**
 * @degenfeed/ui — ProtocolBadge
 *
 * Colored badge showing which protocol a post comes from.
 * Colors, labels and icons are derived from the CANONICAL protocol
 * registry in @degenfeed/utils (packages/utils/src/protocols.ts).
 * Do NOT redefine protocol colors here — extend the registry instead.
 *
 * The badge links to the protocol feed (`/feed/{protocol}`) by default.
 */

import {
  PROTOCOL_COLORS,
  PROTOCOL_ICONS,
  PROTOCOL_LABELS,
  getProtocolColor,
  getProtocolIcon,
  getProtocolLabel,
  getProtocolFeedPath,
} from '@degenfeed/utils';

export { PROTOCOL_COLORS, PROTOCOL_ICONS, PROTOCOL_LABELS };
export { getProtocolColor, getProtocolIcon, getProtocolLabel };

export interface ProtocolBadgeProps {
  protocol: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  /** Override the destination. Defaults to `/feed/{protocol}`. */
  href?: string;
  /** Set to false to render a non-clickable badge (e.g. inside another link). */
  link?: boolean;
}

export function ProtocolBadge({
  protocol,
  size = 'sm',
  showLabel = true,
  href,
  link = true,
}: ProtocolBadgeProps) {
  const color = getProtocolColor(protocol);
  const label = getProtocolLabel(protocol);
  const icon = getProtocolIcon(protocol);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm';
  const destination = href ?? getProtocolFeedPath(protocol);

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold tracking-wide ${sizeClass}`}
      style={{ backgroundColor: `${color}1a`, color }}
      title={label}
    >
      <span className="text-[0.7em]">{icon}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );

  if (!link || !destination) return badge;

  return (
    <a
      href={destination}
      className="no-underline transition-opacity hover:opacity-80"
      title={`${label} feed`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={`View ${label} feed`}
    >
      {badge}
    </a>
  );
}

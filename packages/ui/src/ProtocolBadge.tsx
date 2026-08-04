/**
 * @degenfeed/ui — ProtocolBadge
 *
 * Colored badge showing which protocol a post comes from.
 * Colors, labels and icons are derived from the CANONICAL protocol
 * registry in @degenfeed/utils (packages/utils/src/protocols.ts).
 * Do NOT redefine protocol colors here — extend the registry instead.
 */

import {
  PROTOCOL_COLORS,
  PROTOCOL_ICONS,
  PROTOCOL_LABELS,
  getProtocolColor,
  getProtocolIcon,
  getProtocolLabel,
} from '@degenfeed/utils';

export { PROTOCOL_COLORS, PROTOCOL_ICONS, PROTOCOL_LABELS };
export { getProtocolColor, getProtocolIcon, getProtocolLabel };

export interface ProtocolBadgeProps {
  protocol: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ProtocolBadge({ protocol, size = 'sm', showLabel = true }: ProtocolBadgeProps) {
  const color = getProtocolColor(protocol);
  const label = getProtocolLabel(protocol);
  const icon = getProtocolIcon(protocol);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold tracking-wide ${sizeClass}`}
      style={{ backgroundColor: `${color}1a`, color }}
      title={label}
    >
      <span className="text-[0.7em]">{icon}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
}

'use client';

/**
 * ShortsSourceBadge — Color-coded source indicator for short videos.
 *
 * Shows which protocol/federation a short originated from with a distinct
 * brand color and optional protocol icon.
 *
 * Protocols:
 *   ActivityPub (Loops)  → #F1680D
 *   AT Protocol (Flashes) → #0085FF
 *   Nostr                → #8B5CF6
 *   Farcaster            → #8A63D2
 *   Lens                 → #ABFE2C
 *   Zora (NFT)           → #0052FF
 *   PeerTube             → #F1680D
 *   DegenFeed            → #00FF41
 */

export interface SourceBadgeData {
  source: string;
  label: string;
  color: string;
  icon?: string;
}

const SOURCE_BADGES: Record<string, SourceBadgeData> = {
  activitypub: { source: 'activitypub', label: 'Loops', color: '#F1680D', icon: 'activitypub' },
  atprotocol: { source: 'atprotocol', label: 'Flashes', color: '#0085FF', icon: 'atprotocol' },
  nostr: { source: 'nostr', label: 'Nostr', color: '#8B5CF6', icon: 'nostr' },
  farcaster: { source: 'farcaster', label: 'Farcaster', color: '#8A63D2', icon: 'farcaster' },
  lens: { source: 'lens', label: 'Lens', color: '#ABFE2C', icon: 'lens' },
  zora: { source: 'zora', label: 'Zora', color: '#0052FF', icon: 'zora' },
  peertube: { source: 'peertube', label: 'PeerTube', color: '#F1680D', icon: 'peertube' },
  degenfeed: { source: 'degenfeed', label: 'DegenFeed', color: '#00FF41', icon: 'degenfeed' },
  direct: { source: 'direct', label: 'DegenFeed', color: '#00FF41', icon: 'degenfeed' },
  loops: { source: 'loops', label: 'Loops', color: '#F1680D', icon: 'activitypub' },
  flashes: { source: 'flashes', label: 'Flashes', color: '#0085FF', icon: 'atprotocol' },
};

export function sourceBadgeData(source: string): SourceBadgeData {
  return SOURCE_BADGES[source] ?? { source, label: source, color: '#666666', icon: undefined };
}

interface ShortsSourceBadgeProps {
  source: string;
  label?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

function ProtocolIcon({ icon, size }: { icon: string; size: number }) {
  const s = size;
  switch (icon) {
    case 'farcaster':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M18.24 2H5.76A3.76 3.76 0 0 0 2 5.76v12.48A3.76 3.76 0 0 0 5.76 22h12.48A3.76 3.76 0 0 0 22 18.24V5.76A3.76 3.76 0 0 0 18.24 2Z"
            opacity=".3"
          />
          <path d="M8 7h8v2h-2v7h-2V9h-2V9H8V7Z" />
        </svg>
      );
    case 'lens':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Z"
            opacity=".3"
          />
          <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6Zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4Z" />
        </svg>
      );
    case 'zora':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" opacity=".25" />
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'nostr':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" opacity=".25" />
          <path
            d="M9 8h3l-1 4h2l-1.5 4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'activitypub':
    case 'peertube':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" opacity=".25" />
          <path d="M10 9l5 3-5 3V9z" />
        </svg>
      );
    case 'atprotocol':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" opacity=".3" />
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
        </svg>
      );
    case 'degenfeed':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" opacity=".3" />
          <path d="M14.5 8.5l-5 3 5 3v-6z" />
        </svg>
      );
    default:
      return null;
  }
}

export function ShortsSourceBadge({
  source,
  label,
  color,
  size = 'sm',
  showIcon = true,
}: ShortsSourceBadgeProps) {
  const badge = sourceBadgeData(source);
  const displayColor = color ?? badge.color;
  const displayLabel = label ?? badge.label;

  const sizeClasses =
    size === 'lg'
      ? 'px-3 py-1 text-[11px] gap-1.5'
      : size === 'md'
        ? 'px-2.5 py-0.5 text-[10px] gap-1'
        : 'px-1.5 py-0.5 text-[9px] gap-0.5';

  const iconSize = size === 'lg' ? 14 : size === 'md' ? 12 : 10;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wider ${sizeClasses}`}
      style={{
        backgroundColor: `${displayColor}18`,
        color: displayColor,
        border: `1px solid ${displayColor}30`,
      }}
    >
      {showIcon && badge.icon && <ProtocolIcon icon={badge.icon} size={iconSize} />}
      <span>{displayLabel}</span>
    </span>
  );
}

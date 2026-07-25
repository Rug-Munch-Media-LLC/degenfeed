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
  // Primary self-hosted
  loops: { source: 'loops', label: 'Loops', color: '#F1680D', icon: 'activitypub' },
  activitypub: { source: 'activitypub', label: 'Loops', color: '#F1680D', icon: 'activitypub' },
  // AT Protocol
  atprotocol: { source: 'atprotocol', label: 'Flashes', color: '#0085FF', icon: 'atprotocol' },
  flashes: { source: 'flashes', label: 'Flashes', color: '#0085FF', icon: 'atprotocol' },
  // Nostr / Farcaster / Lens
  nostr: { source: 'nostr', label: 'Nostr', color: '#8B5CF6', icon: 'nostr' },
  farcaster: { source: 'farcaster', label: 'Farcaster', color: '#8A63D2', icon: 'farcaster' },
  lens: { source: 'lens', label: 'Lens', color: '#ABFE2C', icon: 'lens' },
  // Zora video NFTs
  zora: { source: 'zora', label: 'Zora', color: '#0052FF', icon: 'zora' },
  // PeerTube self-hosted
  peertube: { source: 'peertube', label: 'PeerTube', color: '#F1680D', icon: 'peertube' },
  // Legacy commercial platforms
  youtube: { source: 'youtube', label: 'YouTube', color: '#FF0000', icon: 'youtube' },
  tiktok: { source: 'tiktok', label: 'TikTok', color: '#010101', icon: 'tiktok' },
  tiktok_rss: { source: 'tiktok_rss', label: 'TikTok', color: '#010101', icon: 'tiktok' },
  instagram: { source: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'instagram' },
  // Pixelfed self-hosted
  pixelfed: { source: 'pixelfed', label: 'Pixelfed', color: '#FF4500', icon: 'pixelfed' },
  // DegenFeed native
  degenfeed: { source: 'degenfeed', label: 'DegenFeed', color: '#00FF41', icon: 'degenfeed' },
  direct: { source: 'direct', label: 'DegenFeed', color: '#00FF41', icon: 'degenfeed' },
  // Bridge/fallback
  rss_bridge: { source: 'rss_bridge', label: 'RSS-Bridge', color: '#4A9E5F', icon: 'rss_bridge' },
  owncast: { source: 'owncast', label: 'Owncast', color: '#6441A5', icon: 'owncast' },
  lemmy: { source: 'lemmy', label: 'Lemmy', color: '#0078D7', icon: 'lemmy' },
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
    case 'youtube':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.71 2.89 2.89 0 0 1-2.88-2.89 2.89 2.89 0 0 1 2.88-2.89c.3 0 .53.03.77.1v-3.5a6.37 6.37 0 0 0-.77-.05A6.35 6.35 0 0 0 3.3 15.5a6.35 6.35 0 0 0 6.35 6.35 6.35 6.35 0 0 0 6.35-6.35V8.87a7.82 7.82 0 0 0 4.6 1.53v-3.4a4.82 4.82 0 0 1-1.01-.31z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" opacity=".2" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.5" opacity=".8" />
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

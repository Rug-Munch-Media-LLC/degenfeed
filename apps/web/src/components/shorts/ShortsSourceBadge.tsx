'use client';

/**
 * ShortsSourceBadge — Color-coded source indicator for short videos.
 *
 * YouTube = red, TikTok = black, Instagram = pink, PeerTube = orange,
 * DegenFeed = green.
 */

export interface SourceBadgeData {
  source: string;
  label: string;
  color: string;
}

const SOURCE_BADGES: Record<string, SourceBadgeData> = {
  youtube: { source: 'youtube', label: 'YouTube', color: '#ff0000' },
  tiktok_rss: { source: 'tiktok_rss', label: 'TikTok', color: '#010101' },
  instagram: { source: 'instagram', label: 'Instagram', color: '#e1306c' },
  peertube: { source: 'peertube', label: 'PeerTube', color: '#f1680d' },
  twitter: { source: 'twitter', label: 'Twitter', color: '#1da1f2' },
  direct: { source: 'direct', label: 'DegenFeed', color: '#00ff41' },
  degenfeed: { source: 'degenfeed', label: 'DegenFeed', color: '#00ff41' },
};

export function sourceBadgeData(source: string): SourceBadgeData {
  return SOURCE_BADGES[source] ?? { source, label: source, color: '#666666' };
}

interface ShortsSourceBadgeProps {
  source: string;
  label?: string;
  color?: string;
  size?: 'sm' | 'md';
}

export function ShortsSourceBadge({
  source,
  label,
  color,
  size = 'sm',
}: ShortsSourceBadgeProps) {
  const badge = sourceBadgeData(source);
  const displayColor = color ?? badge.color;
  const displayLabel = label ?? badge.label;

  const sizeClasses = size === 'md'
    ? 'px-2.5 py-0.5 text-[10px]'
    : 'px-1.5 py-0.5 text-[9px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium uppercase tracking-wider ${sizeClasses}`}
      style={{
        backgroundColor: `${displayColor}18`,
        color: displayColor,
        border: `1px solid ${displayColor}30`,
      }}
    >
      {displayLabel === 'TikTok' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.88 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.83.11V8.92a6.45 6.45 0 0 0-.83-.07 6.34 6.34 0 0 0 0 12.68 6.34 6.34 0 0 0 6.35-6.35V8.78a8.01 8.01 0 0 0 4.75 1.5v-3.6a4.53 4.53 0 0 1-2.12.01z" />
        </svg>
      )}
      {displayLabel === 'Instagram' && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
        </svg>
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

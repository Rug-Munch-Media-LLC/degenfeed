/**
 * @degenfeed/ui — ProtocolBadge
 *
 * Colored badge showing which protocol a post comes from.
 * Design: rounded-pill, brand color fill, protocol icon + name.
 * Uses CSS custom properties for protocol colors so they're theme-aware.
 */

export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8b5cf6',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  threads: '#101010',
  mastodon: '#6364ff',
  reddit: '#ff4500',
  lemmy: '#00b868',
  activitypub: '#6364ff',
  atproto: '#1185fe',
  rss: '#ffa500',
  peertube: '#d22d23',
  youtube: '#ff0000',
  mirror: '#0a0a0a',
  paragraph: '#6b21a8',
  zora: '#7c3aed',
  ghost: '#15171a',
  kbin: '#6364ff',
  discord: '#5865f2',
  telegram: '#26a5e4',
  matrix: '#000000',
  github: '#333',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads',
  mastodon: 'Mastodon',
  reddit: 'Reddit',
  lemmy: 'Lemmy',
  activitypub: 'Mastodon',
  atproto: 'AT Protocol',
  rss: 'RSS',
  peertube: 'PeerTube',
  youtube: 'YouTube',
  mirror: 'Mirror.xyz',
  paragraph: 'Paragraph',
  zora: 'Zora',
  ghost: 'Ghost',
  kbin: 'Kbin',
  discord: 'Discord',
  telegram: 'Telegram',
  matrix: 'Matrix',
  github: 'GitHub',
};

export const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '\u2630',
  farcaster: '\u25C8',
  lens: '\u25CE',
  bluesky: '\u2601',
  threads: '\u25A3',
  mastodon: 'M',
  reddit: 'R',
  lemmy: '\uD83C\uDF4B',
  activitypub: 'M',
  atproto: '\u2601',
  rss: 'A',
  peertube: '\u25B6',
  youtube: '\u25B6',
  mirror: 'M',
  paragraph: 'P',
  zora: 'Z',
  ghost: 'G',
  kbin: 'K',
  discord: 'D',
  telegram: 'T',
  matrix: 'M',
  github: 'G',
};

export interface ProtocolBadgeProps {
  protocol: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function getProtocolColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? '#666';
}

export function getProtocolLabel(protocol: string): string {
  return PROTOCOL_LABELS[protocol] ?? protocol;
}

export function getProtocolIcon(protocol: string): string {
  return PROTOCOL_ICONS[protocol] ?? '?';
}

export function ProtocolBadge({ protocol, size = 'sm', showLabel = true }: ProtocolBadgeProps) {
  const color = PROTOCOL_COLORS[protocol] ?? '#666';
  const label = PROTOCOL_LABELS[protocol] ?? protocol;
  const icon = PROTOCOL_ICONS[protocol] ?? '?';
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

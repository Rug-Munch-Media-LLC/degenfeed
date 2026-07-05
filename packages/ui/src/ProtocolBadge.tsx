/**
 * @degenfeed/ui — ProtocolBadge
 *
 * Colored badge showing which protocol a post comes from.
 * Design: rounded-pill, brand color fill, protocol icon + name.
 */

export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  threads: '#888888',
  mastodon: '#6364ff',
  activitypub: '#6364ff',
  rss: '#ffa500',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads',
  mastodon: 'Mastodon',
  activitypub: 'Mastodon',
  rss: 'RSS',
};

export const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '☰',
  farcaster: '◈',
  lens: '◎',
  bluesky: '☁',
  threads: '+',
  mastodon: 'M',
  activitypub: 'M',
  rss: 'A',
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
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={'inline-flex items-center gap-1 rounded-full font-medium ' + sizeClass}
      style={{ backgroundColor: color + '22', color }}
      title={label}
    >
      <span className="text-[0.7em]">{icon}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
}

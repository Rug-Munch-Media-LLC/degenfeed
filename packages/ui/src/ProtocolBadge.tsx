/**
 * @degenfeed/ui — ProtocolBadge
 *
 * Colored badge showing which protocol a post comes from.
 * Expanded for ALL platforms: audio, video, social, photos.
 */

export const PROTOCOL_COLORS: Record<string, string> = {
  // Audio Spaces
  nostr: '#8b5cf6',
  peertube: '#d22d23',
  owncast: '#06b6d4',
  livepeer: '#10b981',
  // Social / Announce
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  threads: '#888888',
  mastodon: '#6364ff',
  reddit: '#ff4500',
  lemmy: '#00b868',
  activitypub: '#6364ff',
  atproto: '#1185fe',
  rss: '#ffa500',
  discord: '#5865f2',
  telegram: '#26a5e4',
  twitter: '#1da1f2',
  matrix: '#0dbd8b',
  xmpp: '#0022ff',
  // Video
  youtube: '#ff0000',
  twitch: '#9146ff',
  kick: '#53fc18',
  // Photos
  'nostr-pictures': '#8b5cf6',
  'bluesky-photos': '#1185fe',
  pixelfed: '#ff0066',
  // Publishing
  mirror: '#0a0a0a',
  paragraph: '#6b21a8',
  zora: '#7c3aed',
  ghost: '#15171a',
  kbin: '#6364ff',
  github: '#333',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  // Audio
  nostr: 'Nostr',
  peertube: 'PeerTube',
  owncast: 'Owncast',
  livepeer: 'LivePeer',
  // Social
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
  discord: 'Discord',
  telegram: 'Telegram',
  twitter: 'X',
  matrix: 'Matrix',
  xmpp: 'XMPP',
  // Video
  youtube: 'YouTube',
  twitch: 'Twitch',
  kick: 'Kick',
  // Photos
  'nostr-pictures': 'Nostr Pic',
  'bluesky-photos': 'Bsky Pic',
  pixelfed: 'Pixelfed',
  // Publishing
  mirror: 'Mirror.xyz',
  paragraph: 'Paragraph',
  zora: 'Zora',
  ghost: 'Ghost',
  kbin: 'Kbin',
  github: 'GitHub',
};

export const PROTOCOL_ICONS: Record<string, string> = {
  // Audio
  nostr: '\u26A1',
  peertube: '\u25B6',
  owncast: '\uD83D\uDD34',
  livepeer: '\uD83C\uDFAC',
  // Social
  farcaster: '\u25C8',
  lens: '\u25CE',
  bluesky: '\uD83E\uDD8B',
  threads: '\u25A3',
  mastodon: '\uD83D\uDC18',
  reddit: 'R',
  lemmy: '\uD83C\uDF4B',
  activitypub: 'M',
  atproto: '\u2601',
  rss: 'A',
  discord: 'D',
  telegram: 'T',
  twitter: 'X',
  matrix: 'M',
  xmpp: 'X',
  // Video
  youtube: '\u25B6',
  twitch: 'T',
  kick: 'K',
  // Photos
  'nostr-pictures': '\uD83D\uDCF8',
  'bluesky-photos': '\uD83E\uDD8B',
  pixelfed: '\uD83D\uDCF7',
  // Publishing
  mirror: 'M',
  paragraph: 'P',
  zora: 'Z',
  ghost: 'G',
  kbin: 'K',
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

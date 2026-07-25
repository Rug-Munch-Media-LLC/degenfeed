import type { StoredIdentity } from '@degenfeed/storage';
import type { ResolvedIdentity, TabDefinition } from './types';

/** Extended protocol colors covering all fediverse + web3 protocols */
export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8b5cf6',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888',
  ethereum: '#627eea',
  solana: '#9945ff',
  // Extended protocols
  gotosocial: '#6ad4e6',
  lemmy: '#7c3aed',
  peertube: '#f1680d',
  pixelfed: '#f7004c',
  writefreely: '#0d9dff',
  castopod: '#ff6f00',
  funkwhale: '#f85a8b',
  mobilizon: '#0f9831',
  bookwyrm: '#7cb342',
  owncast: '#00a98f',
  podcast: '#ff5722',
  music: '#e91e63',
  events: '#4caf50',
  books: '#8bc34a',
  media: '#ff9800',
  coins: '#ffc107',
  daos: '#9c27b0',
  tips: '#00bcd4',
  reddit: '#ff4500',
  youtube: '#ff0000',
  discord: '#5865f2',
  telegram: '#0088cc',
  github: '#333333',
};

/** Extended protocol labels */
export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  ethereum: 'EVM',
  solana: 'Solana',
  // Extended
  gotosocial: 'GoToSocial',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  pixelfed: 'Pixelfed',
  writefreely: 'WriteFreely',
  castopod: 'Castopod',
  funkwhale: 'Funkwhale',
  mobilizon: 'Mobilizon',
  bookwyrm: 'BookWyrm',
  owncast: 'Owncast',
  reddit: 'Reddit',
  youtube: 'YouTube',
};

/** Content tab definitions — 17 tabs as specified */
export const CONTENT_TABS: TabDefinition[] = [
  {
    id: 'all',
    label: 'All',
    icon: 'M4 6h16M4 12h16M4 18h16',
    sources: [
      'nostr',
      'farcaster',
      'bluesky',
      'mastodon',
      'lens',
      'lemmy',
      'peertube',
      'pixelfed',
      'writefreely',
      'castopod',
      'funkwhale',
      'mobilizon',
      'bookwyrm',
    ],
    showWhenEmpty: true,
    emptyMessage:
      'No content from any protocol yet. Connect accounts to see everything in one place.',
  },
  {
    id: 'nostr',
    label: 'Nostr',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    sources: ['nostr'],
    showWhenEmpty: true,
    emptyMessage: 'No Nostr notes yet. Publish your first note across the relay network.',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    sources: ['farcaster'],
    showWhenEmpty: true,
    emptyMessage: 'No Farcaster casts yet. Start casting on the Farcaster network.',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    sources: ['bluesky'],
    showWhenEmpty: true,
    emptyMessage: 'No Bluesky posts yet. Your AT Protocol feed will appear here.',
  },
  {
    id: 'mastodon',
    label: 'Mastodon/GTS',
    icon: 'M21.5 12.5c0 8.5-5.5 9-11 9s-11-.5-11-9 5.5-9 11-9 11 .5 11 9z',
    sources: ['mastodon', 'gotosocial'],
    showWhenEmpty: true,
    emptyMessage: 'No fediverse posts yet. Connect Mastodon or GoToSocial to see toots here.',
  },
  {
    id: 'lens',
    label: 'Lens',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    sources: ['lens'],
    showWhenEmpty: true,
    emptyMessage: 'No Lens publications yet. Your Lens Protocol content will show here.',
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    icon: 'M4 6h16M4 12h16M4 18h16',
    sources: ['lemmy'],
    showWhenEmpty: true,
    emptyMessage: 'No Lemmy activity yet. Join communities and start discussing.',
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    icon: 'M15 8h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
    sources: ['peertube'],
    showWhenEmpty: true,
    emptyMessage: 'No PeerTube videos yet. Upload or connect your video channel.',
  },
  {
    id: 'pixelfed',
    label: 'Pixelfed',
    icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z',
    sources: ['pixelfed'],
    showWhenEmpty: true,
    emptyMessage: 'No Pixelfed images yet. Share your visual content here.',
  },
  {
    id: 'writefreely',
    label: 'WriteFreely',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z',
    sources: ['writefreely'],
    showWhenEmpty: true,
    emptyMessage: 'No blog posts yet. Start writing on WriteFreely.',
  },
  {
    id: 'podcasts',
    label: 'Podcasts',
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
    sources: ['castopod', 'podcast'],
    showWhenEmpty: true,
    emptyMessage: 'No podcast episodes yet. Launch your show on Castopod.',
  },
  {
    id: 'music',
    label: 'Music',
    icon: 'M9 18V5l12-2v13M9 18c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
    sources: ['funkwhale', 'music'],
    showWhenEmpty: true,
    emptyMessage: 'No music tracks yet. Upload your music on Funkwhale.',
  },
  {
    id: 'events',
    label: 'Events',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    sources: ['mobilizon', 'events'],
    showWhenEmpty: true,
    emptyMessage: 'No events yet. Create or join events on Mobilizon.',
  },
  {
    id: 'books',
    label: 'Books',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    sources: ['bookwyrm', 'books'],
    showWhenEmpty: true,
    emptyMessage: "No book reviews yet. Share what you're reading on BookWyrm.",
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'M15 8h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
    sources: ['pixelfed', 'peertube', 'bluesky', 'nostr', 'farcaster', 'mastodon', 'lens'],
    showWhenEmpty: true,
    emptyMessage: 'No media found. Images and videos from all your protocols appear here.',
  },
  {
    id: 'coins',
    label: 'Coins',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    sources: ['coins', 'ethereum', 'solana'],
    showWhenEmpty: true,
    emptyMessage: 'No creator coins yet. Launch your own coin or discover others.',
  },
  {
    id: 'daos',
    label: 'DAOs',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    sources: ['daos', 'snapshot', 'tally'],
    showWhenEmpty: true,
    emptyMessage: 'Not a member of any DAOs yet. Join a DAO to see your memberships here.',
  },
  {
    id: 'tips',
    label: 'Tips',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    sources: ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'tips'],
    showWhenEmpty: true,
    emptyMessage: 'No tips received yet. Tips from all protocols appear here.',
  },
];

/** Activity type definitions for cross-protocol activity feed */
export const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  post: {
    icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z',
    color: '#8b5cf6',
    label: 'Posted',
  },
  live: {
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    color: '#ff4444',
    label: 'Live',
  },
  podcast: {
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
    color: '#ff6f00',
    label: 'Podcast',
  },
  tip: {
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    color: '#00bcd4',
    label: 'Tip',
  },
  coin: {
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    color: '#ffc107',
    label: 'Coin',
  },
  dao: {
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    color: '#9c27b0',
    label: 'DAO',
  },
  event: {
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    color: '#4caf50',
    label: 'Event',
  },
  milestone: {
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    color: '#ff5722',
    label: 'Milestone',
  },
};

/** Protocol icons for display */
export const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🔵',
  bluesky: '🦋',
  mastodon: '🐘',
  gotosocial: '👥',
  lens: '🌿',
  lemmy: '🔮',
  peertube: '📺',
  pixelfed: '📷',
  writefreely: '✍️',
  castopod: '🎙️',
  funkwhale: '🎵',
  mobilizon: '📅',
  bookwyrm: '📚',
  owncast: '📡',
};

export function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function toResolved(identity: StoredIdentity): ResolvedIdentity {
  const isWallet = identity.protocol === 'ethereum' || identity.protocol === 'solana';
  return {
    id: identity.id,
    protocol: identity.protocol,
    displayName: identity.displayName,
    handle: identity.handle,
    avatarUrl: identity.avatarUrl,
    address: isWallet ? identity.publicId : undefined,
    color: PROTOCOL_COLORS[identity.protocol] ?? '#666',
    isPrimary: identity.isPrimary,
    verified: identity.verified ?? false,
    followerCount: undefined,
  };
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatPriceChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getProtocolIcon(protocol: string): string {
  return PROTOCOL_ICONS[protocol] ?? '🔗';
}

/** Check if a protocol is a "social" protocol (has a feed tab) */
export function isSocialProtocol(protocol: string): boolean {
  return ['nostr', 'farcaster', 'bluesky', 'mastodon', 'lens', 'gotosocial'].includes(protocol);
}

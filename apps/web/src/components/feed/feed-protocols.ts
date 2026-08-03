/**
 * @degenfeed/web — Shared protocol configuration for DegenFeed
 *
 * Central registry for protocol metadata used across feed components.
 * Each protocol has: icon, color, label, endpoint, and route path.
 *
 * Last updated: 2026-07-26 — Added 7 new protocol integrations
 */

export type ProtocolCategory =
  | 'social'
  | 'video'
  | 'content'
  | 'communities'
  | 'web3'
  | 'media'
  | 'news';

export interface ProtocolConfig {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  endpoint: string;
  route: string;
  postNoun: string;
  category: ProtocolCategory;
  stats: { label: string; value: string }[];
}

export const CATEGORIES: Record<ProtocolCategory, { label: string; icon: string }> = {
  social: { label: 'Social Networks', icon: '💬' },
  video: { label: 'Video Platforms', icon: '🎬' },
  content: { label: 'Content & Publishing', icon: '📝' },
  communities: { label: 'Communities & Forums', icon: '👥' },
  web3: { label: 'Web3 & Crypto', icon: '🔗' },
  media: { label: 'Media Hub', icon: '🎨' },
  news: { label: 'News & RSS', icon: '📰' },
};

export const PROTOCOLS: Record<string, ProtocolConfig> = {
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    color: '#6364ff',
    icon: '🐘',
    description: 'Federated microblogging on the ActivityPub protocol',
    endpoint: '/api/feed/mastodon',
    route: '/feed/mastodon',
    postNoun: 'toot',
    category: 'social',
    stats: [
      { label: 'active instances', value: '12k+' },
      { label: 'fediverse reach', value: 'global' },
    ],
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    color: '#1185fe',
    icon: '🦋',
    description: 'Open social network on the AT Protocol',
    endpoint: '/api/feed/bluesky',
    route: '/feed/bluesky',
    postNoun: 'skeet',
    category: 'social',
    stats: [
      { label: 'custom feeds', value: '1.8k+' },
      { label: 'PDS network', value: 'bsky.social' },
    ],
  },
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    color: '#8e30eb',
    icon: '⚡',
    description: 'Notes and Other Stuff Transmitted by Relays',
    endpoint: '/api/feed/nostr',
    route: '/feed/nostr',
    postNoun: 'note',
    category: 'social',
    stats: [
      { label: 'active relays', value: '340+' },
      { label: 'zaps today', value: '12k+' },
    ],
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    color: '#8a63d2',
    icon: '◈',
    description: 'Sufficiently decentralized social network',
    endpoint: '/api/feed/farcaster',
    route: '/feed/farcaster',
    postNoun: 'cast',
    category: 'social',
    stats: [
      { label: 'channels', value: '1.2k+' },
      { label: 'hub', value: 'nemes.farcaster.xyz' },
    ],
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    color: '#abfe2c',
    icon: '🌿',
    description: 'User-owned social graph on Polygon',
    endpoint: '/api/feed/lens',
    route: '/feed/lens',
    postNoun: 'publication',
    category: 'social',
    stats: [
      { label: 'profiles', value: '400k+' },
      { label: 'network', value: 'Polygon' },
    ],
  },
  peertube: {
    id: 'peertube',
    label: 'PeerTube',
    color: '#f1680d',
    icon: '🎬',
    description: 'Decentralized video platform on ActivityPub',
    endpoint: '/api/feed/peertube',
    route: '/feed/peertube',
    postNoun: 'video',
    category: 'video',
    stats: [
      { label: 'instances', value: '800+' },
      { label: 'videos', value: 'millions' },
    ],
  },
  lemmy: {
    id: 'lemmy',
    label: 'Lemmy',
    color: '#2d9cdb',
    icon: '🗣️',
    description: 'Link aggregator and community discussions',
    endpoint: '/api/feed/lemmy',
    route: '/feed/lemmy',
    postNoun: 'post',
    category: 'communities',
    stats: [
      { label: 'communities', value: '10k+' },
      { label: 'instances', value: '2.5k+' },
    ],
  },
  pixelfed: {
    id: 'pixelfed',
    label: 'Pixelfed',
    color: '#f9a825',
    icon: '📷',
    description: 'Decentralized image sharing on ActivityPub',
    endpoint: '/api/feed/pixelfed',
    route: '/feed/pixelfed',
    postNoun: 'photo',
    category: 'content',
    stats: [
      { label: 'instances', value: '1.2k+' },
      { label: 'photos shared', value: 'millions' },
    ],
  },
  piefed: {
    id: 'piefed',
    label: 'PieFed',
    color: '#f97316',
    icon: '🥧',
    description: 'Federated link aggregator & community discussions',
    endpoint: '/api/feed/piefed',
    route: '/feed/piefed',
    postNoun: 'post',
    category: 'communities',
    stats: [
      { label: 'instance', value: 'links.degenfeed.xyz' },
      { label: 'federated', value: 'ActivityPub' },
    ],
  },
  writefreely: {
    id: 'writefreely',
    label: 'WriteFreely',
    color: '#22c55e',
    icon: '📝',
    description: 'Federated, open-source blogging on the fediverse',
    endpoint: '/api/feed/writefreely',
    route: '/feed/writefreely',
    postNoun: 'article',
    category: 'content',
    stats: [
      { label: 'instance', value: 'blog.degenfeed.xyz' },
      { label: 'federated', value: 'ActivityPub' },
    ],
  },
  owncast: {
    id: 'owncast',
    label: 'Owncast',
    color: '#ef4444',
    icon: '🔴',
    description: 'Self-hosted live streaming with ActivityPub federation',
    endpoint: '/api/feed/owncast',
    route: '/feed/owncast',
    postNoun: 'stream',
    category: 'video',
    stats: [
      { label: 'instance', value: 'live.degenfeed.xyz' },
      { label: 'federated', value: 'ActivityPub' },
    ],
  },
  zora: {
    id: 'zora',
    label: 'Zora',
    color: '#6b21a8',
    icon: '🎨',
    description: 'NFT minting protocol with creator coins',
    endpoint: '/api/feed/zora',
    route: '/feed/zora',
    postNoun: 'mint',
    category: 'web3',
    stats: [
      { label: 'network', value: 'Zora/Base' },
      { label: 'mints today', value: '10k+' },
    ],
  },
  audius: {
    id: 'audius',
    label: 'Audius',
    color: '#cc0fe0',
    icon: '🎵',
    description: 'Decentralized music streaming — trending tracks & artist updates',
    endpoint: '/api/feed/audius',
    route: '/feed/audius',
    postNoun: 'track',
    category: 'web3',
    stats: [
      { label: 'catalog', value: '400M+ streams' },
      { label: 'free tier', value: '500K req/mo' },
    ],
  },
  rarible: {
    id: 'rarible',
    label: 'NFT Markets',
    color: '#feda02',
    icon: '🖼️',
    description: 'Cross-chain NFT sales, mints & trending collections',
    endpoint: '/api/feed/rarible',
    route: '/feed/nft-market',
    postNoun: 'sale',
    category: 'web3',
    stats: [
      { label: 'chains', value: '7+' },
      { label: 'marketplaces', value: 'aggregated' },
    ],
  },
  media: {
    id: 'media',
    label: 'Media Hub',
    color: '#ff6b9d',
    icon: '🎨',
    description: 'Images, videos & live streams from every protocol',
    endpoint: '/api/feed/media',
    route: '/feed/media',
    postNoun: 'post',
    category: 'media',
    stats: [
      { label: 'protocols', value: '9+' },
      { label: 'media types', value: 'image/video/live' },
    ],
  },
  rss: {
    id: 'rss',
    label: 'RSS/News',
    color: '#ffa500',
    icon: '📰',
    description: 'Aggregated from 350+ crypto news sources',
    endpoint: '/api/feed/rss',
    route: '/feed/rss',
    postNoun: 'article',
    category: 'news',
    stats: [
      { label: 'sources', value: '350+' },
      { label: 'updated', value: 'hourly' },
    ],
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    color: '#ff4500',
    icon: '🔴',
    description: 'Crypto subreddits and community discussions',
    endpoint: '/api/feed/reddit',
    route: '/feed/reddit',
    postNoun: 'post',
    category: 'communities',
    stats: [
      { label: 'subreddits', value: 'crypto' },
      { label: 'active', value: '24/7' },
    ],
  },
  gancio: {
    id: 'gancio',
    label: 'Gancio Events',
    color: '#22c55e',
    icon: '📅',
    description: 'Federated event calendar — real-world meetups & hackathons',
    endpoint: '/api/feed/gancio',
    route: '/feed/gancio',
    postNoun: 'event',
    category: 'communities',
    stats: [
      { label: 'instances', value: '50+' },
      { label: 'federated', value: 'ActivityPub' },
    ],
  },
  soundcloud: {
    id: 'soundcloud',
    label: 'SoundCloud',
    color: '#ff7700',
    icon: '🎵',
    description: 'Electronic music, mixes & tracks from SoundCloud curators',
    endpoint: '/api/feed/soundcloud',
    route: '/feed/soundcloud',
    postNoun: 'track',
    category: 'media',
    stats: [
      { label: 'users', value: '76M+' },
      { label: 'tracks', value: '300M+' },
    ],
  },
  bandcamp: {
    id: 'bandcamp',
    label: 'Bandcamp',
    color: '#1da0c2',
    icon: '🎸',
    description: 'Indie music, albums & new releases from Bandcamp artists',
    endpoint: '/api/feed/bandcamp',
    route: '/feed/bandcamp',
    postNoun: 'album',
    category: 'media',
    stats: [
      { label: 'artists', value: '5M+' },
      { label: 'visitors', value: '50M/mo' },
    ],
  },
  vimeo: {
    id: 'vimeo',
    label: 'Vimeo',
    color: '#1ab7ea',
    icon: '🎬',
    description: 'High-quality curated videos — tech talks, creative & documentaries',
    endpoint: '/api/feed/vimeo',
    route: '/feed/vimeo',
    postNoun: 'video',
    category: 'video',
    stats: [
      { label: 'users', value: '200M+' },
      { label: 'quality', value: 'curated' },
    ],
  },
  twitch: {
    id: 'twitch',
    label: 'Twitch',
    color: '#9146ff',
    icon: '🔴',
    description: 'Live streams & trending clips — gaming, music, creative & IRL',
    endpoint: '/api/feed/twitch',
    route: '/feed/twitch',
    postNoun: 'stream',
    category: 'video',
    stats: [
      { label: 'daily users', value: '30M+' },
      { label: 'streamers', value: '7M+' },
    ],
  },
  wordpress: {
    id: 'wordpress',
    label: 'WordPress + ActivityPub',
    color: '#21759b',
    icon: '📝',
    description: 'Blog posts from 43% of the web — federated via ActivityPub',
    endpoint: '/api/feed/wordpress',
    route: '/feed/wordpress',
    postNoun: 'post',
    category: 'content',
    stats: [
      { label: 'market share', value: '43% of web' },
      { label: 'sites', value: '835M+' },
    ],
  },
  'nostr-groups': {
    id: 'nostr-groups',
    label: 'Nostr Groups (NIP-29)',
    color: '#8e30eb',
    icon: '💬',
    description: 'Decentralized group chats & communities on Nostr NIP-29',
    endpoint: '/api/feed/nostr-groups',
    route: '/feed/nostr-groups',
    postNoun: 'message',
    category: 'communities',
    stats: [
      { label: 'NIP', value: 'NIP-29' },
      { label: 'protocol', value: 'Nostr' },
    ],
  },
  opensea: {
    id: 'opensea',
    label: 'OpenSea',
    color: '#2081e2',
    icon: '⚓',
    description: 'Largest NFT marketplace — real-time sales, listings & trending collections',
    endpoint: '/api/feed/opensea',
    route: '/feed/opensea',
    postNoun: 'event',
    category: 'web3',
    stats: [
      { label: 'marketplace', value: '#1' },
      { label: 'real-time', value: 'Stream API' },
    ],
  },
  lobsters: {
    id: 'lobsters',
    label: 'Lobsters',
    color: '#cc0000',
    icon: '🦞',
    description: 'Computing-focused link aggregation & tech discussion community',
    endpoint: '/api/feed/lobsters',
    route: '/feed/lobsters',
    postNoun: 'story',
    category: 'communities',
    stats: [
      { label: 'community', value: 'tech' },
      { label: 'topical', value: '5k+ users' },
    ],
  },
  snapshot: {
    id: 'snapshot',
    label: 'Snapshot DAO',
    color: '#ff6b35',
    icon: '🗳️',
    description: 'DAO governance proposals — voting on DeFi, NFT & crypto protocol decisions',
    endpoint: '/api/feed/snapshot',
    route: '/feed/snapshot',
    postNoun: 'proposal',
    category: 'web3',
    stats: [
      { label: 'active DAOs', value: '10k+' },
      { label: 'voters', value: '500k+' },
    ],
  },
  tally: {
    id: 'tally',
    label: 'Tally DAO',
    color: '#6366f1',
    icon: '🏛️',
    description: 'DAO governance & treasury management — proposals, votes & delegate activity',
    endpoint: '/api/feed/tally',
    route: '/feed/tally',
    postNoun: 'proposal',
    category: 'web3',
    stats: [
      { label: 'DAOs tracked', value: '500+' },
      { label: 'treasury', value: '$10B+' },
    ],
  },
  juicebox: {
    id: 'juicebox',
    label: 'Juicebox',
    color: '#f97316',
    icon: '📦',
    description: 'DAO fundraising & programmable funding — crypto project treasury management',
    endpoint: '/api/feed/juicebox',
    route: '/feed/juicebox',
    postNoun: 'project',
    category: 'web3',
    stats: [
      { label: 'projects', value: '2k+' },
      { label: 'raised', value: '$100M+' },
    ],
  },
  unlock: {
    id: 'unlock',
    label: 'Unlock Protocol',
    color: '#a855f7',
    icon: '🔐',
    description: 'Token-gated memberships & content — NFT locks, keys & creator monetization',
    endpoint: '/api/feed/unlock',
    route: '/feed/unlock',
    postNoun: 'lock',
    category: 'web3',
    stats: [
      { label: 'locks deployed', value: '5k+' },
      { label: 'networks', value: '8+' },
    ],
  },
};

export const PROTOCOL_LIST = Object.values(PROTOCOLS);

/** Ordered list of category IDs for sidebar display */
export const CATEGORY_DISPLAY_ORDER: ProtocolCategory[] = [
  'social',
  'web3',
  'content',
  'communities',
  'video',
  'media',
  'news',
];

/** Map each category to its protocol IDs, maintaining SIDEBAR_ORDER within each category */
export const CATEGORY_PROTOCOLS: Record<ProtocolCategory, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const cat of CATEGORY_DISPLAY_ORDER) {
    map[cat] = [];
  }
  for (const protocol of PROTOCOL_LIST) {
    if (map[protocol.category]) {
      map[protocol.category].push(protocol.id);
    }
  }
  return map as Record<ProtocolCategory, string[]>;
})();

/** Ordered list of protocols for the sidebar/tabs */
export const SIDEBAR_ORDER = [
  'mastodon',
  'bluesky',
  'audius',
  'rarible',
  'nostr',
  'farcaster',
  'lens',
  'peertube',
  'gancio',
  'soundcloud',
  'bandcamp',
  'vimeo',
  'twitch',
  'wordpress',
  'nostr-groups',
  'opensea',
  'lobsters',
  'snapshot',
  'tally',
  'juicebox',
  'unlock',
  'lemmy',
  'piefed',
  'writefreely',
  'pixelfed',
  'owncast',
];

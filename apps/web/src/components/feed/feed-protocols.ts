/**
 * @degenfeed/web — Shared protocol configuration for DegenFeed
 *
 * Central registry for protocol metadata used across feed components.
 * Each protocol has: icon, color, label, endpoint, and route path.
 *
 * Last updated: 2026-07-24 — Added Audius & Rarible protocols
 * See docs/MISSED_PLATFORMS.md for research details
 */

export interface ProtocolConfig {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  endpoint: string;
  route: string;
  postNoun: string;
  stats: { label: string; value: string }[];
}

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
    route: '/farcaster',
    postNoun: 'cast',
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
    route: '/lens',
    postNoun: 'publication',
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
    route: '/feed/videos',
    postNoun: 'video',
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
    route: '/feed/images',
    postNoun: 'photo',
    stats: [
      { label: 'instances', value: '1.2k+' },
      { label: 'photos shared', value: 'millions' },
    ],
  },
  zora: {
    id: 'zora',
    label: 'Zora',
    color: '#6b21a8',
    icon: '🎨',
    description: 'NFT minting protocol with creator coins',
    endpoint: '/api/feed/zora',
    route: '/feed/nfts',
    postNoun: 'mint',
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
    route: '/feed/music',
    postNoun: 'track',
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
    stats: [
      { label: 'chains', value: '7+' },
      { label: 'marketplaces', value: 'aggregated' },
    ],
  },
  rss: {
    id: 'rss',
    label: 'RSS/News',
    color: '#ffa500',
    icon: '📰',
    description: 'Aggregated from 350+ crypto news sources',
    endpoint: '/api/feed/news',
    route: '/feed/news',
    postNoun: 'article',
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
    stats: [
      { label: 'subreddits', value: 'crypto' },
      { label: 'active', value: '24/7' },
    ],
  },
};

export const PROTOCOL_LIST = Object.values(PROTOCOLS);

/** Ordered list of protocols for the sidebar/tabs */
export const SIDEBAR_ORDER = [
  'mastodon',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'audius',
  'rarible',
  'peertube',
  'lemmy',
  'pixelfed',
  'zora',
  'rss',
  'reddit',
] as const;

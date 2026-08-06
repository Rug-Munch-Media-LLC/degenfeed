/**
 * @degenfeed/utils — protocols
 *
 * CANONICAL protocol registry for DegenFeed. This is the single source of
 * truth for protocol metadata (icon, color, label, category, route, stats)
 * used across the web app, the bridge, and shared UI packages.
 *
 * Consumers:
 *  - apps/web/src/components/feed/feed-protocols.ts re-exports from here
 *  - packages/ui/src/ProtocolBadge.tsx derives PROTOCOL_COLORS/LABELS/ICONS
 *  - apps/web profile/analytics/settings constants derive from here
 *
 * If you add a protocol, add it HERE first — not in a local map.
 */

export type ProtocolCategory =
  | 'social'
  | 'video'
  | 'audio'
  | 'publishing'
  | 'governance'
  | 'markets'
  | 'discussion'
  | 'reading'
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
  social: { label: 'Social', icon: '💬' },
  video: { label: 'Video', icon: '🎬' },
  audio: { label: 'Audio', icon: '🎵' },
  publishing: { label: 'Publishing', icon: '📝' },
  governance: { label: 'Governance', icon: '🗳️' },
  markets: { label: 'Markets', icon: '📊' },
  discussion: { label: 'Discussion', icon: '👥' },
  reading: { label: 'Reading', icon: '📚' },
  communities: { label: 'Communities', icon: '💬' },
  web3: { label: 'Web3 & Crypto', icon: '🔗' },
  media: { label: 'Media', icon: '🎨' },
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
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    color: '#ff0000',
    icon: '▶',
    description:
      'Top crypto, tech & AI videos — Coin Bureau, Bankless, Finematics, Fireship, Two Minute Papers and 11 more',
    endpoint: '/api/feed/youtube',
    route: '/feed/youtube',
    postNoun: 'video',
    category: 'video',
    stats: [
      { label: 'channels', value: '15' },
      { label: 'categories', value: 'crypto/tech/AI' },
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
    category: 'discussion',
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
    category: 'media',
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
    category: 'discussion',
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
    category: 'publishing',
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
  live: {
    id: 'live',
    label: 'Live',
    color: '#ef4444',
    icon: '●',
    description: 'Live streams from Owncast, PeerTube Live & spaces-bridge',
    endpoint: '/api/feed/live',
    route: '/feed/live',
    postNoun: 'stream',
    category: 'video',
    stats: [
      { label: 'sources', value: 'Owncast/PeerTube' },
      { label: 'streams', value: 'live' },
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
    category: 'audio',
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
    category: 'markets',
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
  newsletter: {
    id: 'newsletter',
    label: 'Newsletters',
    color: '#e63946',
    icon: '📬',
    description:
      'Curated crypto & web3 newsletters from Substack, Medium, Mirror, Paragraph, Ghost',
    endpoint: '/api/feed/newsletter',
    route: '/feed/newsletter',
    postNoun: 'newsletter',
    category: 'publishing',
    stats: [
      { label: 'platforms', value: '5' },
      { label: 'publications', value: '15+' },
    ],
  },
  podcast: {
    id: 'podcast',
    label: 'Podcasts',
    color: '#7c3aed',
    icon: '🎙️',
    description:
      'Top crypto & web3 podcasts — Bankless, Unchained, Empire, 0xResearch, Bell Curve and more',
    endpoint: '/api/feed/podcast',
    route: '/feed/podcast',
    postNoun: 'episode',
    category: 'audio',
    stats: [
      { label: 'shows', value: '10' },
      { label: 'updated', value: 'recent episodes' },
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
    category: 'discussion',
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
    category: 'audio',
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
    category: 'audio',
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
  loops: {
    id: 'loops',
    label: 'Loops',
    color: '#22d3ee',
    icon: '🔄',
    description: 'Self-hosted short-form video platform (TikTok alternative) — loops.degenfeed.xyz',
    endpoint: '/api/feed/loops',
    route: '/feed/loops',
    postNoun: 'loop',
    category: 'video',
    stats: [
      { label: 'instance', value: 'loops.degenfeed.xyz' },
      { label: 'federated', value: 'ActivityPub' },
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
    category: 'publishing',
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
    category: 'discussion',
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
    category: 'markets',
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
    category: 'discussion',
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
    category: 'governance',
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
    category: 'governance',
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
    category: 'governance',
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
    category: 'governance',
    stats: [
      { label: 'locks deployed', value: '5k+' },
      { label: 'networks', value: '8+' },
    ],
  },
  polymarket: {
    id: 'polymarket',
    label: 'Polymarket',
    color: '#1d9bf0',
    icon: '📊',
    description: 'Prediction markets — real-time odds, trending markets & resolution status',
    endpoint: '/api/feed/polymarket',
    route: '/feed/polymarket',
    postNoun: 'market',
    category: 'markets',
    stats: [
      { label: 'volume', value: '$1B+' },
      { label: 'live markets', value: '2k+' },
    ],
  },
};

export const PROTOCOL_LIST = Object.values(PROTOCOLS);

/**
 * Extra protocol feeds that are routed but not part of the canonical
 * PROTOCOLS registry. These still resolve to a real `/feed/{id}` page and
 * some are reported by the bridge health endpoint (live status dots).
 * Kept separate so existing FeedShell / ProtocolNavSection behavior is
 * unchanged while the global sidebar can surface every feed.
 */
export interface ExtraProtocolConfig {
  id: string;
  label: string;
  color: string;
  icon: string;
  route: string;
  category: ProtocolCategory;
}

export const EXTRA_PROTOCOLS: ExtraProtocolConfig[] = [
  {
    id: 'discord',
    label: 'Discord',
    color: '#5865f2',
    icon: '💬',
    route: '/feed/discord',
    category: 'communities',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#26a5e4',
    icon: '✈',
    route: '/feed/telegram',
    category: 'communities',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: '#ff0000',
    icon: '▶',
    route: '/feed/youtube',
    category: 'video',
  },
  {
    id: 'github',
    label: 'GitHub',
    color: '#6e40c9',
    icon: '◉',
    route: '/feed/github',
    category: 'communities',
  },
  {
    id: 'hive',
    label: 'Hive',
    color: '#e31337',
    icon: '◆',
    route: '/feed/hive',
    category: 'social',
  },
  {
    id: 'threads',
    label: 'Threads',
    color: '#888888',
    icon: '⊞',
    route: '/feed/threads',
    category: 'social',
  },
  {
    id: 'matrix',
    label: 'Matrix',
    color: '#000000',
    icon: '🕸',
    route: '/feed/matrix',
    category: 'communities',
  },
  {
    id: 'xmtp',
    label: 'XMTP',
    color: '#5b8def',
    icon: '💬',
    route: '/feed/xmtp',
    category: 'social',
  },
  {
    id: 'gab',
    label: 'Gab',
    color: '#00a2ff',
    icon: '🗯',
    route: '/feed/gab',
    category: 'social',
  },
  {
    id: 'minds',
    label: 'Minds',
    color: '#2a90d9',
    icon: '🧠',
    route: '/feed/minds',
    category: 'social',
  },
  {
    id: 'steem',
    label: 'Steem',
    color: '#4ba2f2',
    icon: '⛏',
    route: '/feed/steem',
    category: 'social',
  },
  {
    id: 'gotosocial',
    label: 'GoToSocial',
    color: '#8b5cf6',
    icon: '🐘',
    route: '/feed/gotosocial',
    category: 'social',
  },
  {
    id: 'bonfire',
    label: 'Bonfire',
    color: '#f97316',
    icon: '🔥',
    route: '/feed/bonfire',
    category: 'social',
  },
  {
    id: 'mitra',
    label: 'Mitra',
    color: '#22c55e',
    icon: '🌿',
    route: '/feed/mitra',
    category: 'social',
  },
  {
    id: 'takahe',
    label: 'Takahē',
    color: '#0ea5e9',
    icon: '🐦',
    route: '/feed/takahe',
    category: 'social',
  },
  {
    id: 'forgejo',
    label: 'Forgejo',
    color: '#60a5fa',
    icon: '🛠',
    route: '/feed/forgejo',
    category: 'communities',
  },
  {
    id: 'mobilizon',
    label: 'Mobilizon',
    color: '#00a2ff',
    icon: '📅',
    route: '/feed/mobilizon',
    category: 'communities',
  },
  {
    id: 'bookwyrm',
    label: 'BookWyrm',
    color: '#800080',
    icon: '📚',
    route: '/feed/bookwyrm',
    category: 'reading',
  },
  {
    id: 'orbis',
    label: 'Orbis',
    color: '#8b5cf6',
    icon: '🌐',
    route: '/feed/orbis',
    category: 'web3',
  },
  {
    id: 'push',
    label: 'Push Protocol',
    color: '#f97316',
    icon: '🔔',
    route: '/feed/push',
    category: 'web3',
  },
  {
    id: 'huddle01',
    label: 'Huddle01',
    color: '#6366f1',
    icon: '🎥',
    route: '/feed/huddle01',
    category: 'video',
  },
  {
    id: 'ceramic',
    label: 'Ceramic',
    color: '#f97316',
    icon: '🏺',
    route: '/feed/ceramic',
    category: 'web3',
  },
  {
    id: 'tableland',
    label: 'Tableland',
    color: '#14b8a6',
    icon: '🗄',
    route: '/feed/tableland',
    category: 'web3',
  },
  {
    id: 'mirror',
    label: 'Mirror.xyz',
    color: '#0a0a0a',
    icon: 'M',
    route: '/feed/mirror',
    category: 'publishing',
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    color: '#6b21a8',
    icon: 'P',
    route: '/feed/paragraph',
    category: 'publishing',
  },
  {
    id: 'ghost',
    label: 'Ghost',
    color: '#15171a',
    icon: 'G',
    route: '/feed/ghost',
    category: 'publishing',
  },
  {
    id: 'castopod',
    label: 'Castopod',
    color: '#ff6f00',
    icon: '🎙️',
    route: '/feed/castopod',
    category: 'audio',
  },
  {
    id: 'funkwhale',
    label: 'Funkwhale',
    color: '#f85a8b',
    icon: '🎵',
    route: '/feed/funkwhale',
    category: 'audio',
  },
  {
    id: 'faircamp',
    label: 'Faircamp',
    color: '#10b981',
    icon: '🎸',
    route: '/feed/faircamp',
    category: 'audio',
  },
  {
    id: 'discourse',
    label: 'Discourse',
    color: '#00b0e6',
    icon: '💬',
    route: '/feed/discourse',
    category: 'discussion',
  },
  {
    id: 'kbin',
    label: 'Kbin',
    color: '#6364ff',
    icon: '🗣️',
    route: '/feed/kbin',
    category: 'discussion',
  },
  {
    id: 'mbin',
    label: 'Mbin',
    color: '#8b5cf6',
    icon: '🗣️',
    route: '/feed/mbin',
    category: 'discussion',
  },
];

/** Ordered list of category IDs for sidebar display */
export const CATEGORY_DISPLAY_ORDER: ProtocolCategory[] = [
  'social',
  'video',
  'audio',
  'publishing',
  'governance',
  'markets',
  'discussion',
  'reading',
  'communities',
  'web3',
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
    const bucket = map[protocol.category];
    if (bucket) {
      bucket.push(protocol.id);
    }
  }
  return map as Record<ProtocolCategory, string[]>;
})();

/** Ordered list of protocols for the sidebar/tabs */
export const SIDEBAR_ORDER = [
  // Social
  'mastodon',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'threads',
  'hive',
  'gab',
  'minds',
  'steem',
  // Video
  'live',
  'youtube',
  'peertube',
  'vimeo',
  'twitch',
  'loops',
  'owncast',
  // Audio
  'soundcloud',
  'bandcamp',
  'audius',
  'podcast',
  // Publishing
  'writefreely',
  'wordpress',
  'newsletter',
  // Governance
  'snapshot',
  'tally',
  'juicebox',
  'unlock',
  // Markets
  'polymarket',
  'opensea',
  'rarible',
  // Discussion
  'lemmy',
  'piefed',
  'reddit',
  'lobsters',
  'nostr-groups',
  // Reading
  'bookwyrm',
  // Communities
  'gancio',
  // Media
  'pixelfed',
  'media',
  // News
  'rss',
];

// ─────────────────────────────────────────────────────────────────────
// Derived lookup maps (single source of truth)
//
// PROTOCOL_COLORS / PROTOCOL_LABELS / PROTOCOL_ICONS are derived from the
// canonical PROTOCOLS + EXTRA_PROTOCOLS registries above, with a small
// LEGACY_* block for keys that historically lived only in local maps
// (ProtocolBadge, profile constants, utils). Precedence: PROTOCOLS wins,
// then EXTRA_PROTOCOLS, then legacy extras.
// ─────────────────────────────────────────────────────────────────────

/** Legacy color keys that are not part of the canonical registries. */
const LEGACY_PROTOCOL_COLORS: Record<string, string> = {
  livepeer: '#10b981',
  activitypub: '#6364ff',
  atproto: '#1185fe',
  twitter: '#1da1f2',
  xmpp: '#0022ff',
  kick: '#53fc18',
  'nostr-pictures': '#8b5cf6',
  'bluesky-photos': '#1185fe',
  mirror: '#0a0a0a',
  paragraph: '#6b21a8',
  ghost: '#15171a',
  kbin: '#6364ff',
  ethereum: '#627eea',
  solana: '#9945ff',
  castopod: '#ff6f00',
  funkwhale: '#f85a8b',
  music: '#e91e63',
  events: '#4caf50',
  books: '#8bc34a',
  coins: '#ffc107',
  daos: '#9c27b0',
  tips: '#00bcd4',
};

/** Legacy label keys that are not part of the canonical registries. */
const LEGACY_PROTOCOL_LABELS: Record<string, string> = {
  livepeer: 'LivePeer',
  activitypub: 'Mastodon',
  atproto: 'AT Protocol',
  twitter: 'X / Twitter',
  xmpp: 'XMPP',
  kick: 'Kick',
  'nostr-pictures': 'Nostr Pic',
  'bluesky-photos': 'Bsky Pic',
  mirror: 'Mirror.xyz',
  paragraph: 'Paragraph',
  ghost: 'Ghost',
  kbin: 'Kbin',
  ethereum: 'EVM',
  solana: 'Solana',
  castopod: 'Castopod',
  funkwhale: 'Funkwhale',
};

/** Legacy icon keys that are not part of the canonical registries. */
const LEGACY_PROTOCOL_ICONS: Record<string, string> = {
  livepeer: '🎬',
  activitypub: 'M',
  atproto: '☁',
  twitter: 'X',
  xmpp: 'X',
  kick: 'K',
  'nostr-pictures': '📸',
  'bluesky-photos': '🦋',
  mirror: 'M',
  paragraph: 'P',
  ghost: 'G',
  kbin: 'K',
  castopod: '🎙️',
  funkwhale: '🎵',
};

/** Legacy emoji keys for PROTOCOL_EMOJI (historic utils map). */
const LEGACY_PROTOCOL_EMOJI: Record<string, string> = {
  ethereum: '◆',
  solana: '◎',
  atproto: '🦋',
};

function collectRegistry(
  pick: (c: ProtocolConfig) => string,
  extraPick: (c: ExtraProtocolConfig) => string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of Object.values(PROTOCOLS)) map[c.id] = pick(c);
  for (const c of EXTRA_PROTOCOLS) if (map[c.id] === undefined) map[c.id] = extraPick(c);
  return map;
}

/** Protocol → brand color. Derived from the canonical registries. */
export const PROTOCOL_COLORS: Record<string, string> = {
  ...collectRegistry(
    (c) => c.color,
    (c) => c.color,
  ),
  ...LEGACY_PROTOCOL_COLORS,
};

/** Protocol → display label. Derived from the canonical registries. */
export const PROTOCOL_LABELS: Record<string, string> = {
  ...collectRegistry(
    (c) => c.label,
    (c) => c.label,
  ),
  ...LEGACY_PROTOCOL_LABELS,
};

/** Protocol → icon glyph. Derived from the canonical registries. */
export const PROTOCOL_ICONS: Record<string, string> = {
  ...collectRegistry(
    (c) => c.icon,
    (c) => c.icon,
  ),
  ...LEGACY_PROTOCOL_ICONS,
};

/** Protocol → emoji (backward-compatible alias of PROTOCOL_ICONS). */
export const PROTOCOL_EMOJI: Record<string, string> = {
  ...PROTOCOL_ICONS,
  ...LEGACY_PROTOCOL_EMOJI,
};

/** Resolve a protocol color with a neutral fallback. */
export function getProtocolColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? '#666';
}

/** Resolve a protocol label, falling back to the raw id. */
export function getProtocolLabel(protocol: string): string {
  return PROTOCOL_LABELS[protocol] ?? protocol;
}

/** Resolve a protocol icon, falling back to '?'. */
export function getProtocolIcon(protocol: string): string {
  return PROTOCOL_ICONS[protocol] ?? '?';
}

/** Resolve a protocol emoji, falling back to '●'. */
export function getProtocolEmoji(protocol: string): string {
  return PROTOCOL_EMOJI[protocol] ?? '●';
}

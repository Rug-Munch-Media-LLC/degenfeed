/**
 * @degenfeed/api-worker — Shorts Aggregator Types
 *
 * Type definitions and constants for the multi-source short-form
 * video aggregation engine.
 */

export interface SourceHealth {
  source: ExtendedSource;
  healthy: boolean;
  lastFetch: number;
  error?: string;
  videosCount: number;
}

export type ExtendedSource =
  | 'loops' // Primary self-hosted
  | 'peertube' // Self-hosted federated
  | 'youtube' // YouTube Shorts
  | 'tiktok_rss' // TikTok via RSS-Bridge
  | 'instagram' // Instagram Reels
  | 'owncast' // Owncast clips
  | 'rss_bridge' // Generic RSS-Bridge
  | 'lemmy' // Lemmy video posts
  | 'pixelfed' // Self-hosted Pixelfed
  | 'atprotocol' // AT Protocol firehose
  | 'zora' // Zora video NFTs
  | 'farcaster' // Farcaster video Frames
  | 'nostr' // Nostr NIP-71 video events
  | 'lens' // Lens video publications
  | 'bluesky' // Bluesky native video posts
  | 'direct'; // DegenFeed native

export const ALL_SOURCES: ExtendedSource[] = [
  'loops',
  'peertube',
  'youtube',
  'tiktok_rss',
  'instagram',
  'owncast',
  'rss_bridge',
  'lemmy',
  'pixelfed',
  'atprotocol',
  'zora',
  'farcaster',
  'nostr',
  'lens',
  'bluesky',
];

export const SOURCE_META: Record<ExtendedSource, { label: string; color: string; icon: string }> = {
  loops: { label: 'Loops', color: '#F1680D', icon: 'Loops' },
  peertube: { label: 'PeerTube', color: '#f1680d', icon: 'PeerTube' },
  youtube: { label: 'YouTube', color: '#ff0000', icon: 'YouTube' },
  tiktok_rss: { label: 'TikTok', color: '#010101', icon: 'TikTok' },
  instagram: { label: 'Instagram', color: '#e1306c', icon: 'Instagram' },
  owncast: { label: 'Owncast', color: '#6441a5', icon: 'Owncast' },
  rss_bridge: { label: 'RSS-Bridge', color: '#4a9e5f', icon: 'RSS' },
  lemmy: { label: 'Lemmy', color: '#0078D7', icon: 'Lemmy' },
  pixelfed: { label: 'Pixelfed', color: '#FF4500', icon: 'Pixelfed' },
  atprotocol: { label: 'AT Protocol', color: '#0085FF', icon: 'ATProtocol' },
  zora: { label: 'Zora', color: '#0052FF', icon: 'Zora' },
  farcaster: { label: 'Farcaster', color: '#8A63D2', icon: 'Farcaster' },
  nostr: { label: 'Nostr', color: '#7C3AED', icon: 'Nostr' },
  lens: { label: 'Lens', color: '#00501e', icon: 'Lens' },
  bluesky: { label: 'Bluesky', color: '#1185fe', icon: 'Bluesky' },
  direct: { label: 'DegenFeed', color: '#00ff41', icon: 'DegenFeed' },
};

export interface AggregatedShort {
  id: string;
  source: ExtendedSource;
  sourceLabel: string;
  sourceColor: string;
  sourceUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  creatorName: string;
  creatorAvatar?: string;
  creatorHandle?: string;
  /** Creator wallet address (for on-chain tips) */
  creatorAddress?: string;
  views: number;
  likes: number;
  tags: string[];
  categories: string[];
  publishedAt: number;
  qualityScore: number;
  engagementRate: number;
  canTip: boolean;
  /** SHA-256 or URL-based dedup hash */
  contentHash: string;
  /** Vertical format flag */
  vertical: boolean;

  // ── Zora NFT marketplace data ─────────────────────────────────────
  /** Zora token ID (if this short is minted as an NFT) */
  zoraTokenId?: string;
  /** Zora contract address */
  zoraContractAddress?: string;
  /** Zora collect/buy URL */
  zoraUrl?: string;
  /** Current lowest ask price in ETH (for buy button) */
  zoraPriceEth?: string;
  /** Active bid count */
  zoraBidCount?: number;
  /** Highest bid in ETH */
  zoraTopBidEth?: string;
  /** Creator earnings in ETH from this NFT */
  zoraCreatorEarningsEth?: string;
  /** Total mints/editions sold */
  zoraEditionMints?: number;
  /** Whether buy/bid is available */
  zoraMarketplaceActive?: boolean;

  // ── Cross-platform availability ───────────────────────────────────
  /** Other platforms/sources where this same content is available */
  alsoAvailableOn?: Array<{
    source: ExtendedSource;
    label: string;
    url: string;
  }>;
}

export interface AggregationResult {
  shorts: AggregatedShort[];
  sourceCounts: Record<ExtendedSource, number>;
  sourceHealth: SourceHealth[];
  aggregatedAt: number;
}

export interface AggregationOpts {
  sources?: ExtendedSource[];
  limit?: number;
  deduplicate?: boolean;
}

/** Max video duration (seconds) to qualify as a "short" */
export const SHORTS_MAX_DURATION = 120;

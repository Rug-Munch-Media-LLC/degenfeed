/**
 * @degenfeed/utils — CrossProtocolCommunity
 *
 * A DegenFeed community exists simultaneously across multiple social
 * protocols (Lemmy, Nostr, Farcaster, Mastodon, Bluesky). Posting
 * to the community publishes to ALL networks. Following on any
 * network subscribes you everywhere.
 *
 * Community records are stored in KV: `community:{id}` for the data,
 * and `communities:index` for the sorted set of all community IDs.
 */

export interface CrossProtocolCommunity {
  /** Unique slug (e.g. "crypto", "ethereum", "defi") */
  id: string;
  /** Short name used in URLs and tags (e.g. "crypto") */
  name: string;
  /** Human-readable title (e.g. "Crypto & Blockchain") */
  displayName: string;
  /** Markdown description */
  description: string;
  /** Icon URL (square, 256×256) */
  icon?: string;
  /** Banner URL (1200×300) */
  banner?: string;
  /** Unix ms timestamp of creation */
  createdAt: number;
  /** Creator of the community */
  creator: {
    walletAddress: string;
    /** Map of protocol → identity handle/id */
    identities: Record<string, string>;
  };
  /** Protocol-specific links and metadata */
  protocols: {
    lemmy?: {
      communityUrl: string;
      communityId: number;
      members: number;
    };
    nostr?: {
      relayUrl: string;
      topicTag: string;
    };
    farcaster?: {
      channelId: string;
      channelUrl: string;
    };
    mastodon?: {
      hashtag: string;
      groupHandle?: string;
    };
    bluesky?: {
      feedUri: string;
      feedName: string;
    };
    lens?: {
      profileId: string;
    };
  };
  /** Total estimated member count across all protocols */
  memberCount: number;
  /** Total estimated post count across all protocols */
  postCount: number;
  /** Tags for discovery */
  tags?: string[];
  /** Token gate — only holders can join this community */
  tokenGate?: {
    type: 'erc20' | 'erc721' | 'erc1155';
    chain: 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism';
    contractAddress: string;
    tokenId?: string;
    minBalance?: number;
    minBalanceDecimals?: number;
    displaySymbol?: string;
  };
}

/** KV key prefix for community records */
export const COMMUNITY_KV_PREFIX = 'community:';

/** Build the KV key for a community by id */
export function communityKey(id: string): string {
  return `${COMMUNITY_KV_PREFIX}${id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
}

/** KV key for the sorted index of all community IDs */
export const COMMUNITY_INDEX_KEY = 'communities:index';

/** KV key for per-community feed concatenation */
export function communityFeedKey(name: string): string {
  return `community:feed:${name.toLowerCase()}`;
}

/** KV key for per-community member list */
export function communityMembersKey(name: string): string {
  return `community:members:${name.toLowerCase()}`;
}

/** Estimate a unique community slug from a name */
export function slugifyCommunity(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

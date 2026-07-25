export interface ResolvedIdentity {
  id: string;
  protocol: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
  address?: string;
  color: string;
  isPrimary: boolean;
  verified: boolean;
}

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
  tipsReceived: number;
}

export type ProfileTab = 'posts' | 'replies' | 'media' | 'likes' | 'podcast' | 'music';

/** Content source type matching the unified feed */
export type ContentSource = string;

/** Generic tab content item from any protocol */
export interface TabContentItem {
  id: string;
  protocol: string;
  title?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  createdAt: number;
  engagement?: {
    likes: number;
    shares: number;
    comments: number;
    tips: number;
  };
  meta?: Record<string, unknown>;
  sourceLabel?: string;
  authorName?: string;
  authorAvatar?: string;
  authorHandle?: string;
}

/** Tab definition for the profile content tabs */
export interface TabDefinition {
  id: string;
  label: string;
  icon: string;
  sources: string[];
  showWhenEmpty: boolean;
  emptyMessage: string;
}

/** A podcast on a creator's profile */
export interface ProfilePodcast {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  episodeCount: number;
  totalPlays: number;
  latestEpisode?: ProfilePodcastEpisode;
  feedUrl?: string;
  activityPubId?: string;
}

/** A podcast episode on a creator's profile */
export interface ProfilePodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  publishedAt?: number;
  plays: number;
  tipsReceived: string;
}

/** A Funkwhale track on a creator's profile */
export interface ProfileMusicTrack {
  id: string;
  title: string;
  artistName: string;
  albumTitle?: string;
  audioUrl: string;
  coverUrl?: string;
  duration: number;
  listens: number;
  tipsReceived: string;
  publishedAt?: number;
}

/** A Funkwhale album */
export interface ProfileMusicAlbum {
  id: string;
  title: string;
  artistName: string;
  coverUrl?: string;
  trackCount: number;
  totalListens: number;
}

/* ── Earnings Types ─────────────────────────────────────────────── */

export interface EarningsData {
  total: {
    usd: number;
    byStream: Record<string, number>;
  };
  byProtocol: Record<string, number>;
  byChain: Record<string, number>;
  history: {
    labels: string[];
    values: number[];
  };
  topContent: Array<{
    id: string;
    title: string;
    protocol: string;
    earnings: number;
    earningsUsd: number;
    engagements: number;
    date: string;
  }>;
  subscriptions?: {
    active: number;
    monthlyRecurring: number;
    lifetimeValue: number;
  };
  coinRevenue?: {
    tradingFees: number;
    creatorRevenue: number;
    holders: number;
  };
  nftSales?: {
    total: number;
    items: number;
    royalties: number;
  };
  withdrawable: {
    totalUsd: number;
    byChain: Record<string, { amount: string; token: string }>;
  };
  lastUpdated: number;
  isMock: boolean;
}

export interface EarningsPeriod {
  label: string;
  value: string;
}

/* ── Content Library Types ──────────────────────────────────────── */

export interface ContentLibraryItem {
  id: string;
  sourceId?: string;
  protocol: string;
  contentType: string;
  title?: string;
  body?: string;
  url?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
  engagement: {
    views: number;
    likes: number;
    reposts: number;
    replies: number;
    tips: number;
    tipsUsd: number;
  };
  monetization?: {
    type: string;
    enabled: boolean;
    price?: string;
  };
  tags?: string[];
  protocols?: string[];
}

export type ContentFilter = 'all' | 'text' | 'image' | 'video' | 'audio' | 'link';
export type ContentSort = 'newest' | 'oldest' | 'engagement' | 'earnings' | 'updated';

/* ── Audience Types ─────────────────────────────────────────────── */

export interface AudienceData {
  totalFollowers: number;
  byProtocol: Record<string, number>;
  growth: {
    labels: string[];
    values: number[];
  };
  topFollowers: Array<{
    id: string;
    handle: string;
    displayName: string;
    protocol: string;
    avatarUrl?: string;
    engagement: number;
  }>;
  demographics: {
    byInstance: Record<string, number>;
    byLocation: Record<string, number>;
    byCommunity: Array<{ name: string; count: number }>;
  };
  sources: Record<string, number>;
  lastUpdated: number;
}

/* ── Creator Settings Types ─────────────────────────────────────── */

export interface CreatorSettings {
  profile: {
    displayName: string;
    bio: string;
    avatarUrl?: string;
    coverUrl?: string;
    website?: string;
    location?: string;
  };
  crossPosting: {
    defaultProtocols: string[];
    autoPost: boolean;
    defaultLicense: string;
  };
  monetization: {
    evmAddress: string;
    solanaAddress: string;
    lightningAddress: string;
    preferredMethod: string;
    tipEnabled: boolean;
    subscriptionEnabled: boolean;
    coinFlipEnabled: boolean;
  };
  notifications: {
    tips: boolean;
    subscriptions: boolean;
    follows: boolean;
    mentions: boolean;
    reposts: boolean;
    newsletter: boolean;
    emailDigest: 'never' | 'daily' | 'weekly';
    pushEnabled: boolean;
  };
  connectedProtocols: string[];
  apiKeys: Array<{
    name: string;
    key: string;
    createdAt: number;
    lastUsed?: number;
    scopes: string[];
  }>;
}

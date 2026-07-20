/**
 * Shared types for Feddy Communities components
 */

export type FeddyCategory =
  | 'crypto' | 'tech' | 'art' | 'music' | 'gaming' | 'sports'
  | 'food' | 'travel' | 'fashion' | 'health' | 'education'
  | 'finance' | 'science' | 'literature' | 'film' | 'general';

export type FederationStatus = 'active' | 'limited' | 'suspended';
/** Extended member roles with badge tiers */
export type MemberRole = 'owner' | 'moderator' | 'contributor' | 'vip' | 'og' | 'member';

export interface FeddyCommunity {
  id: string;
  name: string;
  displayName: string;
  description: string;
  rules: string[];
  category: FeddyCategory;
  tags: string[];
  owner: string;
  moderators: string[];
  memberCount: number;
  createdAt: number;
  updatedAt: number;
  isPrivate: boolean;
  linkedCoin: string | null;
  gtsHandle: string;
  gtsId: string;
  avatarUrl: string;
  bannerUrl: string;
  federationStatus: FederationStatus;
  totalPosts: number;
  // --- NEW FIELDS ---
  communityTokenMint?: string | null;
  communityTokenSymbol?: string | null;
  treasuryAddress?: string | null;
  totalTokenSupply?: number;
  hasWiki?: boolean;
  hasEvents?: boolean;
  hasPolls?: boolean;
  hasTreasury?: boolean;
  discordLink?: string | null;
  telegramLink?: string | null;
  rssFeedUrl?: string | null;
  webhookUrl?: string | null;
  botToken?: string | null;
  featuredUntil?: number;
  remoteInstance?: string | null;
  featuredPosition?: number;
  viewerRole?: MemberRole | null;
}

export interface CommunityMember {
  wallet: string;
  role: MemberRole;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: number;
  postCount?: number;
  tokenBalance?: number;
  badgeIds?: string[];
}

export interface CommunityPost {
  id: string;
  communityId: string;
  author: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  text: string;
  embeds?: Array<{ kind: 'image' | 'video' | 'link' | 'poll'; url: string; meta?: Record<string, unknown> }>;
  gtsStatusId: string;
  createdAt: number;
  likes: number;
  replies: number;
  boosts: number;
  isPinned?: boolean;
  crossPostSource?: string | null;
  isAnnouncement?: boolean;
}

export interface CommunityStats {
  memberCount: number;
  postCount: number;
  postsLast24h: number;
  postsLast7d: number;
  activeMembers: number;
  topContributors: Array<{ wallet: string; displayName: string; postCount: number }>;
  treasuryBalance?: number;
  eventsThisMonth?: number;
  activePolls?: number;
  memberGrowth7d?: number;
  postGrowth7d?: number;
  federatedInstances?: number;
}

export interface DirectoryEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: FeddyCategory;
  tags: string[];
  memberCount: number;
  postCount: number;
  createdAt: number;
  avatarUrl: string;
  federationStatus: FederationStatus;
  linkedCoin: string | null;
  trendingScore: number;
  communityTokenSymbol?: string | null;
  featuredPosition?: number;
  remoteInstance?: string | null;
}

export interface CommunityEvent {
  id: string;
  communityId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  location: string;
  createdBy: string;
  createdAt: number;
  maxAttendees: number;
  rsvpCount: number;
  coverUrl?: string;
  isVirtual: boolean;
  tags: string[];
}

export interface EventRSVP {
  wallet: string;
  displayName?: string;
  status: 'going' | 'maybe' | 'declined';
  respondedAt: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface CommunityPoll {
  id: string;
  communityId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  isMultipleChoice: boolean;
  totalVotes: number;
  isClosed: boolean;
}

export interface WikiPage {
  id: string;
  title: string;
  content: string;
  slug: string;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  criteria: string;
  createdAt: number;
}

export interface TreasuryState {
  communityId: string;
  balance: string;
  tokenMint: string;
  totalDeposits: string;
  totalWithdrawals: string;
  updatedAt: number;
}

export interface TreasuryTx {
  id: string;
  communityId: string;
  type: 'deposit' | 'withdrawal' | 'reward' | 'fee_share' | 'community_fund';
  amount: string;
  from: string;
  to: string;
  memo: string;
  txSignature: string;
  createdAt: number;
}

export interface CommunityTokenConfig {
  communityId: string;
  mintAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: number;
  isTradeable: boolean;
  feeSharePercent: number;
  rewardPerPost: number;
  createdAt: number;
}

export interface TokenGate {
  id: string;
  name: string;
  minBalance: number;
  isRequired: boolean;
  channelName?: string;
  createdAt: number;
}

export interface Report {
  id: string;
  communityId: string;
  reporterWallet: string;
  targetWallet: string;
  targetPostId?: string;
  category: ReportCategory;
  description: string;
  evidenceUrls?: string[];
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolution?: string;
  createdAt: number;
  resolvedAt?: number;
}

export type ReportCategory =
  | 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'nsfw'
  | 'impersonation' | 'copyright' | 'scam' | 'other';

export interface Appeal {
  id: string;
  communityId: string;
  wallet: string;
  reason: string;
  status: 'pending' | 'granted' | 'denied';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: number;
  reviewedAt?: number;
}

export interface FederationHealth {
  gtsHandle: string;
  gtsId: string;
  federationStatus: FederationStatus;
  totalFollowers: number;
  followerInstances: Array<{
    instanceUrl: string;
    followersCount: number;
    firstSeen: number;
    lastActivity: number;
    status: 'active' | 'delayed' | 'error';
  }>;
  followerGrowth7d: number;
  lastFederatedAt: number;
  failedPushes24h: number;
  remoteFollowers: Array<{
    instanceUrl: string;
    actorId: string;
    username: string;
    domain: string;
    followedAt: number;
  }>;
}

export interface AutocompleteResult {
  name: string;
  displayName: string;
  avatarUrl: string;
  memberCount: number;
  category: FeddyCategory;
}

export interface WebhookConfig {
  id: string;
  communityId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: number;
  lastDelivery?: number;
  lastStatus?: number;
}

export interface BotApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt?: number;
  isActive: boolean;
}

// === Constants =========================================================

export const CATEGORY_LABELS: Record<FeddyCategory, string> = {
  crypto: 'Crypto',
  tech: 'Tech',
  art: 'Art',
  music: 'Music',
  gaming: 'Gaming',
  sports: 'Sports',
  food: 'Food',
  travel: 'Travel',
  fashion: 'Fashion',
  health: 'Health',
  education: 'Education',
  finance: 'Finance',
  science: 'Science',
  literature: 'Literature',
  film: 'Film',
  general: 'General',
};

export const CATEGORY_EMOJIS: Record<FeddyCategory, string> = {
  crypto: '₿',
  tech: '💻',
  art: '🎨',
  music: '🎵',
  gaming: '🎮',
  sports: '⚽',
  food: '🍕',
  travel: '✈️',
  fashion: '👗',
  health: '💪',
  education: '📚',
  finance: '💰',
  science: '🔬',
  literature: '📖',
  film: '🎬',
  general: '🌐',
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  moderator: 'Moderator',
  contributor: 'Contributor',
  vip: 'VIP',
  og: 'OG Member',
  member: 'Member',
};

export const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'text-amber-400 bg-amber-500/15',
  moderator: 'text-blue-400 bg-blue-500/15',
  contributor: 'text-green-400 bg-green-500/15',
  vip: 'text-purple-400 bg-purple-500/15',
  og: 'text-orange-400 bg-orange-500/15',
  member: 'text-[var(--color-muted)] bg-[var(--color-overlay)]',
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate Speech',
  violence: 'Violence',
  nsfw: 'NSFW',
  impersonation: 'Impersonation',
  copyright: 'Copyright',
  scam: 'Scam',
  other: 'Other',
};

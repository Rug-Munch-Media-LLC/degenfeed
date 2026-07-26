// ─── Types ──────────────────────────────────────────────────────────────

export type FeddyCategory =
  | 'crypto'
  | 'tech'
  | 'art'
  | 'music'
  | 'gaming'
  | 'sports'
  | 'food'
  | 'travel'
  | 'fashion'
  | 'health'
  | 'education'
  | 'finance'
  | 'science'
  | 'literature'
  | 'film'
  | 'general';

export type FederationStatus = 'active' | 'limited' | 'suspended';

/** Extended member roles */
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
  /** Community token config mint address */
  communityTokenMint?: string | null;
  /** Community token symbol (e.g. "$ART") */
  communityTokenSymbol?: string | null;
  /** Treasury public key for receiving fees */
  treasuryAddress?: string | null;
  /** Total tokens minted for the community */
  totalTokenSupply?: number;
  /** Whether community has a wiki enabled */
  hasWiki?: boolean;
  /** Whether community has an events calendar */
  hasEvents?: boolean;
  /** Whether community has polls enabled */
  hasPolls?: boolean;
  /** Whether community has a treasury */
  hasTreasury?: boolean;
  /** Link to Discord server */
  discordLink?: string | null;
  /** Link to Telegram group */
  telegramLink?: string | null;
  /** RSS feed URL for the community */
  rssFeedUrl?: string | null;
  /** Webhook URL for community events */
  webhookUrl?: string | null;
  /** Bot token for programmatic posting */
  botToken?: string | null;
  /** Featured until timestamp (0 = not featured) */
  featuredUntil?: number;
  /** Instance URL where this community was discovered from (for remote) */
  remoteInstance?: string | null;
  /** Category page featured position (0 = not featured) */
  featuredPosition?: number;
}

export interface CommunityMember {
  wallet: string;
  role: MemberRole;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: number;
  /** Total posts by this member */
  postCount?: number;
  /** Token balance for community token */
  tokenBalance?: number;
  /** Badge IDs earned */
  badgeIds?: string[];
}

export interface CommunityPost {
  id: string;
  communityId: string;
  author: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  text: string;
  embeds?: Array<{
    kind: 'image' | 'video' | 'link' | 'poll';
    url: string;
    meta?: Record<string, unknown>;
  }>;
  gtsStatusId: string;
  createdAt: number;
  likes: number;
  replies: number;
  boosts: number;
  /** Whether post is pinned */
  isPinned?: boolean;
  /** If this is a cross-post, source protocol */
  crossPostSource?: string | null;
  /** If this is an announcement */
  isAnnouncement?: boolean;
}

export interface CommunityStats {
  memberCount: number;
  postCount: number;
  postsLast24h: number;
  postsLast7d: number;
  activeMembers: number;
  topContributors: Array<{
    wallet: string;
    displayName: string;
    postCount: number;
  }>;
  // --- NEW ---
  /** Total treasury balance */
  treasuryBalance?: number;
  /** Number of events this month */
  eventsThisMonth?: number;
  /** Number of active polls */
  activePolls?: number;
  /** Member growth rate (7d %) */
  memberGrowth7d?: number;
  /** Post growth rate (7d %) */
  postGrowth7d?: number;
  /** Federated instance count */
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
  // --- NEW ---
  communityTokenSymbol?: string | null;
  featuredPosition?: number;
  remoteInstance?: string | null;
}

export interface DirectoryResult {
  entries: DirectoryEntry[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

// ─── Event Types ────────────────────────────────────────────────────────

export interface CommunityEvent {
  id: string;
  communityId: string;
  title: string;
  description: string;
  startTime: number; // Unix ms
  endTime: number; // Unix ms
  location: string; // URL or physical location
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

// ─── Poll Types ─────────────────────────────────────────────────────────

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

export interface PollVote {
  wallet: string;
  optionId: string;
  votedAt: number;
}

// ─── Wiki Types ─────────────────────────────────────────────────────────

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

// ─── Badge Types ────────────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  criteria: string; // e.g. "100_posts" | "early_adopter" | "top_contributor"
  createdAt: number;
  createdBy: string;
}

// ─── Treasury Types ─────────────────────────────────────────────────────

export interface TreasuryState {
  communityId: string;
  /** Balance in smallest units */
  balance: string;
  /** Token mint address */
  tokenMint: string;
  /** Total deposits */
  totalDeposits: string;
  /** Total withdrawals */
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

// ─── Token Types ────────────────────────────────────────────────────────

export interface CommunityTokenConfig {
  communityId: string;
  mintAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: number;
  /** Whether token is tradeable on DEX */
  isTradeable: boolean;
  /** Percentage of creator coin fees that go to treasury (0-100) */
  feeSharePercent: number;
  /** Tokens rewarded per post */
  rewardPerPost: number;
  createdAt: number;
}

export interface TokenGate {
  id: string;
  name: string;
  /** Minimum token balance required */
  minBalance: number;
  /** If true, only token holders can view/post */
  isRequired: boolean;
  /** Optional channel/topic filter */
  channelName?: string;
  createdAt: number;
}

// ─── Moderation Types ───────────────────────────────────────────────────

export interface ModLogEntry {
  id: string;
  communityId: string;
  action:
    | 'ban'
    | 'unban'
    | 'warn'
    | 'remove_post'
    | 'pin'
    | 'unpin'
    | 'change_role'
    | 'update_settings'
    | 'delete_post'
    | 'mute'
    | 'block_instance'
    | 'unblock_instance'
    | 'appeal_granted'
    | 'appeal_denied';
  moderatorWallet: string;
  targetWallet?: string;
  reason: string;
  details?: Record<string, unknown>;
  createdAt: number;
}

export type ReportCategory =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'nsfw'
  | 'impersonation'
  | 'copyright'
  | 'scam'
  | 'other';

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

export interface KeywordFilter {
  id: string;
  pattern: string; // regex or literal
  isRegex: boolean;
  action: 'flag' | 'block' | 'require_approval';
  createdAt: number;
  createdBy: string;
}

export interface FedBlocklistEntry {
  instanceUrl: string;
  reason: string;
  blockedBy: string;
  blockedAt: number;
}

// ─── Webhook / Bot Types ────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  communityId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdBy: string;
  createdAt: number;
  lastDelivery?: number;
  lastStatus?: number;
}

export type WebhookEvent =
  | 'post.created'
  | 'post.deleted'
  | 'member.joined'
  | 'member.left'
  | 'member.banned'
  | 'event.created'
  | 'poll.closed'
  | 'treasury.deposit'
  | 'treasury.withdrawal';

export interface BotApiKey {
  id: string;
  communityId: string;
  name: string;
  keyHash: string;
  scopes: BotScope[];
  createdBy: string;
  createdAt: number;
  lastUsedAt?: number;
  isActive: boolean;
}

export type BotScope = 'post:write' | 'post:read' | 'members:read' | 'stats:read';

// ─── Federation Types ───────────────────────────────────────────────────

export interface FederationHealth {
  communityId: string;
  /** Instances that are following this community */
  followerInstances: Array<{
    instanceUrl: string;
    followersCount: number;
    firstSeen: number;
    lastActivity: number;
    status: 'active' | 'delayed' | 'error';
  }>;
  /** Total followers across all instances */
  totalFollowers: number;
  /** Follower growth over last 7d */
  followerGrowth7d: number;
  /** Last successful federation push */
  lastFederatedAt: number;
  /** Number of failed pushes in last 24h */
  failedPushes24h: number;
  /** Remote instances that have been discovered */
  remoteFollowers: Array<{
    instanceUrl: string;
    actorId: string;
    username: string;
    domain: string;
    followedAt: number;
  }>;
}

export interface RemoteCommunity {
  id: string;
  name: string;
  displayName: string;
  description: string;
  instanceUrl: string;
  memberCount: number;
  avatarUrl: string;
  category?: string;
  tags: string[];
  originalUrl: string;
  discoveredAt: number;
  lastRefreshed: number;
}

// ─── Trending / Discovery Types ─────────────────────────────────────────

export interface TrendingScore {
  communityId: string;
  score: number;
  memberGrowth24h: number;
  memberGrowth7d: number;
  postGrowth24h: number;
  postGrowth7d: number;
  calculatedAt: number;
}

export interface AutocompleteResult {
  name: string;
  displayName: string;
  avatarUrl: string;
  memberCount: number;
  category: FeddyCategory;
}

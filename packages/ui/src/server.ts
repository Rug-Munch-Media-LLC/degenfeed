// Server-safe entry point for @degenfeed/ui
// Only export components that do NOT use React hooks or "use client" directives.
// Server Components should import from '@degenfeed/ui/server' instead of '@degenfeed/ui'.

// ─── Loading / Skeleton ────────────────────────────────────────────
export { PostCardSkeleton } from './PostCardSkeleton';
export type { PostCardSkeletonProps } from './PostCardSkeleton';

// ─── Empty States ──────────────────────────────────────────────────
export { PostCardEmpty } from './PostCardEmpty';
export type { PostCardEmptyProps } from './PostCardEmpty';

// ─── Pure Utility Components (no hooks) ───────────────────────────

export { ProtocolBadge, getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';
export type { ProtocolBadgeProps } from './ProtocolBadge';

export { CommunityBadge, COMMUNITY_COLORS } from './CommunityBadge';
export type { CommunityBadgeProps } from './CommunityBadge';

export { IdentityBadge, CROSS_PROTOCOL_ICONS } from './IdentityBadge';
export type { IdentityBadgeProps } from './IdentityBadge';

export { LensPublicationBadge } from './LensPublicationBadge';
export type { LensPublicationBadgeProps } from './LensPublicationBadge';

export { MastodonInstanceContext } from './MastodonInstanceContext';
export type { MastodonInstanceContextProps } from './MastodonInstanceContext';

export { BlueskyPostContext } from './BlueskyPostContext';
export type { BlueskyPostContextProps } from './BlueskyPostContext';

export { PermanenceBadge } from './PostCardMedia';
export type { PermanenceBadgeProps } from './PostCardMedia';

// ─── Types only (no runtime) ──────────────────────────────────────

export type { ContentProof, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { EngagementAction } from '@degenfeed/types';

export type {
  CalendarPost,
  ContentCalendarProps,
} from './ContentCalendar';

export type {
  PlatformAccount,
  PlatformStatus,
  RegisterPlatformStatusData,
  RegistrationPlatform,
  RegistrationStatus,
} from './CrossPlatformSetup';

export type {
  CrossProtocolReplyCount,
  CrossProtocolThreadIndicatorProps,
} from './CrossProtocolThreadIndicator';

export type {
  EmbedModalProps,
} from './EmbedModal';

export type {
  EmptyRowProps,
  EmptyStateProps,
} from './EmptyState';

export type {
  ErrorBannerProps,
  ErrorStateProps,
} from './ErrorState';

export type {
  FeedBuilderModalProps,
} from './FeedBuilderModal';

export type {
  DiscoverSuggestion,
  FeedListProps,
  FeedState,
} from './FeedList';

export type {
  FrameEmbedProps,
} from './FrameEmbed';

export type {
  FundingRound,
} from './FundingCard';

export type {
  LeaderboardCardEntry,
  LeaderboardCardProps,
} from './LeaderboardCard';

export type {
  LemmyComment,
  LemmyThreadViewProps,
} from './LemmyThreadView';

export type {
  LemmyTipButtonProps,
} from './LemmyTipButton';

export type {
  LemmyVotingProps,
} from './LemmyVoting';

export type {
  ListSkeletonProps,
} from './ListSkeleton';

export type {
  PeerTubeEmbedProps,
} from './PeerTubeEmbed';

export type {
  PostCardProps,
} from './PostCard';

export type {
  FrameCardProps,
  ImageGridProps,
  LinkPreviewProps,
  PostCardMediaProps,
  VideoEmbedCardProps,
} from './PostCardMedia';

export type {
  PostCardEngagementProps,
} from './PostCardEngagement';

export type {
  QuickTipButtonProps,
} from './QuickTipButton';

export type {
  ReportModalProps,
} from './ReportModal';

export type {
  ReputationBadgeProgress,
  ReputationBadgeScore,
  BloxReputationBadgeProps,
} from './ReputationBadge';

export type {
  ProtocolOption,
  SignInModalProps,
  WalletOption,
} from './SignInModal';

export type {
  SpaceData,
  SpaceRoomProps,
} from './SpaceRoom';

export type {
  TokenChartProps,
} from './TokenChart';

export type {
  CommunityGateBadgeProps,
  PostGateBadgeProps,
} from './TokenGateBadge';

export type {
  TokenGateConfiguratorProps,
} from './TokenGateConfigurator';

export type {
  TranslationPreviewProps,
} from './TranslationPreview';

export type {
  ActiveCommunity,
  LiveSpace,
  PopularVideo,
  TopTipper,
  TrendingFarcasterCast,
  TrendingNostrNote,
  TrendingSidebarData,
  TrendingSidebarProps,
  TrendingTopic,
} from './TrendingSidebar';

export type {
  ProfileHandle,
  UnifiedProfileHeaderProps,
} from './UnifiedProfileHeader';

export type {
  TipDashboardPlatform,
  UnifiedTipDashboardProps,
  UnifiedTipStats,
} from './UnifiedTipDashboard';

export type {
  AspectRatio,
  VideoPlatform,
  VideoPlayerProps,
} from './VideoPlayer';

export type {
  ProposalData,
  VoteChoice,
  VoteResults,
  VotingPanelProps,
} from './VotingPanel';

export type {
  YouTubeVideoCardItem,
  YouTubeVideoCardProps,
} from './YouTubeVideoCard';

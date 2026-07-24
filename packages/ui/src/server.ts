// Server-safe entry point for @degenfeed/ui
// Only export components that do NOT use React hooks or "use client" directives.
// Server Components should import from '@degenfeed/ui/server' instead of '@degenfeed/ui'.

export type { PostCardEmptyProps } from './PostCardEmpty';
// ─── Empty States ──────────────────────────────────────────────────
export { PostCardEmpty } from './PostCardEmpty';
export type { PostCardSkeletonProps } from './PostCardSkeleton';
// ─── Loading / Skeleton ────────────────────────────────────────────
export { PostCardSkeleton } from './PostCardSkeleton';

// ─── Pure Utility Components (no hooks) ───────────────────────────

export type { BlueskyPostContextProps } from './BlueskyPostContext';
export { BlueskyPostContext } from './BlueskyPostContext';
export type { CommunityBadgeProps } from './CommunityBadge';
export { COMMUNITY_COLORS, CommunityBadge } from './CommunityBadge';
export type { IdentityBadgeProps } from './IdentityBadge';
export { CROSS_PROTOCOL_ICONS, IdentityBadge } from './IdentityBadge';
export type { LensPublicationBadgeProps } from './LensPublicationBadge';
export { LensPublicationBadge } from './LensPublicationBadge';
export type { MastodonInstanceContextProps } from './MastodonInstanceContext';
export { MastodonInstanceContext } from './MastodonInstanceContext';
export { PermanenceBadge } from './PostCardMedia';
export type { ProtocolBadgeProps } from './ProtocolBadge';
export {
  getProtocolColor,
  getProtocolIcon,
  getProtocolLabel,
  ProtocolBadge,
} from './ProtocolBadge';

// ─── Types only (no runtime) ──────────────────────────────────────

export type {
  ContentProof,
  EngagementAction,
  Protocol,
  UnifiedIdentity,
  UnifiedPost,
} from '@degenfeed/types';

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

export type { EmbedModalProps } from './EmbedModal';

export type {
  EmptyRowProps,
  EmptyStateProps,
} from './EmptyState';

export type {
  ErrorBannerProps,
  ErrorStateProps,
} from './ErrorState';

export type { FeedBuilderModalProps } from './FeedBuilderModal';

export type {
  DiscoverSuggestion,
  FeedListProps,
  FeedState,
} from './FeedList';

export type { FrameEmbedProps } from './FrameEmbed';

export type { FundingRound } from './FundingCard';

export type {
  LeaderboardCardEntry,
  LeaderboardCardProps,
} from './LeaderboardCard';

export type {
  LemmyComment,
  LemmyThreadViewProps,
} from './LemmyThreadView';

export type { LemmyTipButtonProps } from './LemmyTipButton';

export type { LemmyVotingProps } from './LemmyVoting';

export type { ListSkeletonProps } from './LoadingSkeleton';

export type { PeerTubeEmbedProps } from './PeerTubeEmbed';

export type { PostCardProps } from './PostCard';

export type { PostCardEngagementProps } from './PostCardEngagement';

export type { QuickTipButtonProps } from './QuickTipButton';

export type { ReportModalProps } from './ReportModal';

export type {
  ReputationBadgeProgress,
  ReputationBadgeProps,
  ReputationBadgeScore,
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

export type { TokenChartProps } from './TokenChart';

export type {
  CommunityGateBadgeProps,
  PostGateBadgeProps,
} from './TokenGateBadge';

export type { TokenGateConfiguratorProps } from './TokenGateConfigurator';

export type { TranslationPreviewProps } from './TranslationPreview';

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

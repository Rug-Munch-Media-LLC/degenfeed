/**
 * @degenfeed/api-worker — Hono entry point
 *
 * Wraps the existing route handlers in a Hono app for runtime portability.
 * Keeps all handler signatures intact — Hono's c.req.raw returns a standard
 * Request, and handlers return Response, so no handler changes are needed.
 *
 * To deploy on Node.js/Deno/Bun instead of Cloudflare Workers, change
 * wrangler.toml "main" back to "src/index.ts" and run:
 *   npm run dev:node    # development
 *   npm run start:node  # production
 */

import { Hono } from 'hono';
import {
  apiKeyMiddleware,
  deleteApiKey,
  generateApiKey,
  storeApiKey,
  VALID_SCOPES,
} from './api-key';
import { applyCors, getAllowedOrigin, isAllowedOrigin, parseOriginHeader } from './cors';
import type { Env } from './index';
import { jsonResponse, tieredRateLimit } from './index';
import { validateBodySize } from './sanitize';
import { parseSessionCookie, validateCsrfToken } from './session';

// ─── Error logger ────────────────────────────────────────────

import { logError } from './error-logger';
import { requireAdminFromSession } from './lib/admin-guard';

// ─── Route handlers ──────────────────────────────────────────

import {
  handleCreatorRewards,
  handleCreatorRewardsClaim,
  handleCreatorRewardsCompute,
  handleCreatorRewardsHistory,
  handleCreatorRewardsLeaderboard,
} from './lib/creator-rewards';
import {
  handleDaoRegistryGet,
  handleDaoRegistryLink,
  handleDaoRegistryList,
  handleDaoRegistryRegister,
  handleDaoRegistryVerify,
} from './lib/dao-registry';
import {
  handleDefenderDisable,
  handleDefenderSetup,
  handleDefenderStatus,
  handleDefenderSync,
} from './lib/defender-integration';
// ─── External DAO Tooling Integrations ────────────────────────
import {
  handleDelegationSync,
  handleSnapshotImportVotes,
  handleSnapshotStrategyGenerate,
  handleSnapshotSyncProposal,
} from './lib/snapshot-integration';
import {
  handleTallyCompatibilityCheck,
  handleTallyRegister,
  handleTallyStatus,
} from './lib/tally-integration';
import { handleAccountExport } from './routes/account';
import {
  handleAccountDelete,
  handleAccountDeleteV1,
  handleCancelAccountDelete,
  handleConfirmDeleteSignature,
  handleDeleteChecklist,
  handleDeletionCertificate,
  handleReactivateAccount,
} from './routes/account-delete';
import {
  handleAddRule,
  handleGetSignals as handleAlgoGetSignals,
  handleApplyPreset,
  handleDeleteRule,
  handleExplainPost,
  handleGetPresets,
  handleGetWeights,
  handleListRules,
  handleResetWeights,
  handleSharePreset,
  handleUpdateSignals,
  handleUpdateWeights,
} from './routes/algo-control';
import { handleAnalytics } from './routes/analytics';
import { handleApiDocs, handleOpenApiJson } from './routes/api-docs';
import {
  handleGtSAuthorize,
  handleGtSCallback,
  handleGtSRegister,
  handleRedditCallback,
  handleThreadsAuthorize,
  handleThreadsCallback,
  handleWarpcastAuthorize,
  handleWarpcastCallback,
} from './routes/auth';
import {
  handleBillingCancel,
  handleBillingCheckout,
  handleBillingMyStatus,
  handleBillingStatus,
  handleBillingSubscribe,
  handleBillingVerify,
} from './routes/billing';
import { handleBlinkTip } from './routes/blink';
import {
  handleBlueskyLeaderboard,
  handleBlueskyTipCreate,
  handleBlueskyTipStats,
} from './routes/bluesky-tip';
import {
  handleCreatePoll,
  handleCreateStickerPack,
  handleDeleteFile,
  handleDeleteForMe,
  handleDownloadFile,
  handleEditMessage,
  handleGetFile,
  handleGetMedia,
  handleGetPoll,
  handleGetQuota,
  handleGetStickerPack,
  handleGetStickerPacks,
  handleGetTimer,
  handleLinkPreview,
  handleListFiles,
  handleListMedia,
  handleMarkMessageRead,
  handleRemoveTimer,
  handleSearchGifs,
  handleSetTimer,
  handleToggleReaction,
  handleUnsendMessage,
  handleUploadFile,
  handleUploadMedia,
  handleUploadVoiceNote,
  handleVotePoll,
} from './routes/chat-features';
import {
  handleAdvancedSearch,
  handleIndexMessage,
  handleSearchMedia,
  handleSearchMessages,
  handleSearchSuggestions,
} from './routes/chat-search';
import {
  handleCoinStatsGainers,
  handleCoinStatsHighestVolume,
  handleCoinStatsLosers,
  handleCoinStatsMostHolders,
  handleCoinStatsNew,
  handleCoinStatsOverview,
  handleCoinStatsTop,
  handleCoinStatsTrending,
} from './routes/coin-stats';
import { handleCommunities } from './routes/communities';
import {
  handleCommunitiesList,
  handleCommunityCreate,
  handleCommunityFeed,
  handleCommunityGet,
  handleCommunityJoin,
} from './routes/community';
import {
  handleAccountStatus,
  handleConnectPlatform,
  handleDisconnectPlatform,
  handleListConnectedAccounts,
  handleOAuthCallback,
  handleSubstackEmailSetup,
} from './routes/connected-accounts';
import { handleContentResolve } from './routes/content';
import { creatorConfig } from './routes/creator-config';
import {
  handleCreatorCoinAirdrop,
  handleCreatorCoinBurn,
  handleCreatorCoinGatedPost,
  handleCreatorCoinHolders,
  handleCreatorCoinRevenue,
  handleCreatorCoinStats,
  handleCreatorCoinsList,
  handleCreatorCoinTrades,
  handlePlatformRevenue,
} from './routes/creator-dashboard';
import { handleCreatorStorage } from './routes/creator-storage';
import { creatorVesting } from './routes/creator-vesting';
import { creatorVideos } from './routes/creator-videos';
import { handleCrossPostCentralized } from './routes/cross-post-centralized';
import { crossProtocolCoin } from './routes/cross-protocol-coin';
import { handleCrossReply } from './routes/cross-reply';
import { handleAltFeed, handleNewsletterFeed, handleTopFeed } from './routes/curated';
import {
  handleCuratedFeed,
  handleEngagementFeedback,
  handleMarkSeen,
  handleScrollDepth,
} from './routes/curated-feed';
import {
  handleCustomFeedCreate,
  handleCustomFeedDelete,
  handleCustomFeedExecute,
  handleCustomFeedGet,
  handleCustomFeedList,
  handleCustomFeedPublic,
  handleCustomFeedSubscribe,
  handleCustomFeedUpdate,
} from './routes/custom-feed';
import {
  handleDaoCreate,
  handleDaoDelegate,
  handleDaoDelegatesTop,
  handleDaoDelegationMine,
  handleDaoDelegationStatus,
  handleDaoDiscover,
  handleDaoGet,
  handleDaoJoin,
  handleDaoLeave,
  handleDaoMine,
  handleDaoProposalCreate,
  handleDaoProposalDelete,
  handleDaoProposalExecute,
  handleDaoProposalGet,
  handleDaoProposalMyVote,
  handleDaoProposalQueue,
  handleDaoProposalsList,
  handleDaoProposalUpdate,
  handleDaoProposalVote,
  handleDaoProposalVotes,
  handleDaoRevokeDelegation,
  handleDaoStats,
  handleDaoTreasuryGrantCreate,
  handleDaoTreasuryGrantMilestone,
  handleDaoTreasuryGrants,
  handleDaoTreasuryOverview,
  handleDaoTreasuryStreamCreate,
  handleDaoTreasuryStreamDelete,
  handleDaoTreasuryStreams,
  handleDaoTreasuryTransactions,
  handleDaoTreasuryTransfer,
  handleDaoUpdate,
} from './routes/dao';
import { handleDaoActivity, handleMyDaoActivity } from './routes/dao-activity';
import {
  handleGrantAnalytics,
  handleGrantApply,
  handleGrantCreateProgram,
  handleGrantFinalize,
  handleGrantListApplications,
  handleGrantListPrograms,
  handleGrantReview,
  handleGrantSubmitMilestone,
  handleGrantVote,
  handleInvestmentCreateProposal,
  handleInvestmentListProposals,
  handleInvestmentPerformance,
  handleInvestmentPortfolio,
  handleInvestmentVote,
  handleInvestmentYields,
  handleMultisigCancel,
  handleMultisigConfig,
  handleMultisigExecute,
  handleMultisigList,
  handleMultisigPropose,
  handleMultisigSaveConfig,
  handleMultisigSign,
  handleStreamAnalytics,
  handleStreamCancel,
  handleStreamCreate,
  handleStreamGet,
  handleStreamHistory,
  handleStreamList,
  handleStreamModify,
  handleStreamPause,
  handleStreamResume,
  handleTreasuryAnalytics,
} from './routes/dao-treasury';
import {
  handleExportActivityPub,
  handleExportAtProto,
  handleExportCsv,
  handleExportHtml,
  handleExportJson,
  handleExportManifest,
  handleExportNostr as handleExportNostrRoute,
  handleExportSolid,
} from './routes/data-export';
import {
  handleExportToBluesky,
  handleExportToMastodon,
  handleExportToNostr,
  handleImportBluesky,
  handleImportFarcaster,
  handleImportMastodon,
  handleImportNostr,
  handleImportTwitter,
  handleMigrationJobs,
  handleMigrationStatus,
} from './routes/data-migrate';
import {
  handleDedupCheck,
  handleDedupCluster,
  handleDedupHasSeen,
  handleDedupMarkSeen,
  handleDedupMarkSeenBatch,
  handleDedupRegister,
  handleDedupSeenFeedback,
  handleDedupSeenStats,
} from './routes/dedup';
import {
  handleDigestFormat,
  handleDigestStatus,
  handleDigestSubscribeEmail,
  handleDigestToday,
  handleDigestUnsubscribeEmail,
  handleDigestYesterday,
} from './routes/digest';
// ── New protocol integration route handlers ──────────────────
import {
  handleDiscordBridgeEnable,
  handleDiscordBridgeMessage,
  handleDiscordChannelAnnounce,
  handleDiscordChannelsList,
  handleDiscordCommunityCreate,
  handleDiscordCommunityInfo,
  handleDiscordConnect,
  handleDiscordConnectionStatus,
  handleDiscordDisconnect,
  handleDiscordDisconnectOAuth,
  handleDiscordGuilds,
  handleDiscordOAuth,
  handleDiscordOAuthCallback,
} from './routes/discord';
import {
  handleDiscover,
  handleDiscoverCommunities,
  handleDiscoverFeatured,
  handleDiscoverNew,
  handleDiscoverPeople,
  handleDiscoverTopics,
  handleDiscoverTrending,
} from './routes/discover';
import {
  handleCreateGroup,
  handleGetOfflineMessages,
  handleGetPublicKeys,
  handleGroupAddMember,
  handleGroupInfo,
  handleGroupMessages,
  handleGroupRemoveMember,
  handleGroupSend,
  handleKeyExchange,
  handleKeyStatus,
  handleReceiveEncrypted,
  handleRotateKeys,
  handleSafetyNumbers,
  handleSendEncrypted,
  handleTransportPrefs,
  handleUserGroups,
} from './routes/e2e-messages';
import {
  handleEmailRegister,
  handleEmailSignIn,
  handleEmailStatus,
  handleEmailVerify,
  handlePasswordResetConfirm,
  handlePasswordResetRequest,
} from './routes/email-auth';
import { handleEmbedPost, handleEmbedResolve } from './routes/embed';
import { handleEngage } from './routes/engage';
import {
  handleFarcasterCoinDeploy,
  handleFarcasterCoinGet,
  handleFarcasterCoinTip,
} from './routes/farcaster-coin';
import { handleFarcasterFeed } from './routes/farcaster-feed';
import { handleFeatures } from './routes/features';
import feddyCommunities from './routes/feddy-index';
import {
  handleFeedCacheInvalidate,
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleRedditFeed,
  handleTrendingFeed,
} from './routes/feed';
import {
  handleCategoryMixFeed,
  handleCategorySlugFeed,
  handleEverythingFeed,
  handlePerProtocolCategoryFeed,
} from './routes/feed-category';
import {
  handleProtocolFeed,
  handleProtocolNewest,
  handleProtocolPopular,
  handleProtocolsList,
  handleProtocolTrendingRoute,
  handleProtocolVideos,
} from './routes/feed-protocol';
import {
  handleCategoryFeed,
  handleUnifiedFeed as handleContentPipelineFeed,
  handleDefaultFeed,
  handleNetworkFeed,
  handleSourceDiscovery,
  handleTrendingContent,
  handleForYouFeed as handleUnifiedForYouFeed,
  handleUnifiedSearch,
} from './routes/feed-unified';
import {
  handleAdjustTopic,
  handleClearTopic,
  handleFeedback,
  handleForYouFeed,
  handleGetTopics,
  handleRecordDwell,
} from './routes/for-you';
import { handleFrameAction, handleFrameResolve } from './routes/frame';
import { handleFundingFeed } from './routes/funding';
import {
  handleAchievementCheck,
  handleAchievements,
  handleActivityRecord,
  handleChallengeProgress,
  handleChallengesToday,
  handleRecentActivity,
  handleSocialProof,
  handleStreakCheck,
  handleStreakLeaderboard,
  handleXp,
  handleXpAward,
} from './routes/gamification';
import {
  handleGhostCrossPost,
  handleGhostNewsletterSend,
  handleGhostPostBySlug,
  handleGhostPostCreate,
  handleGhostPosts,
  handleGhostSubscribe,
  handleGhostSubscribers,
  handleGhostTip,
  handleGhostUnsubscribe,
} from './routes/ghost';
import {
  handleGitHubBridgeActivity,
  handleGitHubConnect,
  handleGitHubConnectedAccounts,
  handleGitHubDisconnect,
  handleGitHubRepoActivity,
} from './routes/github-connect';
import {
  handleProposalCreate,
  handleProposalResults,
  handleProposalsList,
  handleProposalVote,
} from './routes/governance';
import { handleFullHealth, handleProtocolsHealth, handleRelaysHealth } from './routes/health';
import {
  handleHwWalletChallenge,
  handleHwWalletStatus,
  handleHwWalletToggle,
  handleHwWalletVerify,
  handleHwWalletVerifyOnLogin,
} from './routes/hw-wallet-2fa';
import {
  handleGetIdentityProfile,
  handleLinkIdentity,
  handleResolveIdentity,
  handleUnlinkIdentity,
} from './routes/identity';
import {
  handleCreateAtproto,
  handleIdentityDiscover,
  handleIdentityDiscoveryStatus,
  handleStatus as handleIdentityExtensionsStatus,
  handleIdentityLinkAll,
  handleLinkAtproto,
  handleLinkTelegram,
  handleLinkZora,
  handleResolveDid,
  handleResolveWallet,
  handleResolveZora,
} from './routes/identity-extensions';
import {
  handleInfraHealth,
  handleInfraServiceHealth,
  handleInfraStatus,
} from './routes/infra-health';
import { handleLandingCss, handleLandingHtml, handleLandingJs } from './routes/landing';
import {
  handleLeaderboardCommunities,
  handleLeaderboardCreators,
  handleLeaderboardTippers,
  handleLeaderboardTrending,
  handleRefreshLeaderboards,
} from './routes/leaderboard';
import {
  handleLemmyCommentCreate,
  handleLemmyCommunity,
  handleLemmyFeed,
  handleLemmyInstances,
  handleLemmyPostById,
  handleLemmyPostCreate,
  handleLemmyTrending,
} from './routes/lemmy';
import {
  handleLemmyBridgeCrossPost,
  handleLemmyBridgeShare,
  handleLemmyBridgeStatus,
} from './routes/lemmy-bridge';
import { handleLemmyDiscover } from './routes/lemmy-discover';
import {
  handleLemmyTipCreate,
  handleLemmyTipLeaderboard,
  handleLemmyTipStats,
} from './routes/lemmy-tip';
import { handleLensCoinDeploy, handleLensCoinGet, handleLensCoinTip } from './routes/lens-coin';
import { handleLinksPage } from './routes/links';
import {
  handleMastodonLeaderboard,
  handleMastodonTipCreate,
  handleMastodonTipStats,
} from './routes/mastodon-tip';
import {
  handleMatrixBridgeMessages,
  handleMatrixConnect,
  handleMatrixDisconnect,
  handleMatrixRoomsList,
  handleMatrixSendMessage,
} from './routes/matrix';
import {
  handleCreatorMediaDashboard,
  handleGetImage,
  handleGetImageMetadata,
  handleImageUpload,
  handleMakePermanent,
  handleMediaGateway,
  handleMediaHealth,
  handleMediaUpload,
} from './routes/media';
import {
  handleConversationMessages,
  handleConversations,
  handleDeleteMessage,
  handleInbox,
  handleMarkRead,
  handleSendMessage,
  handleThread,
  handleUnreadCount,
} from './routes/messages';
import {
  handleMirrorArticleByTxId,
  handleMirrorArticles,
  handleMirrorImport,
  handleMirrorPublish,
  handleMirrorSearch,
  handleMirrorTrending,
} from './routes/mirror';
import {
  handleBanUser,
  handleBlockSync,
  handleCheckBanned,
  handleListReports,
  handleModerationStats,
  handleRemovePost,
  handleResolveReport,
  handleSubmitReport,
} from './routes/moderation';
import {
  handleNewsAuthor,
  handleNewsCategory,
  handleNewsDeepDives,
  handleNewsDigestPreview,
  handleNewsDigestSubscribe,
  handleNewsFeed,
  handleNewsForYou,
  handleNewsHot,
  handleNewsletterCreatorCreate,
  handleNewsletterCreatorIssue,
  handleNewsletterCreatorIssues,
  handleNewsletterCreatorMine,
  handleNewsletterCreatorSubscribe,
  handleNewsMarkRead,
  handleNewsPreferences,
  handleNewsProtocol,
  handleNewsQuickReads,
  handleNewsSearch,
  handleNewsSources,
  handleNewsStory,
  handleNewsToken,
  handleNewsTrending,
  handleReadingList,
  handleReadingListToggle,
} from './routes/news';
import { handleNewsSourcesRoute } from './routes/news-sources';
import {
  handleNewsletterDigest,
  handleNewsletterStatus,
  handleNewsletterSubscribe,
} from './routes/newsletter';
import {
  handleNewsletterBridgeAutoPoll,
  handleNewsletterBridgeConnect,
  handleNewsletterBridgeDisconnect,
  handleNewsletterBridgeList,
  handleNewsletterBridgePoll,
  handleNewsletterBridgeStats,
} from './routes/newsletter-bridge';
import {
  handleCreatorNewsletterCount,
  handleCreatorNewsletterHealth,
  handleCreatorNewsletterSend,
  handleCreatorNewsletterStats,
  handleCreatorNewsletterSubscribe,
  handleCreatorNewsletterSubscribers,
  handleCreatorNewsletterUnsubscribe,
  handleMailgunWebhook,
} from './routes/newsletter-creator';
import {
  handleNewsletterCreateDraft,
  handleNewsletterSend,
  handleNewsletterSendTest,
  handleNewsletterSubscriberRemove,
  handleNewsletterSubscribersList,
} from './routes/newsletter-send';
import { handleMarkAllRead, handleNotifications } from './routes/notifications';
import { handleNotify } from './routes/notify';
import {
  handleDiscordAuthorize,
  handleDiscordCallback,
  handleGitHubAuthorize,
  handleGitHubCallback,
  handleGoogleAuthorize,
  handleGoogleCallback,
  handleRedditAuthorize,
  handleTelegramAuthorize,
  handleTelegramCallback,
  handleTwitterAuthorize,
  handleTwitterCallback,
} from './routes/oauth-providers';
import { handleOgFetch, handlePostOg } from './routes/og';
import {
  handleParagraphArticles,
  handleParagraphArticlesByFid,
  handleParagraphImport,
  handleParagraphNewsletterStats,
  handleParagraphPublish,
  handleParagraphSearch,
  handleParagraphSubscribe,
  handleParagraphTrending,
} from './routes/paragraph';
import peertubeRouter from './routes/peertube';
import peertubeStreams from './routes/peertube-streams';
import {
  handlePeerTubeLeaderboard,
  handlePeerTubeTipCreate,
  handlePeerTubeTipStats,
} from './routes/peertube-tip';
import {
  handlePermanenceAnchor,
  handlePermanenceStore,
  handlePermanenceVerify,
} from './routes/permanence';
import {
  handlePixelfedFeed,
  handlePixelfedHealth,
  handlePixelfedTag,
  handlePixelfedTrending,
} from './routes/pixelfed';
import podcastRouter from './routes/podcast';
import { handlePostById } from './routes/post';
import { handlePreferences } from './routes/preferences';
import { handleFeedPresets } from './routes/presets';
import { handlePrices } from './routes/prices';
import { handleIdentityProfile } from './routes/profile';
import { handleProtocolSections } from './routes/protocol-sections';
import { handleActivityPubFeed, handleThreadsFeed } from './routes/protocols';
import {
  handleJoinAll,
  handleProtocolRegister,
  handleProtocolStatus as handleProtocolSignupStatus,
} from './routes/protocol-signup';
import { handleVerifyHealth, handleVerifyPost } from './routes/protocol-verify';
import { handlePublish } from './routes/publish';
import { handlePushSend, handlePushSubscribe } from './routes/push';
import {
  handleDiscoverRecommendations,
  handlePersonalizedTrending,
  handleRecordInteraction,
  handleRelatedRecommendations,
  handleShortsRecommendations,
  handleStreamRecommendations,
  handleVideoRecommendations,
} from './routes/recommendations';
import registerAll from './routes/register-all';
import {
  handleBlueskyPoolStats,
  handleRegisterPlatform,
  handleRegisterPlatformStatus,
} from './routes/register-platform';
import { handleRelatedPosts } from './routes/related';
import { handlePostReplies } from './routes/replies';
import {
  handleRmiHeadlines,
  handleRmiHealth,
  handleRmiNews,
  handleRmiSentiment,
  handleRmiSources,
  handleRmiStats,
} from './routes/rmi';
import { handleRssFeed } from './routes/rss';
import { handleRssXml } from './routes/rss-xml';
import {
  handleDeleteScheduledPost,
  handleListScheduledPosts,
  handlePublishNow,
  handleSchedulePost,
  handleUpdateScheduledPost,
} from './routes/scheduled';
import {
  handleSearch,
  handleSearchAutocomplete,
  handleSearchCoins,
  handleSearchCommunities,
  handleSearchCreators,
  handleSearchIdentity,
  handleSearchIndex,
  handleSearchTrending,
} from './routes/search';
import {
  handleAlgorithmStatus,
  handleCreateShort,
  handleShortsByCategory,
  handleShortsBySource,
  handleShortsFeed,
  handleShortsFeedback,
  handleShortsFeedV2,
  handleShortsForYou,
  handleShortsShare,
  handleShortsTip,
  handleShortsTrending,
  handleShortsTrendingV2,
  handleShortsWatch,
  handleUnifiedFeed,
  handleUnifiedFeedBySource,
  handleUnifiedMint,
  handleUnifiedPublish,
  handleZoraCreator,
  handleZoraTrending,
} from './routes/shorts';
import {
  handleAddSource,
  handleListSources,
  handleRefreshSource,
  handleRemoveSource,
  handleSourceSuggestions,
} from './routes/shorts-sources';
import {
  handleSourcesApprove,
  handleSourcesDiscover,
  handleSourcesPending,
  handleSourcesReject,
} from './routes/source-discovery';
import {
  handleRecordEngagement,
  handleSourcesHealth,
  handleSourcesHealthCheck,
  handleSourcesNewThisWeek,
  handleSourcesStale,
  handleSourcesStats,
  handleSourcesTrending,
} from './routes/source-health';
import { handleStreamFeed } from './routes/stream';
import streams from './routes/streams';
import {
  handleSubscriptionCancel,
  handleSubscriptionConfirm,
  handleSubscriptionContentCheck,
  handleSubscriptionCreate,
  handleSubscriptionMy,
  handleSubscriptionStatus,
  handleSubscriptionSubscribe,
  handleSubscriptionTiers,
} from './routes/subscription';
import {
  handleSubscriptionNftActive,
  handleSubscriptionNftCancel,
  handleSubscriptionNftCheck,
  handleSubscriptionNftConfirm,
  handleSubscriptionNftCreate,
  handleSubscriptionNftSubscribe,
  handleSubscriptionNftSubscribers,
  handleSubscriptionNftTiers,
  handleSubscriptionNftUpdateTier,
} from './routes/subscription-nft';
import {
  handleTelegramAuth,
  handleTelegramBotInfo,
  handleTelegramChats,
  handleTelegramGenerateLink,
  handleTelegramGetGroups,
  handleTelegramGetLinked,
  handleTelegramGroupLink,
  handleTelegramLinkAccount,
  handleTelegramSend,
  handleTelegramUnlinkAccount,
  handleTelegramWebhook,
} from './routes/telegram';
import {
  handleLightningInvoice,
  handleTipCreate,
  handleTipFrame,
  handleTipFrameCallback,
  handleTipFrameTx,
  handleTipResolve,
  handleTipSettingsGet,
  handleTipSettingsPost,
} from './routes/tip';
import tokenCommunity from './routes/token-community';
import {
  handleTokenGateContent,
  handleTokenGateDelete,
  handleTokenGateGet,
  handleTokenGateResolve,
  handleTokenGateVerify,
  handleTokenGateVerifyMulti,
} from './routes/token-gate';
import { handleTokenSSE, handleTokenWebSocket } from './routes/token-websocket';
import totpRoutes from './routes/totp';
import {
  handleTradingCoinSignals,
  handleTradingCoinSummary,
  handleTradingSignalAction,
  handleTradingSignalCreate,
  handleTradingSignals,
  handleTradingTrending,
  handleTradingWhales,
} from './routes/trading-signals';
import { handleTranslate } from './routes/translate';
import {
  handleUnifiedRoomCreate,
  handleUnifiedRoomInfo,
  handleUnifiedRoomInvite,
  handleUnifiedRoomJoin,
  handleUnifiedRoomLeave,
  handleUnifiedRoomMessage,
  handleUnifiedRoomMessages,
  handleUnifiedRoomMine,
  handleUnifiedRoomTransport,
  handleUnifiedRoomUnread,
} from './routes/unified-room-routes';
import {
  handleTipAnalytics,
  handleTipBadges,
  handleTipLeaderboardCoins,
  handleTipLeaderboardProtocols,
  handleTopTippers,
  handleUnifiedTipActivity,
  handleUnifiedTipCreate,
  handleUnifiedTipLeaderboard,
  handleUnifiedTipStats,
} from './routes/unified-tip';
import videoHub from './routes/video-hub';
import { handleVisualFeed, handleVisualForYou, handleVisualTrending } from './routes/visual-feed';
import { handleWalletNonce, handleWalletVerify } from './routes/wallet';
import {
  handleWebAuthnAuthenticateBegin,
  handleWebAuthnAuthenticateComplete,
  handleWebAuthnDeleteCredential,
  handleWebAuthnListCredentials,
  handleWebAuthnRegisterBegin,
  handleWebAuthnRegisterComplete,
  handleWebAuthnRenameCredential,
} from './routes/webauthn';
import {
  handleWebhookCreate,
  handleWebhookDelete,
  handleWebhookList,
  handleWebhookTest,
  handleWebhookTrigger,
} from './routes/webhooks';
import { handleX402Paywall, handleX402Verify } from './routes/x402';
import youtubeRoutes from './routes/youtube';
import zoraCompatRoutes from './routes/zora-compat';
import zoraVideoRoutes from './routes/zora-video';

// ─── App ────────────────────────────────────────────────────

import { cspForPath } from './lib/csp';
import { validateJsonBody, validateRequest } from './lib/input-validator';

const app = new Hono<{ Bindings: Env }>();

// ─── Global onError handler ─────────────────────────────────
// Catches uncaught exceptions from any route handler so the API
// never returns an unhandled 500 without structured logging.
app.onError(async (err, c) => {
  const path = c.req.path;
  const method = c.req.method;
  const code = await logError(c.env, err, {
    route: path,
    method,
    statusCode: 500,
  });
  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      code,
    }),
    {
      status: 500,
      headers: { 'content-type': 'application/json' },
    },
  );
});

// ─── Constants ──────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'];
const CSRF_SKIP_PREFIXES = ['/api/auth/'];
const MAX_BODY_BYTES = 1_048_576;
const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

const STATIC_REDIRECTS: Record<string, string> = {
  '/docs': 'https://app.degenfeed.xyz/docs',
  '/about': 'https://app.degenfeed.xyz/about',
  '/faq': 'https://app.degenfeed.xyz/faq',
  '/legal': 'https://app.degenfeed.xyz/legal',
  '/privacy': 'https://app.degenfeed.xyz/privacy',
  '/terms': 'https://app.degenfeed.xyz/terms',
  '/acceptable-use': 'https://app.degenfeed.xyz/acceptable-use',
  '/community-guidelines': 'https://app.degenfeed.xyz/community-guidelines',
  '/premium': 'https://app.degenfeed.xyz/premium',
  '/newsletter': 'https://app.degenfeed.xyz/newsletter',
  '/status': 'https://app.degenfeed.xyz/status',
  '/discover': 'https://app.degenfeed.xyz/discover',
  '/feed': 'https://app.degenfeed.xyz/feed',
  '/news': 'https://app.degenfeed.xyz/news',
  '/home': 'https://app.degenfeed.xyz/home',
};

// ─── Session helper ─────────────────────────────────────────

async function withSession(
  // biome-ignore lint/suspicious/noExplicitAny: conditional type gate — actual shape matches Hono Context
  c: Parameters<typeof handlePublish>[0] extends Request ? any : never,
  handler: () => Promise<Response>,
): Promise<Response> {
  const { requireSession, applySessionRefresh } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const resp = await handler();
  if (c.env.AUTH_SECRET) return applySessionRefresh(resp, session, c.env.AUTH_SECRET);
  return resp;
}

// ─── Middleware: Request ID correlation ─────────────────────
// Every request gets a unique x-request-id header for log correlation.
// Added before CORS so it's always present.
app.use('*', async (c, next) => {
  const reqId = crypto.randomUUID().slice(0, 8);
  (c as unknown as { set: (k: string, v: string) => void }).set('requestId', reqId);
  await next();
  if (c.res) {
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: { ...Object.fromEntries(c.res.headers), 'x-request-id': reqId },
    });
  }
});
// ─── Middleware: Security headers ────────────────────────────
// Sets security headers on EVERY response:
//   - Content-Security-Policy (route-aware)
//   - Strict-Transport-Security (HSTS)
//   - X-Content-Type-Options (nosniff)
//   - X-Frame-Options (DENY, SAMEORIGIN for embed)
//   - Referrer-Policy
//   - Cross-Origin-Resource-Policy
//   - Cache-Control for sensitive endpoints
app.use('*', async (c, next) => {
  await next();
  if (!c.res) return;

  const path = c.req.path;
  const headers = new Headers(c.res.headers);

  // Content-Security-Policy — route-aware
  const csp = cspForPath(path);
  if (csp && !headers.has('content-security-policy')) {
    headers.set('content-security-policy', csp);
  }

  // Strict-Transport-Security (HSTS) — 2 year max-age
  if (!headers.has('strict-transport-security')) {
    headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  }

  // X-Content-Type-Options — prevent MIME sniffing
  if (!headers.has('x-content-type-options')) {
    headers.set('x-content-type-options', 'nosniff');
  }

  // X-Frame-Options — DENY by default, SAMEORIGIN for embed routes
  if (!headers.has('x-frame-options')) {
    if (path.startsWith('/api/embed/')) {
      headers.set('x-frame-options', 'SAMEORIGIN');
    } else {
      headers.set('x-frame-options', 'DENY');
    }
  }

  // Referrer-Policy
  if (!headers.has('referrer-policy')) {
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  }

  // Cross-Origin-Resource-Policy
  if (!headers.has('cross-origin-resource-policy')) {
    if (path.startsWith('/api/admin/')) {
      headers.set('cross-origin-resource-policy', 'same-origin');
    } else {
      headers.set('cross-origin-resource-policy', 'cross-origin');
    }
  }

  // Cache-Control for sensitive endpoints (auth, wallet, sessions)
  if (
    path.includes('/auth/') ||
    path.includes('/wallet/') ||
    path.includes('/session') ||
    path.includes('/api-key') ||
    path.startsWith('/api/admin/')
  ) {
    if (!headers.has('cache-control')) {
      headers.set('cache-control', 'no-store, must-revalidate');
    }
  }

  // Remove Server header (information disclosure)
  if (headers.has('server')) {
    headers.delete('server');
  }

  c.res = new Response(c.res.body, {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  });
});

// ─── Middleware: CORS post-response ──────────────────────────
// Registered first so it wraps every response with CORS headers.
app.use('*', async (c, next) => {
  await next();
  const origin = getAllowedOrigin(c.req.raw, c.env.ALLOWED_ORIGINS);
  if (c.res) c.res = applyCors(c.res, origin);
});

// ─── Middleware: OPTIONS preflight ───────────────────────────
// Short-circuits before body size, CSRF, rate limit, and route handlers.
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  await next();
});

// ─── Middleware: Input validation ────────────────────────────
// Runs BEFORE body parsing and CSRF checks.
// Validates query params, headers, content-type, and body size.
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();

  const validation = validateRequest(c.req.raw, {});
  if (!validation.valid) {
    return new Response(
      JSON.stringify({
        error: validation.error,
        code: validation.code || 'DF-400',
      }),
      {
        status: validation.code === 'DF-413' ? 413 : validation.code === 'DF-415' ? 415 : 400,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  return next();
});

// ─── Middleware: body size + CSRF for state-changing requests ──
// Protects POST/PUT/PATCH/DELETE against cross-site request forgery via:
//   1. Origin / Referer header validation (same‑site check)
//   2. X‑CSRF‑Token header validation against a per‑session token stored in KV
// Skips GET/HEAD/OPTIONS (safe methods), /api/auth/* (auth flows use their
// own nonce‑based CSRF), and requests with Authorization: Bearer (API clients
// are already independently authenticated).
app.use('*', async (c, next) => {
  const method = c.req.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }
  const path = c.req.path;

  // Skip body size and CSRF for /api/auth/* — these use OAuth state nonces
  // which provide their own CSRF protection.
  const isAuthPath = CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isAuthPath) {
    // Still enforce body size limits for auth endpoints
    const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
    if (!sizeCheck.ok) {
      return jsonResponse({ error: sizeCheck.error }, 413);
    }
    return next();
  }

  // Skip CSRF for API clients using Bearer tokens — already authenticated
  // via API key middleware (separate scoped keys, not session cookies).
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
    if (!sizeCheck.ok) {
      return jsonResponse({ error: sizeCheck.error }, 413);
    }
    return next();
  }

  const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
  if (!sizeCheck.ok) {
    return jsonResponse({ error: sizeCheck.error }, 413);
  }

  // ── Origin / Referer validation ──────────────────────────────
  const isWebhookExempt = CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
  if (!isWebhookExempt) {
    const origin = c.req.header('origin');
    if (origin) {
      if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
        return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
      }
    } else {
      const referer = c.req.header('referer');
      if (referer) {
        const refererOrigin = parseOriginHeader(referer);
        if (!refererOrigin || !isAllowedOrigin(refererOrigin, c.env.ALLOWED_ORIGINS)) {
          return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
        }
      } else {
        return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
      }
    }
  }

  // ── X-CSRF-Token validation ──────────────────────────────────
  // Only applies to cookie‑authenticated sessions (not Bearer API keys).
  const cookieValue = parseSessionCookie(c.req.header('cookie') ?? null);
  if (cookieValue) {
    const csrfToken = c.req.header('x-csrf-token');
    const valid = await validateCsrfToken(cookieValue, csrfToken ?? null, c.env);
    if (!valid) {
      return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
    }
  }

  await next();
});

// ─── Middleware: API key authentication (v1 routes) ──────────
app.use('/v1/*', apiKeyMiddleware);

// ─── Middleware: rate limiting (tiered) ──────────────────────
// Uses context-aware rate limits:
//   - Brute force: wallet verify → 5/min → 1/min after 3 failures
//   - Enumeration: email/username checks → 3/min with exponential backoff
//   - Scraping: feed endpoints → 30/min anonymous, 120/min authenticated
//   - Admin: 10/min
//   - Global: 1000 req/min per IP DDoS protection
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

  // Detect if the request is authenticated (has a session or API key)
  const authHeader = c.req.header('authorization');
  const cookieHeader = c.req.header('cookie');
  const isAuthenticated = !!(
    authHeader?.startsWith('Bearer ') || cookieHeader?.includes('session=')
  );

  const rl = await tieredRateLimit(c.env, ip, c.req.path, isAuthenticated);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
      },
    });
  }
  await next();
});

// ─── Middleware: Deprecation headers for legacy /api/ routes ──
// Legacy /api/* routes get deprecation headers encouraging migration to /v1/
app.use('/api/*', async (c, next) => {
  await next();
  if (c.res) {
    const headers = new Headers(c.res.headers);
    if (!headers.has('Deprecation')) {
      headers.set('Deprecation', 'true');
      headers.set('Sunset', 'Sat, 01 Nov 2026 00:00:00 GMT');
      headers.set('Link', '</v1/>; rel="successor-version"');
      c.res = new Response(c.res.body, {
        status: c.res.status,
        statusText: c.res.statusText,
        headers,
      });
    }
  }
});

// ─── Middleware: Admin wallet guard ─────────────────────────
// Protects all /api/admin/* routes — requires a valid session
// with a wallet in the ADMIN_WALLETS env var.
app.use('/api/admin/*', async (c, next) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return next();
});

// ─── Landing pages / static assets ─────────────────────────

app.all('/styles.css', (c) => handleLandingCss(c.req.raw, c.env));
app.all('/links', (c) => handleLinksPage(c.req.raw, c.env));
app.all('/app.js', (c) => handleLandingJs(c.req.raw, c.env));
app.all(
  '/favicon.svg',
  (_c) =>
    new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#000"/><path d="M8 8h16l-6 16H12L8 8Z" fill="#00ff41" stroke="#00ff41" stroke-width=".5"/><text x="16" y="21" text-anchor="middle" fill="#000" font-family="ui-monospace,monospace" font-size="10" font-weight="900">DF</text></svg>',
      {
        status: 200,
        headers: {
          'content-type': 'image/svg+xml',
          'cache-control': 'public, max-age=604800',
        },
      },
    ),
);
app.all('/', (c) => handleLandingHtml(c.req.raw, c.env));
app.all('/index.html', (c) => handleLandingHtml(c.req.raw, c.env));

// ─── API: Infrastructure Health (self-hosted services) ─────
app.get('/api/infra/health', async (c) => handleInfraHealth(c.env));
app.get('/api/infra/health/:service', async (c) =>
  handleInfraServiceHealth(c.env, c.req.param('service')),
);
app.get('/api/infra/status', async (c) => handleInfraStatus(c.env));

// ─── API: Bridge Health ────────────────────────────────────
app.get('/api/bridge/health', async (c) => handleBridgeHealth(c.req.raw, c.env));
app.get('/api/bridge/health/:protocol', async (c) => handleProtocolHealth(c.req.raw, c.env));
app.post('/api/bridge/circuit/reset', async (c) => handleCircuitReset(c.req.raw, c.env));
app.get('/api/bridge/stats', async (c) => handleBridgeStats(c.req.raw, c.env));
app.get('/api/bridge/stats/:protocol', async (c) => handleProtocolStats(c.req.raw, c.env));

// ─── API: Protocol Status Dashboard ─────────────────────────
app.get('/api/protocols/status', async (c) => handleProtocolsStatus(c.req.raw, c.env));
app.get('/api/protocols/status/:name', async (c) => handleProtocolOverallStatus(c.req.raw, c.env));

// ─── API: Protocol Account Creation (Self-Hosted Instances) ──────
app.post('/api/protocol/:protocol/register', async (c) => handleProtocolRegister(c.req.raw, c.env));
app.get('/api/protocol/status', async (c) => handleProtocolSignupStatus(c.req.raw, c.env));
app.post('/api/protocol/join-all', async (c) => handleJoinAll(c.req.raw, c.env));

// ─── API: Protocol Content Visibility Verification ───────────
app.post('/api/protocol/verify/post', async (c) => handleVerifyPost(c.req.raw, c.env));
app.get('/api/protocol/verify/health', async (c) => handleVerifyHealth(c.req.raw, c.env));

// ─── API: Health ────────────────────────────────────────────
app.all('/api/health', async (c) => {
  // Base relay health
  const relayResp = await handleRelaysHealth(c.env);
  const relayBody = await relayResp.json();

  // Append error counts if available
  const { getErrorCounts } = await import('./error-logger');
  const errorCounts = await getErrorCounts(c.env);

  return jsonResponse({
    status: 'ok',
    service: 'degenfeed-api',
    relays: (relayBody as Record<string, unknown>).relays,
    healthy: (relayBody as Record<string, unknown>).healthy,
    errors: errorCounts
      ? {
          total: errorCounts.total,
          byRoute: errorCounts.byRoute,
          since: errorCounts.since,
        }
      : null,
    checkedAt: Date.now(),
  });
});
app.get('/api/health/protocols', async (c) => handleProtocolsHealth(c.env));
app.get('/api/health/full', async (c) => handleFullHealth(c.env));

// ─── API: Analytics ─────────────────────────────────────────
app.get('/api/analytics', (c) => handleAnalytics(c.req.raw, c.env));

// ─── API: Shorts ─────────────────────────────────────────
app.get('/api/shorts/feed', async (c) => handleShortsFeed(c.req.raw, c.env));
app.get('/api/shorts/trending', async (c) => handleShortsTrending(c.req.raw, c.env));
app.get('/api/shorts/for-you', async (c) => handleShortsForYou(c.req.raw, c.env));
app.get('/api/shorts/source/:source', async (c) => handleShortsBySource(c.req.raw, c.env));
app.post('/api/shorts/create', async (c) => handleCreateShort(c.req.raw, c.env));

// ── Unified multi-protocol publish & mint ─────────
app.post('/api/shorts/publish', async (c) => handleUnifiedPublish(c.req.raw, c.env));
app.post('/api/shorts/mint', async (c) => handleUnifiedMint(c.req.raw, c.env));

// ── Unified multi-protocol feed ──────────────────
app.get('/api/shorts/unified/feed', async (c) => handleUnifiedFeed(c.req.raw, c.env));
app.get('/api/shorts/unified/:source', async (c) => handleUnifiedFeedBySource(c.req.raw, c.env));

// ── Cross-platform actions on shorts ─────────────
app.post('/api/shorts/:id/tip', async (c) => handleShortsTip(c.req.raw, c.env));
app.post('/api/shorts/:id/share', async (c) => handleShortsShare(c.req.raw, c.env));

// ── V2 enhanced feed (ShortsAggregatorV2 + ShortsAlgorithm) ──
app.get('/api/shorts/v2/feed', async (c) => handleShortsFeedV2(c.req.raw, c.env));
app.get('/api/shorts/v2/trending', async (c) => handleShortsTrendingV2(c.req.raw, c.env));
app.get('/api/shorts/category/:cat', async (c) => handleShortsByCategory(c.req.raw, c.env));
app.post('/api/shorts/watch', async (c) => handleShortsWatch(c.req.raw, c.env));
app.post('/api/shorts/feedback', async (c) => handleShortsFeedback(c.req.raw, c.env));
app.get('/api/shorts/algorithm/status', async (c) => handleAlgorithmStatus(c.req.raw, c.env));

// ── Shorts source management ─────────────────────
app.get('/api/shorts/sources', async (c) => handleListSources(c.req.raw, c.env));
app.post('/api/shorts/sources', async (c) => handleAddSource(c.req.raw, c.env));
app.delete('/api/shorts/sources/:id', async (c) => handleRemoveSource(c.req.raw, c.env));
app.post('/api/shorts/sources/:id/refresh', async (c) => handleRefreshSource(c.req.raw, c.env));
app.get('/api/shorts/sources/suggestions', async (c) => handleSourceSuggestions(c.req.raw, c.env));

// ── Zora video NFT endpoints ─────────────────────
app.get('/api/shorts/zora/trending', async (c) => handleZoraTrending(c.req.raw, c.env));
app.get('/api/shorts/zora/creator', async (c) => handleZoraCreator(c.req.raw, c.env));

// ─── API: YouTube ────────────────────────────────────────
app.route('/api/youtube', youtubeRoutes);

// ─── API: Feed (specific routes before parameterized) ──────
app.all('/api/feed/home', async (c) => handleHomeFeed(c.req.raw, c.env, c.executionCtx));
app.get('/api/feed/protocol-sections', async (c) => handleProtocolSections(c.req.raw, c.env));
app.all('/api/feed/for-you', async (c) => handleForYouFeed(c.req.raw, c.env, c.executionCtx));
app.post('/api/feed/dwell', async (c) => handleRecordDwell(c.req.raw, c.env));
app.post('/api/feed/feedback', async (c) => handleFeedback(c.req.raw, c.env));
app.all('/api/feed/trending', async (c) => handleTrendingFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/health', async (c) => handleFeedHealth(c.req.raw, c.env));
app.all('/api/feed/pixelfed', async (c) => handlePixelfedFeed(c.req.raw, c.env));
app.all('/api/pixelfed/trending', async (c) => handlePixelfedTrending(c.req.raw, c.env));
app.all('/api/pixelfed/tags/:tag', async (c) =>
  handlePixelfedTag(c.req.raw, c.env, c.req.param('tag')),
);
app.all('/api/pixelfed/health', async (c) => handlePixelfedHealth(c.req.raw, c.env));
app.all('/api/feed/rss.xml', async (c) => handleRssXml(c.req.raw, c.env));
app.all('/api/feed/atom.xml', async (c) => handleRssXml(c.req.raw, c.env));
app.all('/api/feed/news', async (c) => handleNewsFeed(c.req.raw, c.env));
app.all('/api/feed/reddit', async (c) => handleRedditFeed(c.req.raw, c.env));
app.all('/api/feed/activitypub', async (c) => handleActivityPubFeed(c.req.raw, c.env));
app.all('/api/feed/threads', async (c) => handleThreadsFeed(c.req.raw, c.env));
app.all('/api/feed/farcaster', async (c) => handleFarcasterFeed(c.req.raw, c.env));
app.all('/api/feed/rss', async (c) => handleRssFeed(c.req.raw, c.env));
app.all('/api/feed/post/:postId/replies', async (c) =>
  handlePostReplies(c.req.raw, c.env, c.req.param('postId')),
);
app.get('/api/og', async (c) => handleOgFetch(c.req.raw));
app.all('/api/feed/post/:postId', async (c) => {
  const postId = c.req.param('postId');
  if (c.req.query('format') === 'og') return handlePostOg(c.req.raw, c.env, postId);
  return handlePostById(c.req.raw, c.env, postId);
});
app.all('/api/feed/funding', async (c) => handleFundingFeed(c.req.raw, c.env));
app.all('/api/feed/top', async (c) => handleTopFeed(c.req.raw, c.env));
app.all('/api/feed/alt', async (c) => handleAltFeed(c.req.raw, c.env));
app.all('/api/feed/communities', async (c) => handleCommunities(c.req.raw, c.env));
app.all('/api/feed/newsletters', async (c) => handleNewsletterFeed(c.req.raw, c.env));
app.all('/api/feed/related', async (c) => handleRelatedPosts(c.req.raw, c.env));
app.all('/api/feed/presets', async (c) => handleFeedPresets(c.req.raw, c.env));
app.all('/api/feed/stream', async (c) => handleStreamFeed(c.req.raw, c.env));

app.all('/api/feed/curated', async (c) => handleCuratedFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/scroll-depth', async (c) => handleScrollDepth(c.req.raw, c.env));
app.all('/api/feed/seen', async (c) => handleMarkSeen(c.req.raw, c.env));
app.all('/api/feed/engagement-feedback', async (c) => handleEngagementFeedback(c.req.raw, c.env));
app.all('/api/feed/category/:category', async (c) =>
  handleCategorySlugFeed(c.req.raw, c.env, c.req.param('category'), c.executionCtx),
);
app.all('/api/feed/mix', async (c) => handleCategoryMixFeed(c.req.raw, c.env, c.executionCtx));
app.all('/api/feed/everything', async (c) =>
  handleEverythingFeed(c.req.raw, c.env, c.executionCtx),
);
app.all('/api/feed/per-protocol/:protocol/:category', async (c) =>
  handlePerProtocolCategoryFeed(
    c.req.raw,
    c.env,
    c.req.param('protocol'),
    c.req.param('category'),
    c.executionCtx,
  ),
);
// Unified blended feed — interleaves all sources (content pipeline)
app.all('/api/feed/unified', async (c) => handleContentPipelineFeed(c.req.raw, c.env));
app.get('/api/feed/unified/trending', async (c) => handleTrendingContent(c.req.raw, c.env));
app.get('/api/feed/unified/for-you', async (c) => handleUnifiedForYouFeed(c.req.raw, c.env));
app.get('/api/feed/unified/category/:id', async (c) =>
  handleCategoryFeed(c.req.raw, c.env, c.req.param('id')),
);
app.get('/api/feed/unified/search', async (c) => handleUnifiedSearch(c.req.raw, c.env));
app.get('/api/feed/unified/sources', async (c) => handleSourceDiscovery(c.req.raw, c.env));
app.post('/api/feed/unified/default', async (c) => handleDefaultFeed(c.req.raw, c.env));
app.get('/api/feed/unified/network/:network', async (c) =>
  handleNetworkFeed(c.req.raw, c.env, c.req.param('network')),
);
// Visual feed — masonry-grid media feed from Pixelfed, Zora, Bluesky, etc.
app.all('/api/feed/visual', async (c) => handleVisualFeed(c.req.raw, c.env));
app.all('/api/feed/visual/trending', async (c) => handleVisualTrending(c.req.raw, c.env));
app.all('/api/feed/visual/for-you', async (c) => handleVisualForYou(c.req.raw, c.env));
// ── Protocol-specific feeds — must be before provider catch-all ──
app.get('/api/feed/protocols', async (c) => handleProtocolsList(c.req.raw, c.env));
app.get('/api/feed/protocol/:protocol', async (c) =>
  handleProtocolFeed(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
);
app.get('/api/feed/protocol/:protocol/popular', async (c) =>
  handleProtocolPopular(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
);
app.get('/api/feed/protocol/:protocol/trending', async (c) =>
  handleProtocolTrendingRoute(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
);
app.get('/api/feed/protocol/:protocol/newest', async (c) =>
  handleProtocolNewest(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
);
app.get('/api/feed/protocol/:protocol/videos', async (c) =>
  handleProtocolVideos(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
);

// Feed provider catch-all — must be last /api/feed/* route
app.all('/api/feed/:provider', async (c) =>
  handleProviderFeed(c.req.raw, c.env, c.req.param('provider')),
);

// ─── API: Cross-platform Dedup ─────────────────────────────────---
app.post('/api/dedup/check', async (c) => handleDedupCheck(c.req.raw, c.env));
app.post('/api/dedup/register', async (c) => handleDedupRegister(c.req.raw, c.env));
app.get('/api/dedup/cluster/:id', async (c) =>
  handleDedupCluster(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/dedup/mark-seen', async (c) => handleDedupMarkSeen(c.req.raw, c.env));
app.post('/api/dedup/mark-seen-batch', async (c) => handleDedupMarkSeenBatch(c.req.raw, c.env));
app.get('/api/dedup/seen/stats', async (c) => handleDedupSeenStats(c.req.raw, c.env));
app.post('/api/dedup/has-seen', async (c) => handleDedupHasSeen(c.req.raw, c.env));
app.post('/api/dedup/seen/feedback', async (c) => handleDedupSeenFeedback(c.req.raw, c.env));

// ─── API: Bridge ────────────────────────────────────────────
app.all('/api/bridge/rss-to-nostr', async (c) => {
  const { handleRssToNostrBridge } = await import('./routes/publish');
  return withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
});
// Public read-only bridge status (per-protocol reply counts) — no session needed
app.get('/api/cross-reply/status', async (c) => {
  const { handleCrossReplyStatus } = await import('./routes/cross-reply');
  return handleCrossReplyStatus(c.req.raw, c.env);
});
app.all('/api/cross-reply', async (c) => withSession(c, () => handleCrossReply(c.req.raw, c.env)));

// Unified cross-protocol thread view — public read-only
app.get('/api/thread/:dfUri', async (c) => {
  const { handleUnifiedThread } = await import('./routes/thread');
  return handleUnifiedThread(c.req.raw, c.env, c.req.param('dfUri'));
});

// ─── API: Cross-Protocol Stream Chat Bridge ──────────────────
// Start/stop bridging comments from external protocols into stream chat
app.post('/api/cross-protocol-bridge/stream/start', async (c) => {
  const { startBridge } = await import('./lib/cross-protocol-chat-bridge');
  const { stopBridge } = await import('./lib/cross-protocol-chat-bridge');
  try {
    const body = (await c.req.json()) as {
      streamId: string;
      announcementResults?: Record<
        string,
        { ok: boolean; id?: string; url?: string; error?: string }
      >;
    };
    if (!body.streamId) {
      return jsonResponse({ error: 'streamId required' }, 400);
    }
    startBridge(
      c.env,
      body.streamId,
      (body.announcementResults ?? {}) as Record<
        string,
        {
          ok: boolean;
          protocol: string;
          id?: string;
          url?: string;
          error?: string;
        }
      >,
    );
    return jsonResponse({ ok: true, streamId: body.streamId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to start bridge: ${msg}` }, 500);
  }
});
app.post('/api/cross-protocol-bridge/stream/stop', async (c) => {
  const { stopBridge } = await import('./lib/cross-protocol-chat-bridge');
  try {
    const body = (await c.req.json()) as { streamId: string };
    if (!body.streamId) {
      return jsonResponse({ error: 'streamId required' }, 400);
    }
    stopBridge(c.env, body.streamId);
    return jsonResponse({ ok: true, streamId: body.streamId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to stop bridge: ${msg}` }, 500);
  }
});

// ─── API: Cross-Protocol Bridge ──────────────────────────────
// Content wrapping, Zora bridge, edit sync, and bridge status
app.all('/api/cross-protocol-bridge/wrap', async (c) => {
  const { handleWrapContent } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleWrapContent(c.req.raw, c.env));
});
app.all('/api/cross-protocol-bridge/zora', async (c) => {
  const { handleZoraBridge } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleZoraBridge(c.req.raw, c.env));
});
app.all('/api/cross-protocol-bridge/sync', async (c) => {
  const { handleSyncEdit } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleSyncEdit(c.req.raw, c.env));
});
app.get('/api/cross-protocol-bridge/status', async (c) => {
  const { handleBridgeStatus } = await import('./routes/cross-protocol-bridge');
  return handleBridgeStatus(c.req.raw, c.env);
});

// ─── API: Auth ──────────────────────────────────────────────
app.all('/api/auth/signout', async (c) => {
  const { handleSessionSignOut } = await import('./session');
  return handleSessionSignOut(c.req.raw, c.env);
});
app.all('/api/auth/gotosocial/authorize', async (c) => handleGtSAuthorize(c.req.raw, c.env));
app.all('/api/auth/gotosocial/callback', async (c) => handleGtSCallback(c.req.raw, c.env));
app.all('/api/auth/gotosocial/register', async (c) => handleGtSRegister(c.req.raw, c.env));
app.all('/api/auth/threads/authorize', async (c) => handleThreadsAuthorize(c.req.raw, c.env));
app.all('/api/auth/threads/callback', async (c) => handleThreadsCallback(c.req.raw, c.env));
app.all('/api/auth/warpcast/authorize', async (c) => handleWarpcastAuthorize(c.req.raw, c.env));
app.all('/api/auth/warpcast/callback', async (c) => handleWarpcastCallback(c.req.raw, c.env));
app.all('/api/auth/reddit/authorize', async (c) => handleRedditAuthorize(c.req.raw, c.env));
app.all('/api/auth/reddit/callback', async (c) => handleRedditCallback(c.req.raw, c.env));
app.all('/api/auth/google/authorize', async (c) => handleGoogleAuthorize(c.req.raw, c.env));
app.all('/api/auth/google/callback', async (c) => handleGoogleCallback(c.req.raw, c.env));
app.all('/api/auth/github/authorize', async (c) => handleGitHubAuthorize(c.req.raw, c.env));
app.all('/api/auth/github/callback', async (c) => handleGitHubCallback(c.req.raw, c.env));
app.all('/api/auth/discord/authorize', async (c) => handleDiscordAuthorize(c.req.raw, c.env));
app.all('/api/auth/discord/callback', async (c) => handleDiscordCallback(c.req.raw, c.env));
app.all('/api/auth/twitter/authorize', async (c) => handleTwitterAuthorize(c.req.raw, c.env));
app.all('/api/auth/twitter/callback', async (c) => handleTwitterCallback(c.req.raw, c.env));
app.all('/api/auth/telegram/authorize', async (c) => handleTelegramAuthorize(c.req.raw, c.env));
app.all('/api/auth/telegram/callback', async (c) => handleTelegramCallback(c.req.raw, c.env));
app.all('/api/auth/session', async (c) => {
  const { handleSessionVerify } = await import('./session');
  return handleSessionVerify(c.req.raw, c.env);
});
app.all('/api/auth/session/revoke', async (c) => {
  const { handleSessionRevoke } = await import('./session');
  return handleSessionRevoke(c.req.raw, c.env);
});

// ─── API: Session Management (list, revoke specific, revoke all) ──
app.get('/api/auth/sessions', async (c) => {
  const { handleListSessions } = await import('./routes/sessions');
  return handleListSessions(c.req.raw, c.env);
});
app.delete('/api/auth/sessions', async (c) => {
  const { handleRevokeAllSessions } = await import('./routes/sessions');
  return handleRevokeAllSessions(c.req.raw, c.env);
});
app.delete('/api/auth/sessions/:nonce', async (c) => {
  const { handleRevokeSession } = await import('./routes/sessions');
  return handleRevokeSession(c.req.raw, c.env, c.req.param('nonce'));
});
app.all('/api/auth/wallet/nonce', async (c) => handleWalletNonce(c.req.raw, c.env));
app.all('/api/auth/wallet/verify', async (c) => handleWalletVerify(c.req.raw, c.env));

// ─── API: Hardware Wallet 2FA ──────────────────────────────────
app.get('/api/auth/hw-wallet/status', async (c) => handleHwWalletStatus(c.req.raw, c.env));
app.post('/api/auth/hw-wallet/challenge', async (c) => handleHwWalletChallenge(c.req.raw, c.env));
app.post('/api/auth/hw-wallet/verify', async (c) => handleHwWalletVerify(c.req.raw, c.env));
app.post('/api/auth/hw-wallet/toggle', async (c) => handleHwWalletToggle(c.req.raw, c.env));
app.post('/api/auth/hw-wallet/verify-on-login', async (c) =>
  handleHwWalletVerifyOnLogin(c.req.raw, c.env),
);

// ─── API: WebAuthn / Passkeys 2FA ──────────────────────────────
app.post('/api/auth/webauthn/register/begin', async (c) =>
  handleWebAuthnRegisterBegin(c.req.raw, c.env),
);
app.post('/api/auth/webauthn/register/complete', async (c) =>
  handleWebAuthnRegisterComplete(c.req.raw, c.env),
);
app.post('/api/auth/webauthn/authenticate/begin', async (c) =>
  handleWebAuthnAuthenticateBegin(c.req.raw, c.env),
);
app.post('/api/auth/webauthn/authenticate/complete', async (c) =>
  handleWebAuthnAuthenticateComplete(c.req.raw, c.env),
);
app.get('/api/auth/webauthn/credentials', async (c) =>
  handleWebAuthnListCredentials(c.req.raw, c.env),
);
app.delete('/api/auth/webauthn/credentials/:id', async (c) =>
  handleWebAuthnDeleteCredential(c.req.raw, c.env, c.req.param('id')),
);
app.patch('/api/auth/webauthn/credentials/:id', async (c) =>
  handleWebAuthnRenameCredential(c.req.raw, c.env, c.req.param('id')),
);

// ─── API: TOTP 2FA (RFC 6238 — Google Authenticator, Authy) ──
app.route('/api/auth/totp', totpRoutes);

// ─── API: Email Auth ───────────────────────────────────
app.all('/api/auth/email/register', async (c) => handleEmailRegister(c.req.raw, c.env));
app.all('/api/auth/email/signin', async (c) => handleEmailSignIn(c.req.raw, c.env));
app.all('/api/auth/email/verify', async (c) => handleEmailVerify(c.req.raw, c.env));
app.all('/api/auth/email/status', async (c) => handleEmailStatus(c.req.raw, c.env));
app.all('/api/auth/email/password-reset', async (c) =>
  handlePasswordResetRequest(c.req.raw, c.env),
);
app.all('/api/auth/email/password-reset/confirm', async (c) =>
  handlePasswordResetConfirm(c.req.raw, c.env),
);

// ─── API: Custom Feeds (session-gated) ──────────────────────
// Static routes before parameterized routes

app.post('/api/custom-feeds', async (c) =>
  withSession(c, () => handleCustomFeedCreate(c.req.raw, c.env)),
);
app.get('/api/custom-feeds', async (c) => handleCustomFeedList(c.req.raw, c.env));
app.get('/api/custom-feeds/public', async (c) => handleCustomFeedPublic(c.req.raw, c.env));
app.post('/api/custom-feeds/:id/subscribe', async (c) =>
  withSession(c, () => handleCustomFeedSubscribe(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/custom-feeds/:id/execute', async (c) =>
  handleCustomFeedExecute(c.req.raw, c.env, c.req.param('id')),
);
app.get('/api/custom-feeds/:id', async (c) =>
  handleCustomFeedGet(c.req.raw, c.env, c.req.param('id')),
);
app.put('/api/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedUpdate(c.req.raw, c.env, c.req.param('id'))),
);
app.delete('/api/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedDelete(c.req.raw, c.env, c.req.param('id'))),
);

import {
  handleBookmarkAdd,
  handleBookmarkCheck,
  handleBookmarkList,
  handleBookmarkRemove,
} from './routes/bookmarks';
// ─── API: Bookmarks (session-gated) ─────────────────────────
// ─── API: Bridge Health ──────────────────────────────────────────
import {
  handleBridgeHealth,
  handleBridgeStats,
  handleCircuitReset,
  handleProtocolHealth,
  handleProtocolStats,
} from './routes/bridge-health';
import {
  handleFollowAdd,
  handleFollowCheck,
  handleFollowingFeed,
  handleFollowList,
  handleFollowRemove,
} from './routes/follow';
import {
  handleProtocolStatus as handleProtocolOverallStatus,
  handleProtocolsStatus,
} from './routes/protocol-status';

app.get('/api/bookmarks', async (c) => handleBookmarkList(c.req.raw, c.env));
app.post('/api/bookmarks', async (c) => withSession(c, () => handleBookmarkAdd(c.req.raw, c.env)));
app.delete('/api/bookmarks', async (c) =>
  withSession(c, () => handleBookmarkRemove(c.req.raw, c.env)),
);
app.get('/api/bookmarks/check', async (c) => handleBookmarkCheck(c.req.raw, c.env));

// ─── API: Follow (protocol-native follow/unfollow) ─────────
app.post('/api/follow', async (c) => withSession(c, () => handleFollowAdd(c.req.raw, c.env)));
app.delete('/api/follow', async (c) => withSession(c, () => handleFollowRemove(c.req.raw, c.env)));
app.get('/api/follow/list', async (c) => handleFollowList(c.req.raw, c.env));
app.get('/api/follow/check', async (c) => handleFollowCheck(c.req.raw, c.env));
app.get('/api/follow/feed', async (c) => handleFollowingFeed(c.req.raw, c.env));

// ─── API: Security Log ───────────────────────────────────────
app.get('/api/auth/security-log', async (c) => {
  const { handleSecurityLog } = await import('./routes/sessions');
  return handleSecurityLog(c.req.raw, c.env);
});

// ─── API: Account ────────────────────────────────────────────
app.all('/api/account/export', async (c) => handleAccountExport(c.req.raw, c.env));
app.all('/api/account/delete', async (c) => handleAccountDelete(c.req.raw, c.env));
app.post('/api/account/delete/cancel', async (c) => handleCancelAccountDelete(c.req.raw, c.env));

// ─── API: Account Sovereignty (deplatform-proof verification) ──
app.get('/api/account/sovereignty', async (c) => {
  const { requireSession } = await import('./session');
  const { verifyUserOwnership } = await import('./lib/account-sovereignty');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const report = await verifyUserOwnership(session, c.env);
  return jsonResponse(report);
});
app.get('/api/account/sovereignty/export', async (c) => {
  const { requireSession } = await import('./session');
  const { generateExportManifest } = await import('./lib/account-sovereignty');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const manifest = await generateExportManifest(session, c.env);
  return jsonResponse(manifest);
});
app.get('/api/account/sovereignty/migration-guide', async (_c) => {
  const { getMigrationInstructions } = await import('./lib/account-sovereignty');
  return new Response(getMigrationInstructions(), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
});

// ─── API: Data Export (multi-format) ─────────────────────
app.get('/api/account/export/manifest', async (c) => handleExportManifest(c.req.raw, c.env));
app.get('/api/account/export/json', async (c) => handleExportJson(c.req.raw, c.env));
app.get('/api/account/export/csv', async (c) => handleExportCsv(c.req.raw, c.env));
app.get('/api/account/export/html', async (c) => handleExportHtml(c.req.raw, c.env));
app.get('/api/account/export/activitypub', async (c) => handleExportActivityPub(c.req.raw, c.env));
app.get('/api/account/export/nostr', async (c) => handleExportNostrRoute(c.req.raw, c.env));
app.get('/api/account/export/atproto', async (c) => handleExportAtProto(c.req.raw, c.env));
app.get('/api/account/export/solid', async (c) => handleExportSolid(c.req.raw, c.env));

// ─── API: Cross-Platform Data Migration ──────────────────
app.post('/api/account/migrate/import/twitter', async (c) => handleImportTwitter(c.req.raw, c.env));
app.post('/api/account/migrate/import/mastodon', async (c) =>
  handleImportMastodon(c.req.raw, c.env),
);
app.post('/api/account/migrate/import/nostr', async (c) => handleImportNostr(c.req.raw, c.env));
app.post('/api/account/migrate/import/bluesky', async (c) => handleImportBluesky(c.req.raw, c.env));
app.post('/api/account/migrate/import/farcaster', async (c) =>
  handleImportFarcaster(c.req.raw, c.env),
);
app.post('/api/account/migrate/export/mastodon', async (c) =>
  handleExportToMastodon(c.req.raw, c.env),
);
app.post('/api/account/migrate/export/nostr', async (c) => handleExportToNostr(c.req.raw, c.env));
app.post('/api/account/migrate/export/bluesky', async (c) =>
  handleExportToBluesky(c.req.raw, c.env),
);
app.get('/api/account/migrate/status', async (c) => handleMigrationStatus(c.req.raw, c.env));
app.get('/api/account/migrate/jobs', async (c) => handleMigrationJobs(c.req.raw, c.env));

// ─── API: Enhanced Account Deletion (v2) ─────────────────
app.post('/api/account/delete/reactivate', async (c) => handleReactivateAccount(c.req.raw, c.env));
app.post('/api/account/delete/confirm-signature', async (c) =>
  handleConfirmDeleteSignature(c.req.raw, c.env),
);
app.get('/api/account/delete/checklist', async (c) => handleDeleteChecklist(c.req.raw, c.env));
app.get('/api/account/delete/certificate/:id', async (c) =>
  handleDeletionCertificate(c.req.raw, c.env),
);

// ─── API: Publish & Engage (session-gated) ──────────────────
app.all('/api/publish', async (c) => withSession(c, () => handlePublish(c.req.raw, c.env)));
app.all('/api/engage', async (c) => withSession(c, () => handleEngage(c.req.raw, c.env)));

// ─── API: Cross-Publish (one-click multi-protocol) ──────────
app.post('/api/publish/all', async (c) => {
  const { handlePublishAll } = await import('./routes/publish');
  return withSession(c, () => handlePublishAll(c.req.raw, c.env));
});
app.post('/api/publish/selected', async (c) => {
  const { handlePublishSelected } = await import('./routes/publish');
  return withSession(c, () => handlePublishSelected(c.req.raw, c.env));
});
app.get('/api/publish/preview', async (c) => {
  const { handlePreviewPost } = await import('./routes/publish');
  return handlePreviewPost(c.req.raw, c.env);
});
app.post('/api/publish/schedule', async (c) => {
  const { handleScheduleCrossPost } = await import('./routes/publish');
  return withSession(c, () => handleScheduleCrossPost(c.req.raw, c.env));
});
app.get('/api/publish/scheduled', async (c) => {
  const { handleListScheduledCrossPosts } = await import('./routes/publish');
  return withSession(c, () => handleListScheduledCrossPosts(c.req.raw, c.env));
});
app.delete('/api/publish/scheduled/:id', async (c) => {
  const { handleDeleteScheduledCrossPost } = await import('./routes/publish');
  return withSession(c, () => handleDeleteScheduledCrossPost(c.req.raw, c.env));
});

// ─── API: Cross-Post History ─────────────────────────────────
app.get('/api/crosspost/author/:wallet', async (c) => {
  const { getAuthorCrossPostBatches } = await import('./lib/cross-publish-orchestrator');
  const wallet = c.req.param('wallet');
  const batches = await getAuthorCrossPostBatches(wallet, c.env);
  return jsonResponse({ batches });
});
app.all('/api/crosspost/batch/:batchId', async (c) => {
  const { getCrossPostBatch, deleteCrossPostBatch } = await import(
    './lib/cross-publish-orchestrator'
  );
  const batchId = c.req.param('batchId');
  if (c.req.method === 'DELETE') {
    const ok = await deleteCrossPostBatch(batchId, c.env);
    return jsonResponse({ ok });
  }
  const batch = await getCrossPostBatch(batchId, c.env);
  return batch ? jsonResponse(batch) : jsonResponse({ error: 'Batch not found' }, 404);
});

// ─── API: Tips ───────────────────────────────────────────────
app.all('/api/tip/lightning/invoice', async (c) => handleLightningInvoice(c.req.raw, c.env));
app.all('/api/tip/frame/tx/:id', async (c) => handleTipFrameTx(c.req.raw, c.env));
app.all('/api/tip/frame/callback/:id', async (c) => handleTipFrameCallback(c.req.raw, c.env));
app.all('/api/tip/frame/:id', async (c) => handleTipFrame(c.req.raw, c.env));
app.all('/api/tip/resolve', async (c) => handleTipResolve(c.req.raw, c.env));
app.all('/api/tip/create', async (c) => withSession(c, () => handleTipCreate(c.req.raw, c.env)));
app.all('/api/tip/settings', async (c) => {
  if (c.req.method === 'GET') return handleTipSettingsGet(c.req.raw, c.env);
  if (c.req.method === 'POST') return withSession(c, () => handleTipSettingsPost(c.req.raw, c.env));
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── API: Tip Notification Preferences ───────────────────────
app.all('/api/tip/notifications/prefs', async (c) => {
  const { handleTipNotificationPrefs } = await import('./lib/tip-notifications');
  return handleTipNotificationPrefs(c.req.raw, c.env);
});

// ─── API: Unified Tips (cross-platform ledger) ───────────────
// Specific /api/tip/unified/* routes are registered before the generic
// /api/tip/* handlers above never overlap — kept together for clarity.
app.post('/api/tip/unified', async (c) =>
  withSession(c, () => handleUnifiedTipCreate(c.req.raw, c.env)),
);
app.get('/api/tip/unified/stats', async (c) => handleUnifiedTipStats(c.req.raw, c.env));
app.get('/api/tip/unified/leaderboard', async (c) => handleUnifiedTipLeaderboard(c.req.raw, c.env));
app.get('/api/tip/unified/activity', async (c) => handleUnifiedTipActivity(c.req.raw, c.env));

// ─── API: Tip Badges & Extended Leaderboards (gamification) ──
app.get('/api/tips/badges', async (c) => handleTipBadges(c.req.raw, c.env));
app.get('/api/tips/leaderboard/protocols', async (c) =>
  handleTipLeaderboardProtocols(c.req.raw, c.env),
);
app.get('/api/tips/leaderboard/coins', async (c) => handleTipLeaderboardCoins(c.req.raw, c.env));

// ─── API: Creator Tip Analytics ───────────────────────────────
// Full analytics dashboard for creators: totals, breakdowns, top tippers, time series
app.get('/api/tip/unified/analytics', async (c) => handleTipAnalytics(c.req.raw, c.env));
app.get('/api/tip/unified/analytics/top-tippers', async (c) => handleTopTippers(c.req.raw, c.env));

// ─── API: Trading Signals (social trading feed) ──────────────
app.get('/api/trading/signals', async (c) => handleTradingSignals(c.req.raw, c.env));
app.post('/api/trading/signals', async (c) =>
  withSession(c, () => handleTradingSignalCreate(c.req.raw, c.env)),
);
app.post('/api/trading/signals/:id/action', async (c) =>
  withSession(c, () => handleTradingSignalAction(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/trading/trending', async (c) => handleTradingTrending(c.req.raw, c.env));
app.get('/api/trading/whales', async (c) => handleTradingWhales(c.req.raw, c.env));
app.get('/api/trading/coins/:coin', async (c) =>
  handleTradingCoinSignals(c.req.raw, c.env, c.req.param('coin')),
);
app.get('/api/trading/coins/:coin/summary', async (c) =>
  handleTradingCoinSummary(c.req.raw, c.env, c.req.param('coin')),
);

// ─── API: Creator Rewards Program ──────────────────────────
app.get('/api/creator/rewards', async (c) =>
  withSession(c, () => handleCreatorRewards(c.req.raw, c.env)),
);
app.get('/api/creator/rewards/history', async (c) => handleCreatorRewardsHistory(c.req.raw, c.env));
app.post('/api/creator/rewards/claim', async (c) =>
  withSession(c, () => handleCreatorRewardsClaim(c.req.raw, c.env)),
);
app.get('/api/creator/rewards/leaderboard', async (c) =>
  handleCreatorRewardsLeaderboard(c.req.raw, c.env),
);
app.post('/api/creator/rewards/compute', async (c) =>
  withSession(c, () => handleCreatorRewardsCompute(c.req.raw, c.env)),
);

// ─── API: Lemmy Discover ─────────────────────────────────────
app.get('/api/lemmy/discover', async (c) => handleLemmyDiscover(c.req.raw, c.env));

// ─── API: Lemmy Tips ─────────────────────────────────────────
app.all('/api/lemmy/tip/leaderboard', async (c) => handleLemmyTipLeaderboard(c.req.raw, c.env));
app.all('/api/lemmy/tip/stats', async (c) => handleLemmyTipStats(c.req.raw, c.env));
app.all('/api/lemmy/tip', async (c) =>
  withSession(c, () => handleLemmyTipCreate(c.req.raw, c.env)),
);

// ─── API: Lemmy Feed & Community ─────────────────────────────
app.get('/api/lemmy/feed', async (c) => handleLemmyFeed(c.req.raw, c.env));
app.get('/api/lemmy/trending', async (c) => handleLemmyTrending(c.req.raw, c.env));
app.get('/api/lemmy/instances', async (c) => handleLemmyInstances(c.req.raw, c.env));
app.get('/api/lemmy/community/:name', async (c) =>
  handleLemmyCommunity(c.req.raw, c.env, c.req.param('name')),
);
app.get('/api/lemmy/post/:id', async (c) =>
  handleLemmyPostById(c.req.raw, c.env, c.req.param('id')),
);

// ─── API: Lemmy Write (session-gated) ────────────────────────
app.post('/api/lemmy/post', async (c) =>
  withSession(c, () => handleLemmyPostCreate(c.req.raw, c.env)),
);
app.post('/api/lemmy/comment', async (c) =>
  withSession(c, () => handleLemmyCommentCreate(c.req.raw, c.env)),
);

// ─── API: Lemmy Bridge (cross-post & share) ──────────────────
app.post('/api/lemmy/bridge/cross-post', async (c) =>
  withSession(c, () => handleLemmyBridgeCrossPost(c.req.raw, c.env)),
);
app.post('/api/lemmy/bridge/share', async (c) =>
  withSession(c, () => handleLemmyBridgeShare(c.req.raw, c.env)),
);
app.get('/api/lemmy/bridge/status', async (c) => handleLemmyBridgeStatus(c.req.raw, c.env));

// ─── API: PeerTube Tips ──────────────────────────────────────
app.post('/api/peertube/tip', async (c) =>
  withSession(c, () => handlePeerTubeTipCreate(c.req.raw, c.env)),
);
app.get('/api/peertube/tip/stats', async (c) => handlePeerTubeTipStats(c.req.raw, c.env));
app.get('/api/peertube/tip/leaderboard', async (c) => handlePeerTubeLeaderboard(c.req.raw, c.env));

// ─── API: PeerTube Video Platform (upload, list, live, federation) ──
app.route('/api/peertube', peertubeRouter);

// ─── API: Podcast Platform (create, manage, Castopod federation) ──
app.route('/api/podcast', podcastRouter);

// ─── API: Bluesky Tips ───────────────────────────────────────
app.post('/api/bluesky/tip', async (c) =>
  withSession(c, () => handleBlueskyTipCreate(c.req.raw, c.env)),
);
app.get('/api/bluesky/tip/stats', async (c) => handleBlueskyTipStats(c.req.raw, c.env));
app.get('/api/bluesky/tip/leaderboard', async (c) => handleBlueskyLeaderboard(c.req.raw, c.env));

// ─── API: Bluesky Feed Generator (live content feed) ─────────
app.route('/api/bluesky/feed', blueskyFeedGen);
app.route('/v1/bluesky/feed', blueskyFeedGen);

// ─── API: Mastodon Tips ──────────────────────────────────────
app.post('/api/mastodon/tip', async (c) =>
  withSession(c, () => handleMastodonTipCreate(c.req.raw, c.env)),
);
app.get('/api/mastodon/tip/stats', async (c) => handleMastodonTipStats(c.req.raw, c.env));
app.get('/api/mastodon/tip/leaderboard', async (c) => handleMastodonLeaderboard(c.req.raw, c.env));

// ─── API: Farcaster Creator Coins ─────────────────────────────
app.post('/api/farcaster/coin/deploy', async (c) =>
  withSession(c, () => handleFarcasterCoinDeploy(c.req.raw, c.env)),
);
app.get('/api/farcaster/coin/:fid', async (c) => handleFarcasterCoinGet(c.req.raw, c.env));
app.post('/api/farcaster/coin/:fid/tip', async (c) =>
  withSession(c, () => handleFarcasterCoinTip(c.req.raw, c.env)),
);

// ─── API: Lens Protocol Creator Coins ─────────────────────────
app.post('/api/lens/coin/deploy', async (c) =>
  withSession(c, () => handleLensCoinDeploy(c.req.raw, c.env)),
);
app.get('/api/lens/coin/:profileId', async (c) => handleLensCoinGet(c.req.raw, c.env));
app.post('/api/lens/coin/:profileId/tip', async (c) =>
  withSession(c, () => handleLensCoinTip(c.req.raw, c.env)),
);

// ─── API: Cross-Protocol Creator Coins ─────────────────────────
// Any user from ANY protocol can launch a creator coin via /api/coin/launch
app.route('/api/coin', crossProtocolCoin);

// ─── API: Cross-Chain Tip Routing ─────────────────────────────
// Handles tips that originate on one chain/protocol and must be
// settled on another (e.g. Solana tip → Farcaster coin on Base)
app.post('/api/tip/cross-chain', async (c) => {
  const { handleCrossChainTip } = await import('./routes/unified-tip');
  return withSession(c, () => handleCrossChainTip(c.req.raw, c.env));
});

// ─── API: Smart Chain Selection ───────────────────────────────
// Returns the best chain(s) for a tip based on sender + recipient capabilities
app.get('/api/tip/smart-chain', async (c) => {
  const { handleSmartChainSelection } = await import('./routes/tip');
  return handleSmartChainSelection(c.req.raw, c.env);
});

// ─── API: Notifications ──────────────────────────────────────
app.all('/api/notifications', async (c) => handleNotifications(c.req.raw, c.env));
app.get('/api/notifications/grouped', async (c) => handleNotifications(c.req.raw, c.env));
app.post('/api/notifications/digest', async (c) => {
  const { handleDigestFormat } = await import('./routes/digest');
  return handleDigestFormat(c.req.raw, c.env);
});
app.get('/api/notifications/digest', async (c) => {
  const { handleDigestStatus } = await import('./routes/digest');
  return handleDigestStatus(c.req.raw, c.env);
});
app.post('/api/notifications/preferences', async (c) => handleMarkAllRead(c.req.raw, c.env));
app.post('/api/notifications/mark-all-read', async (c) => handleMarkAllRead(c.req.raw, c.env));
app.all('/api/notify', async (c) => handleNotify(c.req.raw, c.env));

// ─── API: Voice & Video Rooms ──────────────────────────────────

import {
  handleCreateRoom,
  handleGenerateInvite,
  handleGetActiveRooms,
  handleGetParticipants,
  handleGetSignals,
  handleJoinRoom,
  handleLeaveRoom,
  handleResolveInvite,
  handleSendSignal,
  handleUpdateState,
} from './routes/voice-rooms';

app.post('/api/voice/create', async (c) =>
  withSession(c, () => handleCreateRoom(c.req.raw, c.env)),
);
app.get('/api/voice/active', async (c) =>
  withSession(c, () => handleGetActiveRooms(c.req.raw, c.env)),
);
app.post('/api/voice/:id/join', async (c) =>
  withSession(c, () => handleJoinRoom(c.req.raw, c.env, c.req.param('id'))),
);
app.post('/api/voice/:id/leave', async (c) =>
  withSession(c, () => handleLeaveRoom(c.req.raw, c.env, c.req.param('id'))),
);
app.post('/api/voice/:id/update', async (c) =>
  withSession(c, () => handleUpdateState(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/voice/:id/participants', async (c) =>
  withSession(c, () => handleGetParticipants(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/voice/:id/invite', async (c) =>
  withSession(c, () => handleGenerateInvite(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/voice/invite/:code', async (c) =>
  handleResolveInvite(c.req.raw, c.env, c.req.param('code')),
);
app.post('/api/voice/:id/signal', async (c) =>
  withSession(c, () => handleSendSignal(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/voice/:id/signals', async (c) =>
  withSession(c, () => handleGetSignals(c.req.raw, c.env, c.req.param('id'))),
);

// ─── API: Messages (DM) ─────────────────────────────────────
app.get('/api/messages/unread', async (c) => handleUnreadCount(c.req.raw, c.env));
app.get('/api/messages/conversations', async (c) => handleConversations(c.req.raw, c.env));
app.get('/api/messages/inbox', async (c) => withSession(c, () => handleInbox(c.req.raw, c.env)));
app.post('/api/messages/send', async (c) =>
  withSession(c, () => handleSendMessage(c.req.raw, c.env)),
);
app.post('/api/messages/read', async (c) => withSession(c, () => handleMarkRead(c.req.raw, c.env)));
app.get('/api/messages/thread/:peerId', async (c) =>
  withSession(c, () => handleThread(c.req.raw, c.env, c.req.param('peerId'))),
);
app.all('/api/messages/:id', async (c) => {
  if (c.req.method === 'GET') {
    return handleConversationMessages(c.req.raw, c.env, c.req.param('id'));
  }
  if (c.req.method === 'DELETE') {
    return handleDeleteMessage(c.req.raw, c.env, c.req.param('id'));
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── API: E2E Encryption & Secure Messaging ─────────────────────
app.get('/api/messages/keys/status', async (c) => handleKeyStatus(c.req.raw, c.env));
app.post('/api/messages/keys/exchange', async (c) =>
  withSession(c, () => handleKeyExchange(c.req.raw, c.env)),
);
app.get('/api/messages/keys/public/:userId', async (c) =>
  handleGetPublicKeys(c.req.raw, c.env, c.req.param('userId')),
);
app.post('/api/messages/keys/rotate', async (c) =>
  withSession(c, () => handleRotateKeys(c.req.raw, c.env)),
);
app.post('/api/messages/keys/safety-numbers', async (c) =>
  withSession(c, () => handleSafetyNumbers(c.req.raw, c.env)),
);
app.post('/api/messages/send-encrypted', async (c) =>
  withSession(c, () => handleSendEncrypted(c.req.raw, c.env)),
);
app.post('/api/messages/receive-encrypted', async (c) =>
  withSession(c, () => handleReceiveEncrypted(c.req.raw, c.env)),
);

// ─── API: Encrypted Group Chat ───────────────────────────────────
app.post('/api/messages/groups/create', async (c) =>
  withSession(c, () => handleCreateGroup(c.req.raw, c.env)),
);
app.get('/api/messages/groups/list', async (c) =>
  withSession(c, () => handleUserGroups(c.req.raw, c.env)),
);
app.get('/api/messages/groups/:groupId/info', async (c) =>
  withSession(c, () => handleGroupInfo(c.req.raw, c.env, c.req.param('groupId'))),
);
app.post('/api/messages/groups/:groupId/send', async (c) =>
  withSession(c, () => handleGroupSend(c.req.raw, c.env, c.req.param('groupId'))),
);
app.get('/api/messages/groups/:groupId/messages', async (c) =>
  withSession(c, () => handleGroupMessages(c.req.raw, c.env, c.req.param('groupId'))),
);
app.post('/api/messages/groups/:groupId/add-member', async (c) =>
  withSession(c, () => handleGroupAddMember(c.req.raw, c.env, c.req.param('groupId'))),
);
app.post('/api/messages/groups/:groupId/remove-member', async (c) =>
  withSession(c, () => handleGroupRemoveMember(c.req.raw, c.env, c.req.param('groupId'))),
);

// ─── API: Chat Search ────────────────────────────────────────────
app.get('/api/messages/search', async (c) =>
  withSession(c, () => handleSearchMessages(c.req.raw, c.env)),
);
app.get('/api/messages/search/advanced', async (c) =>
  withSession(c, () => handleAdvancedSearch(c.req.raw, c.env)),
);
app.get('/api/messages/search/media/:conversationId', async (c) =>
  withSession(c, () => handleSearchMedia(c.req.raw, c.env, c.req.param('conversationId'))),
);
app.post('/api/messages/search/index', async (c) =>
  withSession(c, () => handleIndexMessage(c.req.raw, c.env)),
);
app.get('/api/messages/search/suggestions', async (c) =>
  withSession(c, () => handleSearchSuggestions(c.req.raw, c.env)),
);

// ─── API: Enhanced Chat Features (Reactions, Edit, Timers, Media, Polls, GIFs) ──
app.post('/api/messages/react', async (c) =>
  withSession(c, () => handleToggleReaction(c.req.raw, c.env)),
);
app.post('/api/messages/edit', async (c) =>
  withSession(c, () => handleEditMessage(c.req.raw, c.env)),
);
app.post('/api/messages/unsend', async (c) =>
  withSession(c, () => handleUnsendMessage(c.req.raw, c.env)),
);
app.post('/api/messages/delete-for-me', async (c) =>
  withSession(c, () => handleDeleteForMe(c.req.raw, c.env)),
);
app.post('/api/messages/mark-read/:messageId', async (c) =>
  withSession(c, () => handleMarkMessageRead(c.req.raw, c.env, c.req.param('messageId'))),
);

// ─── API: Conversation Timers (Auto-Delete) ──────────────────────
app.get('/api/chat/timer/:conversationId', async (c) =>
  withSession(c, () => handleGetTimer(c.req.raw, c.env, c.req.param('conversationId'))),
);
app.post('/api/chat/timer/:conversationId', async (c) =>
  withSession(c, () => handleSetTimer(c.req.raw, c.env, c.req.param('conversationId'))),
);
app.delete('/api/chat/timer/:conversationId', async (c) =>
  withSession(c, () => handleRemoveTimer(c.req.raw, c.env, c.req.param('conversationId'))),
);

// ─── API: Chat Media ─────────────────────────────────────────────
app.post('/api/chat/media/upload', async (c) =>
  withSession(c, () => handleUploadMedia(c.req.raw, c.env)),
);
app.get('/api/chat/media/:mediaId', async (c) =>
  handleGetMedia(c.req.raw, c.env, c.req.param('mediaId')),
);
app.get('/api/chat/media/list/:conversationId', async (c) =>
  withSession(c, () => handleListMedia(c.req.raw, c.env, c.req.param('conversationId'))),
);

// ─── API: Polls ──────────────────────────────────────────────────
app.post('/api/chat/polls/create', async (c) =>
  withSession(c, () => handleCreatePoll(c.req.raw, c.env)),
);
app.post('/api/chat/polls/vote', async (c) =>
  withSession(c, () => handleVotePoll(c.req.raw, c.env)),
);
app.get('/api/chat/polls/:pollId', async (c) =>
  handleGetPoll(c.req.raw, c.env, c.req.param('pollId')),
);

// ─── API: GIF Search ─────────────────────────────────────────────
app.get('/api/chat/gifs/search', async (c) =>
  withSession(c, () => handleSearchGifs(c.req.raw, c.env)),
);

// ─── API: Link Previews ──────────────────────────────────────────
app.post('/api/chat/link-preview', async (c) =>
  withSession(c, () => handleLinkPreview(c.req.raw, c.env)),
);

// ─── API: File Upload & Management ───────────────────────────────
app.post('/api/chat/files/upload', async (c) =>
  withSession(c, () => handleUploadFile(c.req.raw, c.env)),
);
app.get('/api/chat/files/:fileId', async (c) =>
  handleGetFile(c.req.raw, c.env, c.req.param('fileId')),
);
app.get('/api/chat/files/download/:fileId', async (c) =>
  withSession(c, () => handleDownloadFile(c.req.raw, c.env, c.req.param('fileId'))),
);
app.get('/api/chat/files/list/:conversationId', async (c) =>
  withSession(c, () => handleListFiles(c.req.raw, c.env, c.req.param('conversationId'))),
);
app.delete('/api/chat/files/:fileId', async (c) =>
  withSession(c, () => handleDeleteFile(c.req.raw, c.env, c.req.param('fileId'))),
);
app.get('/api/chat/quota', async (c) => withSession(c, () => handleGetQuota(c.req.raw, c.env)));

// ─── API: Stickers ───────────────────────────────────────────────
app.post('/api/chat/stickers/create-pack', async (c) =>
  withSession(c, () => handleCreateStickerPack(c.req.raw, c.env)),
);
app.get('/api/chat/stickers/packs', async (c) =>
  withSession(c, () => handleGetStickerPacks(c.req.raw, c.env)),
);
app.get('/api/chat/stickers/pack/:packId', async (c) =>
  handleGetStickerPack(c.req.raw, c.env, c.req.param('packId')),
);

// ─── API: Voice Notes ────────────────────────────────────────────
app.post('/api/messages/voice/upload', async (c) =>
  withSession(c, () => handleUploadVoiceNote(c.req.raw, c.env)),
);

// ─── API: Cross-Platform Unified Rooms ───────────────────────────
app.post('/api/rooms/unified/create', async (c) =>
  withSession(c, () => handleUnifiedRoomCreate(c.req.raw, c.env)),
);
app.get('/api/rooms/unified/mine', async (c) =>
  withSession(c, () => handleUnifiedRoomMine(c.req.raw, c.env)),
);
app.get('/api/rooms/unified/:id', async (c) =>
  withSession(c, () => handleUnifiedRoomInfo(c.req.raw, c.env, c.req.param('id'))),
);
app.post('/api/rooms/unified/:id/join', async (c) =>
  withSession(c, () => handleUnifiedRoomJoin(c.req.raw, c.env, c.req.param('id'))),
);
app.post('/api/rooms/unified/:id/leave', async (c) =>
  withSession(c, () => handleUnifiedRoomLeave(c.req.raw, c.env, c.req.param('id'))),
);
app.post('/api/rooms/unified/:id/message', async (c) =>
  withSession(c, () => handleUnifiedRoomMessage(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/rooms/unified/:id/messages', async (c) =>
  withSession(c, () => handleUnifiedRoomMessages(c.req.raw, c.env, c.req.param('id'))),
);
app.post('/api/rooms/unified/:id/invite', async (c) =>
  withSession(c, () => handleUnifiedRoomInvite(c.req.raw, c.env, c.req.param('id'))),
);
app.put('/api/rooms/unified/:id/transport', async (c) =>
  withSession(c, () => handleUnifiedRoomTransport(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/api/rooms/unified/:id/unread', async (c) =>
  withSession(c, () => handleUnifiedRoomUnread(c.req.raw, c.env, c.req.param('id'))),
);

// ─── API: Transport Preferences ──────────────────────────────────
app.all('/api/messages/transport/preferences', async (c) =>
  withSession(c, () => handleTransportPrefs(c.req.raw, c.env)),
);
app.get('/api/messages/transport/offline', async (c) =>
  withSession(c, () => handleGetOfflineMessages(c.req.raw, c.env)),
);

// ─── API: Identity ───────────────────────────────────────────
app.all('/api/identity/resolve', async (c) => handleResolveIdentity(c.req.raw, c.env));
app.get('/api/identity/profile', async (c) => {
  // /api/identity/profile?wallet=0x... returns cross-protocol linked identities
  // /api/identity/profile?handle=... returns resolved identity profile (legacy)
  const wallet = c.req.query('wallet');
  if (wallet) return handleGetIdentityProfile(c.req.raw, c.env);
  return handleIdentityProfile(c.req.raw, c.env);
});
app.post('/api/identity/link', async (c) =>
  withSession(c, () => handleLinkIdentity(c.req.raw, c.env)),
);
app.delete('/api/identity/link', async (c) =>
  withSession(c, () => handleUnlinkIdentity(c.req.raw, c.env)),
);

// ─── API: Identity Extensions (AT Protocol, Zora, Telegram) ──
app.post('/api/identity/extensions/link/atproto', async (c) =>
  withSession(c, () => handleLinkAtproto(c.req.raw, c.env)),
);
app.post('/api/identity/extensions/create/atproto', async (c) =>
  withSession(c, () => handleCreateAtproto(c.req.raw, c.env)),
);
app.post('/api/identity/extensions/link/zora', async (c) =>
  withSession(c, () => handleLinkZora(c.req.raw, c.env)),
);
app.get('/api/identity/extensions/resolve/zora', async (c) => handleResolveZora(c.req.raw, c.env));
app.post('/api/identity/extensions/link/telegram', async (c) =>
  withSession(c, () => handleLinkTelegram(c.req.raw, c.env)),
);
app.get('/api/identity/extensions/resolve/did', async (c) => handleResolveDid(c.req.raw, c.env));
app.get('/api/identity/extensions/resolve/wallet', async (c) =>
  handleResolveWallet(c.req.raw, c.env),
);
app.get('/api/identity/extensions/status', async (c) =>
  handleIdentityExtensionsStatus(c.req.raw, c.env),
);

// ─── API: Identity Auto-Discovery ──────────────────────────────
app.post('/api/identity/discover', async (c) =>
  withSession(c, () => handleIdentityDiscover(c.req.raw, c.env)),
);
app.post('/api/identity/link-all', async (c) =>
  withSession(c, () => handleIdentityLinkAll(c.req.raw, c.env)),
);
app.get('/api/identity/discovery/status', async (c) =>
  handleIdentityDiscoveryStatus(c.req.raw, c.env),
);
app.get('/v1/identity/discovery/status', async (c) =>
  handleIdentityDiscoveryStatus(c.req.raw, c.env),
);
app.post('/v1/identity/discover', async (c) =>
  withSession(c, () => handleIdentityDiscover(c.req.raw, c.env)),
);
app.post('/v1/identity/link-all', async (c) =>
  withSession(c, () => handleIdentityLinkAll(c.req.raw, c.env)),
);

// ─── API: Blink ─────────────────────────────────────────────
app.all('/api/blink/tip', async (c) => handleBlinkTip(c.req.raw, c.env));

// ─── API: Billing ────────────────────────────────────────────
app.all('/api/billing/checkout', async (c) => handleBillingCheckout(c.req.raw, c.env));
app.all('/api/billing/verify', async (c) => handleBillingVerify(c.req.raw, c.env));
app.all('/api/billing/status', async (c) => handleBillingStatus(c.req.raw, c.env));
// Session-gated billing endpoints
app.post('/api/billing/subscribe', async (c) =>
  withSession(c, () => handleBillingSubscribe(c.req.raw, c.env)),
);
app.post('/api/billing/cancel', async (c) =>
  withSession(c, () => handleBillingCancel(c.req.raw, c.env)),
);
app.get('/api/billing/my-status', async (c) =>
  withSession(c, () => handleBillingMyStatus(c.req.raw, c.env)),
);

// ─── API: Subscription ──────────────────────────────────────
// Static routes before parameterized
app.all('/api/subscription/create', async (c) =>
  withSession(c, () => handleSubscriptionCreate(c.req.raw, c.env)),
);
app.all('/api/subscription/subscribe', async (c) =>
  withSession(c, () => handleSubscriptionSubscribe(c.req.raw, c.env)),
);
app.all('/api/subscription/confirm', async (c) =>
  withSession(c, () => handleSubscriptionConfirm(c.req.raw, c.env)),
);
app.all('/api/subscription/status', async (c) =>
  withSession(c, () => handleSubscriptionStatus(c.req.raw, c.env)),
);
app.all('/api/subscription/cancel', async (c) =>
  withSession(c, () => handleSubscriptionCancel(c.req.raw, c.env)),
);
app.all('/api/subscription/check-content', async (c) =>
  withSession(c, () => handleSubscriptionContentCheck(c.req.raw, c.env)),
);
// My subscriptions (must be before parameterized route)
app.all('/api/subscription/my', async (c) =>
  withSession(c, () => handleSubscriptionMy(c.req.raw, c.env)),
);
// Parameterized route last
app.all('/api/subscription/:creator', async (c) =>
  handleSubscriptionTiers(c.req.raw, c.env, c.req.param('creator')),
);

// ─── API: Subscription NFT (NFT-backed subscriptions) ──────────
app.post('/api/subscription-nft/create', async (c) =>
  withSession(c, () => handleSubscriptionNftCreate(c.req.raw, c.env)),
);
app.get('/api/subscription-nft/tiers', async (c) => handleSubscriptionNftTiers(c.req.raw, c.env));
app.put('/api/subscription-nft/tier/:tierId', async (c) =>
  withSession(c, () => handleSubscriptionNftUpdateTier(c.req.raw, c.env, c.req.param('tierId'))),
);
app.get('/api/subscription-nft/subscribers', async (c) =>
  withSession(c, () => handleSubscriptionNftSubscribers(c.req.raw, c.env)),
);
app.post('/api/subscription-nft/subscribe', async (c) =>
  withSession(c, () => handleSubscriptionNftSubscribe(c.req.raw, c.env)),
);
app.post('/api/subscription-nft/confirm', async (c) =>
  withSession(c, () => handleSubscriptionNftConfirm(c.req.raw, c.env)),
);
app.get('/api/subscription-nft/active', async (c) =>
  withSession(c, () => handleSubscriptionNftActive(c.req.raw, c.env)),
);
app.post('/api/subscription-nft/cancel', async (c) =>
  withSession(c, () => handleSubscriptionNftCancel(c.req.raw, c.env)),
);
app.get('/api/subscription-nft/check', async (c) => handleSubscriptionNftCheck(c.req.raw, c.env));

// ─── API: Tiers ──────────────────────────────────────────────
import tiers from './routes/tiers';

app.route('/api/tiers', tiers);

// ─── API: Preferences ───────────────────────────────────────
app.all('/api/preferences', async (c) => handlePreferences(c.req.raw, c.env));
app.get('/api/preferences/topics', async (c) => handleGetTopics(c.req.raw, c.env));
app.post('/api/preferences/topics', async (c) =>
  withSession(c, () => handleAdjustTopic(c.req.raw, c.env)),
);
app.post('/api/preferences/topics/clear', async (c) => handleClearTopic(c.req.raw, c.env));

// ─── API: Algorithm Control (user-controlled feed) ──────────
app.get('/api/algo/weights', async (c) => handleGetWeights(c.req.raw, c.env));
app.put('/api/algo/weights', async (c) => handleUpdateWeights(c.req.raw, c.env));
app.post('/api/algo/weights/reset', async (c) => handleResetWeights(c.req.raw, c.env));
app.get('/api/algo/weights/presets', async (c) => handleGetPresets(c.req.raw, c.env));
app.post('/api/algo/weights/preset/:name', async (c) =>
  handleApplyPreset(c.req.raw, c.env, c.req.param('name')),
);
app.get('/api/algo/explain/:postId', async (c) =>
  handleExplainPost(c.req.raw, c.env, c.req.param('postId')),
);
app.get('/api/algo/rules', async (c) => handleListRules(c.req.raw, c.env));
app.post('/api/algo/rules', async (c) => handleAddRule(c.req.raw, c.env));
app.delete('/api/algo/rules/:ruleId', async (c) =>
  handleDeleteRule(c.req.raw, c.env, c.req.param('ruleId')),
);
app.get('/api/algo/signals', async (c) => handleAlgoGetSignals(c.req.raw, c.env));
app.put('/api/algo/signals', async (c) => handleUpdateSignals(c.req.raw, c.env));
app.get('/api/algo/presets/share/:name', async (c) =>
  handleSharePreset(c.req.raw, c.env, c.req.param('name')),
);

// ─── API: x402 ─────────────────────────────────────────────
app.all('/api/x402/paywall', async (c) => handleX402Paywall(c.req.raw, c.env));
app.all('/api/x402/verify', async (c) => handleX402Verify(c.req.raw, c.env));

// ─── API: Token Gate ─────────────────────────────────────────
app.post('/api/token-gate/verify', async (c) => handleTokenGateVerify(c.req.raw, c.env));
app.post('/api/token-gate/verify-multi', async (c) => handleTokenGateVerifyMulti(c.req.raw, c.env));
app.post('/api/token-gate/gate-content', async (c) => handleTokenGateContent(c.req.raw, c.env));
app.get('/api/token-gate/gate/:contentType/:contentId', async (c) =>
  handleTokenGateGet(c.req.raw, c.env, c.req.param('contentType'), c.req.param('contentId')),
);
app.delete('/api/token-gate/gate/:contentType/:contentId', async (c) =>
  handleTokenGateDelete(c.req.raw, c.env, c.req.param('contentType'), c.req.param('contentId')),
);
app.post('/api/token-gate/resolve', async (c) => handleTokenGateResolve(c.req.raw, c.env));

// ─── API: Creator Config (vesting, fees, cross-chain) ───────
app.route('/api/creator', creatorConfig);

// ─── API: Creator Vesting & Rewards ──────────────────────────
app.route('/api/creator/vesting', creatorVesting);

// ─── API: Creator Videos (upload, manage, analytics) ───────
app.route('/api/creator/videos', creatorVideos);

// ─── API: Creator Storage Usage ──────────────────────────
app.get('/api/creator/storage', async (c) => handleCreatorStorage(c.req.raw, c.env));

// ─── API: Decentralized Media Storage (IPFS + Arweave) ────────
// Upload routes (require authentication)
app.post('/api/media/upload/image', async (c) => handleImageUpload(c.req.raw, c.env));
app.post('/api/media/upload', async (c) => handleMediaUpload(c.req.raw, c.env));

// Image routes — CDN-backed IPFS URLs with on-the-fly transformation
app.get('/api/media/image/:cid', async (c) => handleGetImage(c.req.raw, c.env, c.req.param('cid')));
app.get('/api/media/image/:cid/metadata', async (c) =>
  handleGetImageMetadata(c.req.raw, c.env, c.req.param('cid')),
);

// Unified media gateway proxy — fallback chain: IPFS → Arweave → R2
app.get('/api/media/gateway/:type/:id', async (c) =>
  handleMediaGateway(c.req.raw, c.env, c.req.param('type'), c.req.param('id')),
);

// Media service health check
app.get('/api/media/health', async (c) => handleMediaHealth(c.req.raw, c.env));

// Make media permanent on Arweave (requires funded Irys node)
app.post('/api/media/make-permanent', async (c) => handleMakePermanent(c.req.raw, c.env));

// Creator media dashboard — shows uploaded images, storage stats, CDN status
app.get('/api/creator/media', async (c) => handleCreatorMediaDashboard(c.req.raw, c.env));

// ─── API: Creator Coin Dashboard (TASK 3) ────────────────────────
app.get('/api/creator/coins', async (c) => handleCreatorCoinsList(c.req.raw, c.env));
app.get('/api/creator/coin/:address/stats', async (c) => handleCreatorCoinStats(c.req.raw, c.env));
app.get('/api/creator/coin/:address/holders', async (c) =>
  handleCreatorCoinHolders(c.req.raw, c.env),
);
app.get('/api/creator/coin/:address/trades', async (c) =>
  handleCreatorCoinTrades(c.req.raw, c.env),
);
app.post('/api/creator/coin/:address/burn', async (c) => handleCreatorCoinBurn(c.req.raw, c.env));
app.post('/api/creator/coin/:address/airdrop', async (c) =>
  handleCreatorCoinAirdrop(c.req.raw, c.env),
);
app.post('/api/creator/coin/:address/gated-post', async (c) =>
  handleCreatorCoinGatedPost(c.req.raw, c.env),
);
app.get('/api/creator/coin/:address/revenue', async (c) =>
  handleCreatorCoinRevenue(c.req.raw, c.env),
);

// ─── API: Platform Revenue Transparency (public, TASK 4) ─────────
app.get('/api/platform/revenue', async (c) => handlePlatformRevenue(c.req.raw, c.env));

// ─── API: Coin Statistics & Leaderboard (TASK 5) ────────────────────
app.get('/api/coins/stats/overview', async (c) => handleCoinStatsOverview(c.req.raw, c.env));
app.get('/api/coins/stats/top', async (c) => handleCoinStatsTop(c.req.raw, c.env));
app.get('/api/coins/stats/trending', async (c) => handleCoinStatsTrending(c.req.raw, c.env));
app.get('/api/coins/stats/new', async (c) => handleCoinStatsNew(c.req.raw, c.env));
app.get('/api/coins/stats/gainers', async (c) => handleCoinStatsGainers(c.req.raw, c.env));
app.get('/api/coins/stats/losers', async (c) => handleCoinStatsLosers(c.req.raw, c.env));
app.get('/api/coins/stats/most-holders', async (c) => handleCoinStatsMostHolders(c.req.raw, c.env));
app.get('/api/coins/stats/highest-volume', async (c) =>
  handleCoinStatsHighestVolume(c.req.raw, c.env),
);

// ─── API: Token Community (engagement layer) ────────────────
app.route('/api/token', tokenCommunity);

// ─── API: PeerTube Livestreams (creator token streaming) ───
app.route('/api/token', peertubeStreams);

// ─── API: Live Shorts (60s cross-protocol live broadcasting) ───
import liveShorts from './routes/live-shorts-index';

app.route('/api/live-shorts', liveShorts);
app.route('/v1/live-shorts', liveShorts);

// ─── API: WebRTC Video Call (P2P calling, signaling relay, group calls) ───
import {
  handleCallCreate,
  handleCallEnd,
  handleCallHistory,
  handleCallJoin,
  handleCallKick,
  handleCallLeave,
  handleCallMute,
  handleCallSignal,
  handleCallSignalPoll,
  handleCallStatus,
} from './lib/video-call';
// ─── API: Persistent Call Rooms (Discord-style voice channels) ───
import {
  handleRoomCreate,
  handleRoomDelete,
  handleRoomInfo,
  handleRoomInvite,
  handleRoomJoin,
  handleRoomLeave,
  handleRoomMute,
  handleRoomsActive,
} from './routes/call-rooms';
// ─── API: Live Streaming Hub (Owncast, PeerTube, YouTube, Twitch, Spaces) ───
import {
  handleCreatorLiveProfile,
  handleGetNotifications,
  handleGetWatchedCreators,
  handleGoLive,
  handleKickChannelStatus,
  handleLiveChatMessages,
  handleLiveChatSend,
  handleLiveDetails,
  handleLiveNow,
  handleLiveSources,
  handleLiveTip,
  handleLiveUpcoming,
  handleLiveViewersSSE,
  handleNotificationSettings,
  handlePeerTubeInstances,
  handlePrivateStreamAllowlist,
  handlePrivateStreamConfig,
  handlePrivateStreamConfigure,
  handlePrivateStreamJoin,
  handlePrivateStreamRevoke,
  handlePrivateStreamRotate,
  handlePrivateStreamViewers,
  handleRouteEstimate,
  handleRouteSwitch,
  handleScheduleStream,
  handleStopLive,
  handleStreamRouteStatus,
  handleTwitchCurated,
  handleUnwatchCreator,
  handleWatchCreator,
  handleWatchedLive,
  handleWebRTCAnswer,
  handleWebRTCEnd,
  handleWebRTCGetOffer,
  handleWebRTCIce,
  handleWebRTCOffer,
  handleWebRTCViewers,
} from './routes/live';

// Static routes (no path params) — must be before parameterized :id routes
app.get('/api/live/now', async (c) => handleLiveNow(c.req.raw, c.env));
app.get('/api/live/upcoming', async (c) => handleLiveUpcoming(c.req.raw, c.env));
app.get('/api/live/sources', async (c) => handleLiveSources(c.req.raw, c.env));
app.post('/api/live/go-live', async (c) => handleGoLive(c.req.raw, c.env));
app.post('/api/live/stop', async (c) => handleStopLive(c.req.raw, c.env));
app.post('/api/live/schedule', async (c) => handleScheduleStream(c.req.raw, c.env));

// Chat routes
app.get('/api/live/chat/:id/messages', async (c) =>
  handleLiveChatMessages(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/live/chat/:id/message', async (c) =>
  handleLiveChatSend(c.req.raw, c.env, c.req.param('id')),
);

// Creator profile
app.get('/api/live/creators/:id', async (c) =>
  handleCreatorLiveProfile(c.req.raw, c.env, c.req.param('id')),
);

// Viewer count (SSE)
app.get('/api/live/viewers/:id', async (c) =>
  handleLiveViewersSSE(c.req.raw, c.env, c.req.param('id')),
);

// ─── Notification Routes ────────────────────────────────────────────
app.post('/api/live/watch', async (c) => handleWatchCreator(c.req.raw, c.env));
app.post('/api/live/unwatch', async (c) => handleUnwatchCreator(c.req.raw, c.env));
app.get('/api/live/watched', async (c) => handleGetWatchedCreators(c.req.raw, c.env));
app.get('/api/live/watched/live', async (c) => handleWatchedLive(c.req.raw, c.env));
app.get('/api/live/notifications', async (c) => handleGetNotifications(c.req.raw, c.env));
app.post('/api/live/notifications/settings', async (c) =>
  handleNotificationSettings(c.req.raw, c.env),
);

// ─── Source-specific Routes ─────────────────────────────────────────
app.get('/api/live/sources/peertube/instances', async (c) =>
  handlePeerTubeInstances(c.req.raw, c.env),
);
app.get('/api/live/sources/twitch/curated', async (c) => handleTwitchCurated(c.req.raw, c.env));
app.get('/api/live/kick/status/:channel', async (c) =>
  handleKickChannelStatus(c.req.raw, c.env, c.req.param('channel')),
);

// Stream details + tipping (must be last to avoid conflicting with above)
app.get('/api/live/:id', async (c) => handleLiveDetails(c.req.raw, c.env, c.req.param('id')));
app.post('/api/live/:id/tip', async (c) => handleLiveTip(c.req.raw, c.env, c.req.param('id')));

// ─── WebRTC P2P Streaming ───────────────────────────────────────────
app.post('/api/live/webrtc/offer', async (c) => handleWebRTCOffer(c.req.raw, c.env));
app.post('/api/live/webrtc/answer', async (c) => handleWebRTCAnswer(c.req.raw, c.env));
app.post('/api/live/webrtc/ice', async (c) => handleWebRTCIce(c.req.raw, c.env));
app.get('/api/live/webrtc/offer/:sessionId', async (c) =>
  handleWebRTCGetOffer(c.req.raw, c.env, c.req.param('sessionId')),
);
app.get('/api/live/webrtc/viewers', async (c) => handleWebRTCViewers(c.req.raw, c.env));
app.delete('/api/live/webrtc/session/:sessionId', async (c) =>
  handleWebRTCEnd(c.req.raw, c.env, c.req.param('sessionId')),
);

// V1 WebRTC routes
app.post('/v1/live/webrtc/offer', async (c) => handleWebRTCOffer(c.req.raw, c.env));
app.post('/v1/live/webrtc/answer', async (c) => handleWebRTCAnswer(c.req.raw, c.env));
app.post('/v1/live/webrtc/ice', async (c) => handleWebRTCIce(c.req.raw, c.env));
app.get('/v1/live/webrtc/offer/:sessionId', async (c) =>
  handleWebRTCGetOffer(c.req.raw, c.env, c.req.param('sessionId')),
);
app.get('/v1/live/webrtc/viewers', async (c) => handleWebRTCViewers(c.req.raw, c.env));
app.delete('/v1/live/webrtc/session/:sessionId', async (c) =>
  handleWebRTCEnd(c.req.raw, c.env, c.req.param('sessionId')),
);

// ─── Video Call (WebRTC P2P) ──────────────────────────────────────
app.post('/api/calls/create', async (c) => handleCallCreate(c.req.raw, c.env));
app.post('/api/calls/:id/join', async (c) => handleCallJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/api/calls/:id/leave', async (c) => handleCallLeave(c.req.raw, c.env, c.req.param('id')));
app.get('/api/calls/:id/status', async (c) =>
  handleCallStatus(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/calls/:id/signal', async (c) =>
  handleCallSignal(c.req.raw, c.env, c.req.param('id')),
);
app.get('/api/calls/:id/signal/poll', async (c) =>
  handleCallSignalPoll(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/calls/:id/kick', async (c) => handleCallKick(c.req.raw, c.env, c.req.param('id')));
app.post('/api/calls/:id/mute', async (c) => handleCallMute(c.req.raw, c.env, c.req.param('id')));
app.post('/api/calls/:id/end', async (c) => handleCallEnd(c.req.raw, c.env, c.req.param('id')));
app.get('/api/calls/history', async (c) => handleCallHistory(c.req.raw, c.env));
// V1 aliases
app.post('/v1/calls/create', async (c) => handleCallCreate(c.req.raw, c.env));
app.get('/v1/calls/history', async (c) => handleCallHistory(c.req.raw, c.env));
app.post('/v1/calls/:id/join', async (c) => handleCallJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/calls/:id/leave', async (c) => handleCallLeave(c.req.raw, c.env, c.req.param('id')));
app.get('/v1/calls/:id/status', async (c) => handleCallStatus(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/calls/:id/signal', async (c) =>
  handleCallSignal(c.req.raw, c.env, c.req.param('id')),
);
app.get('/v1/calls/:id/signal/poll', async (c) =>
  handleCallSignalPoll(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/calls/:id/kick', async (c) => handleCallKick(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/calls/:id/mute', async (c) => handleCallMute(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/calls/:id/end', async (c) => handleCallEnd(c.req.raw, c.env, c.req.param('id')));

// ─── Persistent Call Rooms ─────────────────────────────────────────
app.post('/api/rooms/create', async (c) => handleRoomCreate(c.req.raw, c.env));
app.get('/api/rooms/active', async (c) => handleRoomsActive(c.req.raw, c.env));
app.get('/api/rooms/:id', async (c) => handleRoomInfo(c.req.raw, c.env, c.req.param('id')));
app.post('/api/rooms/:id/join', async (c) => handleRoomJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/api/rooms/:id/leave', async (c) => handleRoomLeave(c.req.raw, c.env, c.req.param('id')));
app.post('/api/rooms/:id/invite', async (c) =>
  handleRoomInvite(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/rooms/:id/delete', async (c) =>
  handleRoomDelete(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/rooms/:id/mute', async (c) => handleRoomMute(c.req.raw, c.env, c.req.param('id')));
// V1 aliases
app.post('/v1/rooms/create', async (c) => handleRoomCreate(c.req.raw, c.env));
app.get('/v1/rooms/active', async (c) => handleRoomsActive(c.req.raw, c.env));
app.get('/v1/rooms/:id', async (c) => handleRoomInfo(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/rooms/:id/join', async (c) => handleRoomJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/rooms/:id/leave', async (c) => handleRoomLeave(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/rooms/:id/invite', async (c) =>
  handleRoomInvite(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/rooms/:id/delete', async (c) =>
  handleRoomDelete(c.req.raw, c.env, c.req.param('id')),
);

// ─── Adaptive Streaming Router ──────────────────────────────────────
app.get('/api/live/route/status/:streamId', async (c) =>
  handleStreamRouteStatus(c.req.raw, c.env, c.req.param('streamId')),
);
app.get('/api/live/route/estimate', async (c) => handleRouteEstimate(c.req.raw, c.env));
app.post('/api/live/route/switch', async (c) => handleRouteSwitch(c.req.raw, c.env));

// V1 router routes
app.get('/v1/live/route/status/:streamId', async (c) =>
  handleStreamRouteStatus(c.req.raw, c.env, c.req.param('streamId')),
);
app.get('/v1/live/route/estimate', async (c) => handleRouteEstimate(c.req.raw, c.env));
app.post('/v1/live/route/switch', async (c) => handleRouteSwitch(c.req.raw, c.env));

// ─── Private / Token-Gated Streaming ────────────────────────────────
app.post('/api/live/private/configure', async (c) =>
  handlePrivateStreamConfigure(c.req.raw, c.env),
);
app.post('/api/live/private/join', async (c) => handlePrivateStreamJoin(c.req.raw, c.env));
app.get('/api/live/private/config/:streamId', async (c) =>
  handlePrivateStreamConfig(c.req.raw, c.env, c.req.param('streamId')),
);
app.delete('/api/live/private/revoke/:streamId', async (c) =>
  handlePrivateStreamRevoke(c.req.raw, c.env, c.req.param('streamId')),
);
app.post('/api/live/private/rotate/:streamId', async (c) =>
  handlePrivateStreamRotate(c.req.raw, c.env, c.req.param('streamId')),
);
app.get('/api/live/private/viewers/:streamId', async (c) =>
  handlePrivateStreamViewers(c.req.raw, c.env, c.req.param('streamId')),
);
app.post('/api/live/private/allowlist', async (c) =>
  handlePrivateStreamAllowlist(c.req.raw, c.env),
);

// V1 private stream routes
app.post('/v1/live/private/configure', async (c) => handlePrivateStreamConfigure(c.req.raw, c.env));
app.post('/v1/live/private/join', async (c) => handlePrivateStreamJoin(c.req.raw, c.env));
app.get('/v1/live/private/config/:streamId', async (c) =>
  handlePrivateStreamConfig(c.req.raw, c.env, c.req.param('streamId')),
);
app.delete('/v1/live/private/revoke/:streamId', async (c) =>
  handlePrivateStreamRevoke(c.req.raw, c.env, c.req.param('streamId')),
);
app.post('/v1/live/private/rotate/:streamId', async (c) =>
  handlePrivateStreamRotate(c.req.raw, c.env, c.req.param('streamId')),
);
app.get('/v1/live/private/viewers/:streamId', async (c) =>
  handlePrivateStreamViewers(c.req.raw, c.env, c.req.param('streamId')),
);
app.post('/v1/live/private/allowlist', async (c) => handlePrivateStreamAllowlist(c.req.raw, c.env));

// V1 versions
app.get('/v1/live/now', async (c) => handleLiveNow(c.req.raw, c.env));
app.get('/v1/live/upcoming', async (c) => handleLiveUpcoming(c.req.raw, c.env));
app.get('/v1/live/sources', async (c) => handleLiveSources(c.req.raw, c.env));
app.post('/v1/live/go-live', async (c) => handleGoLive(c.req.raw, c.env));
app.post('/v1/live/stop', async (c) => handleStopLive(c.req.raw, c.env));
app.post('/v1/live/schedule', async (c) => handleScheduleStream(c.req.raw, c.env));
app.get('/v1/live/chat/:id/messages', async (c) =>
  handleLiveChatMessages(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/live/chat/:id/message', async (c) =>
  handleLiveChatSend(c.req.raw, c.env, c.req.param('id')),
);
app.get('/v1/live/creators/:id', async (c) =>
  handleCreatorLiveProfile(c.req.raw, c.env, c.req.param('id')),
);
app.get('/v1/live/viewers/:id', async (c) =>
  handleLiveViewersSSE(c.req.raw, c.env, c.req.param('id')),
);
app.get('/v1/live/:id', async (c) => handleLiveDetails(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/live/:id/tip', async (c) => handleLiveTip(c.req.raw, c.env, c.req.param('id')));

// ─── API: Video Aggregator (cross-platform creator following) ──────────
import { videoAggregator } from './routes/video-aggregator';

app.route('/api/video/aggregator', videoAggregator);

// ─── API: Video Bridges (per-platform content endpoints) ───────────────
import { videoBridges } from './routes/video-bridges';

app.route('/api/video/bridges', videoBridges);

// ─── API: Unified Video Feed (all platforms, zero-cost hosting) ──────────
import unifiedVideoFeed from './routes/unified-video-feed';

app.route('/api/video/unified-feed', unifiedVideoFeed);

// ─── API: Video Hub (categorized video discovery across all sources) ───
app.route('/api/video', videoHub);

// ─── API: Zora Video NFTs (mint, collect, tip, announce) ─────────────────
app.route('/api/zora/video', zoraVideoRoutes);

// ─── API: Zora Third-Party Compatibility Layer ───────────────────────────
// Coins deployed through ZoraFactory are Zora-native. These endpoints expose
// data in Zora's API format so any Zora-integrated app can discover and
// interact with DegenFeed creator coins without changes.
app.route('/api/zora/compat', zoraCompatRoutes);
app.route('/v1/zora/compat', zoraCompatRoutes);

// ─── API: DegenFeed Multi-type Streaming (solo, spaces, collab, coin-launch) ───
app.route('/api/streams', streams);
app.route('/v1/streams', streams);

// ─── API: Bluesky Feed Generator (DegenFeed Live) ──────────
// feedGen route handled by bluesky-feed-generator import below
// app.route("/api/bsky-feed", feedGen);

// ─── WebSocket: Token real-time updates ────────────────────
app.get('/ws/token/:address', async (c) => {
  // SSE fallback: check for text/event-stream Accept header
  const accept = c.req.header('accept');
  if (accept?.includes('text/event-stream')) {
    return handleTokenSSE(c.req.raw, c.env);
  }
  // WebSocket upgrade
  return handleTokenWebSocket(c.req.raw, c.env);
});

// ─── API: Cross-Platform Registration ──────────────────────
app.all('/api/register-platform', async (c) =>
  withSession(c, () => handleRegisterPlatform(c.req.raw, c.env)),
);
app.get('/api/register-platform/status', async (c) =>
  handleRegisterPlatformStatus(c.req.raw, c.env),
);
app.get('/api/register-platform/bluesky-pool', async (c) =>
  handleBlueskyPoolStats(c.req.raw, c.env),
);

// ─── API: Concierge Registration (register-all) ──────────────
app.route('/api/register', registerAll);
app.route('/api/feddy', feddyCommunities);

// ─── V1: Cross-Platform Registration ─────────────────────
app.post('/v1/register-platform', async (c) =>
  withSession(c, () => handleRegisterPlatform(c.req.raw, c.env)),
);
app.get('/v1/register-platform/status', async (c) =>
  handleRegisterPlatformStatus(c.req.raw, c.env),
);
app.get('/v1/register-platform/bluesky-pool', async (c) =>
  handleBlueskyPoolStats(c.req.raw, c.env),
);

// ─── V1: Concierge Registration (register-all) ────────────
app.route('/v1/register', registerAll);

// ─── API: Permanence (Arweave/IPFS) ───────────────────────
app.post('/api/permanence/store', async (c) =>
  withSession(c, () => handlePermanenceStore(c.req.raw, c.env)),
);
app.get('/api/permanence/verify/:hash', async (c) =>
  handlePermanenceVerify(c.req.raw, c.env, c.req.param('hash')),
);
app.post('/api/permanence/anchor', async (c) =>
  withSession(c, () => handlePermanenceAnchor(c.req.raw, c.env)),
);

// ─── API: RMI ──────────────────────────────────────────────
app.all('/api/rmi/news/headlines', async (c) => handleRmiHeadlines(c.req.raw, c.env));
app.all('/api/rmi/news/sources', async (c) => handleRmiSources(c.req.raw, c.env));
app.all('/api/rmi/news/sentiment', async (c) => handleRmiSentiment(c.req.raw, c.env));
app.all('/api/rmi/news/stats', async (c) => handleRmiStats(c.req.raw, c.env));
app.all('/api/rmi/health', async (c) => handleRmiHealth(c.req.raw, c.env));
app.all('/api/rmi/news', async (c) => handleRmiNews(c.req.raw, c.env));
app.all('/api/rmi/news/*', async (c) => handleRmiNews(c.req.raw, c.env));

// ─── API: Discover ─────────────────────────────────────────
app.all('/api/discover', async (c) => handleDiscover(c.req.raw, c.env));
app.get('/api/discover/trending', async (c) => handleDiscoverTrending(c.req.raw, c.env));
app.get('/api/discover/communities', async (c) => handleDiscoverCommunities(c.req.raw, c.env));
app.get('/api/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));
app.get('/api/discover/topics', async (c) => handleDiscoverTopics(c.req.raw, c.env));
app.get('/api/discover/featured', async (c) => handleDiscoverFeatured(c.req.raw, c.env));
app.get('/api/discover/new', async (c) => handleDiscoverNew(c.req.raw, c.env));

// ─── API: Recommendations ─────────────────────────────────────
app.get('/api/recommendations/videos', async (c) => handleVideoRecommendations(c.req.raw, c.env));
app.get('/api/recommendations/shorts', async (c) => handleShortsRecommendations(c.req.raw, c.env));
app.get('/api/recommendations/streams', async (c) => handleStreamRecommendations(c.req.raw, c.env));
app.get('/api/recommendations/related', async (c) =>
  handleRelatedRecommendations(c.req.raw, c.env),
);
app.get('/api/recommendations/trending', async (c) => handlePersonalizedTrending(c.req.raw, c.env));
app.get('/api/recommendations/discover', async (c) =>
  handleDiscoverRecommendations(c.req.raw, c.env),
);
app.post('/api/recommendations/interaction', async (c) =>
  handleRecordInteraction(c.req.raw, c.env),
);

// ─── API: Push ─────────────────────────────────────────────
app.all('/api/push/subscribe', async (c) =>
  withSession(c, () => handlePushSubscribe(c.req.raw, c.env)),
);
app.all('/api/push/send', async (c) => handlePushSend(c.req.raw, c.env));

// ─── API: Newsletter ───────────────────────────────────────
app.all('/api/newsletter/subscribe', async (c) => handleNewsletterSubscribe(c.req.raw, c.env));
app.all('/api/newsletter/status', async (c) => handleNewsletterStatus(c.req.raw, c.env));
app.all('/api/newsletter/digest', async (c) => handleNewsletterDigest(c.req.raw, c.env));
app.all('/api/newsletter/digest/*', async (c) => handleNewsletterDigest(c.req.raw, c.env));

// ─── API: Newsletter Send (SendGrid/Mailgun/SMTP) ──────────
app.post('/api/newsletter/send', async (c) => handleNewsletterSend(c.req.raw, c.env));
app.get('/api/newsletter/subscribers', async (c) =>
  handleNewsletterSubscribersList(c.req.raw, c.env),
);
app.delete('/api/newsletter/subscriber', async (c) =>
  handleNewsletterSubscriberRemove(c.req.raw, c.env),
);
app.post('/api/newsletter/draft', async (c) => handleNewsletterCreateDraft(c.req.raw, c.env));
app.post('/api/newsletter/test', async (c) => handleNewsletterSendTest(c.req.raw, c.env));

// ─── API: Newsletter Bridge (Substack/Ghost) ───────────────
app.post('/api/newsletter/bridge/connect', async (c) =>
  handleNewsletterBridgeConnect(c.req.raw, c.env),
);
app.delete('/api/newsletter/bridge/disconnect', async (c) =>
  handleNewsletterBridgeDisconnect(c.req.raw, c.env),
);
app.get('/api/newsletter/bridge/list', async (c) => handleNewsletterBridgeList(c.req.raw, c.env));
app.post('/api/newsletter/bridge/poll', async (c) => handleNewsletterBridgePoll(c.req.raw, c.env));
app.post('/api/newsletter/bridge/auto-poll', async (c) =>
  handleNewsletterBridgeAutoPoll(c.req.raw, c.env),
);
app.get('/api/newsletter/bridge/stats', async (c) => handleNewsletterBridgeStats(c.req.raw, c.env));

// ─── API: Ghost CMS Headless ──────────────────────────────
app.get('/api/ghost/posts', async (c) => handleGhostPosts(c.req.raw, c.env));
app.get('/api/ghost/posts/:slug', async (c) => handleGhostPostBySlug(c.req.raw, c.env));
app.post('/api/ghost/posts', async (c) => handleGhostPostCreate(c.req.raw, c.env));
app.post('/api/ghost/posts/:id/tip', async (c) => handleGhostTip(c.req.raw, c.env));
app.post('/api/ghost/posts/:id/cross-post', async (c) => handleGhostCrossPost(c.req.raw, c.env));
app.post('/api/ghost/newsletter/send', async (c) => handleGhostNewsletterSend(c.req.raw, c.env));
app.post('/api/ghost/subscribe', async (c) => handleGhostSubscribe(c.req.raw, c.env));
app.post('/api/ghost/unsubscribe', async (c) => handleGhostUnsubscribe(c.req.raw, c.env));
app.get('/api/ghost/subscribers', async (c) => handleGhostSubscribers(c.req.raw, c.env));

// ─── API: Mirror.xyz Bridge ──────────────────────────────
app.post('/api/mirror/publish', async (c) => handleMirrorPublish(c.req.raw, c.env));
app.get('/api/mirror/articles', async (c) => handleMirrorArticles(c.req.raw, c.env));
app.get('/api/mirror/articles/:txId', async (c) => handleMirrorArticleByTxId(c.req.raw, c.env));
app.post('/api/mirror/import', async (c) => handleMirrorImport(c.req.raw, c.env));
app.get('/api/mirror/trending', async (c) => handleMirrorTrending(c.req.raw, c.env));
app.get('/api/mirror/search', async (c) => handleMirrorSearch(c.req.raw, c.env));

// ─── API: Paragraph.xyz Bridge ───────────────────────────
app.post('/api/paragraph/publish', async (c) => handleParagraphPublish(c.req.raw, c.env));
app.get('/api/paragraph/articles/:fid', async (c) =>
  handleParagraphArticlesByFid(c.req.raw, c.env),
);
app.get('/api/paragraph/articles', async (c) => handleParagraphArticles(c.req.raw, c.env));
app.get('/api/paragraph/trending', async (c) => handleParagraphTrending(c.req.raw, c.env));
app.post('/api/paragraph/import', async (c) => handleParagraphImport(c.req.raw, c.env));
app.post('/api/paragraph/subscribe', async (c) => handleParagraphSubscribe(c.req.raw, c.env));
app.get('/api/paragraph/newsletter/stats', async (c) =>
  handleParagraphNewsletterStats(c.req.raw, c.env),
);
app.get('/api/paragraph/search', async (c) => handleParagraphSearch(c.req.raw, c.env));

// ─── API: Creator Newsletter (EmailEngine) ────────────────
app.post('/api/newsletter/creator/send', async (c) =>
  handleCreatorNewsletterSend(c.req.raw, c.env),
);
app.get('/api/newsletter/creator/subscribers', async (c) =>
  handleCreatorNewsletterSubscribers(c.req.raw, c.env),
);
app.post('/api/newsletter/creator/subscribe', async (c) =>
  handleCreatorNewsletterSubscribe(c.req.raw, c.env),
);
app.delete('/api/newsletter/creator/subscribe', async (c) =>
  handleCreatorNewsletterUnsubscribe(c.req.raw, c.env),
);
app.get('/api/newsletter/creator/count', async (c) =>
  handleCreatorNewsletterCount(c.req.raw, c.env),
);
app.get('/api/newsletter/creator/stats/*', async (c) =>
  handleCreatorNewsletterStats(c.req.raw, c.env),
);
app.post('/api/newsletter/creator/webhook/mailgun', async (c) =>
  handleMailgunWebhook(c.req.raw, c.env),
);
app.get('/api/newsletter/creator/health', async (c) =>
  handleCreatorNewsletterHealth(c.req.raw, c.env),
);

// ─── API: Discord Integration ─────────────────────────────
app.post('/api/discord/connect', async (c) => handleDiscordConnect(c.req.raw, c.env));
app.post('/api/discord/channel/announce', async (c) =>
  handleDiscordChannelAnnounce(c.req.raw, c.env),
);
app.get('/api/discord/channels', async (c) => handleDiscordChannelsList(c.req.raw, c.env));
app.delete('/api/discord/disconnect', async (c) => handleDiscordDisconnect(c.req.raw, c.env));
app.post('/api/discord/bridge', async (c) => handleDiscordBridgeMessage(c.req.raw, c.env));
app.get('/api/discord/oauth', async (c) => handleDiscordOAuth(c.req.raw, c.env));
app.get('/api/discord/callback', async (c) => handleDiscordOAuthCallback(c.req.raw, c.env));
app.get('/api/discord/guilds', async (c) => handleDiscordGuilds(c.req.raw, c.env));
app.post('/api/discord/bridge/enable', async (c) => handleDiscordBridgeEnable(c.req.raw, c.env));
app.post('/api/discord/community/create', async (c) =>
  handleDiscordCommunityCreate(c.req.raw, c.env),
);
app.get('/api/discord/community/:symbol', async (c) =>
  handleDiscordCommunityInfo(c.req.raw, c.env),
);
app.get('/api/discord/connection', async (c) => handleDiscordConnectionStatus(c.req.raw, c.env));
app.delete('/api/discord/connection', async (c) => handleDiscordDisconnectOAuth(c.req.raw, c.env));

// ─── API: Telegram Bot Integration ────────────────────────
app.post('/api/telegram/webhook', async (c) => handleTelegramWebhook(c.req.raw, c.env));
app.get('/api/telegram/link', async (c) => handleTelegramGenerateLink(c.req.raw, c.env));
app.post('/api/telegram/send', async (c) => handleTelegramSend(c.req.raw, c.env));
app.get('/api/telegram/bot-info', async (c) => handleTelegramBotInfo(c.req.raw, c.env));
app.post('/api/telegram/link-account', async (c) => handleTelegramLinkAccount(c.req.raw, c.env));
app.get('/api/telegram/linked', async (c) => handleTelegramGetLinked(c.req.raw, c.env));
app.delete('/api/telegram/link-account', async (c) =>
  handleTelegramUnlinkAccount(c.req.raw, c.env),
);
app.post('/api/telegram/auth', async (c) => handleTelegramAuth(c.req.raw, c.env));
app.get('/api/telegram/chats', async (c) => handleTelegramChats(c.req.raw, c.env));
app.get('/api/telegram/groups', async (c) => handleTelegramGetGroups(c.req.raw, c.env));
app.post('/api/telegram/groups/:groupId/link', async (c) =>
  handleTelegramGroupLink(c.req.raw, c.env, c.req.param('groupId')),
);

// ─── API: Matrix Integration ───────────────────────────────
app.post('/api/matrix/connect', async (c) => handleMatrixConnect(c.req.raw, c.env));
app.post('/api/matrix/send', async (c) => handleMatrixSendMessage(c.req.raw, c.env));
app.get('/api/matrix/rooms', async (c) => handleMatrixRoomsList(c.req.raw, c.env));
app.delete('/api/matrix/disconnect', async (c) => handleMatrixDisconnect(c.req.raw, c.env));
app.post('/api/matrix/bridge', async (c) => handleMatrixBridgeMessages(c.req.raw, c.env));

// ─── API: Webhook System ──────────────────────────────────
app.post('/api/webhooks/create', async (c) => handleWebhookCreate(c.req.raw, c.env));
app.post('/api/webhooks/test', async (c) => handleWebhookTest(c.req.raw, c.env));
app.get('/api/webhooks', async (c) => handleWebhookList(c.req.raw, c.env));
app.delete('/api/webhooks', async (c) => handleWebhookDelete(c.req.raw, c.env));
app.post('/api/webhooks/trigger', async (c) => handleWebhookTrigger(c.req.raw, c.env));

// ─── API: GitHub Integration ─────────────────────────────
app.post('/api/github/connect', async (c) => handleGitHubConnect(c.req.raw, c.env));
app.post('/api/github/repo-activity', async (c) => handleGitHubRepoActivity(c.req.raw, c.env));
app.delete('/api/github/disconnect', async (c) => handleGitHubDisconnect(c.req.raw, c.env));
app.get('/api/github/accounts', async (c) => handleGitHubConnectedAccounts(c.req.raw, c.env));
app.post('/api/github/bridge', async (c) => handleGitHubBridgeActivity(c.req.raw, c.env));

// ─── API: Digest (Daily) ───────────────────────────────────
app.all('/api/digest/today', async (c) => handleDigestToday(c.req.raw, c.env));
app.all('/api/digest/yesterday', async (c) => handleDigestYesterday(c.req.raw, c.env));
app.all('/api/digest/format', async (c) => handleDigestFormat(c.req.raw, c.env));
app.all('/api/digest/subscribe-email', async (c) => handleDigestSubscribeEmail(c.req.raw, c.env));
app.all('/api/digest/unsubscribe-email', async (c) =>
  handleDigestUnsubscribeEmail(c.req.raw, c.env),
);
app.all('/api/digest/status', async (c) => handleDigestStatus(c.req.raw, c.env));

// ─── API: News (Intelligent Aggregation) ─────────────────
// ── Newsletter Creator Routes ──
app.post('/api/news/newsletter/create', async (c) =>
  handleNewsletterCreatorCreate(c.req.raw, c.env),
);
app.get('/api/news/newsletter/mine', async (c) => handleNewsletterCreatorMine(c.req.raw, c.env));
app.post('/api/news/newsletter/:id/issue', async (c) =>
  handleNewsletterCreatorIssue(c.req.raw, c.env),
);
app.get('/api/news/newsletter/issues', async (c) =>
  handleNewsletterCreatorIssues(c.req.raw, c.env),
);
app.post('/api/news/newsletter/subscribe', async (c) =>
  handleNewsletterCreatorSubscribe(c.req.raw, c.env),
);

app.all('/api/news/feed', async (c) => handleNewsFeed(c.req.raw, c.env));
app.all('/api/news/trending', async (c) => handleNewsTrending(c.req.raw, c.env));
app.all('/api/news/category/:category', async (c) => handleNewsCategory(c.req.raw, c.env));
app.all('/api/news/story/:storyId', async (c) => handleNewsStory(c.req.raw, c.env));
app.all('/api/news/search', async (c) => handleNewsSearch(c.req.raw, c.env));
app.all('/api/news/sources', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
app.all('/api/news/sources/health', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
app.all('/api/news/sources/refresh', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
app.all('/api/news/sources/stats', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
app.all('/api/news/preferences', async (c) => handleNewsPreferences(c.req.raw, c.env));
app.all('/api/news/digest/preview', async (c) => handleNewsDigestPreview(c.req.raw, c.env));
app.all('/api/news/digest/subscribe', async (c) => handleNewsDigestSubscribe(c.req.raw, c.env));
// ── New personalized/digest endpoints ──
app.all('/api/news/for-you', async (c) => handleNewsForYou(c.req.raw, c.env));
app.all('/api/news/hot', async (c) => handleNewsHot(c.req.raw, c.env));
app.all('/api/news/deep-dives', async (c) => handleNewsDeepDives(c.req.raw, c.env));
app.all('/api/news/quick-reads', async (c) => handleNewsQuickReads(c.req.raw, c.env));
app.all('/api/news/protocol/:protocol', async (c) => handleNewsProtocol(c.req.raw, c.env));
app.all('/api/news/token/:token', async (c) => handleNewsToken(c.req.raw, c.env));
app.all('/api/news/author/:author', async (c) => handleNewsAuthor(c.req.raw, c.env));
app.all('/api/news/mark-read', async (c) => handleNewsMarkRead(c.req.raw, c.env));
app.all('/api/news/reading-list', async (c) => handleReadingList(c.req.raw, c.env));
app.all('/api/news/reading-list/:id', async (c) => handleReadingListToggle(c.req.raw, c.env));

// ─── API: Gamification (Streaks / Achievements / XP / Social Proof) ──
app.all('/api/gamification/streak', async (c) => handleStreakCheck(c.req.raw, c.env));
app.all('/api/gamification/streak/leaderboard', async (c) =>
  handleStreakLeaderboard(c.req.raw, c.env),
);
app.all('/api/gamification/achievements', async (c) => handleAchievements(c.req.raw, c.env));
app.all('/api/gamification/achievements/check', async (c) =>
  handleAchievementCheck(c.req.raw, c.env),
);
app.all('/api/gamification/challenges/today', async (c) => handleChallengesToday(c.req.raw, c.env));
app.all('/api/gamification/challenges/progress', async (c) =>
  handleChallengeProgress(c.req.raw, c.env),
);
app.all('/api/gamification/xp', async (c) => handleXp(c.req.raw, c.env));
app.all('/api/gamification/xp/award', async (c) => handleXpAward(c.req.raw, c.env));
app.all('/api/gamification/social-proof', async (c) => handleSocialProof(c.req.raw, c.env));
app.all('/api/gamification/activity', async (c) => handleActivityRecord(c.req.raw, c.env));
app.all('/api/gamification/activity/recent', async (c) => handleRecentActivity(c.req.raw, c.env));

// ─── API: DAO Activity Feed, Notifications & Subscribe ────
app.get('/api/dao/:daoId/feed', async (c) => {
  const { handleDaoActivity } = await import('./routes/dao-activity');
  return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
});
app.post('/api/dao/:daoId/activity', async (c) => {
  const { handleDaoActivity } = await import('./routes/dao-activity');
  return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
});
app.get('/api/dao/:daoId/realtime', async (c) => {
  const { handleDaoActivity } = await import('./routes/dao-activity');
  return jsonResponse({ poll: true, daoId: c.req.param('daoId') });
});
app.get('/api/dao/:daoId/notifications', async (c) => {
  const { handleDaoActivity } = await import('./routes/dao-activity');
  return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
});
app.post('/api/dao/:daoId/notifications/read', async (c) => {
  return jsonResponse({ ok: true });
});
app.post('/api/dao/:daoId/subscribe', async (c) => {
  return jsonResponse({ ok: true });
});
app.get('/api/dao/:daoId/subscribe/status', async (c) => {
  return jsonResponse({ subscribed: false });
});

// ─── API: Deploy ──────────────────────────────────────────
import { handleDeployRequest, handleDeployStatus } from './routes/deploy';

app.all('/api/deploy/request', async (c) => handleDeployRequest(c.req.raw, c.env));
app.all('/api/deploy/status', async (c) => handleDeployStatus(c.req.raw, c.env));

// ─── API: Trending Sidebar ──────────────────────────────────
import { handleTrendingSidebar } from './routes/trending-sidebar';

app.get('/api/trending/sidebar', async (c) => handleTrendingSidebar(c.req.raw, c.env));

// ─── API: Trending Scraper & Aggregation ────────────────────
import {
  handleCrossTrending,
  handleTrendingAggregated,
  handleTrendingNow,
  handleTrendingPerPlatform,
} from './routes/trending';

app.get('/api/trending/aggregated', async (c) => handleTrendingAggregated(c.req.raw, c.env));
app.get('/api/trending/per-platform', async (c) => handleTrendingPerPlatform(c.req.raw, c.env));
app.get('/api/trending/now', async (c) => handleTrendingNow(c.req.raw, c.env));
app.get('/api/trending/cross-network', async (c) => handleCrossTrending(c.req.raw, c.env));

// ─── API: Search ────────────────────────────────────────────
app.all('/api/search/identity', async (c) => handleSearchIdentity(c.req.raw, c.env));
app.all('/api/search/index', async (c) => handleSearchIndex(c.req.raw, c.env));
app.all('/api/search/autocomplete', async (c) => handleSearchAutocomplete(c.req.raw, c.env));
app.all('/api/search/creators', async (c) => handleSearchCreators(c.req.raw, c.env));
app.all('/api/search/coins', async (c) => handleSearchCoins(c.req.raw, c.env));
app.all('/api/search/communities', async (c) => handleSearchCommunities(c.req.raw, c.env));
app.all('/api/search/trending', async (c) => handleSearchTrending(c.req.raw, c.env));
app.all('/api/search', async (c) => handleSearch(c.req.raw, c.env));

// ─── API: Content Library ────────────────────────────────────
import {
  handleDeleteContentLibraryItem,
  handleGetContentLibraryItem,
  handleGetContentLicense,
  handleGetContentMonetization,
  handleGetContentUsage,
  handleListContentLibrary,
  handleSetContentLicense,
  handleSetContentMonetization,
  handleSyncAllContentEngagement,
  handleSyncContentEngagement,
  handleUpdateContentLibraryItem,
} from './routes/content-library-routes';

app.all('/api/content/library/sync-all', async (c) =>
  handleSyncAllContentEngagement(c.req.raw, c.env),
);
app.all('/api/content/library', async (c) => handleListContentLibrary(c.req.raw, c.env));
app.all('/api/content/library/:contentId/sync', async (c) =>
  handleSyncContentEngagement(c.req.raw, c.env),
);
app.all('/api/content/library/:contentId/license', async (c) => {
  if (c.req.method === 'POST') return handleSetContentLicense(c.req.raw, c.env);
  return handleGetContentLicense(c.req.raw, c.env);
});
app.all('/api/content/library/:contentId/monetization', async (c) => {
  if (c.req.method === 'POST') return handleSetContentMonetization(c.req.raw, c.env);
  return handleGetContentMonetization(c.req.raw, c.env);
});
app.all('/api/content/library/:contentId/usage', async (c) =>
  handleGetContentUsage(c.req.raw, c.env),
);
app.all('/api/content/library/:contentId', async (c) => {
  if (c.req.method === 'PUT') return handleUpdateContentLibraryItem(c.req.raw, c.env);
  if (c.req.method === 'DELETE') return handleDeleteContentLibraryItem(c.req.raw, c.env);
  return handleGetContentLibraryItem(c.req.raw, c.env);
});

// ─── API: Content Import/Export ──────────────────────────────
import {
  handleImportTwitter as handleContentImportTwitter,
  handleExportContentJson,
  handleExportContentMarkdown,
  handleExportContentOpml,
  handleImportMedium,
  handleImportRss,
  handleImportStatus,
  handleImportSubstack,
  handleImportYouTube,
} from './routes/content-import';

app.all('/api/content/import/youtube', async (c) => handleImportYouTube(c.req.raw, c.env));
app.all('/api/content/import/medium', async (c) => handleImportMedium(c.req.raw, c.env));
app.all('/api/content/import/substack', async (c) => handleImportSubstack(c.req.raw, c.env));
app.all('/api/content/import/twitter', async (c) => handleContentImportTwitter(c.req.raw, c.env));
app.all('/api/content/import/rss', async (c) => handleImportRss(c.req.raw, c.env));
app.all('/api/content/import/status/:id', async (c) => handleImportStatus(c.req.raw, c.env));
app.all('/api/content/export', async (c) => handleExportContentJson(c.req.raw, c.env));
app.all('/api/content/export/markdown', async (c) => handleExportContentMarkdown(c.req.raw, c.env));
app.all('/api/content/export/opml', async (c) => handleExportContentOpml(c.req.raw, c.env));

// ─── API: Content Syndication ───────────────────────────────
import {
  handleCanSyndicate,
  handleExecuteSyndication,
  handleGetSyndicationHistory,
  handleGetSyndicationRules,
  handleListSyndicationQueue,
  handleQueueSyndication,
  handleSetSyndicationRules,
  handleUpdateProtocolRule,
} from './routes/content-syndication-routes';

app.all('/api/content/syndication/rules/:protocol', async (c) =>
  handleUpdateProtocolRule(c.req.raw, c.env),
);
app.all('/api/content/syndication/rules', async (c) => {
  if (c.req.method === 'POST') return handleSetSyndicationRules(c.req.raw, c.env);
  return handleGetSyndicationRules(c.req.raw, c.env);
});
app.all('/api/content/syndication/queue/:queueId', async (c) =>
  handleExecuteSyndication(c.req.raw, c.env),
);
app.all('/api/content/syndication/queue', async (c) => {
  if (c.req.method === 'POST') return handleQueueSyndication(c.req.raw, c.env);
  return handleListSyndicationQueue(c.req.raw, c.env);
});
app.all('/api/content/syndication/history', async (c) =>
  handleGetSyndicationHistory(c.req.raw, c.env),
);
app.all('/api/content/syndication/can/:protocol', async (c) =>
  handleCanSyndicate(c.req.raw, c.env),
);

// ─── API: Content Resolution (df:// URIs) ───────────────────
app.all('/api/content/*', async (c) => handleContentResolve(c.req.raw, c.env));

// ─── API: Embed ──────────────────────────────────────────────
app.all('/api/embed/resolve', async (c) => handleEmbedResolve(c.req.raw, c.env));
app.all('/api/embed/*', async (c) => handleEmbedPost(c.req.raw, c.env));

// ─── API: Frame ─────────────────────────────────────────────
app.all('/api/frame/resolve', async (c) => handleFrameResolve(c.req.raw, c.env));
app.all('/api/frame/action', async (c) => handleFrameAction(c.req.raw, c.env));

// ─── API: Documentation (OpenAPI spec + Swagger UI) ──────
app.get('/api/docs/openapi.json', async (c) => handleOpenApiJson(c.req.raw, c.env));
app.get('/api/docs', async (c) => handleApiDocs(c.req.raw));

// ─── V1: Documentation (versioned paths) ─────────────────
app.get('/v1/docs/openapi.json', async (c) => handleOpenApiJson(c.req.raw, c.env));
app.get('/v1/docs', async (c) => handleApiDocs(c.req.raw));

import blueskyFeedGen from './routes/bluesky-feed-generator';
// ─── API: Farcaster Frames ─────────────────────────────────
import farcasterFrames from './routes/farcaster-frames';

app.route('/api/farcaster/frames', farcasterFrames);
app.route('/v1/farcaster/frames', farcasterFrames);

// ─── Farcaster Frame Manifest (/.well-known/farcaster.json) ──
import { DEFAULT_MANIFEST } from './lib/farcaster-manifest';

app.get('/.well-known/farcaster.json', async (_c) => {
  return new Response(JSON.stringify(DEFAULT_MANIFEST, null, 2), {
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
});
app.get('/v1/.well-known/farcaster.json', async (_c) => {
  return new Response(JSON.stringify(DEFAULT_MANIFEST, null, 2), {
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
});

// ─── API: Features ─────────────────────────────────────────
app.all('/api/features', async (c) => handleFeatures(c.req.raw, c.env));

// ─── API: Communities (cross-protocol) ──────────────────────
app.post('/api/community', async (c) =>
  withSession(c, () => handleCommunityCreate(c.req.raw, c.env)),
);
app.get('/api/community/:name', async (c) =>
  handleCommunityGet(c.req.raw, c.env, c.req.param('name')),
);
app.get('/api/community/:name/feed', async (c) =>
  handleCommunityFeed(c.req.raw, c.env, c.req.param('name')),
);
app.post('/api/community/:name/join', async (c) =>
  withSession(c, () => handleCommunityJoin(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/api/communities', async (c) => handleCommunitiesList(c.req.raw, c.env));

// ─── API: Governance (DAOs) ───────────────────────────────
app.post('/api/community/:name/proposals', async (c) =>
  withSession(c, () => handleProposalCreate(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/api/community/:name/proposals', async (c) =>
  handleProposalsList(c.req.raw, c.env, c.req.param('name')),
);
app.post('/api/community/:name/proposals/:id/vote', async (c) =>
  withSession(c, () =>
    handleProposalVote(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
  ),
);
app.get('/api/community/:name/proposals/:id/results', async (c) =>
  handleProposalResults(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
);

// ─── API: DAO System ──────────────────────────────────────────
// Static routes before parameterized routes
app.get('/api/dao/mine', async (c) => handleDaoMine(c.req.raw, c.env));
app.get('/api/dao/discover', async (c) => handleDaoDiscover(c.req.raw, c.env));
app.get('/api/dao/activity/mine', async (c) => handleMyDaoActivity(c.req.raw, c.env));
app.post('/api/dao/create', async (c) => withSession(c, () => handleDaoCreate(c.req.raw, c.env)));

// Parameterized DAO routes
app.get('/api/dao/:daoId', async (c) => handleDaoGet(c.req.raw, c.env, c.req.param('daoId')));
app.put('/api/dao/:daoId', async (c) =>
  withSession(c, () => handleDaoUpdate(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/stats', async (c) =>
  handleDaoStats(c.req.raw, c.env, c.req.param('daoId')),
);
app.post('/api/dao/:daoId/join', async (c) =>
  withSession(c, () => handleDaoJoin(c.req.raw, c.env, c.req.param('daoId'))),
);
app.post('/api/dao/:daoId/leave', async (c) =>
  withSession(c, () => handleDaoLeave(c.req.raw, c.env, c.req.param('daoId'))),
);

// DAO activity feed
app.get('/api/dao/:daoId/activity', async (c) =>
  handleDaoActivity(c.req.raw, c.env, c.req.param('daoId')),
);

// DAO Proposals
app.post('/api/dao/:daoId/proposals', async (c) =>
  withSession(c, () => handleDaoProposalCreate(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/proposals', async (c) =>
  handleDaoProposalsList(c.req.raw, c.env, c.req.param('daoId')),
);
app.get('/api/dao/:daoId/proposals/:proposalId', async (c) =>
  handleDaoProposalGet(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
);
app.put('/api/dao/:daoId/proposals/:proposalId', async (c) =>
  withSession(c, () =>
    handleDaoProposalUpdate(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  ),
);
app.delete('/api/dao/:daoId/proposals/:proposalId', async (c) =>
  withSession(c, () =>
    handleDaoProposalDelete(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  ),
);
app.post('/api/dao/:daoId/proposals/:proposalId/vote', async (c) =>
  withSession(c, () =>
    handleDaoProposalVote(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  ),
);
app.get('/api/dao/:daoId/proposals/:proposalId/votes', async (c) =>
  handleDaoProposalVotes(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
);
app.get('/api/dao/:daoId/proposals/:proposalId/vote/me', async (c) =>
  handleDaoProposalMyVote(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
);
app.post('/api/dao/:daoId/proposals/:proposalId/queue', async (c) =>
  withSession(c, () =>
    handleDaoProposalQueue(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  ),
);
app.post('/api/dao/:daoId/proposals/:proposalId/execute', async (c) =>
  withSession(c, () =>
    handleDaoProposalExecute(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  ),
);

// DAO Delegation
app.post('/api/dao/:daoId/delegate', async (c) =>
  withSession(c, () => handleDaoDelegate(c.req.raw, c.env, c.req.param('daoId'))),
);
app.post('/api/dao/:daoId/revoke-delegation', async (c) =>
  withSession(c, () => handleDaoRevokeDelegation(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/delegation/mine', async (c) =>
  handleDaoDelegationMine(c.req.raw, c.env, c.req.param('daoId')),
);
app.get('/api/dao/:daoId/delegation/:address', async (c) =>
  handleDaoDelegationStatus(c.req.raw, c.env, c.req.param('daoId'), c.req.param('address')),
);
app.get('/api/dao/:daoId/delegates', async (c) =>
  handleDaoDelegatesTop(c.req.raw, c.env, c.req.param('daoId')),
);

// DAO Treasury
app.get('/api/dao/:daoId/treasury', async (c) =>
  handleDaoTreasuryOverview(c.req.raw, c.env, c.req.param('daoId')),
);
app.get('/api/dao/:daoId/treasury/transactions', async (c) =>
  handleDaoTreasuryTransactions(c.req.raw, c.env, c.req.param('daoId')),
);
app.post('/api/dao/:daoId/treasury/transfer', async (c) =>
  withSession(c, () => handleDaoTreasuryTransfer(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/treasury/streams', async (c) =>
  handleDaoTreasuryStreams(c.req.raw, c.env, c.req.param('daoId')),
);
app.delete('/api/dao/:daoId/treasury/streams/:streamId', async (c) =>
  withSession(c, () =>
    handleDaoTreasuryStreamDelete(c.req.raw, c.env, c.req.param('daoId'), c.req.param('streamId')),
  ),
);
app.get('/api/dao/:daoId/treasury/grants', async (c) =>
  handleDaoTreasuryGrants(c.req.raw, c.env, c.req.param('daoId')),
);
app.post('/api/dao/:daoId/treasury/grant/:grantId/milestone', async (c) =>
  withSession(c, () =>
    handleDaoTreasuryGrantMilestone(c.req.raw, c.env, c.req.param('daoId'), c.req.param('grantId')),
  ),
);

// ─── API: DAO Registry (static before parameterized) ──────
app.get('/api/dao/registry', async (c) => handleDaoRegistryList(c.req.raw, c.env));
app.post('/api/dao/registry', async (c) =>
  withSession(c, () => handleDaoRegistryRegister(c.req.raw, c.env)),
);

// ─── API: External DAO Integrations — Snapshot ─────────────
app.post('/api/dao/:daoId/snapshot/strategy', async (c) =>
  withSession(c, () => handleSnapshotStrategyGenerate(c.req.raw, c.env, c.req.param('daoId'))),
);
app.post('/api/dao/:daoId/snapshot/sync-proposal', async (c) =>
  withSession(c, () => handleSnapshotSyncProposal(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/snapshot/votes/:proposalId', async (c) =>
  handleSnapshotImportVotes(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
);
app.post('/api/dao/:daoId/snapshot/delegation-sync', async (c) =>
  withSession(c, () => handleDelegationSync(c.req.raw, c.env, c.req.param('daoId'))),
);

// ─── API: External DAO Integrations — Tally ────────────────
app.post('/api/dao/:daoId/tally/check', async (c) =>
  withSession(c, () => handleTallyCompatibilityCheck(c.req.raw, c.env, c.req.param('daoId'))),
);
app.post('/api/dao/:daoId/tally/register', async (c) =>
  withSession(c, () => handleTallyRegister(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/tally/status', async (c) =>
  handleTallyStatus(c.req.raw, c.env, c.req.param('daoId')),
);

// ─── API: External DAO Integrations — Defender ─────────────
app.post('/api/dao/:daoId/defender/setup', async (c) =>
  withSession(c, () => handleDefenderSetup(c.req.raw, c.env, c.req.param('daoId'))),
);
app.get('/api/dao/:daoId/defender/status', async (c) =>
  handleDefenderStatus(c.req.raw, c.env, c.req.param('daoId')),
);
app.post('/api/dao/:daoId/defender/sync', async (c) =>
  withSession(c, () => handleDefenderSync(c.req.raw, c.env, c.req.param('daoId'))),
);
app.delete('/api/dao/:daoId/defender', async (c) =>
  withSession(c, () => handleDefenderDisable(c.req.raw, c.env, c.req.param('daoId'))),
);

// ─── API: DAO Registry — Entry detail ───────────────────────
app.get('/api/dao/registry/:daoId', async (c) =>
  handleDaoRegistryGet(c.req.raw, c.env, c.req.param('daoId')),
);
app.post('/api/dao/registry/:daoId/link', async (c) =>
  withSession(c, () => handleDaoRegistryLink(c.req.raw, c.env, c.req.param('daoId'))),
);
app.post('/api/dao/registry/:daoId/verify', async (c) =>
  withSession(c, () => handleDaoRegistryVerify(c.req.raw, c.env, c.req.param('daoId'))),
);

// ─── API: Moderation ───────────────────────────────────────
app.get('/api/moderation/reports', (c) => handleListReports(c.req.raw, c.env));
app.post('/api/moderation/report', (c) => handleSubmitReport(c.req.raw, c.env));
app.post('/api/moderation/reports/:id/resolve', async (c) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return handleResolveReport(c.req.raw, c.env);
});
app.post('/api/moderation/reports/:id/remove', async (c) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return handleRemovePost(c.req.raw, c.env);
});
app.post('/api/moderation/ban', async (c) => {
  const result = await requireAdminFromSession(c.req.raw, c.env);
  if (result instanceof Response) return result;
  return handleBanUser(c.req.raw, c.env);
});
app.get('/api/moderation/stats', (c) => handleModerationStats(c.req.raw, c.env));
app.get('/api/moderation/banned', (c) => handleCheckBanned(c.req.raw, c.env));
app.all('/api/moderation/sync', (c) => handleBlockSync(c.req.raw, c.env));

// ─── API: Schedule ─────────────────────────────────────────
app.all('/api/schedule', (c) => handleSchedulePost(c.req.raw, c.env));
app.get('/api/scheduled', (c) => handleListScheduledPosts(c.req.raw, c.env));
app.put('/api/schedule/:id', async (c) =>
  handleUpdateScheduledPost(c.req.raw, c.env, c.req.param('id')),
);
app.delete('/api/schedule/:id', async (c) =>
  handleDeleteScheduledPost(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/schedule/:id/publish-now', async (c) =>
  handlePublishNow(c.req.raw, c.env, c.req.param('id')),
);

// ─── API: Connected Centralized Accounts ─────────────────────────
app.get('/api/accounts/connected', async (c) => handleListConnectedAccounts(c.req.raw, c.env));
app.post('/api/accounts/connect/:platform', async (c) =>
  handleConnectPlatform(c.req.raw, c.env, c.req.param('platform')),
);
app.get('/api/accounts/callback/:platform', async (c) =>
  handleOAuthCallback(c.req.raw, c.env, c.req.param('platform')),
);
app.delete('/api/accounts/disconnect/:platform', async (c) =>
  handleDisconnectPlatform(c.req.raw, c.env, c.req.param('platform')),
);
app.get('/api/accounts/status/:platform', async (c) =>
  handleAccountStatus(c.req.raw, c.env, c.req.param('platform')),
);
app.all('/api/accounts/connect/substack/email', async (c) =>
  handleSubstackEmailSetup(c.req.raw, c.env),
);

// ─── API: Cross-Post to Centralized Platforms ─────────────────────
app.post('/api/cross-post/medium', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'medium'),
);
app.post('/api/cross-post/substack', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'substack'),
);
app.post('/api/cross-post/youtube', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'youtube'),
);
app.post('/api/cross-post/tiktok', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'tiktok'),
);
app.post('/api/cross-post/instagram', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'instagram'),
);
app.post('/api/cross-post/linkedin', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'linkedin'),
);
app.post('/api/cross-post/reddit', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'reddit'),
);
app.post('/api/cross-post/pinterest', async (c) =>
  handleCrossPostCentralized(c.req.raw, c.env, 'pinterest'),
);

// ─── API: Platform Limits (for UI content adaptation) ─────────────
app.get('/api/cross-post/limits', async (_c) => {
  const { PLATFORM_LIMITS } = await import('./routes/cross-post-centralized');
  return jsonResponse({ limits: PLATFORM_LIMITS });
});

// ─── API: Audio Spaces ───────────────────────────────────────────
import {
  handleSpaceAcceptSpeaker,
  handleSpaceCreate,
  handleSpaceDetails,
  handleSpaceEnd,
  handleSpaceInviteSpeaker,
  handleSpaceJoin,
  handleSpaceLeave,
  handleSpaceMuteSpeaker,
  handleSpaceRaiseHand,
  handleSpaceReact,
  handleSpaceRecording,
  handleSpaceRemoveSpeaker,
  handleSpaceRequestSpeak,
  handleSpaceStart,
  handleSpacesLive,
  handleSpacesPast,
  handleSpacesTrending,
  handleSpacesUpcoming,
  handleSpaceTranscript,
} from './routes/spaces';

// Write routes first (no path params)
app.get('/api/spaces/live', async (c) => handleSpacesLive(c.req.raw, c.env));
app.get('/api/spaces/upcoming', async (c) => handleSpacesUpcoming(c.req.raw, c.env));
app.get('/api/spaces/past', async (c) => handleSpacesPast(c.req.raw, c.env));
app.get('/api/spaces/trending', async (c) => handleSpacesTrending(c.req.raw, c.env));
app.post('/api/spaces/create', async (c) => handleSpaceCreate(c.req.raw, c.env));

// Parameterized routes
app.get('/api/spaces/:id', async (c) => handleSpaceDetails(c.req.raw, c.env, c.req.param('id')));
app.post('/api/spaces/:id/start', async (c) =>
  handleSpaceStart(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/end', async (c) => handleSpaceEnd(c.req.raw, c.env, c.req.param('id')));
app.post('/api/spaces/:id/join', async (c) => handleSpaceJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/api/spaces/:id/leave', async (c) =>
  handleSpaceLeave(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/request-speak', async (c) =>
  handleSpaceRequestSpeak(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/invite-speaker', async (c) =>
  handleSpaceInviteSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/accept-speaker', async (c) =>
  handleSpaceAcceptSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/remove-speaker', async (c) =>
  handleSpaceRemoveSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/mute-speaker', async (c) =>
  handleSpaceMuteSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/raise-hand', async (c) =>
  handleSpaceRaiseHand(c.req.raw, c.env, c.req.param('id')),
);
app.post('/api/spaces/:id/react', async (c) =>
  handleSpaceReact(c.req.raw, c.env, c.req.param('id')),
);
app.get('/api/spaces/:id/recording', async (c) =>
  handleSpaceRecording(c.req.raw, c.env, c.req.param('id')),
);
app.all('/api/spaces/:id/transcript', async (c) =>
  handleSpaceTranscript(c.req.raw, c.env, c.req.param('id')),
);

// ─── API: Translate ─────────────────────────────────────────
app.post('/api/translate', async (c) => handleTranslate(c.req.raw, c.env));

// ─── API: Prices ────────────────────────────────────────────
app.all('/api/prices', async (c) => handlePrices(c.req.raw, c.env));

// ─── API: Reputation ───────────────────────────────────────
import {
  handleReputationEarn,
  handleReputationGet,
  handleReputationHistory,
  handleReputationLeaderboard,
  handleReputationSlash,
  handleReputationStake,
  handleReputationStakeResolve,
  handleReputationStakes,
} from './routes/reputation';

app.get('/api/reputation/leaderboard', async (c) => handleReputationLeaderboard(c.req.raw, c.env));
app.post('/api/reputation/earn', async (c) => handleReputationEarn(c.req.raw, c.env));
app.post('/api/reputation/slash', async (c) => handleReputationSlash(c.req.raw, c.env));
app.post('/api/reputation/stake', async (c) => handleReputationStake(c.req.raw, c.env));
app.post('/api/reputation/stake/resolve', async (c) =>
  handleReputationStakeResolve(c.req.raw, c.env),
);
// Parameterized routes (must be after static routes)
app.get('/api/reputation/:userId/history', async (c) =>
  handleReputationHistory(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/api/reputation/:userId/stakes', async (c) =>
  handleReputationStakes(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/api/reputation/:userId', async (c) =>
  handleReputationGet(c.req.raw, c.env, c.req.param('userId')),
);

// ═══════════════════════════════════════════════════════════
// V1 ROUTES — Stable, versioned public API
// ═══════════════════════════════════════════════════════════

// ─── V1: Shorts ─────────────────────────────────────────
app.get('/v1/shorts', async (c) => handleShortsFeed(c.req.raw, c.env));

// ─── V1: Feed ───────────────────────────────────────────
app.all('/v1/feed/home', async (c) => handleHomeFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/trending', async (c) => handleTrendingFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/health', async (c) => handleFeedHealth(c.req.raw, c.env));
app.all('/v1/feed/news', async (c) => handleNewsFeed(c.req.raw, c.env));
app.all('/v1/feed/reddit', async (c) => handleRedditFeed(c.req.raw, c.env));
app.all('/v1/feed/activitypub', async (c) => handleActivityPubFeed(c.req.raw, c.env));
app.all('/v1/feed/threads', async (c) => handleThreadsFeed(c.req.raw, c.env));
app.all('/v1/feed/farcaster', async (c) => handleFarcasterFeed(c.req.raw, c.env));
app.all('/v1/feed/rss', async (c) => handleRssFeed(c.req.raw, c.env));
app.all('/v1/feed/post/:postId/replies', async (c) =>
  handlePostReplies(c.req.raw, c.env, c.req.param('postId')),
);
app.all('/v1/feed/post/:postId', async (c) => {
  const postId = c.req.param('postId');
  if (c.req.query('format') === 'og') return handlePostOg(c.req.raw, c.env, postId);
  return handlePostById(c.req.raw, c.env, postId);
});
app.all('/v1/feed/funding', async (c) => handleFundingFeed(c.req.raw, c.env));
app.all('/v1/feed/top', async (c) => handleTopFeed(c.req.raw, c.env));
app.all('/v1/feed/alt', async (c) => handleAltFeed(c.req.raw, c.env));
app.all('/v1/feed/communities', async (c) => handleCommunities(c.req.raw, c.env));
app.all('/v1/feed/newsletters', async (c) => handleNewsletterFeed(c.req.raw, c.env));
app.all('/v1/feed/related', async (c) => handleRelatedPosts(c.req.raw, c.env));
app.all('/v1/feed/presets', async (c) => handleFeedPresets(c.req.raw, c.env));
app.all('/v1/feed/stream', async (c) => handleStreamFeed(c.req.raw, c.env));
app.all('/v1/feed/curated', async (c) => handleCuratedFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/scroll-depth', async (c) => handleScrollDepth(c.req.raw, c.env));
app.all('/v1/feed/seen', async (c) => handleMarkSeen(c.req.raw, c.env));
app.all('/v1/feed/engagement-feedback', async (c) => handleEngagementFeedback(c.req.raw, c.env));
app.all('/v1/feed/category/:category', async (c) =>
  handleCategorySlugFeed(c.req.raw, c.env, c.req.param('category'), c.executionCtx),
);
app.all('/v1/feed/mix', async (c) => handleCategoryMixFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/everything', async (c) => handleEverythingFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/per-protocol/:protocol/:category', async (c) =>
  handlePerProtocolCategoryFeed(
    c.req.raw,
    c.env,
    c.req.param('protocol'),
    c.req.param('category'),
    c.executionCtx,
  ),
);
// V1 unified blended feed
app.all('/v1/feed/unified', async (c) => handleContentPipelineFeed(c.req.raw, c.env));
app.all('/v1/feed/:provider', async (c) =>
  handleProviderFeed(c.req.raw, c.env, c.req.param('provider')),
);

// ─── V1: Search ─────────────────────────────────────────
app.all('/v1/search/identity', async (c) => handleSearchIdentity(c.req.raw, c.env));
app.all('/v1/search/autocomplete', async (c) => handleSearchAutocomplete(c.req.raw, c.env));
app.all('/v1/search/creators', async (c) => handleSearchCreators(c.req.raw, c.env));
app.all('/v1/search/coins', async (c) => handleSearchCoins(c.req.raw, c.env));
app.all('/v1/search/communities', async (c) => handleSearchCommunities(c.req.raw, c.env));
app.all('/v1/search/trending', async (c) => handleSearchTrending(c.req.raw, c.env));
app.all('/v1/search', async (c) => handleSearch(c.req.raw, c.env));

// ─── V1: Identity ───────────────────────────────────────
app.all('/v1/identity/resolve', async (c) => handleResolveIdentity(c.req.raw, c.env));
app.get('/v1/identity/profile', async (c) => {
  const wallet = c.req.query('wallet');
  if (wallet) return handleGetIdentityProfile(c.req.raw, c.env);
  return handleIdentityProfile(c.req.raw, c.env);
});
app.post('/v1/identity/link', async (c) =>
  withSession(c, () => handleLinkIdentity(c.req.raw, c.env)),
);
app.delete('/v1/identity/link', async (c) =>
  withSession(c, () => handleUnlinkIdentity(c.req.raw, c.env)),
);

// ─── V1: Tips ───────────────────────────────────────────
app.all('/v1/tip/lightning/invoice', async (c) => handleLightningInvoice(c.req.raw, c.env));
app.all('/v1/tip/frame/tx/:id', async (c) => handleTipFrameTx(c.req.raw, c.env));
app.all('/v1/tip/frame/callback/:id', async (c) => handleTipFrameCallback(c.req.raw, c.env));
app.all('/v1/tip/frame/:id', async (c) => handleTipFrame(c.req.raw, c.env));
app.all('/v1/tip/resolve', async (c) => handleTipResolve(c.req.raw, c.env));
app.all('/v1/tip/create', async (c) => withSession(c, () => handleTipCreate(c.req.raw, c.env)));
app.all('/v1/tip/settings', async (c) => {
  if (c.req.method === 'GET') return handleTipSettingsGet(c.req.raw, c.env);
  if (c.req.method === 'POST') return withSession(c, () => handleTipSettingsPost(c.req.raw, c.env));
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── V1: Unified Tips ───────────────────────────────────
app.post('/v1/tip/unified', async (c) =>
  withSession(c, () => handleUnifiedTipCreate(c.req.raw, c.env)),
);
app.get('/v1/tip/unified/stats', async (c) => handleUnifiedTipStats(c.req.raw, c.env));
app.get('/v1/tip/unified/leaderboard', async (c) => handleUnifiedTipLeaderboard(c.req.raw, c.env));
app.get('/v1/tip/unified/activity', async (c) => handleUnifiedTipActivity(c.req.raw, c.env));

// ─── V1: Infrastructure Health (self-hosted services) ──
app.get('/v1/infra/health', async (c) => handleInfraHealth(c.env));
app.get('/v1/infra/health/:service', async (c) =>
  handleInfraServiceHealth(c.env, c.req.param('service')),
);
app.get('/v1/infra/status', async (c) => handleInfraStatus(c.env));

// ─── V1: Health ─────────────────────────────────────────
app.all('/v1/health', async (c) => {
  const relayResp = await handleRelaysHealth(c.env);
  const relayBody = await relayResp.json();
  const { getErrorCounts } = await import('./error-logger');
  const errorCounts = await getErrorCounts(c.env);
  return jsonResponse({
    status: 'ok',
    service: 'degenfeed-api',
    version: '1.0.0',
    relays: (relayBody as Record<string, unknown>).relays,
    healthy: (relayBody as Record<string, unknown>).healthy,
    errors: errorCounts
      ? {
          total: errorCounts.total,
          byRoute: errorCounts.byRoute,
          since: errorCounts.since,
        }
      : null,
    checkedAt: Date.now(),
  });
});
app.get('/v1/health/protocols', async (c) => handleProtocolsHealth(c.env));
app.get('/v1/health/full', async (c) => handleFullHealth(c.env));

// ─── V1: Communities ────────────────────────────────────
app.post('/v1/community', async (c) =>
  withSession(c, () => handleCommunityCreate(c.req.raw, c.env)),
);
app.get('/v1/community/:name', async (c) =>
  handleCommunityGet(c.req.raw, c.env, c.req.param('name')),
);
app.get('/v1/community/:name/feed', async (c) =>
  handleCommunityFeed(c.req.raw, c.env, c.req.param('name')),
);
app.post('/v1/community/:name/join', async (c) =>
  withSession(c, () => handleCommunityJoin(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/v1/communities', async (c) => handleCommunitiesList(c.req.raw, c.env));

// ─── V1: Governance ──────────────────────────────────────
app.post('/v1/community/:name/proposals', async (c) =>
  withSession(c, () => handleProposalCreate(c.req.raw, c.env, c.req.param('name'))),
);
app.get('/v1/community/:name/proposals', async (c) =>
  handleProposalsList(c.req.raw, c.env, c.req.param('name')),
);
app.post('/v1/community/:name/proposals/:id/vote', async (c) =>
  withSession(c, () =>
    handleProposalVote(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
  ),
);
app.get('/v1/community/:name/proposals/:id/results', async (c) =>
  handleProposalResults(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
);

// ─── V1: Content Resolution (df:// URIs) ───────────────
app.all('/v1/content/*', async (c) => handleContentResolve(c.req.raw, c.env));

// ─── V1: Leaderboard ────────────────────────────────────
app.get('/v1/leaderboard/creators', async (c) => handleLeaderboardCreators(c.req.raw, c.env));
app.get('/v1/leaderboard/tippers', async (c) => handleLeaderboardTippers(c.req.raw, c.env));
app.get('/v1/leaderboard/trending', async (c) => handleLeaderboardTrending(c.req.raw, c.env));
app.get('/v1/leaderboard/communities', async (c) => handleLeaderboardCommunities(c.req.raw, c.env));

// ─── V1: Status — protocol health ───────────────────────
app.all('/v1/status', async (_c) =>
  jsonResponse({ status: 'ok', service: 'degenfeed-api', version: '1.0.0' }),
);

// ─── V1: Publish & Engage (session-gated) ──────────────
app.all('/v1/publish', async (c) => withSession(c, () => handlePublish(c.req.raw, c.env)));
app.all('/v1/engage', async (c) => withSession(c, () => handleEngage(c.req.raw, c.env)));

// ─── V1: Other public endpoints ─────────────────────────
app.all('/v1/analytics', (c) => handleAnalytics(c.req.raw, c.env));
app.all('/v1/notifications', async (c) => handleNotifications(c.req.raw, c.env));
app.post('/v1/notifications/mark-all-read', async (c) => handleMarkAllRead(c.req.raw, c.env));
app.all('/v1/prices', async (c) => handlePrices(c.req.raw, c.env));
app.all('/v1/embed/resolve', async (c) => handleEmbedResolve(c.req.raw, c.env));
app.all('/v1/frame/resolve', async (c) => handleFrameResolve(c.req.raw, c.env));
app.all('/v1/frame/action', async (c) => handleFrameAction(c.req.raw, c.env));
app.all('/v1/features', async (c) => handleFeatures(c.req.raw, c.env));
app.all('/v1/notify', async (c) => handleNotify(c.req.raw, c.env));
app.all('/v1/push/subscribe', async (c) =>
  withSession(c, () => handlePushSubscribe(c.req.raw, c.env)),
);

// ─── V1: Newsletter ─────────────────────────────────────
app.all('/v1/newsletter/subscribe', async (c) => handleNewsletterSubscribe(c.req.raw, c.env));
app.all('/v1/newsletter/status', async (c) => handleNewsletterStatus(c.req.raw, c.env));
app.all('/v1/newsletter/digest', async (c) => handleNewsletterDigest(c.req.raw, c.env));

// ─── V1: Newsletter Send ──────────────────────────────────
app.post('/v1/newsletter/send', async (c) => handleNewsletterSend(c.req.raw, c.env));
app.get('/v1/newsletter/subscribers', async (c) =>
  handleNewsletterSubscribersList(c.req.raw, c.env),
);
app.delete('/v1/newsletter/subscriber', async (c) =>
  handleNewsletterSubscriberRemove(c.req.raw, c.env),
);
app.post('/v1/newsletter/draft', async (c) => handleNewsletterCreateDraft(c.req.raw, c.env));
app.post('/v1/newsletter/test', async (c) => handleNewsletterSendTest(c.req.raw, c.env));

// ─── V1: Newsletter Bridge (Substack/Ghost) ───────────────
app.post('/v1/newsletter/bridge/connect', async (c) =>
  handleNewsletterBridgeConnect(c.req.raw, c.env),
);
app.delete('/v1/newsletter/bridge/disconnect', async (c) =>
  handleNewsletterBridgeDisconnect(c.req.raw, c.env),
);
app.get('/v1/newsletter/bridge/list', async (c) => handleNewsletterBridgeList(c.req.raw, c.env));
app.post('/v1/newsletter/bridge/poll', async (c) => handleNewsletterBridgePoll(c.req.raw, c.env));
app.post('/v1/newsletter/bridge/auto-poll', async (c) =>
  handleNewsletterBridgeAutoPoll(c.req.raw, c.env),
);
app.get('/v1/newsletter/bridge/stats', async (c) => handleNewsletterBridgeStats(c.req.raw, c.env));

// ─── V1: Discord Integration ─────────────────────────────
app.post('/v1/discord/connect', async (c) => handleDiscordConnect(c.req.raw, c.env));
app.post('/v1/discord/channel/announce', async (c) =>
  handleDiscordChannelAnnounce(c.req.raw, c.env),
);
app.get('/v1/discord/channels', async (c) => handleDiscordChannelsList(c.req.raw, c.env));
app.delete('/v1/discord/disconnect', async (c) => handleDiscordDisconnect(c.req.raw, c.env));
app.post('/v1/discord/bridge', async (c) => handleDiscordBridgeMessage(c.req.raw, c.env));
app.get('/v1/discord/oauth', async (c) => handleDiscordOAuth(c.req.raw, c.env));
app.get('/v1/discord/callback', async (c) => handleDiscordOAuthCallback(c.req.raw, c.env));
app.get('/v1/discord/guilds', async (c) => handleDiscordGuilds(c.req.raw, c.env));
app.post('/v1/discord/bridge/enable', async (c) => handleDiscordBridgeEnable(c.req.raw, c.env));
app.post('/v1/discord/community/create', async (c) =>
  handleDiscordCommunityCreate(c.req.raw, c.env),
);

// ─── V1: Telegram Bot Integration ─────────────────────────
app.post('/v1/telegram/webhook', async (c) => handleTelegramWebhook(c.req.raw, c.env));
app.get('/v1/telegram/link', async (c) => handleTelegramGenerateLink(c.req.raw, c.env));
app.post('/v1/telegram/send', async (c) => handleTelegramSend(c.req.raw, c.env));
app.get('/v1/telegram/bot-info', async (c) => handleTelegramBotInfo(c.req.raw, c.env));
app.post('/v1/telegram/link-account', async (c) => handleTelegramLinkAccount(c.req.raw, c.env));
app.get('/v1/telegram/linked', async (c) => handleTelegramGetLinked(c.req.raw, c.env));
app.delete('/v1/telegram/link-account', async (c) => handleTelegramUnlinkAccount(c.req.raw, c.env));
app.post('/v1/telegram/auth', async (c) => handleTelegramAuth(c.req.raw, c.env));
app.get('/v1/telegram/chats', async (c) => handleTelegramChats(c.req.raw, c.env));
app.get('/v1/telegram/groups', async (c) => handleTelegramGetGroups(c.req.raw, c.env));
app.post('/v1/telegram/groups/:groupId/link', async (c) =>
  handleTelegramGroupLink(c.req.raw, c.env, c.req.param('groupId')),
);

// ─── V1: Matrix Integration ───────────────────────────────
app.post('/v1/matrix/connect', async (c) => handleMatrixConnect(c.req.raw, c.env));
app.post('/v1/matrix/send', async (c) => handleMatrixSendMessage(c.req.raw, c.env));
app.get('/v1/matrix/rooms', async (c) => handleMatrixRoomsList(c.req.raw, c.env));
app.delete('/v1/matrix/disconnect', async (c) => handleMatrixDisconnect(c.req.raw, c.env));
app.post('/v1/matrix/bridge', async (c) => handleMatrixBridgeMessages(c.req.raw, c.env));

// ─── V1: Webhook System ──────────────────────────────────
app.post('/v1/webhooks/create', async (c) => handleWebhookCreate(c.req.raw, c.env));
app.post('/v1/webhooks/test', async (c) => handleWebhookTest(c.req.raw, c.env));
app.get('/v1/webhooks', async (c) => handleWebhookList(c.req.raw, c.env));
app.delete('/v1/webhooks', async (c) => handleWebhookDelete(c.req.raw, c.env));
app.post('/v1/webhooks/trigger', async (c) => handleWebhookTrigger(c.req.raw, c.env));

// ─── V1: GitHub Integration ─────────────────────────────
app.post('/v1/github/connect', async (c) => handleGitHubConnect(c.req.raw, c.env));
app.post('/v1/github/repo-activity', async (c) => handleGitHubRepoActivity(c.req.raw, c.env));
app.delete('/v1/github/disconnect', async (c) => handleGitHubDisconnect(c.req.raw, c.env));
app.get('/v1/github/accounts', async (c) => handleGitHubConnectedAccounts(c.req.raw, c.env));
app.post('/v1/github/bridge', async (c) => handleGitHubBridgeActivity(c.req.raw, c.env));

// ─── V1: Digest ──────────────────────────────────────────────
app.all('/v1/digest/today', async (c) => handleDigestToday(c.req.raw, c.env));
app.all('/v1/digest/yesterday', async (c) => handleDigestYesterday(c.req.raw, c.env));
app.all('/v1/digest/subscribe-email', async (c) => handleDigestSubscribeEmail(c.req.raw, c.env));
app.all('/v1/digest/unsubscribe-email', async (c) =>
  handleDigestUnsubscribeEmail(c.req.raw, c.env),
);

// ─── V1: API Key Management ────────────────────────────────

app.post('/v1/api-keys', async (c) => {
  const { requireSession } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: { scopes?: string[]; label?: string };
  try {
    const text = await c.req.raw.text();
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const scopes = body.scopes || ['read:feed'];
  const invalidScopes = scopes.filter((s: string) => !VALID_SCOPES.includes(s as never));
  if (invalidScopes.length > 0) {
    return jsonResponse({ error: `Invalid scopes: ${invalidScopes.join(', ')}` }, 400);
  }

  const userId = session.address || 'anon';
  const apiKey = generateApiKey();
  const record = await storeApiKey(c.env, apiKey, {
    userId,
    scopes,
    tier: 'free',
    label: body.label,
  });

  return jsonResponse(
    {
      key: apiKey,
      keyId: record.keyId,
      scopes: record.scopes,
      tier: record.tier,
      createdAt: record.createdAt,
      label: record.label,
    },
    201,
  );
});

app.get('/v1/api-keys', async (c) => {
  const { requireSession } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  return jsonResponse({ keys: [] });
});

app.delete('/v1/api-keys/:keyId', async (c) => {
  const { requireSession } = await import('./session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: { key?: string };
  try {
    const text = await c.req.raw.text();
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.key) {
    return jsonResponse({ error: 'API key required in body' }, 400);
  }

  await deleteApiKey(c.env, body.key);
  return jsonResponse({ success: true });
});

// ═══════════════════════════════════════════════════════════
// V1 ROUTES (continued) — Auth, Bookmarks, CustomFeeds, etc.
// ═══════════════════════════════════════════════════════════

// ─── V1: Auth ──────────────────────────────────────────────
app.all('/v1/auth/signout', async (c) => {
  const { handleSessionSignOut } = await import('./session');
  return handleSessionSignOut(c.req.raw, c.env);
});
app.all('/v1/auth/gotosocial/authorize', async (c) => handleGtSAuthorize(c.req.raw, c.env));
app.all('/v1/auth/gotosocial/callback', async (c) => handleGtSCallback(c.req.raw, c.env));
app.all('/v1/auth/gotosocial/register', async (c) => handleGtSRegister(c.req.raw, c.env));
app.all('/v1/auth/threads/authorize', async (c) => handleThreadsAuthorize(c.req.raw, c.env));
app.all('/v1/auth/threads/callback', async (c) => handleThreadsCallback(c.req.raw, c.env));
app.all('/v1/auth/warpcast/authorize', async (c) => handleWarpcastAuthorize(c.req.raw, c.env));
app.all('/v1/auth/warpcast/callback', async (c) => handleWarpcastCallback(c.req.raw, c.env));
app.all('/v1/auth/reddit/authorize', async (c) => handleRedditAuthorize(c.req.raw, c.env));
app.all('/v1/auth/reddit/callback', async (c) => handleRedditCallback(c.req.raw, c.env));
app.all('/v1/auth/google/authorize', async (c) => handleGoogleAuthorize(c.req.raw, c.env));
app.all('/v1/auth/google/callback', async (c) => handleGoogleCallback(c.req.raw, c.env));
app.all('/v1/auth/github/authorize', async (c) => handleGitHubAuthorize(c.req.raw, c.env));
app.all('/v1/auth/github/callback', async (c) => handleGitHubCallback(c.req.raw, c.env));
app.all('/v1/auth/discord/authorize', async (c) => handleDiscordAuthorize(c.req.raw, c.env));
app.all('/v1/auth/discord/callback', async (c) => handleDiscordCallback(c.req.raw, c.env));
app.all('/v1/auth/twitter/authorize', async (c) => handleTwitterAuthorize(c.req.raw, c.env));
app.all('/v1/auth/twitter/callback', async (c) => handleTwitterCallback(c.req.raw, c.env));
app.all('/v1/auth/telegram/authorize', async (c) => handleTelegramAuthorize(c.req.raw, c.env));
app.all('/v1/auth/telegram/callback', async (c) => handleTelegramCallback(c.req.raw, c.env));
app.all('/v1/auth/session', async (c) => {
  const { handleSessionVerify } = await import('./session');
  return handleSessionVerify(c.req.raw, c.env);
});
app.all('/v1/auth/session/revoke', async (c) => {
  const { handleSessionRevoke } = await import('./session');
  return handleSessionRevoke(c.req.raw, c.env);
});
app.all('/v1/auth/wallet/nonce', async (c) => handleWalletNonce(c.req.raw, c.env));
app.all('/v1/auth/wallet/verify', async (c) => handleWalletVerify(c.req.raw, c.env));

// ─── V1: Email Auth ───────────────────────────────────
app.all('/v1/auth/email/register', async (c) => handleEmailRegister(c.req.raw, c.env));
app.all('/v1/auth/email/signin', async (c) => handleEmailSignIn(c.req.raw, c.env));
app.all('/v1/auth/email/verify', async (c) => handleEmailVerify(c.req.raw, c.env));
app.all('/v1/auth/email/status', async (c) => handleEmailStatus(c.req.raw, c.env));
app.all('/v1/auth/email/password-reset', async (c) => handlePasswordResetRequest(c.req.raw, c.env));
app.all('/v1/auth/email/password-reset/confirm', async (c) =>
  handlePasswordResetConfirm(c.req.raw, c.env),
);

// ─── V1: Bookmarks ────────────────────────────────────────
app.get('/v1/bookmarks', async (c) => handleBookmarkList(c.req.raw, c.env));
app.post('/v1/bookmarks', async (c) => withSession(c, () => handleBookmarkAdd(c.req.raw, c.env)));
app.delete('/v1/bookmarks', async (c) =>
  withSession(c, () => handleBookmarkRemove(c.req.raw, c.env)),
);
app.get('/v1/bookmarks/check', async (c) => handleBookmarkCheck(c.req.raw, c.env));

// ─── V1: Follow ───────────────────────────────────────────
app.post('/v1/follow', async (c) => withSession(c, () => handleFollowAdd(c.req.raw, c.env)));
app.delete('/v1/follow', async (c) => withSession(c, () => handleFollowRemove(c.req.raw, c.env)));
app.get('/v1/follow/list', async (c) => handleFollowList(c.req.raw, c.env));
app.get('/v1/follow/check', async (c) => handleFollowCheck(c.req.raw, c.env));
app.get('/v1/follow/feed', async (c) => handleFollowingFeed(c.req.raw, c.env));

// ─── V1: Custom Feeds ─────────────────────────────────────
app.post('/v1/custom-feeds', async (c) =>
  withSession(c, () => handleCustomFeedCreate(c.req.raw, c.env)),
);
app.get('/v1/custom-feeds', async (c) => handleCustomFeedList(c.req.raw, c.env));
app.get('/v1/custom-feeds/public', async (c) => handleCustomFeedPublic(c.req.raw, c.env));
app.post('/v1/custom-feeds/:id/subscribe', async (c) =>
  withSession(c, () => handleCustomFeedSubscribe(c.req.raw, c.env, c.req.param('id'))),
);
app.get('/v1/custom-feeds/:id', async (c) =>
  handleCustomFeedGet(c.req.raw, c.env, c.req.param('id')),
);
app.put('/v1/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedUpdate(c.req.raw, c.env, c.req.param('id'))),
);
app.delete('/v1/custom-feeds/:id', async (c) =>
  withSession(c, () => handleCustomFeedDelete(c.req.raw, c.env, c.req.param('id'))),
);

// ─── V1: Subscription ─────────────────────────────────────
app.all('/v1/subscription/create', async (c) =>
  withSession(c, () => handleSubscriptionCreate(c.req.raw, c.env)),
);
app.all('/v1/subscription/subscribe', async (c) =>
  withSession(c, () => handleSubscriptionSubscribe(c.req.raw, c.env)),
);
app.all('/v1/subscription/confirm', async (c) =>
  withSession(c, () => handleSubscriptionConfirm(c.req.raw, c.env)),
);
app.all('/v1/subscription/status', async (c) =>
  withSession(c, () => handleSubscriptionStatus(c.req.raw, c.env)),
);
app.all('/v1/subscription/cancel', async (c) =>
  withSession(c, () => handleSubscriptionCancel(c.req.raw, c.env)),
);
app.all('/v1/subscription/check-content', async (c) =>
  withSession(c, () => handleSubscriptionContentCheck(c.req.raw, c.env)),
);
app.all('/v1/subscription/my', async (c) =>
  withSession(c, () => handleSubscriptionMy(c.req.raw, c.env)),
);
app.all('/v1/subscription/:creator', async (c) =>
  handleSubscriptionTiers(c.req.raw, c.env, c.req.param('creator')),
);

// ─── V1: Moderation ──────────────────────────────────────
app.get('/v1/moderation/reports', (c) => handleListReports(c.req.raw, c.env));
app.post('/v1/moderation/report', (c) => handleSubmitReport(c.req.raw, c.env));
app.post('/v1/moderation/reports/:id/resolve', (c) => handleResolveReport(c.req.raw, c.env));
app.post('/v1/moderation/reports/:id/remove', (c) => handleRemovePost(c.req.raw, c.env));
app.post('/v1/moderation/ban', (c) => handleBanUser(c.req.raw, c.env));
app.get('/v1/moderation/stats', (c) => handleModerationStats(c.req.raw, c.env));
app.get('/v1/moderation/banned', (c) => handleCheckBanned(c.req.raw, c.env));
app.all('/v1/moderation/sync', (c) => handleBlockSync(c.req.raw, c.env));

// ─── V1: Farcaster Creator Coins ─────────────────────────────
app.post('/v1/farcaster/coin/deploy', async (c) =>
  withSession(c, () => handleFarcasterCoinDeploy(c.req.raw, c.env)),
);
app.get('/v1/farcaster/coin/:fid', async (c) => handleFarcasterCoinGet(c.req.raw, c.env));
app.post('/v1/farcaster/coin/:fid/tip', async (c) =>
  withSession(c, () => handleFarcasterCoinTip(c.req.raw, c.env)),
);

// ─── V1: Lens Protocol Creator Coins ─────────────────────────
app.post('/v1/lens/coin/deploy', async (c) =>
  withSession(c, () => handleLensCoinDeploy(c.req.raw, c.env)),
);
app.get('/v1/lens/coin/:profileId', async (c) => handleLensCoinGet(c.req.raw, c.env));
app.post('/v1/lens/coin/:profileId/tip', async (c) =>
  withSession(c, () => handleLensCoinTip(c.req.raw, c.env)),
);

// ─── V1: Cross-Chain Tip Routing ─────────────────────────
app.post('/v1/tip/cross-chain', async (c) => {
  const { handleCrossChainTip } = await import('./routes/unified-tip');
  return withSession(c, () => handleCrossChainTip(c.req.raw, c.env));
});

// ─── V1: Lemmy Tips ──────────────────────────────────────
app.all('/v1/lemmy/tip/leaderboard', async (c) => handleLemmyTipLeaderboard(c.req.raw, c.env));
app.all('/v1/lemmy/tip/stats', async (c) => handleLemmyTipStats(c.req.raw, c.env));
app.all('/v1/lemmy/tip', async (c) => withSession(c, () => handleLemmyTipCreate(c.req.raw, c.env)));

// ─── V1: PeerTube Tips ────────────────────────────────────
app.post('/v1/peertube/tip', async (c) =>
  withSession(c, () => handlePeerTubeTipCreate(c.req.raw, c.env)),
);
app.get('/v1/peertube/tip/stats', async (c) => handlePeerTubeTipStats(c.req.raw, c.env));
app.get('/v1/peertube/tip/leaderboard', async (c) => handlePeerTubeLeaderboard(c.req.raw, c.env));

// ─── V1: Permanence (Arweave/IPFS) ──────────────────────
app.post('/v1/permanence/store', async (c) =>
  withSession(c, () => handlePermanenceStore(c.req.raw, c.env)),
);
app.get('/v1/permanence/verify/:hash', async (c) =>
  handlePermanenceVerify(c.req.raw, c.env, c.req.param('hash')),
);
app.post('/v1/permanence/anchor', async (c) =>
  withSession(c, () => handlePermanenceAnchor(c.req.raw, c.env)),
);

// ─── V1: Reputation ────────────────────────────────────────
app.get('/v1/reputation/leaderboard', async (c) => handleReputationLeaderboard(c.req.raw, c.env));
app.post('/v1/reputation/earn', async (c) => handleReputationEarn(c.req.raw, c.env));
app.post('/v1/reputation/slash', async (c) => handleReputationSlash(c.req.raw, c.env));
app.post('/v1/reputation/stake', async (c) => handleReputationStake(c.req.raw, c.env));
app.post('/v1/reputation/stake/resolve', async (c) =>
  handleReputationStakeResolve(c.req.raw, c.env),
);
app.get('/v1/reputation/:userId/history', async (c) =>
  handleReputationHistory(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/v1/reputation/:userId/stakes', async (c) =>
  handleReputationStakes(c.req.raw, c.env, c.req.param('userId')),
);
app.get('/v1/reputation/:userId', async (c) =>
  handleReputationGet(c.req.raw, c.env, c.req.param('userId')),
);

// ─── V1: Audio Spaces ──────────────────────────────────────
app.get('/v1/spaces/live', async (c) => handleSpacesLive(c.req.raw, c.env));
app.get('/v1/spaces/upcoming', async (c) => handleSpacesUpcoming(c.req.raw, c.env));
app.get('/v1/spaces/past', async (c) => handleSpacesPast(c.req.raw, c.env));
app.get('/v1/spaces/trending', async (c) => handleSpacesTrending(c.req.raw, c.env));
app.post('/v1/spaces/create', async (c) => handleSpaceCreate(c.req.raw, c.env));
app.get('/v1/spaces/:id', async (c) => handleSpaceDetails(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/spaces/:id/start', async (c) =>
  handleSpaceStart(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/end', async (c) => handleSpaceEnd(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/spaces/:id/join', async (c) => handleSpaceJoin(c.req.raw, c.env, c.req.param('id')));
app.post('/v1/spaces/:id/leave', async (c) =>
  handleSpaceLeave(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/request-speak', async (c) =>
  handleSpaceRequestSpeak(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/invite-speaker', async (c) =>
  handleSpaceInviteSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/accept-speaker', async (c) =>
  handleSpaceAcceptSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/remove-speaker', async (c) =>
  handleSpaceRemoveSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/mute-speaker', async (c) =>
  handleSpaceMuteSpeaker(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/raise-hand', async (c) =>
  handleSpaceRaiseHand(c.req.raw, c.env, c.req.param('id')),
);
app.post('/v1/spaces/:id/react', async (c) =>
  handleSpaceReact(c.req.raw, c.env, c.req.param('id')),
);
app.get('/v1/spaces/:id/recording', async (c) =>
  handleSpaceRecording(c.req.raw, c.env, c.req.param('id')),
);
app.all('/v1/spaces/:id/transcript', async (c) =>
  handleSpaceTranscript(c.req.raw, c.env, c.req.param('id')),
);

// ─── V1: Leaderboard refresh ──────────────────────────────
app.post('/v1/leaderboard/refresh', async (c) => handleRefreshLeaderboards(c.req.raw, c.env));

// ─── V1: Discover (full) ─────────────────────────────────
app.all('/v1/discover', async (c) => handleDiscover(c.req.raw, c.env));
app.get('/v1/discover/trending', async (c) => handleDiscoverTrending(c.req.raw, c.env));
app.get('/v1/discover/communities', async (c) => handleDiscoverCommunities(c.req.raw, c.env));
app.get('/v1/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));
app.get('/v1/discover/topics', async (c) => handleDiscoverTopics(c.req.raw, c.env));
app.get('/v1/discover/featured', async (c) => handleDiscoverFeatured(c.req.raw, c.env));
app.get('/v1/discover/new', async (c) => handleDiscoverNew(c.req.raw, c.env));

// ─── V1: Feed for-you + RSS/Atom ──────────────────────────
app.all('/v1/feed/for-you', async (c) => handleForYouFeed(c.req.raw, c.env, c.executionCtx));
app.all('/v1/feed/rss.xml', async (c) => handleRssXml(c.req.raw, c.env));
app.all('/v1/feed/atom.xml', async (c) => handleRssXml(c.req.raw, c.env));

// ─── V1: Messages (DM) ────────────────────────────────────
app.get('/v1/messages/unread', async (c) => handleUnreadCount(c.req.raw, c.env));
app.get('/v1/messages/conversations', async (c) => handleConversations(c.req.raw, c.env));
app.post('/v1/messages/send', async (c) =>
  withSession(c, () => handleSendMessage(c.req.raw, c.env)),
);
app.all('/v1/messages/:id', async (c) => {
  if (c.req.method === 'GET') {
    return handleConversationMessages(c.req.raw, c.env, c.req.param('id'));
  }
  if (c.req.method === 'DELETE') {
    return handleDeleteMessage(c.req.raw, c.env, c.req.param('id'));
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
});

// ─── V1: Source Discovery ──────────────────────────────────
app.get('/api/sources/discover', async (c) => handleSourcesDiscover(c.req.raw, c.env));
app.get('/api/sources/pending', async (c) => handleSourcesPending(c.req.raw, c.env));
app.post('/api/sources/approve', async (c) => handleSourcesApprove(c.req.raw, c.env));
app.post('/api/sources/reject', async (c) => handleSourcesReject(c.req.raw, c.env));
app.get('/api/sources/health', async (c) => handleSourcesHealth(c.req.raw, c.env));
app.get('/api/sources/trending', async (c) => handleSourcesTrending(c.req.raw, c.env));
app.get('/api/sources/stale', async (c) => handleSourcesStale(c.req.raw, c.env));
app.get('/api/sources/new-this-week', async (c) => handleSourcesNewThisWeek(c.req.raw, c.env));
app.get('/api/sources/stats', async (c) => handleSourcesStats(c.req.raw, c.env));
app.post('/api/sources/health-check', async (c) => handleSourcesHealthCheck(c.req.raw, c.env));
app.post('/api/sources/record-engagement', async (c) => handleRecordEngagement(c.req.raw, c.env));

// ─── V1: Additional endpoints ─────────────────────────────
app.all('/v1/translate', async (c) => handleTranslate(c.req.raw, c.env));
app.all('/v1/push/send', async (c) => handlePushSend(c.req.raw, c.env));
app.all('/v1/search/index', async (c) => handleSearchIndex(c.req.raw, c.env));
app.all('/v1/bridge/rss-to-nostr', async (c) => {
  const { handleRssToNostrBridge } = await import('./routes/publish');
  return withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
});
app.get('/v1/cross-reply/status', async (c) => {
  const { handleCrossReplyStatus } = await import('./routes/cross-reply');
  return handleCrossReplyStatus(c.req.raw, c.env);
});
app.all('/v1/cross-reply', async (c) => withSession(c, () => handleCrossReply(c.req.raw, c.env)));

// V1 cross-protocol stream chat bridge
app.post('/v1/cross-protocol-bridge/stream/start', async (c) => {
  const { startBridge } = await import('./lib/cross-protocol-chat-bridge');
  try {
    const body = (await c.req.json()) as {
      streamId: string;
      announcementResults?: Record<
        string,
        { ok: boolean; id?: string; url?: string; error?: string }
      >;
    };
    if (!body.streamId) return jsonResponse({ error: 'streamId required' }, 400);
    startBridge(
      c.env,
      body.streamId,
      (body.announcementResults ?? {}) as Record<
        string,
        {
          ok: boolean;
          protocol: string;
          id?: string;
          url?: string;
          error?: string;
        }
      >,
    );
    return jsonResponse({ ok: true, streamId: body.streamId });
  } catch (err) {
    return jsonResponse({ error: `Failed to start bridge: ${(err as Error).message}` }, 500);
  }
});
app.post('/v1/cross-protocol-bridge/stream/stop', async (c) => {
  const { stopBridge } = await import('./lib/cross-protocol-chat-bridge');
  try {
    const body = (await c.req.json()) as { streamId: string };
    if (!body.streamId) return jsonResponse({ error: 'streamId required' }, 400);
    stopBridge(c.env, body.streamId);
    return jsonResponse({ ok: true, streamId: body.streamId });
  } catch (err) {
    return jsonResponse({ error: `Failed to stop bridge: ${(err as Error).message}` }, 500);
  }
});
app.all('/v1/deploy/request', async (c) => handleDeployRequest(c.req.raw, c.env));
app.all('/v1/deploy/status', async (c) => handleDeployStatus(c.req.raw, c.env));
app.all('/v1/account/export', async (c) => handleAccountExport(c.req.raw, c.env));
app.delete('/v1/account', async (c) => handleAccountDeleteV1(c.req.raw, c.env));
app.all('/v1/account/delete', async (c) => handleAccountDeleteV1(c.req.raw, c.env));
app.get('/v1/account/sovereignty', async (c) => {
  const { requireSession } = await import('./session');
  const { verifyUserOwnership } = await import('./lib/account-sovereignty');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const report = await verifyUserOwnership(session, c.env);
  return jsonResponse(report);
});
app.get('/v1/account/sovereignty/export', async (c) => {
  const { requireSession } = await import('./session');
  const { generateExportManifest } = await import('./lib/account-sovereignty');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const manifest = await generateExportManifest(session, c.env);
  return jsonResponse(manifest);
});
app.get('/v1/account/sovereignty/migration-guide', async (_c) => {
  const { getMigrationInstructions } = await import('./lib/account-sovereignty');
  return new Response(getMigrationInstructions(), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
});
app.all('/v1/embed/*', async (c) => handleEmbedPost(c.req.raw, c.env));
app.get('/v1/thread/:dfUri', async (c) => {
  const { handleUnifiedThread } = await import('./routes/thread');
  return handleUnifiedThread(c.req.raw, c.env, c.req.param('dfUri'));
});
app.all('/v1/cross-protocol-bridge/wrap', async (c) => {
  const { handleWrapContent } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleWrapContent(c.req.raw, c.env));
});
app.all('/v1/cross-protocol-bridge/zora', async (c) => {
  const { handleZoraBridge } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleZoraBridge(c.req.raw, c.env));
});
app.all('/v1/cross-protocol-bridge/sync', async (c) => {
  const { handleSyncEdit } = await import('./routes/cross-protocol-bridge');
  return withSession(c, () => handleSyncEdit(c.req.raw, c.env));
});
app.get('/v1/cross-protocol-bridge/status', async (c) => {
  const { handleBridgeStatus } = await import('./routes/cross-protocol-bridge');
  return handleBridgeStatus(c.req.raw, c.env);
});
app.all('/v1/blink/tip', async (c) => handleBlinkTip(c.req.raw, c.env));
app.all('/v1/billing/checkout', async (c) => handleBillingCheckout(c.req.raw, c.env));
app.all('/v1/billing/verify', async (c) => handleBillingVerify(c.req.raw, c.env));
app.all('/v1/billing/status', async (c) => handleBillingStatus(c.req.raw, c.env));
app.post('/v1/billing/subscribe', async (c) =>
  withSession(c, () => handleBillingSubscribe(c.req.raw, c.env)),
);
app.post('/v1/billing/cancel', async (c) =>
  withSession(c, () => handleBillingCancel(c.req.raw, c.env)),
);
app.get('/v1/billing/my-status', async (c) =>
  withSession(c, () => handleBillingMyStatus(c.req.raw, c.env)),
);
app.all('/v1/x402/paywall', async (c) => handleX402Paywall(c.req.raw, c.env));
app.all('/v1/x402/verify', async (c) => handleX402Verify(c.req.raw, c.env));

// ─── API: DAO Treasury ────────────────────────────────────────────
// Multi-sig
app.get('/api/dao/:daoId/treasury/multisig', async (c) => handleMultisigList(c.req.raw, c.env));
app.get('/api/dao/:daoId/treasury/multisig/config', async (c) =>
  handleMultisigConfig(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/multisig/config', async (c) =>
  handleMultisigSaveConfig(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/multisig/propose', async (c) =>
  handleMultisigPropose(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/multisig/:txId/sign', async (c) =>
  handleMultisigSign(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/multisig/:txId/execute', async (c) =>
  handleMultisigExecute(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/multisig/:txId/cancel', async (c) =>
  handleMultisigCancel(c.req.raw, c.env),
);

// Streaming payments
app.get('/api/dao/:daoId/treasury/stream', async (c) => handleStreamList(c.req.raw, c.env));
app.post('/api/dao/:daoId/treasury/stream', async (c) =>
  withSession(c, () => handleStreamCreate(c.req.raw, c.env)),
);
app.get('/api/dao/:daoId/treasury/stream/analytics', async (c) =>
  handleStreamAnalytics(c.req.raw, c.env),
);
app.get('/api/dao/:daoId/treasury/stream/:streamId', async (c) =>
  handleStreamGet(c.req.raw, c.env),
);
app.put('/api/dao/:daoId/treasury/stream/:streamId', async (c) =>
  handleStreamModify(c.req.raw, c.env),
);
app.delete('/api/dao/:daoId/treasury/stream/:streamId', async (c) =>
  handleStreamCancel(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/stream/:streamId/pause', async (c) =>
  handleStreamPause(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/stream/:streamId/resume', async (c) =>
  handleStreamResume(c.req.raw, c.env),
);
app.get('/api/dao/:daoId/treasury/stream/:streamId/history', async (c) =>
  handleStreamHistory(c.req.raw, c.env),
);

// Grants
app.get('/api/dao/:daoId/treasury/grant', async (c) => handleGrantListPrograms(c.req.raw, c.env));
app.post('/api/dao/:daoId/treasury/grant', async (c) =>
  withSession(c, () => handleGrantCreateProgram(c.req.raw, c.env)),
);
app.get('/api/dao/:daoId/treasury/grant/applications', async (c) =>
  handleGrantListApplications(c.req.raw, c.env),
);
app.get('/api/dao/:daoId/treasury/grant/analytics', async (c) =>
  handleGrantAnalytics(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/grant/:grantId/apply', async (c) =>
  handleGrantApply(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/grant/app/:appId/review', async (c) =>
  handleGrantReview(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/grant/app/:appId/vote', async (c) =>
  handleGrantVote(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/grant/app/:appId/finalize', async (c) =>
  handleGrantFinalize(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/grant/app/:appId/milestone/:milestoneId/submit', async (c) =>
  handleGrantSubmitMilestone(c.req.raw, c.env),
);

// Investments
app.get('/api/dao/:daoId/treasury/investment/portfolio', async (c) =>
  handleInvestmentPortfolio(c.req.raw, c.env),
);
app.get('/api/dao/:daoId/treasury/investment/yields', async (c) =>
  handleInvestmentYields(c.req.raw, c.env),
);
app.get('/api/dao/:daoId/treasury/investment/performance', async (c) =>
  handleInvestmentPerformance(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/investment/proposal', async (c) =>
  handleInvestmentCreateProposal(c.req.raw, c.env),
);
app.get('/api/dao/:daoId/treasury/investment/proposals', async (c) =>
  handleInvestmentListProposals(c.req.raw, c.env),
);
app.post('/api/dao/:daoId/treasury/investment/proposal/:proposalId/vote', async (c) =>
  handleInvestmentVote(c.req.raw, c.env),
);

// Consolidated analytics
app.get('/api/dao/:daoId/treasury/analytics', async (c) =>
  handleTreasuryAnalytics(c.req.raw, c.env),
);
app.post('/v1/token-gate/verify', async (c) => handleTokenGateVerify(c.req.raw, c.env));
app.post('/v1/token-gate/resolve', async (c) => handleTokenGateResolve(c.req.raw, c.env));
app.all('/v1/rmi/news/headlines', async (c) => handleRmiHeadlines(c.req.raw, c.env));
app.all('/v1/rmi/news/sources', async (c) => handleRmiSources(c.req.raw, c.env));
app.all('/v1/rmi/news/sentiment', async (c) => handleRmiSentiment(c.req.raw, c.env));
app.all('/v1/rmi/news/stats', async (c) => handleRmiStats(c.req.raw, c.env));
app.all('/v1/rmi/health', async (c) => handleRmiHealth(c.req.raw, c.env));
app.all('/v1/rmi/news', async (c) => handleRmiNews(c.req.raw, c.env));
app.all('/v1/preferences', async (c) => handlePreferences(c.req.raw, c.env));
app.get('/v1/preferences/topics', async (c) => handleGetTopics(c.req.raw, c.env));
app.post('/v1/preferences/topics', async (c) => handleAdjustTopic(c.req.raw, c.env));
app.post('/v1/preferences/topics/clear', async (c) => handleClearTopic(c.req.raw, c.env));
app.get('/v1/trending/sidebar', async (c) => handleTrendingSidebar(c.req.raw, c.env));
app.get('/v1/trending/aggregated', async (c) => handleTrendingAggregated(c.req.raw, c.env));
app.get('/v1/trending/per-platform', async (c) => handleTrendingPerPlatform(c.req.raw, c.env));
app.get('/v1/trending/now', async (c) => handleTrendingNow(c.req.raw, c.env));
app.all('/v1/schedule', (c) => handleSchedulePost(c.req.raw, c.env));

// ─── API: Leaderboard ────────────────────────────────────────
app.get('/api/leaderboard/creators', async (c) => handleLeaderboardCreators(c.req.raw, c.env));
app.get('/api/leaderboard/tippers', async (c) => handleLeaderboardTippers(c.req.raw, c.env));
app.get('/api/leaderboard/trending', async (c) => handleLeaderboardTrending(c.req.raw, c.env));
app.get('/api/leaderboard/communities', async (c) =>
  handleLeaderboardCommunities(c.req.raw, c.env),
);
app.post('/api/leaderboard/refresh', async (c) => handleRefreshLeaderboards(c.req.raw, c.env));

// ─── Static redirects ──────────────────────────────────────
for (const [from, to] of Object.entries(STATIC_REDIRECTS)) {
  app.all(from, (_c) => new Response(null, { status: 302, headers: { location: to } }));
}

// ─── Feed cache management ─────────────────────────────────
app.post('/api/feed/cache/invalidate', async (c) =>
  withSession(c, () => handleFeedCacheInvalidate(c.req.raw, c.env)),
);
app.post('/v1/feed/cache/invalidate', async (c) =>
  withSession(c, () => handleFeedCacheInvalidate(c.req.raw, c.env)),
);

// ═══════════════════════════════════════════════════════════════
// REALTIME CROSS-PROTOCOL SYNC
// ═══════════════════════════════════════════════════════════════

import {
  handleProcessSyncQueue,
  handleRealtimeWebSocket,
  handleSyncStatus,
  handleWebhookReceiver,
} from './routes/realtime';

// WebSocket upgrade handler for real-time client connections
// wss://api.degenfeed.xyz/ws/realtime?topics=posts,likes,tips,coins,streams,replies
app.get('/ws/realtime', async (c) => {
  const wsResp = handleRealtimeWebSocket(c.req.raw, c.env);
  if (wsResp) return wsResp;
  return jsonResponse({ error: 'WebSocket upgrade failed' }, 400);
});

// Webhook receivers for protocol event callbacks
app.post('/api/webhook/realtime/:protocol', async (c) => handleWebhookReceiver(c.req.raw, c.env));

// Sync queue management
app.post('/api/sync/process', async (c) => handleProcessSyncQueue(c.req.raw, c.env));
app.get('/api/sync/status', async (c) => handleSyncStatus(c.req.raw, c.env));

// V1 realtime endpoints
app.post('/v1/sync/process', async (c) => handleProcessSyncQueue(c.req.raw, c.env));
app.get('/v1/sync/status', async (c) => handleSyncStatus(c.req.raw, c.env));
app.post('/v1/webhook/realtime/:protocol', async (c) => handleWebhookReceiver(c.req.raw, c.env));

// ─── Catch-all: return API info ─────────────────────────────
app.all('*', (c) => {
  if (c.req.path.startsWith('/v1/')) {
    return jsonResponse({
      status: 'ok',
      service: 'degenfeed-api',
      version: '1.0.0',
    });
  }
  return jsonResponse({
    status: 'ok',
    service: 'degenfeed-api',
    version: '0.2.0',
  });
});

// ─── Exports ─────────────────────────────────────────────────

export default app;
export { scheduled } from './index';
export { app };

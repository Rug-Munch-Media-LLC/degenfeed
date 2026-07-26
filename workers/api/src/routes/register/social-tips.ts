/**
 * @degenfeed/api-worker - Social route registration
 *
 * Register Social-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import { methodNotAllowed, ok, serverError } from '../../response-helpers';
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
} from '../../routes/algo-control';
import { handleAnalytics } from '../../routes/analytics';
import { handleBlinkTip } from '../../routes/blink';
// ─── Tipping V3 imports ────────────────────────────────────────────
import { buildShareableBlinkUrl, handleBlinkV2 } from '../../routes/blinks-v2';
import {
  handleBlueskyLeaderboard,
  handleBlueskyTipCreate,
  handleBlueskyTipStats,
} from '../../routes/bluesky-tip';
import {
  handleBookmarkAdd,
  handleBookmarkCheck,
  handleBookmarkList,
  handleBookmarkRemove,
} from '../../routes/bookmarks';
import {
  handleBridgeHealth,
  handleBridgeStats,
  handleCircuitReset,
  handleProtocolHealth,
  handleProtocolStats,
} from '../../routes/bridge-health';
import {
  handleCommunitiesList,
  handleCommunityCreate,
  handleCommunityFeed,
  handleCommunityGet,
  handleCommunityJoin,
} from '../../routes/community';
import { handleCrossPostCentralized } from '../../routes/cross-post-centralized';
import {
  handleClaimTip,
  handleCrossProtocolDashboard,
  handleCrossProtocolRoute,
  handleSaveRouteConfig,
  handleUserClaims,
} from '../../routes/cross-protocol-routing';
import { handleCrossReply } from '../../routes/cross-reply';
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
} from '../../routes/discord';
import { handleEngage } from '../../routes/engage';
import {
  handleFollowAdd,
  handleFollowCheck,
  handleFollowingFeed,
  handleFollowList,
  handleFollowRemove,
} from '../../routes/follow';
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
} from '../../routes/gamification';
import {
  handleGitHubBridgeActivity,
  handleGitHubConnect,
  handleGitHubConnectedAccounts,
  handleGitHubDisconnect,
  handleGitHubRepoActivity,
} from '../../routes/github-connect';
import {
  handleProposalCreate,
  handleProposalResults,
  handleProposalsList,
  handleProposalVote,
} from '../../routes/governance';
import {
  handleGetIdentityProfile,
  handleLinkIdentity,
  handleResolveIdentity,
  handleUnlinkIdentity,
} from '../../routes/identity';
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
} from '../../routes/identity-extensions';
import {
  handleLemmyCommentCreate,
  handleLemmyCommunity,
  handleLemmyFeed,
  handleLemmyInstances,
  handleLemmyPostById,
  handleLemmyPostCreate,
  handleLemmyTrending,
} from '../../routes/lemmy';
import {
  handleLemmyBridgeCrossPost,
  handleLemmyBridgeShare,
  handleLemmyBridgeStatus,
} from '../../routes/lemmy-bridge';
import { handleLemmyDiscover } from '../../routes/lemmy-discover';
import {
  handleLemmyTipCreate,
  handleLemmyTipLeaderboard,
  handleLemmyTipStats,
} from '../../routes/lemmy-tip';
import {
  handleMastodonLeaderboard,
  handleMastodonTipCreate,
  handleMastodonTipStats,
} from '../../routes/mastodon-tip';
import {
  handleMatrixBridgeMessages,
  handleMatrixConnect,
  handleMatrixDisconnect,
  handleMatrixRoomsList,
  handleMatrixSendMessage,
} from '../../routes/matrix';
import {
  handleBlueskyPdsLeaderboard,
  handleBlueskyPdsTipCreate,
  handleBlueskyPdsTipStats,
  handleBookWyrmLeaderboard,
  handleBookWyrmTipCreate,
  handleBookWyrmTipStats,
  handleCastopodLeaderboard,
  handleCastopodTipCreate,
  handleCastopodTipStats,
  handleEnhancedOwncastTipCreate,
  handleEnhancedPeerTubeTipCreate,
  handleFunkwhaleLeaderboard,
  handleFunkwhaleTipCreate,
  handleFunkwhaleTipStats,
  handleGoToSocialLeaderboard,
  handleGoToSocialTipCreate,
  handleGoToSocialTipStats,
  handleMisskeyLeaderboard,
  handleMisskeyTipCreate,
  handleMisskeyTipStats,
  handleMobilizonLeaderboard,
  handleMobilizonTipCreate,
  handleMobilizonTipStats,
  handleOwncastLeaderboard,
  handleOwncastTipStats,
  handlePixelfedLeaderboard,
  handlePixelfedTipCreate,
  handlePixelfedTipStats,
  handlePleromaLeaderboard,
  handlePleromaTipCreate,
  handlePleromaTipStats,
  handleWriteFreelyLeaderboard,
  handleWriteFreelyTipCreate,
  handleWriteFreelyTipStats,
} from '../../routes/native-protocol-tips';
import { handleMarkAllRead, handleNotifications } from '../../routes/notifications';
import { handleNotify } from '../../routes/notify';
import {
  handlePeerTubeLeaderboard,
  handlePeerTubeTipCreate,
  handlePeerTubeTipStats,
} from '../../routes/peertube-tip';
import {
  handlePermanenceAnchor,
  handlePermanenceStore,
  handlePermanenceVerify,
} from '../../routes/permanence';
import { handleIdentityProfile } from '../../routes/profile';
import { handlePublish } from '../../routes/publish';
import { handleWebhookReceiver } from '../../routes/realtime';
import registerAll from '../../routes/register-all';
import {
  handleBlueskyPoolStats,
  handleRegisterPlatform,
  handleRegisterPlatformStatus,
} from '../../routes/register-platform';
import {
  handleReputationEarn,
  handleReputationGet,
  handleReputationHistory,
  handleReputationLeaderboard,
  handleReputationSlash,
  handleReputationStake,
  handleReputationStakeResolve,
  handleReputationStakes,
} from '../../routes/reputation';
import { withSession } from '../../routes/route-registry';
import {
  handleSSOActivity,
  handleSSOActivityRecord,
  handleSSODashboard,
  handleSSOExport,
  handleSSOHealth,
  handleSSOImport,
  handleSSOProvision,
  handleSSOProvisionSingle,
  handleSSORecoveryGenerate,
  handleSSORecoveryRestore,
  handleSSOSessionCreate,
  handleSSOSessionRefresh,
  handleSSOSessionRevoke,
  handleSSOSessionRevokeAll,
  handleSSOSessionVerify,
} from '../../routes/sso-dashboard';
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
} from '../../routes/telegram';
import {
  handleLightningInvoice,
  handleTipCreate,
  handleTipFrame,
  handleTipFrameCallback,
  handleTipFrameTx,
  handleTipResolve,
  handleTipSettingsGet,
  handleTipSettingsPost,
} from '../../routes/tip';
import {
  handleGetGoal,
  handleGetStreak,
  handlePostLeaderboard,
  handleSetGoal,
  handleStreakBadges,
} from '../../routes/tip-streaks';
import {
  handleTipAnalyticsSummary,
  handleTipAnalyticsV2,
  handleTipLeaderboardV2,
} from '../../routes/tipping-analytics-v2';
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
} from '../../routes/unified-tip';
import {
  handleWalletRoute,
  handleWalletRouteExecute,
  handleWalletRouteLink,
} from '../../routes/wallet-tip-route';
import {
  handleWebhookCreate,
  handleWebhookDelete,
  handleWebhookList,
  handleWebhookTest,
  handleWebhookTrigger,
} from '../../routes/webhooks';
import { handleX402Paywall, handleX402Verify } from '../../routes/x402';
import {
  handleX402EnhancedVerify,
  handleX402Status,
  handleX402Subscribe,
  handleX402Tip,
  handleX402Unlock,
  handleX402Upgrade,
} from '../../routes/x402-enhanced';
import type { Env } from '../../types';

export function registerSocialTipsRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Tips ---
  app.all('/api/tip/lightning/invoice', async (c) => {
    try {
      const result = await handleLightningInvoice(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/tip/frame/tx/:id', async (c) => {
    try {
      const result = await handleTipFrameTx(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/tip/frame/callback/:id', async (c) => {
    try {
      const result = await handleTipFrameCallback(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/tip/frame/:id', async (c) => {
    try {
      const result = await handleTipFrame(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/tip/resolve', async (c) => {
    try {
      const result = await handleTipResolve(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/tip/create', async (c) => {
    try {
      return await withSession(c, () => handleTipCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/tip/settings', async (c) => {
    try {
      if (c.req.method === 'GET') return handleTipSettingsGet(c.req.raw, c.env);
      if (c.req.method === 'POST')
        return await withSession(c, () => handleTipSettingsPost(c.req.raw, c.env));
      return methodNotAllowed(['GET', 'POST']);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Tip Notification Preferences ---
  app.all('/api/tip/notifications/prefs', async (c) => {
    const { handleTipNotificationPrefs } = await import('../../lib/tip-notifications');
    return handleTipNotificationPrefs(c.req.raw, c.env);
  });

  // --- API: Unified Tips (cross-platform ledger) ---
  app.post('/api/tip/unified', async (c) => {
    try {
      return await withSession(c, () => handleUnifiedTipCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/unified/stats', async (c) => {
    try {
      const result = await handleUnifiedTipStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/unified/leaderboard', async (c) => {
    try {
      const result = await handleUnifiedTipLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/unified/activity', async (c) => {
    try {
      const result = await handleUnifiedTipActivity(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Tip Badges & Extended Leaderboards (gamification) ---
  app.get('/api/tips/badges', async (c) => {
    try {
      const result = await handleTipBadges(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tips/leaderboard/protocols', async (c) => {
    try {
      const result = await handleTipLeaderboardProtocols(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tips/leaderboard/coins', async (c) => {
    try {
      const result = await handleTipLeaderboardCoins(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Creator Tip Analytics ---
  app.get('/api/tip/unified/analytics', async (c) => {
    try {
      const result = await handleTipAnalytics(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/unified/analytics/top-tippers', async (c) => {
    try {
      const result = await handleTopTippers(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Wallet-Based Tip Routing ---
  app.get('/api/tip/wallet-route', async (c) => {
    try {
      const result = await handleWalletRoute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/tip/wallet-route/execute', async (c) => {
    try {
      const result = await handleWalletRouteExecute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/tip/wallet-route/link', async (c) => {
    try {
      const result = await handleWalletRouteLink(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Tip Streaks & Incentives ---
  app.get('/api/tip/streak', async (c) => {
    try {
      const result = await handleGetStreak(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/goal', async (c) => {
    try {
      const result = await handleGetGoal(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/tip/goal', async (c) => {
    try {
      const result = await handleSetGoal(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/post-leaderboard', async (c) => {
    try {
      const result = await handlePostLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/streak-badges', async (c) => {
    try {
      const result = await handleStreakBadges(c.req.raw);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Lemmy Discover ---
  app.get('/api/lemmy/discover', async (c) => {
    try {
      const result = await handleLemmyDiscover(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Lemmy Tips ---
  app.all('/api/lemmy/tip/leaderboard', async (c) => {
    try {
      const result = await handleLemmyTipLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/lemmy/tip/stats', async (c) => {
    try {
      const result = await handleLemmyTipStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/lemmy/tip', async (c) => {
    try {
      return await withSession(c, () => handleLemmyTipCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Lemmy Feed & Community ---
  app.get('/api/lemmy/feed', async (c) => {
    try {
      const result = await handleLemmyFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/lemmy/trending', async (c) => {
    try {
      const result = await handleLemmyTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/lemmy/instances', async (c) => {
    try {
      const result = await handleLemmyInstances(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/lemmy/community/:name', async (c) => {
    try {
      const result = await handleLemmyCommunity(c.req.raw, c.env, c.req.param('name'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/lemmy/post/:id', async (c) => {
    try {
      const result = await handleLemmyPostById(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Lemmy Write (session-gated) ---
  app.post('/api/lemmy/post', async (c) => {
    try {
      return await withSession(c, () => handleLemmyPostCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/lemmy/comment', async (c) => {
    try {
      return await withSession(c, () => handleLemmyCommentCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Lemmy Bridge (cross-post & share) ---
  app.post('/api/lemmy/bridge/cross-post', async (c) => {
    try {
      return await withSession(c, () => handleLemmyBridgeCrossPost(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/lemmy/bridge/share', async (c) => {
    try {
      return await withSession(c, () => handleLemmyBridgeShare(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/lemmy/bridge/status', async (c) => {
    try {
      const result = await handleLemmyBridgeStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: PeerTube Tips ---
  app.post('/api/peertube/tip', async (c) => {
    try {
      return await withSession(c, () => handlePeerTubeTipCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/peertube/tip/stats', async (c) => {
    try {
      const result = await handlePeerTubeTipStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/peertube/tip/leaderboard', async (c) => {
    try {
      const result = await handlePeerTubeLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Bluesky Tips ---
  app.post('/api/bluesky/tip', async (c) => {
    try {
      return await withSession(c, () => handleBlueskyTipCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bluesky/tip/stats', async (c) => {
    try {
      const result = await handleBlueskyTipStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bluesky/tip/leaderboard', async (c) => {
    try {
      const result = await handleBlueskyLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Mastodon Tips ---
  app.post('/api/mastodon/tip', async (c) => {
    try {
      return await withSession(c, () => handleMastodonTipCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/mastodon/tip/stats', async (c) => {
    try {
      const result = await handleMastodonTipStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/mastodon/tip/leaderboard', async (c) => {
    try {
      const result = await handleMastodonLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Chain Tip Routing ---
  app.post('/api/tip/cross-chain', async (c) => {
    try {
      const { handleCrossChainTip } = await import('../../routes/unified-tip');
      return await withSession(c, () => handleCrossChainTip(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Smart Chain Selection ---
  app.get('/api/tip/smart-chain', async (c) => {
    const { handleSmartChainSelection } = await import('../../routes/tip');
    return handleSmartChainSelection(c.req.raw, c.env);
  });

  // ══════════════════════════════════════════════════════════════════════
  // TIPPING V3: Blinks V2
  // ══════════════════════════════════════════════════════════════════════
  app.all('/api/blink/v2/tip', async (c) => {
    try {
      if (c.req.method === 'GET' || c.req.method === 'POST') {
        return handleBlinkV2(c.req.raw, c.env);
      }
      const { methodNotAllowed } = await import('../../response-helpers');
      return methodNotAllowed(['GET', 'POST']);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const { serverError } = await import('../../response-helpers');
      return serverError(msg);
    }
  });
  app.all('/api/blink/v2/tip/*', async (c) => {
    try {
      if (c.req.method === 'GET' || c.req.method === 'POST') {
        return handleBlinkV2(c.req.raw, c.env);
      }
      const { methodNotAllowed } = await import('../../response-helpers');
      return methodNotAllowed(['GET', 'POST']);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const { serverError } = await import('../../response-helpers');
      return serverError(msg);
    }
  });
  app.post('/api/blink/v2/confirm', async (c) => {
    try {
      return handleBlinkV2(c.req.raw, c.env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const { serverError } = await import('../../response-helpers');
      return serverError(msg);
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // TIPPING V3: x402 Enhanced
  // ══════════════════════════════════════════════════════════════════════
  app.get('/api/x402/tip', async (c) => {
    try {
      return handleX402Tip(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/x402/unlock', async (c) => {
    try {
      return handleX402Unlock(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/x402/subscribe', async (c) => {
    try {
      return handleX402Subscribe(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/x402/upgrade', async (c) => {
    try {
      return handleX402Upgrade(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/x402/enhanced-verify', async (c) => {
    try {
      return handleX402EnhancedVerify(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/x402/status', async (c) => {
    try {
      return handleX402Status(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // TIPPING V3: Native Protocol Tips (all owned instances)
  // ══════════════════════════════════════════════════════════════════════

  // --- PeerTube (enhanced) ---
  app.post('/api/peertube/tip/v2', async (c) => {
    try {
      return handleEnhancedPeerTubeTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Owncast (enhanced) ---
  app.post('/api/owncast/tip/v2', async (c) => {
    try {
      return handleEnhancedOwncastTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Pixelfed ---
  app.post('/api/pixelfed/tip', async (c) => {
    try {
      return handlePixelfedTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/pixelfed/tip/stats', async (c) => {
    try {
      return handlePixelfedTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/pixelfed/tip/leaderboard', async (c) => {
    try {
      return handlePixelfedLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- WriteFreely ---
  app.post('/api/writefreely/tip', async (c) => {
    try {
      return handleWriteFreelyTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/writefreely/tip/stats', async (c) => {
    try {
      return handleWriteFreelyTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/writefreely/tip/leaderboard', async (c) => {
    try {
      return handleWriteFreelyLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- BookWyrm ---
  app.post('/api/bookwyrm/tip', async (c) => {
    try {
      return handleBookWyrmTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bookwyrm/tip/stats', async (c) => {
    try {
      return handleBookWyrmTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bookwyrm/tip/leaderboard', async (c) => {
    try {
      return handleBookWyrmLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Mobilizon ---
  app.post('/api/mobilizon/tip', async (c) => {
    try {
      return handleMobilizonTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/mobilizon/tip/stats', async (c) => {
    try {
      return handleMobilizonTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/mobilizon/tip/leaderboard', async (c) => {
    try {
      return handleMobilizonLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Owncast ---
  app.post('/api/owncast/tip', async (c) => {
    try {
      return handleOwncastTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/owncast/tip/stats', async (c) => {
    try {
      return handleOwncastTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/owncast/tip/leaderboard', async (c) => {
    try {
      return handleOwncastLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Funkwhale ---
  app.post('/api/funkwhale/tip', async (c) => {
    try {
      return handleFunkwhaleTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/funkwhale/tip/stats', async (c) => {
    try {
      return handleFunkwhaleTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/funkwhale/tip/leaderboard', async (c) => {
    try {
      return handleFunkwhaleLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Castopod ---
  app.post('/api/castopod/tip', async (c) => {
    try {
      return handleCastopodTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/castopod/tip/stats', async (c) => {
    try {
      return handleCastopodTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/castopod/tip/leaderboard', async (c) => {
    try {
      return handleCastopodLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- GoToSocial ---
  app.post('/api/gotosocial/tip', async (c) => {
    try {
      return handleGoToSocialTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/gotosocial/tip/stats', async (c) => {
    try {
      return handleGoToSocialTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/gotosocial/tip/leaderboard', async (c) => {
    try {
      return handleGoToSocialLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Bluesky PDS ---
  app.post('/api/blueskypds/tip', async (c) => {
    try {
      return handleBlueskyPdsTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/blueskypds/tip/stats', async (c) => {
    try {
      return handleBlueskyPdsTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/blueskypds/tip/leaderboard', async (c) => {
    try {
      return handleBlueskyPdsLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Misskey ---
  app.post('/api/misskey/tip', async (c) => {
    try {
      return handleMisskeyTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/misskey/tip/stats', async (c) => {
    try {
      return handleMisskeyTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/misskey/tip/leaderboard', async (c) => {
    try {
      return handleMisskeyLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Pleroma ---
  app.post('/api/pleroma/tip', async (c) => {
    try {
      return handlePleromaTipCreate(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/pleroma/tip/stats', async (c) => {
    try {
      return handlePleromaTipStats(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/pleroma/tip/leaderboard', async (c) => {
    try {
      return handlePleromaLeaderboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // TIPPING V3: Cross-Protocol Tip Routing
  // ══════════════════════════════════════════════════════════════════════
  app.post('/api/tip/cross-protocol/route', async (c) => {
    try {
      return handleCrossProtocolRoute(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.all('/api/tip/claim/*', async (c) => {
    try {
      const code = c.req.param('*') ?? c.req.path.replace('/api/tip/claim/', '');
      if (!code) {
        const { badRequest } = await import('../../response-helpers');
        return badRequest('Claim code required');
      }
      return handleClaimTip(c.req.raw, c.env, code);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.get('/api/tip/cross-protocol/claims', async (c) => {
    try {
      return handleUserClaims(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.post('/api/tip/cross-protocol/config', async (c) => {
    try {
      return handleSaveRouteConfig(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  app.get('/api/tip/cross-protocol/dashboard', async (c) => {
    try {
      return handleCrossProtocolDashboard(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // TIPPING V3: Enhanced Analytics
  // ══════════════════════════════════════════════════════════════════════
  app.get('/api/tip/analytics/v2', async (c) => {
    try {
      return handleTipAnalyticsV2(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/analytics/v2/leaderboard', async (c) => {
    try {
      return handleTipLeaderboardV2(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/tip/analytics/v2/summary', async (c) => {
    try {
      return handleTipAnalyticsSummary(c.req.raw, c.env);
    } catch (err) {
      const { serverError } = await import('../../response-helpers');
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

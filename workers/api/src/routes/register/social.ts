/**
 * @degenfeed/api-worker - Social route registration
 *
 * Register Social-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';
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

export function registerSocialRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Bridge Health ---
  app.get('/api/bridge/health', async (c) => {
    try {
      const result = await handleBridgeHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bridge/health/:protocol', async (c) => {
    try {
      const result = await handleProtocolHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/bridge/circuit/reset', async (c) => {
    try {
      const result = await handleCircuitReset(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bridge/stats', async (c) => {
    try {
      const result = await handleBridgeStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bridge/stats/:protocol', async (c) => {
    try {
      const result = await handleProtocolStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Analytics ---
  app.get('/api/analytics', (c) => handleAnalytics(c.req.raw, c.env));

  // --- API: Bridge ---
  app.all('/api/bridge/rss-to-nostr', async (c) => {
    try {
      const { handleRssToNostrBridge } = await import('../../routes/publish');
      return await withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/cross-reply/status', async (c) => {
    const { handleCrossReplyStatus } = await import('../../routes/cross-reply');
    return handleCrossReplyStatus(c.req.raw, c.env);
  });
  app.all('/api/cross-reply', async (c) => {
    try {
      return await withSession(c, () => handleCrossReply(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Protocol Stream Chat Bridge ---
  app.post('/api/cross-protocol-bridge/stream/start', async (c) => {
    try {
      const { startBridge } = await import('../../lib/cross-protocol-chat-bridge');
      const body = (await c.req.json()) as {
        streamId: string;
        announcementResults?: Record<
          string,
          { ok: boolean; id?: string; url?: string; error?: string }
        >;
      };
      if (!body.streamId) {
        return badRequest('streamId required');
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
    const { stopBridge } = await import('../../lib/cross-protocol-chat-bridge');
    try {
      const body = (await c.req.json()) as { streamId: string };
      if (!body.streamId) {
        return badRequest('streamId required');
      }
      stopBridge(c.env, body.streamId);
      return jsonResponse({ ok: true, streamId: body.streamId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: `Failed to stop bridge: ${msg}` }, 500);
    }
  });

  // --- API: Cross-Protocol Bridge ---
  app.all('/api/cross-protocol-bridge/wrap', async (c) => {
    const { handleWrapContent } = await import('../../routes/cross-protocol-bridge');
    return withSession(c, () => handleWrapContent(c.req.raw, c.env));
  });
  app.all('/api/cross-protocol-bridge/zora', async (c) => {
    const { handleZoraBridge } = await import('../../routes/cross-protocol-bridge');
    return withSession(c, () => handleZoraBridge(c.req.raw, c.env));
  });
  app.all('/api/cross-protocol-bridge/sync', async (c) => {
    const { handleSyncEdit } = await import('../../routes/cross-protocol-bridge');
    return withSession(c, () => handleSyncEdit(c.req.raw, c.env));
  });
  app.get('/api/cross-protocol-bridge/status', async (c) => {
    const { handleBridgeStatus } = await import('../../routes/cross-protocol-bridge');
    return handleBridgeStatus(c.req.raw, c.env);
  });

  // --- API: Bridge Health ---
  app.get('/api/bookmarks', async (c) => handleBookmarkList(c.req.raw, c.env));
  app.post('/api/bookmarks', async (c) => {
    try {
      return await withSession(c, () => handleBookmarkAdd(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/bookmarks', async (c) => {
    try {
      return await withSession(c, () => handleBookmarkRemove(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/bookmarks/check', async (c) => {
    try {
      const result = await handleBookmarkCheck(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Follow (protocol-native follow/unfollow) ---
  app.post('/api/follow', async (c) => {
    try {
      return await withSession(c, () => handleFollowAdd(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/follow', async (c) => {
    try {
      return await withSession(c, () => handleFollowRemove(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/follow/list', async (c) => {
    try {
      const result = await handleFollowList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/follow/check', async (c) => {
    try {
      const result = await handleFollowCheck(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/follow/feed', async (c) => {
    try {
      const result = await handleFollowingFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Publish & Engage (session-gated) ---
  app.all('/api/publish', async (c) => {
    try {
      return await withSession(c, () => handlePublish(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/engage', async (c) => {
    try {
      return await withSession(c, () => handleEngage(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Publish (one-click multi-protocol) ---
  app.post('/api/publish/all', async (c) => {
    try {
      const { handlePublishAll } = await import('../../routes/publish');
      return await withSession(c, () => handlePublishAll(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/publish/selected', async (c) => {
    const { handlePublishSelected } = await import('../../routes/publish');
    return withSession(c, () => handlePublishSelected(c.req.raw, c.env));
  });
  app.get('/api/publish/preview', async (c) => {
    const { handlePreviewPost } = await import('../../routes/publish');
    return handlePreviewPost(c.req.raw, c.env);
  });
  app.post('/api/publish/schedule', async (c) => {
    const { handleScheduleCrossPost } = await import('../../routes/publish');
    return withSession(c, () => handleScheduleCrossPost(c.req.raw, c.env));
  });
  app.get('/api/publish/scheduled', async (c) => {
    const { handleListScheduledCrossPosts } = await import('../../routes/publish');
    return withSession(c, () => handleListScheduledCrossPosts(c.req.raw, c.env));
  });
  app.delete('/api/publish/scheduled/:id', async (c) => {
    const { handleDeleteScheduledCrossPost } = await import('../../routes/publish');
    return withSession(c, () => handleDeleteScheduledCrossPost(c.req.raw, c.env));
  });

  // --- API: Cross-Post History ---
  app.get('/api/crosspost/author/:wallet', async (c) => {
    const { getAuthorCrossPostBatches } = await import('../../lib/cross-publish-orchestrator');
    const wallet = c.req.param('wallet');
    const batches = await getAuthorCrossPostBatches(wallet, c.env);
    return ok({ batches });
  });
  app.all('/api/crosspost/batch/:batchId', async (c) => {
    try {
      const { getCrossPostBatch, deleteCrossPostBatch } = await import(
        '../../lib/cross-publish-orchestrator'
      );
      const batchId = c.req.param('batchId');
      if (c.req.method === 'DELETE') {
        await deleteCrossPostBatch(batchId, c.env);
        return ok({ deleted: true });
      }
      const batch = await getCrossPostBatch(batchId, c.env);
      return batch ? jsonResponse(batch) : jsonResponse({ error: 'Batch not found' }, 404);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

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

  // --- API: Notifications ---
  app.all('/api/notifications', async (c) => handleNotifications(c.req.raw, c.env));
  app.get('/api/notifications/grouped', async (c) => handleNotifications(c.req.raw, c.env));
  app.post('/api/notifications/digest', async (c) => {
    const { handleDigestFormat } = await import('../../routes/digest');
    return handleDigestFormat(c.req.raw, c.env);
  });
  app.get('/api/notifications/digest', async (c) => {
    const { handleDigestStatus } = await import('../../routes/digest');
    return handleDigestStatus(c.req.raw, c.env);
  });
  app.post('/api/notifications/preferences', async (c) => handleMarkAllRead(c.req.raw, c.env));
  app.post('/api/notifications/mark-all-read', async (c) => handleMarkAllRead(c.req.raw, c.env));
  app.all('/api/notify', async (c) => handleNotify(c.req.raw, c.env));

  // --- API: Identity ---
  app.all('/api/identity/resolve', async (c) => handleResolveIdentity(c.req.raw, c.env));
  app.get('/api/identity/profile', async (c) => {
    // /api/identity/profile?wallet=0x... returns cross-protocol linked identities
    // /api/identity/profile?handle=... returns resolved identity profile (legacy)
    const wallet = c.req.query('wallet');
    if (wallet) return handleGetIdentityProfile(c.req.raw, c.env);
    return handleIdentityProfile(c.req.raw, c.env);
  });
  app.post('/api/identity/link', async (c) => {
    try {
      return await withSession(c, () => handleLinkIdentity(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/identity/link', async (c) => {
    try {
      return await withSession(c, () => handleUnlinkIdentity(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Identity Extensions (AT Protocol, Zora, Telegram) ---
  app.post('/api/identity/extensions/link/atproto', async (c) => {
    try {
      return await withSession(c, () => handleLinkAtproto(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/identity/extensions/create/atproto', async (c) => {
    try {
      return await withSession(c, () => handleCreateAtproto(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/identity/extensions/link/zora', async (c) => {
    try {
      return await withSession(c, () => handleLinkZora(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/identity/extensions/resolve/zora', async (c) => {
    try {
      const result = await handleResolveZora(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/identity/extensions/link/telegram', async (c) => {
    try {
      return await withSession(c, () => handleLinkTelegram(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/identity/extensions/resolve/did', async (c) => {
    try {
      const result = await handleResolveDid(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/identity/extensions/resolve/wallet', async (c) => {
    try {
      const result = await handleResolveWallet(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/identity/extensions/status', async (c) => {
    try {
      const result = await handleIdentityExtensionsStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Identity Auto-Discovery ---
  app.post('/api/identity/discover', async (c) => {
    try {
      return await withSession(c, () => handleIdentityDiscover(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/identity/link-all', async (c) => {
    try {
      return await withSession(c, () => handleIdentityLinkAll(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/identity/discovery/status', async (c) => {
    try {
      const result = await handleIdentityDiscoveryStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Blink ---
  app.all('/api/blink/tip', async (c) => {
    try {
      const result = await handleBlinkTip(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Algorithm Control (user-controlled feed) ---
  app.get('/api/algo/weights', async (c) => {
    try {
      const result = await handleGetWeights(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/algo/weights', async (c) => {
    try {
      const result = await handleUpdateWeights(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/algo/weights/reset', async (c) => {
    try {
      const result = await handleResetWeights(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/algo/weights/presets', async (c) => {
    try {
      const result = await handleGetPresets(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/algo/weights/preset/:name', async (c) => {
    try {
      const result = await handleApplyPreset(c.req.raw, c.env, c.req.param('name'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/algo/explain/:postId', async (c) => {
    try {
      const result = await handleExplainPost(c.req.raw, c.env, c.req.param('postId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/algo/rules', async (c) => {
    try {
      const result = await handleListRules(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/algo/rules', async (c) => {
    try {
      const result = await handleAddRule(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/algo/rules/:ruleId', async (c) => {
    try {
      const result = await handleDeleteRule(c.req.raw, c.env, c.req.param('ruleId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/algo/signals', async (c) => {
    try {
      const result = await handleAlgoGetSignals(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/algo/signals', async (c) => {
    try {
      const result = await handleUpdateSignals(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/algo/presets/share/:name', async (c) => {
    try {
      const result = await handleSharePreset(c.req.raw, c.env, c.req.param('name'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: x402 ---
  app.all('/api/x402/paywall', async (c) => {
    try {
      const result = await handleX402Paywall(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/x402/verify', async (c) => {
    try {
      const result = await handleX402Verify(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Platform Registration ---
  app.all('/api/register-platform', async (c) => {
    try {
      return await withSession(c, () => handleRegisterPlatform(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/register-platform/status', async (c) => {
    try {
      const result = await handleRegisterPlatformStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/register-platform/bluesky-pool', async (c) => {
    try {
      const result = await handleBlueskyPoolStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Concierge Registration (register-all) ---
  app.route('/api/register', registerAll);

  // --- API: Permanence (Arweave/IPFS) ---
  app.post('/api/permanence/store', async (c) => {
    try {
      return await withSession(c, () => handlePermanenceStore(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/permanence/verify/:hash', async (c) => {
    try {
      const result = await handlePermanenceVerify(c.req.raw, c.env, c.req.param('hash'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/permanence/anchor', async (c) => {
    try {
      return await withSession(c, () => handlePermanenceAnchor(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Discord Integration ---
  app.post('/api/discord/connect', async (c) => {
    try {
      const result = await handleDiscordConnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/discord/channel/announce', async (c) => {
    try {
      const result = await handleDiscordChannelAnnounce(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discord/channels', async (c) => {
    try {
      const result = await handleDiscordChannelsList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/discord/disconnect', async (c) => {
    try {
      const result = await handleDiscordDisconnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/discord/bridge', async (c) => {
    try {
      const result = await handleDiscordBridgeMessage(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discord/oauth', async (c) => {
    try {
      const result = await handleDiscordOAuth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discord/callback', async (c) => {
    try {
      const result = await handleDiscordOAuthCallback(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discord/guilds', async (c) => {
    try {
      const result = await handleDiscordGuilds(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/discord/bridge/enable', async (c) => {
    try {
      const result = await handleDiscordBridgeEnable(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/discord/community/create', async (c) => {
    try {
      const result = await handleDiscordCommunityCreate(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discord/community/:symbol', async (c) => {
    try {
      const result = await handleDiscordCommunityInfo(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discord/connection', async (c) => {
    try {
      const result = await handleDiscordConnectionStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/discord/connection', async (c) => {
    try {
      const result = await handleDiscordDisconnectOAuth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Telegram Bot Integration ---
  app.post('/api/telegram/webhook', async (c) => {
    try {
      const result = await handleTelegramWebhook(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/telegram/link', async (c) => {
    try {
      const result = await handleTelegramGenerateLink(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/telegram/send', async (c) => {
    try {
      const result = await handleTelegramSend(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/telegram/bot-info', async (c) => {
    try {
      const result = await handleTelegramBotInfo(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/telegram/link-account', async (c) => {
    try {
      const result = await handleTelegramLinkAccount(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/telegram/linked', async (c) => {
    try {
      const result = await handleTelegramGetLinked(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/telegram/link-account', async (c) => {
    try {
      const result = await handleTelegramUnlinkAccount(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/telegram/auth', async (c) => {
    try {
      const result = await handleTelegramAuth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/telegram/chats', async (c) => {
    try {
      const result = await handleTelegramChats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/telegram/groups', async (c) => {
    try {
      const result = await handleTelegramGetGroups(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/telegram/groups/:groupId/link', async (c) => {
    try {
      const result = await handleTelegramGroupLink(c.req.raw, c.env, c.req.param('groupId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Matrix Integration ---
  app.post('/api/matrix/connect', async (c) => {
    try {
      const result = await handleMatrixConnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/matrix/send', async (c) => {
    try {
      const result = await handleMatrixSendMessage(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/matrix/rooms', async (c) => {
    try {
      const result = await handleMatrixRoomsList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/matrix/disconnect', async (c) => {
    try {
      const result = await handleMatrixDisconnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/matrix/bridge', async (c) => {
    try {
      const result = await handleMatrixBridgeMessages(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Webhook System ---
  app.post('/api/webhooks/create', async (c) => {
    try {
      return await withSession(c, () => handleWebhookCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/webhooks/test', async (c) => {
    try {
      const result = await handleWebhookTest(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/webhooks', async (c) => {
    try {
      const result = await handleWebhookList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/webhooks', async (c) => {
    try {
      const result = await handleWebhookDelete(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/webhooks/trigger', async (c) => {
    try {
      return await withSession(c, () => handleWebhookTrigger(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: GitHub Integration ---
  app.post('/api/github/connect', async (c) => {
    try {
      const result = await handleGitHubConnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/github/repo-activity', async (c) => {
    try {
      const result = await handleGitHubRepoActivity(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/github/disconnect', async (c) => {
    try {
      const result = await handleGitHubDisconnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/github/accounts', async (c) => {
    try {
      const result = await handleGitHubConnectedAccounts(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/github/bridge', async (c) => {
    try {
      const result = await handleGitHubBridgeActivity(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Gamification (Streaks / Achievements / XP / Social Proof) ---
  app.all('/api/gamification/streak', async (c) => {
    try {
      const result = await handleStreakCheck(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/streak/leaderboard', async (c) => {
    try {
      const result = await handleStreakLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/achievements', async (c) => {
    try {
      const result = await handleAchievements(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/achievements/check', async (c) => {
    try {
      const result = await handleAchievementCheck(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/challenges/today', async (c) => {
    try {
      const result = await handleChallengesToday(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/challenges/progress', async (c) => {
    try {
      const result = await handleChallengeProgress(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/xp', async (c) => {
    try {
      const result = await handleXp(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/xp/award', async (c) => {
    try {
      const result = await handleXpAward(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/social-proof', async (c) => {
    try {
      const result = await handleSocialProof(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/activity', async (c) => {
    try {
      const result = await handleActivityRecord(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/gamification/activity/recent', async (c) => {
    try {
      const result = await handleRecentActivity(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Communities (cross-protocol) ---
  app.post('/api/community', async (c) => {
    try {
      return await withSession(c, () => handleCommunityCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/community/:name', async (c) => {
    try {
      const result = await handleCommunityGet(c.req.raw, c.env, c.req.param('name'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/community/:name/feed', async (c) => {
    try {
      const result = await handleCommunityFeed(c.req.raw, c.env, c.req.param('name'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/community/:name/join', async (c) => {
    try {
      return await withSession(c, () => handleCommunityJoin(c.req.raw, c.env, c.req.param('name')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/communities', async (c) => {
    try {
      const result = await handleCommunitiesList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Governance (DAOs) ---
  app.post('/api/community/:name/proposals', async (c) => {
    try {
      return await withSession(c, () =>
        handleProposalCreate(c.req.raw, c.env, c.req.param('name')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/community/:name/proposals', async (c) => {
    try {
      const result = await handleProposalsList(c.req.raw, c.env, c.req.param('name'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/community/:name/proposals/:id/vote', async (c) => {
    try {
      return await withSession(c, () =>
        handleProposalVote(c.req.raw, c.env, c.req.param('name'), c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/community/:name/proposals/:id/results', async (c) => {
    try {
      const result = await handleProposalResults(
        c.req.raw,
        c.env,
        c.req.param('name'),
        c.req.param('id'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Post to Centralized Platforms ---
  app.post('/api/cross-post/medium', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'medium'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/substack', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'substack'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/youtube', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'youtube'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/tiktok', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'tiktok'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/instagram', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'instagram'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/linkedin', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'linkedin'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/reddit', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'reddit'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/cross-post/pinterest', async (c) => {
    try {
      return await withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'pinterest'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Platform Limits (for UI content adaptation) ---
  app.get('/api/cross-post/limits', async (_c) => {
    try {
      const { PLATFORM_LIMITS } = await import('../../routes/cross-post-centralized');
      return ok({ limits: PLATFORM_LIMITS });
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Reputation ---
  app.get('/api/reputation/leaderboard', async (c) => {
    try {
      const result = await handleReputationLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/reputation/earn', async (c) => {
    try {
      return await withSession(c, () => handleReputationEarn(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/reputation/slash', async (c) => {
    try {
      return await withSession(c, () => handleReputationSlash(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/reputation/stake', async (c) => {
    try {
      return await withSession(c, () => handleReputationStake(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/reputation/stake/resolve', async (c) => {
    try {
      const result = await handleReputationStakeResolve(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/reputation/:userId/history', async (c) => {
    try {
      const result = await handleReputationHistory(c.req.raw, c.env, c.req.param('userId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/reputation/:userId/stakes', async (c) => {
    try {
      const result = await handleReputationStakes(c.req.raw, c.env, c.req.param('userId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/reputation/:userId', async (c) => {
    try {
      const result = await handleReputationGet(c.req.raw, c.env, c.req.param('userId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Feed cache management ---
  app.post('/api/sso/provision', async (c) => {
    try {
      const result = await handleSSOProvision(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/provision/:protocol', async (c) => {
    try {
      const result = await handleSSOProvisionSingle(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/sso/dashboard', async (c) => {
    try {
      const result = await handleSSODashboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/session/create', async (c) => {
    try {
      const result = await handleSSOSessionCreate(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/session/verify', async (c) => {
    try {
      const result = await handleSSOSessionVerify(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/session/refresh', async (c) => {
    try {
      const result = await handleSSOSessionRefresh(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/session/revoke', async (c) => {
    try {
      const result = await handleSSOSessionRevoke(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/session/revoke-all', async (c) => {
    try {
      const result = await handleSSOSessionRevokeAll(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/sso/activity', async (c) => {
    try {
      const result = await handleSSOActivity(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/activity/record', async (c) => {
    try {
      const result = await handleSSOActivityRecord(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/sso/export', async (c) => {
    try {
      const result = await handleSSOExport(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/import', async (c) => {
    try {
      const result = await handleSSOImport(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/recovery/generate', async (c) => {
    try {
      const result = await handleSSORecoveryGenerate(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/sso/recovery/restore', async (c) => {
    try {
      const result = await handleSSORecoveryRestore(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/sso/health', async (c) => {
    try {
      const result = await handleSSOHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/webhook/realtime/:protocol', async (c) => {
    try {
      const result = await handleWebhookReceiver(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

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


export function registerSocialCoreRoutes(app: Hono<{ Bindings: Env }>): void {
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
}

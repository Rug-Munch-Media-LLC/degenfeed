/**
 * @degenfeed/api-worker - Social route registration
 *
 * Register Social-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';

import {
  handleAddRule,
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
  handleGetSignals as handleAlgoGetSignals,
} from '../../routes/algo-control';
import { handleAnalytics } from '../../routes/analytics';
import { handleBlinkTip } from '../../routes/blink';
import {
  handleBlueskyLeaderboard,
  handleBlueskyTipCreate,
  handleBlueskyTipStats,
} from '../../routes/bluesky-tip';
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
import registerAll from '../../routes/register-all';
import {
  handleBlueskyPoolStats,
  handleRegisterPlatform,
  handleRegisterPlatformStatus,
} from '../../routes/register-platform';
import { withSession } from '../../routes/route-registry';
import { handleBridgeHealth, handleProtocolHealth, handleCircuitReset, handleBridgeStats, handleProtocolStats } from '../../routes/bridge-health';
import { handleBookmarkAdd, handleBookmarkRemove, handleBookmarkList, handleBookmarkCheck } from '../../routes/bookmarks';
import { handleFollowAdd, handleFollowRemove, handleFollowList, handleFollowCheck, handleFollowingFeed } from '../../routes/follow';
import { handleStatus as handleIdentityExtensionsStatus } from '../../routes/identity-extensions';
import { handleReputationGet, handleReputationHistory, handleReputationLeaderboard, handleReputationEarn, handleReputationSlash, handleReputationStake, handleReputationStakeResolve, handleReputationStakes } from '../../routes/reputation';
import { handleSSOProvision, handleSSOProvisionSingle, handleSSODashboard, handleSSOSessionCreate, handleSSOSessionVerify, handleSSOSessionRefresh, handleSSOSessionRevoke, handleSSOSessionRevokeAll, handleSSOActivity, handleSSOActivityRecord, handleSSOExport, handleSSOImport, handleSSORecoveryGenerate, handleSSORecoveryRestore, handleSSOHealth } from '../../routes/sso-dashboard';
import { handleWebhookReceiver } from '../../routes/realtime';
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
import { methodNotAllowed } from '../response-helpers';

export function registerSocialRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Bridge Health ---
  app.get('/api/bridge/health', async (c) => handleBridgeHealth(c.req.raw, c.env));
  app.get('/api/bridge/health/:protocol', async (c) => handleProtocolHealth(c.req.raw, c.env));
  app.post('/api/bridge/circuit/reset', async (c) => handleCircuitReset(c.req.raw, c.env));
  app.get('/api/bridge/stats', async (c) => handleBridgeStats(c.req.raw, c.env));
  app.get('/api/bridge/stats/:protocol', async (c) => handleProtocolStats(c.req.raw, c.env));

  // --- API: Analytics ---
  app.get('/api/analytics', (c) => handleAnalytics(c.req.raw, c.env));

  // --- API: Bridge ---
  app.all('/api/bridge/rss-to-nostr', async (c) => {
    const { handleRssToNostrBridge } = await import('../../routes/publish');
    return withSession(c, () => handleRssToNostrBridge(c.req.raw, c.env));
  });
  app.get('/api/cross-reply/status', async (c) => {
    const { handleCrossReplyStatus } = await import('../../routes/cross-reply');
    return handleCrossReplyStatus(c.req.raw, c.env);
  });
  app.all('/api/cross-reply', async (c) =>
    withSession(c, () => handleCrossReply(c.req.raw, c.env)),
  );

  // --- API: Cross-Protocol Stream Chat Bridge ---
  app.post('/api/cross-protocol-bridge/stream/start', async (c) => {
    const { startBridge } = await import('../../lib/cross-protocol-chat-bridge');
    const { stopBridge } = await import('../../lib/cross-protocol-chat-bridge');
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
    const { stopBridge } = await import('../../lib/cross-protocol-chat-bridge');
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
  app.post('/api/bookmarks', async (c) =>
    withSession(c, () => handleBookmarkAdd(c.req.raw, c.env)),
  );
  app.delete('/api/bookmarks', async (c) =>
    withSession(c, () => handleBookmarkRemove(c.req.raw, c.env)),
  );
  app.get('/api/bookmarks/check', async (c) => handleBookmarkCheck(c.req.raw, c.env));

  // --- API: Follow (protocol-native follow/unfollow) ---
  app.post('/api/follow', async (c) => withSession(c, () => handleFollowAdd(c.req.raw, c.env)));
  app.delete('/api/follow', async (c) =>
    withSession(c, () => handleFollowRemove(c.req.raw, c.env)),
  );
  app.get('/api/follow/list', async (c) => handleFollowList(c.req.raw, c.env));
  app.get('/api/follow/check', async (c) => handleFollowCheck(c.req.raw, c.env));
  app.get('/api/follow/feed', async (c) => handleFollowingFeed(c.req.raw, c.env));

  // --- API: Publish & Engage (session-gated) ---
  app.all('/api/publish', async (c) => withSession(c, () => handlePublish(c.req.raw, c.env)));
  app.all('/api/engage', async (c) => withSession(c, () => handleEngage(c.req.raw, c.env)));

  // --- API: Cross-Publish (one-click multi-protocol) ---
  app.post('/api/publish/all', async (c) => {
    const { handlePublishAll } = await import('../../routes/publish');
    return withSession(c, () => handlePublishAll(c.req.raw, c.env));
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
    return jsonResponse({ batches });
  });
  app.all('/api/crosspost/batch/:batchId', async (c) => {
    const { getCrossPostBatch, deleteCrossPostBatch } = await import(
      '../../lib/cross-publish-orchestrator'
    );
    const batchId = c.req.param('batchId');
    if (c.req.method === 'DELETE') {
      const ok = await deleteCrossPostBatch(batchId, c.env);
      return jsonResponse({ ok });
    }
    const batch = await getCrossPostBatch(batchId, c.env);
    return batch ? jsonResponse(batch) : jsonResponse({ error: 'Batch not found' }, 404);
  });

  // --- API: Tips ---
  app.all('/api/tip/lightning/invoice', async (c) => handleLightningInvoice(c.req.raw, c.env));
  app.all('/api/tip/frame/tx/:id', async (c) => handleTipFrameTx(c.req.raw, c.env));
  app.all('/api/tip/frame/callback/:id', async (c) => handleTipFrameCallback(c.req.raw, c.env));
  app.all('/api/tip/frame/:id', async (c) => handleTipFrame(c.req.raw, c.env));
  app.all('/api/tip/resolve', async (c) => handleTipResolve(c.req.raw, c.env));
  app.all('/api/tip/create', async (c) => withSession(c, () => handleTipCreate(c.req.raw, c.env)));
  app.all('/api/tip/settings', async (c) => {
    if (c.req.method === 'GET') return handleTipSettingsGet(c.req.raw, c.env);
    if (c.req.method === 'POST')
      return withSession(c, () => handleTipSettingsPost(c.req.raw, c.env));
    return methodNotAllowed(['GET', 'POST']);
  });

  // --- API: Tip Notification Preferences ---
  app.all('/api/tip/notifications/prefs', async (c) => {
    const { handleTipNotificationPrefs } = await import('../../lib/tip-notifications');
    return handleTipNotificationPrefs(c.req.raw, c.env);
  });

  // --- API: Unified Tips (cross-platform ledger) ---
  app.post('/api/tip/unified', async (c) =>
    withSession(c, () => handleUnifiedTipCreate(c.req.raw, c.env)),
  );
  app.get('/api/tip/unified/stats', async (c) => handleUnifiedTipStats(c.req.raw, c.env));
  app.get('/api/tip/unified/leaderboard', async (c) =>
    handleUnifiedTipLeaderboard(c.req.raw, c.env),
  );
  app.get('/api/tip/unified/activity', async (c) => handleUnifiedTipActivity(c.req.raw, c.env));

  // --- API: Tip Badges & Extended Leaderboards (gamification) ---
  app.get('/api/tips/badges', async (c) => handleTipBadges(c.req.raw, c.env));
  app.get('/api/tips/leaderboard/protocols', async (c) =>
    handleTipLeaderboardProtocols(c.req.raw, c.env),
  );
  app.get('/api/tips/leaderboard/coins', async (c) => handleTipLeaderboardCoins(c.req.raw, c.env));

  // --- API: Creator Tip Analytics ---
  app.get('/api/tip/unified/analytics', async (c) => handleTipAnalytics(c.req.raw, c.env));
  app.get('/api/tip/unified/analytics/top-tippers', async (c) =>
    handleTopTippers(c.req.raw, c.env),
  );

  // --- API: Wallet-Based Tip Routing ---
  app.get('/api/tip/wallet-route', async (c) => handleWalletRoute(c.req.raw, c.env));
  app.post('/api/tip/wallet-route/execute', async (c) =>
    handleWalletRouteExecute(c.req.raw, c.env),
  );
  app.post('/api/tip/wallet-route/link', async (c) => handleWalletRouteLink(c.req.raw, c.env));

  // --- API: Tip Streaks & Incentives ---
  app.get('/api/tip/streak', async (c) => handleGetStreak(c.req.raw, c.env));
  app.get('/api/tip/goal', async (c) => handleGetGoal(c.req.raw, c.env));
  app.post('/api/tip/goal', async (c) => handleSetGoal(c.req.raw, c.env));
  app.get('/api/tip/post-leaderboard', async (c) => handlePostLeaderboard(c.req.raw, c.env));
  app.get('/api/tip/streak-badges', async (c) => handleStreakBadges(c.req.raw));

  // --- API: Lemmy Discover ---
  app.get('/api/lemmy/discover', async (c) => handleLemmyDiscover(c.req.raw, c.env));

  // --- API: Lemmy Tips ---
  app.all('/api/lemmy/tip/leaderboard', async (c) => handleLemmyTipLeaderboard(c.req.raw, c.env));
  app.all('/api/lemmy/tip/stats', async (c) => handleLemmyTipStats(c.req.raw, c.env));
  app.all('/api/lemmy/tip', async (c) =>
    withSession(c, () => handleLemmyTipCreate(c.req.raw, c.env)),
  );

  // --- API: Lemmy Feed & Community ---
  app.get('/api/lemmy/feed', async (c) => handleLemmyFeed(c.req.raw, c.env));
  app.get('/api/lemmy/trending', async (c) => handleLemmyTrending(c.req.raw, c.env));
  app.get('/api/lemmy/instances', async (c) => handleLemmyInstances(c.req.raw, c.env));
  app.get('/api/lemmy/community/:name', async (c) =>
    handleLemmyCommunity(c.req.raw, c.env, c.req.param('name')),
  );
  app.get('/api/lemmy/post/:id', async (c) =>
    handleLemmyPostById(c.req.raw, c.env, c.req.param('id')),
  );

  // --- API: Lemmy Write (session-gated) ---
  app.post('/api/lemmy/post', async (c) =>
    withSession(c, () => handleLemmyPostCreate(c.req.raw, c.env)),
  );
  app.post('/api/lemmy/comment', async (c) =>
    withSession(c, () => handleLemmyCommentCreate(c.req.raw, c.env)),
  );

  // --- API: Lemmy Bridge (cross-post & share) ---
  app.post('/api/lemmy/bridge/cross-post', async (c) =>
    withSession(c, () => handleLemmyBridgeCrossPost(c.req.raw, c.env)),
  );
  app.post('/api/lemmy/bridge/share', async (c) =>
    withSession(c, () => handleLemmyBridgeShare(c.req.raw, c.env)),
  );
  app.get('/api/lemmy/bridge/status', async (c) => handleLemmyBridgeStatus(c.req.raw, c.env));

  // --- API: PeerTube Tips ---
  app.post('/api/peertube/tip', async (c) =>
    withSession(c, () => handlePeerTubeTipCreate(c.req.raw, c.env)),
  );
  app.get('/api/peertube/tip/stats', async (c) => handlePeerTubeTipStats(c.req.raw, c.env));
  app.get('/api/peertube/tip/leaderboard', async (c) =>
    handlePeerTubeLeaderboard(c.req.raw, c.env),
  );

  // --- API: Bluesky Tips ---
  app.post('/api/bluesky/tip', async (c) =>
    withSession(c, () => handleBlueskyTipCreate(c.req.raw, c.env)),
  );
  app.get('/api/bluesky/tip/stats', async (c) => handleBlueskyTipStats(c.req.raw, c.env));
  app.get('/api/bluesky/tip/leaderboard', async (c) => handleBlueskyLeaderboard(c.req.raw, c.env));

  // --- API: Mastodon Tips ---
  app.post('/api/mastodon/tip', async (c) =>
    withSession(c, () => handleMastodonTipCreate(c.req.raw, c.env)),
  );
  app.get('/api/mastodon/tip/stats', async (c) => handleMastodonTipStats(c.req.raw, c.env));
  app.get('/api/mastodon/tip/leaderboard', async (c) =>
    handleMastodonLeaderboard(c.req.raw, c.env),
  );

  // --- API: Cross-Chain Tip Routing ---
  app.post('/api/tip/cross-chain', async (c) => {
    const { handleCrossChainTip } = await import('../../routes/unified-tip');
    return withSession(c, () => handleCrossChainTip(c.req.raw, c.env));
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
  app.post('/api/identity/link', async (c) =>
    withSession(c, () => handleLinkIdentity(c.req.raw, c.env)),
  );
  app.delete('/api/identity/link', async (c) =>
    withSession(c, () => handleUnlinkIdentity(c.req.raw, c.env)),
  );

  // --- API: Identity Extensions (AT Protocol, Zora, Telegram) ---
  app.post('/api/identity/extensions/link/atproto', async (c) =>
    withSession(c, () => handleLinkAtproto(c.req.raw, c.env)),
  );
  app.post('/api/identity/extensions/create/atproto', async (c) =>
    withSession(c, () => handleCreateAtproto(c.req.raw, c.env)),
  );
  app.post('/api/identity/extensions/link/zora', async (c) =>
    withSession(c, () => handleLinkZora(c.req.raw, c.env)),
  );
  app.get('/api/identity/extensions/resolve/zora', async (c) =>
    handleResolveZora(c.req.raw, c.env),
  );
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

  // --- API: Identity Auto-Discovery ---
  app.post('/api/identity/discover', async (c) =>
    withSession(c, () => handleIdentityDiscover(c.req.raw, c.env)),
  );
  app.post('/api/identity/link-all', async (c) =>
    withSession(c, () => handleIdentityLinkAll(c.req.raw, c.env)),
  );
  app.get('/api/identity/discovery/status', async (c) =>
    handleIdentityDiscoveryStatus(c.req.raw, c.env),
  );

  // --- API: Blink ---
  app.all('/api/blink/tip', async (c) => handleBlinkTip(c.req.raw, c.env));

  // --- API: Algorithm Control (user-controlled feed) ---
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

  // --- API: x402 ---
  app.all('/api/x402/paywall', async (c) => handleX402Paywall(c.req.raw, c.env));
  app.all('/api/x402/verify', async (c) => handleX402Verify(c.req.raw, c.env));

  // --- API: Cross-Platform Registration ---
  app.all('/api/register-platform', async (c) =>
    withSession(c, () => handleRegisterPlatform(c.req.raw, c.env)),
  );
  app.get('/api/register-platform/status', async (c) =>
    handleRegisterPlatformStatus(c.req.raw, c.env),
  );
  app.get('/api/register-platform/bluesky-pool', async (c) =>
    handleBlueskyPoolStats(c.req.raw, c.env),
  );

  // --- API: Concierge Registration (register-all) ---
  app.route('/api/register', registerAll);

  // --- API: Permanence (Arweave/IPFS) ---
  app.post('/api/permanence/store', async (c) =>
    withSession(c, () => handlePermanenceStore(c.req.raw, c.env)),
  );
  app.get('/api/permanence/verify/:hash', async (c) =>
    handlePermanenceVerify(c.req.raw, c.env, c.req.param('hash')),
  );
  app.post('/api/permanence/anchor', async (c) =>
    withSession(c, () => handlePermanenceAnchor(c.req.raw, c.env)),
  );

  // --- API: Discord Integration ---
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
  app.delete('/api/discord/connection', async (c) =>
    handleDiscordDisconnectOAuth(c.req.raw, c.env),
  );

  // --- API: Telegram Bot Integration ---
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

  // --- API: Matrix Integration ---
  app.post('/api/matrix/connect', async (c) => handleMatrixConnect(c.req.raw, c.env));
  app.post('/api/matrix/send', async (c) => handleMatrixSendMessage(c.req.raw, c.env));
  app.get('/api/matrix/rooms', async (c) => handleMatrixRoomsList(c.req.raw, c.env));
  app.delete('/api/matrix/disconnect', async (c) => handleMatrixDisconnect(c.req.raw, c.env));
  app.post('/api/matrix/bridge', async (c) => handleMatrixBridgeMessages(c.req.raw, c.env));

  // --- API: Webhook System ---
  app.post('/api/webhooks/create', async (c) => withSession(c, () => handleWebhookCreate(c.req.raw, c.env)));
  app.post('/api/webhooks/test', async (c) => handleWebhookTest(c.req.raw, c.env));
  app.get('/api/webhooks', async (c) => handleWebhookList(c.req.raw, c.env));
  app.delete('/api/webhooks', async (c) => handleWebhookDelete(c.req.raw, c.env));
  app.post('/api/webhooks/trigger', async (c) => withSession(c, () => handleWebhookTrigger(c.req.raw, c.env)));

  // --- API: GitHub Integration ---
  app.post('/api/github/connect', async (c) => handleGitHubConnect(c.req.raw, c.env));
  app.post('/api/github/repo-activity', async (c) => handleGitHubRepoActivity(c.req.raw, c.env));
  app.delete('/api/github/disconnect', async (c) => handleGitHubDisconnect(c.req.raw, c.env));
  app.get('/api/github/accounts', async (c) => handleGitHubConnectedAccounts(c.req.raw, c.env));
  app.post('/api/github/bridge', async (c) => handleGitHubBridgeActivity(c.req.raw, c.env));

  // --- API: Gamification (Streaks / Achievements / XP / Social Proof) ---
  app.all('/api/gamification/streak', async (c) => handleStreakCheck(c.req.raw, c.env));
  app.all('/api/gamification/streak/leaderboard', async (c) =>
    handleStreakLeaderboard(c.req.raw, c.env),
  );
  app.all('/api/gamification/achievements', async (c) => handleAchievements(c.req.raw, c.env));
  app.all('/api/gamification/achievements/check', async (c) =>
    handleAchievementCheck(c.req.raw, c.env),
  );
  app.all('/api/gamification/challenges/today', async (c) =>
    handleChallengesToday(c.req.raw, c.env),
  );
  app.all('/api/gamification/challenges/progress', async (c) =>
    handleChallengeProgress(c.req.raw, c.env),
  );
  app.all('/api/gamification/xp', async (c) => handleXp(c.req.raw, c.env));
  app.all('/api/gamification/xp/award', async (c) => handleXpAward(c.req.raw, c.env));
  app.all('/api/gamification/social-proof', async (c) => handleSocialProof(c.req.raw, c.env));
  app.all('/api/gamification/activity', async (c) => handleActivityRecord(c.req.raw, c.env));
  app.all('/api/gamification/activity/recent', async (c) => handleRecentActivity(c.req.raw, c.env));

  // --- API: Communities (cross-protocol) ---
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

  // --- API: Governance (DAOs) ---
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

  // --- API: Cross-Post to Centralized Platforms ---
  app.post('/api/cross-post/medium', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'medium')),
  );
  app.post('/api/cross-post/substack', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'substack')),
  );
  app.post('/api/cross-post/youtube', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'youtube')),
  );
  app.post('/api/cross-post/tiktok', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'tiktok')),
  );
  app.post('/api/cross-post/instagram', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'instagram')),
  );
  app.post('/api/cross-post/linkedin', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'linkedin')),
  );
  app.post('/api/cross-post/reddit', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'reddit')),
  );
  app.post('/api/cross-post/pinterest', async (c) =>
    withSession(c, () => handleCrossPostCentralized(c.req.raw, c.env, 'pinterest')),
  );

  // --- API: Platform Limits (for UI content adaptation) ---
  app.get('/api/cross-post/limits', async (_c) => {
    const { PLATFORM_LIMITS } = await import('../../routes/cross-post-centralized');
    return jsonResponse({ limits: PLATFORM_LIMITS });
  });

  // --- API: Reputation ---
  app.get('/api/reputation/leaderboard', async (c) =>
    handleReputationLeaderboard(c.req.raw, c.env),
  );
  app.post('/api/reputation/earn', async (c) => withSession(c, () => handleReputationEarn(c.req.raw, c.env)));
  app.post('/api/reputation/slash', async (c) => withSession(c, () => handleReputationSlash(c.req.raw, c.env)));
  app.post('/api/reputation/stake', async (c) => withSession(c, () => handleReputationStake(c.req.raw, c.env)));
  app.post('/api/reputation/stake/resolve', async (c) =>
    handleReputationStakeResolve(c.req.raw, c.env),
  );
  app.get('/api/reputation/:userId/history', async (c) =>
    handleReputationHistory(c.req.raw, c.env, c.req.param('userId')),
  );
  app.get('/api/reputation/:userId/stakes', async (c) =>
    handleReputationStakes(c.req.raw, c.env, c.req.param('userId')),
  );
  app.get('/api/reputation/:userId', async (c) =>
    handleReputationGet(c.req.raw, c.env, c.req.param('userId')),
  );

  // --- Feed cache management ---
  app.post('/api/sso/provision', async (c) => handleSSOProvision(c.req.raw, c.env));
  app.post('/api/sso/provision/:protocol', async (c) => handleSSOProvisionSingle(c.req.raw, c.env));
  app.get('/api/sso/dashboard', async (c) => handleSSODashboard(c.req.raw, c.env));
  app.post('/api/sso/session/create', async (c) => handleSSOSessionCreate(c.req.raw, c.env));
  app.post('/api/sso/session/verify', async (c) => handleSSOSessionVerify(c.req.raw, c.env));
  app.post('/api/sso/session/refresh', async (c) => handleSSOSessionRefresh(c.req.raw, c.env));
  app.post('/api/sso/session/revoke', async (c) => handleSSOSessionRevoke(c.req.raw, c.env));
  app.post('/api/sso/session/revoke-all', async (c) => handleSSOSessionRevokeAll(c.req.raw, c.env));
  app.get('/api/sso/activity', async (c) => handleSSOActivity(c.req.raw, c.env));
  app.post('/api/sso/activity/record', async (c) => handleSSOActivityRecord(c.req.raw, c.env));
  app.get('/api/sso/export', async (c) => handleSSOExport(c.req.raw, c.env));
  app.post('/api/sso/import', async (c) => handleSSOImport(c.req.raw, c.env));
  app.post('/api/sso/recovery/generate', async (c) => handleSSORecoveryGenerate(c.req.raw, c.env));
  app.post('/api/sso/recovery/restore', async (c) => handleSSORecoveryRestore(c.req.raw, c.env));
  app.get('/api/sso/health', async (c) => handleSSOHealth(c.req.raw, c.env));
  app.post('/api/webhook/realtime/:protocol', async (c) => handleWebhookReceiver(c.req.raw, c.env));
}

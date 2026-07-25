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


export function registerSocialPlatformsRoutes(app: Hono<{ Bindings: Env }>): void {
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

}

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
  handleActivityFeed,
  handleAggregateProfile,
  handleContentPerformance,
  handleRevenueSummary,
  handleSearchProfiles,
  handleSuggestedProfiles,
  handleTrendingProfiles,
} from '../../routes/unified-profile';
import { handleProfileBadges } from '../../routes/unified-profile/badges';
import {
  handleSetPrimary,
  handleSyncProfile,
  handleSyncStatus,
  handleUpdateProfile,
} from '../../routes/unified-profile/sync';
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
import type { Env } from '../../types';

export function registerSocialIdentityRoutes(app: Hono<{ Bindings: Env }>): void {
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

  // --- API: Unified Profile (Aggregated cross-protocol profiles) ---
  app.get('/api/profile/aggregate/:wallet', async (c) => {
    const result = await handleAggregateProfile(c.req.raw, c.env, c.req.param('wallet'));
    return result;
  });
  app.get('/api/profile/badges/:wallet', async (c) => {
    const result = await handleProfileBadges(c.req.raw, c.env, c.req.param('wallet'));
    return result;
  });
  app.get('/api/profile/activity/:wallet', async (c) => {
    const result = await handleActivityFeed(c.req.raw, c.env, c.req.param('wallet'));
    return result;
  });
  app.get('/api/profile/content/:wallet', async (c) => {
    const result = await handleContentPerformance(c.req.raw, c.env, c.req.param('wallet'));
    return result;
  });
  app.get('/api/profile/revenue/:wallet', async (c) => {
    const result = await handleRevenueSummary(c.req.raw, c.env, c.req.param('wallet'));
    return result;
  });

  // --- API: Profile Discovery ---
  app.get('/api/profile/search', async (c) => handleSearchProfiles(c.req.raw, c.env));
  app.get('/api/profile/suggested', async (c) => handleSuggestedProfiles(c.req.raw, c.env));
  app.get('/api/profile/trending', async (c) => handleTrendingProfiles(c.req.raw, c.env));

  // --- API: Profile Sync (session-required) ---
  app.post('/api/profile/sync/:wallet', async (c) => {
    try {
      return await withSession(c, () => handleSyncProfile(c.req.raw, c.env, c.req.param('wallet')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/profile/update/:wallet', async (c) => {
    try {
      return await withSession(c, () =>
        handleUpdateProfile(c.req.raw, c.env, c.req.param('wallet')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/profile/primary/:wallet', async (c) => {
    try {
      return await withSession(c, () => handleSetPrimary(c.req.raw, c.env, c.req.param('wallet')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/profile/sync-status/:wallet', async (c) => {
    const result = await handleSyncStatus(c.req.raw, c.env, c.req.param('wallet'));
    return result;
  });
}

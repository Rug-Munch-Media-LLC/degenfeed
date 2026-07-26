/**
 * @degenfeed/api-worker - Live route registration
 *
 * Register live/streaming-related routes.
 */

import type { Hono } from 'hono';
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
} from '../../lib/video-call';
import { badRequest, ok, serverError } from '../../response-helpers';
import {
  handleRoomCreate,
  handleRoomDelete,
  handleRoomInfo,
  handleRoomInvite,
  handleRoomJoin,
  handleRoomLeave,
  handleRoomMute,
  handleRoomsActive,
} from '../../routes/call-rooms';
import {
  handleCreatorLiveProfile,
  handleGetNotifications,
  handleGetWatchedCreators,
  handleGoLive,
  handleKickChannelStatus,
  handleLiveChatAnalytics,
  handleLiveChatBan,
  handleLiveChatConfig,
  handleLiveChatDelete,
  handleLiveChatExport,
  handleLiveChatMessages,
  handleLiveChatPin,
  handleLiveChatPinned,
  handleLiveChatProtocols,
  handleLiveChatReact,
  handleLiveChatSend,
  handleLiveChatTgLink,
  handleLiveChatTimeout,
  handleLiveChatUnban,
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
  handleSimulcastActive,
  handleSimulcastAnalytics,
  handleSimulcastDetails,
  handleSimulcastHistory,
  handleSimulcastPlatformAction,
  handleSimulcastPlatforms,
  handleSimulcastStart,
  handleSimulcastStop,
  handleSimulcastUpdateMetadata,
  handleStopLive,
  handleStreamRouteStatus,
  handleTelegramWebhookEndpoint,
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
} from '../../routes/live';
import {
  handleGiftEarnings,
  handleGiftHistory,
  handleGiftLeaderboard,
  handleGiftPackages,
  handleGiftPayout,
  handleGiftSend,
  handleGiftTypes,
} from '../../routes/live-gifts';
import liveShorts from '../../routes/live-shorts-index';
import {
  handleActiveStickers,
  handleCreatorContentEarnings,
  handleCreatorCustomGifts,
  handleCreatorEmojis,
  handleCustomGiftBuy,
  handleCustomGiftCreate,
  handleCustomGiftMarketplace,
  handleEmojiBuy,
  handleEmojiCreate,
  handleEmojiMarketplace,
  handleFilterBuy,
  handleFiltersList,
  handleMyEmojis,
  handleMyFilters,
  handleStickerBuy,
  handleStickersList,
  handleStickerTrigger,
} from '../../routes/live-tiktok';
import {
  handleLoopsActive,
  handleLoopsBroadcast,
  handleLoopsBroadcastStatus,
  handleLoopsGoLive,
  handleLoopsHealth,
  handleLoopsPlatforms,
  handleLoopsStopLive,
} from '../../routes/loops-live';
import peertubeRouter from '../../routes/peertube';
import podcastRouter from '../../routes/podcast';
import { handleRealtimeWebSocket } from '../../routes/realtime';
import { withSession } from '../../routes/route-registry';
import {
  handleSpaceAcceptSpeaker,
  handleSpaceAnalytics,
  handleSpaceChatHistory,
  handleSpaceChatReact,
  handleSpaceChatSend,
  handleSpaceChatTip,
  handleSpaceClips,
  handleSpaceCreate,
  handleSpaceCreateClip,
  handleSpaceDeleteMessage,
  handleSpaceDetails,
  handleSpaceEnd,
  handleSpaceInviteSpeaker,
  handleSpaceJoin,
  handleSpaceLeave,
  handleSpaceMuteSpeaker,
  handleSpaceMuteUser,
  handleSpacePinMessage,
  handleSpaceRaiseHand,
  handleSpaceReact,
  handleSpaceRecording,
  handleSpaceRecordingStart,
  handleSpaceRecordingStop,
  handleSpaceRemoveSpeaker,
  handleSpaceRequestSpeak,
  handleSpaceSetFarcasterCast,
  handleSpaceSetNostrEvent,
  handleSpaceSetReminder,
  handleSpaceSpeakersAdd,
  handleSpaceSpeakersRemove,
  handleSpaceStart,
  handleSpacesByCategory,
  handleSpacesLive,
  handleSpacesPast,
  handleSpacesTrending,
  handleSpacesUpcoming,
  handleSpaceTranscript,
} from '../../routes/spaces';
import streams from '../../routes/streams';
import { handleTokenSSE, handleTokenWebSocket } from '../../routes/token-websocket';
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
} from '../../routes/unified-room-routes';
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
} from '../../routes/voice-rooms';
import youtubeRoutes from '../../routes/youtube';
import type { Env } from '../../types';
export function registerLiveRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: YouTube ---
  app.route('/api/youtube', youtubeRoutes);

  // --- API: PeerTube Video Platform (upload, list, live, federation) ---
  app.route('/api/peertube', peertubeRouter);

  // --- API: Podcast Platform (create, manage, Castopod federation) ---
  app.route('/api/podcast', podcastRouter);

  // --- API: Voice & Video Rooms ---
  app.post('/api/voice/create', async (c) => {
    try {
      return await withSession(c, () => handleCreateRoom(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/voice/active', async (c) => {
    try {
      return await withSession(c, () => handleGetActiveRooms(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/voice/:id/join', async (c) => {
    try {
      return await withSession(c, () => handleJoinRoom(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/voice/:id/leave', async (c) => {
    try {
      return await withSession(c, () => handleLeaveRoom(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/voice/:id/update', async (c) => {
    try {
      return await withSession(c, () => handleUpdateState(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/voice/:id/participants', async (c) => {
    try {
      return await withSession(c, () => handleGetParticipants(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/voice/:id/invite', async (c) => {
    try {
      return await withSession(c, () => handleGenerateInvite(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/voice/invite/:code', async (c) => {
    try {
      const result = await handleResolveInvite(c.req.raw, c.env, c.req.param('code'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/voice/:id/signal', async (c) => {
    try {
      return await withSession(c, () => handleSendSignal(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/voice/:id/signals', async (c) => {
    try {
      return await withSession(c, () => handleGetSignals(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Cross-Platform Unified Rooms ---
  app.post('/api/rooms/unified/create', async (c) => {
    try {
      return await withSession(c, () => handleUnifiedRoomCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/rooms/unified/mine', async (c) => {
    try {
      return await withSession(c, () => handleUnifiedRoomMine(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/rooms/unified/:id', async (c) => {
    try {
      return await withSession(c, () => handleUnifiedRoomInfo(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/unified/:id/join', async (c) => {
    try {
      return await withSession(c, () => handleUnifiedRoomJoin(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/unified/:id/leave', async (c) => {
    try {
      return await withSession(c, () =>
        handleUnifiedRoomLeave(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/unified/:id/message', async (c) => {
    try {
      return await withSession(c, () =>
        handleUnifiedRoomMessage(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/rooms/unified/:id/messages', async (c) => {
    try {
      return await withSession(c, () =>
        handleUnifiedRoomMessages(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/unified/:id/invite', async (c) => {
    try {
      return await withSession(c, () =>
        handleUnifiedRoomInvite(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/rooms/unified/:id/transport', async (c) => {
    try {
      return await withSession(c, () =>
        handleUnifiedRoomTransport(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/rooms/unified/:id/unread', async (c) => {
    try {
      return await withSession(c, () =>
        handleUnifiedRoomUnread(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Live Shorts (60s cross-protocol live broadcasting) ---
  app.route('/api/live-shorts', liveShorts);

  // --- API: Live Streaming Hub (Owncast, PeerTube, YouTube, Twitch, Spaces) ---
  app.get('/api/live/now', async (c) => {
    try {
      const result = await handleLiveNow(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/upcoming', async (c) => {
    try {
      const result = await handleLiveUpcoming(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/sources', async (c) => {
    try {
      const result = await handleLiveSources(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/go-live', async (c) => {
    try {
      return await withSession(c, () => handleGoLive(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/stop', async (c) => {
    try {
      return await withSession(c, () =>
        handleStopLive(c.req.raw, c.env, c.req.param('streamId') ?? ''),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/schedule', async (c) => {
    try {
      return await withSession(c, () => handleScheduleStream(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/chat/:id/messages', async (c) => {
    try {
      const result = await handleLiveChatMessages(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/message', async (c) => {
    try {
      const result = await handleLiveChatSend(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/react', async (c) => {
    try {
      const result = await handleLiveChatReact(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/delete', async (c) => {
    try {
      const result = await handleLiveChatDelete(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/pin', async (c) => {
    try {
      const result = await handleLiveChatPin(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/live/chat/:id/pin', async (c) => {
    try {
      const result = await handleLiveChatPin(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/chat/:id/pinned', async (c) => {
    try {
      const result = await handleLiveChatPinned(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/ban', async (c) => {
    try {
      const result = await handleLiveChatBan(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/unban', async (c) => {
    try {
      const result = await handleLiveChatUnban(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/timeout', async (c) => {
    try {
      const result = await handleLiveChatTimeout(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/config', async (c) => {
    try {
      const result = await handleLiveChatConfig(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/chat/:id/analytics', async (c) => {
    try {
      const result = await handleLiveChatAnalytics(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/chat/:id/export', async (c) => {
    try {
      const result = await handleLiveChatExport(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/chat/:id/protocols', async (c) => {
    try {
      const result = await handleLiveChatProtocols(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/:id/tg-link', async (c) => {
    try {
      const result = await handleLiveChatTgLink(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/chat/telegram-webhook', async (c) => {
    try {
      const result = await handleTelegramWebhookEndpoint(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/creators/:id', async (c) => {
    try {
      const result = await handleCreatorLiveProfile(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/viewers/:id', async (c) => {
    try {
      const result = await handleLiveViewersSSE(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Notification Routes ---
  app.post('/api/live/watch', async (c) => {
    try {
      return await withSession(c, () => handleWatchCreator(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/unwatch', async (c) => {
    try {
      const result = await handleUnwatchCreator(c.req.raw, c.env, c.req.param('creatorId') ?? '');
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/watched', async (c) => {
    try {
      const result = await handleGetWatchedCreators(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/watched/live', async (c) => {
    try {
      const result = await handleWatchedLive(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/notifications', async (c) => {
    try {
      const result = await handleGetNotifications(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/notifications/settings', async (c) => {
    try {
      return await withSession(c, () => handleNotificationSettings(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Source-specific Routes ---
  app.get('/api/live/sources/peertube/instances', async (c) => {
    try {
      const result = await handlePeerTubeInstances(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/sources/twitch/curated', async (c) => {
    try {
      const result = await handleTwitchCurated(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/kick/status/:channel', async (c) => {
    try {
      const result = await handleKickChannelStatus(c.req.raw, c.env, c.req.param('channel'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/:id', async (c) => {
    try {
      const result = await handleLiveDetails(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/:id/tip', async (c) => {
    try {
      const result = await handleLiveTip(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Live Gifts — Telegram-Style Gift Economy with Crypto
  // ═══════════════════════════════════════════════════════════════════════
  app.get('/api/live/gifts/types', async (c) => {
    try {
      const result = await handleGiftTypes(c.req.raw);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/gifts/packages', async (c) => {
    try {
      const result = await handleGiftPackages(c.req.raw);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/gifts/send', async (c) => {
    try {
      return await withSession(c, () => handleGiftSend(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/gifts/leaderboard', async (c) => {
    try {
      const result = await handleGiftLeaderboard(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/gifts/history', async (c) => {
    try {
      const result = await handleGiftHistory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/gifts/earnings', async (c) => {
    try {
      const result = await handleGiftEarnings(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/gifts/process-payout', async (c) => {
    try {
      return await withSession(c, () => handleGiftPayout(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TikTok-Style Live Content — Custom Emojis, Gifts, Filters, Stickers
  // ═══════════════════════════════════════════════════════════════════════

  // --- Creator Emojis ---
  app.post('/api/live/emojis/create', async (c) => {
    try {
      return await withSession(c, () => handleEmojiCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/emojis/marketplace', async (c) => {
    try {
      const result = await handleEmojiMarketplace(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/emojis/:id/buy', async (c) => {
    try {
      return await withSession(c, () => handleEmojiBuy(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/emojis/my-purchases', async (c) => {
    try {
      return await withSession(c, () => handleMyEmojis(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/emojis/creator/:creatorId', async (c) => {
    try {
      const result = await handleCreatorEmojis(c.req.raw, c.env, c.req.param('creatorId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Custom Gifts ---
  app.post('/api/live/gifts/custom/create', async (c) => {
    try {
      return await withSession(c, () => handleCustomGiftCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/gifts/custom/marketplace', async (c) => {
    try {
      const result = await handleCustomGiftMarketplace(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/gifts/custom/:creatorId', async (c) => {
    try {
      const result = await handleCreatorCustomGifts(c.req.raw, c.env, c.req.param('creatorId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/gifts/custom/:id/buy', async (c) => {
    try {
      return await withSession(c, () => handleCustomGiftBuy(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Face Filters ---
  app.get('/api/live/filters', async (c) => {
    try {
      const result = await handleFiltersList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/filters/:id/buy', async (c) => {
    try {
      return await withSession(c, () => handleFilterBuy(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/filters/my-filters', async (c) => {
    try {
      return await withSession(c, () => handleMyFilters(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Stickers ---
  app.get('/api/live/stickers', async (c) => {
    try {
      const result = await handleStickersList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/stickers/:id/buy', async (c) => {
    try {
      return await withSession(c, () => handleStickerBuy(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/stickers/:id/trigger', async (c) => {
    try {
      return await withSession(c, () => handleStickerTrigger(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/stickers/active/:streamId', async (c) => {
    try {
      const result = await handleActiveStickers(c.req.raw, c.env, c.req.param('streamId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Creator Content Earnings Dashboard ---
  app.get('/api/live/creator-content/earnings', async (c) => {
    try {
      return await withSession(c, () => handleCreatorContentEarnings(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- WebRTC P2P Streaming ---
  app.post('/api/live/webrtc/offer', async (c) => {
    try {
      return await withSession(c, () => handleWebRTCOffer(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/webrtc/answer', async (c) => {
    try {
      const result = await handleWebRTCAnswer(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/webrtc/ice', async (c) => {
    try {
      const result = await handleWebRTCIce(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/webrtc/offer/:sessionId', async (c) => {
    try {
      const result = await handleWebRTCGetOffer(c.req.raw, c.env, c.req.param('sessionId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/webrtc/viewers', async (c) => {
    try {
      const result = await handleWebRTCViewers(c.req.raw, c.env, c.req.param('streamId') ?? '');
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/live/webrtc/session/:sessionId', async (c) => {
    try {
      const result = await handleWebRTCEnd(c.req.raw, c.env, c.req.param('sessionId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Video Call (WebRTC P2P) ---
  app.post('/api/calls/create', async (c) => {
    try {
      return await withSession(c, () => handleCallCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/calls/:id/join', async (c) => {
    try {
      const result = await handleCallJoin(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/calls/:id/leave', async (c) => {
    try {
      const result = await handleCallLeave(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/calls/:id/status', async (c) => {
    try {
      const result = await handleCallStatus(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/calls/:id/signal', async (c) => {
    try {
      const result = await handleCallSignal(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/calls/:id/signal/poll', async (c) => {
    try {
      const result = await handleCallSignalPoll(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/calls/:id/kick', async (c) => {
    try {
      const result = await handleCallKick(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/calls/:id/mute', async (c) => {
    try {
      const result = await handleCallMute(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/calls/:id/end', async (c) => {
    try {
      const result = await handleCallEnd(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/calls/history', async (c) => {
    try {
      const result = await handleCallHistory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Persistent Call Rooms ---
  app.post('/api/rooms/create', async (c) => {
    try {
      return await withSession(c, () => handleRoomCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/rooms/active', async (c) => {
    try {
      const result = await handleRoomsActive(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/rooms/:id', async (c) => {
    try {
      const result = await handleRoomInfo(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/:id/join', async (c) => {
    try {
      const result = await handleRoomJoin(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/:id/leave', async (c) => {
    try {
      const result = await handleRoomLeave(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/:id/invite', async (c) => {
    try {
      const result = await handleRoomInvite(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/:id/delete', async (c) => {
    try {
      const result = await handleRoomDelete(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/rooms/:id/mute', async (c) => {
    try {
      const result = await handleRoomMute(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Adaptive Streaming Router ---
  app.get('/api/live/route/status/:streamId', async (c) => {
    try {
      const result = await handleStreamRouteStatus(c.req.raw, c.env, c.req.param('streamId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/route/estimate', async (c) => {
    try {
      const result = await handleRouteEstimate(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/route/switch', async (c) => {
    try {
      const result = await handleRouteSwitch(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Private / Token-Gated Streaming ---
  app.post('/api/live/private/configure', async (c) => {
    try {
      return await withSession(c, () => handlePrivateStreamConfigure(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/private/join', async (c) => {
    try {
      return await withSession(c, () =>
        handlePrivateStreamJoin(c.req.raw, c.env, c.req.param('streamId') ?? ''),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/private/config/:streamId', async (c) => {
    try {
      const result = await handlePrivateStreamConfig(c.req.raw, c.env, c.req.param('streamId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/live/private/revoke/:streamId', async (c) => {
    try {
      const result = await handlePrivateStreamRevoke(c.req.raw, c.env, c.req.param('streamId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/private/rotate/:streamId', async (c) => {
    try {
      const result = await handlePrivateStreamRotate(c.req.raw, c.env, c.req.param('streamId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/live/private/viewers/:streamId', async (c) => {
    try {
      const result = await handlePrivateStreamViewers(c.req.raw, c.env, c.req.param('streamId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/private/allowlist', async (c) => {
    try {
      return await withSession(c, () =>
        handlePrivateStreamAllowlist(c.req.raw, c.env, c.req.param('streamId') ?? ''),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: DegenFeed Multi-type Streaming (solo, spaces, collab, coin-launch) ---
  app.route('/api/streams', streams);

  // --- WebSocket: Token real-time updates ---
  app.get('/ws/token/:address', async (c) => {
    try {
      // SSE fallback: check for text/event-stream Accept header
      const accept = c.req.header('accept');
      if (accept?.includes('text/event-stream')) {
        return handleTokenSSE(c.req.raw, c.env);
      }
      // WebSocket upgrade
      return handleTokenWebSocket(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Audio Spaces ---
  app.get('/api/spaces/live', async (c) => handleSpacesLive(c.req.raw, c.env));
  app.get('/api/spaces/upcoming', async (c) => handleSpacesUpcoming(c.req.raw, c.env));
  app.get('/api/spaces/past', async (c) => handleSpacesPast(c.req.raw, c.env));
  app.get('/api/spaces/trending', async (c) => handleSpacesTrending(c.req.raw, c.env));
  app.post('/api/spaces/create', async (c) =>
    withSession(c, () => handleSpaceCreate(c.req.raw, c.env)),
  );
  app.get('/api/spaces/:id', async (c) => handleSpaceDetails(c.req.raw, c.env, c.req.param('id')));
  app.post('/api/spaces/:id/start', async (c) => {
    try {
      return await withSession(c, () => handleSpaceStart(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/end', async (c) => {
    try {
      return await withSession(c, () => handleSpaceEnd(c.req.raw, c.env, c.req.param('id')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/join', async (c) => {
    try {
      const result = await handleSpaceJoin(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/leave', async (c) => {
    try {
      const result = await handleSpaceLeave(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/request-speak', async (c) => {
    try {
      const result = await handleSpaceRequestSpeak(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/invite-speaker', async (c) => {
    try {
      const result = await handleSpaceInviteSpeaker(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/accept-speaker', async (c) => {
    try {
      const result = await handleSpaceAcceptSpeaker(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/remove-speaker', async (c) => {
    try {
      const result = await handleSpaceRemoveSpeaker(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/mute-speaker', async (c) => {
    try {
      const result = await handleSpaceMuteSpeaker(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/raise-hand', async (c) => {
    try {
      const result = await handleSpaceRaiseHand(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/react', async (c) => {
    try {
      const result = await handleSpaceReact(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/spaces/:id/recording', async (c) => {
    try {
      const result = await handleSpaceRecording(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/spaces/:id/transcript', async (c) => {
    try {
      const result = await handleSpaceTranscript(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Chat (rich) ---
  app.post('/api/spaces/:id/chat', async (c) => {
    try {
      const result = await handleSpaceChatSend(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/spaces/:id/chat', async (c) => {
    try {
      const result = await handleSpaceChatHistory(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/chat/pin', async (c) => {
    try {
      const result = await handleSpacePinMessage(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/chat/react', async (c) => {
    try {
      const result = await handleSpaceChatReact(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/chat/tip', async (c) => {
    try {
      const result = await handleSpaceChatTip(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/chat/delete', async (c) => {
    try {
      const result = await handleSpaceDeleteMessage(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/chat/mute', async (c) => {
    try {
      const result = await handleSpaceMuteUser(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Recording ---
  app.post('/api/spaces/:id/record/start', async (c) => {
    try {
      const result = await handleSpaceRecordingStart(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/record/stop', async (c) => {
    try {
      const result = await handleSpaceRecordingStop(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Speakers (add/remove aliases) ---
  app.post('/api/spaces/:id/speakers/add', async (c) => {
    try {
      const result = await handleSpaceSpeakersAdd(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/speakers/remove', async (c) => {
    try {
      const result = await handleSpaceSpeakersRemove(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Reminders ---
  app.post('/api/spaces/:id/remind', async (c) => {
    try {
      const result = await handleSpaceSetReminder(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Cross-Protocol ---
  app.post('/api/spaces/:id/nostr', async (c) => {
    try {
      const result = await handleSpaceSetNostrEvent(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/farcaster', async (c) => {
    try {
      const result = await handleSpaceSetFarcasterCast(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Clips ---
  app.get('/api/spaces/:id/clips', async (c) => {
    try {
      const result = await handleSpaceClips(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/spaces/:id/clips', async (c) => {
    try {
      const result = await handleSpaceCreateClip(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Analytics ---
  app.get('/api/spaces/:id/analytics', async (c) => {
    try {
      const result = await handleSpaceAnalytics(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Spaces Discovery ---
  app.get('/api/spaces/category', async (c) => {
    try {
      const result = await handleSpacesByCategory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  // Alias: /api/spaces/active -> live
  app.get('/api/spaces/active', async (c) => handleSpacesLive(c.req.raw, c.env));
  // Alias: /api/spaces/scheduled -> upcoming
  app.get('/api/spaces/scheduled', async (c) => handleSpacesUpcoming(c.req.raw, c.env));

  // --- API: Loops Live (TikTok-Style Vertical Streaming) ---
  app.post('/api/loops/live/start', async (c) => {
    try {
      return await withSession(c, () => handleLoopsGoLive(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/loops/live/stop', async (c) => {
    try {
      const result = await handleLoopsStopLive(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/loops/live/active', async (c) => {
    try {
      const result = await handleLoopsActive(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/loops/live/broadcast', async (c) => {
    try {
      return await withSession(c, () => handleLoopsBroadcast(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/loops/live/broadcast/:id', async (c) => {
    try {
      const result = await handleLoopsBroadcastStatus(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/loops/live/platforms', async (c) => {
    try {
      const result = await handleLoopsPlatforms(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/loops/live/health', async (c) => {
    try {
      const result = await handleLoopsHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Feed cache management ---
  app.get('/ws/realtime', async (c) => {
    const wsResp = handleRealtimeWebSocket(c.req.raw, c.env);
    if (wsResp) return wsResp;
    return badRequest('WebSocket upgrade failed');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Simulcast — Multi-Platform Live Streaming (Enterprise $20/mo)
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Creator streams to Loops (RTMP), DegenFeed restreams to:
  //   YouTube Live, TikTok Live, Twitch, Kick
  // + announces on: Farcaster, Nostr, Bluesky, Mastodon, PeerTube, Owncast
  //
  // All routes gated behind Enterprise tier via withSession or tier check.

  // --- Start / Stop Simulcast ---
  app.post('/api/live/simulcast/start', async (c) => {
    try {
      return await withSession(c, () => handleSimulcastStart(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/simulcast/stop', async (c) => {
    try {
      return await withSession(c, () => handleSimulcastStop(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Platform Management within Simulcast ---
  app.post('/api/live/simulcast/:id/platform/:platform/:action', async (c) => {
    try {
      return await withSession(c, () =>
        handleSimulcastPlatformAction(
          c.req.raw,
          c.env,
          c.req.param('id'),
          c.req.param('platform'),
          c.req.param('action'),
        ),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Metadata Sync ---
  app.patch('/api/live/simulcast/:id/metadata', async (c) => {
    try {
      return await withSession(c, () =>
        handleSimulcastUpdateMetadata(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Active Simulcast ---
  app.get('/api/live/simulcast/active', async (c) => {
    try {
      const result = await handleSimulcastActive(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Simulcast History ---
  app.get('/api/live/simulcast/history', async (c) => {
    try {
      const result = await handleSimulcastHistory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Simulcast Details ---
  app.get('/api/live/simulcast/:id', async (c) => {
    try {
      const result = await handleSimulcastDetails(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Simulcast Analytics ---
  app.get('/api/live/simulcast/:id/analytics', async (c) => {
    try {
      const result = await handleSimulcastAnalytics(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Available Simulcast Platforms ---
  app.get('/api/live/simulcast/platforms', async (c) => {
    try {
      const result = await handleSimulcastPlatforms(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Platform Connection (for external platform OAuth) ---
  // These delegate to the external-platforms.ts module
  app.get('/api/live/platforms', async (c) => {
    try {
      const { handleListPlatforms } = await import('../../routes/external-platforms');
      const result = await handleListPlatforms(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/live/platforms/connect', async (c) => {
    try {
      const { handleConnectExternalPlatform } = await import('../../routes/external-platforms');
      return await withSession(c, () => handleConnectExternalPlatform(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/live/platforms/:id', async (c) => {
    try {
      const { handleDisconnectPlatform } = await import('../../routes/external-platforms');
      const result = await handleDisconnectPlatform(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

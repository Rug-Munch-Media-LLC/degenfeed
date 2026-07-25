/**
 * @degenfeed/api-worker - Live route registration
 *
 * Register live/streaming-related routes.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';

import { jsonResponse } from '../../index';
import peertubeRouter from '../../routes/peertube';

import podcastRouter from '../../routes/podcast';
import { withSession } from '../../routes/route-registry';
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
import youtubeRoutes from '../../routes/youtube';
import liveShorts from '../../routes/live-shorts-index';
import { handleCreateRoom, handleGetActiveRooms, handleJoinRoom, handleLeaveRoom, handleUpdateState, handleGetParticipants, handleGenerateInvite, handleResolveInvite, handleSendSignal, handleGetSignals } from '../../routes/voice-rooms';
import { handleLiveNow, handleLiveUpcoming, handleLiveSources, handleLiveDetails, handleCreatorLiveProfile, handleGoLive, handleStopLive, handleScheduleStream, handleLiveChatMessages, handleLiveChatSend, handleLiveTip, handleLiveViewersSSE, handleWatchCreator, handleUnwatchCreator, handleGetWatchedCreators, handleGetNotifications, handleNotificationSettings, handleWatchedLive, handlePeerTubeInstances, handleTwitchCurated, handleKickChannelStatus, handleWebRTCOffer, handleWebRTCAnswer, handleWebRTCIce, handleWebRTCGetOffer, handleWebRTCViewers, handleWebRTCEnd, handleStreamRouteStatus, handleRouteEstimate, handleRouteSwitch, handlePrivateStreamConfigure, handlePrivateStreamJoin, handlePrivateStreamConfig, handlePrivateStreamRevoke, handlePrivateStreamRotate, handlePrivateStreamViewers, handlePrivateStreamAllowlist } from '../../routes/live';
import { handleCallCreate, handleCallJoin, handleCallLeave, handleCallStatus, handleCallSignal, handleCallSignalPoll, handleCallKick, handleCallMute, handleCallEnd, handleCallHistory } from '../../lib/video-call';
import { handleRoomCreate, handleRoomsActive, handleRoomInfo, handleRoomJoin, handleRoomLeave, handleRoomInvite, handleRoomDelete, handleRoomMute } from '../../routes/call-rooms';
import { handleSpacesLive, handleSpacesUpcoming, handleSpacesPast, handleSpacesTrending, handleSpaceCreate, handleSpaceDetails, handleSpaceStart, handleSpaceEnd, handleSpaceJoin, handleSpaceLeave, handleSpaceRequestSpeak, handleSpaceInviteSpeaker, handleSpaceAcceptSpeaker, handleSpaceRemoveSpeaker, handleSpaceMuteSpeaker, handleSpaceRaiseHand, handleSpaceReact, handleSpaceRecording, handleSpaceTranscript } from '../../routes/spaces';
import { handleRealtimeWebSocket } from '../../routes/realtime';

export function registerLiveRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: YouTube ---
  app.route('/api/youtube', youtubeRoutes);

  // --- API: PeerTube Video Platform (upload, list, live, federation) ---
  app.route('/api/peertube', peertubeRouter);

  // --- API: Podcast Platform (create, manage, Castopod federation) ---
  app.route('/api/podcast', podcastRouter);

  // --- API: Voice & Video Rooms ---
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

  // --- API: Cross-Platform Unified Rooms ---
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

  // --- API: Live Shorts (60s cross-protocol live broadcasting) ---
  app.route('/api/live-shorts', liveShorts);

  // --- API: Live Streaming Hub (Owncast, PeerTube, YouTube, Twitch, Spaces) ---
  app.get('/api/live/now', async (c) => handleLiveNow(c.req.raw, c.env));
  app.get('/api/live/upcoming', async (c) => handleLiveUpcoming(c.req.raw, c.env));
  app.get('/api/live/sources', async (c) => handleLiveSources(c.req.raw, c.env));
  app.post('/api/live/go-live', async (c) => withSession(c, () => handleGoLive(c.req.raw, c.env)));
  app.post('/api/live/stop', async (c) => withSession(c, () => handleStopLive(c.req.raw, c.env)));
  app.post('/api/live/schedule', async (c) => withSession(c, () => handleScheduleStream(c.req.raw, c.env)));
  app.get('/api/live/chat/:id/messages', async (c) =>
    handleLiveChatMessages(c.req.raw, c.env, c.req.param('id')),
  );
  app.post('/api/live/chat/:id/message', async (c) =>
    handleLiveChatSend(c.req.raw, c.env, c.req.param('id')),
  );
  app.get('/api/live/creators/:id', async (c) =>
    handleCreatorLiveProfile(c.req.raw, c.env, c.req.param('id')),
  );
  app.get('/api/live/viewers/:id', async (c) =>
    handleLiveViewersSSE(c.req.raw, c.env, c.req.param('id')),
  );

  // --- Notification Routes ---
  app.post('/api/live/watch', async (c) => withSession(c, () => handleWatchCreator(c.req.raw, c.env)));
  app.post('/api/live/unwatch', async (c) => handleUnwatchCreator(c.req.raw, c.env));
  app.get('/api/live/watched', async (c) => handleGetWatchedCreators(c.req.raw, c.env));
  app.get('/api/live/watched/live', async (c) => handleWatchedLive(c.req.raw, c.env));
  app.get('/api/live/notifications', async (c) => handleGetNotifications(c.req.raw, c.env));
  app.post('/api/live/notifications/settings', async (c) =>
    withSession(c, () => handleNotificationSettings(c.req.raw, c.env)),
  );

  // --- Source-specific Routes ---
  app.get('/api/live/sources/peertube/instances', async (c) =>
    handlePeerTubeInstances(c.req.raw, c.env),
  );
  app.get('/api/live/sources/twitch/curated', async (c) => handleTwitchCurated(c.req.raw, c.env));
  app.get('/api/live/kick/status/:channel', async (c) =>
    handleKickChannelStatus(c.req.raw, c.env, c.req.param('channel')),
  );
  app.get('/api/live/:id', async (c) => handleLiveDetails(c.req.raw, c.env, c.req.param('id')));
  app.post('/api/live/:id/tip', async (c) => handleLiveTip(c.req.raw, c.env, c.req.param('id')));

  // --- WebRTC P2P Streaming ---
  app.post('/api/live/webrtc/offer', async (c) => withSession(c, () => handleWebRTCOffer(c.req.raw, c.env)));
  app.post('/api/live/webrtc/answer', async (c) => handleWebRTCAnswer(c.req.raw, c.env));
  app.post('/api/live/webrtc/ice', async (c) => handleWebRTCIce(c.req.raw, c.env));
  app.get('/api/live/webrtc/offer/:sessionId', async (c) =>
    handleWebRTCGetOffer(c.req.raw, c.env, c.req.param('sessionId')),
  );
  app.get('/api/live/webrtc/viewers', async (c) => handleWebRTCViewers(c.req.raw, c.env));
  app.delete('/api/live/webrtc/session/:sessionId', async (c) =>
    handleWebRTCEnd(c.req.raw, c.env, c.req.param('sessionId')),
  );

  // --- Video Call (WebRTC P2P) ---
  app.post('/api/calls/create', async (c) => withSession(c, () => handleCallCreate(c.req.raw, c.env)));
  app.post('/api/calls/:id/join', async (c) => handleCallJoin(c.req.raw, c.env, c.req.param('id')));
  app.post('/api/calls/:id/leave', async (c) =>
    handleCallLeave(c.req.raw, c.env, c.req.param('id')),
  );
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

  // --- Persistent Call Rooms ---
  app.post('/api/rooms/create', async (c) => withSession(c, () => handleRoomCreate(c.req.raw, c.env)));
  app.get('/api/rooms/active', async (c) => handleRoomsActive(c.req.raw, c.env));
  app.get('/api/rooms/:id', async (c) => handleRoomInfo(c.req.raw, c.env, c.req.param('id')));
  app.post('/api/rooms/:id/join', async (c) => handleRoomJoin(c.req.raw, c.env, c.req.param('id')));
  app.post('/api/rooms/:id/leave', async (c) =>
    handleRoomLeave(c.req.raw, c.env, c.req.param('id')),
  );
  app.post('/api/rooms/:id/invite', async (c) =>
    handleRoomInvite(c.req.raw, c.env, c.req.param('id')),
  );
  app.post('/api/rooms/:id/delete', async (c) =>
    handleRoomDelete(c.req.raw, c.env, c.req.param('id')),
  );
  app.post('/api/rooms/:id/mute', async (c) => handleRoomMute(c.req.raw, c.env, c.req.param('id')));

  // --- Adaptive Streaming Router ---
  app.get('/api/live/route/status/:streamId', async (c) =>
    handleStreamRouteStatus(c.req.raw, c.env, c.req.param('streamId')),
  );
  app.get('/api/live/route/estimate', async (c) => handleRouteEstimate(c.req.raw, c.env));
  app.post('/api/live/route/switch', async (c) => handleRouteSwitch(c.req.raw, c.env));

  // --- Private / Token-Gated Streaming ---
  app.post('/api/live/private/configure', async (c) =>
    withSession(c, () => handlePrivateStreamConfigure(c.req.raw, c.env)),
  );
  app.post('/api/live/private/join', async (c) => withSession(c, () => handlePrivateStreamJoin(c.req.raw, c.env)));
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
    withSession(c, () => handlePrivateStreamAllowlist(c.req.raw, c.env)),
  );

  // --- API: DegenFeed Multi-type Streaming (solo, spaces, collab, coin-launch) ---
  app.route('/api/streams', streams);

  // --- WebSocket: Token real-time updates ---
  app.get('/ws/token/:address', async (c) => {
    // SSE fallback: check for text/event-stream Accept header
    const accept = c.req.header('accept');
    if (accept?.includes('text/event-stream')) {
      return handleTokenSSE(c.req.raw, c.env);
    }
    // WebSocket upgrade
    return handleTokenWebSocket(c.req.raw, c.env);
  });

  // --- API: Audio Spaces ---
  app.get('/api/spaces/live', async (c) => handleSpacesLive(c.req.raw, c.env));
  app.get('/api/spaces/upcoming', async (c) => handleSpacesUpcoming(c.req.raw, c.env));
  app.get('/api/spaces/past', async (c) => handleSpacesPast(c.req.raw, c.env));
  app.get('/api/spaces/trending', async (c) => handleSpacesTrending(c.req.raw, c.env));
  app.post('/api/spaces/create', async (c) => withSession(c, () => handleSpaceCreate(c.req.raw, c.env)));
  app.get('/api/spaces/:id', async (c) => handleSpaceDetails(c.req.raw, c.env, c.req.param('id')));
  app.post('/api/spaces/:id/start', async (c) =>
    withSession(c, () => handleSpaceStart(c.req.raw, c.env, c.req.param('id'))),
  );
  app.post('/api/spaces/:id/end', async (c) => withSession(c, () => handleSpaceEnd(c.req.raw, c.env, c.req.param('id'))));
  app.post('/api/spaces/:id/join', async (c) =>
    handleSpaceJoin(c.req.raw, c.env, c.req.param('id')),
  );
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

  // --- Feed cache management ---
  app.get('/ws/realtime', async (c) => {
    const wsResp = handleRealtimeWebSocket(c.req.raw, c.env);
    if (wsResp) return wsResp;
    return jsonResponse({ error: 'WebSocket upgrade failed' }, 400);
  });
}

/**
 * @degenfeed/api-worker — Spaces Chat & Reactions
 *
 * Rich chat features: send/receive messages, pinned messages, reply threading,
 * message reactions, tipping in chat, media sharing, chat moderation.
 * Also handles emoji reactions, recording metadata, and AI transcript/summary.
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { broadcastToAll, broadcastToUser } from '../ws-broadcast';
import {
  getSpace, saveSpace, requireSessionAddr, isHostOrCoHost, generateId,
  pushChatMessage, getChatMessages, updateChatMessage,
} from './utils';
import type { SpaceChatMessage, ChatReaction } from './types';
import { methodNotAllowed } from '../response-helpers';

// ──────────────────────────────────────────────
//  CHAT: SEND
// ──────────────────────────────────────────────

export async function handleSpaceChatSend(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      text?: string;
      replyTo?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'link' | 'audio';
      tipAmount?: number;
      tipCurrency?: string;
      tipRecipientId?: string;
    };
    if (!body.text?.trim() && !body.mediaUrl) return jsonResponse({ error: 'Message text or media is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);

    // Check if user is chat-muted
    if (space.chatMutedUsers?.some((u) => u.toLowerCase() === sessionAddr.toLowerCase())) {
      return jsonResponse({ error: 'You are muted in this space' }, 403);
    }

    const message: SpaceChatMessage = {
      id: generateId(),
      userId: sessionAddr,
      username: body.tipRecipientId ? 'Tip' : (space.speakers.find((s) => s.id === sessionAddr)?.displayName || 'Listener'),
      avatarUrl: space.speakers.find((s) => s.id === sessionAddr)?.avatarUrl,
      text: body.text?.trim() || '',
      timestamp: Date.now(),
      isTip: !!body.tipAmount,
      tipAmount: body.tipAmount,
      tipCurrency: body.tipCurrency || 'SOL',
      isPinned: false,
      replyTo: body.replyTo || null,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      deleted: false,
      reactions: [],
    };

    // Store in KV chat log
    await pushChatMessage(env, spaceId, message);

    // Broadcast to all clients
    broadcastToAll('space:chat', { spaceId, message });
    return jsonResponse({ message, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CHAT: HISTORY
// ──────────────────────────────────────────────

export async function handleSpaceChatHistory(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    const messages = await getChatMessages(env, spaceId);
    // Filter out deleted messages unless they are referenced
    const visible = messages.filter((m) => !m.deleted);
    return noCacheJsonResponse({ messages: visible, pinnedMessageIds: space.pinnedMessages || [] });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CHAT: PIN MESSAGE
// ──────────────────────────────────────────────

export async function handleSpacePinMessage(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { messageId?: string; pin?: boolean };
    if (!body.messageId) return jsonResponse({ error: 'messageId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can pin messages' }, 403);
    if (!space.pinnedMessages) space.pinnedMessages = [];
    const isPinning = body.pin !== false;

    if (isPinning) {
      if (!space.pinnedMessages.includes(body.messageId)) {
        space.pinnedMessages.push(body.messageId);
      }
    } else {
      space.pinnedMessages = space.pinnedMessages.filter((id) => id !== body.messageId);
    }

    // Also update the message itself
    await updateChatMessage(env, spaceId, body.messageId, (msg) => {
      msg.isPinned = isPinning;
      return msg;
    });
    await saveSpace(env, space);

    broadcastToAll('space:update', {
      spaceId, status: isPinning ? 'message-pinned' : 'message-unpinned',
      messageId: body.messageId, userId: sessionAddr,
    });
    return jsonResponse({ pinnedMessages: space.pinnedMessages, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CHAT: REACT TO MESSAGE
// ──────────────────────────────────────────────

export async function handleSpaceChatReact(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { messageId?: string; emoji?: string };
    if (!body.messageId || !body.emoji) return jsonResponse({ error: 'messageId and emoji are required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    const updated = await updateChatMessage(env, spaceId, body.messageId, (msg) => {
      // Toggle: if same user+emoji exists, remove it (toggle off)
      const existingIdx = msg.reactions.findIndex(
        (r) => r.userId.toLowerCase() === sessionAddr.toLowerCase() && r.emoji === body.emoji,
      );
      if (existingIdx !== -1) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        msg.reactions.push({ userId: sessionAddr, emoji: body.emoji!, timestamp: Date.now() });
      }
      return msg;
    });
    if (!updated) return jsonResponse({ error: 'Message not found' }, 404);

    broadcastToAll('space:update', {
      spaceId, status: 'message-reacted',
      messageId: body.messageId, emoji: body.emoji, userId: sessionAddr,
    });
    return jsonResponse({ message: updated, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CHAT: DELETE/MODERATE
// ──────────────────────────────────────────────

export async function handleSpaceDeleteMessage(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { messageId?: string };
    if (!body.messageId) return jsonResponse({ error: 'messageId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    const updated = await updateChatMessage(env, spaceId, body.messageId, (msg) => {
      // Allow deletion by message author or host/co-host
      const isAuthor = msg.userId.toLowerCase() === sessionAddr.toLowerCase();
      const isMod = isHostOrCoHost(sessionAddr, space);
      if (!isAuthor && !isMod) throw new Error('Not authorized to delete this message');
      msg.deleted = true;
      msg.text = '[deleted]';
      return msg;
    });
    if (!updated) return jsonResponse({ error: 'Message not found' }, 404);

    broadcastToAll('space:update', {
      spaceId, status: 'message-deleted', messageId: body.messageId,
    });
    return jsonResponse({ ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CHAT: MUTE USER
// ──────────────────────────────────────────────

export async function handleSpaceMuteUser(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string; mute?: boolean };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can mute users' }, 403);

    if (!space.chatMutedUsers) space.chatMutedUsers = [];
    const isMuting = body.mute !== false;
    const addr = body.userId.toLowerCase();
    if (isMuting) {
      if (!space.chatMutedUsers.includes(addr)) space.chatMutedUsers.push(addr);
    } else {
      space.chatMutedUsers = space.chatMutedUsers.filter((u) => u !== addr);
    }
    await saveSpace(env, space);

    broadcastToAll('space:update', {
      spaceId, status: isMuting ? 'user-muted' : 'user-unmuted',
      userId: body.userId, modId: sessionAddr,
    });
    return jsonResponse({ chatMutedUsers: space.chatMutedUsers, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CHAT: TIP IN CHAT
// ──────────────────────────────────────────────

export async function handleSpaceChatTip(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      recipientId?: string;
      amount?: number;
      currency?: string;
      messageId?: string;
    };
    if (!body.recipientId || !body.amount) return jsonResponse({ error: 'recipientId and amount are required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!space.tippingEnabled) return jsonResponse({ error: 'Tipping is disabled in this space' }, 400);

    const recipient = space.speakers.find((s) => s.id.toLowerCase() === body.recipientId?.toLowerCase());
    if (!recipient) return jsonResponse({ error: 'Recipient not found' }, 404);

    // Create a tip message in chat
    const tipMessage: SpaceChatMessage = {
      id: generateId(),
      userId: sessionAddr,
      username: space.speakers.find((s) => s.id === sessionAddr)?.displayName || 'Listener',
      avatarUrl: space.speakers.find((s) => s.id === sessionAddr)?.avatarUrl,
      text: `Sent ${body.amount} ${body.currency || 'SOL'} tip to ${recipient.displayName}!`,
      timestamp: Date.now(),
      isTip: true,
      tipAmount: body.amount,
      tipCurrency: body.currency || 'SOL',
      isPinned: false,
      replyTo: body.messageId || null,
      deleted: false,
      reactions: [],
    };
    await pushChatMessage(env, spaceId, tipMessage);

    broadcastToAll('space:chat', { spaceId, message: tipMessage });
    broadcastToUser(body.recipientId, 'space:tip', {
      spaceId, amount: body.amount, currency: body.currency || 'SOL', fromUserId: sessionAddr,
    });
    return jsonResponse({ message: tipMessage, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  EMOJI REACTIONS (legacy, to space itself)
// ──────────────────────────────────────────────

export async function handleSpaceReact(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string; emoji?: string };
    if (!body.emoji) return jsonResponse({ error: 'emoji is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);
    space.reactions.push({ userId: sessionAddr, emoji: body.emoji, createdAt: Date.now() });
    if (space.reactions.length > 50) space.reactions = space.reactions.slice(-50);
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'react', userId: sessionAddr, emoji: body.emoji });
    return jsonResponse({ space, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  RECORDING
// ──────────────────────────────────────────────

export async function handleSpaceRecordingStart(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can start recording' }, 403);
    if (space.recording?.startedAt && !space.recording.endedAt) return jsonResponse({ error: 'Recording already in progress' }, 400);
    if (!space.isRecorded) return jsonResponse({ error: 'Recording is disabled for this space' }, 400);

    space.recording = {
      ...space.recording,
      startedAt: Date.now(),
    };
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'recording-started', userId: sessionAddr });
    return jsonResponse({ recording: space.recording, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceRecordingStop(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can stop recording' }, 403);
    if (!space.recording?.startedAt) return jsonResponse({ error: 'No recording in progress' }, 400);

    space.recording.endedAt = Date.now();
    space.recording.duration = Math.floor((space.recording.endedAt - space.recording.startedAt) / 1000);
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'recording-stopped', userId: sessionAddr, duration: space.recording.duration });
    return jsonResponse({ recording: space.recording, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceRecording(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!space.recording?.url && !space.recording?.startedAt) return jsonResponse({ error: 'Recording not available yet' }, 404);
    return noCacheJsonResponse({
      recording: space.recording,
      space: { id: space.id, title: space.title, hostName: space.hostName, hostAvatarUrl: space.hostAvatarUrl, createdAt: space.createdAt },
    });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  TRANSCRIPT
// ──────────────────────────────────────────────

export async function handleSpaceTranscript(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'GET') return methodNotAllowed(['GET', 'POST']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (request.method === 'GET') {
      if (space.transcript) return noCacheJsonResponse({ transcript: space.transcript, summary: space.summary });
      return jsonResponse({ error: 'Transcript not available yet' }, 404);
    }
    const sessionAddr = await requireSessionAddr(request, env);
    if (sessionAddr instanceof Response) return sessionAddr;
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can request transcript' }, 403);
    if (space.status !== 'ended') return jsonResponse({ error: 'Space must be ended before generating transcript' }, 400);
    if (!space.recording?.url) return jsonResponse({ error: 'No recording available to transcribe' }, 400);
    space.transcript = 'Transcript generation pending — AI service integration required.';
    space.summary = 'Summary generation pending — AI service integration required.';
    await saveSpace(env, space, 604800);
    return jsonResponse({ ok: true, message: 'Transcript generation queued', spaceId });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  CLIPS
// ──────────────────────────────────────────────

export async function handleSpaceCreateClip(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { title?: string; startTime?: number; endTime?: number };
    if (!body.title || body.startTime === undefined || body.endTime === undefined) {
      return jsonResponse({ error: 'title, startTime, and endTime are required' }, 400);
    }
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (body.endTime <= body.startTime) return jsonResponse({ error: 'endTime must be after startTime' }, 400);

    if (!space.clips) space.clips = [];
    const clip = {
      id: generateId(),
      spaceId,
      title: body.title,
      startTime: body.startTime,
      endTime: body.endTime,
      createdBy: sessionAddr,
      createdAt: Date.now(),
      duration: body.endTime - body.startTime,
      viewCount: 0,
    };
    space.clips.push(clip);
    if (space.clips.length > 100) space.clips = space.clips.slice(-100);
    await saveSpace(env, space, 604800);

    return jsonResponse({ clip, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceClips(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    return noCacheJsonResponse({ clips: space.clips || [] });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

// ──────────────────────────────────────────────
//  ANALYTICS
// ──────────────────────────────────────────────

export async function handleSpaceAnalytics(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    const messages = await getChatMessages(env, spaceId);
    const totalTips = messages.filter((m) => m.isTip);
    const tipAmountTotal = totalTips.reduce((sum, m) => sum + (m.tipAmount || 0), 0);

    const analytics = {
      peakListeners: space.listeners,
      totalUniqueListeners: space.listeners,
      totalChatMessages: messages.length,
      totalTips: totalTips.length,
      tipAmountTotal,
      tipCurrency: 'SOL',
      averageListenDuration: space.startedAt && space.endedAt ? (space.endedAt - space.startedAt) / 1000 / Math.max(space.listeners, 1) : 0,
      engagementScore: Math.round((messages.length + totalTips.length * 5 + space.reactions.length * 2) / Math.max(space.listeners, 1) * 100) / 100,
      reactionCount: space.reactions.length,
      handRaiseCount: space.handRaised.length,
      clipCount: space.clips?.length || 0,
    };
    return noCacheJsonResponse({ analytics });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

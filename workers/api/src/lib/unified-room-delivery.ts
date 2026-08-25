/**
 * @degenfeed/api-worker — Unified Room Message Delivery
 *
 * Fan-out messages to all room members via their preferred transports.
 * Supports: Nostr DM, Matrix DM, Farcaster cast, Bluesky DM, Telegram, WebSocket.
 */

import type { Env } from '../types';
import { MAX_MESSAGE_HISTORY, messagesKey } from './unified-room-constants';
import type {
  MemberDeliveryStatus,
  RoomMember,
  RoomMessage,
  RoomTransport,
  UnifiedRoom,
} from './unified-room-types';

// ─── Public Entry Point ─────────────────────────────────

export async function sendRoomMessage(
  env: Env,
  roomId: string,
  fromId: string,
  content: string,
  sourceTransport: RoomTransport = 'web',
  replyTo?: string,
): Promise<RoomMessage> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const { getUnifiedRoom } = await import('./unified-room-management');
  const { getRoomKey } = await import('./unified-room-keys');
  const { importRoomKey, encryptMessageContent } = await import('./unified-room-crypto');
  const { resolveMentions } = await import('./unified-room-mentions');

  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');
  const sender = room.members.find((m) => m.id === fromId.toLowerCase());
  if (!sender) throw new Error('[uroom] Not a member');

  const roomKeyStr = await getRoomKey(env, roomId, fromId);
  if (!roomKeyStr) throw new Error('[uroom] Cannot access room key');

  const key = await importRoomKey(roomKeyStr);
  const mentions = resolveMentions(content, room.members);
  const { encryptedContent, iv } = await encryptMessageContent(content, key);

  const msgId = crypto.randomUUID();
  const now = Date.now();

  const deliveryStatus: Record<string, MemberDeliveryStatus> = {};
  for (const member of room.members) {
    if (member.id === fromId.toLowerCase()) {
      deliveryStatus[member.id] = {
        transport: member.transport,
        ok: true,
        nativeId: msgId,
        attemptedAt: now,
        deliveredAt: now,
      };
      continue;
    }
    deliveryStatus[member.id] = {
      transport: member.transport,
      ok: false,
      error: 'pending',
      attemptedAt: now,
    };
  }

  const message: RoomMessage = {
    id: msgId,
    roomId,
    fromId: fromId.toLowerCase(),
    fromName: sender.displayName || fromId.slice(0, 10),
    content,
    encryptedContent,
    iv,
    keyVersion: room.keyVersion,
    createdAt: now,
    deliveryStatus,
    replyTo,
    mentions: mentions.map((m) => m.memberId).filter(Boolean) as string[],
    sourceTransport,
  };

  const msgsKey = messagesKey(roomId);
  const msgsRaw = await env.CACHE.get(msgsKey);
  const messages: RoomMessage[] = msgsRaw ? JSON.parse(msgsRaw) : [];
  messages.push(message);
  await env.CACHE.put(msgsKey, JSON.stringify(messages.slice(-MAX_MESSAGE_HISTORY)), {
    expirationTtl: 86400 * 90,
  });

  await fanOutMessage(env, room, message);
  room.lastActivity = now;
  const { roomKey } = await import('./unified-room-constants');
  await env.CACHE?.put(roomKey(room.id), JSON.stringify(room), { expirationTtl: 86400 * 365 });

  return message;
}

// ─── Fan-out ────────────────────────────────────────────

async function fanOutMessage(env: Env, room: UnifiedRoom, message: RoomMessage): Promise<void> {
  const deliverableMembers = room.members.filter(
    (m) => m.id !== message.fromId && m.transport !== 'web',
  );
  if (deliverableMembers.length === 0) return;

  const results = await Promise.allSettled(
    deliverableMembers.map(async (member) => {
      const result = await deliverToMember(env, room, message, member);
      return { memberId: member.id, result };
    }),
  );

  const msgsKey = messagesKey(room.id);
  if (!env.CACHE) return;
  const msgsRaw = await env.CACHE.get(msgsKey);
  if (!msgsRaw) return;
  const messages: RoomMessage[] = JSON.parse(msgsRaw);
  const storedMsg = messages.find((m) => m.id === message.id);
  if (!storedMsg) return;

  for (const settled of results) {
    if (settled.status === 'fulfilled') {
      storedMsg.deliveryStatus[settled.value.memberId] = settled.value.result;
    }
  }
  await env.CACHE.put(msgsKey, JSON.stringify(messages.slice(-MAX_MESSAGE_HISTORY)), {
    expirationTtl: 86400 * 90,
  });
}

async function deliverToMember(
  env: Env,
  room: UnifiedRoom,
  message: RoomMessage,
  member: RoomMember,
): Promise<MemberDeliveryStatus> {
  const fallbackOrder: RoomTransport[] = [member.transport, 'web'];

  for (const transport of fallbackOrder) {
    try {
      let result: MemberDeliveryStatus | null = null;
      switch (transport) {
        case 'nostr':
          result = await deliverViaNostr(env, member, message, room);
          break;
        case 'matrix':
          result = await deliverViaMatrix(env, member, message, room);
          break;
        case 'farcaster':
          result = await deliverViaFarcaster(env, member, message, room);
          break;
        case 'bluesky':
          result = await deliverViaBluesky(env, member, message, room);
          break;
        case 'telegram':
          result = await deliverViaTelegram(env, member, message, room);
          break;
        case 'web':
          result = await deliverViaWebSocket(env, member, message);
          break;
      }
      if (result?.ok) return result;
    } catch (err) {
      console.error(`[uroom] ${transport} delivery failed for ${member.id}:`, err);
    }
  }

  return {
    transport: member.transport,
    ok: false,
    error: 'All transports failed',
    attemptedAt: Date.now(),
  };
}

// ─── Nostr DM ───────────────────────────────────────────

async function deliverViaNostr(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.nostr?.npub) return null;
  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const senderNsec = await env.CACHE?.get('nostr:sender:nsec');
    if (!senderNsec) return null;
    const recipientPubkey = member.identity.nostr.pubkey;
    const relays = member.identity.nostr.relays ?? [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
    ];
    const displayText = `[${room.name}] ${message.fromName}: ${message.content}`;
    const truncatedText = displayText.length > 200 ? `${displayText.slice(0, 200)}…` : displayText;
    // NIP-04/17 encryption not implemented in this env — deliver the room
    // message as a kind-1 note referencing the recipient (real SDK APIs).
    const ev = nostr.signEvent(
      {
        pubkey: '',
        kind: 1,
        tags: [['p', recipientPubkey]],
        content: truncatedText,
        created_at: Math.floor(Date.now() / 1000),
      },
      senderNsec,
    );
    const pool = new nostr.RelayPool(relays, { eoseTimeout: 5000 });
    await pool.publish(ev);
    pool.disconnectAll();
    return {
      transport: 'nostr',
      ok: true,
      nativeId: ev.id,
      attemptedAt: Date.now(),
      deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'nostr',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

// ─── Matrix DM ──────────────────────────────────────────

async function deliverViaMatrix(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.matrix?.userId) return null;
  try {
    const accessToken = env.MATRIX_ACCESS_TOKEN || (await env.CACHE?.get('matrix:access_token'));
    const homeserver =
      member.identity.matrix.homeserver ||
      env.MATRIX_INSTANCE_URL ||
      'https://matrix.degenfeed.xyz';
    if (!accessToken) return null;
    const displayText = `**${room.name}** ${message.fromName}: ${message.content}`;
    const createRes = await fetch(`${homeserver}/_matrix/client/v3/createRoom`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        preset: 'trusted_private_chat',
        invite: [member.identity.matrix.userId],
        is_direct: true,
        name: `DegenFeed: ${room.name}`,
      }),
    });
    if (!createRes.ok) {
      const sendRes = await fetch(
        `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(member.identity.matrix.userId)}/send/m.room.message`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ msgtype: 'm.text', body: displayText }),
        },
      );
      if (!sendRes.ok) return null;
      const data = (await sendRes.json()) as { event_id: string };
      return {
        transport: 'matrix',
        ok: true,
        nativeId: data.event_id,
        attemptedAt: Date.now(),
        deliveredAt: Date.now(),
      };
    }
    const createData = (await createRes.json()) as { room_id: string };
    const sendRes = await fetch(
      `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(createData.room_id)}/send/m.room.message`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ msgtype: 'm.text', body: displayText }),
      },
    );
    if (!sendRes.ok) return null;
    const data = (await sendRes.json()) as { event_id: string };
    return {
      transport: 'matrix',
      ok: true,
      nativeId: data.event_id,
      attemptedAt: Date.now(),
      deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'matrix',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

// ─── Farcaster DM ───────────────────────────────────────

async function deliverViaFarcaster(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.farcaster?.fid) return null;
  try {
    const signerKey = env.FARCASTER_SIGNER_KEY || (await env.CACHE?.get('farcaster:signer_key'));
    if (!signerKey) return null;
    const { publishCastToFarcaster } = await import('../lib/hubble-publisher');
    const displayText = `[${room.name}] ${message.fromName}: ${message.content}`;
    const truncatedText = displayText.length > 280 ? `${displayText.slice(0, 277)}…` : displayText;
    const result = await publishCastToFarcaster(
      env as unknown as Record<string, string | undefined>,
      { text: truncatedText },
    );
    if (result.hash) {
      return {
        transport: 'farcaster',
        ok: true,
        nativeId: result.hash,
        attemptedAt: Date.now(),
        deliveredAt: Date.now(),
      };
    }
    return {
      transport: 'farcaster',
      ok: false,
      error: 'Farcaster delivery failed',
      attemptedAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'farcaster',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

// ─── Bluesky DM ─────────────────────────────────────────

async function deliverViaBluesky(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.bluesky?.did) return null;
  try {
    const accessToken = env.BSKY_ACCESS_TOKEN || (await env.CACHE?.get('bluesky:access_jwt'));
    const senderDid = env.BSKY_DID || (await env.CACHE?.get('bluesky:did'));
    if (!accessToken || !senderDid) return null;
    const displayText = `🏠 ${room.name} — ${message.fromName}: ${message.content}`;
    const truncatedText = displayText.length > 280 ? `${displayText.slice(0, 277)}…` : displayText;
    const res = await fetch('https://bsky.social/xrpc/chat.bsky.conversation.sendMessage', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        conversation: { did: member.identity.bluesky.did },
        message: { text: truncatedText, createdAt: new Date().toISOString() },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return {
        transport: 'bluesky',
        ok: true,
        nativeId: data.id,
        attemptedAt: Date.now(),
        deliveredAt: Date.now(),
      };
    }
    return {
      transport: 'bluesky',
      ok: false,
      error: 'Bluesky delivery failed',
      attemptedAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'bluesky',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

// ─── Telegram DM ────────────────────────────────────────

async function deliverViaTelegram(
  env: Env,
  member: RoomMember,
  message: RoomMessage,
  room: UnifiedRoom,
): Promise<MemberDeliveryStatus | null> {
  if (!member.identity.telegram?.chatId) return null;
  try {
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return null;
    const displayText = `🏠 *${room.name}*\n👤 ${message.fromName}:\n${message.content}`;
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: member.identity.telegram.chatId,
        text: displayText,
        parse_mode: 'Markdown',
      }),
    });
    if (!res.ok)
      return {
        transport: 'telegram',
        ok: false,
        error: `Telegram API error: ${res.status}`,
        attemptedAt: Date.now(),
      };
    const data = (await res.json()) as { result: { message_id: number } };
    return {
      transport: 'telegram',
      ok: true,
      nativeId: String(data.result.message_id),
      attemptedAt: Date.now(),
      deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'telegram',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

// ─── WebSocket DM ───────────────────────────────────────

async function deliverViaWebSocket(
  _env: Env,
  member: RoomMember,
  message: RoomMessage,
): Promise<MemberDeliveryStatus | null> {
  try {
    const { broadcastToUser } = await import('../ws-broadcast');
    broadcastToUser(member.id, 'stream:chat', {
      id: message.id,
      roomId: message.roomId,
      fromId: message.fromId,
      fromName: message.fromName,
      content: message.content,
      encryptedContent: message.encryptedContent,
      keyVersion: message.keyVersion,
      sourceTransport: message.sourceTransport,
      createdAt: message.createdAt,
    });
    return {
      transport: 'web',
      ok: true,
      nativeId: message.id,
      attemptedAt: Date.now(),
      deliveredAt: Date.now(),
    };
  } catch (err) {
    return {
      transport: 'web',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt: Date.now(),
    };
  }
}

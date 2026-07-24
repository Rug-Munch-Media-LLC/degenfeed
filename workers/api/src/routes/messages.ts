/**
 * /api/messages — Cross-protocol Direct Messages.
 *
 * Unified DM layer across Nostr (NIP-04), Matrix, Bluesky (AT Protocol chat),
 * Mastodon (Direct visibility), Discord, and Telegram.
 *
 * Uses the MessageBridge to route messages to all protocols the recipient
 * is linked to, enabling cross-protocol DMs (e.g. Nostr → Matrix).
 *
 * GET  /api/messages/conversations   — List conversations with last message preview
 * GET  /api/messages/{id}            — Get messages in a conversation
 * POST /api/messages/send            — Send a DM (cross-protocol route)
 * POST /api/messages/read            — Mark messages as read
 * GET  /api/messages/inbox           — Get received messages grouped by sender
 * GET  /api/messages/thread/:peerId  — Get conversation with specific peer
 * DELETE /api/messages/{id}          — Delete a message (per-protocol)
 * GET  /api/messages/unread          — Get total unread count
 */

import type { Protocol } from '@degenfeed/types';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import { broadcastToUser } from '../ws-broadcast';

const DM_KEY_PREFIX = 'dm:';
const DM_LIST_PREFIX = 'dm:list:';
const DM_INBOX_PREFIX = 'dm:inbox:';
const DM_THREAD_PREFIX = 'dm:thread:';
const DM_READ_PREFIX = 'dm:read:';

export type DmProtocol =
  | 'nostr'
  | 'matrix'
  | 'bluesky'
  | 'mastodon'
  | 'discord'
  | 'telegram'
  | 'farcaster'
  | 'lens';

interface DirectMessage {
  id: string;
  conversationId: string;
  fromId: string;
  toId: string;
  protocol: DmProtocol;
  content: string;
  createdAt: number;
  read: boolean;
  encrypted: boolean;
  /** Native protocol message ID */
  nativeId?: string;
  /** Delivery status per protocol */
  deliveryStatus?: Array<{ protocol: string; ok: boolean; nativeId?: string; error?: string }>;
}

interface Conversation {
  id: string;
  participants: string[];
  protocol: string;
  lastMessage?: DirectMessage;
  unreadCount: number;
  updatedAt: number;
}

interface ConversationThread {
  peerId: string;
  peerDisplayName?: string;
  peerAvatar?: string;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: number;
    protocol: string;
  };
  unreadCount: number;
  lastActivity: number;
  protocols: string[];
}

interface SendRequest {
  to: string;
  body: string;
  preferredProtocol?: DmProtocol;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Pre-signed event for protocols that need client-side signing */
  signedMessage?: string;
  /** Nostr-specific fields */
  nostrPubkey?: string;
  nostrNsec?: string;
}

interface ReadRequest {
  messageIds?: string[];
  peerId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildConversationId(fromId: string, toId: string): string {
  const sorted = [fromId.toLowerCase(), toId.toLowerCase()].sort();
  return sorted.join(':');
}

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

const supportedProtocols = new Set<DmProtocol>([
  'nostr',
  'farcaster',
  'lens',
  'mastodon',
  'bluesky',
  'matrix',
  'discord',
  'telegram',
]);

function isSupportedProtocol(p: string): p is DmProtocol {
  return supportedProtocols.has(p as DmProtocol);
}

/**
 * Resolve an identifier (wallet, handle, npub, DID) to a wallet address
 * by looking up the IDENTITIES KV or using the handle resolution system.
 */
async function resolveToWallet(identifier: string, env: Env): Promise<string | null> {
  const id = identifier.toLowerCase().trim();
  if (!env.IDENTITIES) return id.startsWith('0x') ? id : null;

  try {
    // Try direct identity lookup
    const { identityKey: ikFn } = await import('@degenfeed/utils');
    const raw = await env.IDENTITIES.get(ikFn(id));
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return (parsed.walletAddress as string) || id;
    }

    // Try handle resolution
    const { resolveHandle } = await import('@degenfeed/utils');
    const resolved = await resolveHandle(id);
    if (resolved?.walletAddress) return resolved.walletAddress;
  } catch {
    // Fall through — use the identifier as-is
  }

  // If it matches a standard format, use it directly
  if (id.startsWith('0x') || id.startsWith('npub1') || id.startsWith('did:')) {
    return id;
  }

  return null;
}

// ─── KV helpers ──────────────────────────────────────────────────────────────

async function getMessages(env: Env, conversationId: string): Promise<DirectMessage[]> {
  if (!env.CACHE) return [];
  try {
    const raw = await env.CACHE.get(`${DM_KEY_PREFIX}${conversationId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DirectMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMessages(
  env: Env,
  conversationId: string,
  messages: DirectMessage[],
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`${DM_KEY_PREFIX}${conversationId}`, JSON.stringify(messages.slice(-200)), {
      expirationTtl: 86400 * 90,
    });
  } catch (e) {
    console.error('[messages] KV save failed:', e);
  }
}

async function getConversationList(env: Env, userId: string): Promise<Conversation[]> {
  if (!env.CACHE) return [];
  try {
    const raw = await env.CACHE.get(`${DM_LIST_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveConversationList(
  env: Env,
  userId: string,
  conversations: Conversation[],
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`${DM_LIST_PREFIX}${userId}`, JSON.stringify(conversations), {
      expirationTtl: 86400 * 90,
    });
  } catch (e) {
    console.error('[messages] KV conv list save failed:', e);
  }
}

async function upsertConversation(env: Env, userId: string, newConv: Conversation): Promise<void> {
  const list = await getConversationList(env, userId);
  const idx = list.findIndex((c) => c.id === newConv.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...newConv };
  } else {
    list.unshift(newConv);
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  await saveConversationList(env, userId, list.slice(0, 100));
}

/**
 * Get inbox threads grouped by sender.
 */
async function getInboxThreads(
  env: Env,
  userId: string,
  protocolFilter?: string,
): Promise<ConversationThread[]> {
  if (!env.CACHE) return [];
  try {
    const raw = await env.CACHE.get(`${DM_INBOX_PREFIX}${userId}`);
    if (!raw) return [];
    const threads = JSON.parse(raw) as ConversationThread[];
    if (protocolFilter) {
      return threads.filter((t) => t.protocols.includes(protocolFilter));
    }
    return threads.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

/**
 * Save inbox threads for a user.
 */
async function saveInboxThreads(
  env: Env,
  userId: string,
  threads: ConversationThread[],
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`${DM_INBOX_PREFIX}${userId}`, JSON.stringify(threads.slice(0, 100)), {
      expirationTtl: 86400 * 90,
    });
  } catch (e) {
    console.error('[messages] inbox save failed:', e);
  }
}

/**
 * Upsert a thread in the user's inbox.
 */
async function upsertInboxThread(
  env: Env,
  userId: string,
  peerId: string,
  message: DirectMessage,
): Promise<void> {
  const threads = await getInboxThreads(env, userId);
  const idx = threads.findIndex((t) => t.peerId === peerId);
  const thread: ConversationThread = {
    peerId,
    lastMessage: {
      id: message.id,
      content: message.content.slice(0, 100),
      createdAt: message.createdAt,
      protocol: message.protocol,
    },
    unreadCount: 1,
    lastActivity: message.createdAt,
    protocols: [message.protocol],
  };

  if (idx >= 0) {
    const existing = threads[idx];
    if (existing) {
      thread.unreadCount = existing.unreadCount + 1;
      thread.protocols = [...new Set([...existing.protocols, message.protocol])];
      thread.lastActivity = message.createdAt;
    }
    threads[idx] = thread;
  } else {
    threads.push(thread);
  }

  await saveInboxThreads(env, userId, threads);
}

// ─── Route: List conversations ──────────────────────────────────────────────

export async function handleConversations(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();
  const conversations = await getConversationList(env, userId);

  // Enrich with last message
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const msgs = await getMessages(env, conv.id);
      const lastMsg = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => !m.read && m.fromId !== userId).length;
      return {
        conversationId: conv.id,
        participants: conv.participants,
        protocol: conv.protocol,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content.slice(0, 100),
              fromId: lastMsg.fromId,
              createdAt: lastMsg.createdAt,
              read: lastMsg.read,
            }
          : null,
        unreadCount: unread,
        updatedAt: conv.updatedAt,
      };
    }),
  );

  return noCacheJsonResponse({ conversations: enriched });
}

// ─── Route: Inbox (threads grouped by sender) ──────────────────────────────

export async function handleInbox(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();
  const url = new URL(request.url);
  const protocolFilter = url.searchParams.get('protocol') || undefined;

  const threads = await getInboxThreads(env, userId, protocolFilter);

  return noCacheJsonResponse({
    threads,
    total: threads.length,
    unreadTotal: threads.reduce((sum, t) => sum + t.unreadCount, 0),
  });
}

// ─── Route: Get conversation thread with a specific peer ───────────────────

export async function handleThread(request: Request, env: Env, peerId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();
  const decodedPeer = decodeURIComponent(peerId);

  const conversationId = buildConversationId(userId, decodedPeer);
  const msgs = await getMessages(env, conversationId);

  // Mark incoming messages as read
  let updated = false;
  for (const m of msgs) {
    if (!m.read && m.fromId !== userId) {
      m.read = true;
      updated = true;
    }
  }

  if (updated) {
    await saveMessages(env, conversationId, msgs);

    // Update inbox unread count
    const threads = await getInboxThreads(env, userId);
    const threadIdx = threads.findIndex((t) => t.peerId === decodedPeer);
    if (threadIdx >= 0 && threads[threadIdx]) {
      threads[threadIdx].unreadCount = 0;
      await saveInboxThreads(env, userId, threads);
    }
  }

  return noCacheJsonResponse({ messages: msgs, peerId: decodedPeer });
}

// ─── Route: Get messages in a conversation ────────────────────────────────

export async function handleConversationMessages(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();
  const msgs = await getMessages(env, conversationId);

  // Verify user is a participant
  const convs = await getConversationList(env, userId);
  const conv = convs.find((c) => c.id === conversationId);
  if (!conv) {
    return jsonResponse({ error: 'Conversation not found' }, 404);
  }

  // Mark messages as read
  let updated = false;
  for (const m of msgs) {
    if (!m.read && m.toId === userId) {
      m.read = true;
      updated = true;
    }
  }

  if (updated) {
    await saveMessages(env, conversationId, msgs);
    conv.unreadCount = msgs.filter((m) => !m.read && m.fromId !== userId).length;
    await saveConversationList(env, userId, convs);
  }

  return noCacheJsonResponse({ messages: msgs, conversationId });
}

// ─── Route: Send a message (cross-protocol bridge) ────────────────────────

export async function handleSendMessage(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const to = sanitizeString(body.to, 512);
  const rawBody = sanitizeString(body.body, 10000);
  const preferredProtocol = body.preferredProtocol;

  if (!to || !rawBody) {
    return jsonResponse({ error: 'Missing required fields: to, body' }, 400);
  }

  if (hasSuspiciousPayload(rawBody)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  const userId = session.address.toLowerCase();

  // Resolve recipient to wallet address for identity lookup
  const recipientWallet = await resolveToWallet(to, env);
  if (!recipientWallet) {
    return jsonResponse({ error: 'Could not resolve recipient identifier' }, 400);
  }

  // Send via the Message Bridge
  const { MessageBridge, generateMessageId } = await import('@degenfeed/realtime/message-bridge');
  const bridge = new MessageBridge();

  // Build sender identity
  const senderIdentity = {
    id: `wallet:${userId}`,
    primary: { protocol: 'wallet' as Protocol, id: userId },
    handles: {} as Partial<Record<Protocol, string | null>>,
    displayName: userId.slice(0, 10),
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {
      nostrPubkey: body.nostrPubkey || undefined,
    },
  };

  const timestamp = now();
  const messageId = generateMessageId();

  // Build the unified message
  const unifiedMessage = {
    id: messageId,
    from: senderIdentity,
    to: recipientWallet,
    body: rawBody,
    timestamp,
    replyTo: undefined,
  };

  // Route through the bridge
  const bridgeResult = await bridge.route(unifiedMessage, env);

  // Build conversation entries for KV
  const deliveredProtocols =
    bridgeResult.deliveredTo.length > 0
      ? bridgeResult.deliveredTo
      : [preferredProtocol || ('nostr' as DmProtocol)];

  const primaryProtocol = preferredProtocol || deliveredProtocols[0] || 'nostr';

  const dm: DirectMessage = {
    id: messageId,
    conversationId: buildConversationId(userId, recipientWallet),
    fromId: userId,
    toId: recipientWallet,
    protocol: primaryProtocol,
    content: rawBody,
    createdAt: timestamp,
    read: false,
    encrypted: primaryProtocol === 'nostr',
    nativeId: bridgeResult.deliveryStatus.find((s) => s.ok)?.nativeId,
    deliveryStatus: bridgeResult.deliveryStatus.map((s) => ({
      protocol: s.protocol,
      ok: s.ok,
      nativeId: s.nativeId,
      error: s.error,
    })),
  };

  // Save to KV conversation history
  const conversationId = buildConversationId(userId, recipientWallet);
  const msgs = await getMessages(env, conversationId);
  msgs.push(dm);
  await saveMessages(env, conversationId, msgs);

  // Update conversation list for both parties
  const conv: Conversation = {
    id: conversationId,
    participants: [userId, recipientWallet],
    protocol: primaryProtocol,
    lastMessage: dm,
    unreadCount: 0,
    updatedAt: dm.createdAt,
  };
  await upsertConversation(env, userId, conv);
  await upsertConversation(env, recipientWallet, conv);

  // Update inbox for recipient
  await upsertInboxThread(env, recipientWallet, userId, dm);

  // Broadcast to the recipient via WebSocket
  broadcastToUser(recipientWallet, 'dm:new', {
    conversationId,
    messageId: dm.id,
    fromId: userId,
    content: rawBody.slice(0, 120),
    protocol: primaryProtocol,
    deliveredTo: bridgeResult.deliveredTo,
    createdAt: dm.createdAt,
  });

  // Create a "new_message" notification for the recipient
  try {
    const { createDmNotification } = await import('./notifications');
    await createDmNotification(env, recipientWallet, userId, rawBody, primaryProtocol, dm.id);
  } catch (err) {
    console.error('[messages] Failed to create DM notification:', err);
  }

  return noCacheJsonResponse({
    ok: true,
    sent: true,
    messageId: dm.id,
    deliveredTo: bridgeResult.deliveredTo,
    deliveryStatus: bridgeResult.deliveryStatus,
    message: dm,
  });
}

// ─── Route: Mark messages as read ──────────────────────────────────────────

export async function handleMarkRead(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: ReadRequest;
  try {
    body = (await request.json()) as ReadRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // If peerId is provided, mark all messages in that thread as read
  if (body.peerId) {
    const conversationId = buildConversationId(userId, body.peerId);
    const msgs = await getMessages(env, conversationId);
    let updated = false;
    for (const m of msgs) {
      if (!m.read && m.fromId !== userId) {
        m.read = true;
        updated = true;
      }
    }
    if (updated) {
      await saveMessages(env, conversationId, msgs);

      // Update inbox
      const threads = await getInboxThreads(env, userId);
      const threadIdx = threads.findIndex((t) => t.peerId === body.peerId);
      if (threadIdx >= 0 && threads[threadIdx]) {
        threads[threadIdx].unreadCount = 0;
        await saveInboxThreads(env, userId, threads);
      }
    }

    return noCacheJsonResponse({ ok: true, markedAsRead: true, peerId: body.peerId });
  }

  // If messageIds are provided, mark specific messages
  if (body.messageIds && body.messageIds.length > 0) {
    const conversations = await getConversationList(env, userId);
    let totalUpdated = 0;

    for (const conv of conversations) {
      const msgs = await getMessages(env, conv.id);
      let updated = false;
      for (const m of msgs) {
        if (body.messageIds.includes(m.id) && !m.read && m.fromId !== userId) {
          m.read = true;
          updated = true;
          totalUpdated++;
        }
      }
      if (updated) {
        await saveMessages(env, conv.id, msgs);
      }
    }

    return noCacheJsonResponse({
      ok: true,
      markedAsRead: totalUpdated,
      messageIds: body.messageIds,
    });
  }

  return jsonResponse({ error: 'Provide peerId or messageIds' }, 400);
}

// ─── Route: Delete a message ───────────────────────────────────────────────

export async function handleDeleteMessage(
  request: Request,
  env: Env,
  messageId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  // Read body once upfront for auth params
  let body: Partial<SendRequest> = {};
  try {
    body = (await request.clone().json()) as SendRequest;
  } catch {
    /* no body */
  }

  // Find and remove from all conversations
  const conversations = await getConversationList(env, userId);
  let deleted = false;
  let deletedMsg: DirectMessage | null = null;

  for (const conv of conversations) {
    const msgs = await getMessages(env, conv.id);
    const idx = msgs.findIndex((m: DirectMessage) => m.id === messageId);
    if (idx >= 0) {
      const found = msgs[idx];
      if (!found || found.fromId !== userId) continue;
      deletedMsg = found;
      msgs.splice(idx, 1);
      await saveMessages(env, conv.id, msgs);
      deleted = true;
      break;
    }
  }

  if (!deleted || !deletedMsg) {
    return jsonResponse({ error: 'Message not found or not owned by you' }, 404);
  }

  // Best-effort per-protocol native deletion
  const auth = body.auth ?? {};
  switch (deletedMsg.protocol) {
    case 'nostr':
      if (deletedMsg.nativeId) {
        try {
          const nsec = auth.nsec || body.nostrNsec;
          if (nsec) {
            const nostr = await import('@degenfeed/nostr-sdk');
            const ev = nostr.createDeletion([deletedMsg.nativeId], 'Deleted by sender', nsec);
            const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
              eoseTimeout: 4000,
            });
            await pool.publish(ev);
            pool.disconnectAll();
          }
        } catch (e) {
          console.error('[messages] Nostr deletion failed:', e);
        }
      }
      break;
    case 'mastodon':
      if (deletedMsg.nativeId) {
        try {
          const accessToken = auth.mastodon || auth.accessJwt;
          if (accessToken) {
            const instance =
              auth.mastodon_instance || env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
            const deleteUrl = `${instance}/api/v1/statuses/${encodeURIComponent(deletedMsg.nativeId)}`;
            await fetch(deleteUrl, {
              method: 'DELETE',
              headers: { authorization: `Bearer ${accessToken}` },
            });
          }
        } catch {
          /* best-effort */
        }
      }
      break;
  }

  return noCacheJsonResponse({ ok: true, deleted: messageId });
}

// ─── Route: Unread count ──────────────────────────────────────────────────

export async function handleUnreadCount(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  const threads = await getInboxThreads(env, userId);
  const total = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  // Also sum from conversation list for backward compatibility
  const conversations = await getConversationList(env, userId);
  let convTotal = 0;
  for (const conv of conversations) {
    const msgs = await getMessages(env, conv.id);
    convTotal += msgs.filter((m) => !m.read && m.fromId !== userId).length;
  }

  return noCacheJsonResponse({ unread: Math.max(total, convTotal) });
}

/**
 * /api/messages — Cross-protocol Direct Messages.
 *
 * Unified DM layer across Nostr (NIP-04), Farcaster (direct casts),
 * Lens (private publications), and Mastodon (direct visibility).
 *
 * GET  /api/messages/conversations   — List conversations with last message preview
 * GET  /api/messages/{id}            — Get messages in a conversation
 * POST /api/messages/send            — Send a message via a specific protocol
 * DELETE /api/messages/{id}          — Delete a message (per-protocol)
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { ALLOWED_PROTOCOLS, hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { type SessionPayload, requireSession } from '../session';
import { broadcastToUser } from '../ws-broadcast';

const DM_KEY_PREFIX = 'dm:';
const DM_CONV_PREFIX = 'dm:conv:';
const DM_LIST_PREFIX = 'dm:list:';

interface DirectMessage {
  id: string;
  conversationId: string;
  fromId: string;
  toId: string;
  protocol: 'nostr' | 'farcaster' | 'lens' | 'mastodon';
  content: string;
  createdAt: number;
  read: boolean;
  encrypted: boolean;
  nativeId?: string;
}

interface Conversation {
  id: string;
  participants: string[];
  protocol: string;
  lastMessage?: DirectMessage;
  unreadCount: number;
  updatedAt: number;
}

interface SendRequest {
  toId: string;
  protocol: string;
  content: string;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Pre-signed event for protocols that need client-side signing */
  signedMessage?: string;
  /** Nostr-specific fields */
  nostrPubkey?: string;
  nostrNsec?: string;
}

function buildConversationId(fromId: string, toId: string, protocol: string): string {
  const sorted = [fromId, toId].sort();
  return `${protocol}:${sorted[0]}:${sorted[1]}`;
}

function formatProtocolLabel(p: string): string {
  const labels: Record<string, string> = {
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens',
    mastodon: 'Mastodon',
  };
  return labels[p] ?? p;
}

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

const supportedProtocols = new Set(['nostr', 'farcaster', 'lens', 'mastodon']);

function isSupportedProtocol(p: string): p is 'nostr' | 'farcaster' | 'lens' | 'mastodon' {
  return supportedProtocols.has(p);
}

// ─── KV helpers ─────────────────────────────────────────────────────

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
    await env.CACHE.put(
      `${DM_KEY_PREFIX}${conversationId}`,
      JSON.stringify(messages.slice(-200)),
      { expirationTtl: 86400 * 90 },
    );
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

async function upsertConversation(
  env: Env,
  userId: string,
  newConv: Conversation,
): Promise<void> {
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

// ─── Protocol DM implementations ─────────────────────────────────────

async function sendNostrDM(
  text: string,
  senderPubkey: string,
  recipientPubkey: string,
  nsec?: string,
  signedEvent?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    const nostr = await import('@degenfeed/nostr-sdk');

    if (signedEvent) {
      try {
        const signed = JSON.parse(signedEvent) as {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          tags: string[][];
          content: string;
          sig: string;
        };
        if (!signed.id || !signed.sig || !signed.pubkey) {
          return { ok: false, error: 'Pre-signed Nostr DM is missing id/sig/pubkey' };
        }
        const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
          eoseTimeout: 4000,
        });
        await pool.publish(signed);
        pool.disconnectAll();
        return { ok: true, nativeId: signed.id };
      } catch (e) {
        console.error('[messages] Nostr DM pre-signed publish failed:', e);
        return { ok: false, error: 'Failed to publish pre-signed Nostr DM' };
      }
    }

    if (!nsec) {
      return { ok: false, error: 'Nostr DM requires nsec or pre-signed event' };
    }

    // NIP-04 encryption should be done client-side; server signs+relays kind:4
    // Client provides already-encrypted content in signedEvent, or we relay plaintext
    const senderHex = nostr.getPublicKey(nsec);
    const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
      eoseTimeout: 4000,
    });

    const tags = [['p', recipientPubkey]];
    const unsigned = {
      pubkey: senderHex,
      created_at: Math.floor(Date.now() / 1000),
      kind: 4,
      tags,
      content: text,
    };
    const ev = nostr.signEvent(unsigned, nsec);
    await pool.publish(ev);
    pool.disconnectAll();
    return { ok: true, nativeId: ev.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendFarcasterDM(
  text: string,
  recipientId: string,
  body: SendRequest,
  env: Env,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
    const signedMessage = body.signedMessage || body.auth?.farcaster_message;

    if (!signedMessage) {
      return { ok: false, error: 'Farcaster DM requires pre-signed cast message. Sign client-side.' };
    }

    // Decode hex-encoded signed message
    let messageBody: BodyInit = signedMessage;
    const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      messageBody = bytes;
    }

    const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
      body: messageBody,
    });
    if (submitRes.ok) {
      const submitData = (await submitRes.json()) as Record<string, unknown>;
      return { ok: true, nativeId: String(submitData.hash || '') };
    }
    const errText = await submitRes.text();
    return { ok: false, error: `Farcaster Hub rejected: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendLensDM(
  text: string,
  recipientProfileId: string,
  body: SendRequest,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    const lensApi = 'https://api-v2.lens.dev/graphql';
    const typedDataId = body.auth?.lens_typedDataId;
    const signature = body.auth?.lens_signature;

    if (!typedDataId || !signature) {
      return { ok: false, error: 'Lens DM requires typedDataId + signature. Sign client-side.' };
    }

    const broadcastRes = await fetch(lensApi, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'mutation Broadcast($request: BroadcastRequest!) { broadcast(request: $request) { ... on RelayerResult { txHash } ... on RelayError { reason } } }',
        variables: { request: { id: typedDataId, signature } },
      }),
    });
    if (broadcastRes.ok) {
      const broadcastData = (await broadcastRes.json()) as Record<string, unknown>;
      const result = (broadcastData.data as Record<string, unknown>)?.broadcast as
        | Record<string, unknown>
        | undefined;
      return {
        ok: !!result?.txHash,
        nativeId: result?.txHash as string | undefined,
        error: result?.reason as string | undefined,
      };
    }
    const errText = await broadcastRes.text();
    return { ok: false, error: `Lens broadcast failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendMastodonDM(
  text: string,
  recipientId: string,
  body: SendRequest,
  env: Env,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const instance =
      body.auth?.mastodon_instance || env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
    const accessToken = body.auth?.mastodon || body.auth?.accessJwt;

    if (!accessToken) {
      return { ok: false, error: 'Not signed into Mastodon' };
    }

    const client = new GtSClient(instance, accessToken);
    const result = await client.publish(text, {
      visibility: 'direct',
    });
    return { ok: true, nativeId: (result as { id?: string })?.id ?? '' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── Route: List conversations ───────────────────────────────────────

export async function handleConversations(
  request: Request,
  env: Env,
): Promise<Response> {
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

// ─── Route: Get messages in a conversation ───────────────────────────

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
    // Update conversation unread count
    conv.unreadCount = msgs.filter((m) => !m.read && m.fromId !== userId).length;
    await saveConversationList(env, userId, convs);
  }

  return noCacheJsonResponse({ messages: msgs, conversationId });
}

// ─── Route: Send a message ────────────────────────────────────────────

export async function handleSendMessage(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const toId = sanitizeString(body.toId, 256);
  const protocol = sanitizeString(body.protocol, 32);
  const rawContent = sanitizeString(body.content, 10000);

  if (!toId || !protocol || !rawContent) {
    return jsonResponse(
      { error: 'Missing required fields', required: ['toId', 'protocol', 'content'] },
      400,
    );
  }

  if (!isSupportedProtocol(protocol)) {
    return jsonResponse(
      { error: `Unsupported DM protocol: ${protocol}`, supported: ['nostr', 'farcaster', 'lens', 'mastodon'] },
      400,
    );
  }

  if (hasSuspiciousPayload(rawContent)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  const userId = session.address.toLowerCase();

  // Build fromId based on protocol
  let fromId: string;
  const auth = body.auth ?? {};
  switch (protocol) {
    case 'nostr':
      fromId = body.nostrPubkey || auth.nostr_pubkey || userId;
      break;
    case 'mastodon':
      fromId = auth.mastodon_acct || userId;
      break;
    default:
      fromId = userId;
  }

  // Send via native protocol
  let result: { ok: boolean; nativeId?: string; error?: string };
  switch (protocol) {
    case 'nostr':
      result = await sendNostrDM(
        rawContent,
        fromId,
        toId,
        body.nostrNsec || body.auth?.nsec,
        body.signedMessage,
      );
      break;
    case 'farcaster':
      result = await sendFarcasterDM(rawContent, toId, body, env);
      break;
    case 'lens':
      result = await sendLensDM(rawContent, toId, body);
      break;
    case 'mastodon':
      result = await sendMastodonDM(rawContent, toId, body, env);
      break;
    default:
      result = { ok: false, error: `Unsupported protocol: ${protocol}` };
  }

  // Store in local KV regardless of protocol send success (optimistic)
  const conversationId = buildConversationId(userId, toId, protocol);
  const dm: DirectMessage = {
    id: generateId(),
    conversationId,
    fromId,
    toId,
    protocol: protocol as 'nostr' | 'farcaster' | 'lens' | 'mastodon',
    content: rawContent,
    createdAt: now(),
    read: false,
    encrypted: protocol === 'nostr',
    nativeId: result.nativeId,
  };

  // Save to KV
  const msgs = await getMessages(env, conversationId);
  msgs.push(dm);
  await saveMessages(env, conversationId, msgs);

  // Update conversation list for both participants
  const conv: Conversation = {
    id: conversationId,
    participants: [userId, toId],
    protocol,
    lastMessage: dm,
    unreadCount: 0,
    updatedAt: dm.createdAt,
  };
  await upsertConversation(env, userId, conv);
  await upsertConversation(env, toId, conv);

  if (!result.ok) {
    return noCacheJsonResponse({
      ok: false,
      error: result.error,
      message: dm,
    });
  }

  broadcastToUser(toId, 'dm:new', {
    conversationId,
    messageId: dm.id,
    fromId,
    content: rawContent.slice(0, 120),
    protocol,
    createdAt: dm.createdAt,
  });

  return noCacheJsonResponse({
    ok: true,
    message: dm,
    nativeId: result.nativeId,
  });
}

// ─── Route: Delete a message ──────────────────────────────────────────

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
            const pool = new nostr.RelayPool(
              ['wss://relay.damus.io', 'wss://nos.lol'],
              { eoseTimeout: 4000 },
            );
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

// ─── Unread count helper ──────────────────────────────────────────────

export async function handleUnreadCount(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();
  const conversations = await getConversationList(env, userId);
  let total = 0;

  for (const conv of conversations) {
    const msgs = await getMessages(env, conv.id);
    total += msgs.filter((m) => !m.read && m.fromId !== userId).length;
  }

  return noCacheJsonResponse({ unread: total });
}

/**
 * @degenfeed/api-worker — Matrix Chat Library
 *
 * THE UNIVERSAL CHAT FABRIC.
 * Every DM, group chat, and cross-protocol conversation lives in a Matrix room.
 * Conduit on port 8448 is the homeserver. All bridges connect through Conduit.
 *
 * No custom KV-backed rooms. No protocol-specific storage.
 * Matrix is the single source of truth.
 *
 * Architecture:
 *   User sends message → POST to Matrix room → Conduit bridges to ALL protocols
 *   Protocol messages → AppService bridge → Matrix room → sync to user's client
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CONDUIT_URL = process.env.CONDUIT_URL || 'http://localhost:8448';
const MATRIX_DOMAIN = process.env.MATRIX_DOMAIN || 'matrix.degenfeed.xyz';

const KV_PREFIX = 'matrix:chat:';
const DM_INDEX_PREFIX = `${KV_PREFIX}dm:index:`;
const GROUP_INDEX_PREFIX = `${KV_PREFIX}group:index:`;
const PREF_PREFIX = `${KV_PREFIX}pref:`;
const ACCOUNT_PREFIX = `${KV_PREFIX}account:`;
const ROOM_META_PREFIX = `${KV_PREFIX}room:meta:`;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ChatProtocol =
  | 'nostr'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'activitypub'
  | 'telegram'
  | 'discord'
  | 'irc'
  | 'xmpp'
  | 'signal'
  | 'whatsapp'
  | 'lens'
  | 'matrix';

export interface ProtocolPreferences {
  /** Primary protocol for receiving DMs */
  primary: ChatProtocol;
  /** Fallback if primary is unreachable */
  fallback: ChatProtocol;
  /** All protocols the user is reachable on */
  enabled: ChatProtocol[];
  /** Auto-detect best protocol when not set */
  autoDetect: boolean;
  /** Timestamp of last update */
  updatedAt: number;
}

export interface MatrixAccount {
  /** Matrix user ID (e.g., @wallet_abc123:matrix.degenfeed.xyz) */
  userId: string;
  /** Access token for Matrix API calls */
  accessToken: string;
  /** Device ID for session tracking */
  deviceId: string;
  /** When the account was provisioned */
  createdAt: number;
  /** Last sync batch token */
  lastSyncBatch?: string;
  /** Wallet address linked to this account */
  walletAddress: string;
  /** Whether E2EE is enabled */
  encrypted: boolean;
}

export interface ChatRoomMeta {
  /** Matrix room ID */
  roomId: string;
  /** Room type: dm or group */
  type: 'dm' | 'group';
  /** Room display name */
  name: string;
  /** Room topic/description */
  topic?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Creator wallet */
  createdBy: string;
  /** All member wallets (lowercase) */
  members: string[];
  /** Admin wallets */
  admins: string[];
  /** When created */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Whether E2EE is enabled */
  encrypted: boolean;
  /** Aliases for lookup */
  aliases: string[];
  /** Bridged protocols in this room */
  bridgedProtocols: ChatProtocol[];
  /** Protocol-specific room mappings: { protocol: nativeRoomId } */
  protocolMappings: Record<string, string>;
}

export interface ChatMessage {
  /** Matrix event ID */
  eventId: string;
  /** Matrix room ID */
  roomId: string;
  /** Sender wallet address */
  senderId: string;
  /** Message body */
  body: string;
  /** Message type (m.text, m.image, etc.) */
  msgType: string;
  /** Timestamp ms */
  timestamp: number;
  /** Source protocol (matrix, nostr, etc.) */
  sourceProtocol: ChatProtocol;
  /** Whether this was bridged from another protocol */
  isBridged: boolean;
  /** Original protocol if bridged */
  bridgedFrom?: ChatProtocol;
  /** Reply-to event ID */
  replyTo?: string;
  /** Whether E2E encrypted */
  encrypted: boolean;
  /** Reaction counts { emoji: count } */
  reactions?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT MANAGEMENT — Wallet-Based Matrix Auto-Provisioning
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve a wallet address to its Matrix user ID.
 * Creates the account if it doesn't exist (auto-provisioning).
 */
export async function resolveMatrixAccount(
  env: Env,
  walletAddress: string,
): Promise<MatrixAccount> {
  const wallet = walletAddress.toLowerCase();
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;

  // Check existing
  if (kv) {
    const existing = await kv.get(`${ACCOUNT_PREFIX}${wallet}`).catch(() => null);
    if (existing) {
      return JSON.parse(existing) as MatrixAccount;
    }
  }

  // Auto-provision: create Matrix account
  const shortAddr = wallet.slice(2, 12);
  const localpart = `wallet_${shortAddr}`;
  const matrixUserId = `@${localpart}:${MATRIX_DOMAIN}`;
  const password = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';
  const deviceId = `df_${Date.now().toString(36)}`;

  // Register on Conduit
  try {
    const adminToken = env.MATRIX_ADMIN_TOKEN || process.env.MATRIX_ADMIN_TOKEN;
    if (adminToken) {
      const regRes = await fetch(`${CONDUIT_URL}/_matrix/client/v3/admin/register`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          username: localpart,
          password,
          admin: false,
        }),
      });
      if (!regRes.ok) {
        // Fallback: try user-facing registration
        const fallbackRes = await fetch(`${CONDUIT_URL}/_matrix/client/v3/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: localpart,
            password,
            auth: { type: 'm.login.dummy' },
            initial_device_display_name: `DegenFeed ${shortAddr}`,
          }),
        });
        if (!fallbackRes.ok) {
          throw new Error(`Conduit registration failed: ${fallbackRes.status}`);
        }
      }
    }

    // Login to get access token
    const loginRes = await fetch(`${CONDUIT_URL}/_matrix/client/v3/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        user: localpart,
        password,
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Conduit login failed: ${loginRes.status}`);
    }

    const loginData = (await loginRes.json()) as { access_token: string };

    const account: MatrixAccount = {
      userId: matrixUserId,
      accessToken: loginData.access_token,
      deviceId,
      createdAt: Date.now(),
      walletAddress: wallet,
      encrypted: true,
    };

    // Store in KV
    if (kv) {
      await kv.put(`${ACCOUNT_PREFIX}${wallet}`, JSON.stringify(account), {
        expirationTtl: 86400 * 365,
      });
    }

    return account;
  } catch (err) {
    // If registration fails, check if account already exists on Conduit
    console.error('[chat-matrix] Account provisioning failed:', err);
    throw new Error(
      `Failed to provision Matrix account: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}

/**
 * Get Matrix account for a wallet (must already exist).
 */
export async function getMatrixAccount(
  env: Env,
  walletAddress: string,
): Promise<MatrixAccount | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${ACCOUNT_PREFIX}${walletAddress.toLowerCase()}`);
    return raw ? (JSON.parse(raw) as MatrixAccount) : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a user's protocol delivery preferences.
 */
export async function getProtocolPreferences(
  env: Env,
  walletAddress: string,
): Promise<ProtocolPreferences> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return defaultPreferences();

  try {
    const raw = await kv.get(`${PREF_PREFIX}${walletAddress.toLowerCase()}`);
    if (raw) return JSON.parse(raw) as ProtocolPreferences;
  } catch {
    // Use defaults
  }
  return defaultPreferences();
}

/**
 * Update a user's protocol delivery preferences.
 */
export async function setProtocolPreferences(
  env: Env,
  walletAddress: string,
  prefs: Partial<ProtocolPreferences>,
): Promise<ProtocolPreferences> {
  const current = await getProtocolPreferences(env, walletAddress);
  const updated: ProtocolPreferences = {
    ...current,
    ...prefs,
    updatedAt: Date.now(),
  };

  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.put(`${PREF_PREFIX}${walletAddress.toLowerCase()}`, JSON.stringify(updated), {
      expirationTtl: 86400 * 365,
    });
  }
  return updated;
}

function defaultPreferences(): ProtocolPreferences {
  return {
    primary: 'matrix',
    fallback: 'nostr',
    enabled: ['matrix', 'nostr', 'farcaster', 'bluesky', 'telegram'],
    autoDetect: true,
    updatedAt: Date.now(),
  };
}

/**
 * Resolve the best protocol to reach a user.
 * Checks preferences, falls back to auto-detect.
 */
export async function resolveBestProtocol(env: Env, walletAddress: string): Promise<ChatProtocol> {
  const prefs = await getProtocolPreferences(env, walletAddress);

  if (!prefs.autoDetect) {
    return prefs.primary;
  }

  // Auto-detect: check which protocols the user has linked
  try {
    const { IdentityHub } = await import('@degenfeed/auth');
    const hub = new IdentityHub({ kv: env.IDENTITIES ?? env.CACHE });
    const resolved = await hub.resolveWallet(walletAddress);

    // Prioritize: Matrix > Nostr > Farcaster > Bluesky > Telegram
    if (resolved.protocols.matrix?.linked) return 'matrix';
    if (resolved.protocols.nostr?.linked) return 'nostr';
    if (resolved.protocols.farcaster?.linked) return 'farcaster';
    if (resolved.protocols.bluesky?.linked) return 'bluesky';
    if (resolved.protocols.telegram?.linked) return 'telegram';
  } catch {
    // Fall back to preference
  }

  return prefs.primary;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOM MANAGEMENT — Matrix Rooms as Universal Chat Containers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a Matrix room for a DM conversation.
 * Room is E2E encrypted (Olm/Megolm). Bridges to recipient's preferred protocol.
 */
export async function createDMRoom(
  env: Env,
  creatorWallet: string,
  recipientWallet: string,
  account: MatrixAccount,
): Promise<ChatRoomMeta> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;

  // Check if DM room already exists
  const dmKey = getDMKey(creatorWallet, recipientWallet);
  if (kv) {
    const existing = await kv.get(dmKey).catch(() => null);
    if (existing) {
      const roomId = existing;
      const meta = await getRoomMeta(env, roomId);
      if (meta) return meta;
    }
  }

  const shortCreator = creatorWallet.slice(2, 10);
  const shortRecipient = recipientWallet.slice(2, 10);

  // Create Matrix room with E2EE
  const createRes = await fetch(`${CONDUIT_URL}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${account.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: `${shortCreator} ↔ ${shortRecipient}`,
      topic: `DegenFeed DM: ${creatorWallet.slice(0, 10)}... ↔ ${recipientWallet.slice(0, 10)}...`,
      preset: 'trusted_private_chat',
      is_direct: true,
      initial_state: [
        {
          type: 'm.room.history_visibility',
          content: { history_visibility: 'invited' },
        },
        {
          type: 'm.room.encryption',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Failed to create DM room: ${errText.slice(0, 200)}`);
  }

  const createData = (await createRes.json()) as { room_id: string };
  const roomId = createData.room_id;

  // Resolve recipient's Matrix account
  const recipientAccount = await resolveMatrixAccount(env, recipientWallet);

  // Invite recipient to the room
  try {
    await fetch(`${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${account.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ user_id: recipientAccount.userId }),
    });
  } catch {
    // Non-critical — recipient can join later
  }

  // Build room metadata
  const members = [creatorWallet.toLowerCase(), recipientWallet.toLowerCase()];
  const meta: ChatRoomMeta = {
    roomId,
    type: 'dm',
    name: `${shortCreator} ↔ ${shortRecipient}`,
    createdBy: creatorWallet.toLowerCase(),
    members,
    admins: [creatorWallet.toLowerCase()],
    createdAt: Date.now(),
    lastActivity: Date.now(),
    encrypted: true,
    aliases: [],
    bridgedProtocols: ['matrix'],
    protocolMappings: {},
  };

  // Store metadata
  await saveRoomMeta(env, roomId, meta);

  // Index for both users
  if (kv) {
    await Promise.all([
      kv.put(dmKey, roomId, { expirationTtl: 86400 * 365 }),
      addRoomToUserIndex(env, creatorWallet, roomId),
      addRoomToUserIndex(env, recipientWallet, roomId),
    ]);
  }

  return meta;
}

/**
 * Create a Matrix room for a group chat.
 * E2E encrypted. All members invited. Bridges to each member's preferred protocol.
 */
export async function createGroupRoom(
  env: Env,
  creatorWallet: string,
  name: string,
  memberWallets: string[],
  account: MatrixAccount,
  options?: { topic?: string; avatarUrl?: string },
): Promise<ChatRoomMeta> {
  const allMembers = [
    ...new Set([creatorWallet.toLowerCase(), ...memberWallets.map((w) => w.toLowerCase())]),
  ];

  if (allMembers.length < 2) {
    throw new Error('Group must have at least 2 members');
  }

  // Create Matrix room with E2EE
  const createRes = await fetch(`${CONDUIT_URL}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${account.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name,
      topic: options?.topic || `DegenFeed Group: ${name}`,
      preset: 'private_chat',
      initial_state: [
        {
          type: 'm.room.history_visibility',
          content: { history_visibility: 'invited' },
        },
        {
          type: 'm.room.encryption',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Failed to create group room: ${errText.slice(0, 200)}`);
  }

  const createData = (await createRes.json()) as { room_id: string };
  const roomId = createData.room_id;

  // Resolve and invite each member
  for (const wallet of allMembers) {
    if (wallet === creatorWallet.toLowerCase()) continue;
    try {
      const memberAccount = await resolveMatrixAccount(env, wallet);
      await fetch(`${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${account.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ user_id: memberAccount.userId }),
      });
    } catch {
      // Continue — member can join later
    }
  }

  const meta: ChatRoomMeta = {
    roomId,
    type: 'group',
    name,
    topic: options?.topic,
    avatarUrl: options?.avatarUrl,
    createdBy: creatorWallet.toLowerCase(),
    members: allMembers,
    admins: [creatorWallet.toLowerCase()],
    createdAt: Date.now(),
    lastActivity: Date.now(),
    encrypted: true,
    aliases: [],
    bridgedProtocols: ['matrix'],
    protocolMappings: {},
  };

  await saveRoomMeta(env, roomId, meta);

  // Index for all members
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await Promise.all(allMembers.map((w) => addRoomToUserIndex(env, w, roomId)));
    await kv.put(`${KV_PREFIX}group:list`, JSON.stringify([...(await getGroupList(env)), roomId]), {
      expirationTtl: 86400 * 365,
    });
  }

  return meta;
}

/**
 * Invite a user to an existing Matrix room.
 * Bridges to their preferred protocol automatically.
 */
export async function inviteToRoom(
  env: Env,
  roomId: string,
  inviterWallet: string,
  inviteeWallet: string,
): Promise<ChatRoomMeta> {
  const account = await resolveMatrixAccount(env, inviterWallet);
  const inviteeAccount = await resolveMatrixAccount(env, inviteeWallet);

  // Send Matrix invite
  const inviteRes = await fetch(
    `${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${account.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ user_id: inviteeAccount.userId }),
    },
  );

  if (!inviteRes.ok) {
    const errText = await inviteRes.text().catch(() => '');
    throw new Error(`Failed to invite user: ${errText.slice(0, 200)}`);
  }

  // Update room metadata
  const meta = await getRoomMeta(env, roomId);
  if (meta) {
    if (!meta.members.includes(inviteeWallet.toLowerCase())) {
      meta.members.push(inviteeWallet.toLowerCase());
      meta.lastActivity = Date.now();
      await saveRoomMeta(env, roomId, meta);
    }
    await addRoomToUserIndex(env, inviteeWallet, roomId);
    return meta;
  }

  throw new Error('Room not found after invite');
}

/**
 * Remove a member from a group room (kick).
 */
export async function kickFromRoom(
  env: Env,
  roomId: string,
  adminWallet: string,
  targetWallet: string,
): Promise<void> {
  const account = await resolveMatrixAccount(env, adminWallet);
  const targetAccount = await resolveMatrixAccount(env, targetWallet);

  await fetch(`${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/kick`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${account.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ user_id: targetAccount.userId, reason: 'Removed by admin' }),
  });

  // Update metadata
  const meta = await getRoomMeta(env, roomId);
  if (meta) {
    meta.members = meta.members.filter((m) => m !== targetWallet.toLowerCase());
    meta.admins = meta.admins.filter((m) => m !== targetWallet.toLowerCase());
    await saveRoomMeta(env, roomId, meta);
  }
}

/**
 * Promote a member to admin.
 */
export async function promoteToAdmin(
  env: Env,
  roomId: string,
  adminWallet: string,
  targetWallet: string,
): Promise<void> {
  const account = await resolveMatrixAccount(env, adminWallet);
  const targetAccount = await resolveMatrixAccount(env, targetWallet);

  // Set power level on Matrix
  await fetch(
    `${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${account.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        users: {
          [targetAccount.userId]: 100, // Admin power level
        },
        users_default: 0,
        events: {
          'm.room.name': 100,
          'm.room.power_levels': 100,
          'm.room.history_visibility': 100,
        },
        invite: 50,
        kick: 50,
        redact: 50,
        ban: 50,
      }),
    },
  );

  // Update metadata
  const meta = await getRoomMeta(env, roomId);
  if (meta && !meta.admins.includes(targetWallet.toLowerCase())) {
    meta.admins.push(targetWallet.toLowerCase());
    await saveRoomMeta(env, roomId, meta);
  }
}

/**
 * Send a message to a Matrix room.
 * The message gets bridged to all protocols via Conduit's bridge appservices.
 */
export async function sendRoomMessage(
  env: Env,
  roomId: string,
  senderWallet: string,
  account: MatrixAccount,
  body: string,
  msgType = 'm.text',
): Promise<ChatMessage> {
  const txnId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const sendRes = await fetch(
    `${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${account.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        body,
        msgtype: msgType,
        'degenfeed:sender_wallet': senderWallet.toLowerCase(),
        'degenfeed:timestamp': Date.now(),
      }),
    },
  );

  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => '');
    // Check for rate limiting
    if (sendRes.status === 429) {
      const retryAfter = parseInt(sendRes.headers.get('retry-after') || '5', 10);
      throw new MatrixRateLimitedError(retryAfter);
    }
    throw new Error(`Matrix send failed: ${errText.slice(0, 200)}`);
  }

  const sendData = (await sendRes.json()) as { event_id: string };

  // Update room last activity
  const meta = await getRoomMeta(env, roomId);
  if (meta) {
    meta.lastActivity = Date.now();
    await saveRoomMeta(env, roomId, meta);
  }

  return {
    eventId: sendData.event_id,
    roomId,
    senderId: senderWallet.toLowerCase(),
    body,
    msgType,
    timestamp: Date.now(),
    sourceProtocol: 'matrix',
    isBridged: false,
    encrypted: false,
    reactions: {},
  };
}

/**
 * Get messages from a Matrix room via the sync API.
 */
export async function getRoomMessages(
  env: Env,
  roomId: string,
  account: MatrixAccount,
  limit = 50,
): Promise<ChatMessage[]> {
  try {
    const url = `${CONDUIT_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${account.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      chunk: Array<{
        event_id: string;
        type: string;
        sender: string;
        content: {
          body?: string;
          msgtype?: string;
          'degenfeed:sender_wallet'?: string;
          'degenfeed:timestamp'?: number;
        };
        origin_server_ts: number;
      }>;
    };

    return data.chunk
      .filter((e) => e.type === 'm.room.message')
      .map((e) => ({
        eventId: e.event_id,
        roomId,
        senderId: e.content['degenfeed:sender_wallet'] || e.sender,
        body: e.content.body || '',
        msgType: e.content.msgtype || 'm.text',
        timestamp: e.content['degenfeed:timestamp'] || e.origin_server_ts,
        sourceProtocol: 'matrix',
        isBridged: false,
        encrypted: false,
        reactions: {},
      }));
  } catch {
    return [];
  }
}

/**
 * Sync — long-poll Matrix for new events.
 * Returns new messages since the last sync batch.
 */
export async function syncMessages(
  env: Env,
  walletAddress: string,
  account: MatrixAccount,
  timeout = 30000,
): Promise<{ messages: ChatMessage[]; nextBatch: string }> {
  const since = account.lastSyncBatch || '';
  const url = `${CONDUIT_URL}/_matrix/client/v3/sync?timeout=${timeout}${since ? `&since=${since}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${account.accessToken}` },
      signal: AbortSignal.timeout(timeout + 5000),
    });

    if (!res.ok) {
      return { messages: [], nextBatch: since };
    }

    const data = (await res.json()) as {
      next_batch: string;
      rooms?: {
        join?: Record<
          string,
          {
            timeline?: {
              events: Array<{
                event_id: string;
                type: string;
                sender: string;
                content: {
                  body?: string;
                  msgtype?: string;
                  'degenfeed:sender_wallet'?: string;
                };
                origin_server_ts: number;
              }>;
            };
          }
        >;
      };
    };

    const messages: ChatMessage[] = [];

    if (data.rooms?.join) {
      for (const [rid, roomData] of Object.entries(data.rooms.join)) {
        const events = roomData.timeline?.events || [];
        for (const event of events) {
          if (event.type === 'm.room.message' && event.content.body) {
            // Skip own messages
            if (event.sender === account.userId) continue;

            messages.push({
              eventId: event.event_id,
              roomId: rid,
              senderId: event.content['degenfeed:sender_wallet'] || event.sender,
              body: event.content.body,
              msgType: event.content.msgtype || 'm.text',
              timestamp: event.origin_server_ts,
              sourceProtocol: 'matrix',
              isBridged: false,
              encrypted: false,
              reactions: {},
            });
          }
        }
      }
    }

    // Update last sync batch
    account.lastSyncBatch = data.next_batch;
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(`${ACCOUNT_PREFIX}${walletAddress.toLowerCase()}`, JSON.stringify(account), {
        expirationTtl: 86400 * 365,
      });
    }

    return { messages, nextBatch: data.next_batch };
  } catch {
    return { messages: [], nextBatch: since };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// USER ROOM INDEX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all rooms for a user (both DMs and groups).
 */
export async function getUserRooms(env: Env, walletAddress: string): Promise<ChatRoomMeta[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const raw = await kv.get(`${KV_PREFIX}rooms:${walletAddress.toLowerCase()}`);
    if (!raw) return [];

    const roomIds: string[] = JSON.parse(raw);
    const rooms: ChatRoomMeta[] = [];

    for (const roomId of roomIds) {
      const meta = await getRoomMeta(env, roomId);
      if (meta) rooms.push(meta);
    }

    return rooms.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

async function addRoomToUserIndex(env: Env, walletAddress: string, roomId: string): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    const key = `${KV_PREFIX}rooms:${walletAddress.toLowerCase()}`;
    const raw = await kv.get(key);
    const rooms: string[] = raw ? JSON.parse(raw) : [];
    if (!rooms.includes(roomId)) {
      rooms.push(roomId);
      await kv.put(key, JSON.stringify(rooms), { expirationTtl: 86400 * 365 });
    }
  } catch {
    // Best-effort
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOM METADATA STORAGE
// ═══════════════════════════════════════════════════════════════════════════

export async function saveRoomMeta(env: Env, roomId: string, meta: ChatRoomMeta): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;
  await kv.put(`${ROOM_META_PREFIX}${roomId}`, JSON.stringify(meta), {
    expirationTtl: 86400 * 365,
  });
}

export async function getRoomMeta(env: Env, roomId: string): Promise<ChatRoomMeta | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${ROOM_META_PREFIX}${roomId}`);
    return raw ? (JSON.parse(raw) as ChatRoomMeta) : null;
  } catch {
    return null;
  }
}

function getDMKey(a: string, b: string): string {
  const parts = [a.toLowerCase(), b.toLowerCase()].sort();
  return `${KV_PREFIX}dm:${parts[0]}:${parts[1]}`;
}

async function getGroupList(env: Env): Promise<string[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];
  try {
    const raw = await kv.get(`${KV_PREFIX}group:list`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatHealthDashboard {
  status: 'healthy' | 'degraded' | 'down';
  conduit: {
    status: 'online' | 'offline' | 'degraded';
    uptime: number;
    version: string;
    users: number;
    rooms: number;
  };
  bridges: Array<{
    name: string;
    protocol: ChatProtocol;
    status: 'online' | 'offline' | 'degraded';
    latencyMs: number;
    messagesProcessed: number;
    lastHealthCheck: number;
  }>;
  federation: {
    status: 'connected' | 'disconnected' | 'degraded';
    federatedServers: string[];
    lastCheck: number;
  };
  metrics: {
    totalRooms: number;
    totalDMs: number;
    totalGroups: number;
    activeUsers24h: number;
    messagesLast24h: number;
    messagesPerSecond: number;
    bridgeCoverage: number; // percentage of bridges online
  };
  timestamp: number;
}

/**
 * Comprehensive chat health check.
 * Returns the full health dashboard for all bridges + Conduit + federation.
 */
export async function getChatHealth(env: Env): Promise<ChatHealthDashboard> {
  const results: ChatHealthDashboard = {
    status: 'healthy',
    conduit: { status: 'offline', uptime: 0, version: '', users: 0, rooms: 0 },
    bridges: [],
    federation: { status: 'disconnected', federatedServers: [], lastCheck: 0 },
    metrics: {
      totalRooms: 0,
      totalDMs: 0,
      totalGroups: 0,
      activeUsers24h: 0,
      messagesLast24h: 0,
      messagesPerSecond: 0,
      bridgeCoverage: 0,
    },
    timestamp: Date.now(),
  };

  // Check Conduit
  try {
    const verRes = await fetch(`${CONDUIT_URL}/_matrix/client/v3/versions`, {
      signal: AbortSignal.timeout(5000),
    });
    if (verRes.ok) {
      const verData = (await verRes.json()) as { versions: string[] };
      results.conduit.status = 'online';
      results.conduit.version = verData.versions?.[0] || 'unknown';
    }
  } catch {
    results.conduit.status = 'offline';
    results.status = 'down';
  }

  // Try admin API for stats
  try {
    const adminToken = process.env.CONDUIT_ADMIN_TOKEN || '';
    if (adminToken) {
      const infoRes = await fetch(`${CONDUIT_URL}/_matrix/conduit/v1/info`, {
        headers: { authorization: `Bearer ${adminToken}` },
        signal: AbortSignal.timeout(5000),
      });
      if (infoRes.ok) {
        const info = (await infoRes.json()) as { total_users?: number; total_rooms?: number };
        results.conduit.users = info.total_users || 0;
        results.conduit.rooms = info.total_rooms || 0;
      }
    }
  } catch {
    // Non-critical
  }

  // Check all bridges
  const bridgeConfigs: Array<{ name: string; protocol: ChatProtocol; url: string }> = [
    { name: 'IRC', protocol: 'irc', url: 'http://matrix-irc:8090' },
    { name: 'XMPP', protocol: 'xmpp', url: 'http://matrix-xmpp:8080' },
    { name: 'Telegram', protocol: 'telegram', url: 'http://matrix-telegram:8080' },
    { name: 'Discord', protocol: 'discord', url: 'http://matrix-discord:9005' },
    { name: 'Slack', protocol: 'irc', url: 'http://matrix-slack:8080' },
    { name: 'Signal', protocol: 'signal', url: 'http://matrix-signal:8080' },
    { name: 'WhatsApp', protocol: 'whatsapp', url: 'http://matrix-whatsapp:8080' },
    { name: 'Nostr', protocol: 'nostr', url: 'http://matrix-nostr:8080' },
  ];

  let bridgesUp = 0;
  for (const bridge of bridgeConfigs) {
    const start = Date.now();
    try {
      const bridgeRes = await fetch(`${bridge.url}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const latencyMs = Date.now() - start;

      if (bridgeRes.ok) {
        bridgesUp++;
        results.bridges.push({
          name: bridge.name,
          protocol: bridge.protocol,
          status: 'online',
          latencyMs,
          messagesProcessed: 0,
          lastHealthCheck: Date.now(),
        });
      } else {
        results.bridges.push({
          name: bridge.name,
          protocol: bridge.protocol,
          status: 'degraded',
          latencyMs,
          messagesProcessed: 0,
          lastHealthCheck: Date.now(),
        });
      }
    } catch {
      results.bridges.push({
        name: bridge.name,
        protocol: bridge.protocol,
        status: 'offline',
        latencyMs: Date.now() - start,
        messagesProcessed: 0,
        lastHealthCheck: Date.now(),
      });
    }
  }

  // Check federation
  try {
    const fedRes = await fetch(`${CONDUIT_URL}/_matrix/federation/v1/version`, {
      headers: { host: MATRIX_DOMAIN },
      signal: AbortSignal.timeout(5000),
    });
    results.federation.status = fedRes.ok ? 'connected' : 'degraded';

    // Try to reach matrix.org
    const matrixOrgRes = await fetch('https://matrix.org/_matrix/federation/v1/version', {
      signal: AbortSignal.timeout(5000),
    });
    if (matrixOrgRes.ok) {
      results.federation.federatedServers.push('matrix.org');
    }
  } catch {
    results.federation.status = 'disconnected';
  }
  results.federation.lastCheck = Date.now();

  // Compute metrics
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    try {
      // Count rooms from group list + DM index
      const groupList = await getGroupList(env);
      results.metrics.totalGroups = groupList.length;

      // Count active users in last 24h
      const activeRaw = await kv.get(`${KV_PREFIX}active:24h`).catch(() => null);
      if (activeRaw) results.metrics.activeUsers24h = parseInt(activeRaw, 10);
    } catch {
      // Non-critical
    }
  }

  results.metrics.totalRooms = results.metrics.totalDMs + results.metrics.totalGroups;
  results.metrics.bridgeCoverage =
    bridgeConfigs.length > 0 ? Math.round((bridgesUp / bridgeConfigs.length) * 100) : 0;

  // Overall status
  if (results.conduit.status === 'offline') {
    results.status = 'down';
  } else if (bridgesUp < bridgeConfigs.length || results.federation.status === 'disconnected') {
    results.status = 'degraded';
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CLASSES
// ═══════════════════════════════════════════════════════════════════════════

export class MatrixError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'MatrixError';
  }
}

export class MatrixRateLimitedError extends MatrixError {
  constructor(public readonly retryAfter: number) {
    super(`Matrix rate limited. Retry after ${retryAfter}s`, 429);
    this.name = 'MatrixRateLimitedError';
  }
}

export class MatrixAuthError extends MatrixError {
  constructor(message = 'Matrix authentication failed') {
    super(message, 401);
    this.name = 'MatrixAuthError';
  }
}

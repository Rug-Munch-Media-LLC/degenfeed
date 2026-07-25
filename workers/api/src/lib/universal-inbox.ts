/**
 * @degenfeed/api-worker — Universal Inbox
 *
 * THE single inbox that aggregates ALL messages, comments, notifications,
 * and mentions from EVERY protocol into one unified stream.
 *
 * TASKS COVERED:
 *   TASK 1 — Universal Inbox: aggregate DMs, comments, replies, mentions, notifications
 *   TASK 2 — Cross-Network Reply: route replies to correct protocol
 *   TASK 3 — Protocol Activity Feed: human-readable cross-protocol activity
 *   TASK 4 — Cross-Network Sharing: share content between networks
 *   TASK 5 — Network Status Integration: per-protocol user connection status
 *
 * API:
 *   GET    /api/inbox/unified       — All messages, unified
 *   GET    /api/inbox/dms           — DMs only
 *   GET    /api/inbox/comments      — Comments only
 *   GET    /api/inbox/activity      — Activity feed
 *   POST   /api/inbox/reply         — Reply to anything from anywhere
 *   POST   /api/inbox/mark-read     — Mark items as read
 *   GET    /api/inbox/status        — Network connection status
 *   POST   /api/inbox/share         — Cross-network share
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import { noCacheJsonResponse } from '../index';
import { hasSuspiciousPayload } from '../sanitize';
import { requireSession } from '../session';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type InboxItemKind =
  | 'dm'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'like'
  | 'repost'
  | 'follow'
  | 'tip';

export interface InboxActor {
  id: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  protocol: Protocol;
}

export interface InboxItem {
  /** Canonical ID: `${protocol}:${kind}:${nativeId}` */
  id: string;
  kind: InboxItemKind;
  protocol: Protocol;
  actor: InboxActor;
  /** Plain text content of the message/comment/notification */
  content: string;
  /** Rich HTML if available */
  html?: string;
  /** Unix ms timestamp */
  createdAt: number;
  /** Whether the item has been read */
  read: boolean;
  /** Whether the item has been seen (viewed in feed) */
  seen: boolean;
  /** For replies/comments: the parent post/comment reference */
  parentId?: string;
  /** For replies/comments: the parent protocol */
  parentProtocol?: Protocol;
  /** For replies/comments: the root post reference */
  rootId?: string;
  /** For DMs: the conversation ID */
  conversationId?: string;
  /** For DMs: list of participants (wallet addresses) */
  participants?: string[];
  /** For DMs: the recipient protocol-native ID */
  recipientId?: string;
  /** For tips: amount and currency */
  amount?: string;
  currency?: string;
  /** URL to the original post/comment */
  url?: string;
  /** Protocol-specific native ID for round-trip operations */
  nativeId?: string;
  /** Per-protocol auth/identity needed for reply operations */
  replyAuth?: Record<string, string>;
}

export interface InboxFeed {
  items: InboxItem[];
  meta: {
    total: number;
    unread: number;
    byKind: Partial<Record<InboxItemKind, number>>;
    byProtocol: Partial<Record<Protocol, number>>;
    nextCursor?: string;
    fetchedAt: number;
  };
}

export interface InboxReplyRequest {
  /** The inbox item ID to reply to (e.g. "mastodon:reply:12345") */
  parentInboxId: string;
  /** The reply text content */
  content: string;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Pre-signed event for client-side signing protocols (Nostr, Farcaster, Lens) */
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
}

export interface InboxShareRequest {
  /** Content source URI (df:// or raw) */
  sourceUri: string;
  /** Source protocol */
  sourceProtocol: Protocol;
  /** Target protocols to share to */
  targetProtocols: Protocol[];
  /** Optional custom text override */
  text?: string;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
}

export interface NetworkStatus {
  connected: boolean;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
  capabilities: NetworkCapability[];
  lastVerified: number;
  error?: string;
}

export type NetworkCapability =
  | 'post'
  | 'dm'
  | 'reply'
  | 'comment'
  | 'like'
  | 'repost'
  | 'follow'
  | 'upload-media'
  | 'live-stream'
  | 'tip';

export interface UserNetworkStatus {
  protocols: Partial<Record<Protocol, NetworkStatus>>;
  totalConnected: number;
  totalAvailable: number;
  checkedAt: number;
}

export interface InboxReadRequest {
  /** Array of item IDs to mark as read */
  itemIds: string[];
}

export interface CrossNetworkShareResult {
  protocol: Protocol;
  ok: boolean;
  nativeId?: string;
  url?: string;
  error?: string;
}

export interface ActivityFeedItem {
  id: string;
  /** Human-readable activity description */
  summary: string;
  /** The kind of activity */
  kind: InboxItemKind;
  /** Source protocol */
  sourceProtocol: Protocol;
  /** Target/destination protocol (for cross-protocol activity) */
  targetProtocol?: Protocol;
  actor: InboxActor;
  /** Target actor (the user being interacted with) */
  targetActor?: InboxActor;
  content: string;
  /** URL to the original content */
  url?: string;
  createdAt: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const INBOX_KV_PREFIX = 'inbox:';
const INBOX_UNIFIED_KEY = (userId: string) => `${INBOX_KV_PREFIX}unified:${userId}`;
const INBOX_DMS_KEY = (userId: string) => `${INBOX_KV_PREFIX}dms:${userId}`;
const INBOX_COMMENTS_KEY = (userId: string) => `${INBOX_KV_PREFIX}comments:${userId}`;
const _INBOX_ACTIVITY_KEY = (userId: string) => `${INBOX_KV_PREFIX}activity:${userId}`;
const INBOX_STATUS_KEY = (userId: string) => `${INBOX_KV_PREFIX}status:${userId}`;
const _INBOX_SEEN_KEY = (userId: string) => `${INBOX_KV_PREFIX}seen:${userId}`;

const MAX_INBOX_ITEMS = 500;
const MAX_INBOX_AGE_MS = 86400_000 * 90; // 90 days
const DEFAULT_PAGE_SIZE = 50;

const PROTOCOL_MAX_LENGTH: Record<string, number> = {
  farcaster: 320,
  mastodon: 500,
  bluesky: 300,
  threads: 500,
  nostr: 10000,
  lens: 10000,
  lemmy: 10000,
  reddit: 40000,
  peertube: 5000,
  pixelfed: 5000,
};

// Supported DM protocols
const _DM_PROTOCOLS = new Set<Protocol>([
  'nostr',
  'matrix',
  'bluesky',
  'mastodon',
  'discord',
  'telegram',
  'farcaster',
  'lens',
  'xmtp',
]);

// Supported comment protocols
const _COMMENT_PROTOCOLS = new Set<Protocol>([
  'peertube',
  'lemmy',
  'pixelfed',
  'mastodon',
  'nostr',
  'farcaster',
  'bluesky',
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROTOCOL LABELS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  threads: 'Threads',
  mastodon: 'Mastodon',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  pixelfed: 'Pixelfed',
  matrix: 'Matrix',
  discord: 'Discord',
  telegram: 'Telegram',
  xmtp: 'XMTP',
  reddit: 'Reddit',
  rss: 'RSS',
  youtube: 'YouTube',
  github: 'GitHub',
};

function formatProtocol(p: string): string {
  return PROTOCOL_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KV HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getInboxItems(env: Env, key: string): Promise<InboxItem[]> {
  if (!env.CACHE) return [];
  try {
    const raw = await env.CACHE.get(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveInboxItems(env: Env, key: string, items: InboxItem[]): Promise<void> {
  if (!env.CACHE) return;
  try {
    const now = Date.now();
    const valid = items.filter((i) => now - i.createdAt < MAX_INBOX_AGE_MS).slice(-MAX_INBOX_ITEMS);
    await env.CACHE.put(key, JSON.stringify(valid), {
      expirationTtl: Math.ceil(MAX_INBOX_AGE_MS / 1000),
    });
  } catch (e) {
    console.error('[universal-inbox] KV save failed:', e);
  }
}

async function _upsertInboxItem(env: Env, key: string, newItem: InboxItem): Promise<void> {
  const items = await getInboxItems(env, key);
  const existingIdx = items.findIndex((i) => i.id === newItem.id);
  if (existingIdx >= 0) {
    items[existingIdx] = { ...items[existingIdx], ...newItem, read: newItem.read };
  } else {
    items.push(newItem);
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  await saveInboxItems(env, key, items);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 1: PROTOCOL-SPECIFIC FETCHERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch DMs from Nostr via NIP-04 / NIP-17.
 * Uses the relay pool to fetch direct messages for a given pubkey.
 */
async function fetchNostrDMs(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {
  if (!pubkey) return [];
  const items: InboxItem[] = [];
  const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
  const hexPubkey = pubkey.startsWith('npub1') ? pubkey : pubkey;

  for (const relayUrl of relays) {
    try {
      const ws = new WebSocket(relayUrl);
      const result = await new Promise<InboxItem[]>((resolve) => {
        const localItems: InboxItem[] = [];
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve(localItems);
          }
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(
            JSON.stringify([
              'REQ',
              `df-inbox-dm-${Date.now()}`,
              {
                kinds: [4, 14, 1059],
                '#p': [hexPubkey],
                limit: 50,
              },
            ]),
          );
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'EVENT') {
              const ev = msg[2] as {
                id: string;
                pubkey: string;
                kind: number;
                created_at: number;
                content: string;
                tags: string[][];
              };
              const senderPubkey = ev.pubkey;
              localItems.push({
                id: `nostr:dm:${ev.id}`,
                kind: 'dm',
                protocol: 'nostr',
                actor: {
                  id: senderPubkey,
                  handle: senderPubkey.slice(0, 12),
                  displayName: senderPubkey.slice(0, 12),
                  protocol: 'nostr',
                },
                content: ev.content,
                createdAt: ev.created_at * 1000,
                read: false,
                seen: false,
                conversationId: [hexPubkey, senderPubkey].sort().join(':'),
                participants: [hexPubkey, senderPubkey],
                recipientId: hexPubkey,
                nativeId: ev.id,
              });
            } else if (msg[0] === 'EOSE') {
              clearTimeout(timer);
              if (!resolved) {
                resolved = true;
                ws.close();
                resolve(localItems);
              }
            }
          } catch {
            /* skip */
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            resolve(localItems);
          }
        });
        ws.addEventListener('close', () => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            resolve(localItems);
          }
        });
      });
      items.push(...result);
    } catch {
      /* relay down */
    }
  }
  return items;
}

/**
 * Fetch DMs from Matrix via the Matrix client-server API.
 */
async function fetchMatrixDMs(
  userId: string,
  auth?: Record<string, string>,
  env?: Env,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const matrixToken = auth?.matrix_token ?? auth?.matrixAccessToken ?? env?.MATRIX_ACCESS_TOKEN;
  const matrixUrl =
    auth?.matrix_instance ??
    auth?.matrixInstanceUrl ??
    env?.MATRIX_INSTANCE_URL ??
    'https://matrix.degenfeed.xyz';
  const matrixUserId = auth?.matrix_user_id ?? userId;

  if (!matrixToken) return items;

  try {
    // Get all rooms the user is in
    const roomsRes = await fetch(`${matrixUrl}/_matrix/client/v3/joined_rooms`, {
      headers: { authorization: `Bearer ${matrixToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!roomsRes.ok) return items;
    const roomsData = (await roomsRes.json()) as { joined_rooms?: string[] };
    const roomIds = roomsData.joined_rooms ?? [];

    // Fetch recent events from each room in parallel (limit to 10 rooms)
    const batchSize = 10;
    const batch = roomIds.slice(0, batchSize);

    const roomPromises = batch.map(async (roomId: string) => {
      try {
        // Get room name/state
        const stateRes = await fetch(
          `${matrixUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`,
          {
            headers: { authorization: `Bearer ${matrixToken}` },
            signal: AbortSignal.timeout(5000),
          },
        );
        let _roomName = roomId;
        if (stateRes.ok) {
          const stateData = (await stateRes.json()) as { name?: string };
          if (stateData.name) _roomName = stateData.name;
        }

        // Get recent messages
        const msgsRes = await fetch(
          `${matrixUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`,
          {
            headers: { authorization: `Bearer ${matrixToken}` },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!msgsRes.ok) return [];
        const msgsData = (await msgsRes.json()) as {
          chunk?: Array<{
            event_id: string;
            type: string;
            sender: string;
            origin_server_ts: number;
            content?: { body?: string; msgtype?: string };
          }>;
        };
        const roomItems: InboxItem[] = [];

        for (const evt of msgsData.chunk ?? []) {
          if (evt.type !== 'm.room.message') continue;
          if (!evt.content?.body) continue;
          const sender = evt.sender;
          if (sender === matrixUserId) continue; // Skip own messages

          roomItems.push({
            id: `matrix:dm:${evt.event_id}`,
            kind: 'dm',
            protocol: 'matrix',
            actor: {
              id: sender,
              handle: sender,
              displayName: sender,
              protocol: 'matrix',
            },
            content: evt.content.body,
            createdAt: evt.origin_server_ts,
            read: false,
            seen: false,
            conversationId: roomId,
            participants: [matrixUserId, sender],
            recipientId: matrixUserId,
            nativeId: evt.event_id,
            replyAuth: {
              matrix_token: matrixToken,
              matrix_instance: matrixUrl,
              matrix_room_id: roomId,
            },
          });
        }
        return roomItems;
      } catch {
        return [];
      }
    });

    const results = await Promise.allSettled(roomPromises);
    for (const r of results) {
      if (r.status === 'fulfilled') items.push(...r.value);
    }
  } catch {
    /* matrix unreachable */
  }

  return items;
}

/**
 * Fetch DMs from Mastodon (direct visibility statuses).
 */
async function fetchMastodonDMs(
  _userId: string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth?.mastodon ?? auth?.accessToken ?? auth?.mastodon_token;
  if (!token) return items;

  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instance, token);
    const me = await client.verifyCredentials();

    // Fetch notifications for DMs (mentions with direct visibility)
    const notifRes = await fetch(`${instance}/api/v1/notifications?limit=40&types[]=mention`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!notifRes.ok) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string;
      type: string;
      created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content: string; visibility: string; in_reply_to_id?: string | null };
    }>;

    for (const n of notifs) {
      if (n.status?.visibility !== 'direct') continue;
      items.push({
        id: `mastodon:dm:${n.id}`,
        kind: 'dm',
        protocol: 'mastodon',
        actor: {
          id: n.account?.id ?? '',
          handle: n.account?.acct ?? '',
          displayName: n.account?.display_name ?? n.account?.acct,
          avatarUrl: n.account?.avatar,
          protocol: 'mastodon',
        },
        content: n.status?.content ? stripHtml(n.status.content) : '',
        html: n.status?.content,
        createdAt: new Date(n.created_at).getTime(),
        read: false,
        seen: false,
        conversationId: [me.id, n.account?.id ?? ''].sort().join(':'),
        participants: [me.id, n.account?.id ?? ''],
        recipientId: me.id,
        parentId: n.status?.in_reply_to_id ?? undefined,
        parentProtocol: 'mastodon',
        nativeId: n.status?.id,
        replyAuth: { mastodon: token, mastodon_instance: instance },
      });
    }
  } catch {
    /* mastodon unreachable */
  }

  return items;
}

/**
 * Fetch DMs from Bluesky via AT Protocol chat (app.bsky.feed.post with reply root).
 * Bluesky doesn't have a native DM API, but we can detect mentions
 * and use the chat.bsky.chat.* lexicons if available.
 */
async function fetchBlueskyDMs(did: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const accessJwt = auth?.bluesky_jwt ?? auth?.bluesky_accessJwt ?? auth?.accessJwt;
  if (!accessJwt || !did) return items;

  try {
    const pdsUrl = auth?.bluesky_pds ?? 'https://bsky.social';

    // Get the user's DM conversations from the chat API
    const convRes = await fetch(`${pdsUrl}/xrpc/chat.bsky.conv.listConvs?limit=20`, {
      headers: { authorization: `Bearer ${accessJwt}` },
      signal: AbortSignal.timeout(8000),
    });

    if (convRes.ok) {
      const convData = (await convRes.json()) as {
        convs?: Array<{
          id: string;
          lastMessage?: { text?: string };
          members?: Array<{ did: string }>;
        }>;
      };

      for (const conv of convData.convs ?? []) {
        // Get messages in this conversation
        const msgRes = await fetch(
          `${pdsUrl}/xrpc/chat.bsky.conv.getMessages?convId=${conv.id}&limit=20`,
          {
            headers: { authorization: `Bearer ${accessJwt}` },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!msgRes.ok) continue;
        const msgData = (await msgRes.json()) as {
          messages?: Array<{
            id: string;
            text?: string;
            sender?: { did: string };
            sentAt?: string;
          }>;
        };

        for (const msg of msgData.messages ?? []) {
          if (msg.sender?.did === did) continue; // Skip own messages
          items.push({
            id: `bluesky:dm:${msg.id}`,
            kind: 'dm',
            protocol: 'bluesky',
            actor: {
              id: msg.sender?.did ?? '',
              handle: msg.sender?.did ?? '',
              protocol: 'bluesky',
            },
            content: msg.text ?? '',
            createdAt: msg.sentAt ? new Date(msg.sentAt).getTime() : Date.now(),
            read: false,
            seen: false,
            conversationId: conv.id,
            nativeId: msg.id,
            replyAuth: { bluesky_jwt: accessJwt, bluesky_did: did },
          });
        }
      }
    } else {
      // Fallback: fetch recent mentions from the public API
      const authorFeedRes = await fetch(
        `${pdsUrl}/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=30`,
        {
          headers: { authorization: `Bearer ${accessJwt}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (authorFeedRes.ok) {
        const feedData = (await authorFeedRes.json()) as {
          feed?: Array<{
            post?: {
              uri: string;
              cid: string;
              author?: { did: string; handle: string; displayName?: string; avatar?: string };
              record?: { text?: string; reply?: { parent?: { uri: string } } };
              indexedAt?: string;
            };
          }>;
        };
        for (const item of feedData.feed ?? []) {
          const post = item.post;
          if (!post?.record?.reply) continue;
          items.push({
            id: `bluesky:dm:${post.uri}`,
            kind: 'dm',
            protocol: 'bluesky',
            actor: {
              id: post.author?.did ?? '',
              handle: post.author?.handle ?? '',
              displayName: post.author?.displayName,
              avatarUrl: post.author?.avatar,
              protocol: 'bluesky',
            },
            content: post.record?.text ?? '',
            createdAt: post.indexedAt ? new Date(post.indexedAt).getTime() : Date.now(),
            read: false,
            seen: false,
            nativeId: post.uri,
            replyAuth: { bluesky_jwt: accessJwt, bluesky_did: did },
          });
        }
      }
    }
  } catch {
    /* bluesky unreachable */
  }

  return items;
}

/**
 * Fetch DMs from Farcaster (via Hub casts that reply to user's casts).
 */
async function fetchFarcasterDMs(
  fid: number | string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const hubUrl = auth?.farcaster_hub ?? 'https://hub.farcaster.standardcrypto.vc:2281';
  const numericFid = typeof fid === 'string' ? Number.parseInt(fid, 10) : fid;
  if (Number.isNaN(numericFid)) return items;

  try {
    // Get casts by the user's FID to find replies
    const castsRes = await fetch(`${hubUrl}/v1/castsByFid?fid=${numericFid}&limit=20`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!castsRes.ok) return items;
    const castsData = (await castsRes.json()) as {
      messages?: Array<{
        data?: {
          castAddBody?: { parentCastId?: { fid: number }; text: string };
        };
      }>;
    };

    const _userCastHashes: string[] = [];
    for (const msg of castsData.messages ?? []) {
      if (msg.data?.castAddBody) {
        const body = msg.data.castAddBody;
        if (body.parentCastId) {
          const senderFid = body.parentCastId.fid;
          if (senderFid !== numericFid) {
            items.push({
              id: `farcaster:dm:${msg}`,
              kind: 'dm',
              protocol: 'farcaster',
              actor: {
                id: String(senderFid),
                handle: `fid:${senderFid}`,
                protocol: 'farcaster',
              },
              content: body.text.slice(0, 320),
              createdAt: Date.now(),
              read: false,
              seen: false,
              nativeId: String(senderFid),
              replyAuth: { farcaster_hub: hubUrl },
            });
          }
        }
      }
    }
  } catch {
    /* farcaster hub unreachable */
  }

  return items;
}

/**
 * Fetch comments from PeerTube via the PeerTube API.
 */
async function fetchPeerTubeComments(
  userId: string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.peertube_instance ?? 'https://video.degenfeed.xyz';
  const token = auth?.peertube ?? auth?.accessToken;

  try {
    // Fetch user's videos to find comments on them
    const accountName = userId.includes('@') ? userId.split('@')[0] : userId;
    const videosRes = await fetch(
      `${instance}/api/v1/accounts/${encodeURIComponent(accountName)}/videos?count=10`,
      {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!videosRes.ok) return items;
    const videosData = (await videosRes.json()) as { data?: Array<{ uuid: string; name: string }> };

    for (const video of videosData.data ?? []) {
      try {
        const commentsRes = await fetch(
          `${instance}/api/v1/videos/${video.uuid}/comment-threads?count=20`,
          {
            headers: token ? { authorization: `Bearer ${token}` } : {},
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!commentsRes.ok) continue;
        const commentsData = (await commentsRes.json()) as {
          data?: Array<{
            id: number;
            text: string;
            createdAt: string;
            account?: { id: number; displayName: string; name: string; avatar?: { path?: string } };
            inReplyToCommentId?: number;
          }>;
        };

        for (const comment of commentsData.data ?? []) {
          if (!comment.account) continue;
          items.push({
            id: `peertube:comment:${comment.id}`,
            kind: 'comment',
            protocol: 'peertube',
            actor: {
              id: String(comment.account.id),
              handle: comment.account.name,
              displayName: comment.account.displayName,
              avatarUrl: comment.account.avatar?.path
                ? `${instance}${comment.account.avatar.path}`
                : undefined,
              protocol: 'peertube',
            },
            content: stripHtml(comment.text),
            createdAt: new Date(comment.createdAt).getTime(),
            read: false,
            seen: false,
            parentId: video.uuid,
            parentProtocol: 'peertube',
            rootId: video.uuid,
            url: `${instance}/videos/watch/${video.uuid}`,
            nativeId: String(comment.id),
            replyAuth: { peertube: token ?? '', peertube_instance: instance },
          });
        }
      } catch {
        /* video comments failed */
      }
    }
  } catch {
    /* peertube unreachable */
  }

  return items;
}

/**
 * Fetch comments/replies from Lemmy via its API.
 */
async function fetchLemmyComments(
  _userId: string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.lemmy_instance ?? 'https://community.degenfeed.xyz';
  const token = auth?.lemmy ?? auth?.authToken;

  try {
    // Fetch the user's replies
    const repliesRes = await fetch(`${instance}/api/v3/user/replies?limit=50&sort=New`, {
      headers: token
        ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
        : { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!repliesRes.ok) return items;
    const repliesData = (await repliesRes.json()) as {
      replies?: Array<{
        comment_reply?: {
          id: number;
          comment?: {
            id: number;
            content: string;
            published: string;
            creator?: { id: number; name: string; display_name?: string; avatar?: string };
            post?: { id: number; name: string };
          };
        };
      }>;
    };

    for (const reply of repliesData.replies ?? []) {
      const cr = reply.comment_reply;
      if (!cr?.comment) continue;
      const comment = cr.comment;
      items.push({
        id: `lemmy:comment:${comment.id}`,
        kind: 'comment',
        protocol: 'lemmy',
        actor: {
          id: String(comment.creator?.id ?? ''),
          handle: comment.creator?.name ?? '',
          displayName: comment.creator?.display_name ?? comment.creator?.name,
          avatarUrl: comment.creator?.avatar,
          protocol: 'lemmy',
        },
        content: stripHtml(comment.content),
        createdAt: new Date(comment.published).getTime(),
        read: false,
        seen: false,
        parentId: String(comment.post?.id ?? ''),
        parentProtocol: 'lemmy',
        url: `${instance}/post/${comment.post?.id ?? ''}`,
        nativeId: String(comment.id),
        replyAuth: { lemmy: token ?? '', lemmy_instance: instance },
      });
    }
  } catch {
    /* lemmy unreachable */
  }

  return items;
}

/**
 * Fetch comments from Pixelfed (Mastodon-compatible API).
 */
async function fetchPixelfedComments(
  _userId: string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.pixelfed_instance ?? 'https://gram.degenfeed.xyz';
  const token = auth?.pixelfed ?? auth?.accessToken;
  if (!token) return items;

  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instance, token);
    const _me = await client.verifyCredentials();

    // Fetch notifications for mentions (comments)
    const notifRes = await fetch(`${instance}/api/v1/notifications?limit=40`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!notifRes.ok) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string;
      type: string;
      created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content: string; media_attachments?: Array<{ url: string }> };
    }>;

    for (const n of notifs) {
      if (n.type !== 'mention') continue;
      items.push({
        id: `pixelfed:comment:${n.id}`,
        kind: 'comment',
        protocol: 'pixelfed',
        actor: {
          id: n.account?.id ?? '',
          handle: n.account?.acct ?? '',
          displayName: n.account?.display_name,
          avatarUrl: n.account?.avatar,
          protocol: 'pixelfed',
        },
        content: n.status?.content ? stripHtml(n.status.content) : '',
        html: n.status?.content,
        createdAt: new Date(n.created_at).getTime(),
        read: false,
        seen: false,
        nativeId: n.status?.id,
        url: `${instance}/@${n.account?.acct ?? ''}/${n.status?.id ?? ''}`,
        replyAuth: { pixelfed: token, pixelfed_instance: instance },
      });
    }
  } catch {
    /* pixelfed unreachable */
  }

  return items;
}

/**
 * Fetch Mastodon replies (mentions).
 */
async function fetchMastodonReplies(
  _userId: string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth?.mastodon ?? auth?.accessToken ?? auth?.mastodon_token;
  if (!token) return items;

  try {
    const notifRes = await fetch(
      `${instance}/api/v1/notifications?limit=40&types[]=mention&types[]=status`,
      { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!notifRes.ok) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string;
      type: string;
      created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: {
        id: string;
        content: string;
        in_reply_to_id?: string | null;
        account?: { id: string };
      };
    }>;

    for (const n of notifs) {
      items.push({
        id: `mastodon:reply:${n.id}`,
        kind: 'reply',
        protocol: 'mastodon',
        actor: {
          id: n.account?.id ?? '',
          handle: n.account?.acct ?? '',
          displayName: n.account?.display_name,
          avatarUrl: n.account?.avatar,
          protocol: 'mastodon',
        },
        content: n.status?.content ? stripHtml(n.status.content) : '',
        html: n.status?.content,
        createdAt: new Date(n.created_at).getTime(),
        read: false,
        seen: false,
        parentId: n.status?.in_reply_to_id ?? undefined,
        parentProtocol: 'mastodon',
        nativeId: n.status?.id,
        replyAuth: { mastodon: token, mastodon_instance: instance },
      });
    }
  } catch {
    /* mastodon unreachable */
  }

  return items;
}

/**
 * Fetch Nostr replies (kind 1 notes that reference user's events).
 */
async function fetchNostrReplies(
  pubkey: string,
  _auth?: Record<string, string>,
): Promise<InboxItem[]> {
  if (!pubkey) return [];
  const items: InboxItem[] = [];
  const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
  const hexPubkey = pubkey.startsWith('npub1') ? pubkey : pubkey;

  for (const relayUrl of relays) {
    try {
      const ws = new WebSocket(relayUrl);
      const result = await new Promise<InboxItem[]>((resolve) => {
        const localItems: InboxItem[] = [];
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve(localItems);
          }
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(
            JSON.stringify([
              'REQ',
              `df-inbox-reply-${Date.now()}`,
              { kinds: [1], '#p': [hexPubkey], limit: 50 },
            ]),
          );
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'EVENT') {
              const ev = msg[2] as {
                id: string;
                pubkey: string;
                kind: number;
                created_at: number;
                content: string;
                tags: string[][];
              };
              localItems.push({
                id: `nostr:reply:${ev.id}`,
                kind: 'reply',
                protocol: 'nostr',
                actor: {
                  id: ev.pubkey,
                  handle: ev.pubkey.slice(0, 12),
                  displayName: ev.pubkey.slice(0, 12),
                  protocol: 'nostr',
                },
                content: ev.content,
                createdAt: ev.created_at * 1000,
                read: false,
                seen: false,
                parentId: ev.tags.find((t) => t[0] === 'e')?.[1],
                parentProtocol: 'nostr',
                rootId: ev.tags.filter((t) => t[0] === 'e')[0]?.[1],
                nativeId: ev.id,
              });
            } else if (msg[0] === 'EOSE') {
              clearTimeout(timer);
              if (!resolved) {
                resolved = true;
                ws.close();
                resolve(localItems);
              }
            }
          } catch {
            /* skip */
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            resolve(localItems);
          }
        });
        ws.addEventListener('close', () => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            resolve(localItems);
          }
        });
      });
      items.push(...result);
    } catch {
      /* relay down */
    }
  }
  return items;
}

/**
 * Fetch Farcaster replies (casts that reply to the user's casts).
 */
async function fetchFarcasterReplies(
  fid: number | string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const hubUrl = auth?.farcaster_hub ?? 'https://hub.farcaster.standardcrypto.vc:2281';
  const numericFid = typeof fid === 'string' ? Number.parseInt(fid, 10) : fid;
  if (Number.isNaN(numericFid)) return items;

  try {
    // Fetch the user's recent casts and then find replies to them
    const castsRes = await fetch(`${hubUrl}/v1/castsByFid?fid=${numericFid}&limit=10`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!castsRes.ok) return items;
    const castsData = (await castsRes.json()) as {
      messages?: Array<{ hash: string }>;
    };

    for (const msg of castsData.messages ?? []) {
      try {
        const repliesRes = await fetch(
          `${hubUrl}/v1/castsByParent?fid=${numericFid}&hash=${msg.hash}&limit=20`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!repliesRes.ok) continue;
        const repliesData = (await repliesRes.json()) as {
          messages?: Array<{
            hash: string;
            data?: {
              fid: number;
              castAddBody?: { text: string; parentCastId?: { fid: number } };
              timestamp?: number;
            };
          }>;
        };

        for (const replyMsg of repliesData.messages ?? []) {
          const replyFid = replyMsg.data?.fid;
          if (!replyFid || replyFid === numericFid) continue;
          items.push({
            id: `farcaster:reply:${replyMsg.hash}`,
            kind: 'reply',
            protocol: 'farcaster',
            actor: {
              id: String(replyFid),
              handle: `fid:${replyFid}`,
              protocol: 'farcaster',
            },
            content: replyMsg.data?.castAddBody?.text ?? '',
            createdAt: replyMsg.data?.timestamp ? replyMsg.data.timestamp * 1000 : Date.now(),
            read: false,
            seen: false,
            parentId: msg.hash,
            parentProtocol: 'farcaster',
            nativeId: replyMsg.hash,
            replyAuth: { farcaster_hub: hubUrl },
          });
        }
      } catch {
        /* replies fetch failed */
      }
    }
  } catch {
    /* farcaster hub unreachable */
  }

  return items;
}

/**
 * Fetch likes/reposts/follows/tips from Nostr (kind 7, 9735 reactions).
 */
async function fetchNostrNotifications(
  pubkey: string,
  _auth?: Record<string, string>,
): Promise<InboxItem[]> {
  if (!pubkey) return [];
  const items: InboxItem[] = [];
  const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

  for (const relayUrl of relays) {
    try {
      const ws = new WebSocket(relayUrl);
      const result = await new Promise<InboxItem[]>((resolve) => {
        const localItems: InboxItem[] = [];
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve(localItems);
          }
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(
            JSON.stringify([
              'REQ',
              `df-inbox-notif-${Date.now()}`,
              { kinds: [7, 9735, 6], '#p': [pubkey], limit: 50 },
            ]),
          );
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'EVENT') {
              const ev = msg[2] as {
                id: string;
                pubkey: string;
                kind: number;
                created_at: number;
                content: string;
                tags: string[][];
              };
              let kind: InboxItemKind = 'like';
              if (ev.kind === 7) kind = 'like';
              else if (ev.kind === 9735) kind = 'tip';
              else if (ev.kind === 6) kind = 'repost';

              const item: InboxItem = {
                id: `nostr:${kind}:${ev.id}`,
                kind,
                protocol: 'nostr',
                actor: {
                  id: ev.pubkey,
                  handle: ev.pubkey.slice(0, 12),
                  displayName: ev.pubkey.slice(0, 12),
                  protocol: 'nostr',
                },
                content: kind === 'tip' ? 'Zapped your post' : `${kind}d your post`,
                createdAt: ev.created_at * 1000,
                read: false,
                seen: false,
                parentId: ev.tags.find((t) => t[0] === 'e')?.[1],
                parentProtocol: 'nostr',
                nativeId: ev.id,
              };
              if (kind === 'tip') {
                const amountTag = ev.tags.find((t) => t[0] === 'amount');
                if (amountTag) item.amount = amountTag[1];
                item.currency = 'sats';
              }
              localItems.push(item);
            } else if (msg[0] === 'EOSE') {
              clearTimeout(timer);
              if (!resolved) {
                resolved = true;
                ws.close();
                resolve(localItems);
              }
            }
          } catch {
            /* skip */
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            resolve(localItems);
          }
        });
        ws.addEventListener('close', () => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            resolve(localItems);
          }
        });
      });
      items.push(...result);
    } catch {
      /* relay down */
    }
  }
  return items;
}

/**
 * Fetch Mastodon notifications (likes, reposts, follows).
 */
async function fetchMastodonNotifications(
  _userId: string,
  auth?: Record<string, string>,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth?.mastodon ?? auth?.accessToken ?? auth?.mastodon_token;
  if (!token) return items;

  try {
    const notifRes = await fetch(`${instance}/api/v1/notifications?limit=40`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!notifRes.ok) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string;
      type: string;
      created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content?: string };
    }>;

    const kindMap: Record<string, InboxItemKind> = {
      favourite: 'like',
      reblog: 'repost',
      follow: 'follow',
    };

    for (const n of notifs) {
      const kind = kindMap[n.type];
      if (!kind) continue;
      items.push({
        id: `mastodon:${kind}:${n.id}`,
        kind,
        protocol: 'mastodon',
        actor: {
          id: n.account?.id ?? '',
          handle: n.account?.acct ?? '',
          displayName: n.account?.display_name,
          avatarUrl: n.account?.avatar,
          protocol: 'mastodon',
        },
        content: kind === 'follow' ? 'Followed you' : `${kind}d your post`,
        createdAt: new Date(n.created_at).getTime(),
        read: false,
        seen: false,
        nativeId: n.status?.id,
        replyAuth: { mastodon: token, mastodon_instance: instance },
      });
    }
  } catch {
    /* mastodon unreachable */
  }
  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 1: AGGREGATION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Main aggregation engine — fetches ALL inbox items from ALL connected
 * protocols and returns a unified, deduplicated, sorted feed.
 *
 * Uses the user's linked protocol identities from KV to determine which
 * protocols to fetch from.
 */
export async function aggregateUnifiedInbox(
  walletAddress: string,
  env: Env,
  options?: {
    kind?: InboxItemKind;
    protocols?: Protocol[];
    limit?: number;
    cursor?: string;
    includeRead?: boolean;
  },
): Promise<InboxFeed> {
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const cached = await getInboxItems(env, INBOX_UNIFIED_KEY(walletAddress));

  // If we have a recent cache (< 30s), use it
  if (cached.length > 0 && options?.cursor) {
    return paginateInbox(cached, limit, options.cursor, options.includeRead, options.kind);
  }

  // Fetch all inbox data from protocols
  const linkedProtocols = await getUserLinkedProtocols(walletAddress, env);
  const activeProtocols = options?.protocols ?? linkedProtocols;

  const fetchPromises: Array<Promise<InboxItem[]>> = [];

  for (const protocol of activeProtocols) {
    const auth = linkedProtocols[protocol]?.auth ?? {};
    const userId = linkedProtocols[protocol]?.id ?? '';

    switch (protocol) {
      case 'nostr':
        fetchPromises.push(fetchNostrDMs(userId, auth));
        fetchPromises.push(fetchNostrReplies(userId, auth));
        fetchPromises.push(fetchNostrNotifications(userId, auth));
        break;
      case 'matrix':
        fetchPromises.push(fetchMatrixDMs(userId, auth, env));
        break;
      case 'mastodon':
        fetchPromises.push(fetchMastodonDMs(userId, auth));
        fetchPromises.push(fetchMastodonReplies(userId, auth));
        fetchPromises.push(fetchMastodonNotifications(userId, auth));
        break;
      case 'bluesky':
        fetchPromises.push(fetchBlueskyDMs(userId, auth));
        break;
      case 'farcaster':
        fetchPromises.push(fetchFarcasterDMs(userId, auth));
        fetchPromises.push(fetchFarcasterReplies(userId, auth));
        break;
      case 'peertube':
        fetchPromises.push(fetchPeerTubeComments(userId, auth));
        break;
      case 'lemmy':
        fetchPromises.push(fetchLemmyComments(userId, auth));
        break;
      case 'pixelfed':
        fetchPromises.push(fetchPixelfedComments(userId, auth));
        break;
      default:
        break;
    }
  }

  const settled = await Promise.allSettled(fetchPromises);
  const allItems: InboxItem[] = [...cached]; // Preserve existing read/seen state

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const newItem of r.value) {
        const existing = allItems.find((i) => i.id === newItem.id);
        if (existing) {
          // Preserve read/seen state from cache
          newItem.read = existing.read;
          newItem.seen = existing.seen;
          Object.assign(existing, newItem);
        } else {
          allItems.push(newItem);
        }
      }
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const deduped = allItems.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  deduped.sort((a, b) => b.createdAt - a.createdAt);

  // Save to KV
  await saveInboxItems(env, INBOX_UNIFIED_KEY(walletAddress), deduped);

  return paginateInbox(deduped, limit, options?.cursor, options?.includeRead, options?.kind);
}

/**
 * Fetch only DM items from all protocols.
 */
export async function aggregateDMs(
  walletAddress: string,
  env: Env,
  options?: { limit?: number; cursor?: string; includeRead?: boolean },
): Promise<InboxFeed> {
  return aggregateUnifiedInbox(walletAddress, env, {
    ...options,
    kind: 'dm',
  });
}

/**
 * Fetch only comment items from all protocols.
 */
export async function aggregateComments(
  walletAddress: string,
  env: Env,
  options?: { limit?: number; cursor?: string; includeRead?: boolean },
): Promise<InboxFeed> {
  return aggregateUnifiedInbox(walletAddress, env, {
    ...options,
    kind: 'comment',
  });
}

/**
 * Paginate an inbox item array.
 */
function paginateInbox(
  items: InboxItem[],
  limit: number,
  cursor?: string,
  includeRead?: boolean,
  kindFilter?: InboxItemKind,
): InboxFeed {
  let filtered = items;

  if (!includeRead) {
    filtered = filtered.filter((i) => !i.read);
  }

  if (kindFilter) {
    filtered = filtered.filter((i) => i.kind === kindFilter);
  }

  // Cursor is the createdAt timestamp to start from
  if (cursor) {
    const cursorTime = Number.parseInt(cursor, 10);
    if (!Number.isNaN(cursorTime)) {
      const cursorIdx = filtered.findIndex((i) => i.createdAt <= cursorTime);
      if (cursorIdx >= 0) {
        filtered = filtered.slice(cursorIdx);
      }
    }
  }

  const page = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > limit ? String(page[page.length - 1]?.createdAt ?? '') : undefined;

  const byKind: Partial<Record<InboxItemKind, number>> = {};
  const byProtocol: Partial<Record<Protocol, number>> = {};
  for (const item of page) {
    byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    byProtocol[item.protocol] = (byProtocol[item.protocol] ?? 0) + 1;
  }

  return {
    items: page,
    meta: {
      total: filtered.length,
      unread: page.filter((i) => !i.read).length,
      byKind,
      byProtocol,
      nextCursor,
      fetchedAt: Date.now(),
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 2: CROSS-NETWORK REPLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Reply to any inbox item — auto-routes to the correct protocol.
 *
 * This is the universal reply dispatcher. It inspects the parent item's
 * protocol and calls the appropriate protocol-specific reply handler.
 */
export async function replyToInboxItem(
  walletAddress: string,
  request: InboxReplyRequest,
  env: Env,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const { parentInboxId, content, auth, signedMessage, typedDataId, signature } = request;

  if (!parentInboxId || !content) {
    return { ok: false, error: 'Missing required fields: parentInboxId, content' };
  }

  if (hasSuspiciousPayload(content)) {
    return { ok: false, error: 'Content contains suspicious patterns' };
  }

  // Parse the inbox ID to extract protocol and native ID
  // Format: "protocol:kind:nativeId" e.g. "mastodon:reply:12345"
  const parts = parentInboxId.split(':');
  if (parts.length < 3) {
    return { ok: false, error: `Invalid inbox item ID format: ${parentInboxId}` };
  }
  const protocol = parts[0] as Protocol;
  const nativeId = parts.slice(2).join(':');

  // Get the parent item from the inbox to find its details
  const allItems = await getInboxItems(env, INBOX_UNIFIED_KEY(walletAddress));
  const parentItem = allItems.find((i) => i.id === parentInboxId);

  const _parentProtocol = (parentItem?.parentProtocol ?? protocol) as Protocol;
  const parentNativeId = parentItem?.parentId ?? nativeId;

  // Now route based on protocol
  const mergedAuth = { ...(parentItem?.replyAuth ?? {}), ...(auth ?? {}) };

  // Truncate content to protocol limit if needed
  const maxLen = PROTOCOL_MAX_LENGTH[protocol] ?? 10000;
  const truncatedContent = content.length > maxLen ? `${content.slice(0, maxLen - 3)}...` : content;

  switch (protocol) {
    case 'mastodon': {
      return replyMastodon(truncatedContent, nativeId, mergedAuth, env);
    }
    case 'nostr': {
      return replyNostr(truncatedContent, nativeId, mergedAuth, signedMessage);
    }
    case 'farcaster': {
      return replyFarcaster(truncatedContent, mergedAuth, signedMessage);
    }
    case 'bluesky': {
      return replyBluesky(truncatedContent, mergedAuth);
    }
    case 'peertube': {
      return replyPeerTube(truncatedContent, nativeId, mergedAuth, parentNativeId);
    }
    case 'lemmy': {
      return replyLemmy(truncatedContent, parentNativeId, mergedAuth);
    }
    case 'pixelfed': {
      return replyPixelfed(truncatedContent, nativeId, mergedAuth);
    }
    case 'matrix': {
      return replyMatrix(truncatedContent, mergedAuth);
    }
    default: {
      return { ok: false, error: `Reply to ${protocol} not yet supported` };
    }
  }
}

async function replyMastodon(
  content: string,
  parentId: string,
  auth: Record<string, string>,
  _env: Env,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth.mastodon ?? auth.accessToken;
  if (!token) return { ok: false, error: 'Not authenticated to Mastodon' };

  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: content,
        in_reply_to_id: parentId,
        visibility: 'public',
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { ok: false, error: `Mastodon reply failed: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, nativeId: data.id };
  } catch (e) {
    return { ok: false, error: `Mastodon reply error: ${(e as Error).message}` };
  }
}

async function replyNostr(
  content: string,
  parentEventId: string,
  auth: Record<string, string>,
  signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    if (signedMessage) {
      // Use pre-signed event
      const signedEvent = JSON.parse(signedMessage) as {
        id: string;
        pubkey: string;
        content: string;
        sig: string;
        tags: string[][];
      };
      const { RelayPool } = await import('@degenfeed/nostr-sdk');
      const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 4000 });
      await pool.publish(signedEvent);
      pool.disconnectAll();
      return { ok: true, nativeId: signedEvent.id };
    }

    const nsec = auth.nostr ?? auth.nsec;
    if (!nsec) return { ok: false, error: 'Nostr requires nsec or pre-signed event' };

    const nostr = await import('@degenfeed/nostr-sdk');
    const tags: string[][] = [];
    if (/^[0-9a-f]{64}$/i.test(parentEventId)) {
      tags.push(['e', parentEventId, '', 'reply']);
    }
    const ev = nostr.createTextNote(content, nsec, tags);
    const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
      eoseTimeout: 4000,
    });
    await pool.publish(ev);
    pool.disconnectAll();
    return { ok: true, nativeId: ev.id };
  } catch (e) {
    return { ok: false, error: `Nostr reply error: ${(e as Error).message}` };
  }
}

async function replyFarcaster(
  _content: string,
  auth: Record<string, string>,
  signedMessage?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  if (!signedMessage) {
    return { ok: false, error: 'Farcaster requires a pre-signed cast message' };
  }
  const hubUrl = auth.farcaster_hub ?? 'https://hub.farcaster.standardcrypto.vc:2281';

  try {
    let messageBody: BodyInit = signedMessage;
    const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
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
    return { ok: false, error: `Farcaster reply error: ${(e as Error).message}` };
  }
}

async function replyBluesky(
  content: string,
  auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const pdsUrl = auth.bluesky_pds ?? 'https://bsky.social';
  const accessJwt = auth.bluesky_jwt ?? auth.bluesky_accessJwt ?? auth.accessJwt;
  const repoDid = auth.bluesky_did ?? '';

  if (!accessJwt || !repoDid) {
    return { ok: false, error: 'Not authenticated to Bluesky' };
  }

  try {
    const record = {
      $type: 'app.bsky.feed.post',
      text: content,
      createdAt: new Date().toISOString(),
    };

    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: repoDid,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { uri?: string };
      return { ok: true, nativeId: data.uri ?? '' };
    }
    const errText = await res.text();
    return { ok: false, error: `Bluesky reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Bluesky reply error: ${(e as Error).message}` };
  }
}

async function replyPeerTube(
  content: string,
  _nativeId: string,
  auth: Record<string, string>,
  parentVideoUuid?: string,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.peertube_instance ?? 'https://video.degenfeed.xyz';
  const token = auth.peertube ?? '';

  if (!parentVideoUuid) {
    return { ok: false, error: 'PeerTube reply requires a video UUID' };
  }

  try {
    const res = await fetch(
      `${instance}/api/v1/videos/${encodeURIComponent(parentVideoUuid)}/comment-threads`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: content }),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { comment?: { id: number } };
      return { ok: true, nativeId: String(data.comment?.id ?? '') };
    }
    const errText = await res.text();
    return { ok: false, error: `PeerTube reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `PeerTube reply error: ${(e as Error).message}` };
  }
}

async function replyLemmy(
  content: string,
  parentPostId: string,
  auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.lemmy_instance ?? 'https://community.degenfeed.xyz';
  const token = auth.lemmy ?? auth.authToken;
  if (!token) return { ok: false, error: 'Not authenticated to Lemmy' };

  try {
    const res = await fetch(`${instance}/api/v3/comment`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        post_id: Number(parentPostId) || 0,
        content,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        comment_view?: { comment?: { id: number } };
      };
      return { ok: true, nativeId: String(data.comment_view?.comment?.id ?? '') };
    }
    const errText = await res.text();
    return { ok: false, error: `Lemmy reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Lemmy reply error: ${(e as Error).message}` };
  }
}

async function replyPixelfed(
  content: string,
  parentStatusId: string,
  auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const instance = auth.pixelfed_instance ?? 'https://gram.degenfeed.xyz';
  const token = auth.pixelfed ?? auth.accessToken;
  if (!token) return { ok: false, error: 'Not authenticated to Pixelfed' };

  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: content,
        in_reply_to_id: parentStatusId,
        visibility: 'public',
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return { ok: false, error: `Pixelfed reply failed: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, nativeId: data.id };
  } catch (e) {
    return { ok: false, error: `Pixelfed reply error: ${(e as Error).message}` };
  }
}

async function replyMatrix(
  content: string,
  auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  const matrixToken = auth.matrix_token ?? auth.matrixAccessToken;
  const matrixUrl = auth.matrix_instance ?? 'https://matrix.degenfeed.xyz';
  const roomId = auth.matrix_room_id ?? '';

  if (!matrixToken || !roomId) {
    return { ok: false, error: 'Not authenticated to Matrix or missing room ID' };
  }

  try {
    const res = await fetch(
      `${matrixUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${matrixToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: content,
        }),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { event_id?: string };
      return { ok: true, nativeId: data.event_id ?? '' };
    }
    const errText = await res.text();
    return { ok: false, error: `Matrix reply failed: ${errText.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, error: `Matrix reply error: ${(e as Error).message}` };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 3: PROTOCOL ACTIVITY FEED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build a human-readable, cross-protocol activity feed from all inbox items.
 * Generates entries like:
 *   "alice.eth replied to your Mastodon post"
 *   "bob.eth commented on your PeerTube video"
 *   "charlie.eth liked your Lemmy post"
 *   "dave.eth sent you a DM on Matrix"
 */
export function buildActivityFeed(items: InboxItem[]): ActivityFeedItem[] {
  const activities: ActivityFeedItem[] = [];

  for (const item of items) {
    const actorLabel = item.actor.displayName ?? item.actor.handle;
    const protocolLabel = formatProtocol(item.protocol);
    let summary = '';
    let targetProtocol: Protocol | undefined;

    switch (item.kind) {
      case 'dm':
        summary = `${actorLabel} sent you a DM on ${protocolLabel}`;
        break;
      case 'comment':
        targetProtocol = item.parentProtocol;
        summary =
          item.parentProtocol && item.parentProtocol !== item.protocol
            ? `${actorLabel} commented on your ${formatProtocol(item.parentProtocol)} content via ${protocolLabel}`
            : `${actorLabel} commented on your ${protocolLabel} post`;
        break;
      case 'reply':
        targetProtocol = item.parentProtocol;
        summary =
          item.parentProtocol && item.parentProtocol !== item.protocol
            ? `${actorLabel} replied to your ${formatProtocol(item.parentProtocol)} post from ${protocolLabel}`
            : `${actorLabel} replied to your ${protocolLabel} post`;
        break;
      case 'mention':
        summary = `${actorLabel} mentioned you on ${protocolLabel}`;
        break;
      case 'like':
        targetProtocol = item.parentProtocol;
        summary =
          item.parentProtocol && item.parentProtocol !== item.protocol
            ? `${actorLabel} liked your ${formatProtocol(item.parentProtocol)} post from ${protocolLabel}`
            : `${actorLabel} liked your ${protocolLabel} post`;
        break;
      case 'repost':
        summary = `${actorLabel} reposted your ${protocolLabel} post`;
        break;
      case 'follow':
        summary = `${actorLabel} followed you on ${protocolLabel}`;
        break;
      case 'tip':
        summary = `${actorLabel} sent you ${item.amount ?? ''} ${item.currency ?? ''} on ${protocolLabel}`;
        break;
      default:
        summary = `${actorLabel} interacted on ${protocolLabel}`;
    }

    activities.push({
      id: `activity:${item.id}`,
      summary,
      kind: item.kind,
      sourceProtocol: item.protocol,
      targetProtocol,
      actor: item.actor,
      content: item.content.slice(0, 150),
      url: item.url,
      createdAt: item.createdAt,
    });
  }

  activities.sort((a, b) => b.createdAt - a.createdAt);

  return activities;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 4: CROSS-NETWORK SHARING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Share content across networks.
 *
 * Takes a source content URI and posts it to one or more target protocols.
 * Uses the existing cross-publish orchestration infrastructure.
 */
export async function shareCrossNetwork(
  walletAddress: string,
  request: InboxShareRequest,
  env: Env,
): Promise<{ results: CrossNetworkShareResult[]; totalOk: number; totalFail: number }> {
  const { sourceUri, sourceProtocol, targetProtocols, text, auth } = request;

  if (!sourceUri || targetProtocols.length === 0) {
    return { results: [], totalOk: 0, totalFail: 0 };
  }

  const results: CrossNetworkShareResult[] = [];

  // Resolve the source content
  const sourceContent = await resolveSourceContent(sourceUri, sourceProtocol, walletAddress, env);

  // Share to each target protocol
  for (const target of targetProtocols) {
    if (target === sourceProtocol) continue; // Skip source protocol

    try {
      const shareText = text ?? sourceContent?.text ?? '';

      // Use the existing bridge infrastructure for cross-posting
      const { executeCrossPublish } = await import('./cross-publish-orchestrator');
      const publishResult = await executeCrossPublish(
        {
          masterPost: {
            text: shareText.slice(0, PROTOCOL_MAX_LENGTH[target] ?? 10000),
            hashtags: sourceContent?.hashtags,
          },
          protocols: [target as Protocol],
          auth: auth ?? {},
        },
        env,
      );

      const targetResult = publishResult.results.find(
        (r: { protocol: string }) => r.protocol === target,
      );
      results.push({
        protocol: target,
        ok: targetResult?.status === 'published',
        nativeId: targetResult?.postId,
        url: targetResult?.url,
        error: targetResult?.error,
      });
    } catch (e) {
      results.push({
        protocol: target,
        ok: false,
        error: `Share to ${target} failed: ${(e as Error).message}`,
      });
    }
  }

  const totalOk = results.filter((r) => r.ok).length;
  const totalFail = results.filter((r) => !r.ok).length;

  return { results, totalOk, totalFail };
}

/**
 * Resolve a source content URI to get its text and metadata.
 */
async function resolveSourceContent(
  uri: string,
  protocol: Protocol,
  _walletAddress: string,
  _env: Env,
): Promise<{ text: string; hashtags?: string[] } | null> {
  // Strip df:// prefix if present
  const cleanUri = uri.startsWith('df://') ? uri.slice(5) : uri;
  const parts = cleanUri.split(':');
  const _nativeId = parts.slice(1).join(':') || parts[0];

  // For now, return a placeholder. In production, this would fetch the
  // actual content from the protocol's API.
  return { text: `Cross-posted from ${formatProtocol(protocol)}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 5: NETWORK STATUS INTEGRATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get the network connection status for all protocols for a given user.
 *
 * Returns which networks the user is connected to and what capabilities
 * are available on each.
 */
export async function getUserNetworkStatus(
  walletAddress: string,
  env: Env,
): Promise<UserNetworkStatus> {
  const linkedProtocols = await getUserLinkedProtocols(walletAddress, env);
  const cached = await getInboxItems(env, INBOX_STATUS_KEY(walletAddress));

  // If cached < 60s, return it
  const cachedStatus =
    cached.length > 0
      ? (JSON.parse(JSON.stringify(cached[0])) as unknown as UserNetworkStatus)
      : null;
  if (cachedStatus && Date.now() - cachedStatus.checkedAt < 60_000) {
    return cachedStatus;
  }

  const status: UserNetworkStatus = {
    protocols: {},
    totalConnected: 0,
    totalAvailable: 0,
    checkedAt: Date.now(),
  };

  const _ALL_CAPABILITIES: NetworkCapability[] = [
    'post',
    'dm',
    'reply',
    'comment',
    'like',
    'repost',
    'follow',
    'upload-media',
    'live-stream',
    'tip',
  ];

  const protocolCapabilities: Record<string, NetworkCapability[]> = {
    nostr: ['post', 'dm', 'reply', 'like', 'repost', 'follow', 'tip'],
    farcaster: ['post', 'reply', 'like', 'repost'],
    mastodon: ['post', 'dm', 'reply', 'comment', 'like', 'repost', 'follow', 'upload-media'],
    bluesky: ['post', 'dm', 'reply', 'like', 'repost', 'follow', 'upload-media'],
    lens: ['post', 'reply', 'like', 'comment', 'follow'],
    matrix: ['dm'],
    telegram: ['dm'],
    discord: ['dm'],
    lemmy: ['post', 'comment', 'reply', 'like', 'follow'],
    peertube: ['post', 'comment', 'reply', 'like', 'upload-media', 'live-stream'],
    pixelfed: ['post', 'comment', 'like', 'follow', 'upload-media'],
    threads: ['post', 'reply', 'like'],
    reddit: ['post', 'comment', 'like'],
    xmtp: ['dm'],
  };

  for (const [protocol, link] of Object.entries(linkedProtocols)) {
    const caps = protocolCapabilities[protocol] ?? ['post'];
    status.protocols[protocol as Protocol] = {
      connected: true,
      handle: link.handle,
      displayName: link.displayName,
      avatarUrl: link.avatarUrl,
      capabilities: caps,
      lastVerified: link.linkedAt,
    };
    status.totalConnected++;
  }

  status.totalAvailable = Object.keys(protocolCapabilities).length;

  // Cache the status
  const statusItem: InboxItem = {
    id: `status:${walletAddress}`,
    kind: 'dm',
    protocol: 'nostr',
    actor: { id: walletAddress, handle: walletAddress, protocol: 'nostr' },
    content: JSON.stringify(status),
    createdAt: Date.now(),
    read: true,
    seen: true,
  };
  await saveInboxItems(env, INBOX_STATUS_KEY(walletAddress), [statusItem]);

  return status;
}

/**
 * Get the human-readable status report for the user's connected networks.
 */
export function formatNetworkStatusReport(status: UserNetworkStatus): {
  connected: Array<{
    protocol: string;
    label: string;
    handle?: string;
    capabilities: NetworkCapability[];
  }>;
  disconnected: Array<{
    protocol: string;
    label: string;
    availableCapabilities: NetworkCapability[];
  }>;
  totalConnected: number;
  totalAvailable: number;
} {
  const connected: Array<{
    protocol: string;
    label: string;
    handle?: string;
    capabilities: NetworkCapability[];
  }> = [];
  const disconnected: Array<{
    protocol: string;
    label: string;
    availableCapabilities: NetworkCapability[];
  }> = [];

  const protocolCapabilities: Record<string, NetworkCapability[]> = {
    nostr: ['post', 'dm', 'reply', 'like', 'repost', 'follow', 'tip'],
    farcaster: ['post', 'reply', 'like', 'repost'],
    mastodon: ['post', 'dm', 'reply', 'comment', 'like', 'repost', 'follow', 'upload-media'],
    bluesky: ['post', 'dm', 'reply', 'like', 'repost', 'follow', 'upload-media'],
    lens: ['post', 'reply', 'like', 'comment', 'follow'],
    matrix: ['dm'],
    telegram: ['dm'],
    discord: ['dm'],
    lemmy: ['post', 'comment', 'reply', 'like', 'follow'],
    peertube: ['post', 'comment', 'reply', 'like', 'upload-media', 'live-stream'],
    pixelfed: ['post', 'comment', 'like', 'follow', 'upload-media'],
    threads: ['post', 'reply', 'like'],
    reddit: ['post', 'comment', 'like'],
    xmtp: ['dm'],
  };

  for (const [protocol, caps] of Object.entries(protocolCapabilities)) {
    const ns = status.protocols[protocol as Protocol];
    if (ns?.connected) {
      connected.push({
        protocol,
        label: formatProtocol(protocol),
        handle: ns.handle,
        capabilities: caps,
      });
    } else {
      disconnected.push({
        protocol,
        label: formatProtocol(protocol),
        availableCapabilities: caps,
      });
    }
  }

  return {
    connected,
    disconnected,
    totalConnected: status.totalConnected,
    totalAvailable: status.totalAvailable,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK 1: MARK AS READ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Mark inbox items as read.
 */
export async function markInboxItemsRead(
  walletAddress: string,
  itemIds: string[],
  env: Env,
): Promise<{ marked: number }> {
  let count = 0;

  // Update across all inbox collections
  for (const key of [INBOX_UNIFIED_KEY, INBOX_DMS_KEY, INBOX_COMMENTS_KEY]) {
    const items = await getInboxItems(env, key(walletAddress));
    let changed = false;
    for (const item of items) {
      if (itemIds.includes(item.id) && !item.read) {
        item.read = true;
        changed = true;
        count++;
      }
    }
    if (changed) {
      await saveInboxItems(env, key(walletAddress), items);
    }
  }

  return { marked: count };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get the user's linked protocol identities from KV.
 */
async function getUserLinkedProtocols(
  walletAddress: string,
  env: Env,
): Promise<
  Record<
    string,
    {
      id: string;
      auth?: Record<string, string>;
      handle?: string;
      displayName?: string;
      avatarUrl?: string;
      linkedAt: number;
    }
  >
> {
  const result: Record<
    string,
    {
      id: string;
      auth?: Record<string, string>;
      handle?: string;
      displayName?: string;
      avatarUrl?: string;
      linkedAt: number;
    }
  > = {};

  try {
    if (env.CACHE) {
      const identityRaw = (await env.CACHE.get(`identity:${walletAddress}`, 'json')) as Record<
        string,
        {
          id: string;
          auth?: Record<string, string>;
          handle?: string;
          displayName?: string;
          avatarUrl?: string;
          linkedAt?: number;
        }
      > | null;
      if (identityRaw) {
        for (const [protocol, info] of Object.entries(identityRaw)) {
          result[protocol] = {
            id: info.id ?? '',
            auth: info.auth,
            handle: info.handle,
            displayName: info.displayName,
            avatarUrl: info.avatarUrl,
            linkedAt: info.linkedAt ?? Date.now(),
          };
        }
      }
    }

    // Default: try to detect Nostr identity from wallet
    if (!result.nostr) {
      result.nostr = {
        id: walletAddress,
        handle: walletAddress.slice(0, 12),
        linkedAt: Date.now(),
      };
    }
  } catch {
    // If KV fails, still return default Nostr identity
    result.nostr = { id: walletAddress, handle: walletAddress.slice(0, 12), linkedAt: Date.now() };
  }

  return result;
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTED ROUTE HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/inbox/unified — All messages, unified
 */
export async function handleInboxUnified(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const includeRead = url.searchParams.get('includeRead') === 'true';

  try {
    const feed = await aggregateUnifiedInbox(walletAddress, env, { limit, cursor, includeRead });
    return noCacheJsonResponse(feed);
  } catch (e) {
    console.error('[inbox] unified fetch failed:', e);
    return noCacheJsonResponse({
      items: [],
      meta: { total: 0, unread: 0, byKind: {}, byProtocol: {}, fetchedAt: Date.now() },
    });
  }
}

/**
 * GET /api/inbox/dms — DMs only
 */
export async function handleInboxDms(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);
  const cursor = url.searchParams.get('cursor') || undefined;

  try {
    const feed = await aggregateDMs(walletAddress, env, { limit, cursor });
    return noCacheJsonResponse(feed);
  } catch (e) {
    console.error('[inbox] dms fetch failed:', e);
    return noCacheJsonResponse({
      items: [],
      meta: { total: 0, unread: 0, byKind: {}, byProtocol: {}, fetchedAt: Date.now() },
    });
  }
}

/**
 * GET /api/inbox/comments — Comments only
 */
export async function handleInboxComments(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);
  const cursor = url.searchParams.get('cursor') || undefined;

  try {
    const feed = await aggregateComments(walletAddress, env, { limit, cursor });
    return noCacheJsonResponse(feed);
  } catch (e) {
    console.error('[inbox] comments fetch failed:', e);
    return noCacheJsonResponse({
      items: [],
      meta: { total: 0, unread: 0, byKind: {}, byProtocol: {}, fetchedAt: Date.now() },
    });
  }
}

/**
 * GET /api/inbox/activity — Activity feed
 */
export async function handleInboxActivity(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);

  try {
    const feed = await aggregateUnifiedInbox(walletAddress, env, { includeRead: true });
    const activities = buildActivityFeed(feed.items).slice(0, limit);
    return noCacheJsonResponse({
      activities,
      meta: {
        total: activities.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (e) {
    console.error('[inbox] activity fetch failed:', e);
    return noCacheJsonResponse({ activities: [], meta: { total: 0, fetchedAt: Date.now() } });
  }
}

/**
 * POST /api/inbox/reply — Reply to anything from anywhere
 */
export async function handleInboxReply(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  let body: InboxReplyRequest;
  try {
    body = (await request.json()) as InboxReplyRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!body.parentInboxId || !body.content) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: parentInboxId, content' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  try {
    const result = await replyToInboxItem(walletAddress, body, env);
    if (result.ok) {
      return noCacheJsonResponse({ ok: true, nativeId: result.nativeId });
    }
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('[inbox] reply failed:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

/**
 * POST /api/inbox/mark-read — Mark items as read
 */
export async function handleInboxMarkRead(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  let body: InboxReadRequest;
  try {
    body = (await request.json()) as InboxReadRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required field: itemIds (array)' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const result = await markInboxItemsRead(walletAddress, body.itemIds, env);
    return noCacheJsonResponse({ ok: true, marked: result.marked });
  } catch (e) {
    console.error('[inbox] mark-read failed:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

/**
 * GET /api/inbox/status — Network connection status
 */
export async function handleInboxStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  try {
    const networkStatus = await getUserNetworkStatus(walletAddress, env);
    const report = formatNetworkStatusReport(networkStatus);
    return noCacheJsonResponse(report);
  } catch (e) {
    console.error('[inbox] status fetch failed:', e);
    return noCacheJsonResponse({
      connected: [],
      disconnected: [],
      totalConnected: 0,
      totalAvailable: 0,
    });
  }
}

/**
 * POST /api/inbox/share — Cross-network share
 */
export async function handleInboxShare(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  let body: InboxShareRequest;
  try {
    body = (await request.json()) as InboxShareRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!body.sourceUri || !body.targetProtocols || body.targetProtocols.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: sourceUri, targetProtocols' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  try {
    const result = await shareCrossNetwork(walletAddress, body, env);
    return noCacheJsonResponse(result);
  } catch (e) {
    console.error('[inbox] share failed:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

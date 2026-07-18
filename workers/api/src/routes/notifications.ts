import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { broadcastToAll, broadcastToUser } from '../ws-broadcast';

interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'mirror' | 'collect' | 'tip';
  protocol: string;
  sourceProtocol?: string;
  actorName: string;
  actorHandle: string;
  actorAvatar?: string;
  postId?: string;
  postText?: string;
  createdAt: number;
  read: boolean;
  /** Tip-specific fields */
  amount?: string;
  currency?: string;
}

export type { Notification };

function detectProtocol(n: Notification): string {
  if (n.protocol && n.protocol !== 'tip') return n.protocol;
  if (n.type === 'tip')
    return n.currency === 'base' ? 'farcaster' : n.currency === 'solana' ? 'solana' : 'ethereum';
  return n.protocol || 'unknown';
}

/* ─── Notification preferences (type toggles per protocol) ──── */

interface NotificationTypePref {
  likes: boolean;
  reposts: boolean;
  replies: boolean;
  follows: boolean;
  mentions: boolean;
}

type NotificationProtocolPrefs = Partial<Record<string, boolean | NotificationTypePref>>;

const TYPE_TO_PREF_KEY: Record<string, 'likes' | 'reposts' | 'replies' | 'follows' | 'mentions'> = {
  like: 'likes',
  repost: 'reposts',
  mirror: 'reposts',
  reply: 'replies',
  follow: 'follows',
  mention: 'mentions',
};

function typeEnabled(n: Notification, prefs: NotificationProtocolPrefs): boolean {
  // Tips have their own boolean toggle
  if (n.type === 'tip') {
    const tipPref = prefs.tip;
    return tipPref === undefined || tipPref === true;
  }
  // Collects are not in the preferences UI — always show
  if (n.type === 'collect' || n.type === 'mirror') return true;
  // Look up protocol-level prefs (e.g. nostr, farcaster, lens, bluesky, mastodon)
  const protocolPref = prefs[n.protocol];
  if (protocolPref === undefined || protocolPref === true) return true; // default: enabled
  if (typeof protocolPref === 'boolean') return protocolPref;
  // Per-type toggle within the protocol
  const prefKey = TYPE_TO_PREF_KEY[n.type];
  if (!prefKey) return true;
  const typePref = (protocolPref as NotificationTypePref)[prefKey];
  return typePref === undefined || typePref;
}

async function loadNotifPrefs(env: Env, userId: string): Promise<NotificationProtocolPrefs | null> {
  if (!env.CACHE) return null;
  try {
    const key = `user:prefs:${userId.toLowerCase()}`;
    const raw = await env.CACHE.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { notifications?: NotificationProtocolPrefs };
    return parsed.notifications ?? null;
  } catch (err) {
    console.warn(
      '[notifications] loadNotifPrefs failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch KV-backed notifications (tips, app-internal follows, etc.)
 * stored under `notifications:{recipient}` by other handlers.
 */
async function fetchKvNotifications(env: Env, recipient: string): Promise<Notification[]> {
  if (!env.CACHE || !recipient) return [];
  try {
    const raw = await env.CACHE.get(`notifications:${recipient}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(
      '[notifications] fetchKvNotifications failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

interface NotificationAuth {
  nostr_pubkey?: string;
  mastodon?: string;
  mastodon_instance?: string;
  bluesky?: {
    handle?: string;
    did?: string;
    accessJwt?: string;
  };
  farcaster?: {
    fid?: number;
    signerKey?: string;
  };
  lens?: string;
  lens_profileId?: string;
}

interface MastodonAccount {
  id: string;
  display_name?: string;
  username?: string;
  acct?: string;
  avatar?: string;
}

interface MastodonStatus {
  id: string;
  content?: string;
}

interface MastodonNotification {
  id: string;
  type: string;
  created_at: string;
  account?: MastodonAccount;
  status?: MastodonStatus;
}

interface BlueskyNotification {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  reason: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | string;
  reasonSubject?: string;
  record?: { text?: string };
  isRead: boolean;
  indexedAt: string;
}

interface LensNotificationItem {
  id: string;
  notificationId?: string;
  createdAt: string;
  reactions?: Array<{
    profile: {
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
    };
  }>;
  mirrors?: Array<{
    profile: {
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
    };
  }>;
  comments?: Array<{
    id: string;
    profile: {
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
    };
    metadata?: { content?: string };
  }>;
  quotes?: Array<{
    id: string;
    profile: {
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
    };
    metadata?: { content?: string };
  }>;
  collects?: Array<{
    profile: {
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
    };
  }>;
  follows?: Array<{
    profile: {
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
    };
  }>;
  publication?: { id: string; metadata?: { content?: string } };
}

async function npubToHex(npubOrHex: string): Promise<string> {
  if (!npubOrHex) return '';
  if (npubOrHex.startsWith('npub1') && npubOrHex.length === 62) {
    try {
      const mod = await import('@degenfeed/nostr-sdk');
      const hex = mod.npubDecode(npubOrHex);
      if (hex && typeof hex === 'string') return hex;
    } catch (err) {
      console.warn('[notifications] npub decode failed:', err instanceof Error ? err.message : err);
    }
  }
  return npubOrHex;
}

async function fetchNostrNotifications(pubkey: string): Promise<Notification[]> {
  const results: Notification[] = [];
  const hexPubkey = await npubToHex(pubkey);
  if (!hexPubkey) return results;
  try {
    const mod = await import('@degenfeed/nostr-sdk');
    const pool = new mod.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
      eoseTimeout: 3000,
    });
    const reactions = await pool.list({ kinds: [7], limit: 20 }, 3000);
    for (const ev of reactions) {
      if (!ev.tags.some((t: string[]) => t[0] === 'p' && t[1] === hexPubkey)) continue;
      results.push({
        id: `nostr:reaction:${ev.id}`,
        type: 'like',
        protocol: 'nostr',
        actorName: ev.pubkey.slice(0, 12),
        actorHandle: ev.pubkey.slice(0, 12),
        postId: ev.tags.find((t: string[]) => t[0] === 'e')?.[1],
        createdAt: ev.created_at * 1000,
        read: false,
      });
    }
    const mentions = await pool.list({ kinds: [1], limit: 20 }, 3000);
    for (const ev of mentions) {
      if (
        ev.pubkey === hexPubkey ||
        !ev.tags.some((t: string[]) => t[0] === 'p' && t[1] === hexPubkey)
      )
        continue;
      results.push({
        id: `nostr:mention:${ev.id}`,
        type: 'mention',
        protocol: 'nostr',
        actorName: ev.pubkey.slice(0, 12),
        actorHandle: ev.pubkey.slice(0, 12),
        postText: ev.content.slice(0, 100),
        postId: ev.id,
        createdAt: ev.created_at * 1000,
        read: false,
      });
    }
    pool.disconnectAll();
  } catch (err) {
    console.error(
      '[notifications] fetchNostrNotifications failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return results;
}

async function fetchMastodonNotifications(
  instance: string,
  token: string,
): Promise<Notification[]> {
  const results: Notification[] = [];
  try {
    const res = await fetch(`${instance}/api/v1/notifications?limit=30`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return results;
    const data = (await res.json()) as MastodonNotification[];
    for (const n of data) {
      const typeMap: Record<string, 'like' | 'repost' | 'reply' | 'follow' | 'mention'> = {
        favourite: 'like',
        reblog: 'repost',
        mention: 'mention',
        follow: 'follow',
      };
      results.push({
        id: `mastodon:${n.id}`,
        type: typeMap[n.type] || 'mention',
        protocol: 'mastodon',
        actorName: n.account?.display_name || n.account?.username || '',
        actorHandle: n.account?.acct || '',
        actorAvatar: n.account?.avatar,
        postId: n.status?.id,
        postText: n.status?.content?.replace(/<[^>]*>/g, '').slice(0, 100),
        createdAt: new Date(n.created_at).getTime(),
        read: false,
      });
    }
  } catch (err) {
    console.error(
      '[notifications] fetchMastodonNotifications failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return results;
}

async function fetchBlueskyNotifications(
  pdsUrl: string,
  accessJwt: string,
): Promise<Notification[]> {
  const results: Notification[] = [];
  try {
    const res = await fetch(`${pdsUrl}/xrpc/app.bsky.notification.listNotifications?limit=30`, {
      headers: {
        authorization: `Bearer ${accessJwt}`,
        accept: 'application/json',
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
    });
    if (!res.ok) return results;
    const data = (await res.json()) as { notifications?: BlueskyNotification[] };
    for (const n of data.notifications ?? []) {
      const typeMap: Record<string, 'like' | 'repost' | 'reply' | 'follow' | 'mention'> = {
        like: 'like',
        repost: 'repost',
        reply: 'reply',
        follow: 'follow',
        mention: 'mention',
      };
      results.push({
        id: `bluesky:${n.uri}`,
        type: typeMap[n.reason] || 'mention',
        protocol: 'bluesky',
        actorName: n.author.displayName || n.author.handle,
        actorHandle: n.author.handle,
        actorAvatar: n.author.avatar,
        postId: n.reasonSubject || n.uri,
        postText: n.record?.text?.slice(0, 100),
        createdAt: new Date(n.indexedAt).getTime(),
        read: n.isRead,
      });
    }
  } catch (err) {
    console.error(
      '[notifications] fetchBlueskyNotifications failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return results;
}

async function fetchFarcasterNotifications(env: Env, fid: number): Promise<Notification[]> {
  const results: Notification[] = [];
  const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.pinata.cloud';
  try {
    // Fetch reactions targeting the user's casts
    const reactionsRes = await fetch(
      `${hubUrl}/v1/reactionsByFid?fid=${fid}&reaction_type=1&pageSize=20`,
      { headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' } },
    );
    if (reactionsRes.ok) {
      const data = (await reactionsRes.json()) as {
        messages?: Array<{
          data: {
            timestamp: number;
            reactionBody?: { targetCastId?: { fid: number; hash: string }; type: string };
          };
          hash: string;
        }>;
      };
      for (const m of data.messages ?? []) {
        results.push({
          id: `farcaster:reaction:${m.hash}`,
          type: 'like',
          protocol: 'farcaster',
          actorName: `FID ${fid}`,
          actorHandle: `fid:${fid}`,
          postId: m.data.reactionBody?.targetCastId?.hash,
          createdAt: (m.data.timestamp + 1609459200) * 1000,
          read: false,
        });
      }
    }
  } catch (err) {
    console.error(
      '[notifications] fetchFarcasterNotifications failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return results;
}

interface LensProfileRef {
  profile?: {
    id?: string;
    handle?: { localName?: string };
    metadata?: {
      displayName?: string;
      picture?: { optimized?: { uri?: string } };
    };
  };
}

function processLensProfile(p: LensProfileRef | undefined) {
  return {
    name: p?.profile?.metadata?.displayName || p?.profile?.handle?.localName || '',
    handle: p?.profile?.handle?.localName || '',
    avatar: p?.profile?.metadata?.picture?.optimized?.uri,
  };
}

async function fetchLensNotifications(
  accessToken: string,
  profileId: string,
): Promise<Notification[]> {
  const results: Notification[] = [];
  try {
    const res = await fetch('https://api-v2.lens.dev/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        query: `query Notifications($request: NotificationRequest!) {
          notifications(request: $request) {
            items {
              ... on ReactionNotification { id createdAt reactions { profile { id handle { localName } metadata { displayName picture { optimized { uri } } } } } publication { id metadata { content } } }
              ... on MirrorNotification { id createdAt mirrors { profile { id handle { localName } metadata { displayName picture { optimized { uri } } } } } publication { id metadata { content } } }
              ... on CommentNotification { id createdAt comment { id profile { id handle { localName } metadata { displayName picture { optimized { uri } } } } metadata { content } } publication { id metadata { content } } }
              ... on QuoteNotification { id createdAt quote { id profile { id handle { localName } metadata { displayName picture { optimized { uri } } } } metadata { content } } publication { id metadata { content } } }
              ... on FollowNotification { id createdAt followers { profile { id handle { localName } metadata { displayName picture { optimized { uri } } } } } }
              ... on CollectNotification { id createdAt collectors { profile { id handle { localName } metadata { displayName picture { optimized { uri } } } } } publication { id metadata { content } } }
            }
          }
        }`,
        variables: { request: { for: profileId, limit: '30' } },
      }),
    });
    if (!res.ok) return results;
    const data = (await res.json()) as {
      data?: { notifications?: { items?: LensNotificationItem[] } };
    };
    for (const item of data?.data?.notifications?.items ?? []) {
      if (item.reactions && item.reactions.length > 0) {
        const actor = processLensProfile(item.reactions?.[0]);
        results.push({
          id: `lens:${item.id}`,
          type: 'like',
          protocol: 'lens',
          actorName: actor.name,
          actorHandle: actor.handle,
          actorAvatar: actor.avatar,
          postId: item.publication?.id,
          postText: item.publication?.metadata?.content?.slice(0, 100),
          createdAt: new Date(item.createdAt).getTime(),
          read: false,
        });
      }
      if (item.mirrors && item.mirrors.length > 0) {
        const actor = processLensProfile(item.mirrors[0]);
        results.push({
          id: `lens:mirror:${item.id}`,
          type: 'mirror',
          protocol: 'lens',
          actorName: actor.name,
          actorHandle: actor.handle,
          actorAvatar: actor.avatar,
          postId: item.publication?.id,
          postText: item.publication?.metadata?.content?.slice(0, 100),
          createdAt: new Date(item.createdAt).getTime(),
          read: false,
        });
      }
      if (item.comments && item.comments.length > 0) {
        const c = item.comments[0]!;
        results.push({
          id: `lens:comment:${c.id}`,
          type: 'reply',
          protocol: 'lens',
          actorName: c.profile?.metadata?.displayName || c.profile?.handle?.localName || '',
          actorHandle: c.profile?.handle?.localName || '',
          actorAvatar: c.profile?.metadata?.picture?.optimized?.uri,
          postId: c.id,
          postText: c.metadata?.content?.slice(0, 100),
          createdAt: new Date(item.createdAt).getTime(),
          read: false,
        });
      }
      if (item.collects && item.collects.length > 0) {
        const actor = processLensProfile(item.collects?.[0]);
        results.push({
          id: `lens:collect:${item.id}`,
          type: 'collect',
          protocol: 'lens',
          actorName: actor.name,
          actorHandle: actor.handle,
          actorAvatar: actor.avatar,
          postId: item.publication?.id,
          createdAt: new Date(item.createdAt).getTime(),
          read: false,
        });
      }
      if (item.follows && item.follows.length > 0) {
        const actor = processLensProfile(item.follows?.[0]);
        results.push({
          id: `lens:follow:${item.id}`,
          type: 'follow',
          protocol: 'lens',
          actorName: actor.name,
          actorHandle: actor.handle,
          actorAvatar: actor.avatar,
          createdAt: new Date(item.createdAt).getTime(),
          read: false,
        });
      }
    }
  } catch (err) {
    console.error(
      '[notifications] fetchLensNotifications failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return results;
}

async function loadReadState(env: Env, userId: string): Promise<Set<string>> {
  if (!env.CACHE) return new Set();
  try {
    const raw = await env.CACHE.get(`notif:read:${userId}`);
    if (!raw) return new Set();
    return new Set<string>(JSON.parse(raw) as string[]);
  } catch (err) {
    console.warn('[notifications] loadReadState failed:', err instanceof Error ? err.message : err);
    return new Set();
  }
}

async function saveReadState(env: Env, userId: string, readIds: Set<string>): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`notif:read:${userId}`, JSON.stringify([...readIds]), {
      expirationTtl: 30 * 86400,
    });
  } catch (err) {
    console.warn('[notifications] saveReadState failed:', err instanceof Error ? err.message : err);
  }
}

async function parseAuth(request: Request): Promise<NotificationAuth> {
  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { auth?: NotificationAuth };
      return body.auth ?? {};
    } catch (err) {
      console.warn(
        '[notifications] parseAuth JSON parse failed:',
        err instanceof Error ? err.message : err,
      );
    }
  }
  return {};
}

export async function handleNotifications(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address || 'anon';
  const auth = await parseAuth(request);
  const all: Notification[] = [];

  const fetchers: Promise<void>[] = [];

  if (auth.nostr_pubkey) {
    fetchers.push(
      (async () => {
        try {
          all.push(...(await fetchNostrNotifications(auth.nostr_pubkey!)));
        } catch (err) {
          console.error(
            '[notifications] nostr fetcher failed:',
            err instanceof Error ? err.message : err,
          );
        }
      })(),
    );
  }
  if (auth.mastodon) {
    fetchers.push(
      (async () => {
        try {
          all.push(
            ...(await fetchMastodonNotifications(
              auth.mastodon_instance || 'https://social.degenfeed.xyz',
              auth.mastodon!,
            )),
          );
        } catch (err) {
          console.error(
            '[notifications] mastodon fetcher failed:',
            err instanceof Error ? err.message : err,
          );
        }
      })(),
    );
  }
  if (auth.bluesky?.accessJwt) {
    fetchers.push(
      (async () => {
        try {
          all.push(
            ...(await fetchBlueskyNotifications('https://bsky.social', auth.bluesky?.accessJwt!)),
          );
        } catch (err) {
          console.error(
            '[notifications] bluesky fetcher failed:',
            err instanceof Error ? err.message : err,
          );
        }
      })(),
    );
  }
  if (auth.farcaster?.fid) {
    fetchers.push(
      (async () => {
        try {
          all.push(...(await fetchFarcasterNotifications(env, auth.farcaster!.fid)));
        } catch (err) {
          console.error(
            '[notifications] farcaster fetcher failed:',
            err instanceof Error ? err.message : err,
          );
        }
      })(),
    );
  }
  if (auth.lens && auth.lens_profileId) {
    fetchers.push(
      (async () => {
        try {
          all.push(...(await fetchLensNotifications(auth.lens!, auth.lens_profileId!)));
        } catch (err) {
          console.error(
            '[notifications] lens fetcher failed:',
            err instanceof Error ? err.message : err,
          );
        }
      })(),
    );
  }

  await Promise.allSettled(fetchers);

  // Fetch KV-backed notifications (tips, app-internal follows, etc.)
  const kvNotifs = await fetchKvNotifications(env, userId);
  all.push(...kvNotifs);

  // Deduplicate by notification ID (keep first occurrence = protocol-native)
  const seen = new Set<string>();
  const deduped: Notification[] = [];
  for (const n of all) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    deduped.push(n);
  }

  // Merge read state from KV
  const readIds = await loadReadState(env, userId);
  for (const n of deduped) {
    if (readIds.has(n.id)) n.read = true;
  }

  // Apply notification preference filters (per-protocol type toggles)
  const userPrefs = await loadNotifPrefs(env, userId);
  const prefsFiltered = userPrefs ? deduped.filter((n) => typeEnabled(n, userPrefs)) : deduped;

  // Add sourceProtocol to every notification for unified inbox display
  const unified = prefsFiltered.map((n) => ({
    ...n,
    sourceProtocol: n.sourceProtocol || detectProtocol(n),
  }));

  unified.sort((a, b) => b.createdAt - a.createdAt);

  // Auto-save read state for seen notifications
  void (async () => {
    const ids = new Set(unified.slice(0, 50).map((n) => n.id));
    await saveReadState(env, userId, ids);
  })();

  if (unified.length > 0) {
    broadcastToAll('notifications:new', {
      count: unified.length,
      latestId: unified[0]?.id,
      latestType: unified[0]?.type,
      timestamp: Date.now(),
    });
  }

  return noCacheJsonResponse({
    notifications: unified.slice(0, 100),
    meta: { total: unified.length },
  });
}

/**
 * POST /api/notifications/mark-all-read
 * Marks all notifications as read for the authenticated user.
 */
export async function handleMarkAllRead(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address || 'anon';
  if (!env.CACHE) {
    return jsonResponse({ error: 'KV not available' }, 503);
  }

  try {
    // Store a "marked all read at" timestamp so the frontend can hide everything before it
    const markKey = `notif:markAllRead:${userId}`;
    await env.CACHE.put(markKey, JSON.stringify({ markedAt: Date.now() }), {
      expirationTtl: 365 * 86400,
    });

    // Also clear the individual read IDs to save space
    await env.CACHE.delete(`notif:read:${userId}`);

    // Broadcast the mark-all-read event so connected clients update badges
    broadcastToUser(userId, 'notifications:markAllRead', { markedAt: Date.now() });
    broadcastToAll('notifications:read', {
      userId,
      timestamp: Date.now(),
    });

    return jsonResponse({ success: true, markedAt: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to mark all read: ${msg}` }, 500);
  }
}

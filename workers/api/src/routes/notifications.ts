import { type Env, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'mirror' | 'collect';
  protocol: string;
  actorName: string;
  actorHandle: string;
  actorAvatar?: string;
  postId?: string;
  postText?: string;
  createdAt: number;
  read: boolean;
}

export type { Notification };

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
  reactions?: Array<{ profile: { id: string; handle?: { localName: string }; metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } } } }>;
  mirrors?: Array<{ profile: { id: string; handle?: { localName: string }; metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } } } }>;
  comments?: Array<{ id: string; profile: { id: string; handle?: { localName: string }; metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } } }; metadata?: { content?: string } }>;
  quotes?: Array<{ id: string; profile: { id: string; handle?: { localName: string }; metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } } }; metadata?: { content?: string } }>;
  collects?: Array<{ profile: { id: string; handle?: { localName: string }; metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } } } }>;
  follows?: Array<{ profile: { id: string; handle?: { localName: string }; metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } } } }>;
  publication?: { id: string; metadata?: { content?: string } };
}

async function npubToHex(npubOrHex: string): Promise<string> {
  if (!npubOrHex) return '';
  if (npubOrHex.startsWith('npub1') && npubOrHex.length === 62) {
    try {
      const mod = await import('@degenfeed/nostr-sdk');
      const hex = mod.npubDecode(npubOrHex);
      if (hex && typeof hex === 'string') return hex;
    } catch { /* fall through */ }
  }
  return npubOrHex;
}

async function fetchNostrNotifications(pubkey: string): Promise<Notification[]> {
  const results: Notification[] = [];
  const hexPubkey = await npubToHex(pubkey);
  if (!hexPubkey) return results;
  try {
    const mod = await import('@degenfeed/nostr-sdk');
    const pool = new mod.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 3000 });
    const reactions = await pool.list({ kinds: [7], limit: 20 }, 3000);
    for (const ev of reactions) {
      if (!ev.tags.some((t: string[]) => t[0] === 'p' && t[1] === hexPubkey)) continue;
      results.push({
        id: `nostr:reaction:${ev.id}`, type: 'like', protocol: 'nostr',
        actorName: ev.pubkey.slice(0, 12), actorHandle: ev.pubkey.slice(0, 12),
        postId: ev.tags.find((t: string[]) => t[0] === 'e')?.[1],
        createdAt: ev.created_at * 1000, read: false,
      });
    }
    const mentions = await pool.list({ kinds: [1], limit: 20 }, 3000);
    for (const ev of mentions) {
      if (ev.pubkey === hexPubkey || !ev.tags.some((t: string[]) => t[0] === 'p' && t[1] === hexPubkey)) continue;
      results.push({
        id: `nostr:mention:${ev.id}`, type: 'mention', protocol: 'nostr',
        actorName: ev.pubkey.slice(0, 12), actorHandle: ev.pubkey.slice(0, 12),
        postText: ev.content.slice(0, 100), postId: ev.id,
        createdAt: ev.created_at * 1000, read: false,
      });
    }
    pool.disconnectAll();
  } catch {}
  return results;
}

async function fetchMastodonNotifications(instance: string, token: string): Promise<Notification[]> {
  const results: Notification[] = [];
  try {
    const res = await fetch(`${instance}/api/v1/notifications?limit=30`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return results;
    const data = (await res.json()) as MastodonNotification[];
    for (const n of data) {
      const typeMap: Record<string, 'like' | 'repost' | 'reply' | 'follow' | 'mention'> = {
        favourite: 'like', reblog: 'repost', mention: 'mention', follow: 'follow',
      };
      results.push({
        id: `mastodon:${n.id}`, type: typeMap[n.type] || 'mention', protocol: 'mastodon',
        actorName: n.account?.display_name || n.account?.username || '',
        actorHandle: n.account?.acct || '', actorAvatar: n.account?.avatar,
        postId: n.status?.id,
        postText: n.status?.content?.replace(/<[^>]*>/g, '').slice(0, 100),
        createdAt: new Date(n.created_at).getTime(), read: false,
      });
    }
  } catch {}
  return results;
}

async function fetchBlueskyNotifications(pdsUrl: string, accessJwt: string): Promise<Notification[]> {
  const results: Notification[] = [];
  try {
    const res = await fetch(`${pdsUrl}/xrpc/app.bsky.notification.listNotifications?limit=30`, {
      headers: { authorization: `Bearer ${accessJwt}`, accept: 'application/json', 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
    });
    if (!res.ok) return results;
    const data = (await res.json()) as { notifications?: BlueskyNotification[] };
    for (const n of data.notifications ?? []) {
      const typeMap: Record<string, 'like' | 'repost' | 'reply' | 'follow' | 'mention'> = {
        like: 'like', repost: 'repost', reply: 'reply', follow: 'follow', mention: 'mention',
      };
      results.push({
        id: `bluesky:${n.uri}`, type: typeMap[n.reason] || 'mention', protocol: 'bluesky',
        actorName: n.author.displayName || n.author.handle, actorHandle: n.author.handle,
        actorAvatar: n.author.avatar, postId: n.reasonSubject || n.uri,
        postText: n.record?.text?.slice(0, 100),
        createdAt: new Date(n.indexedAt).getTime(), read: n.isRead,
      });
    }
  } catch {}
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
      const data = await reactionsRes.json() as { messages?: Array<{ data: { timestamp: number; reactionBody?: { targetCastId?: { fid: number; hash: string }; type: string } }; hash: string }> };
      for (const m of data.messages ?? []) {
        results.push({
          id: `farcaster:reaction:${m.hash}`,
          type: 'like', protocol: 'farcaster',
          actorName: `FID ${fid}`,
          actorHandle: `fid:${fid}`,
          postId: m.data.reactionBody?.targetCastId?.hash,
          createdAt: (m.data.timestamp + 1609459200) * 1000,
          read: false,
        });
      }
    }
  } catch {}
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

async function fetchLensNotifications(accessToken: string, profileId: string): Promise<Notification[]> {
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
    const data = await res.json() as { data?: { notifications?: { items?: LensNotificationItem[] } } };
    for (const item of data?.data?.notifications?.items ?? []) {
      if (item.reactions && item.reactions.length > 0) {
        const actor = processLensProfile(item.reactions?.[0]);
        results.push({
          id: `lens:${item.id}`, type: 'like', protocol: 'lens',
          actorName: actor.name, actorHandle: actor.handle, actorAvatar: actor.avatar,
          postId: item.publication?.id,
          postText: item.publication?.metadata?.content?.slice(0, 100),
          createdAt: new Date(item.createdAt).getTime(), read: false,
        });
      }
      if (item.mirrors && item.mirrors.length > 0) {
        const actor = processLensProfile(item.mirrors[0]);
        results.push({
          id: `lens:mirror:${item.id}`, type: 'mirror', protocol: 'lens',
          actorName: actor.name, actorHandle: actor.handle, actorAvatar: actor.avatar,
          postId: item.publication?.id,
          postText: item.publication?.metadata?.content?.slice(0, 100),
          createdAt: new Date(item.createdAt).getTime(), read: false,
        });
      }
      if (item.comments && item.comments.length > 0) {
        const c = item.comments[0]!;
        results.push({
          id: `lens:comment:${c.id}`, type: 'reply', protocol: 'lens',
          actorName: c.profile?.metadata?.displayName || c.profile?.handle?.localName || '',
          actorHandle: c.profile?.handle?.localName || '',
          actorAvatar: c.profile?.metadata?.picture?.optimized?.uri,
          postId: c.id, postText: c.metadata?.content?.slice(0, 100),
          createdAt: new Date(item.createdAt).getTime(), read: false,
        });
      }
      if (item.collects && item.collects.length > 0) {
        const actor = processLensProfile(item.collects?.[0]);
        results.push({
          id: `lens:collect:${item.id}`, type: 'collect', protocol: 'lens',
          actorName: actor.name, actorHandle: actor.handle, actorAvatar: actor.avatar,
          postId: item.publication?.id,
          createdAt: new Date(item.createdAt).getTime(), read: false,
        });
      }
      if (item.follows && item.follows.length > 0) {
        const actor = processLensProfile(item.follows?.[0]);
        results.push({
          id: `lens:follow:${item.id}`, type: 'follow', protocol: 'lens',
          actorName: actor.name, actorHandle: actor.handle, actorAvatar: actor.avatar,
          createdAt: new Date(item.createdAt).getTime(), read: false,
        });
      }
    }
  } catch {}
  return results;
}

async function loadReadState(env: Env, userId: string): Promise<Set<string>> {
  if (!env.CACHE) return new Set();
  try {
    const raw = await env.CACHE.get(`notif:read:${userId}`);
    if (!raw) return new Set();
    return new Set<string>(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

async function saveReadState(env: Env, userId: string, readIds: Set<string>): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`notif:read:${userId}`, JSON.stringify([...readIds]), { expirationTtl: 30 * 86400 });
  } catch {}
}

async function parseAuth(request: Request): Promise<NotificationAuth> {
  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { auth?: NotificationAuth };
      return body.auth ?? {};
    } catch {}
  }
  try {
    const url = new URL(request.url);
    return JSON.parse(decodeURIComponent(url.searchParams.get('auth') || '{}')) as NotificationAuth;
  } catch {}
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
    fetchers.push((async () => { try { all.push(...(await fetchNostrNotifications(auth.nostr_pubkey!))); } catch {} })());
  }
  if (auth.mastodon) {
    fetchers.push((async () => {
      try { all.push(...(await fetchMastodonNotifications(auth.mastodon_instance || 'https://social.degenfeed.xyz', auth.mastodon!))); } catch {}
    })());
  }
  if (auth.bluesky?.accessJwt) {
    fetchers.push((async () => {
      try { all.push(...(await fetchBlueskyNotifications('https://bsky.social', auth.bluesky!.accessJwt!))); } catch {}
    })());
  }
  if (auth.farcaster?.fid) {
    fetchers.push((async () => {
      try { all.push(...(await fetchFarcasterNotifications(env, auth.farcaster!.fid!))); } catch {}
    })());
  }
  if (auth.lens && auth.lens_profileId) {
    fetchers.push((async () => {
      try { all.push(...(await fetchLensNotifications(auth.lens!, auth.lens_profileId!))); } catch {}
    })());
  }

  await Promise.allSettled(fetchers);

  // Merge read state from KV
  const readIds = await loadReadState(env, userId);
  for (const n of all) {
    if (readIds.has(n.id)) n.read = true;
  }

  all.sort((a, b) => b.createdAt - a.createdAt);

  // Auto-save read state for seen notifications
  void (async () => {
    const ids = new Set(all.slice(0, 50).map((n) => n.id));
    await saveReadState(env, userId, ids);
  })();

  return noCacheJsonResponse({ notifications: all.slice(0, 50), meta: { total: all.length } });
}

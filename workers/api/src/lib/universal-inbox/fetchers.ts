/**
 * @degenfeed/api-worker — Universal Inbox Protocol Fetchers
 *
 * All protocol-specific data fetchers for the unified inbox.
 * Each function fetches messages, comments, replies, and notifications
 * from a specific decentralized/centralized protocol.
 */

import type { Env } from '../../index';
import type { InboxItem, InboxItemKind } from './types';
import { stripHtml } from './utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOSTR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NOSTR_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

function nostrFetch(items: InboxItem[], relayUrl: string, subId: string, filters: Record<string, unknown>): Promise<InboxItem[]> {
  return new Promise((resolve) => {
    const ws = new WebSocket(relayUrl);
    const localItems: InboxItem[] = [];
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; ws.close(); resolve(localItems); }
    }, 5000);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(['REQ', subId, filters]));
    });

    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg[0] === 'EVENT') {
          const ev = msg[2] as { id: string; pubkey: string; kind: number; created_at: number; content: string; tags: string[][] };
          const item: InboxItem = {
            id: `nostr:${ev.kind}:${ev.id}`,
            kind: 'dm',
            protocol: 'nostr',
            actor: { id: ev.pubkey, handle: ev.pubkey.slice(0, 12), displayName: ev.pubkey.slice(0, 12), protocol: 'nostr' },
            content: ev.content,
            createdAt: ev.created_at * 1000,
            read: false, seen: false,
            nativeId: ev.id,
          };
          localItems.push(item);
        } else if (msg[0] === 'EOSE') {
          clearTimeout(timer);
          if (!resolved) { resolved = true; ws.close(); resolve(localItems); }
        }
      } catch { /*skip*/ }
    });
    ws.addEventListener('error', () => { clearTimeout(timer); if (!resolved) { resolved = true; resolve(localItems); } });
    ws.addEventListener('close', () => { clearTimeout(timer); if (!resolved) { resolved = true; resolve(localItems); } });
  });
}

export async function fetchNostrDMs(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {
  if (!pubkey) return [];
  const allItems: InboxItem[] = [];

  for (const relayUrl of NOSTR_RELAYS) {
    try {
      const result = await nostrFetch([], relayUrl, `df-inbox-dm-${Date.now()}`, {
        kinds: [4, 14, 1059], '#p': [pubkey], limit: 50,
      });
      allItems.push(...result.map((i) => ({ ...i, kind: 'dm' as InboxItemKind, conversationId: pubkey, participants: [pubkey, i.actor.id], recipientId: pubkey })));
    } catch { /* relay down */ }
  }
  return allItems;
}

export async function fetchNostrReplies(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {
  if (!pubkey) return [];
  const allItems: InboxItem[] = [];

  for (const relayUrl of NOSTR_RELAYS) {
    try {
      const result = await nostrFetch([], relayUrl, `df-inbox-reply-${Date.now()}`, {
        kinds: [1], '#p': [pubkey], limit: 50,
      });
      allItems.push(...result.map((i) => ({ ...i, kind: 'reply' as InboxItemKind, parentId: i.id })));
    } catch { /* relay down */ }
  }
  return allItems;
}

export async function fetchNostrNotifications(pubkey: string, _auth?: Record<string, string>): Promise<InboxItem[]> {
  if (!pubkey) return [];
  const allItems: InboxItem[] = [];

  for (const relayUrl of NOSTR_RELAYS) {
    try {
      const result = await nostrFetch([], relayUrl, `df-inbox-notif-${Date.now()}`, {
        kinds: [7, 9735, 6], '#p': [pubkey], limit: 50,
      });
      allItems.push(...result);
    } catch { /* relay down */ }
  }
  return allItems;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATRIX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchMatrixDMs(
  userId: string, auth?: Record<string, string>, env?: Env,
): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const matrixToken = auth?.matrix_token ?? auth?.matrixAccessToken ?? env?.MATRIX_ACCESS_TOKEN;
  const matrixUrl = auth?.matrix_instance ?? auth?.matrixInstanceUrl ?? env?.MATRIX_INSTANCE_URL ?? 'https://matrix.degenfeed.xyz';
  const matrixUserId = auth?.matrix_user_id ?? userId;
  if (!matrixToken) return items;

  try {
    const roomsRes = await fetch(`${matrixUrl}/_matrix/client/v3/joined_rooms`, {
      headers: { authorization: `Bearer ${matrixToken}` }, signal: AbortSignal.timeout(8000),
    });
    if (!roomsRes.ok) return items;
    const roomsData = (await roomsRes.json()) as { joined_rooms?: string[] };
    const batch = (roomsData.joined_rooms ?? []).slice(0, 10);

    const roomPromises = batch.map(async (roomId: string) => {
      try {
        const msgsRes = await fetch(`${matrixUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, {
          headers: { authorization: `Bearer ${matrixToken}` }, signal: AbortSignal.timeout(8000),
        });
        if (!msgsRes.ok) return [];
        const msgsData = (await msgsRes.json()) as {
          chunk?: Array<{ event_id: string; type: string; sender: string; origin_server_ts: number; content?: { body?: string; msgtype?: string } }>;
        };
        return (msgsData.chunk ?? [])
          .filter((evt) => evt.type === 'm.room.message' && evt.content?.body && evt.sender !== matrixUserId)
          .map((evt) => ({
            id: `matrix:dm:${evt.event_id}`,
            kind: 'dm' as InboxItemKind,
            protocol: 'matrix' as const,
            actor: { id: evt.sender, handle: evt.sender, protocol: 'matrix' as const },
            content: evt.content!.body!,
            createdAt: evt.origin_server_ts,
            read: false, seen: false,
            conversationId: roomId,
            participants: [matrixUserId, evt.sender],
            recipientId: matrixUserId,
            nativeId: evt.event_id,
            replyAuth: { matrix_token: matrixToken, matrix_instance: matrixUrl, matrix_room_id: roomId },
          }));
      } catch { return []; }
    });

    const results = await Promise.allSettled(roomPromises);
    for (const r of results) { if (r.status === 'fulfilled') items.push(...r.value); }
  } catch { /* matrix unreachable */ }

  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MASTODON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function mastodonFetch(path: string, instance: string, token: string): Promise<Response | null> {
  try {
    const res = await fetch(`${instance}${path}`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
    });
    return res.ok ? res : null;
  } catch { return null; }
}

export async function fetchMastodonDMs(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth?.mastodon ?? auth?.accessToken ?? auth?.mastodon_token;
  if (!token) return items;

  try {
    const notifRes = await mastodonFetch(`/api/v1/notifications?limit=40&types[]=mention`, instance, token);
    if (!notifRes) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string; type: string; created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content: string; visibility: string; in_reply_to_id?: string | null };
    }>;

    for (const n of notifs) {
      if (n.status?.visibility !== 'direct') continue;
      items.push({
        id: `mastodon:dm:${n.id}`, kind: 'dm', protocol: 'mastodon',
        actor: { id: n.account?.id ?? '', handle: n.account?.acct ?? '', displayName: n.account?.display_name, avatarUrl: n.account?.avatar, protocol: 'mastodon' },
        content: n.status?.content ? stripHtml(n.status.content) : '', html: n.status?.content,
        createdAt: new Date(n.created_at).getTime(), read: false, seen: false,
        nativeId: n.status?.id, replyAuth: { mastodon: token, mastodon_instance: instance },
      });
    }
  } catch { /* mastodon unreachable */ }
  return items;
}

export async function fetchMastodonReplies(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth?.mastodon ?? auth?.accessToken ?? auth?.mastodon_token;
  if (!token) return items;

  try {
    const notifRes = await mastodonFetch(`/api/v1/notifications?limit=40&types[]=mention&types[]=status`, instance, token);
    if (!notifRes) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string; type: string; created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content: string; in_reply_to_id?: string | null };
    }>;

    for (const n of notifs) {
      items.push({
        id: `mastodon:reply:${n.id}`, kind: 'reply', protocol: 'mastodon',
        actor: { id: n.account?.id ?? '', handle: n.account?.acct ?? '', displayName: n.account?.display_name, avatarUrl: n.account?.avatar, protocol: 'mastodon' },
        content: n.status?.content ? stripHtml(n.status.content) : '', html: n.status?.content,
        createdAt: new Date(n.created_at).getTime(), read: false, seen: false,
        parentId: n.status?.in_reply_to_id ?? undefined, parentProtocol: 'mastodon',
        nativeId: n.status?.id, replyAuth: { mastodon: token, mastodon_instance: instance },
      });
    }
  } catch { /* mastodon unreachable */ }
  return items;
}

export async function fetchMastodonNotifications(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.mastodon_instance ?? 'https://social.degenfeed.xyz';
  const token = auth?.mastodon ?? auth?.accessToken ?? auth?.mastodon_token;
  if (!token) return items;

  const kindMap: Record<string, InboxItemKind> = { favourite: 'like', reblog: 'repost', follow: 'follow' };

  try {
    const notifRes = await mastodonFetch(`/api/v1/notifications?limit=40`, instance, token);
    if (!notifRes) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string; type: string; created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content?: string };
    }>;

    for (const n of notifs) {
      const kind = kindMap[n.type];
      if (!kind) continue;
      items.push({
        id: `mastodon:${kind}:${n.id}`, kind, protocol: 'mastodon',
        actor: { id: n.account?.id ?? '', handle: n.account?.acct ?? '', displayName: n.account?.display_name, avatarUrl: n.account?.avatar, protocol: 'mastodon' },
        content: kind === 'follow' ? 'Followed you' : `${kind}d your post`,
        createdAt: new Date(n.created_at).getTime(), read: false, seen: false,
        nativeId: n.status?.id, replyAuth: { mastodon: token, mastodon_instance: instance },
      });
    }
  } catch { /* mastodon unreachable */ }
  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLUESKY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchBlueskyDMs(did: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const accessJwt = auth?.bluesky_jwt ?? auth?.bluesky_accessJwt ?? auth?.accessJwt;
  if (!accessJwt || !did) return items;

  try {
    const pdsUrl = auth?.bluesky_pds ?? 'https://bsky.social';

    const convRes = await fetch(`${pdsUrl}/xrpc/chat.bsky.conv.listConvs?limit=20`, {
      headers: { authorization: `Bearer ${accessJwt}` }, signal: AbortSignal.timeout(8000),
    });

    if (convRes.ok) {
      const convData = (await convRes.json()) as { convs?: Array<{ id: string; members?: Array<{ did: string }> }> };
      for (const conv of convData.convs ?? []) {
        const msgRes = await fetch(`${pdsUrl}/xrpc/chat.bsky.conv.getMessages?convId=${conv.id}&limit=20`, {
          headers: { authorization: `Bearer ${accessJwt}` }, signal: AbortSignal.timeout(8000),
        });
        if (!msgRes.ok) continue;
        const msgData = (await msgRes.json()) as { messages?: Array<{ id: string; text?: string; sender?: { did: string }; sentAt?: string }> };
        for (const msg of msgData.messages ?? []) {
          if (msg.sender?.did === did) continue;
          items.push({
            id: `bluesky:dm:${msg.id}`, kind: 'dm', protocol: 'bluesky',
            actor: { id: msg.sender?.did ?? '', handle: msg.sender?.did ?? '', protocol: 'bluesky' },
            content: msg.text ?? '', createdAt: msg.sentAt ? new Date(msg.sentAt).getTime() : Date.now(),
            read: false, seen: false, conversationId: conv.id, nativeId: msg.id,
            replyAuth: { bluesky_jwt: accessJwt, bluesky_did: did },
          });
        }
      }
    } else {
      // Fallback: fetch mentions
      const authorFeedRes = await fetch(`${pdsUrl}/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=30`, {
        headers: { authorization: `Bearer ${accessJwt}` }, signal: AbortSignal.timeout(8000),
      });
      if (authorFeedRes.ok) {
        const feedData = (await authorFeedRes.json()) as { feed?: Array<{ post?: { uri: string; author?: { did: string; handle: string; displayName?: string; avatar?: string }; record?: { text?: string; reply?: { parent?: { uri: string } } }; indexedAt?: string } }> };
        for (const item of feedData.feed ?? []) {
          const post = item.post;
          if (!post?.record?.reply) continue;
          items.push({
            id: `bluesky:dm:${post.uri}`, kind: 'dm', protocol: 'bluesky',
            actor: { id: post.author?.did ?? '', handle: post.author?.handle ?? '', displayName: post.author?.displayName, avatarUrl: post.author?.avatar, protocol: 'bluesky' },
            content: post.record?.text ?? '', createdAt: post.indexedAt ? new Date(post.indexedAt).getTime() : Date.now(),
            read: false, seen: false, nativeId: post.uri, replyAuth: { bluesky_jwt: accessJwt, bluesky_did: did },
          });
        }
      }
    }
  } catch { /* bluesky unreachable */ }
  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FARCASTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getNumericFid(fid: number | string): number {
  return typeof fid === 'string' ? Number.parseInt(fid, 10) : fid;
}

export async function fetchFarcasterDMs(fid: number | string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const hubUrl = auth?.farcaster_hub ?? 'https://hub.farcaster.standardcrypto.vc:2281';
  const numericFid = getNumericFid(fid);
  if (Number.isNaN(numericFid)) return items;

  try {
    const castsRes = await fetch(`${hubUrl}/v1/castsByFid?fid=${numericFid}&limit=20`, { signal: AbortSignal.timeout(8000) });
    if (!castsRes.ok) return items;
    const castsData = (await castsRes.json()) as { messages?: Array<{ data?: { castAddBody?: { parentCastId?: { fid: number }; text: string } } }> };
    for (const msg of castsData.messages ?? []) {
      const body = msg.data?.castAddBody;
      if (body?.parentCastId && body.parentCastId.fid !== numericFid) {
        items.push({
          id: `farcaster:dm:${numericFid}`, kind: 'dm', protocol: 'farcaster',
          actor: { id: String(body.parentCastId.fid), handle: `fid:${body.parentCastId.fid}`, protocol: 'farcaster' },
          content: body.text.slice(0, 320), createdAt: Date.now(), read: false, seen: false,
          nativeId: String(body.parentCastId.fid), replyAuth: { farcaster_hub: hubUrl },
        });
      }
    }
  } catch { /* farcaster hub unreachable */ }
  return items;
}

export async function fetchFarcasterReplies(fid: number | string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const hubUrl = auth?.farcaster_hub ?? 'https://hub.farcaster.standardcrypto.vc:2281';
  const numericFid = getNumericFid(fid);
  if (Number.isNaN(numericFid)) return items;

  try {
    const castsRes = await fetch(`${hubUrl}/v1/castsByFid?fid=${numericFid}&limit=10`, { signal: AbortSignal.timeout(8000) });
    if (!castsRes.ok) return items;
    const castsData = (await castsRes.json()) as { messages?: Array<{ hash: string }> };
    for (const msg of castsData.messages ?? []) {
      try {
        const repliesRes = await fetch(`${hubUrl}/v1/castsByParent?fid=${numericFid}&hash=${msg.hash}&limit=20`, { signal: AbortSignal.timeout(5000) });
        if (!repliesRes.ok) continue;
        const repliesData = (await repliesRes.json()) as { messages?: Array<{ hash: string; data?: { fid: number; castAddBody?: { text: string }; timestamp?: number } }> };
        for (const replyMsg of repliesData.messages ?? []) {
          const replyFid = replyMsg.data?.fid;
          if (!replyFid || replyFid === numericFid) continue;
          items.push({
            id: `farcaster:reply:${replyMsg.hash}`, kind: 'reply', protocol: 'farcaster',
            actor: { id: String(replyFid), handle: `fid:${replyFid}`, protocol: 'farcaster' },
            content: replyMsg.data?.castAddBody?.text ?? '',
            createdAt: replyMsg.data?.timestamp ? replyMsg.data.timestamp * 1000 : Date.now(),
            read: false, seen: false, parentId: msg.hash, parentProtocol: 'farcaster',
            nativeId: replyMsg.hash, replyAuth: { farcaster_hub: hubUrl },
          });
        }
      } catch { /* replies fetch failed */ }
    }
  } catch { /* farcaster hub unreachable */ }
  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PEERTUBE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchPeerTubeComments(userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.peertube_instance ?? 'https://video.degenfeed.xyz';
  const token = auth?.peertube ?? auth?.accessToken;
  const accountName = userId.includes('@') ? userId.split('@')[0] : userId;

  try {
    const videosRes = await fetch(`${instance}/api/v1/accounts/${encodeURIComponent(accountName)}/videos?count=10`, {
      headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(8000),
    });
    if (!videosRes.ok) return items;
    const videosData = (await videosRes.json()) as { data?: Array<{ uuid: string; name: string }> };

    for (const video of videosData.data ?? []) {
      try {
        const commentsRes = await fetch(`${instance}/api/v1/videos/${video.uuid}/comment-threads?count=20`, {
          headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(8000),
        });
        if (!commentsRes.ok) continue;
        const commentsData = (await commentsRes.json()) as {
          data?: Array<{ id: number; text: string; createdAt: string; account?: { id: number; displayName: string; name: string; avatar?: { path?: string } }; inReplyToCommentId?: number }>;
        };
        for (const comment of commentsData.data ?? []) {
          if (!comment.account) continue;
          items.push({
            id: `peertube:comment:${comment.id}`, kind: 'comment', protocol: 'peertube',
            actor: { id: String(comment.account.id), handle: comment.account.name, displayName: comment.account.displayName, avatarUrl: comment.account.avatar?.path ? `${instance}${comment.account.avatar.path}` : undefined, protocol: 'peertube' },
            content: stripHtml(comment.text), createdAt: new Date(comment.createdAt).getTime(),
            read: false, seen: false, parentId: video.uuid, parentProtocol: 'peertube', rootId: video.uuid,
            url: `${instance}/videos/watch/${video.uuid}`, nativeId: String(comment.id),
            replyAuth: { peertube: token ?? '', peertube_instance: instance },
          });
        }
      } catch { /* video comments failed */ }
    }
  } catch { /* peertube unreachable */ }
  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEMMY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchLemmyComments(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.lemmy_instance ?? 'https://community.degenfeed.xyz';
  const token = auth?.lemmy ?? auth?.authToken;

  try {
    const repliesRes = await fetch(`${instance}/api/v3/user/replies?limit=50&sort=New`, {
      headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!repliesRes.ok) return items;
    const repliesData = (await repliesRes.json()) as {
      replies?: Array<{ comment_reply?: { id: number; comment?: { id: number; content: string; published: string; creator?: { id: number; name: string; display_name?: string; avatar?: string }; post?: { id: number; name: string } } } }>;
    };
    for (const reply of repliesData.replies ?? []) {
      const cr = reply.comment_reply;
      if (!cr?.comment) continue;
      const comment = cr.comment;
      items.push({
        id: `lemmy:comment:${comment.id}`, kind: 'comment', protocol: 'lemmy',
        actor: { id: String(comment.creator?.id ?? ''), handle: comment.creator?.name ?? '', displayName: comment.creator?.display_name ?? comment.creator?.name, avatarUrl: comment.creator?.avatar, protocol: 'lemmy' },
        content: stripHtml(comment.content), createdAt: new Date(comment.published).getTime(),
        read: false, seen: false, parentId: String(comment.post?.id ?? ''), parentProtocol: 'lemmy',
        url: `${instance}/post/${comment.post?.id ?? ''}`, nativeId: String(comment.id),
        replyAuth: { lemmy: token ?? '', lemmy_instance: instance },
      });
    }
  } catch { /* lemmy unreachable */ }
  return items;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PIXELFED
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchPixelfedComments(_userId: string, auth?: Record<string, string>): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const instance = auth?.pixelfed_instance ?? 'https://gram.degenfeed.xyz';
  const token = auth?.pixelfed ?? auth?.accessToken;
  if (!token) return items;

  try {
    const notifRes = await fetch(`${instance}/api/v1/notifications?limit=40`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
    });
    if (!notifRes.ok) return items;
    const notifs = (await notifRes.json()) as Array<{
      id: string; type: string; created_at: string;
      account?: { id: string; acct: string; display_name?: string; avatar?: string };
      status?: { id: string; content: string; media_attachments?: Array<{ url: string }> };
    }>;
    for (const n of notifs) {
      if (n.type !== 'mention') continue;
      items.push({
        id: `pixelfed:comment:${n.id}`, kind: 'comment', protocol: 'pixelfed',
        actor: { id: n.account?.id ?? '', handle: n.account?.acct ?? '', displayName: n.account?.display_name, avatarUrl: n.account?.avatar, protocol: 'pixelfed' },
        content: n.status?.content ? stripHtml(n.status.content) : '', html: n.status?.content,
        createdAt: new Date(n.created_at).getTime(), read: false, seen: false,
        nativeId: n.status?.id, url: `${instance}/@${n.account?.acct ?? ''}/${n.status?.id ?? ''}`,
        replyAuth: { pixelfed: token, pixelfed_instance: instance },
      });
    }
  } catch { /* pixelfed unreachable */ }
  return items;
}

import { type Env, jsonResponse } from '../index';

interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention';
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

function npubToHex(npubOrHex: string): string {
  if (!npubOrHex) return '';
  if (npubOrHex.startsWith('npub1') && npubOrHex.length === 62) {
    try {
      const mod = require('@degenfeed/nostr-sdk') as { nip19?: { decode?: (s: string) => { type: string; data: string } } };
      const decoded = mod.nip19?.decode?.(npubOrHex);
      if (decoded && decoded.type === 'npub' && typeof decoded.data === 'string') {
        return decoded.data;
      }
    } catch { /* fall through */ }
  }
  return npubOrHex;
}

async function fetchNostrNotifications(pubkey: string): Promise<Notification[]> {
  const results: Notification[] = [];
  const hexPubkey = npubToHex(pubkey);
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
        type: 'like' as const,
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
      if (ev.pubkey === hexPubkey || !ev.tags.some((t: string[]) => t[0] === 'p' && t[1] === hexPubkey))
        continue;
      results.push({
        id: `nostr:mention:${ev.id}`,
        type: 'mention' as const,
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
  } catch {}
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
  } catch {}
  return results;
}

export async function handleNotifications(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  let auth: Record<string, string> = {};
  try {
    auth = JSON.parse(decodeURIComponent(url.searchParams.get('auth') || '{}'));
  } catch {}

  const all: Notification[] = [];

  const npub = auth.nostr_pubkey || '';
  if (npub) {
    try {
      all.push(...(await fetchNostrNotifications(npub)));
    } catch {}
  }

  const mToken = auth.mastodon || '';
  const mInst = auth.mastodon_instance || 'https://social.degenfeed.xyz';
  if (mToken) {
    try {
      all.push(...(await fetchMastodonNotifications(mInst, mToken)));
    } catch {}
  }

  all.sort((a, b) => b.createdAt - a.createdAt);
  return jsonResponse({ notifications: all.slice(0, 50), meta: { total: all.length } });
}

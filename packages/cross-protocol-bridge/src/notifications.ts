import type { Protocol } from '@degenfeed/types';
import type { UnifiedNotification, UnifiedNotificationFeed } from './types';

export interface NotificationFetcher {
  protocol: Protocol;
  fetch(userId: string, auth?: Record<string, string>): Promise<UnifiedNotification[]>;
  healthCheck(): Promise<boolean>;
}

// ─── Helper: fetch Nostr notifications from a relay ──────────────────────

function fetchNostrFromRelay(relayUrl: string, pubkey: string): Promise<UnifiedNotification[]> {
  return new Promise((resolve) => {
    const results: UnifiedNotification[] = [];
    let resolved = false;
    let ws: WebSocket | null = null;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws?.close();
        resolve(results);
      }
    }, 5000);

    try {
      ws = new WebSocket(relayUrl);
      ws.addEventListener('open', () => {
        ws?.send(
          JSON.stringify([
            'REQ',
            `df-notif-${Date.now()}`,
            { kinds: [7, 1, 9735], '#p': [pubkey], limit: 30 },
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
            if (ev.kind === 7) {
              results.push({
                id: `nostr:${ev.id}`,
                type: 'like',
                protocol: 'nostr',
                actor: {
                  displayName: ev.pubkey.slice(0, 12),
                  handle: ev.pubkey.slice(0, 12),
                  protocol: 'nostr',
                  id: ev.pubkey,
                },
                content: 'Liked your post',
                createdAt: ev.created_at * 1000,
                read: false,
                postId: ev.tags.find((t) => t[0] === 'e')?.[1],
              });
            } else if (ev.kind === 1) {
              results.push({
                id: `nostr:${ev.id}`,
                type: 'mention',
                protocol: 'nostr',
                actor: {
                  displayName: ev.pubkey.slice(0, 12),
                  handle: ev.pubkey.slice(0, 12),
                  protocol: 'nostr',
                  id: ev.pubkey,
                },
                content: ev.content.slice(0, 150),
                createdAt: ev.created_at * 1000,
                read: false,
                postId: ev.id,
                postText: ev.content.slice(0, 100),
              });
            } else if (ev.kind === 9735) {
              results.push({
                id: `nostr:${ev.id}`,
                type: 'zap',
                protocol: 'nostr',
                actor: {
                  displayName: ev.pubkey.slice(0, 12),
                  handle: ev.pubkey.slice(0, 12),
                  protocol: 'nostr',
                  id: ev.pubkey,
                },
                content: 'Zapped your post',
                createdAt: ev.created_at * 1000,
                read: false,
                postId: ev.tags.find((t) => t[0] === 'e')?.[1],
                amount: ev.tags.find((t) => t[0] === 'amount')?.[1],
                currency: 'sats',
              });
            }
          } else if (msg[0] === 'EOSE') {
            clearTimeout(timer);
            if (!resolved) {
              resolved = true;
              ws?.close();
              resolve(results);
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
          resolve(results);
        }
      });
      ws.addEventListener('close', () => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(results);
        }
      });
    } catch {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve(results);
      }
    }
  });
}

// ─── Protocol-specific fetchers ──────────────────────────────────────────

const nostrFetcher: NotificationFetcher = {
  protocol: 'nostr',
  async fetch(pubkey: string): Promise<UnifiedNotification[]> {
    if (!pubkey) return [];
    const results: UnifiedNotification[] = [];
    const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
    const hexPubkey = pubkey.startsWith('npub1') ? pubkey : pubkey;

    for (const relayUrl of relays) {
      try {
        const notifs = await fetchNostrFromRelay(relayUrl, hexPubkey);
        results.push(...notifs);
      } catch {
        /* relay down */
      }
    }
    return results;
  },
  async healthCheck(): Promise<boolean> {
    try {
      const ws = new WebSocket('wss://relay.damus.io');
      return await new Promise((resolve) => {
        ws.addEventListener('open', () => {
          ws.close();
          resolve(true);
        });
        ws.addEventListener('error', () => resolve(false));
        setTimeout(() => resolve(false), 3000);
      });
    } catch {
      return false;
    }
  },
};

const mastodonFetcher: NotificationFetcher = {
  protocol: 'mastodon',
  async fetch(_userId: string, auth?: Record<string, string>): Promise<UnifiedNotification[]> {
    const results: UnifiedNotification[] = [];
    const instance = auth?.instance ?? 'https://social.degenfeed.xyz';
    const token = auth?.accessToken ?? '';
    if (!token) return results;
    try {
      const res = await fetch(`${instance}/api/v1/notifications?limit=30`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return results;
      const data = (await res.json()) as Array<{
        id: string;
        type: string;
        created_at: string;
        account?: { display_name?: string; username?: string; acct?: string; avatar?: string };
        status?: { id?: string; content?: string };
      }>;
      for (const n of data) {
        const typeMap: Record<string, UnifiedNotification['type']> = {
          favourite: 'like',
          reblog: 'repost',
          mention: 'mention',
          follow: 'follow',
        };
        results.push({
          id: `mastodon:${n.id}`,
          type: typeMap[n.type] ?? 'mention',
          protocol: 'mastodon',
          actor: {
            displayName: n.account?.display_name ?? n.account?.username ?? '',
            handle: n.account?.acct ?? '',
            avatarUrl: n.account?.avatar,
            protocol: 'mastodon',
          },
          content:
            typeMap[n.type] === 'follow'
              ? 'Followed you'
              : `${n.account?.display_name ?? 'Someone'} interacted`,
          createdAt: new Date(n.created_at).getTime(),
          read: false,
          postId: n.status?.id,
          postText: n.status?.content?.replace(/<[^>]*>/g, '').slice(0, 100),
        });
      }
    } catch {
      /* unreachable */
    }
    return results;
  },
  async healthCheck(): Promise<boolean> {
    try {
      return (
        await fetch('https://social.degenfeed.xyz/api/v1/instance', {
          signal: AbortSignal.timeout(5000),
        })
      ).ok;
    } catch {
      return false;
    }
  },
};

// ─── Fetcher Registry ────────────────────────────────────────────────────

const FETCHERS: Record<string, NotificationFetcher> = {
  nostr: nostrFetcher,
  mastodon: mastodonFetcher,
  farcaster: {
    protocol: 'farcaster',
    async fetch() {
      return [];
    },
    async healthCheck() {
      return false;
    },
  },
  bluesky: {
    protocol: 'bluesky',
    async fetch() {
      return [];
    },
    async healthCheck() {
      return false;
    },
  },
};

export function registerNotificationFetcher(
  protocol: Protocol,
  fetcher: NotificationFetcher,
): void {
  FETCHERS[protocol] = fetcher;
}

export function getNotificationFetcher(protocol: Protocol): NotificationFetcher | undefined {
  return FETCHERS[protocol];
}

// ─── Unified Notification Feed ───────────────────────────────────────────

export async function fetchUnifiedNotifications(
  linkedProtocols: Array<{ protocol: Protocol; userId: string; auth?: Record<string, string> }>,
  options?: { limit?: number; since?: number; includeRead?: boolean },
): Promise<UnifiedNotificationFeed> {
  const limit = options?.limit ?? 50;
  const fetchPromises = linkedProtocols.map(async (lp) => {
    const fetcher = FETCHERS[lp.protocol];
    if (!fetcher) return [] as UnifiedNotification[];
    try {
      return await fetcher.fetch(lp.userId, lp.auth);
    } catch {
      return [] as UnifiedNotification[];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  const all: UnifiedNotification[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped = all.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
  const filtered = options?.includeRead ? deduped : deduped.filter((n) => !n.read);
  const timeFiltered = options?.since
    ? filtered.filter((n) => n.createdAt >= options.since!)
    : filtered;
  timeFiltered.sort((a, b) => b.createdAt - a.createdAt);

  const notifications = timeFiltered.slice(0, limit);
  return {
    notifications,
    meta: {
      total: timeFiltered.length,
      unread: notifications.filter((n) => !n.read).length,
      protocols: [...new Set(notifications.map((n) => n.protocol))],
      fetchedAt: Date.now(),
    },
  };
}

export function generateBridgeNotifications(
  events: Array<{
    pathId: string;
    sourceProtocol: Protocol;
    targetProtocol: Protocol;
    postId: string;
    text: string;
    timestamp: number;
  }>,
): UnifiedNotification[] {
  return events.map((e) => ({
    id: `bridge:${e.pathId}:${e.postId}`,
    type: 'bridge' as const,
    protocol: e.targetProtocol,
    actor: { displayName: 'Cross-Protocol Bridge', handle: 'bridge', protocol: 'nostr' },
    content: `Your post was bridged from ${e.sourceProtocol} to ${e.targetProtocol}`,
    createdAt: e.timestamp,
    read: false,
    postId: e.postId,
    postText: e.text.slice(0, 100),
    bridgePath: e.pathId,
  }));
}

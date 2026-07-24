/**
 * @degenfeed/cross-protocol-bridge — Cross-Protocol Notifications
 *
 * Unified notification feed across all protocols.
 * Fetches notifications from each linked protocol and merges them
 * into a single, chronologically sorted feed.
 */

import type { Protocol } from '@degenfeed/types';
import type { UnifiedNotification, UnifiedNotificationFeed } from './types';
import { resolveByIdentity } from './identity-linking';

// ─── Types for protocol-specific notification fetchers ───────────────────

interface NotificationFetcher {
  protocol: Protocol;
  /** Fetch notifications for a given user identifier on this protocol */
  fetch(userId: string, auth?: Record<string, string>): Promise<UnifiedNotification[]>;
  /** Ping check */
  healthCheck(): Promise<boolean>;
}

// ─── Protocol-specific notification fetchers ─────────────────────────────

const nostrFetcher: NotificationFetcher = {
  protocol: 'nostr',
  async fetch(pubkey: string, _auth?: Record<string, string>): Promise<UnifiedNotification[]> {
    if (!pubkey) return [];
    const results: UnifiedNotification[] = [];
    const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
    const hexPubkey = pubkey.startsWith('npub1') ? pubkey : pubkey;

    for (const relayUrl of relays) {
      try {
        const notifs = await this.fetchNostrFromRelay(relayUrl, hexPubkey);
        results.push(...notifs);
      } catch {
        // Relay down, try next
      }
    }

    return results;
  },

  async fetchNostrFromRelay(relayUrl: string, pubkey: string): Promise<UnifiedNotification[]> {
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
          const subId = `df-notif-${Date.now()}`;
          // Fetch kind 7 (reactions), kind 1 (mentions), kind 9735 (zaps)
          ws?.send(JSON.stringify([
            'REQ', subId,
            {
              kinds: [7, 1, 9735],
              '#p': [pubkey],
              limit: 30,
            },
          ]));
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'EVENT') {
              const ev = msg[2] as {
                id: string; pubkey: string; kind: number;
                created_at: number; content: string; tags: string[][];
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
          } catch { /* skip malformed */ }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          if (!resolved) { resolved = true; resolve(results); }
        });
        ws.addEventListener('close', () => {
          clearTimeout(timer);
          if (!resolved) { resolved = true; resolve(results); }
        });
      } catch {
        clearTimeout(timer);
        if (!resolved) { resolved = true; resolve(results); }
      }
    });
  },

  async healthCheck(): Promise<boolean> {
    try {
      const ws = new WebSocket('wss://relay.damus.io');
      return await new Promise((resolve) => {
        ws.addEventListener('open', () => { ws.close(); resolve(true); });
        ws.addEventListener('error', () => resolve(false));
        setTimeout(() => resolve(false), 3000);
      });
    } catch { return false; }
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
        id: string; type: string; created_at: string;
        account?: { display_name?: string; username?: string; acct?: string; avatar?: string };
        status?: { id?: string; content?: string };
      }>;

      for (const n of data) {
        const typeMap: Record<string, UnifiedNotification['type']> = {
          favourite: 'like', reblog: 'repost', mention: 'mention',
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
          content: typeMap[n.type] === 'follow'
            ? 'Followed you'
            : `${n.account?.display_name ?? 'Someone'} interacted with your post`,
          createdAt: new Date(n.created_at).getTime(),
          read: false,
          postId: n.status?.id,
          postText: n.status?.content?.replace(/<[^>]*>/g, '').slice(0, 100),
        });
      }
    } catch { /* instance unreachable */ }

    return results;
  },

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://social.degenfeed.xyz/api/v1/instance', {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch { return false; }
  },
};

const farcasterFetcher: NotificationFetcher = {
  protocol: 'farcaster',
  async fetch(fid: string, _auth?: Record<string, string>): Promise<UnifiedNotification[]> {
    const results: UnifiedNotification[] = [];
    const fidNum = Number.parseInt(fid, 10);
    if (!fidNum) return results;

    try {
      const apiKey = _auth?.neynarApiKey ?? process.env.NEYNAR_API_KEY ?? '';
      if (!apiKey) return results;

      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/notifications?fid=${fidNum}&limit=25`,
        { headers: { api_key: apiKey }, signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) return results;

      const data = (await res.json()) as {
        notifications?: Array<{
          type: string;
          cast: { hash: string; text: string; author: { fid: number; username: string; displayName?: string; pfpUrl?: string } };
          timestamp: string;
        }>;
      };

      for (const n of data.notifications ?? []) {
        const typeMap: Record<string, UnifiedNotification['type']> = {
          like: 'like', recast: 'repost', reply: 'reply', follow: 'follow',
        };

        results.push({
          id: `farcaster:${n.cast.hash}`,
          type: typeMap[n.type] ?? 'mention',
          protocol: 'farcaster',
          actor: {
            displayName: n.cast.author.displayName ?? n.cast.author.username,
            handle: n.cast.author.username,
            avatarUrl: n.cast.author.pfpUrl,
            protocol: 'farcaster',
            id: String(n.cast.author.fid),
          },
          content: n.cast.text.slice(0, 150),
          createdAt: new Date(n.timestamp).getTime(),
          read: false,
          postId: n.cast.hash,
          postText: n.cast.text.slice(0, 100),
        });
      }
    } catch { /* API unreachable */ }

    return results;
  },

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://api.neynar.com/v2/farcaster/feed', {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok || res.status === 401; // 401 means API is up but needs key
    } catch { return false; }
  },
};

const blueskyFetcher: NotificationFetcher = {
  protocol: 'bluesky',
  async fetch(_userId: string, auth?: Record<string, string>): Promise<UnifiedNotification[]> {
    const results: UnifiedNotification[] = [];
    const pdsUrl = auth?.pdsUrl ?? 'https://bsky.social';
    const accessJwt = auth?.accessJwt ?? '';

    if (!accessJwt) return results;

    try {
      const res = await fetch(
        `${pdsUrl}/xrpc/app.bsky.notification.listNotifications?limit=30`,
        {
          headers: {
            authorization: `Bearer ${accessJwt}`,
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) return results;

      const data = (await res.json()) as {
        notifications?: Array<{
          uri: string; reason: string; reasonSubject?: string; isRead: boolean; indexedAt: string;
          author: { did: string; handle: string; displayName?: string; avatar?: string };
          record?: { text?: string };
        }>;
      };

      for (const n of data.notifications ?? []) {
        const typeMap: Record<string, UnifiedNotification['type']> = {
          like: 'like', repost: 'repost', reply: 'reply',
          follow: 'follow', mention: 'mention', quote: 'quote',
        };

        results.push({
          id: `bluesky:${n.uri}`,
          type: typeMap[n.reason] ?? 'mention',
          protocol: 'bluesky',
          actor: {
            displayName: n.author.displayName ?? n.author.handle,
            handle: n.author.handle,
            avatarUrl: n.author.avatar,
            protocol: 'bluesky',
            id: n.author.did,
          },
          content: n.record?.text?.slice(0, 150) ?? '',
          createdAt: new Date(n.indexedAt).getTime(),
          read: n.isRead,
          postId: n.reasonSubject ?? n.uri,
          postText: n.record?.text?.slice(0, 100),
        });
      }
    } catch { /* PDS unreachable */ }

    return results;
  },

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://bsky.social/xrpc/com.atproto.server.describeServer', {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch { return false; }
  },
};

// ─── Fetcher Registry ────────────────────────────────────────────────────

const FETCHERS: Record<string, NotificationFetcher> = {
  nostr: nostrFetcher,
  mastodon: mastodonFetcher,
  farcaster: farcasterFetcher,
  bluesky: blueskyFetcher,
};

/**
 * Register a custom notification fetcher for a protocol.
 */
export function registerNotificationFetcher(
  protocol: Protocol,
  fetcher: NotificationFetcher,
): void {
  FETCHERS[protocol] = fetcher;
}

/**
 * Get the registered fetcher for a protocol.
 */
export function getNotificationFetcher(protocol: Protocol): NotificationFetcher | undefined {
  return FETCHERS[protocol];
}

// ─── Unified Notification Feed ───────────────────────────────────────────

/**
 * Fetch a unified notification feed across all linked protocols.
 *
 * @param linkedProtocols - Array of { protocol, userId, auth } tuples
 * @param options - Fetch options
 * @returns Unified, deduplicated, sorted notification feed
 */
export async function fetchUnifiedNotifications(
  linkedProtocols: Array<{
    protocol: Protocol;
    userId: string;
    auth?: Record<string, string>;
  }>,
  options?: {
    limit?: number;
    since?: number;
    includeRead?: boolean;
  },
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
  const allNotifications: UnifiedNotification[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allNotifications.push(...result.value);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const deduped = allNotifications.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Filter by read state
  const filtered = options?.includeRead
    ? deduped
    : deduped.filter((n) => !n.read);

  // Filter by since timestamp
  const timeFiltered = options?.since
    ? filtered.filter((n) => n.createdAt >= options.since!)
    : filtered;

  // Sort by newest first
  timeFiltered.sort((a, b) => b.createdAt - a.createdAt);

  const notifications = timeFiltered.slice(0, limit);
  const total = timeFiltered.length;
  const unread = notifications.filter((n) => !n.read).length;
  const protocols = [...new Set(notifications.map((n) => n.protocol))];

  return {
    notifications,
    meta: {
      total,
      unread,
      protocols,
      fetchedAt: Date.now(),
    },
  };
}

/**
 * Generate bridge-status notifications for cross-posted content.
 * These appear as "Your post was bridged to Nostr" type notifications.
 */
export function generateBridgeNotifications(
  crossPostEvents: Array<{
    pathId: string;
    sourceProtocol: Protocol;
    targetProtocol: Protocol;
    postId: string;
    text: string;
    timestamp: number;
  }>,
): UnifiedNotification[] {
  return crossPostEvents.map((event, i) => ({
    id: `bridge:${event.pathId}:${event.postId}`,
    type: 'bridge' as const,
    protocol: event.targetProtocol,
    actor: {
      displayName: 'Cross-Protocol Bridge',
      handle: 'bridge',
      protocol: 'nostr',
    },
    content: `Your post was bridged from ${event.sourceProtocol} to ${event.targetProtocol}`,
    createdAt: event.timestamp,
    read: false,
    postId: event.postId,
    postText: event.text.slice(0, 100),
    bridgePath: event.pathId,
  }));
}

/**
 * Push Protocol Provider
 *
 * Push Protocol (formerly EPNS) is a Web3 communication protocol for
 * decentralized notifications. We run a Push Delivery Node and integrate
 * with the Push SDK to fetch/send notifications.
 *
 * API: Push REST API + Delivery Node
 *   PushAPI.user.getFeeds() — get notifications for a user
 *   Delivery Node: POST /apis/v1/pushtokens/register
 *
 * Since Push requires wallet auth for most endpoints, we:
 * 1. Monitor public channel notifications
 * 2. Serve notification feeds for authenticated users
 * 3. Bridge Push notifications to DegenFeed notification center
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const PUSH_API = 'https://backend.epns.io/api';

const PUBLIC_CHANNELS = [
  { address: 'eip155:1:0x35B84d6848D16415177c64D64504663b998A6ab4', name: 'Push Protocol' },
  { address: 'eip155:1:0xD8634C39BBFd4033c0d3289C4515275102423681', name: 'DegenFeed' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface PushNotification {
  id?: string;
  title?: string;
  body?: string;
  cta?: string;
  type?: number;
  epoch?: number;
  app?: string;
  sid?: string;
  payload_id?: number;
  notification?: {
    title?: string;
    body?: string;
  };
  source?: string;
  blockchain?: string;
  secret?: string;
}

interface PushFeedResponse {
  feeds?: PushNotification[];
  data?: PushNotification[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessPushNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi|nft)\b/.test(lower)) n.push('crypto');
  if (/\b(notification|alert|push|message|communication)\b/.test(lower)) n.push('notifications');
  if (/\b(dao|governance|vote|proposal|treasury)\b/.test(lower)) n.push('dao');
  if (/\b(security|warning|critical|hack|exploit|phishing)\b/.test(lower)) n.push('security');
  if (/\b(airdrop|reward|claim|distribution|stake)\b/.test(lower)) n.push('airdrops');
  if (/\b(listing|exchange|launch|new.token|mint)\b/.test(lower)) n.push('launches');
  if (n.length === 0) n.push('notification');
  return n;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function pushNotifToPost(notif: PushNotification): UnifiedPost {
  const title = notif.notification?.title || notif.title || '';
  const body = notif.notification?.body || notif.body || '';
  const text = title ? `📬 ${title}\n\n${body}` : body;

  return {
    id: `push:${notif.sid || notif.payload_id || notif.id || Date.now()}`,
    protocol: 'push',
    author: {
      id: `push:channel:${notif.app || notif.source || 'push-protocol'}`,
      primary: { protocol: 'push', id: notif.app || 'push-protocol' },
      handles: { push: notif.app || null },
      displayName: notif.app || 'Push Notification',
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: text.slice(0, 2000),
    embeds: notif.cta ? [{ kind: 'link', url: notif.cta }] : [],
    contentType: 'notification',
    createdAt: (notif.epoch || Date.now()) * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: notif,
    niches: guessPushNiches(text),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchPublicNotifications(limit: number): Promise<UnifiedPost[]> {
  try {
    // Fetch from Push protocol public API
    const results = await Promise.allSettled(
      PUBLIC_CHANNELS.map(async (channel) => {
        const res = await $fetch(
          `${PUSH_API}/v1/payloads?channel=${channel.address}&limit=${Math.ceil(limit / PUBLIC_CHANNELS.length)}`,
          {
            headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Push)' },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as PushFeedResponse;
        const feeds = data.feeds || data.data || [];
        return Array.isArray(feeds) ? feeds.map(pushNotifToPost) : [];
      }),
    );

    const all: UnifiedPost[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all.slice(0, limit);
  } catch {
    // console.log(`[bridge] Push API error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'push',
  name: 'Push Protocol',
  description: 'Web3 decentralized notifications across chains',
  endpoint: '/api/feed/push',
  requiresAuth: false,
  contentType: 'notification',
};

export async function fetchPushPosts(limit = 20): Promise<UnifiedPost[]> {
  const posts = await fetchPublicNotifications(limit);
  // console.log(`[bridge] Push Protocol: ${posts.length} notifications`);
  return posts;
}

export const fetch = fetchPushPosts;

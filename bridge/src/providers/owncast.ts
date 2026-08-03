/**
 * Owncast Provider
 *
 * Fetches live stream status and stream metadata from Owncast instances.
 * Owncast is a self-hosted live streaming platform with ActivityPub federation.
 *
 * API: REST at /api/
 *   GET /api/status — server/stream status
 *   GET /api/info — server information
 *   GET /api/chat/users — connected chat users
 *
 * Strategy:
 * 1. API from DegenFeed Owncast fork
 * 2. Known public Owncast instances
 * 3. Webhook-based stream event tracking
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const OWNCAST_INSTANCES = [
  { url: 'http://127.0.0.1:8092', name: 'DegenFeed Live' },
  { url: 'https://watch.owncast.online', name: 'Owncast Directory' },
  { url: 'https://live.andy.gg', name: "Andy's Live" },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface OwncastStatus {
  online: boolean;
  viewerCount?: number;
  streamTitle?: string;
  streamDescription?: string;
  startTime?: string;
  lastConnectTime?: string;
  lastDisconnectTime?: string;
  name?: string;
  summary?: string;
}

interface OwncastServerInfo {
  name: string;
  summary: string;
  description?: string;
  version?: string;
  nsfw?: boolean;
  tags?: string[];
  logo?: string;
  socialHandles?: Array<{ platform: string; url: string }>;
}

/** Structured live-stream entry returned by the /api/feed/live aggregator. */
export interface OwncastLiveStream {
  platform: 'owncast';
  title: string;
  viewers: number;
  thumbnail: string;
  url: string;
  online: boolean;
  streamer: string;
  startedAt?: number;
  lastConnectTime?: string;
  lastDisconnectTime?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessStreamNiches(title: string, desc: string): string[] {
  const lower = `${title} ${desc}`.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi|nft|trading)\b/.test(lower))
    n.push('crypto');
  if (/\b(ai|llm|artificial|intelligence|machine|deep)\b/.test(lower)) n.push('ai');
  if (/\b(code|programming|dev|hackathon|opensource|github)\b/.test(lower)) n.push('coding');
  if (/\b(gaming|game|play|stream|esports|twitch)\b/.test(lower)) n.push('gaming');
  if (/\b(music|dj|live|concert|performance|audio)\b/.test(lower)) n.push('music');
  if (/\b(talk|podcast|interview|discussion|debate)\b/.test(lower)) n.push('talk');
  if (/\b(news|politics|current|events|analysis)\b/.test(lower)) n.push('news');
  if (/\b(tech|technology|review|tutorial|howto|guide)\b/.test(lower)) n.push('tech');
  if (n.length === 0) n.push('streaming');
  return n;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function owncastStatusToPost(
  status: OwncastStatus,
  info: OwncastServerInfo,
  instance: { url: string; name: string },
): UnifiedPost {
  const title = status.streamTitle || (status.online ? '🔴 Live!' : '📡 Offline');
  const viewerCount = status.viewerCount || 0;
  const instanceName = info.name || instance.name;
  const thumbnailUrl = info.logo ? `${instance.url}${info.logo}` : `${instance.url}/thumbnail.jpg`;
  const streamUrl = status.online ? `${instance.url}/hls/stream.m3u8` : instance.url;

  const lastStreamInfo = status.lastConnectTime || status.lastDisconnectTime;
  const text = status.online
    ? [
        `🔴 **LIVE** — ${title}`,
        status.streamDescription || '',
        `👁️ ${viewerCount} watching`,
        `📺 ${instanceName}`,
        `▶️ ${streamUrl}`,
      ]
        .filter(Boolean)
        .join('\n')
    : `📡 ${instanceName} is offline.\nLast stream: ${lastStreamInfo || 'N/A'}\n🎬 Last title: ${title}`;

  return {
    id: `owncast:status:${instance.url}:${Date.now()}`,
    protocol: 'owncast',
    author: {
      id: `owncast:${instance.url}`,
      primary: { protocol: 'owncast', id: instance.url },
      handles: { owncast: instanceName },
      displayName: instanceName,
      bio: info.summary || '',
      avatarUrl: thumbnailUrl,
      followerCount: 0,
      followingCount: 0,
      links: (info.socialHandles || []).map((h) => ({ label: h.platform, url: h.url })),
      keys: {},
    },
    text,
    embeds: [
      { kind: 'link', url: `${instance.url}/` },
      ...(thumbnailUrl ? [{ kind: 'image', url: thumbnailUrl }] : []),
      ...(status.online ? [{ kind: 'video', url: streamUrl }] : []),
    ],
    contentType: status.online ? 'live' : 'offline',
    createdAt: status.startTime ? new Date(status.startTime).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: viewerCount },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: { status, info },
    niches: guessStreamNiches(title, status.streamDescription || ''),
  };
}

/**
 * Fetch structured live-stream entries for the /api/feed/live aggregator.
 * Returns one entry per instance (including offline instances, flagged with
 * `online: false` and last-stream metadata).
 */
export async function fetchOwncastLiveStreams(limit = 10): Promise<OwncastLiveStream[]> {
  const results = await Promise.allSettled(OWNCAST_INSTANCES.map((inst) => fetchInstance(inst)));

  const streams: OwncastLiveStream[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) streams.push(r.value);
  }

  // Prefer the local instance, sort online first
  streams.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return b.viewers - a.viewers;
  });

  console.log(`[bridge] Owncast live: ${streams.length} stream(s)`);
  return streams.slice(0, limit);
}

/** Fetch raw status + config from a single Owncast instance. */
async function fetchInstanceRaw(instance: {
  url: string;
  name: string;
}): Promise<{ status: OwncastStatus; info: OwncastServerInfo } | null> {
  try {
    const [statusRes, infoRes] = await Promise.allSettled([
      $fetch(`${instance.url}/api/status`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
        signal: AbortSignal.timeout(3000),
      }),
      // Owncast v0.2.x exposes /api/config for server metadata; /api/info
      // is only available on newer builds and returns 404 here.
      $fetch(`${instance.url}/api/config`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
        signal: AbortSignal.timeout(3000),
      }),
    ]);

    if (statusRes.status !== 'fulfilled' || !statusRes.value.ok) return null;
    const status = (await statusRes.value.json()) as OwncastStatus;
    let info: OwncastServerInfo = { name: instance.name, summary: '' };
    if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
      info = { ...info, ...((await infoRes.value.json()) as OwncastServerInfo) };
    }
    return { status, info };
  } catch {
    return null;
  }
}

/** Fetch a single Owncast instance and return a structured stream entry. */
async function fetchInstance(instance: {
  url: string;
  name: string;
}): Promise<OwncastLiveStream | null> {
  const raw = await fetchInstanceRaw(instance);
  if (!raw) return null;
  const { status, info } = raw;

  const instanceName = info.name || instance.name;
  const title = status.streamTitle || instanceName;
  const thumbnailUrl = info.logo ? `${instance.url}${info.logo}` : `${instance.url}/thumbnail.jpg`;

  return {
    platform: 'owncast',
    title,
    viewers: status.viewerCount || 0,
    thumbnail: thumbnailUrl,
    url: status.online ? `${instance.url}/hls/stream.m3u8` : `${instance.url}/`,
    online: Boolean(status.online),
    streamer: instanceName,
    startedAt: status.lastConnectTime
      ? new Date(status.lastConnectTime).getTime()
      : status.startTime
        ? new Date(status.startTime).getTime()
        : undefined,
    lastConnectTime: status.lastConnectTime,
    lastDisconnectTime: status.lastDisconnectTime,
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromInstance(instance: {
  url: string;
  name: string;
}): Promise<UnifiedPost | null> {
  const raw = await fetchInstanceRaw(instance);
  if (!raw) return null;
  return owncastStatusToPost(raw.status, raw.info, instance);
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'owncast',
  name: 'Owncast',
  description: 'Self-hosted live streaming with ActivityPub federation',
  endpoint: '/api/feed/owncast',
  requiresAuth: false,
  contentType: 'live',
};

export async function fetchOwncastPosts(limit = 20): Promise<UnifiedPost[]> {
  const results = await Promise.allSettled(
    OWNCAST_INSTANCES.map((inst) => fetchFromInstance(inst)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) all.push(r.value);
  }

  console.log(`[bridge] Owncast: ${all.length} stream(s)`);
  return all.slice(0, limit);
}

export const fetch = fetchOwncastPosts;

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
  { url: 'http://127.0.0.1:8081', name: 'DegenFeed Live' },
  { url: 'https://watch.owncast.online', name: 'Owncast Directory' },
  { url: 'https://live.andy.gg', name: 'Andy's Live' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface OwncastStatus {
  online: boolean;
  viewerCount?: number;
  streamTitle?: string;
  streamDescription?: string;
  startTime?: string;
  lastConnectTime?: string;
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
  socialHandles?: Array<{ platform: string; url: string }>;
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

  const text = status.online
    ? [
        `🔴 **LIVE** — ${title}`,
        status.streamDescription || '',
        `👁️ ${viewerCount} watching`,
        `📺 ${instanceName}`,
      ]
        .filter(Boolean)
        .join('\n')
    : `📡 ${instanceName} is offline.\nLast stream: ${status.lastConnectTime || 'N/A'}`;

  return {
    id: `owncast:status:${instance.url}:${Date.now()}`,
    protocol: 'owncast',
    author: {
      id: `owncast:${instance.url}`,
      primary: { protocol: 'owncast', id: instance.url },
      handles: { owncast: instanceName },
      displayName: instanceName,
      bio: info.summary || '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: (info.socialHandles || []).map((h) => ({ label: h.platform, url: h.url })),
      keys: {},
    },
    text,
    embeds: [{ kind: 'link', url: `${instance.url}/` }],
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

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromInstance(instance: {
  url: string;
  name: string;
}): Promise<UnifiedPost | null> {
  try {
    const [statusRes, infoRes] = await Promise.allSettled([
      $fetch(`${instance.url}/api/status`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
        signal: AbortSignal.timeout(5000),
      }),
      $fetch(`${instance.url}/api/info`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (statusRes.status !== 'fulfilled' || !statusRes.value.ok) return null;
    const status = (await statusRes.value.json()) as OwncastStatus;
    let info: OwncastServerInfo = { name: instance.name, summary: '' };
    if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
      info = { ...info, ...((await infoRes.value.json()) as OwncastServerInfo) };
    }

    return owncastStatusToPost(status, info, instance);
  } catch {
    return null;
  }
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

  // Also fetch from live bridge provider for additional streams
  try {
    const { fetchLiveStreams } = await import('./live');
    const liveResult = await fetchLiveStreams();
    if (Array.isArray(liveResult.streams)) {
      for (const s of liveResult.streams) {
        all.push({
          id: `owncast:live:${s.name || Date.now()}`,
          protocol: 'owncast',
          author: {
            id: `owncast:live:${s.name || 'streamer'}`,
            primary: { protocol: 'owncast', id: s.name || 'streamer' },
            handles: { owncast: s.name || null },
            displayName: s.name || 'Live Streamer',
            bio: '',
            avatarUrl: s.thumbnail || '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: `🔴 ${s.name || 'Streamer'} is live!\n${s.title || ''}`,
          embeds: s.url ? [{ kind: 'link', url: s.url }] : [],
          contentType: 'live',
          createdAt: Date.now(),
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: s.viewers || 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: s,
          niches: ['streaming'],
        });
      }
    }
  } catch {
    // Live provider not available
  }

  console.log(`[bridge] Owncast: ${all.length} stream(s)`);
  return all.slice(0, limit);
}

export const fetch = fetchOwncastPosts;

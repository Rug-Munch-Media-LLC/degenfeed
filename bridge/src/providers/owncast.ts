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
  { url: 'https://watch.owncast.online', name: 'Owncast TV' },
  { url: 'https://tv.theindiebeat.fm', name: 'The Indie Beat TV' },
  { url: 'https://live.mustics.com', name: 'Mustics Live' },
  // Additional public Owncast instances (verified reachable 2026-08-04).
  // Each reachable instance contributes a status entry to the Owncast feed
  // and a stream entry to the /api/feed/live aggregator — boosting both
  // feeds with minimal latency (each has its own 3s timeout).
  { url: 'https://video.myocci.net', name: 'Myocci Video' },
  { url: 'https://live.smittystream.com', name: 'Smittystream Live' },
  { url: 'https://owncast.kreative-kompas.com', name: 'Kreative Kompas' },
  { url: 'https://streamlive.ntrx.top', name: 'NTRX Live' },
  { url: 'https://live.webair.xyz', name: 'WebAir Live' },
  { url: 'https://stream.bdltv.com', name: 'BDL TV' },
  { url: 'https://owncast.meowcate.space', name: 'Meowcate Space' },
  { url: 'https://owncast.home.thomsen-jones.dk', name: 'Thomsen-Jones' },
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

/** Structured upcoming-stream entry for the schedule display. */
export interface OwncastScheduledStream {
  id: string;
  title: string;
  description?: string;
  scheduledAt: number;
  durationMinutes?: number;
  thumbnail?: string;
  streamer: string;
  instanceUrl: string;
}

/** Structured past-stream archive entry. */
export interface OwncastArchiveEntry {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  url: string;
  streamedAt: number;
  durationSeconds?: number;
  streamer: string;
  instanceUrl: string;
  viewerPeak?: number;
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

  // console.log(`[bridge] Owncast live: ${streams.length} stream(s)`);
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

/**
 * Fetch the upcoming stream schedule for the local Owncast instance.
 *
 * Owncast 0.2.x does not expose a native schedule endpoint, so we derive
 * a schedule from the instance config when available and otherwise return
 * an empty list. The DegenFeed Owncast fork can expose `/api/schedule`
 * (JSON array of {title, description, startsAt, durationMinutes}) — we
 * prefer that endpoint when present.
 */
export async function fetchOwncastSchedule(
  instances: Array<{ url: string; name: string }> = OWNCAST_INSTANCES,
): Promise<OwncastScheduledStream[]> {
  const local = instances[0];
  if (!local) return [];
  const schedule: OwncastScheduledStream[] = [];

  try {
    const res = await $fetch(`${local.url}/api/schedule`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const raw = (await res.json()) as Array<{
        id?: string;
        title?: string;
        description?: string;
        startsAt?: string | number;
        scheduledAt?: string | number;
        durationMinutes?: number;
      }>;
      for (const item of Array.isArray(raw) ? raw : []) {
        const startRaw = item.startsAt ?? item.scheduledAt;
        const startMs =
          typeof startRaw === 'number'
            ? startRaw
            : typeof startRaw === 'string'
              ? new Date(startRaw).getTime()
              : NaN;
        if (!Number.isNaN(startMs)) {
          schedule.push({
            id: item.id ?? `owncast:schedule:${startMs}`,
            title: item.title || 'Upcoming Stream',
            description: item.description,
            scheduledAt: startMs,
            durationMinutes: item.durationMinutes,
            thumbnail: local.url,
            streamer: local.name,
            instanceUrl: local.url,
          });
        }
      }
      // console.log(`[bridge] Owncast schedule: ${schedule.length} upcoming stream(s)`);
      return schedule;
    }
  } catch {
    // Endpoint absent on base Owncast — fall through to config-derived schedule
  }

  // Fallback: derive a placeholder schedule from the instance config summary
  try {
    const infoRes = await $fetch(`${local.url}/api/config`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
      signal: AbortSignal.timeout(3000),
    });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as OwncastServerInfo & {
        streamTitle?: string;
      };
      const title = info.streamTitle || info.name || 'Scheduled Stream';
      // No explicit schedule data — return empty rather than fabricate times.
      // console.log('[bridge] Owncast schedule: no schedule endpoint, using empty schedule');
      return schedule;
    }
  } catch {
    // ignore
  }
  return schedule;
}

/**
 * Fetch the past-stream archive (VODs) with thumbnails.
 *
 * Base Owncast 0.2.x does not expose a public archive API, so this returns
 * an empty list unless the fork exposes `/api/video` or `/api/videos`.
 */
export async function fetchOwncastArchive(
  instances: Array<{ url: string; name: string }> = OWNCAST_INSTANCES,
): Promise<OwncastArchiveEntry[]> {
  const local = instances[0];
  if (!local) return [];
  const archive: OwncastArchiveEntry[] = [];

  for (const ep of ['/api/video', '/api/videos']) {
    try {
      const res = await $fetch(`${local.url}${ep}`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const raw = (await res.json()) as Array<{
        id?: string;
        title?: string;
        description?: string;
        thumbnail?: string;
        preview?: string;
        url?: string;
        streamedAt?: string | number;
        durationSeconds?: number;
        viewerPeak?: number;
      }>;
      for (const item of Array.isArray(raw) ? raw : []) {
        if (!item.url) continue;
        const streamedRaw = item.streamedAt;
        const streamedMs =
          typeof streamedRaw === 'number'
            ? streamedRaw
            : typeof streamedRaw === 'string'
              ? new Date(streamedRaw).getTime()
              : Date.now();
        archive.push({
          id: item.id ?? `owncast:archive:${streamedMs}`,
          title: item.title || 'Past Stream',
          description: item.description,
          thumbnail: item.thumbnail
            ? item.thumbnail.startsWith('http')
              ? item.thumbnail
              : `${local.url}${item.thumbnail}`
            : item.preview
              ? `${local.url}${item.preview}`
              : `${local.url}/thumbnail.jpg`,
          url: item.url.startsWith('http') ? item.url : `${local.url}${item.url}`,
          streamedAt: streamedMs,
          durationSeconds: item.durationSeconds,
          streamer: local.name,
          instanceUrl: local.url,
          viewerPeak: item.viewerPeak,
        });
      }
      if (archive.length > 0) break;
    } catch {
      // endpoint absent — try next
    }
  }

  // console.log(`[bridge] Owncast archive: ${archive.length} past stream(s)`);
  return archive;
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

  // console.log(`[bridge] Owncast: ${all.length} stream(s)`);
  return all.slice(0, limit);
}

export const fetch = fetchOwncastPosts;

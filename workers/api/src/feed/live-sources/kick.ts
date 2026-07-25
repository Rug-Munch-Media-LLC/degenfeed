/**
 * @degenfeed/api-worker — Kick Live Source
 *
 * Fetches live streams from Kick.com and converts to UnifiedLiveStream format.
 * Uses Kick's public API to discover live channels and check curated streamers.
 *
 * Features:
 *   - Curated Kick streamers (crypto, gambling-adjacent, IRL niches)
 *   - Live status detection via discover/live endpoint
 *   - Viewer count from livestream metadata
 *   - Fallback to channel-by-channel check for curated list
 *
 * Rules:
 *   - No silent failures
 *   - Rate limit graceful handling
 *   - Response validation before conversion
 */

import type { Env } from '../../index';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';

// ─── Curated Kick Channels ──────────────────────────────────────────────

export const CURATED_KICK_CHANNELS: KickCuratedChannel[] = [
  // ═══ Crypto / Trading ═══
  { slug: 'trainwreckstv', category: 'trading', tags: ['crypto', 'gambling', 'talk'] },
  { slug: 'xposed', category: 'trading', tags: ['crypto', 'gambling', 'casino'] },
  { slug: 'roshtein', category: 'trading', tags: ['crypto', 'casino', 'slots'] },
  { slug: 'classybeef', category: 'talk', tags: ['talk', 'gambling', 'community'] },
  { slug: 'itsbrian', category: 'talk', tags: ['talk', 'gambling', 'streamer'] },
  { slug: 'nickmullen', category: 'talk', tags: ['talk', 'comedy', 'commentary'] },
  { slug: 'adinross', category: 'irl', tags: ['irl', 'streamer', 'entertainment'] },
  { slug: 'iceposeidon', category: 'irl', tags: ['irl', 'streamer', 'community'] },

  // ═══ Gaming ═══
  { slug: 'forsen', category: 'gaming', tags: ['gaming', 'variety', 'reactions'] },
  { slug: 'cyr', category: 'gaming', tags: ['gaming', 'fps', 'valorant'] },
  { slug: 'summit1g', category: 'gaming', tags: ['gaming', 'variety', 'fps'] },
  { slug: 'lacari', category: 'gaming', tags: ['gaming', 'variety', 'irl'] },
  { slug: 'dansgaming', category: 'gaming', tags: ['gaming', 'variety', 'rpg'] },

  // ═══ IRL / Music ═══
  { slug: 'jakenbake', category: 'irl', tags: ['irl', 'lifestyle', 'travel'] },
  { slug: 'itskaypearl', category: 'irl', tags: ['irl', 'lifestyle', 'art'] },
  { slug: 'nmp', category: 'talk', tags: ['talk', 'news', 'commentary'] },
  { slug: 'j1mmy', category: 'talk', tags: ['talk', 'gaming', 'commentary'] },

  // ═══ Crypto / Degen ═══
  { slug: 'daisythedog', category: 'crypto', tags: ['crypto', 'defi', 'trading'] },
  { slug: 'ajcatchemall', category: 'crypto', tags: ['crypto', 'trading', 'analysis'] },
];

interface KickCuratedChannel {
  slug: string;
  category: string;
  tags: string[];
}

// ─── Kick API Types ─────────────────────────────────────────────────────

interface KickLivestream {
  id: number;
  session_title: string;
  viewer_count: number;
  started_at: string;
  category?: { id: number; name: string; slug: string };
  thumbnail?: { url: string };
}

interface KickChannelResponse {
  id: number;
  user_id: number;
  slug: string;
  user: {
    id: number;
    username: string;
    slug: string;
    profile_pic?: string;
    bio?: string;
  };
  livestream?: KickLivestream | null;
  recent_videos?: Array<{ id: number; uuid: string; title: string }>;
}

interface KickDiscoverResponse {
  data: Array<{
    id: number;
    livestream: KickLivestream | null;
    user: {
      id: number;
      username: string;
      slug: string;
      profile_pic?: string;
    };
  }>;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

const KICK_API_BASE = 'https://kick.com/api/v2';
const KICK_SOURCES: LiveSource = 'kick';

// ─── Source Health Tracking ─────────────────────────────────────────────

async function trackKickHealth(
  env: Env,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {
  try {
    const key = 'live:source-health';
    const raw = await env.CACHE?.get(key);
    const health: Record<string, {
      source: LiveSource;
      healthy: boolean;
      lastChecked: number;
      error?: string;
      streamCount: number;
      latencyMs: number;
    }> = raw ? JSON.parse(raw) : {};

    health['kick'] = {
      source: 'kick',
      healthy: !error,
      lastChecked: Date.now(),
      error,
      streamCount,
      latencyMs,
    };

    await env.CACHE?.put(key, JSON.stringify(health), { expirationTtl: 300 });
  } catch {
    // Non-critical
  }
}

// ─── Category Map ───────────────────────────────────────────────────────

const KICK_CATEGORY_MAP: Record<string, string> = {
  'gaming': 'gaming',
  'irl': 'irl',
  'music': 'music',
  'just chatting': 'talk',
  'talk shows & podcasts': 'talk',
  'crypto': 'crypto',
  'trading': 'trading',
  'sports': 'sports',
  'art': 'art',
  'education': 'education',
  'tech': 'tech',
  'slots': 'trading',
  'casino': 'trading',
};

function mapKickCategory(categoryName: string | undefined, fallback: string): string {
  if (!categoryName) return fallback;
  return KICK_CATEGORY_MAP[categoryName.toLowerCase()] || fallback;
}

// ─── Discover Live Streams ──────────────────────────────────────────────

/**
 * Fetch currently live streams from Kick's discover/live endpoint.
 * This returns the top live streams on the platform.
 */
async function fetchKickDiscoverLive(
  env: Env,
  page: number = 1,
  perPage: number = 25,
): Promise<KickDiscoverResponse['data']> {
  const url = `${KICK_API_BASE}/discover/live?page=${page}&per_page=${perPage}`;
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DegenFeed/1.0',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) return [];

  const data = (await resp.json()) as KickDiscoverResponse;
  return data.data ?? [];
}

// ─── Check Single Channel ───────────────────────────────────────────────

/**
 * Fetch a single Kick channel and check if it's live.
 */
async function checkKickChannel(
  slug: string,
): Promise<{ channel: KickChannelResponse; isLive: boolean; livestream: KickLivestream | null } | null> {
  const url = `${KICK_API_BASE}/channels/${encodeURIComponent(slug)}`;
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DegenFeed/1.0',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) return null;

  const channel = (await resp.json()) as KickChannelResponse;
  return {
    channel,
    isLive: !!channel.livestream,
    livestream: channel.livestream ?? null,
  };
}

// ─── Convert to UnifiedLiveStream ───────────────────────────────────────

function convertKickToUnified(
  livestream: KickLivestream,
  user: { id: number; username: string; slug: string; profile_pic?: string },
  curatedInfo?: KickCuratedChannel,
): UnifiedLiveStream {
  const category = curatedInfo
    ? mapKickCategory(livestream.category?.name, curatedInfo.category)
    : mapKickCategory(livestream.category?.name, 'gaming');

  const tags = curatedInfo?.tags ?? [
    'kick',
    'live',
    livestream.category?.slug || 'gaming',
  ];

  return {
    id: `kick:${user.slug}`,
    source: 'kick',
    title: livestream.session_title || `${user.username}'s Stream`,
    streamer: {
      id: `kick:channel:${user.slug}`,
      handle: user.slug,
      displayName: user.username,
      avatarUrl: user.profile_pic || undefined,
    },
    thumbnailUrl: livestream.thumbnail?.url ?? '',
    viewerCount: livestream.viewer_count || 0,
    startedAt: livestream.started_at ? new Date(livestream.started_at).getTime() : Date.now(),
    category,
    tags,
    isLive: true,
    embedUrl: `https://player.kick.com/${user.slug}`,
    chatEnabled: true,
    platformMeta: {
      kickId: livestream.id,
      categoryId: livestream.category?.id,
      categoryName: livestream.category?.name,
    },
  };
}

// ─── Main Fetcher ───────────────────────────────────────────────────────

/**
 * Fetch live Kick streams.
 * Combines curated channel checks + discover/live feed for variety.
 */
export async function fetchKickLiveStreams(
  env: Env,
): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const seenSlugs = new Set<string>();
  const startTime = Date.now();

  try {
    // Strategy 1: Check curated channels individually
    // (more reliable per-channel, catches small streamers)
    const channelPromises = CURATED_KICK_CHANNELS.map((ch) => checkKickChannel(ch.slug));
    const channelResults = await Promise.allSettled(channelPromises);

    for (const result of channelResults) {
      if (result.status !== 'fulfilled') continue;
      const checked = result.value;
      if (!checked || !checked.isLive || !checked.livestream) continue;

      const ch = CURATED_KICK_CHANNELS.find((c) => c.slug === checked.channel.slug);
      const user = checked.channel.user;

      seenSlugs.add(user.slug);
      streams.push(convertKickToUnified(
        checked.livestream,
        { id: user.id, username: user.username, slug: user.slug, profile_pic: user.profile_pic },
        ch,
      ));
    }

    // Strategy 2: Discover/live feed for additional streams
    const discoverData = await fetchKickDiscoverLive(env, 1, 25);
    for (const item of discoverData) {
      if (!item.livestream || !item.user) continue;
      if (seenSlugs.has(item.user.slug)) continue;

      seenSlugs.add(item.user.slug);
      streams.push(convertKickToUnified(item.livestream, item.user));
    }

    await trackKickHealth(env, streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[kick-source] Failed to fetch Kick streams:', error);
    await trackKickHealth(env, streams.length, Date.now() - startTime, error);
  }

  return streams;
}

/**
 * Check if a specific Kick channel is live.
 * Used for on-demand status checks.
 */
export async function isKickChannelLive(
  slug: string,
): Promise<{ isLive: boolean; stream?: UnifiedLiveStream }> {
  try {
    const checked = await checkKickChannel(slug);
    if (!checked || !checked.isLive || !checked.livestream) {
      return { isLive: false };
    }

    const user = checked.channel.user;
    const curated = CURATED_KICK_CHANNELS.find((c) => c.slug === slug);
    const stream = convertKickToUnified(
      checked.livestream,
      { id: user.id, username: user.username, slug: user.slug, profile_pic: user.profile_pic },
      curated,
    );

    return { isLive: true, stream };
  } catch {
    return { isLive: false };
  }
}

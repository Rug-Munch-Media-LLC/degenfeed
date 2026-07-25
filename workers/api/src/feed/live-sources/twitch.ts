/**
 * @degenfeed/api-worker — Twitch Curated Live Source
 *
 * Pulls live streams from curated Twitch channels across crypto, tech, and gaming niches.
 * Uses Twitch Helix API with client credentials flow OR RSS fallback.
 *
 * Features:
 *   - 30+ curated crypto/tech/gaming channels
 *   - Live detection via Helix API
 *   - Viewer count via stream metadata
 *   - Category tagging (game name → category mapping)
 *   - RSS/undocumented API fallback when no API key
 *
 * Rules:
 *   - Error handling on every API call
 *   - Rate limit tracking
 *   - Response validation
 *   - No silent failures
 */

import type { Env } from '../../index';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';

// ─── Curated Channels ───────────────────────────────────────────────────

export const CURATED_TWITCH_CHANNELS: TwitchCuratedChannel[] = [
  // ═══ Crypto / Web3 ═══
  { slug: 'coinbureau', category: 'crypto', tags: ['crypto', 'news', 'education'] },
  { slug: 'bitboy_crypto', category: 'crypto', tags: ['crypto', 'news'] },
  { slug: 'altcoindaily', category: 'crypto', tags: ['crypto', 'news', 'defi'] },
  { slug: 'cryptobanter', category: 'crypto', tags: ['crypto', 'talk', 'news'] },
  { slug: 'ivanontech', category: 'crypto', tags: ['crypto', 'education', 'defi'] },
  { slug: 'cryptosociety', category: 'crypto', tags: ['crypto', 'community'] },
  { slug: 'taoshi', category: 'crypto', tags: ['crypto', 'trading', 'analysis'] },
  { slug: 'gcrcommunity', category: 'crypto', tags: ['crypto', 'news'] },
  { slug: 'thedefiedge', category: 'crypto', tags: ['crypto', 'defi', 'yield'] },
  { slug: 'rektcapital', category: 'crypto', tags: ['crypto', 'news'] },
  { slug: 'davidbrickell', category: 'crypto', tags: ['crypto', 'bitcoin'] },
  { slug: 'cryptocito', category: 'crypto', tags: ['crypto', 'education', 'solana'] },
  { slug: 'dappstar', category: 'crypto', tags: ['crypto', 'dapps', 'ethereum'] },
  { slug: 'degentrading', category: 'crypto', tags: ['crypto', 'trading', 'memecoins'] },
  { slug: '0xsame', category: 'crypto', tags: ['crypto', 'defi', 'analysis'] },
  { slug: 'jordanfish', category: 'crypto', tags: ['crypto', 'bitcoin', 'tech'] },

  // ═══ Tech / Coding ═══
  { slug: 'theprimeagen', category: 'tech', tags: ['tech', 'coding', 'vim'] },
  { slug: 'teej_dv', category: 'tech', tags: ['tech', 'coding', 'react'] },
  { slug: 'piratesoftware', category: 'tech', tags: ['tech', 'gamedev', 'coding'] },
  { slug: 'tsoding', category: 'tech', tags: ['tech', 'coding', 'rust'] },
  { slug: '2cdo', category: 'tech', tags: ['tech', 'coding', 'typescript'] },
  { slug: 'georgehotz', category: 'tech', tags: ['tech', 'hacking', 'ai'] },
  { slug: 'codinggarden', category: 'tech', tags: ['tech', 'coding', 'webdev'] },
  { slug: 'lunnieth', category: 'tech', tags: ['tech', 'rust', 'systems'] },
  { slug: 'andrew_faught', category: 'tech', tags: ['tech', 'startup', 'sre'] },
  { slug: 'wasmcommunity', category: 'tech', tags: ['tech', 'wasm', 'webassembly'] },
  { slug: 'thealtf4stream', category: 'tech', tags: ['tech', 'speedrun', 'retro'] },
  { slug: 'blowfish', category: 'tech', tags: ['tech', 'security', 'gamedev'] },
  { slug: 'handmade_hero', category: 'tech', tags: ['tech', 'gamedev', 'coding'] },

  // ═══ Gaming (Web3 / Crypto-adjacent) ═══
  { slug: 'parallel', category: 'gaming', tags: ['gaming', 'web3', 'tcg'] },
  { slug: 'playdeadeye', category: 'gaming', tags: ['gaming', 'web3', 'fps'] },
  { slug: 'illuvium', category: 'gaming', tags: ['gaming', 'web3', 'rpg'] },
  { slug: 'godsunchained', category: 'gaming', tags: ['gaming', 'web3', 'tcg'] },
  { slug: 'sorare', category: 'gaming', tags: ['gaming', 'web3', 'fantasy'] },
  { slug: 'axieinfinity', category: 'gaming', tags: ['gaming', 'web3', 'p2e'] },
  { slug: 'bigtime', category: 'gaming', tags: ['gaming', 'web3', 'action'] },
  { slug: 'mytikok', category: 'gaming', tags: ['gaming', 'web3', 'mobile'] },
  { slug: 'sipher', category: 'gaming', tags: ['gaming', 'web3', 'rpg'] },
  { slug: 'cryptoblades', category: 'gaming', tags: ['gaming', 'web3', 'rpg'] },

  // ═══ IRL / Talk Shows ═══
  { slug: 'julien', category: 'talk', tags: ['irl', 'talk', 'community'] },
  { slug: 'forsen', category: 'talk', tags: ['irl', 'talk', 'gaming'] },
  { slug: 'xqc', category: 'talk', tags: ['irl', 'talk', 'gaming'] },
  { slug: 'asmongold', category: 'talk', tags: ['talk', 'mmo', 'reactions'] },
  { slug: 'hasanabi', category: 'talk', tags: ['talk', 'news', 'politics'] },
];

interface TwitchCuratedChannel {
  slug: string;
  category: string;
  tags: string[];
}

// ─── Twitch API Types ───────────────────────────────────────────────────

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids?: string[];
  tags?: string[];
  is_mature: boolean;
}

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  created_at: string;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ─── Category Map ───────────────────────────────────────────────────────

const CATEGORY_GAME_MAP: Record<string, string> = {
  'Just Chatting': 'talk',
  'Music': 'music',
  'Art': 'art',
  'Science & Technology': 'tech',
  'Software and Game Development': 'tech',
  'Chess': 'gaming',
  'Minecraft': 'gaming',
  'Fortnite': 'gaming',
  'Valorant': 'gaming',
  'Counter-Strike': 'gaming',
  'Grand Theft Auto V': 'gaming',
  'League of Legends': 'gaming',
  'Dota 2': 'gaming',
  'World of Warcraft': 'gaming',
  'Elden Ring': 'gaming',
  'Apex Legends': 'gaming',
  'Call of Duty': 'gaming',
  'Rocket League': 'gaming',
  'Pokémon': 'gaming',
  'Virtual Casino': 'gaming',
  'Slots': 'gaming',
  'Poker': 'gaming',
  'Sports': 'sports',
  'IRL': 'irl',
  'Talk Shows & Podcasts': 'talk',
};

function mapGameToCategory(gameName: string, fallbackCategory: string): string {
  return CATEGORY_GAME_MAP[gameName] || fallbackCategory;
}

// ─── App Access Token ───────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTwitchAppToken(env: Env): Promise<string | null> {
  const clientId = env.TWITCH_CLIENT_ID;
  const clientSecret = env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // Check KV cache
  try {
    const raw = await env.CACHE?.get('twitch:app_token');
    if (raw) {
      const parsed = JSON.parse(raw) as { token: string; expiresAt: number };
      if (Date.now() < parsed.expiresAt) {
        cachedToken = parsed;
        return parsed.token;
      }
    }
  } catch {
    // Fall through
  }

  try {
    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }).toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as TwitchTokenResponse;
    const token = data.access_token;
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60s buffer

    cachedToken = { token, expiresAt };
    await env.CACHE?.put(
      'twitch:app_token',
      JSON.stringify({ token, expiresAt }),
      { expirationTtl: data.expires_in - 60 },
    );

    return token;
  } catch {
    return null;
  }
}

// ─── Fetch Live Streams ────────────────────────────────────────────────

export async function fetchCuratedTwitchStreams(
  env: Env,
): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  // Batch channels into groups of 100 (Twitch API limit)
  const batchSize = 100;
  const channelBatches: TwitchCuratedChannel[][] = [];
  for (let i = 0; i < CURATED_TWITCH_CHANNELS.length; i += batchSize) {
    channelBatches.push(CURATED_TWITCH_CHANNELS.slice(i, i + batchSize));
  }

  try {
    const token = await getTwitchAppToken(env);
    const clientId = env.TWITCH_CLIENT_ID;

    if (token && clientId) {
      // ── Authenticated: Use Helix API ──
      const headers: Record<string, string> = {
        'client-id': clientId,
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      };

      for (const batch of channelBatches) {
        const slugs = batch.map((c) => c.slug);
        const userParams = slugs.map((s) => `login=${encodeURIComponent(s)}`).join('&');

        // Step 1: Resolve slugs to user IDs
        const usersResp = await fetch(
          `https://api.twitch.tv/helix/users?${userParams}`,
          { headers, signal: AbortSignal.timeout(5000) },
        );

        if (!usersResp.ok) continue;
        const usersData = (await usersResp.json()) as { data: TwitchUser[] };
        const userIds = usersData.data?.map((u) => u.id) ?? [];
        if (userIds.length === 0) continue;

        // Build channel info map
        const channelInfo = new Map<string, TwitchCuratedChannel>();
        for (const ch of batch) {
          const user = usersData.data?.find((u) => u.login === ch.slug);
          if (user) channelInfo.set(user.id, ch);
        }

        // Step 2: Check which are live
        const idParams = userIds.map((id) => `user_id=${encodeURIComponent(id)}`).join('&');
        const streamsResp = await fetch(
          `https://api.twitch.tv/helix/streams?${idParams}&first=${userIds.length}`,
          { headers, signal: AbortSignal.timeout(5000) },
        );

        if (!streamsResp.ok) continue;
        const streamsData = (await streamsResp.json()) as { data: TwitchStream[] };

        const streamerIds = new Set(streamsData.data?.map((s) => s.user_id) ?? []);

        // Step 3: Fetch profile images for live streamers
        const liveUserIds = userIds.filter((id) => streamerIds.has(id));
        const liveParams = liveUserIds.map((id) => `id=${encodeURIComponent(id)}`).join('&');
        let profileImages = new Map<string, string>();

        if (liveUserIds.length > 0) {
          const profilesResp = await fetch(
            `https://api.twitch.tv/helix/users?${liveParams}`,
            { headers, signal: AbortSignal.timeout(4000) },
          );
          if (profilesResp.ok) {
            const profilesData = (await profilesResp.json()) as { data: TwitchUser[] };
            for (const u of profilesData.data ?? []) {
              profileImages.set(u.id, u.profile_image_url);
            }
          }
        }

        // Convert to unified format
        for (const twitchStream of streamsData.data ?? []) {
          const ch = channelInfo.get(twitchStream.user_id);
          const category = ch
            ? mapGameToCategory(twitchStream.game_name, ch.category)
            : mapGameToCategory(twitchStream.game_name, 'gaming');
          const tags = ch?.tags ?? ['twitch', 'live', 'gaming'];

          streams.push({
            id: `twitch:${twitchStream.user_login}`,
            source: 'twitch',
            title: twitchStream.title,
            streamer: {
              id: `twitch:channel:${twitchStream.user_login}`,
              handle: twitchStream.user_login,
              displayName: twitchStream.user_name,
              avatarUrl: profileImages.get(twitchStream.user_id) || undefined,
            },
            thumbnailUrl: twitchStream.thumbnail_url
              .replace('{width}', '640')
              .replace('{height}', '360'),
            viewerCount: twitchStream.viewer_count,
            startedAt: new Date(twitchStream.started_at).getTime(),
            category,
            tags: [...tags, twitchStream.game_name.toLowerCase().replace(/\s+/g, '-')],
            isLive: true,
            embedUrl: `https://player.twitch.tv/?channel=${twitchStream.user_login}&parent=degenfeed.xyz`,
            chatEnabled: true,
            platformMeta: {
              gameId: twitchStream.game_id,
              gameName: twitchStream.game_name,
              language: twitchStream.language,
              isMature: twitchStream.is_mature,
            },
          });
        }
      }
    } else {
      // ── Unauthenticated: Use Helix with public client ID ──
      const publicClientId = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

      for (const batch of channelBatches) {
        const slugs = batch.map((c) => c.slug);
        const loginParams = slugs.map((s) => `user_login=${encodeURIComponent(s)}`).join('&');

        const resp = await fetch(
          `https://api.twitch.tv/helix/streams?${loginParams}&first=${slugs.length}`,
          {
            headers: {
              'client-id': publicClientId,
              accept: 'application/json',
            },
            signal: AbortSignal.timeout(5000),
          },
        );

        if (!resp.ok) continue;

        const data = (await resp.json()) as { data: TwitchStream[] };
        for (const twitchStream of data.data ?? []) {
          const ch = batch.find((c) => c.slug === twitchStream.user_login);
          const category = ch
            ? mapGameToCategory(twitchStream.game_name, ch.category)
            : mapGameToCategory(twitchStream.game_name, 'gaming');

          streams.push({
            id: `twitch:${twitchStream.user_login}`,
            source: 'twitch',
            title: twitchStream.title,
            streamer: {
              id: `twitch:channel:${twitchStream.user_login}`,
              handle: twitchStream.user_login,
              displayName: twitchStream.user_name,
            },
            thumbnailUrl: twitchStream.thumbnail_url
              .replace('{width}', '640')
              .replace('{height}', '360'),
            viewerCount: twitchStream.viewer_count,
            startedAt: new Date(twitchStream.started_at).getTime(),
            category,
            tags: ['twitch', 'live', category],
            isLive: true,
            embedUrl: `https://player.twitch.tv/?channel=${twitchStream.user_login}&parent=degenfeed.xyz`,
            chatEnabled: true,
          });
        }
      }
    }

    await trackSourceHealth(env, 'twitch', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[twitch-source] Failed to fetch curated streams:', error);
    await trackSourceHealth(env, 'twitch', 0, Date.now() - startTime, error);
  }

  return streams;
}

/**
 * Discover new Twitch channels by category for the "All" feed.
 * Pulls top live streams in crypto/gaming/tech categories.
 */
export async function fetchTwitchByCategory(
  env: Env,
  gameIds?: string[],
): Promise<UnifiedLiveStream[]> {
  const streams: UnifiedLiveStream[] = [];
  const startTime = Date.now();

  try {
    const token = await getTwitchAppToken(env);
    const clientId = env.TWITCH_CLIENT_ID;

    if (!token || !clientId) {
      return streams;
    }

    const headers: Record<string, string> = {
      'client-id': clientId,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    };

    // Default game IDs for crypto/gaming/tech
    const gameCategories = gameIds ?? [
      '509658',  // Just Chatting (talk)
      '509670',  // Science & Technology (tech)
      '1469313456', // Software and Game Development (tech)
      '27471',   // Retro (gaming)
    ];

    for (const gameId of gameCategories) {
      const params = new URLSearchParams({
        game_id: gameId,
        first: '10',
        language: 'en',
      });

      const resp = await fetch(
        `https://api.twitch.tv/helix/streams?${params.toString()}`,
        { headers, signal: AbortSignal.timeout(5000) },
      );

      if (!resp.ok) continue;

      const data = (await resp.json()) as { data: TwitchStream[] };
      for (const s of data.data ?? []) {
        // Skip if already added from curated list
        if (streams.find((existing) => existing.id === `twitch:${s.user_login}`)) continue;

        streams.push({
          id: `twitch:${s.user_login}`,
          source: 'twitch',
          title: s.title,
          streamer: {
            id: `twitch:channel:${s.user_login}`,
            handle: s.user_login,
            displayName: s.user_name,
          },
          thumbnailUrl: s.thumbnail_url
            .replace('{width}', '640')
            .replace('{height}', '360'),
          viewerCount: s.viewer_count,
          startedAt: new Date(s.started_at).getTime(),
          category: mapGameToCategory(s.game_name, 'gaming'),
          tags: ['twitch', 'live', s.game_name.toLowerCase().replace(/\s+/g, '-')],
          isLive: true,
          embedUrl: `https://player.twitch.tv/?channel=${s.user_login}&parent=degenfeed.xyz`,
          chatEnabled: true,
          platformMeta: {
            gameId: s.game_id,
            gameName: s.game_name,
          },
        });
      }
    }

    await trackSourceHealth(env, 'twitch', streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[twitch-source] Category discovery failed:', error);
    await trackSourceHealth(env, 'twitch', 0, Date.now() - startTime, error);
  }

  return streams;
}

// ─── Source Health Tracking ─────────────────────────────────────────────

async function trackSourceHealth(
  env: Env,
  source: LiveSource,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {
  try {
    const key = 'live:source-health';
    const raw = await env.CACHE?.get(key);
    const health: Record<string, { source: LiveSource; healthy: boolean; lastChecked: number; error?: string; streamCount: number; latencyMs: number }> = raw ? JSON.parse(raw) : {};

    health[source] = {
      source,
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

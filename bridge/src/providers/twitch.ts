/**
 * Twitch Provider — Live Streams & Clips
 *
 * Twitch is the largest live-streaming platform for gaming, music, and
 * creative content. 30M+ daily active users.
 *
 * What it adds: Live stream notifications, trending clips, gaming content
 * API: Twitch Helix API (requires OAuth client_credentials grant)
 * Rate limit: 800 req/s (with token)
 *
 * Set env: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const TWITCH_API = 'https://api.twitch.tv/helix';
const TWITCH_AUTH = 'https://id.twitch.tv/oauth2/token';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

const TWITCH_GAMES = [
  '509658', // Just Chatting
  '516575', // Crypto & Web3 (or use search)
  '21779', // Music & Performing Arts
  '26936', // Music
  '509670', // Software & Game Dev
  '1469304963', // Art
];

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expires_at > Date.now()) return cachedToken.access_token;
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;

  try {
    const res = await $fetch(TWITCH_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    });
    if (!res.ok) return null;
    const json = await res.json();
    cachedToken = {
      access_token: json.access_token,
      expires_at: Date.now() + (json.expires_in - 60) * 1000,
    };
    return cachedToken.access_token;
  } catch {
    return null;
  }
}

function getHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Client-ID': TWITCH_CLIENT_ID || 'DegenFeed',
    'User-Agent': 'DegenFeed-Bridge/0.1',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

interface TwitchStream {
  id: string;
  user_id: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  language: string;
  is_mature: boolean;
  tags?: string[];
}

interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_name: string;
  creator_name: string;
  game_name: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod?: { id?: string; url?: string };
}

async function fetchLiveStreams(token: string | null): Promise<UnifiedPost[]> {
  try {
    const streams: TwitchStream[] = [];
    for (const gameId of TWITCH_GAMES) {
      const url = `${TWITCH_API}/streams?game_id=${gameId}&first=5`;
      const res = await $fetch(url, { headers: getHeaders(token) });
      if (res.ok) {
        const json = await res.json();
        if (json.data) streams.push(...json.data);
      }
    }

    return streams.slice(0, 20).map((s) => ({
      id: `twitch-stream-${s.id}`,
      protocol: 'twitch',
      author: {
        id: `twitch:${s.user_id}`,
        primary: { protocol: 'twitch', id: s.user_id },
        handles: { twitch: s.user_name },
        displayName: s.user_name,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: `🔴 LIVE: ${s.title}`,
      html: `<p>${s.title}</p><p>Playing ${s.game_name} — ${s.viewer_count} viewers</p>`,
      embeds: [
        {
          kind: 'image' as const,
          url: s.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
        },
      ],
      createdAt: new Date(s.started_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: s.viewer_count },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: ['live', 'streaming', s.game_name?.toLowerCase() ?? 'gaming'],
      contentType: 'live',
    }));
  } catch {
    return [];
  }
}

async function fetchClips(token: string | null): Promise<UnifiedPost[]> {
  try {
    const allClips: TwitchClip[] = [];
    for (const gameId of TWITCH_GAMES) {
      const url = `${TWITCH_API}/clips?game_id=${gameId}&first=5&ended_at=${new Date().toISOString()}`;
      const res = await $fetch(url, { headers: getHeaders(token) });
      if (res.ok) {
        const json = await res.json();
        if (json.data) allClips.push(...json.data);
      }
    }

    return allClips.slice(0, 20).map((clip) => ({
      id: `twitch-clip-${clip.id}`,
      protocol: 'twitch',
      author: {
        id: `twitch-clipper:${clip.creator_name}`,
        primary: { protocol: 'twitch', id: clip.creator_name },
        handles: { twitch: clip.creator_name },
        displayName: clip.creator_name,
        bio: `${clip.game_name} streamer`,
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: `🎬 Clip: ${clip.title}${clip.duration ? ` (${Math.round(clip.duration)}s)` : ''}`,
      html: `<p>${clip.title} — ${clip.view_count} views</p>`,
      embeds: [
        { kind: 'image' as const, url: clip.thumbnail_url },
        { kind: 'link' as const, url: clip.url },
      ],
      createdAt: new Date(clip.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: clip.view_count },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: clip,
      niches: ['gaming', 'clips', 'live', clip.game_name?.toLowerCase() ?? 'gaming'],
      contentType: 'video',
    }));
  } catch {
    return [];
  }
}

export async function fetchTwitchPosts(limit: number = 20): Promise<UnifiedPost[]> {
  const key = 'provider:twitch';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  const token = await getToken();
  const [streams, clips] = await Promise.all([fetchLiveStreams(token), fetchClips(token)]);

  const combined = [...streams, ...clips];
  return combined.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'twitch',
  name: 'Twitch',
  description: 'Live streams & trending clips — gaming, music, creative & IRL',
  endpoint: '/api/feed/twitch',
  requiresAuth: true,
  authEnvVar: 'TWITCH_CLIENT_ID',
  contentType: 'live',
};

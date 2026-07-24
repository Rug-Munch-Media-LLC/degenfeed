/**
 * @degenfeed/spaces-bridge — Twitch Live Bridge
 *
 * Twitch API integration for broadcasting spaces as live streams.
 *
 * API: https://dev.twitch.tv/docs/api/
 * Requires: Twitch App Access Token + Client credentials
 *
 * Environment variables:
 *   TWITCH_CLIENT_ID        — Twitch application client ID
 *   TWITCH_CLIENT_SECRET    — Twitch application client secret
 *   TWITCH_BROADCASTER_ID   — Twitch user ID to stream as
 *   TWITCH_ACCESS_TOKEN     — OAuth access token (optional, auto-refreshed)
 */

import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const TWITCH_API = 'https://api.twitch.tv/helix';
const TWITCH_AUTH = 'https://id.twitch.tv/oauth2';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET required');
  }

  const res = await fetch(`${TWITCH_AUTH}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60000,
  };
  return data.access_token;
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const twitchBridge: PlatformBridge = {
  platform: 'twitch',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
    if (!clientId || !broadcasterId) {
      throw new Error('TWITCH_CLIENT_ID and TWITCH_BROADCASTER_ID required');
    }

    const token = await getAppAccessToken();
    const headers = {
      'client-id': clientId,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };

    // Create a stream marker / set stream metadata
    // Note: Twitch doesn't have a "create stream" API — streams start via OBS/RTMP.
    // We create a "channel" with the right title and game.

    // Update channel information
    const channelRes = await fetch(`${TWITCH_API}/channels?broadcaster_id=${broadcasterId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        title: options.title,
        game_id: options.twitchGame ?? '509670', // default: "Science & Technology"
      }),
    });

    if (!channelRes.ok) {
      throw new Error(`Twitch channel update failed: ${channelRes.status}`);
    }

    return {
      platform: 'twitch',
      nativeId: broadcasterId,
      url: `https://twitch.tv/${process.env.TWITCH_BROADCASTER_LOGIN ?? broadcasterId}`,
      metadata: {
        broadcasterId,
        gameId: options.twitchGame,
        ingestUrl: 'rtmp://live.twitch.tv/app/',
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
    if (!clientId || !broadcasterId) return [];

    try {
      const token = await getAppAccessToken();
      const res = await fetch(`${TWITCH_API}/streams?user_id=${broadcasterId}`, {
        headers: {
          'client-id': clientId,
          authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        data?: Array<{
          id: string;
          user_id: string;
          user_login: string;
          user_name: string;
          title: string;
          viewer_count: number;
          started_at: string;
          thumbnail_url: string;
          game_name?: string;
        }>;
      };

      return (data.data ?? []).map((stream) => ({
        id: `twitch:${stream.id}`,
        title: stream.title,
        hostId: `twitch:${stream.user_id}`,
        hostName: stream.user_name,
        coHosts: [],
        platforms: [
          {
            platform: 'twitch',
            nativeId: stream.id,
            url: `https://twitch.tv/${stream.user_login}`,
            streamUrl: `https://player.twitch.tv/?channel=${stream.user_login}&parent=app.degenfeed.xyz`,
            metadata: {
              userId: stream.user_id,
              gameName: stream.game_name,
            },
          },
        ],
        status: 'live',
        createdAt: new Date(stream.started_at).getTime(),
        listeners: stream.viewer_count,
        speakers: [],
        reactions: [],
        tippingEnabled: true,
        thumbnailUrl: stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180'),
        tags: stream.game_name ? [stream.game_name] : [],
      }));
    } catch {
      return [];
    }
  },

  async getSpace(nativeId: string): Promise<SpaceItem | null> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return null;

    try {
      const token = await getAppAccessToken();
      const res = await fetch(`${TWITCH_API}/streams?user_id=${nativeId}`, {
        headers: {
          'client-id': clientId,
          authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { data?: Array<any> };
      if (!data.data?.[0]) return null;

      const stream = data.data[0];
      return {
        id: `twitch:${stream.id}`,
        title: stream.title,
        hostId: `twitch:${stream.user_id}`,
        hostName: stream.user_name,
        coHosts: [],
        platforms: [
          {
            platform: 'twitch',
            nativeId: stream.id,
            url: `https://twitch.tv/${stream.user_login}`,
            streamUrl: `https://player.twitch.tv/?channel=${stream.user_login}`,
          },
        ],
        status: 'live',
        createdAt: new Date(stream.started_at).getTime(),
        listeners: stream.viewer_count ?? 0,
        speakers: [],
        reactions: [],
        tippingEnabled: false,
        thumbnailUrl: stream.thumbnail_url?.replace('{width}', '320').replace('{height}', '180'),
      };
    } catch {
      return null;
    }
  },

  async endSpace(_space: SpaceItem): Promise<void> {
    // Twitch streams end when the broadcaster stops streaming
  },

  async updateSpace(space: SpaceItem): Promise<void> {
    // Update channel title if stream is live
    const clientId = process.env.TWITCH_CLIENT_ID;
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
    if (!clientId || !broadcasterId) return;

    try {
      const token = await getAppAccessToken();
      await fetch(`${TWITCH_API}/channels?broadcaster_id=${broadcasterId}`, {
        method: 'PATCH',
        headers: {
          'client-id': clientId,
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: space.title }),
      });
    } catch {
      // Non-critical
    }
  },
};

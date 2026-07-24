/**
 * @degenfeed/spaces-bridge — Kick.com Live Bridge
 *
 * Kick.com API integration for broadcasting.
 * Note: Kick's API is limited. This bridge uses the public API endpoints
 * and web scraping as fallback for stream status.
 *
 * API: https://kick.com/api/v2/
 *
 * Environment variables:
 *   KICK_CHANNEL      — Kick channel name (e.g., 'degenfeed')
 *   KICK_SESSION_TOKEN — Kick session token for authenticated requests
 *   KICK_API_KEY      — If Kick provides API keys
 */

import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Constants ───────────────────────────────────────────────────────────

const KICK_API = 'https://kick.com/api/v2';
const KICK_CDN = 'https://kick.com';

// ─── Types ───────────────────────────────────────────────────────────────

interface KickChannelResponse {
  id?: number;
  user_id?: number;
  slug?: string;
  user?: {
    id: number;
    username: string;
    slug: string;
    profile_pic?: string;
  };
  livestream?: {
    id: number;
    session_title: string;
    viewer_count: number;
    started_at: string;
    category?: { name?: string; id?: number };
    thumbnail?: { url?: string };
    playback_url?: string;
    is_live: boolean;
    tags?: string[];
  };
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const kickBridge: PlatformBridge = {
  platform: 'kick',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    const channel = process.env.KICK_CHANNEL;
    if (!channel) throw new Error('KICK_CHANNEL not configured');

    // Kick doesn't have a create-stream API via public endpoints.
    // The creator starts streaming via OBS to Kick's RTMP.
    // We can update the stream title via the API if authenticated.

    const sessionToken = process.env.KICK_SESSION_TOKEN;
    if (sessionToken && options.title) {
      try {
        // Attempt to update stream title via Kick API
        await fetch(`${KICK_API}/channels/${channel}/livestream`, {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            session_title: options.title,
            category_id: options.kickCategory ?? '509670',
          }),
        });
      } catch {
        // Non-critical — title update is best-effort
      }
    }

    return {
      platform: 'kick',
      nativeId: channel,
      url: `${KICK_CDN}/${channel}`,
      metadata: {
        channel,
        ingestUrl: 'rtmp://live.kick.com/live',
        rtmpEndpoint: `rtmp://live.kick.com/live/${channel}`,
      },
    };
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    const channel = process.env.KICK_CHANNEL;
    if (!channel) return [];

    try {
      const res = await fetch(`${KICK_API}/channels/${channel}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as KickChannelResponse;
      if (!data.livestream?.is_live) return [];

      const stream = data.livestream;
      const username = data.user?.username ?? channel;

      return [
        {
          id: `kick:${stream.id}`,
          title: stream.session_title ?? `Kick - ${channel}`,
          hostId: `kick:${data.user?.id ?? channel}`,
          hostName: username,
          hostAvatarUrl: data.user?.profile_pic,
          coHosts: [],
          platforms: [
            {
              platform: 'kick',
              nativeId: String(stream.id),
              url: `${KICK_CDN}/${channel}`,
              streamUrl: stream.playback_url,
              metadata: {
                categoryName: stream.category?.name,
                categoryId: stream.category?.id,
              },
            },
          ],
          status: 'live',
          createdAt: stream.started_at ? new Date(stream.started_at).getTime() : Date.now(),
          listeners: stream.viewer_count ?? 0,
          speakers: [],
          reactions: [],
          tippingEnabled: true,
          tags: stream.tags ?? [],
        },
      ];
    } catch {
      return [];
    }
  },

  async getSpace(nativeId: string): Promise<SpaceItem | null> {
    const spaces = await this.getLiveSpaces();
    return spaces.find((s) => s.platforms[0]?.nativeId === nativeId) ?? null;
  },

  async endSpace(_space: SpaceItem): Promise<void> {
    // Kick streams end when the broadcaster disconnects
  },

  async updateSpace(space: SpaceItem): Promise<void> {
    const channel = process.env.KICK_CHANNEL;
    const sessionToken = process.env.KICK_SESSION_TOKEN;
    if (!channel || !sessionToken) return;

    try {
      await fetch(`${KICK_API}/channels/${channel}/livestream`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ session_title: space.title }),
      });
    } catch {
      // Non-critical
    }
  },
};

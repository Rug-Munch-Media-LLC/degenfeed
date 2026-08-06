/**
 * KickProvider — live stream / featured video feed from Kick's public API.
 *
 * Kick does not ship an official public API; these are the public JSON
 * endpoints used by the kick.com web app. They require NO auth for read
 * access (subject to Kick's bot protection / regional availability — the
 * worker may receive 403 "Request blocked by security policy" from some
 * IP ranges; the provider degrades gracefully when that happens).
 *
 * Endpoints:
 *   - GET https://kick.com/api/v1/video/featured  → featured videos
 *   - GET https://kick.com/api/v2/channels/{slug} → channel + live stream
 *
 * This provider surfaces:
 *   - Featured videos (title, creator, thumbnail, views)
 *   - Top channels (curated crypto/tech streamers with live viewer counts)
 *
 * Protocol: 'kick'.
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchJson, withConcurrencyLimit, withTimeout } from '../utils';
import { buildIdentity } from './shared';

export const KICK_API_URL = 'https://kick.com/api';

/**
 * Curated Kick channels to poll for live status. Kick's top channels skew
 * gaming/IRL; this list is editable — swap in crypto/tech streamers as the
 * Kick ecosystem grows.
 */
export const KICK_TOP_CHANNELS: string[] = [
  'xqc',
  'trainwreckstv',
  'adinross',
  'yourrage',
  'jakenbake',
  'hxney',
  'nmp',
  'cyr',
  'frosty',
  'sodapoppin',
];

// ─── Kick API shapes ───────────────────────────────────────────────

export interface KickChannelUser {
  id?: number | null;
  username?: string | null;
  slug?: string | null;
  profile_picture?: string | null;
}

export interface KickLivestream {
  id?: number | null;
  slug?: string | null;
  title?: string | null;
  viewers?: number | null;
  start_time?: string | null;
  language?: string | null;
  category?: { id?: number | null; name?: string | null; slug?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
}

export interface KickChannel {
  id?: number | null;
  slug?: string | null;
  user_id?: number | null;
  followers_count?: number | null;
  playback_url?: string | null;
  user?: KickChannelUser | null;
  livestream?: KickLivestream | null;
}

export interface KickFeaturedVideo {
  id?: number | null;
  uuid?: string | null;
  title?: string | null;
  views?: number | null;
  duration?: number | null;
  created_at?: string | null;
  channel?: { id?: number | null; slug?: string | null; username?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
  video?: { url?: string | null } | null;
}

export interface KickFeaturedResponse {
  data?: KickFeaturedVideo[] | null;
}

/** Runtime guard for a Kick channel (minimal shape). */
export function isKickChannel(obj: unknown): obj is KickChannel {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const c = obj as Record<string, unknown>;
  return typeof c.slug === 'string' || typeof c.id === 'number';
}

/** Runtime guard for a Kick featured video (minimal shape). */
export function isKickFeaturedVideo(obj: unknown): obj is KickFeaturedVideo {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const v = obj as Record<string, unknown>;
  return typeof v.title === 'string' || typeof v.id === 'number';
}

// ─── Mapping helpers ───────────────────────────────────────────────

function kickIdentity(
  id: string,
  handle: string | null,
  displayName: string,
  avatarUrl = '',
): UnifiedIdentity {
  return buildIdentity(id, 'kick' as Protocol, id, handle, displayName, {
    bio: '',
    avatarUrl,
    keys: handle ? { kickHandle: handle } : {},
  });
}

function fmtCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function liveChannelToUnifiedPost(c: KickChannel): UnifiedPost {
  const live = c.livestream;
  const slug = c.slug ?? c.user?.slug ?? 'kick';
  const username = c.user?.username ?? c.slug ?? 'Kick channel';
  const title = live?.title ?? `${username} is live`;
  const viewers = live?.viewers ?? 0;
  const category = live?.category?.name ?? '';
  const thumb = live?.thumbnail?.url ?? c.user?.profile_picture ?? '';
  const avatar = c.user?.profile_picture ?? '';

  const lines = [`🔴 ${title}`, '', `Channel: ${username}`];
  if (category) lines.push(`Category: ${category}`);
  lines.push(`Viewers: ${fmtCount(viewers)}`);

  return buildUnifiedPost({
    protocol: 'kick',
    nativeId: `channel:${c.id ?? slug}`,
    author: kickIdentity(c.user_id != null ? String(c.user_id) : slug, username, username, avatar),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'video',
        url: `https://kick.com/${encodeURIComponent(slug)}`,
        meta: {
          source: 'kick',
          title,
          creator: username,
          thumbnail: thumb,
          viewerCount: viewers,
          category,
        },
      },
    ],
    createdAt: live?.start_time ? new Date(live.start_time).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: viewers },
    raw: c,
  });
}

function featuredVideoToUnifiedPost(v: KickFeaturedVideo): UnifiedPost {
  const title = v.title ?? 'Featured Kick video';
  const creator = v.channel?.username ?? v.channel?.slug ?? 'Kick';
  const thumb = v.thumbnail?.url ?? '';
  const views = v.views ?? 0;
  const videoUrl =
    v.video?.url ??
    (v.channel?.slug
      ? `https://kick.com/${encodeURIComponent(v.channel.slug)}`
      : 'https://kick.com/');

  const lines = [`🎬 ${title}`, '', `Creator: ${creator}`];
  lines.push(`Views: ${fmtCount(views)}`);
  if (v.duration) lines.push(`Duration: ${Math.round(v.duration)}s`);

  return buildUnifiedPost({
    protocol: 'kick',
    nativeId: `video:${v.uuid ?? v.id ?? title}`,
    author: kickIdentity(
      v.channel?.id != null ? String(v.channel.id) : (v.channel?.slug ?? title),
      v.channel?.slug ?? null,
      creator,
    ),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'video',
        url: videoUrl,
        meta: { source: 'kick', title, creator, thumbnail: thumb, viewCount: views },
      },
    ],
    createdAt: v.created_at ? new Date(v.created_at).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views },
    raw: v,
  });
}

export interface KickProviderOptions {
  /** Kick API base URL (default https://kick.com/api). */
  baseUrl?: string;
  /** Override the curated channel list polled for live status. */
  topChannels?: string[];
}

export class KickProvider implements FeedProvider {
  readonly protocol: Protocol = 'kick';
  readonly schema: SchemaGuard = (data): boolean => typeof data === 'object' && data !== null;
  private readonly baseUrl: string;
  private readonly topChannels: string[];
  private readonly breaker = new CircuitBreaker('kick');

  constructor(options: KickProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? KICK_API_URL).replace(/\/$/, '');
    this.topChannels = options.topChannels ?? KICK_TOP_CHANNELS;
  }

  /** Fetch featured videos (primary signal). */
  private async fetchFeaturedVideos(timeoutMs: number): Promise<KickFeaturedVideo[]> {
    const url = `${this.baseUrl}/v1/video/featured`;
    const data = await withTimeout(
      fetchJson<KickFeaturedResponse | KickFeaturedVideo[]>(url),
      timeoutMs,
      'kick:featured',
    );
    if (Array.isArray(data)) return data.filter(isKickFeaturedVideo);
    return (data.data ?? []).filter(isKickFeaturedVideo);
  }

  /** Poll curated top channels for live status (secondary signal). */
  private async fetchTopChannels(timeoutMs: number): Promise<KickChannel[]> {
    const results = await withConcurrencyLimit(this.topChannels, 4, async (slug) => {
      const url = `${this.baseUrl}/v2/channels/${encodeURIComponent(slug)}`;
      try {
        const data = await withTimeout(
          fetchJson<KickChannel>(url),
          timeoutMs,
          `kick:channel:${slug}`,
        );
        return isKickChannel(data) ? data : null;
      } catch {
        return null;
      }
    });
    return results.filter((c): c is KickChannel => c !== null);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.breaker.execute(async () => {
        let featured: KickFeaturedVideo[] = [];
        let channels: KickChannel[] = [];
        let featuredFailed = false;

        try {
          featured = await this.fetchFeaturedVideos(timeoutMs);
        } catch {
          featuredFailed = true;
          featured = [];
        }
        try {
          channels = await this.fetchTopChannels(timeoutMs);
        } catch {
          channels = [];
        }

        // Live channels first (by viewers), then featured videos.
        const liveChannels = channels
          .filter((c) => c.livestream != null)
          .sort((a, b) => (b.livestream?.viewers ?? 0) - (a.livestream?.viewers ?? 0))
          .slice(0, 15);
        const posts: UnifiedPost[] = [
          ...liveChannels.map(liveChannelToUnifiedPost),
          ...featured.slice(0, 15).map(featuredVideoToUnifiedPost),
        ];

        if (posts.length === 0) {
          return {
            posts: [],
            notice: featuredFailed
              ? 'Kick returned no data (API may be blocked or offline)'
              : 'Kick returned no featured videos or live channels',
          };
        }
        return {
          posts,
          notice: `Kick: ${liveChannels.length} live channels, ${featured.length} featured videos`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Kick: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `Kick feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson<KickFeaturedResponse>(`${this.baseUrl}/v1/video/featured`),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'kick:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}

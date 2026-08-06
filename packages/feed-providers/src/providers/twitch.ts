/**
 * TwitchProvider — live stream feed from the Twitch Helix API.
 *
 * Uses OAuth client credentials. An access token can either be provided
 * directly (TWITCH_ACCESS_TOKEN) or minted on the fly from
 * TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET via the token endpoint.
 *
 * Endpoints:
 *   - POST https://id.twitch.tv/oauth2/token  (client_credentials)
 *   - GET  https://api.twitch.tv/helix/streams → live streams
 *   - GET  https://api.twitch.tv/helix/games/top → top games
 *   - GET  https://api.twitch.tv/helix/clips    → clips (per broadcaster)
 *
 * This provider surfaces:
 *   - Top crypto/tech live streams (title, streamer, thumbnail, viewers)
 *   - Top games (from /games/top)
 *   - Clips from popular channels
 *
 * Protocol: 'twitch'.
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchJson, withConcurrencyLimit, withTimeout } from '../utils';
import { buildIdentity } from './shared';

export const TWITCH_API_URL = 'https://api.twitch.tv/helix';
export const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

/** Stream game/title keywords used to prefer crypto/tech content. */
const CRYPTO_TECH_KEYWORDS = [
  'crypto',
  'bitcoin',
  'ethereum',
  'solana',
  'blockchain',
  'web3',
  'defi',
  'nft',
  'ai',
  'artificial intelligence',
  'programming',
  'software',
  'science',
  'technology',
  'tech',
  'development',
  'coding',
];

// ─── Twitch Helix API shapes ────────────────────────────────────────

export interface TwitchStream {
  id?: string | null;
  user_id?: string | null;
  user_login?: string | null;
  user_name?: string | null;
  game_id?: string | null;
  game_name?: string | null;
  type?: string | null;
  title?: string | null;
  viewer_count?: number | null;
  started_at?: string | null;
  language?: string | null;
  thumbnail_url?: string | null;
  tags?: string[] | null;
  is_mature?: boolean | null;
}

export interface TwitchGame {
  id?: string | null;
  name?: string | null;
  box_art_url?: string | null;
  igdb_id?: string | null;
}

export interface TwitchClip {
  id?: string | null;
  url?: string | null;
  embed_url?: string | null;
  broadcaster_id?: string | null;
  broadcaster_name?: string | null;
  creator_id?: string | null;
  creator_name?: string | null;
  video_id?: string | null;
  game_id?: string | null;
  language?: string | null;
  title?: string | null;
  view_count?: number | null;
  created_at?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
}

export interface TwitchHelixResponse<T> {
  data?: T[] | null;
  pagination?: { cursor?: string | null } | null;
}

export interface TwitchTokenResponse {
  access_token?: string | null;
  expires_in?: number | null;
  token_type?: string | null;
}

/** Runtime guard for a Twitch stream (minimal shape). */
export function isTwitchStream(obj: unknown): obj is TwitchStream {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const s = obj as Record<string, unknown>;
  return typeof s.id === 'string' || typeof s.title === 'string';
}

/** Runtime guard for a Twitch game (minimal shape). */
export function isTwitchGame(obj: unknown): obj is TwitchGame {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const g = obj as Record<string, unknown>;
  return typeof g.id === 'string' || typeof g.name === 'string';
}

/** Runtime guard for a Twitch clip (minimal shape). */
export function isTwitchClip(obj: unknown): obj is TwitchClip {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const c = obj as Record<string, unknown>;
  return typeof c.id === 'string' || typeof c.title === 'string';
}

// ─── Mapping helpers ───────────────────────────────────────────────

function streamerIdentity(stream: TwitchStream): UnifiedIdentity {
  const id = stream.user_id ?? stream.user_login ?? 'twitch';
  const handle = stream.user_login ?? null;
  const displayName = stream.user_name ?? stream.user_login ?? 'Twitch streamer';
  return buildIdentity(id, 'twitch' as Protocol, id, handle, displayName, {
    bio: '',
    avatarUrl: '',
    keys: { twitchUserId: id },
  });
}

/** Twitch thumbnails carry a {width}x{height} template — substitute 320x180. */
export function twitchThumbnailUrl(
  template: string | null | undefined,
  width = 320,
  height = 180,
): string {
  if (!template) return '';
  return template.replace(/\{width\}/g, String(width)).replace(/\{height\}/g, String(height));
}

function fmtCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function streamToUnifiedPost(s: TwitchStream): UnifiedPost {
  const title = s.title ?? 'Untitled stream';
  const streamer = s.user_name ?? s.user_login ?? 'Twitch streamer';
  const thumb = twitchThumbnailUrl(s.thumbnail_url);
  const viewers = s.viewer_count ?? 0;
  const game = s.game_name ?? '';

  const lines = [`🔴 ${title}`, '', `Streamer: ${streamer}`];
  if (game) lines.push(`Game: ${game}`);
  lines.push(`Viewers: ${fmtCount(viewers)}`);
  if (s.tags && s.tags.length > 0) lines.push(`Tags: ${s.tags.slice(0, 4).join(', ')}`);

  return buildUnifiedPost({
    protocol: 'twitch',
    nativeId: `stream:${s.id ?? `${streamer}:${s.started_at ?? Date.now()}`}`,
    author: streamerIdentity(s),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'video',
        url: `https://www.twitch.tv/${s.user_login ?? streamer.toLowerCase()}`,
        meta: {
          source: 'twitch',
          title,
          streamer,
          thumbnail: thumb,
          viewerCount: viewers,
          game,
          language: s.language ?? '',
          startedAt: s.started_at ?? '',
        },
      },
    ],
    createdAt: s.started_at ? new Date(s.started_at).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: viewers },
    raw: s,
  });
}

function gameToUnifiedPost(g: TwitchGame): UnifiedPost {
  const name = g.name ?? 'Unknown game';
  const boxArt = g.box_art_url
    ? g.box_art_url.replace(/\{width\}/g, '144').replace(/\{height\}/g, '192')
    : '';

  const lines = [`🎮 ${name}`, '', 'Top game on Twitch right now'];

  return buildUnifiedPost({
    protocol: 'twitch',
    nativeId: `game:${g.id ?? name}`,
    author: buildIdentity(g.id ?? name, 'twitch' as Protocol, g.id ?? name, null, name, {
      bio: 'Twitch game',
      avatarUrl: boxArt,
      keys: {},
    }),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'link',
        url: `https://www.twitch.tv/directory/category/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        meta: { title: name, thumbnail: boxArt, source: 'twitch' },
      },
    ],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    raw: g,
  });
}

function clipToUnifiedPost(c: TwitchClip): UnifiedPost {
  const title = c.title ?? 'Twitch clip';
  const creator = c.broadcaster_name ?? c.creator_name ?? 'Twitch';
  const thumb = twitchThumbnailUrl(c.thumbnail_url, 480, 272);

  const lines = [`✂️ ${title}`, '', `Channel: ${creator}`];
  lines.push(`Views: ${fmtCount(c.view_count)}`);
  if (c.duration) lines.push(`Duration: ${Math.round(c.duration)}s`);

  return buildUnifiedPost({
    protocol: 'twitch',
    nativeId: `clip:${c.id ?? title}`,
    author: buildIdentity(
      c.broadcaster_id ?? c.broadcaster_name ?? 'twitch',
      'twitch' as Protocol,
      c.broadcaster_id ?? 'twitch',
      null,
      creator,
      {
        bio: 'Twitch channel',
        avatarUrl: '',
        keys: { twitchBroadcasterId: c.broadcaster_id ?? '' },
      },
    ),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'video',
        url: c.url ?? c.embed_url ?? 'https://www.twitch.tv/',
        meta: { source: 'twitch', title, creator, thumbnail: thumb, viewCount: c.view_count ?? 0 },
      },
    ],
    createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: c.view_count ?? 0 },
    raw: c,
  });
}

export interface TwitchProviderOptions {
  /** Twitch Client-Id header (TWITCH_CLIENT_ID). */
  clientId?: string;
  /** Pre-minted OAuth access token (TWITCH_ACCESS_TOKEN). */
  accessToken?: string;
  /** Client secret used to mint an access token when accessToken is empty. */
  clientSecret?: string;
  /** Helix API base URL (default https://api.twitch.tv/helix). */
  apiUrl?: string;
  /** OAuth token endpoint (default https://id.twitch.tv/oauth2/token). */
  tokenUrl?: string;
}

export class TwitchProvider implements FeedProvider {
  readonly protocol: Protocol = 'twitch';
  readonly schema: SchemaGuard = (data): boolean => typeof data === 'object' && data !== null;
  private readonly clientId?: string;
  private readonly accessToken?: string;
  private readonly clientSecret?: string;
  private readonly apiUrl: string;
  private readonly tokenUrl: string;
  private readonly breaker = new CircuitBreaker('twitch');
  /** In-memory minted token cache (per-instance; provider instances are short-lived). */
  private mintedToken: { token: string; expiresAt: number } | null = null;

  constructor(options: TwitchProviderOptions = {}) {
    this.clientId = options.clientId;
    this.accessToken = options.accessToken;
    this.clientSecret = options.clientSecret;
    this.apiUrl = (options.apiUrl ?? TWITCH_API_URL).replace(/\/$/, '');
    this.tokenUrl = options.tokenUrl ?? TWITCH_TOKEN_URL;
  }

  private configured(): boolean {
    return Boolean(this.clientId && (this.accessToken || this.clientSecret));
  }

  /**
   * Resolve an access token: use the pre-provisioned one, or mint one
   * via OAuth client credentials when clientSecret is present.
   */
  private async getAccessToken(timeoutMs: number): Promise<string> {
    if (this.accessToken) return this.accessToken;
    if (this.mintedToken && Date.now() < this.mintedToken.expiresAt) {
      return this.mintedToken.token;
    }
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Twitch credentials missing: set TWITCH_CLIENT_ID + TWITCH_ACCESS_TOKEN');
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });
    const data = await withTimeout(
      fetchJson<TwitchTokenResponse>(this.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
      timeoutMs,
      'twitch:token',
    );
    if (!data.access_token) {
      throw new Error('Twitch token endpoint returned no access_token');
    }
    const expiresIn = data.expires_in ?? 3600;
    this.mintedToken = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
    };
    return data.access_token;
  }

  /** Fetch top live streams (optionally biased toward crypto/tech). */
  private async fetchStreams(timeoutMs: number, token: string): Promise<TwitchStream[]> {
    const url = `${this.apiUrl}/streams?first=25`;
    const data = await withTimeout(
      fetchJson<TwitchHelixResponse<TwitchStream>>(url, this.helixHeaders(token)),
      timeoutMs,
      'twitch:streams',
    );
    return (data.data ?? []).filter(isTwitchStream);
  }

  /** Fetch the top games. */
  private async fetchTopGames(timeoutMs: number, token: string): Promise<TwitchGame[]> {
    const url = `${this.apiUrl}/games/top?first=10`;
    const data = await withTimeout(
      fetchJson<TwitchHelixResponse<TwitchGame>>(url, this.helixHeaders(token)),
      timeoutMs,
      'twitch:games',
    );
    return (data.data ?? []).filter(isTwitchGame);
  }

  /** Fetch clips from a set of broadcaster ids (used for popular channels). */
  private async fetchClips(
    timeoutMs: number,
    token: string,
    broadcasterIds: string[],
  ): Promise<TwitchClip[]> {
    const top = broadcasterIds.slice(0, 3);
    const results = await withConcurrencyLimit(top, 3, async (broadcasterId) => {
      const url = `${this.apiUrl}/clips?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=4`;
      const data = await withTimeout(
        fetchJson<TwitchHelixResponse<TwitchClip>>(url, this.helixHeaders(token)),
        timeoutMs,
        'twitch:clips',
      );
      return (data.data ?? []).filter(isTwitchClip);
    });
    // De-duplicate clips by id.
    const seen = new Set<string>();
    const clips: TwitchClip[] = [];
    for (const batch of results) {
      for (const clip of batch) {
        const key = clip.id ?? clip.title ?? '';
        if (key && !seen.has(key)) {
          seen.add(key);
          clips.push(clip);
        }
      }
    }
    return clips;
  }

  private helixHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      'client-id': this.clientId ?? '',
    };
    if (!this.clientId) delete headers['client-id'];
    return headers;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!this.configured()) {
      return {
        posts: [],
        notice: 'Twitch not configured — set TWITCH_CLIENT_ID and TWITCH_ACCESS_TOKEN',
      };
    }
    try {
      return await this.breaker.execute(async () => {
        const token = await this.getAccessToken(timeoutMs);

        let streams: TwitchStream[] = [];
        let games: TwitchGame[] = [];
        let clips: TwitchClip[] = [];
        const errors: string[] = [];

        try {
          streams = await this.fetchStreams(timeoutMs, token);
        } catch (err) {
          errors.push(`streams: ${err instanceof Error ? err.message : 'failed'}`);
        }
        try {
          games = await this.fetchTopGames(timeoutMs, token);
        } catch {
          games = [];
        }
        try {
          // Clips from the top streamers (most viewers first).
          const topBroadcasters = [...streams]
            .sort((a, b) => (b.viewer_count ?? 0) - (a.viewer_count ?? 0))
            .slice(0, 3)
            .map((s) => s.user_id)
            .filter((id): id is string => Boolean(id));
          if (topBroadcasters.length > 0) {
            clips = await this.fetchClips(timeoutMs, token, topBroadcasters);
          }
        } catch {
          clips = [];
        }

        // Prefer crypto/tech streams; fall back to the top streams overall.
        const keyword = (s: TwitchStream): boolean => {
          const haystack = `${s.game_name ?? ''} ${s.title ?? ''}`.toLowerCase();
          return CRYPTO_TECH_KEYWORDS.some((k) => haystack.includes(k));
        };
        const cryptoTech = streams.filter(keyword);
        const ordered = (cryptoTech.length >= 3 ? cryptoTech : streams)
          .sort((a, b) => (b.viewer_count ?? 0) - (a.viewer_count ?? 0))
          .slice(0, 50);

        const posts: UnifiedPost[] = [
          ...ordered.map(streamToUnifiedPost),
          ...clips.slice(0, 6).map(clipToUnifiedPost),
          ...games.slice(0, 5).map(gameToUnifiedPost),
        ];

        if (posts.length === 0) {
          return {
            posts: [],
            notice: `Twitch returned no streams${errors.length > 0 ? ` (${errors.join('; ')})` : ''}`,
          };
        }
        return {
          posts,
          notice: `Twitch: ${ordered.length} streams, ${clips.length} clips, ${games.length} top games${
            cryptoTech.length >= 3 ? ' (crypto/tech bias)' : ''
          }`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Twitch: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `Twitch feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      if (!this.configured()) {
        return {
          healthy: false,
          latencyMs: Math.round(performance.now() - start),
          error: 'Twitch not configured — set TWITCH_CLIENT_ID and TWITCH_ACCESS_TOKEN',
        };
      }
      const token = await this.getAccessToken(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      await withTimeout(
        fetchJson<TwitchHelixResponse<TwitchStream>>(
          `${this.apiUrl}/streams?first=1`,
          this.helixHeaders(token),
        ),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'twitch:health',
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

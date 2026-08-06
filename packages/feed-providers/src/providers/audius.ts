/**
 * AudiusProvider — decentralized music streaming feed from Audius.
 *
 * Audius is a decentralized, open-source music streaming protocol. The
 * public discovery provider exposes trending tracks and playlists with
 * NO auth required.
 *
 * Endpoints:
 *   - GET /v1/tracks/trending    → trending tracks
 *   - GET /v1/playlists/trending → trending playlists
 *
 * This provider surfaces:
 *   - Trending tracks (title, artist, artwork, play count, duration)
 *   - Trending playlists (curated sets with play counts)
 *
 * Protocol: 'audius' (already present in @degenfeed/types).
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';
import { buildIdentity } from './shared';

export const AUDIUS_API_URL = 'https://discoveryprovider.audius.co/v1';

// ─── Audius API shapes ─────────────────────────────────────────────

export interface AudiusUser {
  id?: string | null;
  handle?: string | null;
  name?: string | null;
  follower_count?: number | null;
}

export interface AudiusArtwork {
  '150x150'?: string | null;
  '480x480'?: string | null;
  '1000x1000'?: string | null;
}

export interface AudiusTrack {
  id?: string | null;
  title?: string | null;
  slug?: string | null;
  permalink?: string | null;
  description?: string | null;
  genre?: string | null;
  duration?: number | null;
  play_count?: number | null;
  favorite_count?: number | null;
  repost_count?: number | null;
  artwork?: AudiusArtwork | null;
  created_at?: string | null;
  user?: AudiusUser | null;
}

export interface AudiusPlaylist {
  id?: string | null;
  playlist_name?: string | null;
  slug?: string | null;
  description?: string | null;
  is_album?: boolean | null;
  total_play_count?: number | null;
  favorite_count?: number | null;
  repost_count?: number | null;
  artwork?: AudiusArtwork | null;
  created_at?: string | null;
  user?: AudiusUser | null;
}

export interface AudiusResponse {
  data?: Array<AudiusTrack | AudiusPlaylist> | null;
}

/** Runtime guard for a single Audius track (minimal shape). */
export function isAudiusTrack(obj: unknown): obj is AudiusTrack {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const t = obj as Record<string, unknown>;
  if (typeof t.title !== 'string' && typeof t.id !== 'string') return false;
  // Tracks carry a play_count; playlists carry playlist_name.
  return typeof t.play_count === 'number' || typeof t.playlist_name === 'undefined';
}

/** Runtime guard for a single Audius playlist (minimal shape). */
export function isAudiusPlaylist(obj: unknown): obj is AudiusPlaylist {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const p = obj as Record<string, unknown>;
  return typeof p.playlist_name === 'string' || typeof p.id === 'string';
}

// ─── Mapping helpers ───────────────────────────────────────────────

function audiusIdentity(u: AudiusUser | null | undefined, fallbackId: string): UnifiedIdentity {
  const handle = u?.handle ?? null;
  const name = (u?.name ?? u?.handle ?? 'Audius artist').replace(/^@/, '');
  return buildIdentity(
    u?.id ?? fallbackId,
    'audius' as Protocol,
    u?.id ?? fallbackId,
    handle,
    name,
    {
      bio: '',
      avatarUrl: '',
      followerCount: u?.follower_count ?? 0,
      keys: handle ? { audiusHandle: handle } : {},
    },
  );
}

/** Prefer 480x480 artwork, fall back to 150x150. */
function artworkUrl(art: AudiusArtwork | null | undefined): string {
  return art?.['480x480'] ?? art?.['150x150'] ?? '';
}

function fmtCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function fmtDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function trackToUnifiedPost(t: AudiusTrack): UnifiedPost {
  const title = t.title ?? 'Untitled track';
  const artist = (t.user?.name ?? t.user?.handle ?? 'Audius artist').replace(/^@/, '');
  const thumb = artworkUrl(t.artwork);
  const permalink =
    t.permalink ?? (t.user?.handle ? `/${t.user.handle}/${t.slug ?? t.id ?? ''}` : '');
  const url = `https://audius.co${permalink}`;

  const lines = [`🎵 ${title}`, '', `Artist: ${artist}`];
  const meta: Record<string, unknown> = {
    source: 'audius',
    title,
    artist,
    thumbnail: thumb,
    playCount: t.play_count ?? 0,
    duration: t.duration ?? 0,
  };
  lines.push(`Plays: ${fmtCount(t.play_count)} · Duration: ${fmtDuration(t.duration)}`);
  if (t.genre) lines.push(`Genre: ${t.genre}`);
  if (t.description) {
    const desc = t.description.replace(/\s+/g, ' ').trim().slice(0, 220);
    if (desc) lines.push('', desc);
  }

  return buildUnifiedPost({
    protocol: 'audius',
    nativeId: t.id ?? `${title}:${permalink || 'track'}`,
    author: audiusIdentity(t.user, t.id ?? title),
    text: lines.join('\n'),
    embeds: [{ kind: 'audio', url, meta }],
    createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
    metrics: {
      likes: t.favorite_count ?? 0,
      reposts: t.repost_count ?? 0,
      replies: 0,
      quotes: 0,
      views: t.play_count ?? 0,
    },
    raw: t,
  });
}

function playlistToUnifiedPost(p: AudiusPlaylist): UnifiedPost {
  const title = p.playlist_name ?? 'Untitled playlist';
  const creator = (p.user?.name ?? p.user?.handle ?? 'Audius curator').replace(/^@/, '');
  const thumb = artworkUrl(p.artwork);
  const permalink = p.slug ? (p.user?.handle ? `/${p.user.handle}/playlist/${p.slug}` : '') : '';
  const url = `https://audius.co${permalink}`;

  const lines = [
    `📀 ${title}`,
    '',
    `Curated by: ${creator}`,
    `Total plays: ${fmtCount(p.total_play_count)}`,
  ];
  if (p.is_album === true) lines.push('Type: Album');
  if (p.description) {
    const desc = p.description.replace(/\s+/g, ' ').trim().slice(0, 220);
    if (desc) lines.push('', desc);
  }

  return buildUnifiedPost({
    protocol: 'audius',
    nativeId: `playlist:${p.id ?? title}`,
    author: audiusIdentity(p.user, p.id ?? title),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'audio',
        url,
        meta: {
          source: 'audius',
          title,
          artist: creator,
          thumbnail: thumb,
          playCount: p.total_play_count ?? 0,
          duration: 0,
        },
      },
    ],
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    metrics: {
      likes: p.favorite_count ?? 0,
      reposts: p.repost_count ?? 0,
      replies: 0,
      quotes: 0,
      views: p.total_play_count ?? 0,
    },
    raw: p,
  });
}

export interface AudiusProviderOptions {
  /** Discovery provider base URL (default https://discoveryprovider.audius.co/v1). */
  baseUrl?: string;
}

export class AudiusProvider implements FeedProvider {
  readonly protocol: Protocol = 'audius';
  readonly schema: SchemaGuard = (data): boolean => typeof data === 'object' && data !== null;
  private readonly baseUrl: string;
  private readonly breaker = new CircuitBreaker('audius');

  constructor(options: AudiusProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? AUDIUS_API_URL).replace(/\/$/, '');
  }

  /** Fetch trending tracks (primary signal). */
  private async fetchTrendingTracks(timeoutMs: number): Promise<AudiusTrack[]> {
    const url = `${this.baseUrl}/tracks/trending?limit=25`;
    const data = await withTimeout(
      fetchJson<AudiusResponse | AudiusTrack[]>(url),
      timeoutMs,
      'audius:tracks',
    );
    if (Array.isArray(data)) return data.filter(isAudiusTrack);
    return (data.data ?? []).filter(isAudiusTrack);
  }

  /** Fetch trending playlists (secondary signal). */
  private async fetchTrendingPlaylists(timeoutMs: number): Promise<AudiusPlaylist[]> {
    const url = `${this.baseUrl}/playlists/trending?limit=10`;
    const data = await withTimeout(
      fetchJson<AudiusResponse | AudiusPlaylist[]>(url),
      timeoutMs,
      'audius:playlists',
    );
    if (Array.isArray(data)) return data.filter(isAudiusPlaylist);
    return (data.data ?? []).filter(isAudiusPlaylist);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.breaker.execute(async () => {
        let tracks: AudiusTrack[] = [];
        let playlists: AudiusPlaylist[] = [];

        try {
          tracks = await this.fetchTrendingTracks(timeoutMs);
        } catch {
          tracks = [];
        }
        try {
          playlists = await this.fetchTrendingPlaylists(timeoutMs);
        } catch {
          playlists = [];
        }

        // Tracks first (sorted by play count desc), then a few playlists.
        tracks.sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));
        const posts: UnifiedPost[] = [
          ...tracks.slice(0, 25).map(trackToUnifiedPost),
          ...playlists.slice(0, 5).map(playlistToUnifiedPost),
        ];

        if (posts.length === 0) {
          return { posts: [], notice: 'Audius returned no tracks/playlists' };
        }
        return {
          posts,
          notice: `Audius: ${tracks.length} trending tracks, ${playlists.length} trending playlists`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Audius: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `Audius feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(`${this.baseUrl}/tracks/trending?limit=1`),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'audius:health',
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

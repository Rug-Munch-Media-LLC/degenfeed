/**
 * TwitchProvider — live stream + VOD feed via RSS-Bridge TwitchBridge.
 *
 * The Twitch Helix API requires OAuth client credentials that are not
 * configured at the edge. RSS-Bridge's TwitchBridge proxies Twitch's public
 * GQL API (client-id kimne78kx3ncx6brgo4mv6wki5h1ko) with no auth:
 *
 *   {RSS_BRIDGE_URL}/?action=display&bridge=Twitch&channel={name}&type=all&format=Json
 *
 * Strategy:
 *   1. RSS-Bridge TwitchBridge — fan out across 20+ crypto/tech/gaming
 *      channels, 10 VODs/live streams each → 100+ posts before dedup.
 *   2. Twitch Helix API (optional) — used when TWITCH_CLIENT_ID +
 *      TWITCH_ACCESS_TOKEN are configured, as an additional source.
 *   3. Public GQL endpoint fallback for top live streams (no auth).
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

/** Default RSS-Bridge instance (overridden via RSS_BRIDGE_URL env). */
export const DEFAULT_RSS_BRIDGE_URL = 'https://rss-bridge.degenfeed.xyz';

/**
 * Curated Twitch channels fan-out — crypto/tech/gaming/creator mix.
 * Each channel returns up to 10 VODs/live streams via the bridge, so
 * 22 channels × 10 = 220 raw items → 100+ deduped posts.
 */
export const TWITCH_CHANNELS: Array<{ channel: string; category: string }> = [
  // ── Crypto / Web3 ────────────────────────────────────────────
  { channel: 'hasanabi', category: 'crypto' },
  { channel: 'xqc', category: 'crypto' },
  { channel: 'destiny', category: 'crypto' },
  // ── Tech / Programming ───────────────────────────────────────
  { channel: 'theprimeagen', category: 'tech' },
  { channel: 'tsoding', category: 'tech' },
  { channel: 'lowlevellearning', category: 'tech' },
  { channel: 'anthony_pogger', category: 'tech' },
  { channel: 'forrestknight', category: 'tech' },
  // ── Gaming (top channels) ────────────────────────────────────
  { channel: 'shroud', category: 'gaming' },
  { channel: 'summit1g', category: 'gaming' },
  { channel: 'tarik', category: 'gaming' },
  { channel: 'gaules', category: 'gaming' },
  { channel: 'loud_coringa', category: 'gaming' },
  { channel: 'auronplay', category: 'gaming' },
  { channel: 'ibai', category: 'gaming' },
  { channel: 'elxokas', category: 'gaming' },
  { channel: 'pokimane', category: 'gaming' },
  { channel: 'caseoh_', category: 'gaming' },
  { channel: 'jynxzi', category: 'gaming' },
  { channel: 'tyler1', category: 'gaming' },
  { channel: 'ninja', category: 'gaming' },
  { channel: 'timthetatman', category: 'gaming' },
];

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

// ─── RSS-Bridge TwitchBridge JSON shapes ───────────────────────────

export interface TwitchBridgeItem {
  id?: string | null;
  title?: string | null;
  url?: string | null;
  uri?: string | null;
  author?: { name?: string } | string | null;
  content_html?: string | null;
  content_text?: string | null;
  date_modified?: string | null;
  timestamp?: number | null;
  categories?: string[] | null;
  attachments?: Array<{ url?: string; mime_type?: string } | string> | null;
}

export interface TwitchBridgeFeed {
  title?: string;
  items?: TwitchBridgeItem[];
}

// ─── Twitch Helix API shapes (fallback path) ──────────────────────

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

// ─── Mapping helpers ───────────────────────────────────────────────

function streamerIdentity(id: string, handle: string | null, displayName: string): UnifiedIdentity {
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

/** Extract viewer count from RSS-Bridge content like "1234 viewers". */
function extractViewers(content: string | null | undefined): number {
  if (!content) return 0;
  const m = content.match(/([\d,]+)\s*(?:viewer|view)/i);
  if (!m) return 0;
  return Number.parseInt((m[1] ?? '').replace(/,/g, ''), 10) || 0;
}

/** Extract thumbnail URL from RSS-Bridge content_html (first <img src>). */
function extractThumb(content: string | null | undefined): string {
  if (!content) return '';
  const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? '';
}

/** Resolve the Twitch channel name from an RSS-Bridge item. */
function itemChannelName(item: TwitchBridgeItem): string | null {
  if (typeof item.author === 'string' && item.author) return item.author;
  if (item.author && typeof item.author === 'object' && item.author.name) return item.author.name;
  const m = (item.url ?? item.uri ?? '').match(/twitch\.tv\/(videos\/)?([\w]+)/i);
  return m?.[2] ?? null;
}

function bridgeItemToUnifiedPost(item: TwitchBridgeItem, fallbackChannel: string): UnifiedPost {
  const channel = itemChannelName(item) ?? fallbackChannel;
  const title = (item.title ?? `${channel}'s Twitch content`).trim();
  const url = item.url ?? item.uri ?? `https://www.twitch.tv/${channel}`;
  const content = item.content_text ?? item.content_html ?? '';
  const viewers = extractViewers(content);
  const thumb = extractThumb(content);
  const categories = (item.categories ?? []).filter((c): c is string => Boolean(c)).slice(0, 4);

  const lines = [`🔴 ${title}`, '', `Channel: ${channel}`];
  if (viewers > 0) lines.push(`Viewers: ${fmtCount(viewers)}`);
  if (categories.length > 0) lines.push(`Tags: ${categories.join(', ')}`);
  const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain) lines.push('', plain.slice(0, 400));

  const timestamp =
    item.timestamp && item.timestamp > 0
      ? item.timestamp * 1000
      : item.date_modified
        ? new Date(item.date_modified).getTime()
        : Date.now();

  return buildUnifiedPost({
    protocol: 'twitch',
    nativeId: item.id ? `bridge:${item.id}` : `bridge:${channel}:${title.slice(0, 48)}`,
    author: streamerIdentity(`twitch:${channel}`, channel, channel),
    text: lines.join('\n'),
    embeds: [
      {
        kind: 'video',
        url,
        meta: {
          source: 'twitch',
          title,
          streamer: channel,
          thumbnail: thumb,
          viewerCount: viewers,
          game: categories[0] ?? '',
        },
      },
    ],
    createdAt: Number.isNaN(timestamp) ? Date.now() : timestamp,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: viewers },
    raw: { ...item, _viaRssBridge: true, _channel: channel },
  });
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
    author: streamerIdentity(
      s.user_id ?? s.user_login ?? 'twitch',
      s.user_login ?? null,
      streamer,
    ),
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
  /** Self-hosted RSS-Bridge base URL (default https://rss-bridge.degenfeed.xyz). */
  rssBridgeUrl?: string;
  /** Channels to fan out via RSS-Bridge (defaults to TWITCH_CHANNELS). */
  channels?: Array<{ channel: string; category: string }>;
}

export class TwitchProvider implements FeedProvider {
  readonly protocol: Protocol = 'twitch';
  readonly schema: SchemaGuard = (data): boolean => typeof data === 'object' && data !== null;
  private readonly clientId?: string;
  private readonly accessToken?: string;
  private readonly clientSecret?: string;
  private readonly apiUrl: string;
  private readonly tokenUrl: string;
  private readonly rssBridgeUrl: string;
  private readonly channels: Array<{ channel: string; category: string }>;
  private readonly breaker = new CircuitBreaker('twitch');
  /** In-memory minted token cache (per-instance; provider instances are short-lived). */
  private mintedToken: { token: string; expiresAt: number } | null = null;

  constructor(options: TwitchProviderOptions = {}) {
    this.clientId = options.clientId;
    this.accessToken = options.accessToken;
    this.clientSecret = options.clientSecret;
    this.apiUrl = (options.apiUrl ?? TWITCH_API_URL).replace(/\/$/, '');
    this.tokenUrl = options.tokenUrl ?? TWITCH_TOKEN_URL;
    this.rssBridgeUrl = (options.rssBridgeUrl ?? DEFAULT_RSS_BRIDGE_URL).replace(/\/+$/, '');
    this.channels = options.channels ?? TWITCH_CHANNELS;
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

  /** Fetch a single channel's VODs/live streams via RSS-Bridge TwitchBridge. */
  private async fetchChannelViaBridge(
    channel: string,
    timeoutMs: number,
  ): Promise<TwitchBridgeItem[]> {
    const url = `${this.rssBridgeUrl}/?action=display&bridge=Twitch&channel=${encodeURIComponent(channel)}&type=all&format=Json`;
    const res = await fetch(url, {
      headers: { 'user-agent': 'DegenFeed/1.0', accept: 'application/json' },
      signal: AbortSignal.timeout(Math.min(timeoutMs, 7000)),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as TwitchBridgeFeed;
    return (data.items ?? []).filter((i) => typeof i === 'object' && i !== null);
  }

  /** Fan out across all configured channels via RSS-Bridge. */
  private async fetchViaBridge(timeoutMs: number): Promise<TwitchBridgeItem[]> {
    const results = await withConcurrencyLimit(this.channels, 8, async ({ channel }) => {
      try {
        return await this.fetchChannelViaBridge(channel, timeoutMs);
      } catch {
        return [] as TwitchBridgeItem[];
      }
    });
    const seen = new Set<string>();
    const items: TwitchBridgeItem[] = [];
    for (const batch of results) {
      for (const item of batch) {
        const key = item.id ?? item.url ?? item.title ?? '';
        if (key && !seen.has(key)) {
          seen.add(key);
          items.push(item);
        }
      }
    }
    return items;
  }

  /** Optional: fetch top live streams from Helix when configured. */
  private async fetchStreamsHelix(timeoutMs: number, token: string): Promise<TwitchStream[]> {
    const url = `${this.apiUrl}/streams?first=50`;
    const data = await withTimeout(
      fetchJson<TwitchHelixResponse<TwitchStream>>(url, this.helixHeaders(token)),
      timeoutMs,
      'twitch:streams',
    );
    return (data.data ?? []).filter(isTwitchStream);
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
    try {
      return await this.breaker.execute(async () => {
        const posts: UnifiedPost[] = [];
        const errors: string[] = [];

        // ── Path 1: RSS-Bridge TwitchBridge (primary, no auth) ──
        let bridgeItems: TwitchBridgeItem[] = [];
        try {
          bridgeItems = await this.fetchViaBridge(timeoutMs);
          // Channel-tagged posts
          const itemPosts = bridgeItems.map((item, idx) => {
            const cfg = this.channels[idx % this.channels.length];
            return bridgeItemToUnifiedPost(item, cfg.channel);
          });
          posts.push(...itemPosts);
          console.log(`[twitch] RSS-Bridge returned ${bridgeItems.length} items`);
        } catch (err) {
          errors.push(`bridge: ${err instanceof Error ? err.message : 'failed'}`);
        }

        // ── Path 2: Helix API (optional, when configured) ────────
        let helixStreams: TwitchStream[] = [];
        if (this.configured()) {
          try {
            const token = await this.getAccessToken(timeoutMs);
            helixStreams = await this.fetchStreamsHelix(timeoutMs, token);
            posts.push(...helixStreams.slice(0, 50).map(streamToUnifiedPost));
          } catch (err) {
            errors.push(`helix: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }

        if (posts.length === 0) {
          return {
            posts: [],
            notice: `Twitch returned no content${errors.length > 0 ? ` (${errors.join('; ')})` : ''}`,
          };
        }

        // Dedup by native id + URL
        const seen = new Set<string>();
        const deduped = posts.filter((p) => {
          const key = (p.raw as { _channel?: string })?.id ?? p.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort: prefer crypto/tech content, then viewer count desc.
        const keyword = (s: UnifiedPost): boolean => {
          const haystack = `${s.text ?? ''}`.toLowerCase();
          return CRYPTO_TECH_KEYWORDS.some((k) => haystack.includes(k));
        };
        const cryptoTech = deduped.filter(keyword);
        const ordered = (cryptoTech.length >= 5 ? [...cryptoTech, ...deduped.filter((p) => !keyword(p))] : deduped)
          .slice(0, 200);

        return {
          posts: ordered,
          notice: `Twitch: ${ordered.length} posts via RSS-Bridge (${bridgeItems.length} items, ${helixStreams.length} helix)${
            cryptoTech.length >= 5 ? ' (crypto/tech bias)' : ''
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
      const res = await fetch(
        `${this.rssBridgeUrl}/?action=display&bridge=Twitch&channel=shroud&type=all&format=Json`,
        { headers: { 'user-agent': 'DegenFeed/1.0' }, signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        return { healthy: true, latencyMs: Math.round(performance.now() - start) };
      }
      if (this.configured()) {
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
      }
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: `RSS-Bridge returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}

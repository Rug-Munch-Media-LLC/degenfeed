/**
 * @degenfeed/pixelfed-sdk
 *
 * Pixelfed SDK — Mastodon-compatible REST API client.
 * Pixelfed implements the Mastodon API so all endpoints follow the same
 * patterns as @degenfeed/mastodon-sdk but scoped to Pixelfed instances.
 *
 * Our self-hosted instance: http://127.0.0.1:8087
 * Public federated instances: pixelfed.social, pixelfed.de, gram.social, …
 *
 * ─── API Coverage ──────────────────────────────────────────────────
 * 1. getPublicTimeline     GET /api/v1/timelines/public
 * 2. getTagTimeline        GET /api/v1/timelines/tag/:tag
 * 3. getAccountPosts       GET /api/v1/accounts/:id/statuses
 * 4. getAccount            GET /api/v1/accounts/:id
 * 5. searchAccounts        GET /api/v1/accounts/search?q=
 * 6. normalizePixelfedPost  Mastodon→UnifiedPost conversion
 * 7. PixelfedClient        Class-based client (auth, write, read)
 */

import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

// ─── API Types ─────────────────────────────────────────────────────

export interface PixelfedAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  locked: boolean;
  bot: boolean;
  discoverable: boolean;
  created_at: string;
  note: string;
  url: string;
  avatar: string;
  avatar_static: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  last_status_at: string;
  fields: Array<{ name: string; value: string; verified_at: string | null }>;
  emojis: Array<{ shortcode: string; url: string }>;
}

export interface PixelfedMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
  preview_url: string;
  remote_url: string | null;
  meta: Record<string, unknown>;
  description: string | null;
  blurhash: string | null;
}

export interface PixelfedStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: PixelfedMediaAttachment[];
  mentions: Array<{ id: string; username: string; url: string; acct: string }>;
  tags: Array<{ name: string; url: string }>;
  emojis: Array<{ shortcode: string; url: string }>;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  reblog: PixelfedStatus | null;
  card: PixelfedCard | null;
  poll: PixelfedPoll | null;
  account: PixelfedAccount;
  favourited?: boolean;
  reblogged?: boolean;
  muted?: boolean;
  bookmarked?: boolean;
}

export interface PixelfedCard {
  url: string;
  title: string;
  description: string;
  image: string | null;
  type: string;
  author_name: string;
  author_url: string;
  provider_name: string;
  provider_url: string;
}

export interface PixelfedPoll {
  id: string;
  options: Array<{ title: string; votes_count: number | null }>;
  voted: boolean;
  multiple: boolean;
  voters_count: number | null;
  votes_count: number;
  expired: boolean;
  expires_at: string | null;
}

export interface PixelfedNotification {
  id: string;
  type: 'follow' | 'favourite' | 'reblog' | 'mention' | 'poll' | 'follow_request';
  created_at: string;
  account: PixelfedAccount;
  status?: PixelfedStatus;
}

export interface PixelfedMediaResult {
  id: string;
  type: string;
  url: string;
  preview_url: string;
  description?: string;
}

export interface PixelfedStatusResult {
  id: string;
  url: string;
  uri: string;
  content: string;
  created_at: string;
  media_attachments: PixelfedMediaAttachment[];
}

export interface PixelfedPublishResult {
  ok: boolean;
  status?: PixelfedStatusResult;
  error?: string;
}

// ─── Constants ─────────────────────────────────────────────────────

export const DEFAULT_USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

/** Default self-hosted Pixelfed instance */
export const PIXELFED_LOCAL_INSTANCE = 'http://127.0.0.1:8087';

/** Well-known public Pixelfed instances for federation fallback */
export const PUBLIC_PIXELFED_INSTANCES = [
  { url: 'https://pixelfed.social', label: 'pixelfed.social' },
  { url: 'https://pixelfed.de', label: 'pixelfed.de' },
  { url: 'https://gram.social', label: 'gram.social' },
  { url: 'https://pixey.org', label: 'pixey.org' },
];

// ─── Helpers ───────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Low-level API fetch ───────────────────────────────────────────

export interface ApiFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * Fetch from a Pixelfed/Mastodon-compatible API endpoint.
 */
export async function apiFetch<T>(
  instanceUrl: string,
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const baseUrl = instanceUrl.replace(/\/$/, '');
  const url = new URL(baseUrl + path);

  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': DEFAULT_USER_AGENT,
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutMs = options.timeout ?? 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Pixelfed API error: ${res.status} ${res.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`,
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public Timeline ───────────────────────────────────────────────

/**
 * Fetch the public timeline from a Pixelfed instance.
 * Defaults to our self-hosted instance.
 */
export async function getPublicTimeline(
  instanceUrl = PIXELFED_LOCAL_INSTANCE,
  options?: {
    limit?: number;
    onlyMedia?: boolean;
    local?: boolean;
    signal?: AbortSignal;
  },
): Promise<PixelfedStatus[]> {
  const limit = options?.limit ?? 20;
  const params = new URLSearchParams({
    limit: String(Math.min(limit, 40)),
    local: options?.local !== false ? 'true' : 'false',
  });
  if (options?.onlyMedia) {
    params.set('only_media', 'true');
  }

  return apiFetch<PixelfedStatus[]>(instanceUrl, `/api/v1/timelines/public?${params.toString()}`, {
    timeout: 6000,
  });
}

// ─── Tag Timeline ──────────────────────────────────────────────────

/**
 * Fetch posts by hashtag from a Pixelfed instance.
 */
export async function getTagTimeline(
  instanceUrl: string,
  tag: string,
  limit = 20,
): Promise<PixelfedStatus[]> {
  const params = new URLSearchParams({
    limit: String(Math.min(limit, 40)),
  });

  return apiFetch<PixelfedStatus[]>(
    instanceUrl,
    `/api/v1/timelines/tag/${encodeURIComponent(tag)}?${params.toString()}`,
    { timeout: 6000 },
  );
}

// ─── Account Posts ─────────────────────────────────────────────────

/**
 * Fetch posts from a specific Pixelfed account.
 */
export async function getAccountPosts(
  instanceUrl: string,
  accountId: string,
  limit = 20,
): Promise<PixelfedStatus[]> {
  const params = new URLSearchParams({
    limit: String(Math.min(limit, 40)),
  });

  return apiFetch<PixelfedStatus[]>(
    instanceUrl,
    `/api/v1/accounts/${encodeURIComponent(accountId)}/statuses?${params.toString()}`,
    { timeout: 6000 },
  );
}

// ─── Account Details ───────────────────────────────────────────────

/**
 * Fetch a single Pixelfed account/profile.
 */
export async function getAccount(instanceUrl: string, accountId: string): Promise<PixelfedAccount> {
  return apiFetch<PixelfedAccount>(
    instanceUrl,
    `/api/v1/accounts/${encodeURIComponent(accountId)}`,
    { timeout: 6000 },
  );
}

// ─── Search Accounts ───────────────────────────────────────────────

/**
 * Search for Pixelfed accounts by query string.
 */
export async function searchAccounts(
  instanceUrl: string,
  query: string,
  limit = 10,
): Promise<PixelfedAccount[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit, 40)),
  });

  return apiFetch<PixelfedAccount[]>(instanceUrl, `/api/v1/accounts/search?${params.toString()}`, {
    timeout: 6000,
  });
}

// ─── Normalization ─────────────────────────────────────────────────

/**
 * Normalize a Pixelfed API status to a UnifiedPost.
 *
 * Pixelfed is primarily photo-sharing, so:
 * - contentType is 'image' for image media, 'video' for videos
 * - Media attachments are mapped to embeds
 * - Alt text from media descriptions is preserved
 */
export function normalizePixelfedPost(
  status: PixelfedStatus,
  instanceUrl: string,
  author?: UnifiedIdentity,
): UnifiedPost {
  const identity = accountToIdentity(status.account, instanceUrl, author);
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;

  const html = original.content || '';
  const text = stripHtml(html);

  const embeds: Embed[] = [];
  let hasVideo = false;
  let hasImage = false;

  for (const media of original.media_attachments) {
    if (media.type === 'image' || media.type === 'gifv') {
      embeds.push({
        kind: 'image',
        url: media.url,
        meta: {
          description: media.description,
          blurhash: media.blurhash,
          width: (media.meta?.original as Record<string, unknown>)?.width,
          height: (media.meta?.original as Record<string, unknown>)?.height,
        },
      });
      hasImage = true;
    } else if (media.type === 'video') {
      embeds.push({
        kind: 'video',
        url: media.url,
        meta: {
          description: media.description,
          blurhash: media.blurhash,
          duration: (media.meta?.original as Record<string, unknown>)?.duration,
        },
      });
      hasVideo = true;
    }
  }

  if (original.card) {
    embeds.push({
      kind: 'link',
      url: original.card.url,
      meta: {
        title: original.card.title,
        description: original.card.description,
        image: original.card.image,
      },
    });
  }

  const finalText = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${text}` : text;

  const nativeId = isBoost ? `boost:${status.id}:${original.id}` : original.id;

  return buildUnifiedPost({
    protocol: 'pixelfed' as Protocol,
    nativeId,
    author: identity,
    text: finalText,
    html,
    embeds,
    parentNativeId: original.in_reply_to_id ?? undefined,
    createdAt: new Date(original.created_at).getTime(),
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    viewer: {
      liked: original.favourited ?? false,
      reposted: original.reblogged ?? false,
    },
    raw: status,
  });
}

/**
 * Convert a Pixelfed account to a UnifiedIdentity.
 */
export function accountToIdentity(
  account: PixelfedAccount,
  instanceUrl: string,
  existing?: UnifiedIdentity,
): UnifiedIdentity {
  const hostname = new URL(instanceUrl).hostname;
  const handle = account.acct.includes('@') ? account.acct : `${account.acct}@${hostname}`;

  const identity: UnifiedIdentity = {
    id: existing?.id ?? `pixelfed:${account.id}@${hostname}`,
    primary: existing?.primary ?? { protocol: 'pixelfed' as Protocol, id: account.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
      pixelfed: handle,
    } as Partial<Record<Protocol, string | null>>,
    displayName: account.display_name || account.username,
    bio: stripHtml(account.note),
    avatarUrl: account.avatar,
    bannerUrl: account.header !== account.header_static ? account.header : undefined,
    verified: account.fields
      .filter((f) => f.verified_at)
      .map((f) => ({ protocol: 'pixelfed' as Protocol, badge: f.name })),
    followerCount: account.followers_count,
    followingCount: account.following_count,
    links: account.fields.map((f) => ({ label: f.name, url: f.value })),
    keys: {},
  };

  if (existing) {
    identity.links = [...new Set([...existing.links, ...identity.links])];
  }

  return identity;
}

// ─── Class-based Client ────────────────────────────────────────────

export class PixelfedClient {
  private instanceUrl: string;
  private accessToken: string | null = null;
  private userAgent: string;

  constructor(instanceUrl: string, accessToken?: string, userAgent: string = DEFAULT_USER_AGENT) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    if (accessToken) this.accessToken = accessToken;
    this.userAgent = userAgent;
  }

  setAuth(token: string): void {
    this.accessToken = token;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(this.instanceUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': this.userAgent,
    };

    if (this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }

    if (body && method !== 'GET') {
      headers['content-type'] = 'application/json';
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      const errText = await res.text().catch(() => '');
      throw new Error(
        `PixelfedClient error: ${res.status} ${res.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`,
      );
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // ── Auth / Identity ──

  async verifyCredentials(): Promise<PixelfedAccount> {
    return this.get<PixelfedAccount>('/api/v1/accounts/verify_credentials');
  }

  // ── Account ──

  async getAccount(accountId: string): Promise<PixelfedAccount> {
    return this.get<PixelfedAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}`);
  }

  async lookupAccount(acct: string): Promise<PixelfedAccount> {
    return this.get<PixelfedAccount>('/api/v1/accounts/lookup', { acct });
  }

  async getAccountStatuses(accountId: string, limit = 20): Promise<PixelfedStatus[]> {
    return this.get<PixelfedStatus[]>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/statuses`,
      { limit },
    );
  }

  // ── Timeline ──

  async getPublicTimeline(limit = 20, onlyMedia = false): Promise<PixelfedStatus[]> {
    return this.get<PixelfedStatus[]>('/api/v1/timelines/public', {
      limit,
      local: 'true' as unknown as number,
      ...(onlyMedia ? { only_media: 'true' as unknown as number } : {}),
    });
  }

  async getTagTimeline(tag: string, limit = 20): Promise<PixelfedStatus[]> {
    return this.get<PixelfedStatus[]>(`/api/v1/timelines/tag/${encodeURIComponent(tag)}`, {
      limit,
    });
  }

  // ── Write ──

  async publish(
    status: string,
    opts?: {
      mediaIds?: string[];
      inReplyToId?: string;
      sensitive?: boolean;
      spoilerText?: string;
      visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    },
  ): Promise<PixelfedStatus> {
    const body: Record<string, unknown> = { status };
    if (opts?.mediaIds?.length) body.media_ids = opts.mediaIds;
    if (opts?.inReplyToId) body.in_reply_to_id = opts.inReplyToId;
    if (opts?.sensitive) body.sensitive = true;
    if (opts?.spoilerText) body.spoiler_text = opts.spoilerText;
    if (opts?.visibility) body.visibility = opts.visibility;
    return this.post<PixelfedStatus>('/api/v1/statuses', body);
  }

  // ── Interactions ──

  async like(statusId: string): Promise<PixelfedStatus> {
    return this.post<PixelfedStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/favourite`);
  }

  async unlike(statusId: string): Promise<PixelfedStatus> {
    return this.post<PixelfedStatus>(
      `/api/v1/statuses/${encodeURIComponent(statusId)}/unfavourite`,
    );
  }

  async repost(statusId: string): Promise<PixelfedStatus> {
    return this.post<PixelfedStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/reblog`);
  }

  async unrepost(statusId: string): Promise<PixelfedStatus> {
    return this.post<PixelfedStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/unreblog`);
  }

  async bookmark(statusId: string): Promise<PixelfedStatus> {
    return this.post<PixelfedStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/bookmark`);
  }

  async unbookmark(statusId: string): Promise<PixelfedStatus> {
    return this.post<PixelfedStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/unbookmark`);
  }

  async follow(accountId: string): Promise<PixelfedAccount> {
    return this.post<PixelfedAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}/follow`);
  }

  async unfollow(accountId: string): Promise<PixelfedAccount> {
    return this.post<PixelfedAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}/unfollow`);
  }

  // ── Media Upload ──

  async uploadMedia(
    imageBuffer: ArrayBuffer | Uint8Array,
    filename: string,
    description?: string,
  ): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
    if (!this.accessToken) {
      return { ok: false, error: 'PixelfedClient: access token required for media upload' };
    }

    const formData = new FormData();
    const mimeType = filename.endsWith('.png')
      ? 'image/png'
      : filename.endsWith('.gif')
        ? 'image/gif'
        : 'image/jpeg';
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    if (description) formData.append('description', description);

    try {
      const res = await fetch(`${this.instanceUrl}/api/v1/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Upload HTTP ${res.status}: ${text.slice(0, 200)}` };
      }

      const data = (await res.json()) as PixelfedMediaResult;
      if (!data?.id) {
        return { ok: false, error: 'Media upload returned no ID' };
      }

      return { ok: true, mediaId: data.id };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

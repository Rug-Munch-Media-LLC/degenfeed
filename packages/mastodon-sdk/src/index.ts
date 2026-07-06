/**
 * @degenfeed/mastodon-sdk
 *
 * GotoSocial / Mastodon API client.
 *
 * GotoSocial (https://gotosocial.org) is a lightweight ActivityPub server
 * written in Go (~50MB RAM, single binary). It implements the full Mastodon
 * client API, making this SDK fully compatible.
 *
 * Also works with Mastodon, Pleroma, Akkoma, and Misskey servers.
 *
 * All posts normalize to @degenfeed/types `UnifiedPost`.
 *
 * ## Architecture
 *
 *   GtSClient.connect(instanceUrl, accessToken) → GtSClient
 *     .getPublicTimeline(limit, cursor)   → UnifiedPost[]
 *     .getHomeTimeline(limit, cursor)     → UnifiedPost[] (auth required)
 *     .getAccountStatuses(accountId)      → UnifiedPost[]
 *     .getPost(id)                        → UnifiedPost
 *     .publish(text, opts)                → UnifiedPost
 *     .like(id)                           → void
 *     .repost(id)                         → void
 *     .reply(postId, text)                → UnifiedPost
 *     .getProfile(accountId)              → UnifiedIdentity
 *
 * ## Auth
 *   - Public read endpoints: NO AUTH required
 *   - Home timeline, write, engage: OAuth2 token or application token
 *   - GotoSocial supports app registration + token flow
 *
 * ## GotoSocial vs Mastodon
 *   GotoSocial is:
 *     - Single binary, no external deps (SQLite by default)
 *     - ~50MB RAM at idle vs Mastodon's ~1GB+
 *     - Full Mastodon API compatibility
 *     - Perfect for single-user or small community instances
 */

import { buildUnifiedPost, detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost, Embed };

// ─── API types (GoToSocial / Mastodon) ────────────────────────────────

export interface GtSStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: GtSMediaAttachment[];
  mentions: { id: string; username: string; url: string; acct: string }[];
  tags: { name: string; url: string }[];
  emojis: { shortcode: string; url: string }[];
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  reblog: GtSStatus | null;
  card: GtSCard | null;
  poll: GtSPoll | null;
  account: GtSAccount;
  favourited?: boolean;
  reblogged?: boolean;
  muted?: boolean;
  bookmarked?: boolean;
}

export interface GtSAccount {
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
  emojis: { shortcode: string; url: string }[];
  fields: { name: string; value: string; verified_at: string | null }[];
}

export interface GtSMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
  preview_url: string;
  remote_url: string | null;
  meta: Record<string, unknown>;
  description: string | null;
  blurhash: string | null;
}

export interface GtSCard {
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

export interface GtSPoll {
  id: string;
  options: { title: string; votes_count: number | null }[];
  voted: boolean;
  multiple: boolean;
  voters_count: number | null;
  votes_count: number;
  expired: boolean;
  expires_at: string | null;
}

// ─── Client ───────────────────────────────────────────────────────────

export class GtSClient {
  private instanceUrl: string;
  private accessToken: string | null = null;

  /**
   * @param instanceUrl The base URL of the GotoSocial instance
   *   (e.g. 'https://social.degenfeed.xyz' or 'https://mastodon.social')
   * @param accessToken Optional OAuth2 access token
   */
  constructor(instanceUrl: string, accessToken?: string) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    if (accessToken) this.accessToken = accessToken;
  }

  setAuth(accessToken: string): void {
    this.accessToken = accessToken;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  // ─── API request helper ────────────────────────────────────────────

  private async api<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(this.instanceUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    if (body && method !== 'GET') headers['content-type'] = 'application/json';
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `GtS API error: ${res.status} ${res.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`,
      );
    }
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    return this.api<T>('GET', path, undefined, params);
  }

  private async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.api<T>('POST', path, body);
  }

  // ─── Timeline endpoints ────────────────────────────────────────────

  /** Get the public (local) timeline. No auth required. */
  async getPublicTimeline(limit = 20, maxId?: string): Promise<GtSStatus[]> {
    const params: Record<string, string | number> = { limit, local: 'true' as string };
    if (maxId) params.max_id = maxId;
    return this.get<GtSStatus[]>('/api/v1/timelines/public', params);
  }

  /** Get the federated timeline. No auth required. */
  async getFederatedTimeline(limit = 20, maxId?: string): Promise<GtSStatus[]> {
    const params: Record<string, string | number> = { limit };
    if (maxId) params.max_id = maxId;
    return this.get<GtSStatus[]>('/api/v1/timelines/public', params);
  }

  /** Get home timeline (people you follow). Requires auth. */
  async getHomeTimeline(limit = 20, maxId?: string): Promise<GtSStatus[]> {
    const params: Record<string, string | number> = { limit };
    if (maxId) params.max_id = maxId;
    return this.get<GtSStatus[]>('/api/v1/timelines/home', params);
  }

  /** Get a hashtag timeline. */
  async getHashtagTimeline(hashtag: string, limit = 20): Promise<GtSStatus[]> {
    return this.get<GtSStatus[]>(`/api/v1/timelines/tag/${encodeURIComponent(hashtag)}`, { limit });
  }

  // ─── Account endpoints ─────────────────────────────────────────────

  async verifyCredentials(): Promise<GtSAccount> {
    return this.get<GtSAccount>('/api/v1/accounts/verify_credentials');
  }

  async getAccount(accountId: string): Promise<GtSAccount> {
    return this.get<GtSAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}`);
  }

  async lookupAccount(acct: string): Promise<GtSAccount> {
    return this.get<GtSAccount>('/api/v1/accounts/lookup', { acct });
  }

  async getAccountStatuses(
    accountId: string,
    limit = 20,
    excludeReplies = false,
    maxId?: string,
  ): Promise<GtSStatus[]> {
    const params: Record<string, string | number> = { limit };
    if (excludeReplies) params.exclude_replies = 'true';
    if (maxId) params.max_id = maxId;
    return this.get<GtSStatus[]>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/statuses`,
      params,
    );
  }

  // ─── Status endpoints ──────────────────────────────────────────────

  async getStatus(statusId: string): Promise<GtSStatus> {
    return this.get<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}`);
  }

  async getStatusContext(
    statusId: string,
  ): Promise<{ ancestors: GtSStatus[]; descendants: GtSStatus[] }> {
    return this.get<{ ancestors: GtSStatus[]; descendants: GtSStatus[] }>(
      `/api/v1/statuses/${encodeURIComponent(statusId)}/context`,
    );
  }

  // ─── Write endpoints (require auth) ────────────────────────────────

  async publish(
    text: string,
    opts?: {
      inReplyToId?: string;
      mediaIds?: string[];
      sensitive?: boolean;
      spoilerText?: string;
      visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    },
  ): Promise<GtSStatus> {
    const body: Record<string, unknown> = { status: text };
    if (opts?.inReplyToId) body.in_reply_to_id = opts.inReplyToId;
    if (opts?.mediaIds?.length) body.media_ids = opts.mediaIds;
    if (opts?.sensitive) body.sensitive = true;
    if (opts?.spoilerText) body.spoiler_text = opts.spoilerText;
    if (opts?.visibility) body.visibility = opts.visibility;
    return this.post<GtSStatus>('/api/v1/statuses', body);
  }

  async like(statusId: string): Promise<GtSStatus> {
    return this.post<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/favourite`);
  }

  async unlike(statusId: string): Promise<GtSStatus> {
    return this.post<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/unfavourite`);
  }

  async repost(statusId: string): Promise<GtSStatus> {
    return this.post<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/reblog`);
  }

  async unrepost(statusId: string): Promise<GtSStatus> {
    return this.post<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/unreblog`);
  }

  async bookmark(statusId: string): Promise<GtSStatus> {
    return this.post<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/bookmark`);
  }

  async unbookmark(statusId: string): Promise<GtSStatus> {
    return this.post<GtSStatus>(`/api/v1/statuses/${encodeURIComponent(statusId)}/unbookmark`);
  }

  async follow(accountId: string): Promise<GtSAccount> {
    return this.post<GtSAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}/follow`);
  }

  async unfollow(accountId: string): Promise<GtSAccount> {
    return this.post<GtSAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}/unfollow`);
  }

  // ─── Search ────────────────────────────────────────────────────────

  async search(
    query: string,
    type?: 'accounts' | 'statuses' | 'hashtags',
    limit = 20,
  ): Promise<{
    accounts: GtSAccount[];
    statuses: GtSStatus[];
    hashtags: { name: string; url: string }[];
  }> {
    const params: Record<string, string | number> = { q: query, limit };
    if (type) params.type = type;
    return this.get<{
      accounts: GtSAccount[];
      statuses: GtSStatus[];
      hashtags: { name: string; url: string }[];
    }>('/api/v2/search', params);
  }
}

// ─── Normalizers ───────────────────────────────────────────────────────

/**
 * Normalize a GotoSocial status to UnifiedPost.
 */
export function statusToUnifiedPost(
  status: GtSStatus,
  instanceUrl: string,
  author?: UnifiedIdentity,
): UnifiedPost {
  const identity = accountToIdentity(status.account, instanceUrl, author);
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;

  const html = original.content || '';
  const text = stripHtml(html);

  // Extract embeds
  const embeds: Embed[] = [];
  for (const media of original.media_attachments) {
    if (media.type === 'image' || media.type === 'gifv') {
      embeds.push({ kind: 'image', url: media.url });
    } else if (media.type === 'video') {
      embeds.push({ kind: 'video', url: media.url });
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

  const _niches = detectNiches(`${finalText} ${original.tags.map((t) => t.name).join(' ')}`);

  const nativeId = isBoost ? `boost:${status.id}:${original.id}` : original.id;

  return buildUnifiedPost({
    protocol: 'mastodon',
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
    viewer: { liked: original.favourited ?? false, reposted: original.reblogged ?? false },
    raw: status,
  });
}

/**
 * Normalize a GotoSocial account to UnifiedIdentity.
 */
export function accountToIdentity(
  account: GtSAccount,
  instanceUrl: string,
  existing?: UnifiedIdentity,
): UnifiedIdentity {
  const hostname = new URL(instanceUrl).hostname;
  const handle = account.acct.includes('@') ? account.acct : `${account.acct}@${hostname}`;

  const identity: UnifiedIdentity = {
    id: existing?.id ?? `mastodon:${account.id}@${hostname}`,
    primary: existing?.primary ?? { protocol: 'mastodon', id: account.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: handle,
    },
    displayName: account.display_name || account.username,
    bio: stripHtml(account.note),
    avatarUrl: account.avatar,
    bannerUrl: account.header !== account.avatar_static ? account.header : undefined,
    verified: account.fields
      .filter((f) => f.verified_at)
      .map((f) => ({ protocol: 'mastodon' as Protocol, badge: f.name })),
    followerCount: account.followers_count,
    followingCount: account.following_count,
    links: account.fields.map((f) => ({ label: f.name, url: f.value })),
    keys: {},
  };

  if (existing) identity.links = [...new Set([...existing.links, ...identity.links])];
  return identity;
}

// ─── Helpers ────────────────────────────────────────────────────────────

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

/**
 * @degenfeed/mastodon-sdk
 *
 * GotoSocial / Mastodon API client for auth, identity, and write operations.
 */

import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Embed, Protocol, UnifiedIdentity, UnifiedPost };

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

export const DEFAULT_USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

export class GtSClient {
  private instanceUrl: string;
  private accessToken: string | null = null;
  private userAgent: string;

  constructor(instanceUrl: string, accessToken?: string, userAgent: string = DEFAULT_USER_AGENT) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    if (accessToken) this.accessToken = accessToken;
    this.userAgent = userAgent;
  }

  setUserAgent(userAgent: string): void {
    this.userAgent = userAgent;
  }

  setAuth(accessToken: string): void {
    this.accessToken = accessToken;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

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
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': this.userAgent,
    };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    if (body && method !== 'GET') headers['content-type'] = 'application/json';
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      const errText = await res.text().catch(() => '');
      throw new Error(
        `GtS API error: ${res.status} ${res.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`,
      );
    }
    return res.json() as Promise<T>;
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    return this.api<T>('GET', path, undefined, params);
  }

  private async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.api<T>('POST', path, body);
  }

  async verifyCredentials(): Promise<GtSAccount> {
    return this.get<GtSAccount>('/api/v1/accounts/verify_credentials');
  }

  async getAccount(accountId: string): Promise<GtSAccount> {
    return this.get<GtSAccount>(`/api/v1/accounts/${encodeURIComponent(accountId)}`);
  }

  async lookupAccount(acct: string): Promise<GtSAccount> {
    return this.get<GtSAccount>('/api/v1/accounts/lookup', { acct });
  }

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
}

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

function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

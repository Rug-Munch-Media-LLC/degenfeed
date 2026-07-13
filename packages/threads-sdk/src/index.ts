/**
 * @degenfeed/threads-sdk — Official Meta Threads API client.
 *
 * Uses the graph.threads.net Graph API (not AT Protocol — Threads never
 * shipped AT Protocol. That was an early assumption that was wrong.)
 *
 * API reference: https://developers.facebook.com/docs/threads
 *
 * Limitations:
 *   - This is a PUBLISHING API. You can read YOUR OWN threads and reply
 *     to them. You CANNOT read arbitrary public profiles — Meta does not
 *     offer a public read API for Threads. The feed-provider scraper is
 *     still needed for reading curated handles.
 *   - Engagement (like/repost on other people's threads) is NOT supported
 *     by the official API. Users must engage via the Threads app.
 */

import type { Protocol } from '@degenfeed/types';

export type { Protocol };

export const THREADS_GRAPH_API = 'https://graph.threads.net/v1.0';
export const THREADS_OAUTH_BASE = 'https://www.facebook.com/v22.0';
export const THREADS_WEB_URL = 'https://www.threads.net';

export interface ThreadsUserProfile {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  biography?: string;
  followers_count?: number;
}

export interface ThreadsMedia {
  id: string;
  timestamp: string;
  permalink?: string;
  text?: string;
  media_type?: string;
  media_url?: string;
  media_product_type?: string;
  thumbnail_url?: string;
  like_count?: number;
  reply_count?: number;
  quote_count?: number;
  repost_count?: number;
  is_quote_post?: boolean;
  children?: { data: ThreadsMedia[] };
}

interface ThreadsListResponse<T> {
  data: T[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string; previous?: string };
}

interface ThreadsContainerResponse {
  id: string;
}

export class ThreadsClient {
  private accessToken: string;
  private userId: string;

  constructor(accessToken: string, userId: string) {
    this.accessToken = accessToken;
    this.userId = userId;
  }

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${THREADS_GRAPH_API}/${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Threads API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async getProfile(): Promise<ThreadsUserProfile> {
    return this.api<ThreadsUserProfile>(
      `${this.userId}?fields=id,username,name,profile_picture_url,biography,followers_count`,
    );
  }

  async getUserThreads(limit = 25): Promise<ThreadsMedia[]> {
    const data = await this.api<ThreadsListResponse<ThreadsMedia>>(
      `${this.userId}/threads?fields=id,timestamp,permalink,text,media_type,media_url,media_product_type,thumbnail_url,like_count,reply_count,quote_count,repost_count,is_quote_post,children{id,media_type,media_url,thumbnail_url}&limit=${limit}`,
    );
    return data.data;
  }

  async getThread(threadId: string): Promise<ThreadsMedia> {
    return this.api<ThreadsMedia>(
      `${threadId}?fields=id,timestamp,permalink,text,media_type,media_url,media_product_type,thumbnail_url,like_count,reply_count,quote_count,repost_count,is_quote_post`,
    );
  }

  async getThreadReplies(threadId: string, limit = 25): Promise<ThreadsMedia[]> {
    const data = await this.api<ThreadsListResponse<ThreadsMedia>>(
      `${threadId}/replies?fields=id,timestamp,permalink,text,media_type,media_url,like_count,reply_count&limit=${limit}`,
    );
    return data.data;
  }

  async createThread(text: string, mediaUrl?: string): Promise<string> {
    const params = new URLSearchParams({
      media_type: 'TEXT',
      text,
    });
    if (mediaUrl) {
      params.set('media_type', 'IMAGE');
      params.set('image_url', mediaUrl);
    }
    const data = await this.api<ThreadsContainerResponse>(`${this.userId}/threads`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return data.id;
  }

  async publishThread(creationId: string): Promise<string> {
    const data = await this.api<ThreadsContainerResponse>(`${this.userId}/threads_publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: creationId }).toString(),
    });
    return data.id;
  }

  async getThreadInsights(threadId: string): Promise<Record<string, unknown>> {
    return this.api<Record<string, unknown>>(
      `${threadId}/insights?metric=views,likes,replies,reposts,quotes`,
    );
  }

  async getLongLivedToken(clientSecret: string): Promise<string> {
    const res = await fetch(
      `${THREADS_OAUTH_BASE}/oauth/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(this.accessToken)}`,
    );
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async refreshLongLivedToken(clientSecret: string): Promise<string> {
    const res = await fetch(
      `${THREADS_OAUTH_BASE}/oauth/access_token?grant_type=th_refresh_token&client_secret=${encodeURIComponent(clientSecret)}&access_token=${encodeURIComponent(this.accessToken)}`,
    );
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }
}

export function buildThreadsAuthorizeUrl(
  appId: string,
  redirectUri: string,
  state: string,
  scope = 'threads_basic,threads_content_publish',
): string {
  return (
    `${THREADS_OAUTH_BASE}/dialog/oauth?` +
    new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
    }).toString()
  );
}

export async function exchangeCodeForToken(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
): Promise<{ accessToken: string; userId: string }> {
  const res = await fetch(
    `${THREADS_OAUTH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      }).toString(),
    { method: 'GET' },
  );
  if (!res.ok) throw new Error(`OAuth exchange failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token?: string;
    user_id?: string;
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(`OAuth error: ${data.error.message}`);
  if (!data.access_token) throw new Error('No access token returned');
  return { accessToken: data.access_token, userId: data.user_id ?? '' };
}

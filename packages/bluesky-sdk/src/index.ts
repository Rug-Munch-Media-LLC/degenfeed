/**
 * @degenfeed/bluesky-sdk
 *
 * Bluesky/AT Protocol client. Communicates with the Bluesky API (XRPC)
 * for reading/writing posts, feeds, follows, and profiles.
 *
 * All posts normalize to @degenfeed/types `UnifiedPost`.
 *
 * ## Architecture
 *
 *   BskyClient.connect(service, auth) → BskyClient
 *     .getTimeline(limit, cursor)  → UnifiedPost[]
 *     .getAuthorFeed(did)          → UnifiedPost[]
 *     .getPost(uri)                → UnifiedPost
 *     .publish(text, opts)         → UnifiedPost
 *     .getProfile(did)             → UnifiedIdentity
 *
 * Free endpoints:
 *   - https://public.api.bsky.app (read-only, unauthenticated)
 *   - https://bsky.social (authenticated for writes)
 *
 * TODO(v1):
 *   - Implement full XRPC client with all endpoints
 *   - Add auth session management (refresh JWT)
 *   - Add post/like/repost/reply helpers
 *   - Add embed support (images, external links, record embeds)
 *   - Add feed generator integration
 */

import { buildUnifiedPost, emptyIdentity } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';
export const BSKY_SOCIAL_URL = 'https://bsky.social';

export interface BskyPostView {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: {
      type: string;
      external?: { uri: string };
      images?: { image: { ref: string }; alt: string }[];
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

export class BskyClient {
  private pdsUrl: string;
  private accessJwt: string | null = null;

  constructor(pdsUrl: string = BSKY_PUBLIC_URL) {
    this.pdsUrl = pdsUrl;
  }

  setAuth(accessJwt: string): void {
    this.accessJwt = accessJwt;
  }

  private async xrpc(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.pdsUrl}${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const headers: Record<string, string> = {};
    if (this.accessJwt) headers.authorization = `Bearer ${this.accessJwt}`;
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`XRPC error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  /** Get the authenticated user's home timeline. */
  async getTimeline(
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: BskyPostView[]; cursor?: string }> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params.cursor = cursor;
    const data = (await this.xrpc('/xrpc/app.bsky.feed.getTimeline', params)) as {
      feed: { post: BskyPostView }[];
      cursor?: string;
    };
    return {
      posts: (data.feed ?? []).map((f) => f.post),
      cursor: data.cursor,
    };
  }

  /** Get an author's feed. */
  async getAuthorFeed(
    actor: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: BskyPostView[]; cursor?: string }> {
    const params: Record<string, string> = { actor, limit: String(limit) };
    if (cursor) params.cursor = cursor;
    const data = (await this.xrpc('/xrpc/app.bsky.feed.getAuthorFeed', params)) as {
      feed: { post: BskyPostView }[];
      cursor?: string;
    };
    return {
      posts: (data.feed ?? []).map((f) => f.post),
      cursor: data.cursor,
    };
  }

  /** Normalize a BskyPostView to UnifiedPost. */
  postToUnifiedPost(post: BskyPostView, author?: UnifiedIdentity): UnifiedPost {
    return buildUnifiedPost({
      protocol: 'bluesky',
      nativeId: post.uri,
      author: author ?? emptyIdentity(),
      text: post.record.text,
      parentNativeId: post.record.reply?.parent.uri,
      rootNativeId: post.record.reply?.root.uri,
      createdAt: new Date(post.record.createdAt).getTime(),
      metrics: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: 0,
      },
      viewer: { liked: false, reposted: false },
      raw: post,
    });
  }

  /** Create a like record. Requires setAuth(). */
  async like(uri: string, cid: string, actorDid: string): Promise<void> {
    await this.createRecord(actorDid, 'app.bsky.feed.like', {
      subject: { uri, cid },
      createdAt: new Date().toISOString(),
    });
  }

  /** Remove a like record. */
  async unlike(uri: string, actorDid: string): Promise<void> {
    await this.deleteRecord(actorDid, 'app.bsky.feed.like', uri);
  }

  /** Create a repost record. Requires setAuth(). */
  async repost(uri: string, cid: string, actorDid: string): Promise<void> {
    await this.createRecord(actorDid, 'app.bsky.feed.repost', {
      subject: { uri, cid },
      createdAt: new Date().toISOString(),
    });
  }

  /** Remove a repost record. */
  async unrepost(uri: string, actorDid: string): Promise<void> {
    await this.deleteRecord(actorDid, 'app.bsky.feed.repost', uri);
  }

  /** Create a reply record. */
  async reply(
    parentUri: string,
    parentCid: string,
    actorDid: string,
    text: string,
    rootUri?: string,
    rootCid?: string,
  ): Promise<void> {
    await this.createRecord(actorDid, 'app.bsky.feed.post', {
      text,
      createdAt: new Date().toISOString(),
      reply: {
        root: { uri: rootUri ?? parentUri, cid: rootCid ?? parentCid },
        parent: { uri: parentUri, cid: parentCid },
      },
    });
  }

  private async createRecord(
    repo: string,
    collection: string,
    record: Record<string, unknown>,
  ): Promise<void> {
    if (!this.accessJwt) throw new Error('Not authenticated');
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.accessJwt}`,
      },
      body: JSON.stringify({ repo, collection, record }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Bluesky createRecord failed: ${errText.slice(0, 100)}`);
    }
  }

  private async deleteRecord(repo: string, collection: string, uri: string): Promise<void> {
    if (!this.accessJwt) throw new Error('Not authenticated');
    const parts = uri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.accessJwt}`,
      },
      body: JSON.stringify({ repo, collection, rkey }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Bluesky deleteRecord failed: ${errText.slice(0, 100)}`);
    }
  }
}

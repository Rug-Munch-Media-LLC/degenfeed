/**
 * @degenfeed/bluesky-sdk — PDS Social Interactions
 *
 * Full social graph interaction: follows, likes, reposts, replies,
 * blocks, mutes, moderation lists, and notifications.
 * All operations go through OUR PDS for complete network ownership.
 *
 * @module @degenfeed/bluesky-sdk/social
 */

import { PDS_DEGENFEED_URL, DEFAULT_USER_AGENT } from './index';
import { PdsAccountError } from './pds-account';

// ─── Types ────────────────────────────────────────────────────────────

export interface LikeResult {
  uri: string;
  cid: string;
}

export interface RepostResult {
  uri: string;
  cid: string;
}

export interface FollowResult {
  uri: string;
  cid: string;
}

export interface BlockResult {
  uri: string;
  cid: string;
}

export interface MuteResult {
  muted: boolean;
}

export interface NotificationView {
  uri: string;
  id: string;
  type: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote';
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  reason: string;
  reasonSubject?: string;
  record?: Record<string, unknown>;
  isRead: boolean;
  indexedAt: string;
  createdAt: string;
}

export interface ListView {
  uri: string;
  cid: string;
  name: string;
  description?: string;
  purpose: 'app.bsky.graph.defs#modlist' | 'app.bsky.graph.defs#curatelist' | 'app.bsky.graph.defs#referencelist';
  createdAt: string;
  indexedAt: string;
  listItemCount?: number;
}

export interface ModlistMember {
  uri: string;
  subject: { did: string; handle?: string };
  createdAt: string;
}

export interface RelationshipResult {
  following?: string; // URI of follow record
  followedBy?: string; // URI of follow record from subject
  blocking?: string; // URI of block record
  blockedBy?: boolean;
  muted?: boolean;
}

export interface GetFeedOpts {
  actor: string;
  limit?: number;
  cursor?: string;
  filter?: 'posts_with_replies' | 'posts_no_replies' | 'posts_and_author_threads';
}

export interface GetTimelineOpts {
  algorithm?: string;
  limit?: number;
  cursor?: string;
}

export interface GetListFeedOpts {
  list: string;
  limit?: number;
  cursor?: string;
}

export interface SearchActorsOpts {
  q: string;
  limit?: number;
  cursor?: string;
}

// ─── Social Client ────────────────────────────────────────────────────

export class PdsSocialClient {
  private pdsUrl: string;
  private accessJwt: string | null = null;
  private did: string | null = null;
  private userAgent: string;

  constructor(
    pdsUrl: string = PDS_DEGENFEED_URL,
    userAgent: string = DEFAULT_USER_AGENT,
  ) {
    this.pdsUrl = pdsUrl;
    this.userAgent = userAgent;
  }

  setAuth(accessJwt: string): void {
    this.accessJwt = accessJwt;
  }

  setDid(did: string): void {
    this.did = did;
  }

  get isAuthenticated(): boolean {
    return this.accessJwt !== null;
  }

  // ── Requires Auth Guard ────────────────────────────────────────

  private ensureAuth(): void {
    if (!this.accessJwt || !this.did) {
      throw new PdsAccountError(
        'Not authenticated — call createSession or createAccount first',
        'NOT_AUTHENTICATED',
        401,
      );
    }
  }

  private authHeaders(): Record<string, string> {
    return this.accessJwt
      ? { authorization: `Bearer ${this.accessJwt}` }
      : {};
  }

  // ── Content Interactions ───────────────────────────────────────

  /**
   * Like a post (at:// URI).
   */
  async like(uri: string, cid: string): Promise<LikeResult> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.like',
        record: {
          subject: { uri, cid },
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Like failed: ${err.slice(0, 200)}`, 'LIKE_FAILED', res.status);
    }
    return res.json() as Promise<LikeResult>;
  }

  /**
   * Unlike a previously liked post.
   */
  async unlike(likeUri: string): Promise<void> {
    this.ensureAuth();
    const parts = likeUri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.like',
        rkey,
      }),
    });
    if (!res.ok) {
      throw new PdsAccountError('Unlike failed', 'UNLIKE_FAILED', res.status);
    }
  }

  /**
   * Repost (share) a post.
   */
  async repost(uri: string, cid: string): Promise<RepostResult> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.repost',
        record: {
          subject: { uri, cid },
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Repost failed: ${err.slice(0, 200)}`, 'REPOST_FAILED', res.status);
    }
    return res.json() as Promise<RepostResult>;
  }

  /**
   * Undo a repost.
   */
  async unrepost(repostUri: string): Promise<void> {
    this.ensureAuth();
    const parts = repostUri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.repost',
        rkey,
      }),
    });
    if (!res.ok) {
      throw new PdsAccountError('Unrepost failed', 'UNREPOST_FAILED', res.status);
    }
  }

  /**
   * Reply to a post.
   */
  async reply(
    parentUri: string,
    parentCid: string,
    text: string,
    rootUri?: string,
    rootCid?: string,
  ): Promise<{ uri: string; cid: string }> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.post',
        record: {
          text,
          reply: {
            root: { uri: rootUri ?? parentUri, cid: rootCid ?? parentCid },
            parent: { uri: parentUri, cid: parentCid },
          },
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Reply failed: ${err.slice(0, 200)}`, 'REPLY_FAILED', res.status);
    }
    return res.json() as Promise<{ uri: string; cid: string }>;
  }

  /**
   * Quote-post a post (a post with an embedded link to another post).
   */
  async quotePost(
    text: string,
    quoteUri: string,
    quoteCid: string,
  ): Promise<{ uri: string; cid: string }> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.post',
        record: {
          text,
          embed: {
            $type: 'app.bsky.embed.record',
            record: { uri: quoteUri, cid: quoteCid },
          },
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Quote post failed: ${err.slice(0, 200)}`, 'QUOTE_FAILED', res.status);
    }
    return res.json() as Promise<{ uri: string; cid: string }>;
  }

  /**
   * Delete a post by its URI.
   */
  async deletePost(postUri: string): Promise<void> {
    this.ensureAuth();
    const parts = postUri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.feed.post',
        rkey,
      }),
    });
    if (!res.ok) {
      throw new PdsAccountError('Delete post failed', 'DELETE_POST_FAILED', res.status);
    }
  }

  // ── Social Graph Interactions ──────────────────────────────────

  /**
   * Follow a user by their DID.
   */
  async follow(subjectDid: string): Promise<FollowResult> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.follow',
        record: {
          subject: subjectDid,
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Follow failed: ${err.slice(0, 200)}`, 'FOLLOW_FAILED', res.status);
    }
    return res.json() as Promise<FollowResult>;
  }

  /**
   * Unfollow a user by the follow record URI.
   */
  async unfollow(followUri: string): Promise<void> {
    this.ensureAuth();
    const parts = followUri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.follow',
        rkey,
      }),
    });
    if (!res.ok) {
      throw new PdsAccountError('Unfollow failed', 'UNFOLLOW_FAILED', res.status);
    }
  }

  /**
   * Get the authenticated user's follows.
   */
  async getFollows(
    actor: string,
    limit = 50,
    cursor?: string,
  ): Promise<{
    follows: Array<{ did: string; handle: string; displayName?: string; avatar?: string }>;
    cursor?: string;
  }> {
    const params = new URLSearchParams({
      actor,
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.graph.getFollows?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get follows', 'GET_FOLLOWS_FAILED', res.status);
    }
    return res.json() as Promise<{
      follows: Array<{ did: string; handle: string; displayName?: string; avatar?: string }>;
      cursor?: string;
    }>;
  }

  /**
   * Get the authenticated user's followers.
   */
  async getFollowers(
    actor: string,
    limit = 50,
    cursor?: string,
  ): Promise<{
    followers: Array<{ did: string; handle: string; displayName?: string; avatar?: string }>;
    cursor?: string;
  }> {
    const params = new URLSearchParams({
      actor,
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.graph.getFollowers?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get followers', 'GET_FOLLOWERS_FAILED', res.status);
    }
    return res.json() as Promise<{
      followers: Array<{ did: string; handle: string; displayName?: string; avatar?: string }>;
      cursor?: string;
    }>;
  }

  // ── Blocking & Moderation ──────────────────────────────────────

  /**
   * Block a user by their DID.
   */
  async block(subjectDid: string): Promise<BlockResult> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.block',
        record: {
          subject: subjectDid,
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Block failed: ${err.slice(0, 200)}`, 'BLOCK_FAILED', res.status);
    }
    return res.json() as Promise<BlockResult>;
  }

  /**
   * Unblock a user by the block record URI.
   */
  async unblock(blockUri: string): Promise<void> {
    this.ensureAuth();
    const parts = blockUri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.block',
        rkey,
      }),
    });
    if (!res.ok) {
      throw new PdsAccountError('Unblock failed', 'UNBLOCK_FAILED', res.status);
    }
  }

  /**
   * Get list of blocked users.
   */
  async getBlocks(
    limit = 50,
    cursor?: string,
  ): Promise<{
    blocks: Array<{
      uri: string;
      subject: { did: string; handle?: string; displayName?: string; avatar?: string };
      createdAt: string;
    }>;
    cursor?: string;
  }> {
    this.ensureAuth();
    const params = new URLSearchParams({
      actor: this.did!,
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.graph.getBlocks?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get blocks', 'GET_BLOCKS_FAILED', res.status);
    }
    return res.json() as Promise<{
      blocks: Array<{
        uri: string;
        subject: { did: string; handle?: string; displayName?: string; avatar?: string };
        createdAt: string;
      }>;
      cursor?: string;
    }>;
  }

  /**
   * Mute a user by their DID.
   */
  async mute(subjectDid: string): Promise<MuteResult> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/app.bsky.graph.muteActor`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({ actor: subjectDid }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Mute failed: ${err.slice(0, 200)}`, 'MUTE_FAILED', res.status);
    }
    return { muted: true };
  }

  /**
   * Unmute a user by their DID.
   */
  async unmute(subjectDid: string): Promise<MuteResult> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/app.bsky.graph.unmuteActor`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({ actor: subjectDid }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Unmute failed: ${err.slice(0, 200)}`, 'UNMUTE_FAILED', res.status);
    }
    return { muted: false };
  }

  /**
   * Get list of muted users.
   */
  async getMutes(
    limit = 50,
    cursor?: string,
  ): Promise<{
    mutes: Array<{
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    }>;
    cursor?: string;
  }> {
    this.ensureAuth();
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.graph.getMutes?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get mutes', 'GET_MUTES_FAILED', res.status);
    }
    return res.json() as Promise<{
      mutes: Array<{
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      }>;
      cursor?: string;
    }>;
  }

  // ── Relationship ───────────────────────────────────────────────

  /**
   * Get the relationship between the authenticated user and another actor.
   */
  async getRelationship(actor: string): Promise<RelationshipResult> {
    this.ensureAuth();
    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.graph.getRelationship?actor=${encodeURIComponent(this.did!)}&other=${encodeURIComponent(actor)}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get relationship', 'RELATIONSHIP_FAILED', res.status);
    }
    return res.json() as Promise<RelationshipResult>;
  }

  // ── Moderation Lists ───────────────────────────────────────────

  /**
   * Create a moderation list (block list, mute list, or curation list).
   */
  async createList(
    name: string,
    purpose: ListView['purpose'],
    description?: string,
  ): Promise<{ uri: string; cid: string }> {
    this.ensureAuth();
    const record: Record<string, unknown> = {
      name,
      purpose,
      createdAt: new Date().toISOString(),
    };
    if (description) record.description = description;

    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.list',
        record,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Create list failed: ${err.slice(0, 200)}`, 'LIST_CREATE_FAILED', res.status);
    }
    return res.json() as Promise<{ uri: string; cid: string }>;
  }

  /**
   * Add a user to a moderation list.
   */
  async addToList(listUri: string, subjectDid: string): Promise<{ uri: string; cid: string }> {
    this.ensureAuth();
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.listitem',
        record: {
          list: listUri,
          subject: subjectDid,
          createdAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new PdsAccountError(`Add to list failed: ${err.slice(0, 200)}`, 'LIST_ADD_FAILED', res.status);
    }
    return res.json() as Promise<{ uri: string; cid: string }>;
  }

  /**
   * Remove a user from a moderation list.
   */
  async removeFromList(listItemUri: string): Promise<void> {
    this.ensureAuth();
    const parts = listItemUri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        repo: this.did,
        collection: 'app.bsky.graph.listitem',
        rkey,
      }),
    });
    if (!res.ok) {
      throw new PdsAccountError('Remove from list failed', 'LIST_REMOVE_FAILED', res.status);
    }
  }

  // ── Notifications ──────────────────────────────────────────────

  /**
   * Get unread notification count.
   */
  async getUnreadNotificationCount(): Promise<{ count: number }> {
    this.ensureAuth();
    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.notification.getUnreadCount`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get unread count', 'NOTIFICATION_COUNT_FAILED', res.status);
    }
    return res.json() as Promise<{ count: number }>;
  }

  /**
   * Get notifications for the authenticated user.
   */
  async getNotifications(
    limit = 50,
    cursor?: string,
  ): Promise<{
    notifications: NotificationView[];
    cursor?: string;
  }> {
    this.ensureAuth();
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.notification.listNotifications?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get notifications', 'NOTIFICATIONS_FAILED', res.status);
    }
    return res.json() as Promise<{
      notifications: NotificationView[];
      cursor?: string;
    }>;
  }

  /**
   * Mark all notifications as read.
   */
  async markNotificationsRead(): Promise<void> {
    this.ensureAuth();
    await fetch(`${this.pdsUrl}/xrpc/app.bsky.notification.updateSeen`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        ...this.authHeaders(),
      },
      body: JSON.stringify({ seenAt: new Date().toISOString() }),
    }).catch(() => {
      // Non-critical — notification read state is not blocking
    });
  }

  // ── Timelines & Feeds ──────────────────────────────────────────

  /**
   * Get the authenticated user's home timeline.
   */
  async getTimeline(
    opts: GetTimelineOpts = {},
  ): Promise<{
    feed: Array<{ post: Record<string, unknown>; reply?: Record<string, unknown> }>;
    cursor?: string;
  }> {
    this.ensureAuth();
    const params = new URLSearchParams({
      limit: String(Math.min(opts.limit ?? 50, 100)),
    });
    if (opts.algorithm) params.set('algorithm', opts.algorithm);
    if (opts.cursor) params.set('cursor', opts.cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.feed.getTimeline?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get timeline', 'TIMELINE_FAILED', res.status);
    }
    return res.json() as Promise<{
      feed: Array<{ post: Record<string, unknown>; reply?: Record<string, unknown> }>;
      cursor?: string;
    }>;
  }

  /**
   * Get an author's feed.
   */
  async getAuthorFeed(opts: GetFeedOpts): Promise<{
    feed: Array<{ post: Record<string, unknown> }>;
    cursor?: string;
  }> {
    const params = new URLSearchParams({
      actor: opts.actor,
      limit: String(Math.min(opts.limit ?? 50, 100)),
    });
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.filter) params.set('filter', opts.filter);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.feed.getAuthorFeed?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get author feed', 'AUTHOR_FEED_FAILED', res.status);
    }
    return res.json() as Promise<{
      feed: Array<{ post: Record<string, unknown> }>;
      cursor?: string;
    }>;
  }

  /**
   * Get a post thread (post + replies).
   */
  async getPostThread(uri: string, depth = 6, parentHeight = 80): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
      uri,
      depth: String(depth),
      parentHeight: String(parentHeight),
    });

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.feed.getPostThread?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get post thread', 'THREAD_FAILED', res.status);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Search for posts via the PDS.
   */
  async searchPosts(
    q: string,
    limit = 25,
    cursor?: string,
  ): Promise<{
    posts: Array<Record<string, unknown>>;
    cursor?: string;
  }> {
    const params = new URLSearchParams({
      q,
      limit: String(Math.min(limit, 100)),
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.feed.searchPosts?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Search failed', 'SEARCH_FAILED', res.status);
    }
    return res.json() as Promise<{
      posts: Array<Record<string, unknown>>;
      cursor?: string;
    }>;
  }

  /**
   * Search for actors/users.
   */
  async searchActors(opts: SearchActorsOpts): Promise<{
    actors: Array<{
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
      description?: string;
      followerCount?: number;
    }>;
    cursor?: string;
  }> {
    const params = new URLSearchParams({
      q: opts.q,
      limit: String(Math.min(opts.limit ?? 25, 100)),
    });
    if (opts.cursor) params.set('cursor', opts.cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.actor.searchActors?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Actor search failed', 'ACTOR_SEARCH_FAILED', res.status);
    }
    return res.json() as Promise<{
      actors: Array<{
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
        description?: string;
        followerCount?: number;
      }>;
      cursor?: string;
    }>;
  }

  /**
   * Get posts from a list feed.
   */
  async getListFeed(opts: GetListFeedOpts): Promise<{
    feed: Array<{ post: Record<string, unknown> }>;
    cursor?: string;
  }> {
    this.ensureAuth();
    const params = new URLSearchParams({
      list: opts.list,
      limit: String(Math.min(opts.limit ?? 50, 100)),
    });
    if (opts.cursor) params.set('cursor', opts.cursor);

    const res = await fetch(
      `${this.pdsUrl}/xrpc/app.bsky.feed.getListFeed?${params.toString()}`,
      {
        headers: {
          'user-agent': this.userAgent,
          ...this.authHeaders(),
        },
      },
    );
    if (!res.ok) {
      throw new PdsAccountError('Failed to get list feed', 'LIST_FEED_FAILED', res.status);
    }
    return res.json() as Promise<{
      feed: Array<{ post: Record<string, unknown> }>;
      cursor?: string;
    }>;
  }
}

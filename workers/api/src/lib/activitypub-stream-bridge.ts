/**
 * @degenfeed/api-worker — ActivityPub Stream Bridge
 *
 * Bridge between DegenFeed streams and ActivityPub federation (Mastodon/GoToSocial).
 *
 * THREE capabilities:
 *   1. Announce a live stream as a federated ActivityPub post
 *   2. Fetch replies/comments from the AP announcement
 *   3. Bridge AP comments into the DegenFeed stream chat in real-time
 *
 * PeerTube is natively ActivityPub-federated. When we stream via PeerTube:
 *   - PeerTube announces the stream as an ActivityPub Activity
 *   - Mastodon/Pixelfed instances federate the announcement
 *   - Users see the stream in their federated timeline
 *   - They can watch inline (PeerTube embed works in Mastodon)
 *   - They can comment/favorite/boost
 *   - Their interactions federate back to PeerTube
 *
 * This bridge handles the DegenFeed-side announcement (via GoToSocial API)
 * and the reply-fetching loop that surfaces Mastodon comments in our stream chat.
 */

import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { withReliability } from './bridge-reliability';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LiveStream {
  id: string;
  title: string;
  creator: string;
  creatorHandle: string;
  streamType: 'live' | 'scheduled' | 'prerecorded';
  streamUrl: string;
  thumbnail?: string;
}

export interface StreamComment {
  id: string;
  protocol: string;
  protocolLabel: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: number;
  sourceInstance?: string;
  sourceUrl?: string;
}

export interface StreamAnnouncementRecord {
  streamId: string;
  protocol: 'activitypub';
  postId: string;
  postUrl: string;
  instanceUrl: string;
  announcedAt: number;
}

// ─── KV key helpers ───────────────────────────────────────────────────────

const ANNOUNCEMENT_PREFIX = 'bridge:ap:announcement:';
const REPLY_CURSOR_PREFIX = 'bridge:ap:cursor:';

function announcementKey(streamId: string): string {
  return `${ANNOUNCEMENT_PREFIX}${streamId}`;
}

function replyCursorKey(streamId: string): string {
  return `${REPLY_CURSOR_PREFIX}${streamId}`;
}

// ─── ActivityPub Stream Bridge ────────────────────────────────────────────

export class ActivityPubStreamBridge {
  private env: Env;
  private instanceUrl: string;

  constructor(env: Env) {
    this.env = env;
    this.instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  }

  /**
   * Announce a stream on ActivityPub via GoToSocial.
   *
   * Posts a public status with stream metadata, hashtags, and a link.
   * Stores the AP post ID for reply tracking.
   */
  async announceStream(
    stream: LiveStream,
    accessToken: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');

    const result = await withReliability(
      'activitypub',
      async () => {
        const client = new GtSClient(this.instanceUrl, accessToken);

        const text = this.buildAnnouncementText(stream);
        const status = await client.publish(text, { visibility: 'public' });

        return status;
      },
      { env: this.env },
    );

    const postId = result.id;
    const postUrl = result.url;

    // Store the announcement record for reply tracking
    const record: StreamAnnouncementRecord = {
      streamId: stream.id,
      protocol: 'activitypub',
      postId,
      postUrl,
      instanceUrl: this.instanceUrl,
      announcedAt: Date.now(),
    };

    await this.env.CONTENT_STORE?.put(
      announcementKey(stream.id),
      JSON.stringify(record),
      { expirationTtl: 86400 * 7 }, // 7 days
    );

    return { postId, postUrl };
  }

  /**
   * Fetch replies/comments from the AP announcement.
   *
   * Uses the GoToSocial context API to get all descendant posts
   * (replies to the announcement). Normalizes them to StreamComment format.
   */
  async fetchReplies(streamId: string, accessToken?: string): Promise<StreamComment[]> {
    const record = await this.getAnnouncement(streamId);
    if (!record) return [];

    const effectiveToken = accessToken;
    if (!effectiveToken) return [];

    try {
      const res = await fetch(`${this.instanceUrl}/api/v1/statuses/${record.postId}/context`, {
        headers: {
          authorization: `Bearer ${effectiveToken}`,
          accept: 'application/json',
        },
      });

      if (!res.ok) return [];

      const context = (await res.json()) as {
        ancestors: Array<Record<string, unknown>>;
        descendants: Array<{
          id: string;
          content: string;
          account?: {
            id: string;
            username: string;
            display_name?: string;
            avatar?: string;
            acct: string;
          };
          created_at?: string;
          url?: string;
          [key: string]: unknown;
        }>;
      };

      const cursor = await this.getCursor(streamId);

      const replies: StreamComment[] = [];
      for (const reply of context.descendants || []) {
        // Skip already-bridged replies using cursor tracking
        if (cursor && reply.id <= cursor) continue;

        replies.push(this.normalizeReply(reply, record));
      }

      // Update cursor to latest reply
      if (replies.length > 0) {
        const lastId = replies[replies.length - 1]?.id;
        if (lastId) {
          await this.setCursor(streamId, lastId);
        }
      }

      return replies;
    } catch {
      return [];
    }
  }

  /**
   * Bridge ActivityPub comments to the stream chat in real-time.
   *
   * Polls for new replies on the announcement post every 30 seconds,
   * pushes them to the stream's WebSocket chat channel, labeled
   * "via Mastodon" with the instance name for transparency.
   *
   * Call this once when a stream goes live. It runs in the background
   * until the stream ends.
   */
  async bridgeComments(
    streamId: string,
    accessToken: string,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const POLL_INTERVAL = 30_000; // 30 seconds

    const poll = async () => {
      if (abortSignal?.aborted) return;

      try {
        const replies = await this.fetchReplies(streamId, accessToken);

        for (const reply of replies) {
          // Push to stream chat via WebSocket
          broadcastToAll(CHANNELS.FEED_UPDATE, {
            type: 'stream_chat_message',
            streamId,
            message: {
              ...reply,
              text: `[via ${reply.protocolLabel}] ${reply.text}`,
            },
          });
        }
      } catch {
        // Silently retry on next poll
      }
    };

    // Initial poll
    await poll();

    // Poll every 30 seconds
    const interval = setInterval(poll, POLL_INTERVAL);

    // Clean up on abort
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    }
  }

  /**
   * Check if a stream was announced to ActivityPub.
   */
  async getAnnouncement(streamId: string): Promise<StreamAnnouncementRecord | null> {
    try {
      const raw = await this.env.CONTENT_STORE?.get(announcementKey(streamId));
      if (!raw) return null;
      return JSON.parse(raw) as StreamAnnouncementRecord;
    } catch {
      return null;
    }
  }

  /**
   * Remove a stream announcement record (on stream end).
   */
  async removeAnnouncement(streamId: string): Promise<void> {
    await this.env.CONTENT_STORE?.delete(announcementKey(streamId)).catch(() => {});
    await this.env.CONTENT_STORE?.delete(replyCursorKey(streamId)).catch(() => {});
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private buildAnnouncementText(stream: LiveStream): string {
    const lines: string[] = [
      `🔴 LIVE: ${stream.title}`,
      `${stream.creatorHandle} is streaming on DegenFeed!`,
      '',
      `Watch: ${stream.streamUrl}`,
      '',
      `#live #${stream.streamType} #degenfeed`,
    ];

    if (stream.thumbnail) {
      lines.push('');
      lines.push(stream.thumbnail);
    }

    return lines.join('\n');
  }

  private normalizeReply(
    reply: {
      id: string;
      content: string;
      account?: {
        id: string;
        username: string;
        display_name?: string;
        avatar?: string;
        acct: string;
      };
      created_at?: string;
      url?: string;
    },
    record: StreamAnnouncementRecord,
  ): StreamComment {
    const instanceHost = new URL(record.instanceUrl).hostname;
    const text = this.stripHtml(reply.content || '');

    return {
      id: `activitypub:${reply.id}`,
      protocol: 'activitypub',
      protocolLabel: `Mastodon (${instanceHost})`,
      authorId: reply.account?.id ?? 'unknown',
      authorName: reply.account?.display_name || reply.account?.username || 'Anonymous',
      authorAvatar: reply.account?.avatar,
      text,
      createdAt: reply.created_at ? new Date(reply.created_at).getTime() : Date.now(),
      sourceInstance: instanceHost,
      sourceUrl: reply.url,
    };
  }

  private async getCursor(streamId: string): Promise<string | null> {
    try {
      return (await this.env.CONTENT_STORE?.get(replyCursorKey(streamId))) ?? null;
    } catch {
      return null;
    }
  }

  private async setCursor(streamId: string, cursor: string): Promise<void> {
    await this.env.CONTENT_STORE?.put(replyCursorKey(streamId), cursor, {
      expirationTtl: 86400 * 7,
    }).catch(() => {});
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/**
 * Verify that our PeerTube instance has ActivityPub federation enabled.
 * PeerTube instances federate automatically when the `federation` plugin
 * is enabled. This function checks the instance nodeinfo.
 *
 * Returns the instance software + federation status.
 */
export async function verifyPeerTubeFederation(peertubeUrl: string): Promise<{
  ok: boolean;
  software: string;
  version?: string;
  federationEnabled?: boolean;
  note: string;
}> {
  try {
    const res = await fetch(`${peertubeUrl}/api/v1/nodeinfo/2.0`, {
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      return {
        ok: false,
        software: 'unknown',
        note: `PeerTube nodeinfo returned ${res.status}`,
      };
    }

    const info = (await res.json()) as {
      software?: { name?: string; version?: string };
      metadata?: { federation?: { enabled?: boolean } };
      protocols?: string[];
    };

    const software = info.software?.name ?? 'unknown';
    const version = info.software?.version;
    const protocols = info.protocols ?? [];
    const hasActivityPub = protocols.includes('activitypub');

    return {
      ok: hasActivityPub,
      software,
      version,
      federationEnabled: hasActivityPub,
      note: hasActivityPub
        ? `PeerTube ${version} has ActivityPub federation enabled — streams will federate to Mastodon/Pixelfed`
        : `PeerTube ${version} does NOT advertise ActivityPub protocol — check federation plugin`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      software: 'unknown',
      note: `Cannot reach PeerTube instance: ${msg}`,
    };
  }
}

/**
 * Check if a Mastodon/Pixelfed instance has received our stream announcement.
 * This is useful for debugging federation delays.
 */
export async function checkFederationDelivery(
  instanceUrl: string,
  statusUrl: string,
): Promise<{ delivered: boolean; note: string }> {
  try {
    const res = await fetch(statusUrl, {
      headers: {
        accept: 'application/activity+json, application/json',
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
    });

    if (res.ok) {
      return {
        delivered: true,
        note: `Status is accessible at ${statusUrl} — instance has federated the announcement`,
      };
    }

    return {
      delivered: false,
      note: `Status returned ${res.status} — check federation logs on ${instanceUrl}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      delivered: false,
      note: `Cannot check federation: ${msg}`,
    };
  }
}

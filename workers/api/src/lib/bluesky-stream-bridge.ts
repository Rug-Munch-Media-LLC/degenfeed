/**
 * @degenfeed/api-worker — Bluesky (AT Protocol) Stream Bridge
 *
 * Bridge between DegenFeed streams and the AT Protocol (Bluesky).
 *
 * THREE capabilities:
 *   1. Announce a live stream as a Bluesky post with external embed card
 *   2. Add the announcement to the "DegenFeed Live" feed generator
 *   3. Fetch Bluesky replies/comments and bridge them to stream chat
 *
 * Bluesky doesn't have native live streaming, so we use:
 *   - Post with `app.bsky.embed.external` for rich preview cards
 *   - Custom feed generator at `did:web:live.degenfeed.xyz`
 *   - Reply bridge via getPostThread
 */

import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { withReliability, recordBridgeOperation } from './bridge-reliability';
import type { LiveStream } from './activitypub-stream-bridge';

// ─── Types ────────────────────────────────────────────────────────────────

export interface BlueskyAnnounceResult {
  postUri: string;
  cid: string;
  postUrl: string;
}

export interface BlueskyAnnouncementRecord {
  streamId: string;
  protocol: 'atproto';
  postUri: string;
  cid: string;
  postUrl: string;
  announcedAt: number;
}

export interface BlueskyReply {
  uri: string;
  text: string;
  authorName: string;
  authorDid: string;
  createdAt: number;
}

// ─── KV key helpers ───────────────────────────────────────────────────────

const ANNOUNCEMENT_PREFIX = 'bridge:bsky:announcement:';
const REPLY_CURSOR_PREFIX = 'bridge:bsky:cursor:';

function announcementKey(streamId: string): string {
  return `${ANNOUNCEMENT_PREFIX}${streamId}`;
}

function replyCursorKey(streamId: string): string {
  return `${REPLY_CURSOR_PREFIX}${streamId}`;
}

// ─── Bluesky Stream Bridge ────────────────────────────────────────────────

export class BlueskyStreamBridge {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Announce a stream on Bluesky.
   *
   * Creates a post with an external embed card containing the stream
   * thumbnail, title, and link. Returns the AT Protocol URI and CID.
   *
   * After announcing, the post is automatically added to the
   * "DegenFeed Live" feed generator.
   */
  async announceStream(
    stream: LiveStream,
    accessJwt: string,
    did: string,
  ): Promise<BlueskyAnnounceResult> {
    const { PdsClient } = await import('@degenfeed/bluesky-sdk');

    const pdsUrl = this.env.BSKY_SOCIAL_URL || 'https://bsky.social';

    const result = await withReliability('atproto', async () => {
      const client = new PdsClient(pdsUrl);
      // Set pre-authenticated credentials
      (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
      (client as unknown as { did: string }).did = did;

      const text = this.buildAnnouncementText(stream);
      const embed = this.buildExternalEmbed(stream);

      return client.createPost({
        text,
        embed: embed as {
          $type: 'app.bsky.embed.external';
          external: { uri: string; title: string; description: string };
        },
        langs: ['en'],
      });
    }, { env: this.env });

    const postUri = result.uri;
    const cid = result.cid;
    const rkey = postUri.split('/').pop() ?? '';
    const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;

    // Store announcement record
    const record: BlueskyAnnouncementRecord = {
      streamId: stream.id,
      protocol: 'atproto',
      postUri,
      cid,
      postUrl,
      announcedAt: Date.now(),
    };

    await this.env.CONTENT_STORE?.put(
      announcementKey(stream.id),
      JSON.stringify(record),
      { expirationTtl: 86400 * 7 },
    );

    // Add to the "DegenFeed Live" feed generator
    try {
      const { LiveFeedGenerator } = await import('@degenfeed/bluesky-sdk/feed-generator');
      const feedGen = new LiveFeedGenerator(this.env.CONTENT_STORE ?? {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      });
      await feedGen.addToLiveFeed(postUri, stream.id);
    } catch {
      // Non-critical — feed generator may not be available
    }

    return { postUri, cid, postUrl };
  }

  /**
   * Fetch Bluesky replies to the stream announcement.
   *
   * Uses getPostThread to retrieve the thread and extract replies.
   * Returns normalized comment objects suitable for stream chat.
   */
  async fetchReplies(
    streamId: string,
    accessJwt?: string,
  ): Promise<import('./activitypub-stream-bridge').StreamComment[]> {
    const record = await this.getAnnouncement(streamId);
    if (!record) return [];

    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
      };
      if (accessJwt) {
        headers.authorization = `Bearer ${accessJwt}`;
      }

      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(record.postUri)}&depth=10`,
        { headers },
      );

      if (!res.ok) return [];

      const data = (await res.json()) as {
        thread?: {
          replies?: Array<{
            post?: {
              uri?: string;
              record?: { text?: string; createdAt?: string };
              author?: { did?: string; displayName?: string; handle?: string };
            };
          }>;
        };
      };

      const cursor = await this.getReplyCursor(streamId);
      const replies: import('./activitypub-stream-bridge').StreamComment[] = [];
      const rawReplies = data.thread?.replies ?? [];

      for (const rawReply of rawReplies) {
        const post = rawReply.post;
        if (!post?.uri) continue;

        // Skip already-bridged replies
        if (cursor && post.uri <= cursor) continue;

        replies.push({
          id: `atproto:${post.uri}`,
          protocol: 'atproto',
          protocolLabel: 'Bluesky',
          authorId: post.author?.did ?? 'unknown',
          authorName: post.author?.displayName || post.author?.handle || 'Anonymous',
          text: (post.record as { text?: string })?.text ?? '',
          createdAt: (post.record as { createdAt?: string })?.createdAt
            ? new Date((post.record as { createdAt: string }).createdAt).getTime()
            : Date.now(),
          sourceUrl: post.uri,
        });
      }

      // Update cursor
      if (replies.length > 0) {
        const lastUri = replies[replies.length - 1]?.id;
        if (lastUri) {
          await this.setReplyCursor(streamId, lastUri);
        }
      }

      return replies;
    } catch {
      return [];
    }
  }

  /**
   * Check if a stream was announced to Bluesky.
   */
  async getAnnouncement(
    streamId: string,
  ): Promise<BlueskyAnnouncementRecord | null> {
    try {
      const raw = await this.env.CONTENT_STORE?.get(announcementKey(streamId));
      if (!raw) return null;
      return JSON.parse(raw) as BlueskyAnnouncementRecord;
    } catch {
      return null;
    }
  }

  /**
   * Remove announcement record (on stream end).
   */
  async removeAnnouncement(streamId: string): Promise<void> {
    const record = await this.getAnnouncement(streamId);
    if (record) {
      // Remove from the Live Feed Generator
      try {
        const { LiveFeedGenerator } = await import('@degenfeed/bluesky-sdk/feed-generator');
        const feedGen = new LiveFeedGenerator(this.env.CONTENT_STORE ?? {
          get: async () => null,
          put: async () => {},
          delete: async () => {},
        });
        await feedGen.removeFromLiveFeed(record.postUri, streamId);
      } catch {
        // Non-critical
      }
    }

    await this.env.CONTENT_STORE?.delete(announcementKey(streamId)).catch(() => {});
    await this.env.CONTENT_STORE?.delete(replyCursorKey(streamId)).catch(() => {});
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private buildAnnouncementText(stream: LiveStream): string {
    return `🔴 ${stream.title}\n\n${stream.creatorHandle} is live on DegenFeed! 🎥\n\n${stream.streamUrl}`.slice(
      0,
      300,
    );
  }

  private buildExternalEmbed(stream: LiveStream): {
    $type: string;
    external: {
      uri: string;
      title: string;
      description: string;
      thumb?: string;
    };
  } {
    return {
      $type: 'app.bsky.embed.external',
      external: {
        uri: stream.streamUrl,
        title: stream.title,
        description: `${stream.creatorHandle} is streaming ${stream.streamType} on DegenFeed`,
        ...(stream.thumbnail ? { thumb: stream.thumbnail } : {}),
      },
    };
  }

  private async getReplyCursor(streamId: string): Promise<string | null> {
    try {
      return await this.env.CONTENT_STORE?.get(replyCursorKey(streamId)) ?? null;
    } catch {
      return null;
    }
  }

  private async setReplyCursor(streamId: string, cursor: string): Promise<void> {
    await this.env.CONTENT_STORE?.put(replyCursorKey(streamId), cursor, {
      expirationTtl: 86400 * 7,
    }).catch(() => {});
  }
}

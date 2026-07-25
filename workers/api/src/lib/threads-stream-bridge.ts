/**
 * @degenfeed/api-worker — Threads Stream Bridge
 *
 * Threads is Meta's microblogging platform that uses ActivityPub federation.
 * Integration works through our GoToSocial (GtS) instance at social.degenfeed.xyz:
 *   - Threads users who follow @degenfeed@social.degenfeed.xyz see our posts
 *   - Threads users can reply to our posts (replies appear in GoToSocial)
 *   - We can bridge those replies back into the DegenFeed stream chat
 *
 * Note: Threads does NOT support rich embeds natively (no link cards, no
 * video embeds). All stream links appear as plain URLs in Threads users' feeds.
 *
 * This bridge complements the direct Threads Graph API integration already in
 * publish-orchestrator.ts (which handles the Threads API directly). This bridge
 * handles the ActivityPub-federated path via GoToSocial, which enables:
 *   1. Threads users that follow our GtS instance see our stream announcements
 *   2. Replies from Threads users appear in our GtS notifications
 *   3. We can poll for and bridge those replies back to the stream chat
 */

import type { Space } from '@degenfeed/types';
import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { ChatMessage, LiveStream } from './stream-store';
import { addChatMessage } from './stream-store';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ThreadsBridgeConfig {
  /** GoToSocial instance URL — falls back to env.GOTOSOCIAL_INSTANCE_URL */
  instanceUrl?: string;
  /** GoToSocial access token — falls back to env */
  accessToken?: string;
  /** The DegenFeed GoToSocial account handle (without @instance) */
  accountHandle?: string;
}

export interface ThreadsComment {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  createdAt: number;
  /** The Threads.net account that made the reply (from acct field) */
  threadsAcct: string;
}

export interface ThreadsAnnouncementResult {
  ok: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const DEFAULT_INSTANCE = 'https://social.degenfeed.xyz';
const THREADS_DOMAIN = 'threads.net';
const POLL_INTERVAL_MS = 30_000;

// ─── ThreadsStreamBridge ────────────────────────────────────────────────

export class ThreadsStreamBridge {
  private env: Env;
  private config: Required<ThreadsBridgeConfig>;

  constructor(env: Env, config?: ThreadsBridgeConfig) {
    this.env = env;
    this.config = {
      instanceUrl: config?.instanceUrl ?? env.GOTOSOCIAL_INSTANCE_URL ?? DEFAULT_INSTANCE,
      // Access token must be provided via config or stored in IdentityHub
      accessToken: config?.accessToken ?? '',
      accountHandle: config?.accountHandle ?? 'degenfeed',
    };
  }

  // ─── Stream Announcement ─────────────────────────────────────────

  /**
   * Announce a stream via GoToSocial (visible to Threads followers).
   *
   * Threads users who follow @degenfeed@social.degenfeed.xyz will see
   * this post in their Threads feed. The stream link appears as a URL.
   */
  async announceStream(stream: LiveStream): Promise<ThreadsAnnouncementResult> {
    return withReliability(
      'threads',
      async () => {
        if (!this.config.accessToken) {
          return {
            ok: false,
            error: 'No GoToSocial access token configured for Threads bridge',
          };
        }

        const text = this.formatStreamContent(stream);
        const postId = await this.publishToGoToSocial(text, stream.thumbnail);
        const postUrl = postId
          ? `${this.config.instanceUrl}/@${this.config.accountHandle}/${postId}`
          : undefined;

        await this.recordSuccess('announceStream');

        return {
          ok: true,
          postId,
          postUrl,
        };
      },
      { env: this.env },
    );
  }

  /**
   * Announce a space via GoToSocial (visible to Threads followers).
   */
  async announceSpace(space: Space): Promise<ThreadsAnnouncementResult> {
    return withReliability(
      'threads',
      async () => {
        if (!this.config.accessToken) {
          return {
            ok: false,
            error: 'No GoToSocial access token configured for Threads bridge',
          };
        }

        const text = this.formatSpaceContent(space);
        const postId = await this.publishToGoToSocial(text, space.speakers[0]?.avatarUrl);
        const postUrl = postId
          ? `${this.config.instanceUrl}/@${this.config.accountHandle}/${postId}`
          : undefined;

        await this.recordSuccess('announceSpace');

        return {
          ok: true,
          postId,
          postUrl,
        };
      },
      { env: this.env },
    );
  }

  /**
   * Update a stream status on GoToSocial (new post, or reply to the original).
   *
   * Threads doesn't support editing, so we post a new reply to the original
   * thread with the status update.
   */
  async updateStreamStatus(
    stream: LiveStream,
    parentPostId: string,
  ): Promise<ThreadsAnnouncementResult> {
    return withReliability(
      'threads',
      async () => {
        if (!this.config.accessToken) {
          return { ok: false, error: 'No access token' };
        }

        const _status = stream.isLive ? 'still live' : 'ended';
        let text: string;

        if (stream.isLive) {
          text = `🔄 ${stream.title} — still going! ${stream.viewerCount} watching.\n\nWatch: ${stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`;
        } else {
          text = `📹 ${stream.title} has ended. Thanks to everyone who tuned in!\n\nRecording: ${stream.recordingUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`;
        }

        // Post as a reply to the original announcement
        const postId = await this.publishToGoToSocial(text, undefined, parentPostId);

        await this.recordSuccess('updateStreamStatus');

        return {
          ok: true,
          postId,
          postUrl: postId
            ? `${this.config.instanceUrl}/@${this.config.accountHandle}/${postId}`
            : undefined,
        };
      },
      { env: this.env },
    );
  }

  // ─── Reply Fetching ──────────────────────────────────────────────

  /**
   * Fetch replies to a stream announcement that came from Threads users.
   *
   * Uses the GoToSocial status context API to get descendants (replies),
   * then filters for posts from accounts with @threads.net in their acct.
   */
  async fetchThreadsReplies(postId: string): Promise<ThreadsComment[]> {
    const results = await withReliability(
      'threads',
      async () => {
        if (!this.config.accessToken) return [] as ThreadsComment[];

        const contextUrl = `${this.config.instanceUrl}/api/v1/statuses/${encodeURIComponent(postId)}/context`;

        const res = await fetch(contextUrl, {
          headers: {
            authorization: `Bearer ${this.config.accessToken}`,
            accept: 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          console.warn(
            `[threads-bridge] Failed to fetch context for ${postId}: HTTP ${res.status}`,
          );
          return [] as ThreadsComment[];
        }

        const data = (await res.json()) as {
          descendants?: Array<{
            id: string;
            content: string;
            created_at: string;
            account: {
              acct: string;
              display_name: string;
              avatar: string;
              url: string;
            };
          }>;
        };

        const descendants = data.descendants ?? [];

        // Filter for Threads users: acct contains 'threads.net'
        return descendants
          .filter((reply) => reply.account.acct.includes(THREADS_DOMAIN))
          .map((reply) => ({
            id: reply.id,
            text: this.stripHtml(reply.content).slice(0, 500),
            authorName: reply.account.display_name || reply.account.acct,
            authorHandle: reply.account.acct,
            authorAvatar: reply.account.avatar,
            createdAt: new Date(reply.created_at).getTime(),
            threadsAcct: reply.account.acct,
          }));
      },
      { env: this.env },
    );

    return results ?? [];
  }

  /**
   * Bridge Threads replies into the DegenFeed stream chat.
   *
   * Called periodically (every 30s) for active streams to poll for
   * new Threads replies and push them into the stream chat.
   */
  async bridgeToChat(
    streamId: string,
    announcementPostId: string,
    seenIds: Set<string>,
  ): Promise<void> {
    const replies = await this.fetchThreadsReplies(announcementPostId);

    for (const reply of replies) {
      if (seenIds.has(reply.id)) continue;
      seenIds.add(reply.id);

      const chatMsg: ChatMessage = {
        id: `threads:${reply.id}`,
        userId: `threads:${reply.threadsAcct}`,
        displayName: reply.authorName,
        avatarUrl: reply.authorAvatar,
        text: `${reply.text} 🧵`,
        createdAt: reply.createdAt,
      };

      try {
        await addChatMessage(this.env, streamId, chatMsg);

        broadcastToAll(CHANNELS.SPACE_UPDATE, {
          type: 'chat_message',
          streamId,
          message: chatMsg,
          protocol: 'threads',
        });
      } catch (err) {
        console.error('[threads-bridge] Failed to bridge Threads reply:', err);
      }
    }
  }

  // ─── Content Formatters ──────────────────────────────────────────

  /**
   * Format a stream announcement for GoToSocial/Threads.
   *
   * Threads shows plain text — no rich embeds — so the link and emoji
   * formatting is important for visibility.
   */
  private formatStreamContent(stream: LiveStream): string {
    const parts: string[] = [`🔴 LIVE NOW: ${stream.title}`, ''];

    if (stream.description) {
      parts.push(stream.description, '');
    }

    parts.push(
      `🎮 ${stream.type} stream`,
      `👤 ${stream.creator}`,
      `👀 ${stream.viewerCount} watching`,
      '',
      `📺 Watch: ${stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`,
      '',
      `#Live #${stream.type} #DegenFeed`,
    );

    return parts.join('\n');
  }

  /**
   * Format a space announcement for GoToSocial/Threads.
   */
  private formatSpaceContent(space: Space): string {
    const speakers = Array.isArray(space.speakers) ? space.speakers : [];
    const speakerMentions = speakers
      .slice(0, 3)
      .map((s) => `🎙️ ${s.displayName}`)
      .join('\n');

    const parts: string[] = [`🎙️ SPACE LIVE: ${space.title}`, ''];

    if (space.description) {
      parts.push(space.description, '');
    }

    parts.push(
      `Hosted by ${space.hostName}`,
      speakerMentions ? `${speakerMentions}` : '',
      `👥 ${space.listeners} listening`,
      '',
      `Join: https://app.degenfeed.xyz/spaces/${space.id}`,
      '',
      `#AudioSpace #DegenFeed`,
    );

    return parts.filter(Boolean).join('\n');
  }

  // ─── GoToSocial API ──────────────────────────────────────────────

  /**
   * Publish a status to GoToSocial.
   *
   * @param text - Status text content
   * @param mediaUrl - Optional media URL to attach as an image
   * @param inReplyToId - Optional parent status ID for replies
   * @returns The new status ID
   */
  private async publishToGoToSocial(
    text: string,
    mediaUrl?: string,
    inReplyToId?: string,
  ): Promise<string | undefined> {
    // Step 1: Upload media if provided
    let mediaId: string | undefined;
    if (mediaUrl) {
      try {
        mediaId = await this.uploadMedia(mediaUrl);
      } catch (err) {
        console.warn('[threads-bridge] Media upload failed, posting without thumbnail:', err);
      }
    }

    // Step 2: Publish status
    const body: Record<string, unknown> = {
      status: text,
      visibility: 'public',
    };

    if (mediaId) {
      body.media_ids = [mediaId];
    }

    if (inReplyToId) {
      body.in_reply_to_id = inReplyToId;
    }

    const publishUrl = `${this.config.instanceUrl}/api/v1/statuses`;
    const res = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`GoToSocial publish failed: HTTP ${res.status} — ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  /**
   * Upload a media URL to GoToSocial and return the media attachment ID.
   */
  private async uploadMedia(mediaUrl: string): Promise<string | undefined> {
    // Fetch the image and re-upload to GtS
    const imgRes = await fetch(mediaUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!imgRes.ok) {
      throw new Error(`Failed to fetch media: HTTP ${imgRes.status}`);
    }

    const blob = await imgRes.blob();
    const formData = new FormData();
    formData.append('file', blob, 'media.jpg');
    formData.append('description', 'DegenFeed stream thumbnail');

    const uploadUrl = `${this.config.instanceUrl}/api/v2/media`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      throw new Error(`Media upload failed: HTTP ${uploadRes.status} — ${errText.slice(0, 200)}`);
    }

    const uploadData = (await uploadRes.json()) as { id: string };
    return uploadData.id;
  }

  // ─── Polling Bridge ──────────────────────────────────────────────

  /**
   * Start polling for Threads replies and bridging them to the stream chat.
   *
   * Returns a cleanup function to stop polling.
   */
  startPolling(
    streamId: string,
    announcementPostId: string,
    abortSignal?: AbortSignal,
  ): () => void {
    const seenIds = new Set<string>();
    let activeInterval: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        await this.bridgeToChat(streamId, announcementPostId, seenIds);
      } catch (err) {
        console.error('[threads-bridge] Poll error:', err);
      }
    };

    // Initial poll
    poll().catch((err) => console.error('[threads-bridge] Initial poll failed:', err));

    // Periodic polling
    activeInterval = setInterval(poll, POLL_INTERVAL_MS);

    const cleanup = () => {
      if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = undefined;
      }
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', cleanup, { once: true });
    }

    return cleanup;
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async recordSuccess(_operation: string): Promise<void> {
    try {
      await recordBridgeOperation(this.env, 'threads', true, 0);
    } catch {
      // Non-critical
    }
  }

  private stripHtml(html: string): string {
    return html
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

// ─── Standalone Helper Functions ────────────────────────────────────────

/**
 * Check if a GoToSocial account acct belongs to a Threads user.
 */
export function isThreadsAccount(acct: string): boolean {
  return acct.includes(THREADS_DOMAIN);
}

/**
 * Format a stream announcement text optimized for Threads visibility.
 * Threads displays up to 500 characters and does NOT support rich embeds,
 * so link placement and emoji usage matter.
 */
export function formatForThreadsFeed(stream: {
  title: string;
  creator: string;
  viewerCount?: number;
  streamUrl?: string;
  type?: string;
}): string {
  const maxLen = 500;
  const base = `🔴 ${stream.title}\n\n${stream.creator} is live on DegenFeed!\n\nWatch: ${stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`;

  if (base.length <= maxLen) return base;

  // Trim title to fit
  const maxTitleLen = maxLen - `🔴 \n\n${stream.creator} is live!\n\nWatch: `.length - 10;
  const trimmedTitle =
    stream.title.length > maxTitleLen ? `${stream.title.slice(0, maxTitleLen - 1)}…` : stream.title;

  return `🔴 ${trimmedTitle}\n\n${stream.creator} is live!\n\nWatch: ${stream.streamUrl || `https://app.degenfeed.xyz/live/${stream.creator}`}`;
}

/**
 * @degenfeed/api-worker — AT Protocol (Bluesky) Live Short Strategy
 *
 * Bluesky has NO native live streaming support. There is no video player,
 * no live event type, no streaming infrastructure on AT Protocol.
 *
 * Strategy: Create the CLOSEST POSSIBLE APPROXIMATION using Bluesky's
 * existing features:
 *   1. Post with `app.bsky.embed.external` card showing thumbnail + "LIVE" badge
 *   2. Custom feed generator "DegenFeed Live" that surfaces all active live shorts
 *   3. OG meta endpoint that serves live status for embed cards (auto-refresh)
 *   4. Bluesky clients that support video embeds can play HLS directly
 *
 * Viewer signal: embed card click-through rate on the DegenFeed Live feed.
 *
 * Native live support: NONE — we build the experience on top of embeds.
 */

import type { Env } from '../../../index';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.atproto;

/**
 * Bluesky/AT Protocol live short strategy using embed cards + feed generator.
 */
export const atProtoLiveStrategy: ProtocolStrategy = {
  config: STRATEGY,

  async announceLive(
    env: Env,
    sessionId: string,
    _creator: string,
    _creatorHandle: string,
    title: string,
    playbackUrl: string,
    duration: number,
  ): Promise<LiveSessionInfo> {
    try {
      const { PdsClient } = await import('@degenfeed/bluesky-sdk');

      // Resolve Bluesky credentials from env or identity hub
      const accessJwt = env.BSKY_ACCESS_TOKEN ?? '';
      const did = env.BSKY_DID ?? '';

      if (!accessJwt || !did) {
        return {
          protocolId: '',
          protocolUrl: '',
          announced: false,
          error: 'Bluesky credentials not configured',
        };
      }

      const pdsUrl = env.BSKY_SOCIAL_URL ?? 'https://bsky.social';
      const client = new PdsClient(pdsUrl);
      // Set auth
      (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
      (client as unknown as { did: string }).did = did;

      // Build the live embed card URL — points to our OG meta endpoint
      const liveCardUrl = `https://app.degenfeed.xyz/api/live-shorts/${sessionId}/og`;
      const thumbnailUrl = `https://app.degenfeed.xyz/og/live/${sessionId}.png`;

      const text = [
        `🔴 LIVE SHORT: ${title}`,
        `${_creatorHandle} is streaming on DegenFeed!`,
        '',
        `⏱ ${duration}s live short`,
        ``,
        `📺 ${playbackUrl}`,
      ]
        .join('\n')
        .slice(0, 300);

      const result = await client.createPost({
        text,
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: liveCardUrl,
            title: `🔴 LIVE: ${title}`,
            description: `Live short by ${_creatorHandle} on DegenFeed — ${duration}s`,
            thumb: {
              $type: 'blob',
              ref: { $link: thumbnailUrl },
              mimeType: 'image/png',
              size: 0,
            },
          },
        },
        langs: ['en'],
      });

      const postUri = result.uri;
      const rkey = postUri.split('/').pop() ?? sessionId;

      return {
        protocolId: postUri,
        protocolUrl: `https://bsky.app/profile/${did}/post/${rkey}`,
        announced: true,
      };
    } catch (err) {
      return {
        protocolId: '',
        protocolUrl: '',
        announced: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async updateEnded(
    env: Env,
    _sessionId: string,
    protocolId: string,
    title: string,
    recordingUrl: string,
  ): Promise<void> {
    // Bluesky doesn't support editing posts, so we post a follow-up
    // with the recording link
    if (!protocolId) return;

    try {
      const { PdsClient } = await import('@degenfeed/bluesky-sdk');
      const accessJwt = env.BSKY_ACCESS_TOKEN ?? '';
      const did = env.BSKY_DID ?? '';
      if (!accessJwt || !did) return;

      const client = new PdsClient(env.BSKY_SOCIAL_URL ?? 'https://bsky.social');
      (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
      (client as unknown as { did: string }).did = did;

      // Reply to the original post with recording URL
      const text = [`✅ Recording available: ${title}`, ``, `📺 ${recordingUrl}`]
        .join('\n')
        .slice(0, 300);

      await client.createPost({
        text,
        reply: {
          parent: { uri: protocolId, cid: '' },
          root: { uri: protocolId, cid: '' },
        },
        langs: ['en'],
      });
    } catch {
      // Non-critical
    }
  },

  async getViewerCount(env: Env, protocolId: string): Promise<ViewerCountResult> {
    // Bluesky doesn't expose real-time viewer counts for embed cards.
    // We estimate based on post engagement (likes + reposts) as a proxy.
    if (!protocolId) return { count: 0, rawSignal: 0 };

    try {
      const { PdsClient } = await import('@degenfeed/bluesky-sdk');
      const accessJwt = env.BSKY_ACCESS_TOKEN ?? '';
      const did = env.BSKY_DID ?? '';
      if (!accessJwt || !did) return { count: 0, rawSignal: 0 };

      const client = new PdsClient(env.BSKY_SOCIAL_URL ?? 'https://bsky.social');
      (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
      (client as unknown as { did: string }).did = did;

      // Get post thread to fetch engagement
      const thread = await client.getPostThread({ uri: protocolId, depth: 0 });
      const post = thread?.thread?.post as Record<string, unknown> | undefined;
      const likeCount = (post?.likeCount as number) ?? 0;
      const repostCount = (post?.repostCount as number) ?? 0;
      const replyCount = (post?.replyCount as number) ?? 0;

      // Estimate viewers as a multiple of total engagement
      const rawSignal = likeCount + repostCount + replyCount;
      const count = Math.floor(rawSignal * 3) + 5; // rough multiplier

      return { count, rawSignal };
    } catch {
      return { count: 0, rawSignal: 0 };
    }
  },
};

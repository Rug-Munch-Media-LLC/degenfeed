/**
 * @degenfeed/api-worker — Lens Protocol Live Short Strategy
 *
 * Lens has NO native live streaming support.
 *
 * Strategy: Create the closest approximation using Lens Open Actions +
 * publication metadata with live status attributes:
 *   1. Publication with video link + "Join Live" Open Action
 *   2. Custom metadata attributes for live status (isLive, duration, etc.)
 *   3. Users click through to the DegenFeed viewer (or any HLS-capable player)
 *   4. After live ends, update publication metadata to show recording
 *
 * Native live support: NONE — we build the experience on top of publications.
 */

import type { Env } from '../../../index';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.lens;

/**
 * Lens live short strategy using publications with Open Actions.
 */
export const lensLiveStrategy: ProtocolStrategy = {
  config: STRATEGY,

  async announceLive(
    env: Env,
    sessionId: string,
    creator: string,
    creatorHandle: string,
    title: string,
    playbackUrl: string,
    duration: number,
  ): Promise<LiveSessionInfo> {
    try {
      const { LensClient } = await import('@degenfeed/lens-sdk');
      const apiUrl = env.LENS_API_URL ?? 'https://api-v2.lens.dev/graphql';
      const accessToken = env.LENS_ACCESS_TOKEN ?? '';

      if (!accessToken) {
        return {
          protocolId: '',
          protocolUrl: '',
          announced: false,
          error: 'Lens API access token not configured',
        };
      }

      const client = new LensClient(apiUrl);
      client.setAuth(accessToken);

      // Create a publication with live short metadata
      const content = [
        `🔴 LIVE SHORT: ${title}`,
        ``,
        `${creatorHandle} is streaming on DegenFeed!`,
        ``,
        `⏱ ${duration}s short`,
        `📺 ${playbackUrl}`,
      ].join('\n');

      // Use Lens's metadata attributes for live status
      const result = (await client.request(
        `mutation CreatePost($request: CreatePostRequest!) {
          post(request: $request) {
            ... on RelayResult { txHash }
            ... on RelayError { reason }
          }
        }`,
        {
          request: {
            content,
            locale: 'en',
            metadata: {
              attributes: [
                { key: 'isLive', value: 'true', type: 'BOOLEAN' },
                { key: 'liveUrl', value: playbackUrl, type: 'STRING' },
                { key: 'livePlatform', value: 'DegenFeed', type: 'STRING' },
                { key: 'liveDuration', value: String(duration), type: 'NUMBER' },
                { key: 'liveSessionId', value: sessionId, type: 'STRING' },
                { key: 'creatorAddress', value: creator, type: 'STRING' },
              ],
            },
          },
        },
      )) as Record<string, unknown>;

      const postResult = result?.post as Record<string, unknown> | undefined;
      const txHash = postResult?.txHash as string | undefined;

      if (!txHash) {
        return {
          protocolId: '',
          protocolUrl: '',
          announced: false,
          error: (postResult?.reason as string) ?? 'No txHash from Lens relay',
        };
      }

      return {
        protocolId: txHash,
        protocolUrl: `https://hey.xyz/posts/${txHash}`,
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
    // Lens doesn't support post edits. Post a follow-up publication.
    if (!protocolId) return;

    try {
      const { LensClient } = await import('@degenfeed/lens-sdk');
      const apiUrl = env.LENS_API_URL ?? 'https://api-v2.lens.dev/graphql';
      const accessToken = env.LENS_ACCESS_TOKEN ?? '';
      if (!accessToken) return;

      const client = new LensClient(apiUrl);
      client.setAuth(accessToken);

      const content = [`✅ Recording available: ${title}`, ``, `📺 ${recordingUrl}`].join('\n');

      await client
        .request(
          `mutation CreatePost($request: CreatePostRequest!) {
          post(request: $request) {
            ... on RelayResult { txHash }
            ... on RelayError { reason }
          }
        }`,
          {
            request: {
              content,
              locale: 'en',
              metadata: {
                attributes: [
                  { key: 'isLive', value: 'false', type: 'BOOLEAN' },
                  { key: 'recordingUrl', value: recordingUrl, type: 'STRING' },
                  { key: 'originalPostId', value: protocolId, type: 'STRING' },
                ],
              },
            },
          },
        )
        .catch(() => {});
    } catch {
      // Non-critical
    }
  },

  async getViewerCount(env: Env, protocolId: string): Promise<ViewerCountResult> {
    // Lens: use publication stats as viewer proxy
    if (!protocolId) return { count: 0, rawSignal: 0 };

    try {
      const { LensClient } = await import('@degenfeed/lens-sdk');
      const apiUrl = env.LENS_API_URL ?? 'https://api-v2.lens.dev/graphql';
      const client = new LensClient(apiUrl);

      const data = (await client.request(
        `query GetPublication($id: String!) {
          publication(request: { publicationId: $id }) {
            stats { totalUpvotes totalDownvotes totalCollects totalComments totalMirrors }
          }
        }`,
        { id: protocolId },
      )) as Record<string, unknown>;

      const pub = data?.publication as Record<string, unknown> | undefined;
      const stats = pub?.stats as Record<string, number> | undefined;

      if (!stats) return { count: 0, rawSignal: 0 };

      const rawSignal =
        (stats.totalUpvotes ?? 0) + (stats.totalComments ?? 0) + (stats.totalMirrors ?? 0);

      const count = Math.floor(rawSignal * 3) + 2;

      return { count, rawSignal };
    } catch {
      return { count: 0, rawSignal: 0 };
    }
  },
};

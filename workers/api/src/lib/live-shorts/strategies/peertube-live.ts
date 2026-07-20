/**
 * @degenfeed/api-worker — PeerTube Live Short Strategy (ActivityPub)
 *
 * ActivityPub is the FEDIVERSE. Mastodon, Pixelfed, PeerTube, and Loops all
 * speak ActivityPub. PeerTube has NATIVE live streaming via RTMP → HLS, which
 * is the best possible live experience on the fediverse.
 *
 * Strategy: Use our self-hosted PeerTube instance (video.degenfeed.xyz) as the
 * live streaming backend for ALL ActivityPub content. When a creator goes live:
 *   1. Ingest via RTMP to PeerTube
 *   2. PeerTube transcodes to HLS (multi-resolution)
 *   3. PeerTube federates the stream announcement to ALL fediverse followers
 *   4. Mastodon/Pixelfed users see "🔴 LIVE" post with embedded PeerTube player
 *   5. PeerTube's built-in XMPP chat powers real-time chat
 *
 * Native live support: FULL — PeerTube is a first-class live streaming platform.
 */

import type { Env } from "../../../index";
import type { ProtocolStrategy, LiveSessionInfo, ViewerCountResult } from "../live-strategy";
import { LIVE_SHORT_STRATEGIES } from "../protocol-strategies";

const STRATEGY = LIVE_SHORT_STRATEGIES.activitypub;

/**
 * ActivityPub live short strategy using PeerTube as the backend.
 */
export const activityPubLiveStrategy: ProtocolStrategy = {
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
    // Use the existing PeerTube livestream infrastructure
    try {
      const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
      const gtsToken = await env.CACHE?.get("gts:access_token");
      if (!gtsToken) {
        return {
          protocolId: "",
          protocolUrl: "",
          announced: false,
          error: "No GoToSocial access token available for PeerTube auth",
        };
      }

      const peertube = new PeerTubeLiveStream({
        accessToken: gtsToken,
        instanceUrl: env.GTS_INSTANCE_URL
          ? env.GTS_INSTANCE_URL.replace("social.", "video.")
          : "https://video.degenfeed.xyz",
      });

      // Create a short-duration live stream
      const stream = await peertube.createStream({
        channelName: creatorHandle,
        title: `🔴 LIVE: ${title}`,
        description: `Live short by ${creatorHandle} on DegenFeed\n\nWatch: ${playbackUrl}`,
        privacy: 1,
        category: 11, // Entertainment
        tags: ["liveshort", "degenfeed", "live", creatorHandle],
        creatorAddress: creator,
        tokenAddress: creator,
        tokenSymbol: creatorHandle,
        tokenGated: false,
      });

      // Announce via ActivityPub federation (PeerTube handles this automatically,
      // but we also post to GoToSocial for Mastodon/Twitter-style federation)
      try {
        const { GtSClient } = await import("@degenfeed/mastodon-sdk");
        const gts = new GtSClient(
          env.GTS_INSTANCE_URL ?? "https://social.degenfeed.xyz",
          gtsToken,
        );

        const statusText = [
          `🔴 LIVE SHORT: ${title}`,
          `${creatorHandle} is live on DegenFeed!`,
          "",
          `📺 Watch on PeerTube: ${stream.playbackUrl}`,
          `💎 Also on: ${playbackUrl}`,
          "",
          `#LiveShort #DegenFeed #${creatorHandle}`,
        ].join("\n");

        const gtsPost = await gts.publish(statusText, {
          visibility: "public",
        });

        return {
          protocolId: String(stream.id),
          protocolUrl: stream.url,
          announced: true,
        };
      } catch {
        // PeerTube federation is automatic — GtS post is bonus
        return {
          protocolId: String(stream.id),
          protocolUrl: stream.url,
          announced: true,
        };
      }
    } catch (err) {
      return {
        protocolId: "",
        protocolUrl: "",
        announced: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async updateEnded(
    env: Env,
    sessionId: string,
    protocolId: string,
    title: string,
    recordingUrl: string,
  ): Promise<void> {
    // Update PeerTube stream (it auto-saves as VOD)
    // Post "ended" status to ActivityPub
    try {
      const gtsToken = await env.CACHE?.get("gts:access_token");
      if (!gtsToken) return;

      const { GtSClient } = await import("@degenfeed/mastodon-sdk");
      const gts = new GtSClient(
        env.GTS_INSTANCE_URL ?? "https://social.degenfeed.xyz",
        gtsToken,
      );

      const statusText = [
        `✅ RECORDING AVAILABLE: ${title}`,
        `The live short has ended.`,
        "",
        `📺 Watch recording: ${recordingUrl}`,
        "",
        `#DegenFeed #Recording #${title.replace(/\s+/g, "")}`,
      ].join("\n");

      await gts.publish(statusText, {
        visibility: "public",
      });
    } catch {
      // Non-critical
    }
  },

  async getViewerCount(
    env: Env,
    protocolId: string,
  ): Promise<ViewerCountResult> {
    // PeerTube provides real-time viewer stats via its API
    try {
      const gtsToken = await env.CACHE?.get("gts:access_token");
      if (!gtsToken || !protocolId) {
        return { count: 0, rawSignal: 0 };
      }

      const { PeerTubeLiveStream } = await import("@degenfeed/peertube-provider");
      const peertube = new PeerTubeLiveStream({ accessToken: gtsToken });

      const status = await peertube.getStreamStatus(protocolId);
      return {
        count: status.viewers,
        rawSignal: status.viewers,
      };
    } catch {
      return { count: 0, rawSignal: 0 };
    }
  },
};

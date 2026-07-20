/**
 * @degenfeed/api-worker — Zora Live Short Strategy
 *
 * Zora has NO native live streaming support. However, Zora uses Livepeer
 * for video transcoding, which gives us a natural integration point.
 *
 * Strategy: Integrate with Livepeer (which Zora also uses) for the streaming
 * backend, then leverage Zora's NFT/coin protocol:
 *   1. Use Livepeer for RTMP → HLS transcoding (same infra Zora uses)
 *   2. During live: HLS stream URL as `animation_url` in ERC-1155 metadata
 *   3. After live: recording replaces `animation_url` in metadata
 *   4. Zora's coin protocol used for tipping/monetization during live
 *   5. Mint a 1/1 "Live Short" NFT after the stream ends (recording as art)
 *
 * Native live support: NONE — we build on top of Livepeer + NFT metadata.
 */

import type { Env } from "../../../index";
import type { ProtocolStrategy, LiveSessionInfo, ViewerCountResult } from "../live-strategy";
import { LIVE_SHORT_STRATEGIES } from "../protocol-strategies";

const STRATEGY = LIVE_SHORT_STRATEGIES.zora;

/**
 * Zora live short strategy using Livepeer + NFT metadata.
 */
export const zoraLiveStrategy: ProtocolStrategy = {
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
    // Zora doesn't have a "post" concept like social protocols.
    // Instead, we prepare the NFT metadata with the live stream URL
    // and make it available for minting/tipping during the live.
    // The actual NFT mint happens after the stream ends (in updateEnded),
    // but we mark the metadata as live so Zora collectors know it's happening.

    try {
      // Store live session metadata in KV for the Zora NFT minting
      const zoraMetaKey = `zora:live-meta:${sessionId}`;
      const metadata = {
        name: `🔴 LIVE: ${title} by ${creatorHandle}`,
        description: `Live short by ${creatorHandle} on DegenFeed\n\nWatch live: ${playbackUrl}\n\nDuration: ${duration}s\nCreator: ${creator}`,
        animation_url: playbackUrl, // HLS stream URL
        image: `https://app.degenfeed.xyz/og/live/${sessionId}.png`,
        attributes: [
          { trait_type: "Status", value: "Live" },
          { trait_type: "Duration (s)", value: duration },
          { trait_type: "Creator", value: creatorHandle },
          { trait_type: "Platform", value: "DegenFeed" },
          { trait_type: "Session", value: sessionId },
          { trait_type: "Type", value: "Live Short" },
        ],
        properties: {
          live: true,
          sessionId,
          creator,
          creatorHandle,
          startedAt: Date.now(),
        },
      };

      await env.CONTENT_STORE?.put(
        zoraMetaKey,
        JSON.stringify(metadata),
        { expirationTtl: 86400 * 7 },
      );

      return {
        protocolId: sessionId,
        protocolUrl: `https://zora.co/collect/base/0x0000000000000000000000000000000000000000/${sessionId}`,
        announced: true,
      };
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
    // After the live short ends, update the NFT metadata with the recording
    // and trigger actual NFT minting
    if (!protocolId) return;

    try {
      const zoraMetaKey = `zora:live-meta:${sessionId}`;
      const raw = await env.CONTENT_STORE?.get(zoraMetaKey);
      if (!raw) return;

      const metadata = JSON.parse(raw) as Record<string, unknown>;
      metadata.animation_url = recordingUrl;
      (metadata.attributes as Array<Record<string, unknown>>)?.forEach(
        (attr: Record<string, unknown>) => {
          if (attr.trait_type === "Status") attr.value = "Recording";
        },
      );
      (metadata.properties as Record<string, unknown>).live = false;
      (metadata.properties as Record<string, unknown>).recordingUrl = recordingUrl;
      (metadata.properties as Record<string, unknown>).endedAt = Date.now();

      // Update metadata in KV
      await env.CONTENT_STORE?.put(
        zoraMetaKey,
        JSON.stringify(metadata),
        { expirationTtl: 86400 * 30 },
      );

      // Attempt to mint as NFT via the Zora integration
      try {
        const { ZoraVideoIntegration } = await import("../../zora-video");
        const zora = new ZoraVideoIntegration(env);
        const mintResult = await zora.mintVideoNFT({
          videoUrl: recordingUrl,
          thumbnailUrl: `https://app.degenfeed.xyz/og/live/${sessionId}.png`,
          title,
          description: `Live short recording by ${metadata.creatorHandle ?? "creator"}`,
          creator: String(metadata.creator ?? ""),
          editionSize: 1,
          contentHash: `live-short-${sessionId}`,
          chain: "base",
        });

        if (mintResult.ok && mintResult.tokenId) {
          // Update metadata with the minted token info
          (metadata.properties as Record<string, unknown>).tokenId = mintResult.tokenId;
          (metadata.properties as Record<string, unknown>).contractAddress =
            mintResult.contractAddress;
          (metadata.properties as Record<string, unknown>).zoraUrl = mintResult.zoraUrl;

          await env.CONTENT_STORE?.put(
            zoraMetaKey,
            JSON.stringify(metadata),
            { expirationTtl: 86400 * 30 },
          );
        }
      } catch {
        // Minting is best-effort — the metadata is still accessible
      }
    } catch {
      // Non-critical
    }
  },

  async getViewerCount(
    env: Env,
    protocolId: string,
  ): Promise<ViewerCountResult> {
    // Zora: no real-time viewer tracking for NFT metadata.
    // Return 0 — DegenFeed will use the direct HLS connection count.
    return { count: 0, rawSignal: 0 };
  },

  async postTipNotification(
    env: Env,
    _protocolId: string,
    tipper: string,
    amount: string,
    _chain: string,
    _message?: string,
  ): Promise<void> {
    // Zora: tips flow through the coin/NFT purchase mechanism.
    // Log the tip for reference.
    try {
      const tipKey = `zora:live-tip:${_protocolId}`;
      const existing = await env.CONTENT_STORE?.get(tipKey).catch(() => null);
      const tips: Array<{ tipper: string; amount: string; timestamp: number }> =
        existing ? JSON.parse(existing) : [];
      tips.push({ tipper, amount, timestamp: Date.now() });
      // Keep only last 100 tips
      const trimmed = tips.slice(-100);
      await env.CONTENT_STORE?.put(tipKey, JSON.stringify(trimmed), {
        expirationTtl: 86400 * 7,
      }).catch(() => {});
    } catch {
      // Non-critical
    }
  },
};

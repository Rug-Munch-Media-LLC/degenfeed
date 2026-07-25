/**
 * @degenfeed/api-worker — Farcaster Live Short Strategy
 *
 * Farcaster has PARTIAL live support via Frames. Frames can embed video
 * (fc:frame:video pointing to HLS) and since FIP #269, they can also serve
 * a live activity manifest.
 *
 * Strategy: Use Farcaster Frames for the closest-to-native experience:
 *   1. Frame with `fc:frame:video` pointing to HLS stream URL
 *   2. `fc:live=1` with duration/remaining tags per FIP #269
 *   3. Creator sets USER_DATA_TYPE_LIVE_AT per FIP #268
 *   4. Live activity manifest endpoint at `/.well-known/farcaster.json`
 *   5. Warpcast renders it as a "LIVE" frame with inline player
 *   6. Cast embed anchor for chat/reactions
 *
 * Native live support: PARTIAL — Frames can embed video but there's no
 * native player experience.
 */

import type { Env } from '../../../index';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.farcaster;

/**
 * Farcaster live short strategy using Frames + FIP #269 live activity.
 */
export const farcasterLiveStrategy: ProtocolStrategy = {
  config: STRATEGY,

  async announceLive(
    env: Env,
    sessionId: string,
    _creator: string,
    creatorHandle: string,
    title: string,
    _playbackUrl: string,
    duration: number,
  ): Promise<LiveSessionInfo> {
    try {
      const { HubClient, buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');

      // The live activity URL — serves fc:live meta tags
      const activityUrl = `https://app.degenfeed.xyz/frames/live/${sessionId}`;

      // Build cast text with reference to the activity URL
      const text =
        `🔴 LIVE SHORT: ${title}\n\n${creatorHandle} is live!\n\n⏱ ${duration}s\n\n${activityUrl}`.slice(
          0,
          320,
        );

      // Use configured signer
      const signerKeyHex = env.FARCASTER_SIGNER_KEY ?? '';
      const fid = Number(env.FARCASTER_FID ?? '');

      if (!signerKeyHex || !fid) {
        return {
          protocolId: '',
          protocolUrl: '',
          announced: false,
          error: 'Farcaster credentials not configured',
        };
      }

      const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';

      // Build and sign the cast
      const signed = buildFarcasterCastMessage({
        signerKeyHex,
        fid,
        text,
      });

      if (!signed.ok || !signed.messageHex) {
        return {
          protocolId: '',
          protocolUrl: '',
          announced: false,
          error: signed.error ?? 'Failed to build cast',
        };
      }

      // Submit to Hub
      const client = new HubClient(hubUrl);
      await client.submitMessage(signed.messageHex!);

      const castHash = signed.messageHex.slice(0, 40);

      return {
        protocolId: castHash,
        protocolUrl: `https://warpcast.com/${creatorHandle}/0x${castHash}`,
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
    // Post a follow-up cast that the live short recording is available
    if (!protocolId) return;

    try {
      const { HubClient, buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');

      const signerKeyHex = env.FARCASTER_SIGNER_KEY ?? '';
      const fid = Number(env.FARCASTER_FID ?? '');
      if (!signerKeyHex || !fid) return;

      const text = `✅ Recording available: ${title}\n\n📺 ${recordingUrl}`.slice(0, 320);

      const signed = buildFarcasterCastMessage({
        signerKeyHex,
        fid,
        text,
        parentHashHex: protocolId, // Reply to the original cast
      });

      if (!signed.ok) return;

      const client = new HubClient(env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281');
      if (signed.messageHex) await client.submitMessage(signed.messageHex);
    } catch {
      // Non-critical
    }
  },

  async getViewerCount(env: Env, protocolId: string): Promise<ViewerCountResult> {
    // Farcaster: count reactions + recasts as viewer proxy
    if (!protocolId) return { count: 0, rawSignal: 0 };

    try {
      const { HubClient } = await import('@degenfeed/farcaster-sdk');
      const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';
      const client = new HubClient(hubUrl);

      const cast = await (client as any).getCastById(protocolId, 0);
      const reactions = (cast?.reactions?.count ?? 0) as number;
      const recasts = (cast?.recasts?.count ?? 0) as number;
      const replies = (cast?.replies?.count ?? 0) as number;

      const rawSignal = reactions + recasts + replies;
      const count = Math.floor(rawSignal * 4) + 3;

      return { count, rawSignal };
    } catch {
      return { count: 0, rawSignal: 0 };
    }
  },
};

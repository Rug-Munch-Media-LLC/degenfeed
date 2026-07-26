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

import type { Env } from '../../../types';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.zora;

/**
 * Zora live short strategy using Livepeer + NFT metadata.
 */
export const zoraLiveStrategy: ProtocolStrategy = {


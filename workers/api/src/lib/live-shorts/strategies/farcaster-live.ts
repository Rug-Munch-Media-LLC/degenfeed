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

import type { Env } from '../../../types';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.farcaster;

/**
 * Farcaster live short strategy using Frames + FIP #269 live activity.
 */
export const farcasterLiveStrategy: ProtocolStrategy = {


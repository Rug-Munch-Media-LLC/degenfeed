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

import type { Env } from '../../../types';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.lens;

/**
 * Lens live short strategy using publications with Open Actions.
 */
export const lensLiveStrategy: ProtocolStrategy = {


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

import type { Env } from '../../../types';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.atproto;

/**
 * Bluesky/AT Protocol live short strategy using embed cards + feed generator.
 */
export const atProtoLiveStrategy: ProtocolStrategy = {


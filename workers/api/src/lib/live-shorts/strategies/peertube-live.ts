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

import type { Env } from '../../../types';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.activitypub;

/**
 * ActivityPub live short strategy using PeerTube as the backend.
 */
export const activityPubLiveStrategy: ProtocolStrategy = {


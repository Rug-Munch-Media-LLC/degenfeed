/**
 * @degenfeed/api-worker — ActivityPub Stream Bridge
 *
 * Bridge between DegenFeed streams and ActivityPub federation (Mastodon/GoToSocial).
 *
 * THREE capabilities:
 *   1. Announce a live stream as a federated ActivityPub post
 *   2. Fetch replies/comments from the AP announcement
 *   3. Bridge AP comments into the DegenFeed stream chat in real-time
 *
 * PeerTube is natively ActivityPub-federated. When we stream via PeerTube:
 *   - PeerTube announces the stream as an ActivityPub Activity
 *   - Mastodon/Pixelfed instances federate the announcement
 *   - Users see the stream in their federated timeline
 *   - They can watch inline (PeerTube embed works in Mastodon)
 *   - They can comment/favorite/boost
 *   - Their interactions federate back to PeerTube
 *
 * This bridge handles the DegenFeed-side announcement (via GoToSocial API)
 * and the reply-fetching loop that surfaces Mastodon comments in our stream chat.
 */

import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { withReliability } from './bridge-reliability';

// ─── Types ────────────────────────────────────────────────────────────────

export type LiveStream = {};

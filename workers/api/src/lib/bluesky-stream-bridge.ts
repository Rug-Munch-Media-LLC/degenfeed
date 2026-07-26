/**
 * @degenfeed/api-worker — Bluesky (AT Protocol) Stream Bridge
 *
 * Bridge between DegenFeed streams and the AT Protocol (Bluesky).
 *
 * THREE capabilities:
 *   1. Announce a live stream as a Bluesky post with external embed card
 *   2. Add the announcement to the "DegenFeed Live" feed generator
 *   3. Fetch Bluesky replies/comments and bridge them to stream chat
 *
 * Bluesky doesn't have native live streaming, so we use:
 *   - Post with `app.bsky.embed.external` for rich preview cards
 *   - Custom feed generator at `did:web:live.degenfeed.xyz`
 *   - Reply bridge via getPostThread
 */

import type { Env } from '../types';
import type { LiveStream } from './activitypub-stream-bridge';
import { withReliability } from './bridge-reliability';

// ─── Types ────────────────────────────────────────────────────────────────

export type BlueskyAnnounceResult = {};

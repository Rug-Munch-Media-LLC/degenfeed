/**
 * @degenfeed/api-worker — Farcaster Live Activity Helpers
 *
 * Implements FIP #268 (Live Activity Status) and FIP #269 (Live Activity Manifest)
 * for DegenFeed streams and spaces.
 *
 * Live Activity flow:
 *   1. Creator starts a stream/space → server builds the activity URL
 *   2. Activity URL serves `fc:live=1` meta tags (per FIP #269)
 *   3. Creator's signer writes USER_DATA_TYPE_LIVE_AT = activity URL (per FIP #268)
 *   4. Activity URL hosts a manifest endpoint with JFS host attestation
 *   5. A cast is created referencing the activity URL as embed → becomes chat anchor
 *
 * @see https://github.com/farcasterxyz/protocol/discussions/269
 * @see https://github.com/farcasterxyz/protocol/discussions/268
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type LiveActivityType = 'live-video' | 'live-audio-space' | 'live-event' | 'live-stream';

export type LiveActivityMeta = {};

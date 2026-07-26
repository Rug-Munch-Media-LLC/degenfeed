/**
 * @degenfeed/api-worker — Live Short Strategy Interface
 *
 * Abstract interface for protocol-specific live short streaming strategies.
 * Each protocol supported by DegenFeed implements this interface to provide
 * the optimal live streaming experience for that protocol's users.
 *
 * Strategy types:
 *   - "full": Protocol has native live support (PeerTube for AP, Kind 30311 for Nostr)
 *   - "partial": Protocol can embed/display live but lacks native live events
 *   - "none": Protocol has no live support — use the closest approximation
 *   - "native": Our own DegenFeed experience
 */

import type { Env } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type ProtocolId =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'degenfeed';

export type BackendType = 'peertube' | 'livepeer' | 'mux_owned';

export type NativeLiveSupport = 'full' | 'partial' | 'none';

export type DisplayFormat =
  | 'embedded_hls' // Native HLS embed (PeerTube, DegenFeed)
  | 'external_embed_with_live_badge' // Bluesky embed card
  | 'native_live_event' // Nostr Kind 30311
  | 'frame_with_hls' // Farcaster Frame with video
  | 'link_with_metadata' // Lens Open Action
  | 'live_nft' // Zora live NFT
  | 'vertical_swipe'; // DegenFeed native

export type PostFormat =
  | 'note_with_attachment'
  | 'embed_card'
  | 'kind_30311'
  | 'live_frame'
  | 'publication_with_open_action'
  | 'live_erc1155'
  | 'native_short';

export interface LiveShortConfig {

export interface LiveSessionInfo {

export interface ViewerCountResult {

export interface ProtocolStrategy {


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

import type { Env } from "../../index";

// ─── Types ────────────────────────────────────────────────────────────────

export type ProtocolId =
  | "activitypub"
  | "atproto"
  | "nostr"
  | "farcaster"
  | "lens"
  | "zora"
  | "degenfeed";

export type BackendType = "peertube" | "livepeer" | "mux_owned";

export type NativeLiveSupport = "full" | "partial" | "none";

export type DisplayFormat =
  | "embedded_hls"       // Native HLS embed (PeerTube, DegenFeed)
  | "external_embed_with_live_badge"  // Bluesky embed card
  | "native_live_event"  // Nostr Kind 30311
  | "frame_with_hls"     // Farcaster Frame with video
  | "link_with_metadata" // Lens Open Action
  | "live_nft"           // Zora live NFT
  | "vertical_swipe";    // DegenFeed native

export type PostFormat =
  | "note_with_attachment"
  | "embed_card"
  | "kind_30311"
  | "live_frame"
  | "publication_with_open_action"
  | "live_erc1155"
  | "native_short";

export interface LiveShortConfig {
  /** Which backend this protocol uses for RTMP→HLS transcoding. */
  backend: BackendType;
  /** Level of native live streaming support this protocol has. */
  nativeLiveSupport: NativeLiveSupport;
  /** How to measure viewer engagement on this protocol. */
  viewerSignal: string;
  /** How the live short is displayed to viewers on this protocol. */
  displayFormat: DisplayFormat;
  /** How the live short post is formatted on this protocol. */
  postFormat: PostFormat;
  /** Human-readable label for the protocol (e.g. "Mastodon"). */
  label: string;
  /** Color for UI badge. */
  color: string;
  /** Whether this protocol supports tipping natively. */
  supportsNativeTipping: boolean;
}

export interface LiveSessionInfo {
  /** Protocol-specific session/post ID. */
  protocolId: string;
  /** URL where the live short is visible on this protocol. */
  protocolUrl: string;
  /** Whether the announcement succeeded. */
  announced: boolean;
  /** Error message if announcement failed. */
  error?: string;
}

export interface ViewerCountResult {
  /** Estimated viewer count on this protocol. */
  count: number;
  /** Raw signal value (likes, clicks, WS connections, etc.). */
  rawSignal: number;
}

export interface ProtocolStrategy {
  /** Static configuration for this protocol. */
  config: LiveShortConfig;

  /**
   * Announce a live short on this protocol.
   *
   * Called when the creator starts a live short. Returns the protocol-specific
   * post/event ID and URL so viewers can find and watch the live short.
   */
  announceLive(
    env: Env,
    sessionId: string,
    creator: string,
    creatorHandle: string,
    title: string,
    playbackUrl: string,
    /** Duration in seconds (typically 60). */
    duration: number,
  ): Promise<LiveSessionInfo>;

  /**
   * Update the live short announcement to "ended" status.
   *
   * Called when the live short ends. Some protocols can update the original
   * post to show "Recording available" or similar.
   */
  updateEnded(
    env: Env,
    sessionId: string,
    protocolId: string,
    title: string,
    recordingUrl: string,
  ): Promise<void>;

  /**
   * Get the current viewer count from this protocol.
   *
   * Different protocols have different signals for live viewers:
   * - ActivityPub: engagement rate / boosts
   * - Bluesky: embed click count
   * - Nostr: current_participants tag
   * - Farcaster: frame interaction count
   * - Lens: publication stats
   * - Zora: NFT views
   * - DegenFeed: WebSocket connections
   */
  getViewerCount(
    env: Env,
    protocolId: string,
  ): Promise<ViewerCountResult>;

  /**
   * Post a tip notification on this protocol.
   *
   * Some protocols allow posting tip events (Nostr zaps, Farcaster casts).
   */
  postTipNotification?(
    env: Env,
    protocolId: string,
    tipper: string,
    amount: string,
    chain: string,
    message?: string,
  ): Promise<void>;
}

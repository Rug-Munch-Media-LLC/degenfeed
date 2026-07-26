/**
 * @degenfeed/api-worker — Protocol Live Short Strategies Registry
 *
 * Central registry mapping every protocol DegenFeed supports to its optimal
 * live short streaming strategy. Each strategy defines:
 *   1. Which streaming backend to use (PeerTube, Livepeer, Mux/Owncast)
 *   2. How native the live experience is on that protocol
 *   3. How to display the live short to viewers
 *   4. How to format the post/announcement
 *   5. Which viewer engagement signal to use
 *
 * Where native live support exists (PeerTube for ActivityPub, Kind 30311 for
 * Nostr), we use it. Where it doesn't (Bluesky, Lens, Zora), we create the
 * closest possible approximation. On DegenFeed itself, we build the best
 * experience.
 */

import type { BackendType, LiveShortConfig, NativeLiveSupport, ProtocolId } from './live-strategy';

// ─── Per-Protocol Strategy Configurations ───────────────────────────────

export const LIVE_SHORT_STRATEGIES: Record<ProtocolId, LiveShortConfig> = {
  activitypub: {
    backend: 'peertube' as BackendType,
    nativeLiveSupport: 'full' as NativeLiveSupport,
    viewerSignal: 'reblogs_count, replies_count',
    displayFormat: 'embedded_hls',
    postFormat: 'note_with_attachment',
    label: 'PeerTube',
    color: '#f1680d',
    supportsNativeTipping: false,
  },

  atproto: {
    backend: 'livepeer' as BackendType,
    nativeLiveSupport: 'none' as NativeLiveSupport,
    viewerSignal: 'embed_clicks, reply_count',
    displayFormat: 'external_embed_with_live_badge',
    postFormat: 'embed_card',
    label: 'Bluesky',
    color: '#0085ff',
    supportsNativeTipping: false,
  },

  nostr: {
    backend: 'livepeer' as BackendType,
    nativeLiveSupport: 'full' as NativeLiveSupport,
    viewerSignal: 'current_participants_tag',
    displayFormat: 'native_live_event',
    postFormat: 'kind_30311',
    label: 'Nostr',
    color: '#8b5cf6',
    supportsNativeTipping: true,
  },

  farcaster: {
    backend: 'livepeer' as BackendType,
    nativeLiveSupport: 'partial' as NativeLiveSupport,
    viewerSignal: 'frame_interactions',
    displayFormat: 'frame_with_hls',
    postFormat: 'live_frame',
    label: 'Farcaster',
    color: '#855dcd',
    supportsNativeTipping: false,
  },

  lens: {
    backend: 'livepeer' as BackendType,
    nativeLiveSupport: 'none' as NativeLiveSupport,
    viewerSignal: 'publication_stats',
    displayFormat: 'link_with_metadata',
    postFormat: 'publication_with_open_action',
    label: 'Lens',
    color: '#00501e',
    supportsNativeTipping: false,
  },

  zora: {
    backend: 'livepeer' as BackendType,
    nativeLiveSupport: 'none' as NativeLiveSupport,
    viewerSignal: 'nft_views',
    displayFormat: 'live_nft',
    postFormat: 'live_erc1155',
    label: 'Zora',
    color: '#6b21a8',
    supportsNativeTipping: true,
  },

  degenfeed: {
    backend: 'livepeer' as BackendType,
    nativeLiveSupport: 'full' as NativeLiveSupport,
    viewerSignal: 'ws_connections',
    displayFormat: 'vertical_swipe',
    postFormat: 'native_short',
    label: 'DegenFeed',
    color: '#f97316',
    supportsNativeTipping: true,
  },
};

// ─── Lookup Helpers ─────────────────────────────────────────────────────

/**
 * Get a protocol's live short strategy configuration.
 * Throws if the protocol is not supported.
 */
export function getStrategyForProtocol(protocol: string): LiveShortConfig {
  const normalized = protocol.toLowerCase().replace(/[^a-z]/g, '');
  const config = LIVE_SHORT_STRATEGIES[normalized as ProtocolId];
  if (!config) {
    throw new Error(`No live short strategy for protocol: ${protocol}`);
  }
  return config;
}

/**
 * Get the backend type for a protocol.
 * Determines which streaming infrastructure to use.
 */
export function getBackendForProtocol(protocol: string): BackendType {
  return getStrategyForProtocol(protocol).backend;
}

/**
 * Check if a protocol has native live streaming support.
 */
export function hasNativeLiveSupport(protocol: string): boolean {
  const support = getStrategyForProtocol(protocol).nativeLiveSupport;
  return support === 'full';
}

/**
 * Check if a protocol has any live support (full or partial).
 */
export function hasAnyLiveSupport(protocol: string): boolean {
  return getStrategyForProtocol(protocol).nativeLiveSupport !== 'none';
}

/**
 * Get the display format for a protocol's live short.
 * Used by the frontend to render the appropriate player UI.
 */
export function getDisplayFormat(protocol: string): string {
  return getStrategyForProtocol(protocol).displayFormat;
}

/**
 * Get all protocols that support native live streaming.
 * These get the best experience with minimal workarounds.
 */
export function getNativeLiveProtocols(): ProtocolId[] {
  return (Object.entries(LIVE_SHORT_STRATEGIES) as [ProtocolId, LiveShortConfig][])
    .filter(([_, config]) => config.nativeLiveSupport === 'full')
    .map(([id]) => id);
}

/**
 * Get all protocols ordered by native live support quality.
 */
export function getProtocolsByLiveQuality(): Array<{
  protocol: ProtocolId;
  config: LiveShortConfig;
}> {
  const qualityOrder: Record<NativeLiveSupport, number> = {
    full: 0,
    partial: 1,
    none: 2,
  };

  return (Object.entries(LIVE_SHORT_STRATEGIES) as [ProtocolId, LiveShortConfig][])
    .map(([protocol, config]) => ({ protocol, config }))
    .sort(
      (a, b) => qualityOrder[a.config.nativeLiveSupport] - qualityOrder[b.config.nativeLiveSupport],
    );
}

// ─── Strategy Selector ──────────────────────────────────────────────────

/**
 * Select which backend streaming infrastructure to use for a given set of
 * protocols. If ANY protocol uses PeerTube, we spin up PeerTube. If any uses
 * Livepeer, we use Livepeer. If both, PeerTube takes priority (it can serve
 * as a general HLS source that other protocols reference).
 */
export function selectBackend(protocols: ProtocolId[]): BackendType {
  if (protocols.some((p) => LIVE_SHORT_STRATEGIES[p]?.backend === 'peertube')) {
    return 'peertube';
  }
  return 'livepeer';
}

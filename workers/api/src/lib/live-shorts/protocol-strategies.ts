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

// ─── Lookup Helpers ─────────────────────────────────────────────────────

/**
 * Get a protocol's live short strategy configuration.
 * Throws if the protocol is not supported.
 */
export function getStrategyForProtocol(protocol: string): LiveShortConfig {

/**
 * Get the backend type for a protocol.
 * Determines which streaming infrastructure to use.
 */
export function getBackendForProtocol(protocol: string): BackendType {

/**
 * Check if a protocol has native live streaming support.
 */
export function hasNativeLiveSupport(protocol: string): boolean {

/**
 * Check if a protocol has any live support (full or partial).
 */
export function hasAnyLiveSupport(protocol: string): boolean {

/**
 * Get the display format for a protocol's live short.
 * Used by the frontend to render the appropriate player UI.
 */
export function getDisplayFormat(protocol: string): string {

/**
 * Get all protocols that support native live streaming.
 * These get the best experience with minimal workarounds.
 */
export function getNativeLiveProtocols(): ProtocolId[] {

/**
 * Get all protocols ordered by native live support quality.
 */
export function getProtocolsByLiveQuality(): Array<{

// ─── Strategy Selector ──────────────────────────────────────────────────

/**
 * Select which backend streaming infrastructure to use for a given set of
 * protocols. If ANY protocol uses PeerTube, we spin up PeerTube. If any uses
 * Livepeer, we use Livepeer. If both, PeerTube takes priority (it can serve
 * as a general HLS source that other protocols reference).
 */
export function selectBackend(protocols: ProtocolId[]): BackendType {


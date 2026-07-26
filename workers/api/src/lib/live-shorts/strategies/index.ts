/**
 * @degenfeed/api-worker — Strategy Router
 *
 * Provides a unified way to resolve a protocol to its live short strategy.
 * Each protocol's strategy is implemented in its own file and exported here.
 */

import type { ProtocolId, ProtocolStrategy } from '../live-strategy';
import { atProtoLiveStrategy } from './atproto-live';
import { degenfeedLiveStrategy } from './degenfeed-live';
import { farcasterLiveStrategy } from './farcaster-live';
import { lensLiveStrategy } from './lens-live';
import { nostrLiveStrategy } from './nostr-live';
import { activityPubLiveStrategy } from './peertube-live';
import { zoraLiveStrategy } from './zora-live';

// ─── Strategy Registry ─────────────────────────────────────────────────

const STRATEGY_MAP: Record<string, ProtocolStrategy> = {

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Get the live short strategy for a given protocol.
 * Throws if the protocol is not supported.
 */
export function getStrategy(protocol: string): ProtocolStrategy {

/**
 * Get all available strategies.
 */
export function getAllStrategies(): Record<string, ProtocolStrategy> {

/**
 * Get all protocols that have a registered strategy.
 */
export function getAllProtocolIds(): ProtocolId[] {

export {


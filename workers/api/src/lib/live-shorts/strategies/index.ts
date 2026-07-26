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
  activitypub: activityPubLiveStrategy,
  atproto: atProtoLiveStrategy,
  nostr: nostrLiveStrategy,
  farcaster: farcasterLiveStrategy,
  lens: lensLiveStrategy,
  zora: zoraLiveStrategy,
  degenfeed: degenfeedLiveStrategy,
};

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Get the live short strategy for a given protocol.
 * Throws if the protocol is not supported.
 */
export function getStrategy(protocol: string): ProtocolStrategy {
  const normalized = protocol.toLowerCase().replace(/[^a-z]/g, '');
  const strategy = STRATEGY_MAP[normalized];
  if (!strategy) {
    throw new Error(`No live short strategy for protocol: ${protocol}`);
  }
  return strategy;
}

/**
 * Get all available strategies.
 */
export function getAllStrategies(): Record<string, ProtocolStrategy> {
  return { ...STRATEGY_MAP };
}

/**
 * Get all protocols that have a registered strategy.
 */
export function getAllProtocolIds(): ProtocolId[] {
  return Object.keys(STRATEGY_MAP) as ProtocolId[];
}

export {
  activityPubLiveStrategy,
  atProtoLiveStrategy,
  degenfeedLiveStrategy,
  farcasterLiveStrategy,
  lensLiveStrategy,
  nostrLiveStrategy,
  zoraLiveStrategy,
};

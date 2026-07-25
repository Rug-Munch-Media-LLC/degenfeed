/**
 * @degenfeed/cross-protocol-bridge — Transform Registry
 *
 * Registry of all bridge adapters.
 * Each adapter handles serialization/deserialization for a specific
 * source→target protocol pair.
 */

import type { BridgeAdapter } from '../types';
import { activityPubToAtProto } from './activitypub-to-atproto';
import { activityPubToNostr } from './activitypub-to-nostr';
import { atProtoToNostr } from './atproto-to-nostr';
import { blueskyToLemmy } from './bluesky-to-lemmy';
import { farcasterToMastodon } from './farcaster-to-mastodon';
import { nostrToFarcaster } from './nostr-to-farcaster';
import { peertubeToNostr } from './peertube-to-nostr';
import { rssToActivityPub } from './rss-to-activitypub';

/** All registered adapters */
const adapters = new Map<string, BridgeAdapter>();

/**
 * Register a bridge adapter.
 */
export function registerAdapter(adapter: BridgeAdapter): void {
  adapters.set(adapter.id, adapter);
}

/**
 * Get a bridge adapter by its path ID.
 */
export function getAdapter(pathId: string): BridgeAdapter | undefined {
  return adapters.get(pathId);
}

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): BridgeAdapter[] {
  return Array.from(adapters.values());
}

// ─── Register built-in adapters ─────────────────────────────────────────

export function registerBuiltinAdapters(): void {
  // Existing bridges
  registerAdapter(activityPubToAtProto);
  registerAdapter(activityPubToNostr);
  registerAdapter(atProtoToNostr);
  registerAdapter(nostrToFarcaster);
  registerAdapter(rssToActivityPub);

  // 🆕 New bridges (2026-07-25)
  registerAdapter(peertubeToNostr);
  registerAdapter(farcasterToMastodon);
  registerAdapter(blueskyToLemmy);
}

// Register them on import
registerBuiltinAdapters();

/**
 * Stub providers for protocols without a running local service.
 * Returns empty results gracefully so the bridge doesn't error out.
 */

import type { UnifiedPost } from '../server';

export async function fetchNostrPosts(_limit: number): Promise<UnifiedPost[]> {
  // Nostr relay connector TBD — would connect to wss://relay.damus.io etc.
  return [];
}

export async function fetchFarcasterPosts(_limit: number): Promise<UnifiedPost[]> {
  // Farcaster hub connector TBD — would query nemes.farcaster.xyz:2283
  return [];
}

export async function fetchLensPosts(_limit: number): Promise<UnifiedPost[]> {
  // Lens API connector TBD — would query lens-api or direct polygon RPC
  return [];
}

export async function fetchPixelfedPosts(_limit: number): Promise<UnifiedPost[]> {
  // Pixelfed / ActivityPub connector TBD
  return [];
}

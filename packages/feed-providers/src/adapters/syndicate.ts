/**
 * Syndicate Adapter
 *
 * Syndicate is a DAO infrastructure platform offering legal wrappers,
 * banking, and on-chain treasury management.
 *
 * API: https://syndicate.io/api
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

export async function fetchSyndicatePosts(limit = 10): Promise<UnifiedPost[]> {
  return []; // DAO infrastructure — no public social feed
}

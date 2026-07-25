/**
 * Syndicate Adapter
 *
 * Syndicate is a DAO infrastructure platform offering legal wrappers,
 * banking, and on-chain treasury management.
 *
 * API: https://syndicate.io/api
 */
import type { UnifiedPost } from '@degenfeed/types';

const _$fetch = globalThis.fetch;

export async function fetchSyndicatePosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // DAO infrastructure — no public social feed
}

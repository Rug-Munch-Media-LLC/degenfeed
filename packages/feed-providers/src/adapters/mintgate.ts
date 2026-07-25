/**
 * MintGate Adapter
 *
 * MintGate provides token-gated access to content and communities.
 * Supports ERC-20, ERC-721, and ERC-1155 tokens.
 *
 * API: https://app.mintgate.io/api
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

export async function fetchMintGatePosts(limit = 10): Promise<UnifiedPost[]> {
  return [];
}

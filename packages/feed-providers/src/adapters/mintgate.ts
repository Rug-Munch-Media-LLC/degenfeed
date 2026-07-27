/**
 * MintGate Adapter
 *
 * MintGate provides token-gated access to content and communities.
 * Supports ERC-20, ERC-721, and ERC-1155 tokens.
 *
 * API: https://app.mintgate.io/api
 */
import type { UnifiedPost } from '@degenfeed/types';

export async function fetchMintGatePosts(_limit = 10): Promise<UnifiedPost[]> {
  return [];
}

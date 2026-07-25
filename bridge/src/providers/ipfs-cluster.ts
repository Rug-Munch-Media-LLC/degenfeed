/**
 * IPFS Cluster Bridge Provider
 *
 * IPFS Cluster provides decentralized pinning orchestration
 * across a swarm of IPFS daemons. Self-hosted pinset management.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'ipfs-cluster',
  name: 'IPFS Cluster',
  description: 'Decentralized pinning orchestration for IPFS',
  endpoint: '/api/feed/ipfs-cluster',
  requiresAuth: false,
  contentType: 'data',
};

export async function fetchIpfsClusterPosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchIpfsClusterPosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    console.log(`[bridge] IPFS Cluster error: ${(err as Error).message}`);
    return [];
  }
}

/** @alias */
export const fetch = fetchIpfsClusterPosts;

/**
 * Headscale Bridge Provider
 *
 * Headscale is an open-source Tailscale coordination server.
 * Provides WireGuard-based secure networking for our fleet.
 * Reports node status, connected clients, and network health.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) _adapter = await import('@degenfeed/feed-providers');
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'headscale',
  name: 'Headscale',
  description: 'Self-hosted Tailscale coordination server for mesh VPN',
  endpoint: '/api/feed/headscale',
  requiresAuth: false,
  contentType: 'status',
};

export async function fetchHeadscalePosts(limit = 20): Promise<UnifiedPost[]> {
  try {
    const { fetchHeadscalePosts: adapterFetch } = await getAdapter();
    return adapterFetch(limit);
  } catch (err) {
    // console.log(`[bridge] Headscale error: ${(err as Error).message}`);
    return [];
  }
}
export const fetch = fetchHeadscalePosts;

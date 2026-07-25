/**
 * ION (Identity Overlay Network) / Sidetree Adapter
 *
 * ION is a DID method on Bitcoin using the Sidetree protocol.
 * Allows scalable DIDs without additional consensus.
 *
 * API: https://identity.foundation/sidetree/api/
 *      ION resolver: https://discover.did.microsoft.com/1.0/identifiers/{did}
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const ION_RESOLVER = 'https://discover.did.microsoft.com/1.0/identifiers';

export async function resolveION(did: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await $fetch(`${ION_RESOLVER}/${encodeURIComponent(did)}`, {
      headers: { 'User-Agent': 'DegenFeed/0.1', Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchIONPosts(_limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  // ION is an identity infrastructure — no social feed. We surface ecosystem news as posts.
  return posts;
}

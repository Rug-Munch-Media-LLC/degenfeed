/**
 * Tally Adapter
 *
 * Tally is a DAO governance platform for on-chain voting.
 * Supports proposal creation, delegation, and voting.
 *
 * API: https://www.tally.xyz/graphql
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const TALLY_API = 'https://api.tally.xyz/query';

export async function fetchTallyProposals(organizationId: string, limit = 5): Promise<any[]> {
  try {
    const res = await $fetch(TALLY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': '' },
      body: JSON.stringify({
        query: `query Proposals($id: ID!, $limit: Int!) {
          proposals(first: $limit, governors: [$id]) {
            id title description { summary }
            status start { timestamp } end { timestamp }
            voteStats { type votes }
          }
        }`,
        variables: { id: organizationId, limit },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return data?.data?.proposals || [];
  } catch {
    return [];
  }
}

export async function fetchTallyPosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // DAO governance — feed integration via Snapshot/Gov. proposals
}

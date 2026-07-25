/**
 * Snapshot X Adapter
 *
 * Snapshot X is a voting protocol with on-chain execution.
 * Supports multiple strategies for voting power calculation.
 *
 * API: Snapshot Hub — https://hub.snapshot.org/graphql
 *      Snapshot X — https://snapshot.org
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const SNAPSHOT_HUB = 'https://hub.snapshot.org/graphql';

export async function fetchProposals(space: string, limit = 10): Promise<any[]> {
  try {
    const res = await $fetch(SNAPSHOT_HUB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query Proposals($space: String!, $limit: Int!) {
          proposals(first: $limit, where: { space: $space }) {
            id title body start end state scores
            space { id name avatar network }
            author
          }
        }`,
        variables: { space, limit },
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

export async function fetchSnapshotPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const spaces = ['uniswap', 'aave.eth', 'curve', 'balancer', 'compound', 'makerdao'];
  for (const space of spaces.slice(0, Math.ceil(limit / 2))) {
    const proposals = await fetchProposals(space, 2);
    for (const p of proposals) {
      posts.push({
        id: `snapshot:${p.id}`,
        protocol: 'snapshot' as Protocol,
        author: {
          id: `snapshot:${p.author}`,
          primary: { protocol: 'snapshot' as Protocol, id: p.author },
          handles: { snapshot: p.space?.id || space },
          displayName: p.space?.name || space,
          bio: '',
          avatarUrl: p.space?.avatar || '',
          followerCount: 0,
          followingCount: 0,
          verified: [],
          links: [],
          keys: {},
        },
        text: `📊 ${p.title}\n${p.body?.replace(/<[^>]*>/g, '').slice(0, 280) || ''}`,
        embeds: [],
        createdAt: new Date(p.start * 1000).getTime(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: p,
        niches: ['governance', 'dao'],
      });
    }
  }
  return posts;
}

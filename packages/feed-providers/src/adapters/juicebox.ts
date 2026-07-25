/**
 * Juicebox Adapter
 *
 * Juicebox is a community funding protocol for DAOs and projects.
 * Projects issue tokens in exchange for ETH contributions.
 *
 * API: https://juicebox.money/#/projects
 *      Subgraph: https://subgraph.juicebox.money/subgraphs/name/juicebox
 */
import type { Protocol, UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;
const JUICEBOX_SUBGRAPH = 'https://subgraph.juicebox.money/subgraphs/name/juicebox';

export async function fetchTrendingProjects(limit = 5): Promise<any[]> {
  try {
    const res = await $fetch(JUICEBOX_SUBGRAPH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query Projects($limit: Int!) {
          projects(first: $limit, orderBy: currentBalance, orderDirection: desc) {
            id projectId handle metadataUri
            currentBalance totalPaid
            trendingScore createdAt
          }
        }`,
        variables: { limit },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return data?.data?.projects || [];
  } catch {
    return [];
  }
}

export async function fetchJuiceboxPosts(limit = 10): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  const projects = await fetchTrendingProjects(Math.ceil(limit / 2));
  for (const p of projects) {
    posts.push({
      id: `juicebox:${p.id}`,
      protocol: 'juicebox' as Protocol,
      author: {
        id: `juicebox:${p.id}`,
        primary: { protocol: 'juicebox' as Protocol, id: String(p.projectId) },
        handles: { juicebox: p.handle || `project-${p.projectId}` },
        displayName: p.handle || `JB Project #${p.projectId}`,
        bio: 'Juicebox DAO project',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        verified: [],
        links: [],
        keys: {},
      },
      text: `🧃 Juicebox Project: ${p.handle || `#${p.projectId}`} — Balance: ${(Number(p.currentBalance || 0) / 1e18).toFixed(2)} ETH`,
      embeds: [],
      createdAt: Number(p.createdAt || 0) * 1000 || Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: p,
      niches: ['dao', 'funding'],
    });
  }
  return posts;
}

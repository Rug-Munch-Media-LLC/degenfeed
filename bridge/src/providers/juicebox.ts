/**
 * Juicebox bridge provider
 *
 * Integrates Juicebox — a programmable funding protocol for DAOs and
 * crypto projects on Ethereum. Projects create funding cycles where
 * contributors receive tokens in return for ETH.
 *
 * API: Public subgraph at https://subgraph.lexicon.dev
 * Docs: https://docs.juicebox.money
 * SDK: @juicebox/sdk (npm)
 *
 * Features:
 * - Active and trending funding projects
 * - Project details, funding goals, and progress
 * - Recent payouts and treasury activity
 * - Community engagement metrics
 *
 * Rate Limits: Public subgraph endpoint
 * Auth: None required for reads
 */

import type { UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const JUICEBOX_SUBGRAPH =
  process.env.JUICEBOX_SUBGRAPH_URL || 'https://subgraph.lexicon.dev/juicebox';

// ─── Types ─────────────────────────────────────────────────────────────

interface JBProject {
  id: string;
  projectId: number;
  handle: string;
  metadataUri: string;
  owner: string;
  createdAt: number;
  currentFundingCycle: {
    number: number;
    start: number;
    duration: number;
    weight: string;
    discountRate: number;
    ballot: string;
  };
  metadata: {
    name: string;
    description: string;
    logoUri: string;
    infoUri: string;
    tags: string[];
    nft?: string;
  };
  totalPaid: string;
  totalRedeemed: string;
  currentBalance: string;
  volume: string;
  trendingScore: number;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface ProjectsResult {
  projects: JBProject[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function guessNiches(name: string, description: string, tags: string[]): string[] {
  const niches: string[] = [];
  const lower = `${name} ${description} ${tags.join(' ')}`.toLowerCase();

  if (/\b(defi|liquidity|yield|lending|swap|dex|amm|farm|staking)\b/.test(lower))
    niches.push('defi');
  if (/\b(dao|governance|vote|treasury|multisig|fund)\b/.test(lower)) niches.push('dao');
  if (/\b(nft|art|collectible|mint|gallery|pixel)\b/.test(lower)) niches.push('nft');
  if (/\b(eth|ethereum|base|arbitrum)\b/.test(lower)) niches.push('ethereum');
  if (/\b(gaming|game|play|guild|metaverse)\b/.test(lower)) niches.push('gaming');
  if (/\b(ai|artificial|intelligence|llm|generative)\b/.test(lower)) niches.push('ai');
  if (/\b(music|audio|podcast|artist|creative)\b/.test(lower)) niches.push('music');
  if (/\b(public|goods|charity|climate|environment|open|source)\b/.test(lower))
    niches.push('public-goods');
  if (/\b(crypto|blockchain|web3|token)\b/.test(lower)) niches.push('crypto');

  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function formatEth(value: string): string {
  const wei = BigInt(value || '0');
  const eth = Number(wei) / 1e18;
  if (eth > 1000) return `${(eth / 1000).toFixed(1)}K ETH`;
  if (eth > 1) return `${eth.toFixed(2)} ETH`;
  return `${(eth * 1000).toFixed(0)} gwei`;
}

function jbProjectToPost(project: JBProject): UnifiedPost | null {
  const metadata = project.metadata;
  if (!metadata?.name) return null;

  const name = metadata.name;
  const description = metadata.description || '';
  const totalPaid = formatEth(project.totalPaid);
  const currentBalance = formatEth(project.currentBalance);
  const volume = formatEth(project.volume);
  const tags = metadata.tags || [];

  const tagStr = tags.length > 0 ? ` [${tags.slice(0, 4).join(', ')}]` : '';

  const text = `📦 ${name}${tagStr}\n\n${description.slice(0, 300)}\n\n💰 Raised: ${totalPaid} · Balance: ${currentBalance}${project.volume !== '0' ? ` · Vol: ${volume}` : ''}`;

  return {
    id: `juicebox:${project.projectId || project.id}`,
    protocol: 'juicebox' as string,
    author: {
      id: `juicebox:project:${project.handle || project.projectId}`,
      primary: {
        protocol: 'juicebox' as string,
        id: `${project.handle || project.projectId}`,
      },
      handles: { juicebox: project.handle || null },
      displayName: name,
      bio: description.slice(0, 160),
      avatarUrl: metadata.logoUri || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: metadata.logoUri
      ? [{ kind: 'image' as const, url: metadata.logoUri }]
      : metadata.infoUri
        ? [
            {
              kind: 'link' as const,
              url: metadata.infoUri,
              meta: { title: `${name} — Juicebox Project`, source: 'juicebox' },
            },
          ]
        : [],
    contentType: 'text',
    createdAt: project.createdAt ? project.createdAt * 1000 : Date.now(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: project.trendingScore ? Math.round(project.trendingScore * 100) : 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: project,
    niches: guessNiches(name, description, tags),
    community: {
      name: 'juicebox',
      title: 'Juicebox',
      niche: guessNiches(name, description, tags).join(','),
    },
  };
}

async function graphQLQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse<T>> {
  try {
    const res = await $fetch(JUICEBOX_SUBGRAPH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return {};
    return (await res.json()) as GraphQLResponse<T>;
  } catch (err) {
    console.log(`[bridge] Juicebox subgraph error: ${(err as Error).message}`);
    return {};
  }
}

// ─── Data Sources ───────────────────────────────────────────────────────

async function fetchTrendingProjects(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query TrendingProjects($limit: Int!) {
      projects(
        first: $limit,
        orderBy: trendingScore,
        orderDirection: desc
      ) {
        id
        projectId
        handle
        metadataUri
        owner
        createdAt
        metadata {
          name
          description
          logoUri
          infoUri
          tags
        }
        totalPaid
        totalRedeemed
        currentBalance
        volume
        trendingScore
      }
    }
  `;

  const res = await graphQLQuery<ProjectsResult>(query, { limit: Math.min(limit, 30) });
  const projects = res.data?.projects || [];
  return projects.map(jbProjectToPost).filter((p): p is UnifiedPost => p !== null);
}

async function fetchRecentProjects(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query RecentProjects($limit: Int!) {
      projects(
        first: $limit,
        orderBy: createdAt,
        orderDirection: desc
      ) {
        id
        projectId
        handle
        metadataUri
        owner
        createdAt
        metadata {
          name
          description
          logoUri
          infoUri
          tags
        }
        totalPaid
        totalRedeemed
        currentBalance
        volume
        trendingScore
      }
    }
  `;

  const res = await graphQLQuery<ProjectsResult>(query, { limit: Math.min(limit, 20) });
  const projects = res.data?.projects || [];
  return projects
    .filter((p) => p.metadata?.name)
    .map(jbProjectToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

async function fetchHighVolumeProjects(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query HighVolumeProjects($limit: Int!) {
      projects(
        first: $limit,
        orderBy: volume,
        orderDirection: desc
      ) {
        id
        projectId
        handle
        metadataUri
        owner
        createdAt
        metadata {
          name
          description
          logoUri
          infoUri
          tags
        }
        totalPaid
        totalRedeemed
        currentBalance
        volume
        trendingScore
      }
    }
  `;

  const res = await graphQLQuery<ProjectsResult>(query, { limit: Math.min(limit, 20) });
  const projects = res.data?.projects || [];
  return projects
    .filter((p) => p.metadata?.name && p.volume !== '0')
    .map(jbProjectToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

// ─── Schema Guardian ────────────────────────────────────────────────────

export const schema = {
  id: 'juicebox',
  name: 'Juicebox',
  description: 'DAO fundraising & programmable funding — crypto project treasury management',
  endpoint: '/api/feed/juicebox',
  requiresAuth: false,
  contentType: 'mixed',
};

// ─── Main Fetcher ───────────────────────────────────────────────────────

export async function fetchJuiceboxPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 3));

  const [trending, recent, highVolume] = await Promise.all([
    fetchTrendingProjects(perSource),
    fetchRecentProjects(perSource),
    fetchHighVolumeProjects(perSource),
  ]);

  const all = [...trending, ...recent, ...highVolume];
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];

  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Juicebox: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchJuiceboxPosts;

/**
 * Snapshot bridge provider
 *
 * Integrates Snapshot DAO governance proposals and votes into DegenFeed.
 * Snapshot is the leading off-chain voting platform for DAOs, DeFi protocols,
 * and NFT communities.
 *
 * API: Public GraphQL API at https://hub.snapshot.org/graphql
 * Docs: https://docs.snapshot.box/developers
 * SDK: @snapshot-labs/snapshot.js
 *
 * Features:
 * - Active DAO proposals across the ecosystem
 * - Trending/voting proposals with high participation
 * - Proposal details, vote counts, and results
 * - Multi-chain (Ethereum, Polygon, Arbitrum, Optimism, etc.)
 *
 * Rate Limits: Public endpoint, generous
 * Auth: None required for reads
 */

import type { UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const SNAPSHOT_GRAPHQL = process.env.SNAPSHOT_GRAPHQL_URL || 'https://hub.snapshot.org/graphql';

// ─── Types ─────────────────────────────────────────────────────────────

interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  snapshot: string;
  state: 'active' | 'closed' | 'pending';
  author: string;
  created: number;
  type: string;
  scores: number[];
  scores_total: number;
  votes: number;
  quorum: number;
  space: {
    id: string;
    name: string;
    avatar?: string;
  };
  network: string;
  strategies: Array<{
    name: string;
    network: string;
    params: Record<string, unknown>;
  }>;
  discussion: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface ProposalsResult {
  proposals: SnapshotProposal[];
}

// SpaceResult — reserved for future use
/* interface SpaceResult {
  space: {
    name: string;
    about?: string;
    avatar?: string;
    network: string;
  };
  proposals: SnapshotProposal[];
} */

// ─── Helpers ────────────────────────────────────────────────────────────

function guessNiches(title: string, body: string, space: string): string[] {
  const niches: string[] = [];
  const lower = `${title} ${body} ${space}`.toLowerCase();

  if (/\b(defi|liquidity|yield|lending|swap|dex|amm|stablecoin|farm)\b/.test(lower))
    niches.push('defi');
  if (/\b(dao|governance|vote|proposal|treasury|multisig)\b/.test(lower)) niches.push('dao');
  if (/\b(nft|art|collectible|mint|gallery)\b/.test(lower)) niches.push('nft');
  if (/\b(eth|ethereum|base|arbitrum|polygon|optimism|scroll|zksync)\b/.test(lower))
    niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(btc|bitcoin|lightning)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(grant|fund|allocate|reward|incentive)\b/.test(lower)) niches.push('funding');
  if (/\b(security|audit|bug|bounty|vulnerability)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|token)\b/.test(lower)) niches.push('crypto');

  if (niches.length === 0) niches.push('dao');
  return niches;
}

function formatVoteCount(proposal: SnapshotProposal): string {
  const total = proposal.scores_total || 0;
  const votes = proposal.votes || 0;
  const quorum = proposal.quorum || 0;

  if (proposal.state === 'active') {
    return `${votes} votes${quorum ? ` / ${quorum} quorum` : ''}`;
  }
  return `${total.toLocaleString()} total${votes ? ` (${votes} votes)` : ''}`;
}

function getProposalEmoji(state: string, scoresTotal: number): string {
  if (state === 'active') return '🗳️';
  if (scoresTotal > 10000) return '🔥';
  if (scoresTotal > 1000) return '📊';
  return '📋';
}

function snapshotProposalToPost(proposal: SnapshotProposal): UnifiedPost | null {
  const title = proposal.title || '';
  const body = proposal.body || '';
  const space = proposal.space;

  if (!title) return null;

  const emoji = getProposalEmoji(proposal.state, proposal.scores_total);
  const stateLabel =
    proposal.state === 'active'
      ? '🟢 Active'
      : proposal.state === 'pending'
        ? '⏳ Pending'
        : '🔒 Closed';
  const voteInfo = formatVoteCount(proposal);
  const spaceName = space?.name || space?.id || 'Unknown DAO';

  const _authorAddr = `${proposal.author.slice(0, 6)}...${proposal.author.slice(-4)}`;
  const text = `${emoji} [${spaceName}] ${title}\n\n${stateLabel} · ${voteInfo}\n\n${body.slice(0, 300)}`;

  const _startDate = proposal.start * 1000;
  const _endDate = proposal.end * 1000;

  return {
    id: `snapshot:${proposal.id}`,
    protocol: 'snapshot' as string,
    author: {
      id: `snapshot:user:${proposal.author}`,
      primary: { protocol: 'snapshot' as string, id: proposal.author },
      handles: { snapshot: proposal.author || null },
      displayName: `${spaceName} DAO`,
      bio: '',
      avatarUrl: space?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: proposal.discussion
      ? [
          {
            kind: 'link' as const,
            url: proposal.discussion,
            meta: { title: `Discussion: ${title}`, source: 'snapshot' },
          },
        ]
      : [],
    contentType: 'text',
    createdAt: proposal.created * 1000,
    metrics: {
      likes: proposal.votes || 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: proposal.votes ? proposal.votes * 20 : 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: proposal.votes || 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    },
    raw: proposal,
    niches: guessNiches(title, body, space?.name || space?.id || ''),
    community: space
      ? {
          name: space.id,
          title: spaceName,
          actorId: `https://snapshot.org/#/${space.id}`,
          niche: guessNiches(title, body, space.name).join(','),
        }
      : undefined,
  };
}

async function graphQLQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse<T>> {
  try {
    const res = await $fetch(SNAPSHOT_GRAPHQL, {
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
    console.log(`[bridge] Snapshot GraphQL error: ${(err as Error).message}`);
    return {};
  }
}

// ─── Data Sources ────────────────────────────────────────────────────────

async function fetchActiveProposals(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query ActiveProposals($limit: Int!) {
      proposals(
        first: $limit,
        where: { space_in: ["ens.eth", "aave.eth", "uniswap", "gitcoin.eth", "balancer.eth", "curve.eth", "comp.eth", "compound-2", "lido-snapshot.eth"] },
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        title
        body
        choices
        start
        end
        snapshot
        state
        author
        created
        type
        scores
        scores_total
        votes
        quorum
        space {
          id
          name
          avatar
        }
        network
        discussion
      }
    }
  `;

  const res = await graphQLQuery<ProposalsResult>(query, { limit: Math.min(limit, 50) });
  const proposals = res.data?.proposals || [];

  // Filter to active + high-score closed proposals
  return proposals
    .filter((p) => p.state === 'active' || p.scores_total > 100)
    .map(snapshotProposalToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

async function fetchTrendingProposals(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query TrendingProposals($limit: Int!) {
      proposals(
        first: $limit,
        orderBy: "scores_total",
        orderDirection: desc,
        where: { state: "active" }
      ) {
        id
        title
        body
        choices
        start
        end
        snapshot
        state
        author
        created
        type
        scores
        scores_total
        votes
        quorum
        space {
          id
          name
          avatar
        }
        network
        discussion
      }
    }
  `;

  const res = await graphQLQuery<ProposalsResult>(query, { limit: Math.min(limit, 30) });
  const proposals = res.data?.proposals || [];
  return proposals
    .filter((p) => p.state === 'active')
    .map(snapshotProposalToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

async function fetchRecentProposals(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query RecentProposals($limit: Int!) {
      proposals(
        first: $limit,
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        title
        body
        choices
        start
        end
        snapshot
        state
        author
        created
        type
        scores
        scores_total
        votes
        quorum
        space {
          id
          name
          avatar
        }
        network
        discussion
      }
    }
  `;

  const res = await graphQLQuery<ProposalsResult>(query, { limit: Math.min(limit, 30) });
  const proposals = res.data?.proposals || [];
  return proposals
    .filter((p) => p.state === 'active' || p.state === 'pending')
    .map(snapshotProposalToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

// ─── Schema Guardian ────────────────────────────────────────────────────

export const schema = {
  id: 'snapshot',
  name: 'Snapshot',
  description: 'DAO governance proposals — voting on DeFi, NFT & crypto protocol decisions',
  endpoint: '/api/feed/snapshot',
  requiresAuth: false,
  contentType: 'mixed',
};

// ─── Main Fetcher ───────────────────────────────────────────────────────

export async function fetchSnapshotPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 3));

  const [active, trending, recent] = await Promise.all([
    fetchActiveProposals(perSource),
    fetchTrendingProposals(perSource),
    fetchRecentProposals(perSource),
  ]);

  const all = [...active, ...trending, ...recent];
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];

  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Snapshot: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchSnapshotPosts;

/**
 * Tally bridge provider
 *
 * Integrates Tally — a DAO governance and treasury management platform.
 * Tally provides data on DAO proposals, delegate votes, treasury management,
 * and governance activity across major DAOs.
 *
 * API: Public GraphQL API at https://api.tally.xyz/query
 * Docs: https://docs.tally.xyz
 *
 * Features:
 * - Active DAO governance proposals
 * - Delegation and voting activity
 * - Treasury management proposals
 * - Multi-chain governance data
 *
 * Rate Limits: Public GraphQL endpoint
 * Auth: Optional API key for higher rate limits
 */

import type { UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const TALLY_API = process.env.TALLY_API_URL || 'https://api.tally.xyz/query';
const TALLY_API_KEY = process.env.TALLY_API_KEY || '';

// ─── Types ─────────────────────────────────────────────────────────────

interface TallyProposal {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'EXECUTED' | 'DEFEATED' | 'QUEUED' | 'CANCELLED' | 'PENDING';
  start: {
    timestamp: number;
  };
  end: {
    timestamp: number;
  };
  voteStats: Array<{
    type: 'FOR' | 'AGAINST' | 'ABSTAIN';
    count: number;
    percent: number;
    votes: number;
  }>;
  governance: {
    id: string;
    name: string;
    tokens: Array<{
      name: string;
      symbol: string;
      decimals: number;
    }>;
    quorum: string;
    proposerReward: string;
  };
  proposer: {
    address: string;
    ensName?: string;
  };
  metadata: {
    to?: string;
    value?: string;
    signature?: string;
    calldatas?: string[];
    targets?: string[];
  };
}

// TallyOrganization — reserved for future use
/* interface TallyOrganization {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    chainIds: number[];
  };
  proposalStats: {
    total: number;
    active: number;
    executed: number;
    defeated: number;
  };
} */

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface ProposalsResult {
  proposals: TallyProposal[];
}

// OrganizationResult — reserved for future use
/* interface OrganizationResult {
  organizations: TallyOrganization[];
} */

// ─── Helpers ────────────────────────────────────────────────────────────

function guessNiches(title: string, description: string, govName: string): string[] {
  const niches: string[] = [];
  const lower = `${title} ${description} ${govName}`.toLowerCase();

  if (/\b(defi|liquidity|yield|lending|swap|dex|amm)\b/.test(lower)) niches.push('defi');
  if (/\b(dao|governance|vote|proposal|treasury|delegate)\b/.test(lower)) niches.push('dao');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(grant|fund|allocate|reward|incentive|bounty)\b/.test(lower)) niches.push('funding');
  if (/\b(eth|ethereum|base|arbitrum)\b/.test(lower)) niches.push('ethereum');
  if (/\b(crypto|blockchain|web3|token)\b/.test(lower)) niches.push('crypto');
  if (/\b(security|audit|bug|vulnerability)\b/.test(lower)) niches.push('security');

  if (niches.length === 0) niches.push('dao');
  return niches;
}

function tallyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'DegenFeed-Bridge/0.1',
  };
  if (TALLY_API_KEY) {
    headers['Api-Key'] = TALLY_API_KEY;
  }
  return headers;
}

async function graphQLQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse<T>> {
  try {
    const res = await $fetch(TALLY_API, {
      method: 'POST',
      headers: tallyHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return {};
    return (await res.json()) as GraphQLResponse<T>;
  } catch {
    // console.log(`[bridge] Tally GraphQL error: ${(err as Error).message}`);
    return {};
  }
}

function tallyProposalToPost(proposal: TallyProposal): UnifiedPost | null {
  const title = proposal.title || '';
  const description = proposal.description || '';
  if (!title) return null;

  const govName = proposal.governance?.name || 'Unknown DAO';
  const statusLabel =
    proposal.status === 'ACTIVE'
      ? '🟢 Active'
      : proposal.status === 'EXECUTED'
        ? '✅ Executed'
        : proposal.status === 'DEFEATED'
          ? '❌ Defeated'
          : proposal.status === 'PENDING'
            ? '⏳ Pending'
            : '🔒 Closed';

  const voteStats = proposal.voteStats || [];
  const forVotes = voteStats.find((v) => v.type === 'FOR');
  const againstVotes = voteStats.find((v) => v.type === 'AGAINST');
  const abstainVotes = voteStats.find((v) => v.type === 'ABSTAIN');

  let voteLine = '';
  if (forVotes || againstVotes) {
    voteLine = `\nFor: ${forVotes?.count || 0} (${(forVotes?.percent || 0).toFixed(0)}%) · Against: ${againstVotes?.count || 0} (${(againstVotes?.percent || 0).toFixed(0)}%)`;
    if (abstainVotes && abstainVotes.count > 0) {
      voteLine += ` · Abstain: ${abstainVotes.count}`;
    }
  }

  const text = `🏛️ [${govName}] ${title}\n\n${statusLabel}${voteLine}\n\n${description.slice(0, 300)}`;

  return {
    id: `tally:${proposal.id}`,
    protocol: 'tally' as string,
    author: {
      id: `tally:gov:${proposal.governance?.id || govName}`,
      primary: { protocol: 'tally' as string, id: govName },
      handles: { tally: govName || null },
      displayName: govName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    contentType: 'text',
    createdAt: proposal.start?.timestamp
      ? parseInt(proposal.start.timestamp.toString(), 10) * 1000
      : Date.now(),
    metrics: {
      likes: forVotes?.votes || 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: forVotes?.votes ? forVotes.votes * 10 : 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: forVotes?.votes || 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    },
    raw: proposal,
    niches: guessNiches(title, description, govName),
    community: {
      name: proposal.governance?.id || govName.toLowerCase().replace(/\s+/g, '-'),
      title: govName,
      niche: guessNiches(title, description, govName).join(','),
    },
  };
}

// ─── Data Sources ───────────────────────────────────────────────────────

async function fetchActiveProposals(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query ActiveProposals($limit: Int!) {
      proposals(
        first: $limit,
        where: { status: ACTIVE }
        orderBy: { field: START, order: DESC }
      ) {
        id
        title
        description
        status
        start { timestamp }
        end { timestamp }
        voteStats {
          type
          count
          percent
          votes
        }
        governance {
          id
          name
          tokens { name symbol decimals }
        }
        proposer { address ensName }
      }
    }
  `;

  const res = await graphQLQuery<ProposalsResult>(query, { limit: Math.min(limit, 50) });
  const proposals = res.data?.proposals || [];
  return proposals.map(tallyProposalToPost).filter((p): p is UnifiedPost => p !== null);
}

async function fetchRecentProposals(limit: number): Promise<UnifiedPost[]> {
  const query = `
    query RecentProposals($limit: Int!) {
      proposals(
        first: $limit,
        orderBy: { field: START, order: DESC }
      ) {
        id
        title
        description
        status
        start { timestamp }
        end { timestamp }
        voteStats {
          type
          count
          percent
          votes
        }
        governance {
          id
          name
          tokens { name symbol decimals }
        }
        proposer { address ensName }
      }
    }
  `;

  const res = await graphQLQuery<ProposalsResult>(query, { limit: Math.min(limit, 30) });
  const proposals = res.data?.proposals || [];
  return proposals
    .filter((p) => p.status === 'ACTIVE' || p.status === 'EXECUTED')
    .map(tallyProposalToPost)
    .filter((p): p is UnifiedPost => p !== null);
}

// ─── Schema Guardian ────────────────────────────────────────────────────

export const schema = {
  id: 'tally',
  name: 'Tally',
  description: 'DAO governance & treasury management — proposals, votes & delegate activity',
  endpoint: '/api/feed/tally',
  requiresAuth: false,
  authEnvVar: 'TALLY_API_KEY',
  contentType: 'mixed',
};

// ─── Main Fetcher ───────────────────────────────────────────────────────

export async function fetchTallyPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 2));

  const [active, recent] = await Promise.all([
    fetchActiveProposals(perSource),
    fetchRecentProposals(perSource),
  ]);

  const all = [...active, ...recent];
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];

  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Tally: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchTallyPosts;

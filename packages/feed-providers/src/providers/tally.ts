/**
 * TallyProvider — DAO governance proposals from Tally.
 *
 * Tally is a DAO governance platform (api.tally.xyz). It exposes a public
 * GraphQL API at https://api.tally.xyz/query. Reads generally work without
 * an API key; for higher rate limits pass one via options (env: TALLY_API_KEY).
 *
 * This provider surfaces:
 *   - Recent governance proposals across major DAOs (Uniswap, Aave,
 *     Compound, ENS, Arbitrum, Optimism, etc.)
 *   - Voting stats (per-choice vote counts, voters)
 *
 * Protocol: 'tally' (already present in @degenfeed/types).
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { buildIdentity } from './shared';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';

export const TALLY_API_URL = 'https://api.tally.xyz/query';

export interface TallyOrg {
  id: string;
  slug?: string | null;
  name?: string | null;
}

export interface TallyProposal {
  id: string;
  onchainId?: number | string | null;
  status?: string | null;
  createdAt?: string | null;
  metadata?: {
    title?: string | null;
    description?: string | null;
  } | null;
  organization?: TallyOrg | null;
  voteStats?: Array<{
    type?: string | null;
    votesCount?: number | null;
    votersCount?: number | null;
    percent?: number | null;
  } | null> | null;
}

export interface TallyResponse {
  data?: {
    proposals?: {
      nodes?: Array<TallyProposal | null> | null;
      pageInfo?: { count?: number | null } | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string }>;
}

/** Runtime guard for a single Tally proposal (minimal shape). */
export function isTallyProposal(obj: unknown): obj is TallyProposal {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const p = obj as Record<string, unknown>;
  return typeof p.id === 'string';
}

async function tallyGql(
  url: string,
  query: string,
  variables: Record<string, unknown>,
  apiKey?: string,
): Promise<TallyResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers['Api-Key'] = apiKey;
  return fetchJson<TallyResponse>(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
}

const PROPOSALS_QUERY = `
query GovernanceProposals($input: ProposalsInput) {
  proposals(input: $input) {
    nodes {
      ... on Proposal {
        id
        onchainId
        status
        createdAt
        metadata {
          title
          description
        }
        organization {
          id
          slug
          name
        }
        voteStats {
          type
          votesCount
          votersCount
          percent
        }
      }
    }
    pageInfo {
      count
    }
  }
}`;

function orgIdentity(org: TallyOrg): UnifiedIdentity {
  const id = org.id || 'tally';
  return buildIdentity(
    id,
    'tally' as Protocol,
    id,
    org.slug ?? null,
    org.name || org.slug || 'Tally DAO',
    {
      bio: 'DAO governance via Tally',
      avatarUrl: '',
      keys: { tallyGovId: org.id },
    },
  );
}

function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'queued':
      return 'Queued';
    case 'succeeded':
      return 'Succeeded';
    case 'defeated':
      return 'Defeated';
    case 'executed':
      return 'Executed';
    case 'canceled':
    case 'cancelled':
      return 'Canceled';
    default:
      return status ?? 'Unknown';
  }
}

function proposalToUnifiedPost(p: TallyProposal): UnifiedPost {
  const org = p.organization ?? { id: 'tally' };
  const orgName = org.name || org.slug || 'Tally DAO';
  const title = p.metadata?.title ?? `Proposal ${p.onchainId ?? p.id}`;
  const description = (p.metadata?.description ?? '').replace(/<[^>]*>/g, ' ').trim();

  const activeVotes = (p.voteStats ?? []).filter((v) => v && v.type === 'for');
  const totalFor = activeVotes.reduce((sum, v) => sum + (v?.votesCount ?? 0), 0);
  const totalVoters = (p.voteStats ?? []).reduce((sum, v) => sum + (v?.votersCount ?? 0), 0);

  const lines = [
    `[${orgName}] ${title}`,
    '',
    `Status: ${statusLabel(p.status)}`,
  ];
  if (totalFor > 0 || totalVoters > 0) {
    lines.push(`Votes: ${totalVoters} · For: ${Math.round(totalFor)}`);
  }
  if (description) lines.push('', description.slice(0, 400));

  const text = lines.join('\n');
  const slug = org.slug || org.id;
  const link = p.onchainId
    ? `https://www.tally.xyz/gov/${slug}/proposal/${p.onchainId}`
    : `https://www.tally.xyz/gov/${slug}`;

  return buildUnifiedPost({
    protocol: 'tally',
    nativeId: p.id,
    author: orgIdentity(org),
    text,
    embeds: [{ kind: 'link', url: link, meta: { title } }],
    createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
    metrics: { likes: Math.round(totalFor), reposts: 0, replies: totalVoters, quotes: 0 },
    raw: p,
  });
}

export interface TallyProviderOptions {
  /** GraphQL endpoint (default https://api.tally.xyz/query). */
  url?: string;
  /** Optional Tally API key (sent as Api-Key header). */
  apiKey?: string;
  /** Filter proposals to a specific organization id (optional). */
  organizationId?: string;
  /** Number of proposals to fetch (default 25). */
  limit?: number;
}

export class TallyProvider implements FeedProvider {
  readonly protocol: Protocol = 'tally';
  readonly schema: SchemaGuard = (data): boolean =>
    Array.isArray(data) || typeof data === 'object';
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly organizationId?: string;
  private readonly limit: number;
  private readonly breaker = new CircuitBreaker('tally');

  constructor(options: TallyProviderOptions = {}) {
    this.url = options.url ?? TALLY_API_URL;
    this.apiKey = options.apiKey;
    this.organizationId = options.organizationId;
    this.limit = options.limit ?? 50;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.breaker.execute(async () => {
        const input: Record<string, unknown> = {
          page: { limit: this.limit },
          sort: { sortBy: 'id', isDescending: true },
        };
        if (this.organizationId) {
          input.filters = { organizationId: this.organizationId };
        }

        const data = await withTimeout(
          tallyGql(this.url, PROPOSALS_QUERY, { input }, this.apiKey),
          timeoutMs,
          'tally:proposals',
        );

        if (data.errors && data.errors.length > 0) {
          return { posts: [], notice: `Tally: ${data.errors[0]?.message ?? 'GraphQL error'}` };
        }

        const nodes = (data.data?.proposals?.nodes ?? []).filter(
          (n): n is TallyProposal => n !== null && isTallyProposal(n),
        );
        const posts = nodes.map(proposalToUnifiedPost);

        if (posts.length === 0) {
          return { posts: [], notice: 'Tally returned no proposals' };
        }
        return {
          posts,
          notice: `Tally: ${posts.length} governance proposals`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Tally: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `Tally feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        tallyGql(
          this.url,
          `query Health { proposals(input: { page: { limit: 1 } }) { nodes { ... on Proposal { id } } } }`,
          {},
          this.apiKey,
        ),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'tally:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}

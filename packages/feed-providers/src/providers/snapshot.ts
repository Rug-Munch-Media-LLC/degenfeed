/**
 * SnapshotProvider — DAO governance proposals from Snapshot.
 *
 * Snapshot is the leading DAO governance platform. It exposes a public
 * GraphQL API at https://hub.snapshot.org/graphql (no auth required for
 * reads). This provider surfaces:
 *   - Active proposals across major DAO spaces
 *   - Voting activity (score totals, vote counts)
 *   - Recently created spaces
 *
 * Protocol: 'snapshot' (already present in @degenfeed/types).
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { buildIdentity } from './shared';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';

export const SNAPSHOT_GRAPHQL_URL = 'https://hub.snapshot.org/graphql';

/** Major DAO spaces tracked by default (ENS, Aave, Uniswap, Arbitrum, Optimism). */
export const SNAPSHOT_SPACES = [
  'ens.eth',
  'aave.eth',
  'uniswap',
  'arbitrum',
  'optimism',
] as const;

export interface SnapshotSpace {
  id: string;
  name: string;
  about?: string | null;
  avatar?: string | null;
  followers?: number;
  proposalsCount?: number;
  created?: number;
}

export interface SnapshotProposal {
  id: string;
  title: string;
  body?: string | null;
  created?: number;
  start: number;
  end: number;
  state: string;
  scores_total?: number;
  votes?: number;
  link?: string;
  choices?: string[];
  scores?: number[];
  space: SnapshotSpace;
}

export interface SnapshotProposalsResponse {
  data?: {
    proposals?: SnapshotProposal[];
    spaces?: SnapshotSpace[];
  };
  errors?: Array<{ message?: string }>;
}

/** Runtime guard for a single Snapshot proposal (minimal shape). */
export function isSnapshotProposal(obj: unknown): obj is SnapshotProposal {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const p = obj as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.title === 'string' && typeof p.state === 'string';
}

async function snapshotGql(
  url: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<SnapshotProposalsResponse> {
  return fetchJson<SnapshotProposalsResponse>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
}

const PROPOSALS_QUERY = `
query Proposals($first: Int!, $skip: Int!, $spaceIn: [String!], $state: String) {
  proposals(
    first: $first,
    skip: $skip,
    where: { space_in: $spaceIn, state: $state },
    orderBy: "created",
    orderDirection: desc
  ) {
    id
    title
    body
    created
    start
    end
    state
    scores_total
    votes
    link
    choices
    scores
    space {
      id
      name
      avatar
      followers
      proposalsCount
    }
  }
  spaces(
    first: $first,
    orderBy: "created",
    orderDirection: desc
  ) {
    id
    name
    about
    avatar
    followers
    proposalsCount
    created
  }
}`;

function spaceIdentity(space: SnapshotSpace): UnifiedIdentity {
  const id = space.id || 'unknown';
  return buildIdentity(
    id,
    'snapshot' as Protocol,
    id,
    id,
    space.name || space.id,
    {
      bio: space.about ?? '',
      avatarUrl: space.avatar ?? '',
      followerCount: space.followers ?? 0,
      keys: { snapshotSpace: space.id },
    },
  );
}

function proposalToUnifiedPost(p: SnapshotProposal): UnifiedPost {
  const spaceName = p.space?.name || p.space?.id || 'Snapshot DAO';
  const state = p.state ?? 'active';
  const votes = p.votes ?? 0;
  const scoreTotal = p.scores_total ?? 0;
  const choices = p.choices ?? [];
  const leading = choices
    .map((c, i) => ({ choice: c, score: p.scores?.[i] ?? 0 }))
    .sort((a, b) => b.score - a.score)[0];

  const lines = [
    `[${spaceName}] ${p.title}`,
    '',
    `State: ${state} · Votes: ${votes} · Scores: ${Math.round(scoreTotal)}`,
  ];
  if (leading && leading.choice) {
    lines.push(`Leading: ${leading.choice} (${Math.round(leading.score)})`);
  }
  const body = (p.body ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (body) lines.push('', body.slice(0, 400));

  const text = lines.join('\n');
  const link = p.link || `https://snapshot.org/#/proposal/${p.id}`;

  const embeds =
    p.choices && p.choices.length > 0
      ? [
          { kind: 'link' as const, url: link, meta: { title: p.title, choices: p.choices } },
        ]
      : [{ kind: 'link' as const, url: link, meta: { title: p.title } }];

  const end = Number(p.end) * 1000;
  const createdRaw = Number(p.created ?? 0) * 1000;
  const created =
    Number.isFinite(createdRaw) && createdRaw > 0
      ? createdRaw
      : Number.isFinite(end) && end > 0
        ? end - 7 * 24 * 3600 * 1000
        : Date.now();

  return buildUnifiedPost({
    protocol: 'snapshot',
    nativeId: p.id,
    author: spaceIdentity(p.space),
    text,
    embeds,
    createdAt: created,
    metrics: { likes: Math.round(scoreTotal), reposts: 0, replies: votes, quotes: 0 },
    raw: p,
  });
}

function spaceToUnifiedPost(s: SnapshotSpace): UnifiedPost {
  const created = Number(s.created ?? 0) * 1000;
  const followers = s.followers ?? 0;
  const text = `New DAO space on Snapshot: ${s.name}\nFollowers: ${followers} · Proposals: ${s.proposalsCount ?? 0}`;
  const link = `https://snapshot.org/#/explore`;

  return buildUnifiedPost({
    protocol: 'snapshot',
    nativeId: `space:${s.id}`,
    author: spaceIdentity(s),
    text,
    embeds: [{ kind: 'link', url: link, meta: { title: s.name } }],
    createdAt: Number.isFinite(created) && created > 0 ? created : Date.now(),
    metrics: { likes: followers, reposts: 0, replies: 0, quotes: 0 },
    raw: s,
  });
}

export interface SnapshotProviderOptions {
  /** GraphQL endpoint (default https://hub.snapshot.org/graphql). */
  url?: string;
  /** DAO space ids to track (default SNAPSHOT_SPACES). */
  spaces?: string[];
}

export class SnapshotProvider implements FeedProvider {
  readonly protocol: Protocol = 'snapshot';
  readonly schema: SchemaGuard = (data): boolean =>
    Array.isArray(data) || typeof data === 'object';
  private readonly url: string;
  private readonly spaces: string[];
  private readonly breaker = new CircuitBreaker('snapshot');

  constructor(options: SnapshotProviderOptions = {}) {
    this.url = options.url ?? SNAPSHOT_GRAPHQL_URL;
    this.spaces = options.spaces ? [...options.spaces] : [...SNAPSHOT_SPACES];
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.breaker.execute(async () => {
        const data = await withTimeout(
          snapshotGql(
            this.url,
            PROPOSALS_QUERY,
            { first: 50, skip: 0, spaceIn: this.spaces, state: 'active' },
          ),
          timeoutMs,
          'snapshot:proposals',
        );

        if (data.errors && data.errors.length > 0) {
          return { posts: [], notice: `Snapshot: ${data.errors[0]?.message ?? 'GraphQL error'}` };
        }

        const proposals = (data.data?.proposals ?? []).filter(isSnapshotProposal);
        const spaces = data.data?.spaces ?? [];
        const posts: UnifiedPost[] = [
          ...proposals.map(proposalToUnifiedPost),
          ...spaces.slice(0, 8).map(spaceToUnifiedPost),
        ];

        if (posts.length === 0) {
          return { posts: [], notice: 'Snapshot returned no active proposals' };
        }
        return {
          posts,
          notice: `Snapshot: ${proposals.length} active proposals across ${this.spaces.length} DAOs`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Snapshot: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `Snapshot feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        snapshotGql(this.url, `query { proposals(first: 1) { id title } }`, {}),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'snapshot:health',
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

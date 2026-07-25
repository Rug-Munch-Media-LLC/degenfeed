/**
 * @degenfeed/api-worker — Snapshot.org Integration
 *
 * Integrates DegenFeed DAOs with Snapshot.org — the most widely used
 * off-chain voting platform in Web3.
 *
 * Capabilities:
 *   - Strategy JSON generation for token-weighted voting
 *   - Snapshot space configuration export
 *   - Bidirectional proposal sync (DegenFeed → Snapshot)
 *   - Vote import (Snapshot → DegenFeed analytics)
 *   - Delegation state sync via Snapshot Delegate Registry
 *
 * KV schema (NS: GOVERNANCE):
 *   snapshot:linked:{daoId}              → SnapshotSpaceLink (persistent)
 *   snapshot:sync:{daoId}:{proposalId}   → last sync timestamp
 *   snapshot:delegation:{daoId}:{voter}  → delegated amount
 *   snapshot:strategy:{daoId}            → cached strategy JSON
 *
 * @see https://docs.snapshot.org/
 */

import type { Env } from '../index';
import { badRequest, created, ok, serverError } from '../response-helpers';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SnapshotSpaceConfig {
  /** Snapshot space ENS or ID (e.g. "degendao.eth") */
  space: string;
  /** Display name */
  name: string;
  /** Network for voting power calculation */
  network: string;
  /** Snapshot Hub API URL (default: https://hub.snapshot.org) */
  hub?: string;
  /** Strategies array — auto-generated from DegenFeed token */
  strategies: SnapshotStrategy[];
  /** Voting delay in seconds */
  voting_delay?: number;
  /** Voting period in seconds */
  voting_period?: number;
  /** Proposal threshold (e.g. "1" = 1 token to create proposal) */
  proposal_threshold?: string;
  /** Quorum — minimum voting power for proposal to pass */
  quorum?: string;
  /** Members array (optional) */
  members?: string[];
  /** Admins array */
  admins?: string[];
  /** Filters */
  filters?: Record<string, unknown>;
  /** Plugins */
  plugins?: Record<string, unknown>;
  /** Privacy: "" (open) | "members-only" */
  privacy?: string;
}

export interface SnapshotStrategy {
  /** Strategy name (e.g. "erc20-balance-of", "delegation") */
  name: string;
  /** Strategy network */
  network: string;
  /** Strategy parameters */
  params: Record<string, unknown>;
}

export interface SnapshotSpaceLink {
  daoId: string;
  snapshotSpace: string;
  network: string;
  tokenAddress: string;
  tokenDecimals: number;
  strategyHash: string;
  linkedAt: number;
  verified: boolean;
  proposalsSynced: number;
  votesImported: number;
  /** Snapshot Hub API URL override */
  hub?: string;
}

export interface SnapshotProposalPayload {
  space: string;
  type: 'single-choice' | 'approval' | 'quadratic' | 'ranked-choice' | 'weighted';
  title: string;
  body: string;
  choices: string[];
  start: number; // unix seconds
  end: number; // unix seconds
  snapshot: number; // block number
  network: string;
  strategies: SnapshotStrategy[];
  plugins: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface SnapshotVote {
  id: string;
  voter: string;
  choice: number | number[] | Record<string, number>;
  vp: number;
  vp_by_strategy: number[];
  created: number;
  proposal: {
    id: string;
  };
}

// ─── KV helpers ──────────────────────────────────────────────────────────

function linkedSpaceKey(daoId: string): string {
  return `snapshot:linked:${daoId}`;
}

function syncMarkerKey(daoId: string, proposalId: string): string {
  return `snapshot:sync:${daoId}:${proposalId}`;
}

function delegationKey(daoId: string, voter: string): string {
  return `snapshot:delegation:${daoId}:${voter.toLowerCase()}`;
}

function strategyCacheKey(daoId: string): string {
  return `snapshot:strategy:${daoId}`;
}

const SNAPSHOT_HUB_URL = 'https://hub.snapshot.org';
const SNAPSHOT_SEQUENCER_URL = 'https://seq.snapshot.org';
const SNAPSHOT_DELEGATE_REGISTRY = '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446';

// ─── Strategy Generator ──────────────────────────────────────────────────

/**
 * Generate a Snapshot strategy JSON from DegenFeed token configuration.
 * This produces a valid strategies array that Snapshot can use to
 * calculate voting power from DegenFeed tokens.
 */
export function generateSnapshotStrategy(params: {
  tokenAddress: string;
  chainId: number;
  tokenDecimals: number;
  tokenSymbol: string;
  useDelegation: boolean;
  contractNetwork?: string;
}): SnapshotStrategy[] {
  const network = params.contractNetwork ?? getNetworkName(params.chainId);

  const strategies: SnapshotStrategy[] = [
    {
      name: 'erc20-balance-of',
      network,
      params: {
        address: params.tokenAddress,
        symbol: params.tokenSymbol,
        decimals: params.tokenDecimals,
      },
    },
  ];

  // Add delegation strategy if enabled
  if (params.useDelegation) {
    strategies.push({
      name: 'delegation',
      network,
      params: {
        strategies: [
          {
            name: 'erc20-balance-of',
            network,
            params: {
              address: params.tokenAddress,
              symbol: params.tokenSymbol,
              decimals: params.tokenDecimals,
            },
          },
        ],
      },
    });
  }

  return strategies;
}

/**
 * Generate a full Snapshot space configuration JSON.
 * This can be used for manual space creation or automation.
 */
export function generateSpaceConfig(params: {
  spaceName: string;
  spaceId: string;
  tokenAddress: string;
  chainId: number;
  tokenDecimals: number;
  tokenSymbol: string;
  admins: string[];
  members?: string[];
  quorum?: string;
  proposalThreshold?: string;
  votingPeriodSec?: number;
  votingDelaySec?: number;
  useDelegation?: boolean;
  privacy?: string;
}): SnapshotSpaceConfig {
  const network = getNetworkName(params.chainId);

  return {
    space: params.spaceId,
    name: params.spaceName,
    network,
    strategies: generateSnapshotStrategy({
      tokenAddress: params.tokenAddress,
      chainId: params.chainId,
      tokenDecimals: params.tokenDecimals,
      tokenSymbol: params.tokenSymbol,
      useDelegation: params.useDelegation ?? true,
    }),
    voting_delay: params.votingDelaySec ?? 0,
    voting_period: params.votingPeriodSec ?? 259200, // 3 days
    proposal_threshold: params.proposalThreshold ?? '1',
    quorum: params.quorum ?? '1',
    members: params.members,
    admins: params.admins,
    privacy: params.privacy ?? '',
    filters: {
      onlyMembers: false,
    },
    plugins: {},
  };
}

// ─── API: Relayer (GraphQL to Snapshot Hub) ──────────────────────────────

/**
 * Query the Snapshot Hub GraphQL API.
 */
async function snapshotQuery(
  query: string,
  variables?: Record<string, unknown>,
  hubUrl?: string,
): Promise<unknown> {
  const url = `${hubUrl ?? SNAPSHOT_HUB_URL}/graphql`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Snapshot GraphQL error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Snapshot query error: ${result.errors[0]?.message ?? 'unknown'}`);
  }

  return result.data;
}

/**
 * Submit a proposal or vote to the Snapshot sequencer for on-chain submission.
 */
async function snapshotSequencerSend(
  payload: Record<string, unknown>,
  seqUrl?: string,
): Promise<{ id: string }> {
  const url = `${seqUrl ?? SNAPSHOT_SEQUENCER_URL}/api/message`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Snapshot sequencer error: ${response.status} ${errText}`);
  }

  return (await response.json()) as { id: string };
}

// ─── Handler: POST /api/dao/:daoId/snapshot/strategy — Generate strategy ─

export async function handleSnapshotStrategyGenerate(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const chainId = typeof body.chainId === 'number' ? body.chainId : 8453; // default: Base
  const tokenDecimals = typeof body.tokenDecimals === 'number' ? body.tokenDecimals : 18;
  const tokenSymbol = typeof body.tokenSymbol === 'string' ? body.tokenSymbol : 'DEGEN';
  const useDelegation = body.useDelegation !== false;

  if (!tokenAddress) {
    return badRequest('tokenAddress is required');
  }

  const strategies = generateSnapshotStrategy({
    tokenAddress,
    chainId,
    tokenDecimals,
    tokenSymbol,
    useDelegation,
  });

  // Cache the strategy
  await kv.put(strategyCacheKey(daoId), JSON.stringify(strategies), {
    expirationTtl: 86_400, // 24h
  });

  const spaceConfig = generateSpaceConfig({
    spaceName: (body.spaceName as string) ?? `DAO ${daoId}`,
    spaceId: (body.spaceId as string) ?? `${daoId}.eth`,
    tokenAddress,
    chainId,
    tokenDecimals,
    tokenSymbol,
    admins: Array.isArray(body.admins) ? (body.admins as string[]) : [],
    members: Array.isArray(body.members) ? (body.members as string[]) : undefined,
    quorum: body.quorum as string,
    proposalThreshold: body.proposalThreshold as string,
    votingPeriodSec: body.votingPeriodSec as number,
    votingDelaySec: body.votingDelaySec as number,
    useDelegation,
    privacy: body.privacy as string,
  });

  return ok({
    strategies,
    spaceConfig,
    instructions: [
      '1. Go to https://snapshot.org/#/setup',
      `2. Create a new space with ENS ${body.spaceId ?? `${daoId}.eth`}`,
      '3. Use the strategies JSON above in the "Voting" section',
      '4. Copy the space settings from spaceConfig above',
      '5. Verify ownership: add your DAO deployer wallet as an admin',
    ],
  });
}

// ─── Handler: POST /api/dao/:daoId/snapshot/sync-proposal — Sync to Snapshot ─

export async function handleSnapshotSyncProposal(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  // Check linked space
  const linkRaw = await kv.get(linkedSpaceKey(daoId)).catch(() => null);
  if (!linkRaw) {
    return badRequest('No Snapshot space linked. POST /api/dao/:daoId/snapshot/strategy first.');
  }
  const link = JSON.parse(linkRaw) as SnapshotSpaceLink;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const choices = Array.isArray(body.choices)
    ? (body.choices as string[])
    : ['For', 'Against', 'Abstain'];
  const start = typeof body.start === 'number' ? body.start : Math.floor(Date.now() / 1000) + 3600;
  const end = typeof body.end === 'number' ? body.end : start + 259200; // +3 days
  const snapshotBlock = typeof body.snapshot === 'number' ? body.snapshot : 0;
  const localProposalId = typeof body.localProposalId === 'string' ? body.localProposalId : '';
  const type = (
    typeof body.type === 'string' ? body.type : 'single-choice'
  ) as SnapshotProposalPayload['type'];

  if (!title || !description) {
    return badRequest('title and description are required');
  }

  // Build snapshot proposal payload
  const proposalPayload: SnapshotProposalPayload = {
    space: link.snapshotSpace,
    type,
    title,
    body: description,
    choices,
    start,
    end,
    snapshot: snapshotBlock,
    network: link.network,
    strategies: [], // strategies are stored on Snapshot space
    plugins: {},
    metadata: {
      strategies: JSON.stringify([]),
    },
  };

  try {
    // Send to Snapshot sequencer
    const sequencerResult = await snapshotSequencerSend({
      address: (body.signer as string) ?? '',
      msg: JSON.stringify(proposalPayload),
      sig: (body.signature as string) ?? '',
      version: '2',
    });

    // Record sync marker
    if (localProposalId) {
      await kv.put(
        syncMarkerKey(daoId, localProposalId),
        JSON.stringify({
          snapshotProposalId: sequencerResult.id,
          syncedAt: Date.now(),
          status: 'synced',
        }),
      );

      // Update link metadata
      link.proposalsSynced = (link.proposalsSynced ?? 0) + 1;
      await kv.put(linkedSpaceKey(daoId), JSON.stringify(link));
    }

    return created({
      snapshotProposalId: sequencerResult.id,
      status: 'synced',
      viewUrl: `https://snapshot.org/#/${link.snapshotSpace}/proposal/${sequencerResult.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sequencer error';
    return serverError(`Failed to sync to Snapshot: ${message}`);
  }
}

// ─── Handler: GET /api/dao/:daoId/snapshot/votes/:proposalId — Import votes ─

export async function handleSnapshotImportVotes(
  _request: Request,
  env: Env,
  daoId: string,
  proposalId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  const linkRaw = await kv.get(linkedSpaceKey(daoId)).catch(() => null);
  if (!linkRaw) {
    return badRequest('No Snapshot space linked for this DAO');
  }
  const link = JSON.parse(linkRaw) as SnapshotSpaceLink;

  const VOTES_QUERY = `
    query Votes($proposal: String!) {
      votes(
        first: 1000,
        where: { proposal: $proposal },
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        voter
        choice
        vp
        vp_by_strategy
        created
      }
    }
  `;

  try {
    const data = (await snapshotQuery(VOTES_QUERY, { proposal: proposalId }, link.hub)) as {
      votes: SnapshotVote[];
    };
    const votes = data?.votes ?? [];

    // Store imported votes for analytics
    const voteImportKey = `snapshot:imported:${daoId}:${proposalId}`;
    await kv.put(
      voteImportKey,
      JSON.stringify({
        importedAt: Date.now(),
        source: 'snapshot',
        proposalId,
        voteCount: votes.length,
        votes,
      }),
      { expirationTtl: 2_592_000 },
    ); // 30 days

    // Update link metadata
    link.votesImported = (link.votesImported ?? 0) + votes.length;
    await kv.put(linkedSpaceKey(daoId), JSON.stringify(link));

    return ok({
      proposalId,
      voteCount: votes.length,
      votes: votes.map((v) => ({
        voter: v.voter,
        choice: v.choice,
        vp: v.vp,
        timestamp: v.created,
      })),
      analytics: computeVoteAnalytics(votes),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return serverError(`Failed to import Snapshot votes: ${message}`);
  }
}

// ─── Delegate Registry Integration ────────────────────────────────────────

/**
 * Sync delegation state between DegenFeed and Snapshot Delegate Registry.
 * Uses the canonical Snapshot Delegate Registry contract.
 */
export async function handleDelegationSync(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return serverError('Governance KV not configured');

  let body: { delegations?: Array<{ delegator: string; delegate: string; amount: string }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const delegations = body.delegations ?? [];
  if (delegations.length === 0) {
    return badRequest('delegations array is required');
  }

  // Validate and store each delegation
  const results: Array<{ delegator: string; status: string }> = [];
  for (const d of delegations) {
    if (!d.delegator || !d.delegate) {
      results.push({ delegator: d.delegator, status: 'invalid: missing delegator or delegate' });
      continue;
    }

    const delegatorKey = delegationKey(daoId, d.delegator);
    await kv.put(
      delegatorKey,
      JSON.stringify({
        delegate: d.delegate.toLowerCase(),
        amount: d.amount ?? '0',
        updatedAt: Date.now(),
      }),
    );

    results.push({ delegator: d.delegator, status: 'synced' });
  }

  return ok({
    syncResults: results,
    delegateRegistryAddress: SNAPSHOT_DELEGATE_REGISTRY,
    note: 'On-chain delegations must be set via the Delegate Registry contract at the address above.',
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function getNetworkName(chainId: number): string {
  const networkMap: Record<number, string> = {
    1: 'mainnet',
    5: 'goerli',
    10: 'optimism-mainnet',
    137: 'polygon-mainnet',
    8453: 'base-mainnet',
    42161: 'arbitrum-mainnet',
    43114: 'avalanche-mainnet',
    56: 'bsc-mainnet',
    250: 'fantom-mainnet',
    100: 'gnosis-mainnet',
  };
  return networkMap[chainId] ?? `chain-${chainId}`;
}

function computeVoteAnalytics(votes: SnapshotVote[]): {
  totalVp: number;
  averageVp: number;
  uniqueVoters: number;
  choiceDistribution: Record<string, number>;
} {
  let totalVp = 0;
  const choiceDistribution: Record<string, number> = {};

  for (const v of votes) {
    totalVp += v.vp ?? 0;
    const choiceKey = String(v.choice);
    choiceDistribution[choiceKey] = (choiceDistribution[choiceKey] ?? 0) + 1;
  }

  return {
    totalVp,
    averageVp: votes.length > 0 ? totalVp / votes.length : 0,
    uniqueVoters: new Set(votes.map((v) => v.voter)).size,
    choiceDistribution,
  };
}

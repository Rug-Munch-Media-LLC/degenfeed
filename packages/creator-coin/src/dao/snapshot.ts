/**
 * DegenFeed DAO Framework — Snapshot Integration
 *
 * Integrates with Snapshot's off-chain voting infrastructure.
 * Uses @snapshot-labs/sx for space management, proposals, and votes.
 *
 * Snapshot is the primary governance layer — gasless, widely adopted,
 * with 13,000+ DAOs and 20M+ votes recorded.
 *
 * @see https://docs.snapshot.box/
 */

import type {
  DAOCreationInput,
  DAOTemplateType,
  Proposal,
  ProposalStatus,
  Vote,
  VotingConfig,
  VotingType,
} from './types';

// ─── Snapshot Hub URLs ──────────────────────────────────────────────────────

const SNAPSHOT_HUB = 'https://hub.snapshot.org';
const SNAPSHOT_SEQUENCER = 'https://seq.snapshot.org';
const SNAPSHOT_GRAPHQL = 'https://hub.snapshot.org/graphql';
const SNAPSHOT_API_KEY = process.env.SNAPSHOT_API_KEY || '';

// ─── Space Naming ────────────────────────────────────────────────────────────

/**
 * Generate a Snapshot space ENS for a creator DAO.
 * Format: degenfeed-{template}-{creatorShort}.eth
 */
export function generateSpaceEns(
  _coinAddress: string,
  template: DAOTemplateType,
  creator: string,
): string {
  const short = creator.slice(2, 10).toLowerCase();
  return `degenfeed-${template}-${short}.eth`;
}

/**
 * Generate a human-readable space name.
 */
export function generateSpaceName(coinSymbol: string, template: DAOTemplateType): string {
  const templateNames: Record<string, string> = {
    investment: 'Investment DAO',
    creator: 'Creator DAO',
    protocol: 'Protocol DAO',
    social: 'Social DAO',
  };
  return `${coinSymbol} ${templateNames[template] || 'DAO'}`;
}

// ─── Snapshot Space Configuration ────────────────────────────────────────────

/**
 * Build the Snapshot space settings JSON for a DAO template.
 */
export function buildSpaceSettings(input: DAOCreationInput, votingConfig: VotingConfig): string {
  const network = input.token.chain === 'base' ? '8453' : '900725'; // Base mainnet or Solana (900725 placeholder)

  return JSON.stringify({
    name: input.name,
    network,
    symbol: input.token.symbol,
    strategies: [
      {
        name: 'erc20-balance-of',
        network,
        params: {
          address: input.token.address,
          symbol: input.token.symbol,
          decimals: 18,
        },
      },
    ],
    validation: {
      name: 'basic',
      params: {},
    },
    filters: {
      onlyMembers: false,
    },
    voteValidation: {
      name: 'any',
      params: {},
    },
    voting: {
      delay: votingConfig.votingDelay,
      period: votingConfig.votingPeriod,
      type: votingConfig.votingType,
      quorum: votingConfig.quorumPercent,
      privacy: 'none',
      hideAbstain: false,
    },
    members: [],
    admins: [input.creator],
    moderators: [],
    plugins: {
      ...(votingConfig.allowQuadratic ? { quadratic: {} } : {}),
    },
    treasuries: [
      {
        name: 'DAO Treasury',
        address: input.coinAddress,
        network,
      },
    ],
    categories: [input.template],
    guidelines: input.metadata?.guidelines || '',
    template: '',
    parent: '',
    children: [],
    private: false,
    domain: '',
    skin: '',
    about: input.metadata?.description || '',
    avatar: input.metadata?.avatar || '',
    website: input.metadata?.website || '',
    twitter: input.metadata?.twitter || '',
    github: input.metadata?.github || '',
    discord: input.metadata?.discord || '',
  });
}

// ─── GraphQL Queries ─────────────────────────────────────────────────────────

const PROPOSALS_QUERY = `
query Proposals($space: String!, $first: Int, $skip: Int, $state: String) {
  proposals(
    first: $first,
    skip: $skip,
    where: { space: $space, state: $state },
    orderBy: "created",
    orderDirection: desc
  ) {
    id
    title
    body
    discussion
    choices
    type
    state
    author
    created
    start
    end
    snapshot
    scores
    scores_total
    quorum
    labels
    votes
  }
}`;

const PROPOSAL_QUERY = `
query Proposal($id: String!) {
  proposal(id: $id) {
    id
    title
    body
    discussion
    choices
    type
    state
    author
    created
    start
    end
    snapshot
    scores
    scores_total
    quorum
    labels
    votes
  }
}`;

const VOTES_QUERY = `
query Votes($proposal: String!, $first: Int, $skip: Int) {
  votes(
    first: $first,
    skip: $skip,
    where: { proposal: $proposal },
    orderBy: "created",
    orderDirection: desc
  ) {
    voter
    choice
    vp
    reason
    created
  }
}`;

const SPACE_QUERY = `
query Space($id: String!) {
  space(id: $id) {
    id
    name
    network
    symbol
    admins
    moderators
    members
    voting {
      delay
      period
      type
      quorum
      privacy
    }
    strategies {
      name
      network
      params
    }
    treasuries {
      name
      address
      network
    }
    created
  }
}`;

const USER_VOTING_POWER_QUERY = `
query Vp($space: String!, $voter: String!) {
  vp(space: $space, voter: $voter) {
    vp
    vp_by_strategy
    vp_state
  }
}`;

// ─── Snapshot Client ─────────────────────────────────────────────────────────

export class SnapshotClient {
  private hubUrl: string;
  private sequencerUrl: string;
  private apiKey: string;

  constructor(config?: { hubUrl?: string; sequencerUrl?: string; apiKey?: string }) {
    this.hubUrl = config?.hubUrl || SNAPSHOT_HUB;
    this.sequencerUrl = config?.sequencerUrl || SNAPSHOT_SEQUENCER;
    this.apiKey = config?.apiKey || SNAPSHOT_API_KEY;
  }

  // ─── GraphQL Client ──────────────────────────────────────────────────────

  private async graphql<T>(query: string, variables: Record<string, any>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const response = await fetch(`${this.hubUrl}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Snapshot GraphQL error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(`Snapshot API error: ${json.errors.map((e: any) => e.message).join(', ')}`);
    }

    return json.data as T;
  }

  // ─── Space Queries ────────────────────────────────────────────────────────

  async getSpace(spaceId: string): Promise<any> {
    const data = await this.graphql<{ space: any }>(SPACE_QUERY, { id: spaceId });
    return data.space;
  }

  // ─── Proposal Queries ─────────────────────────────────────────────────────

  async getProposals(
    space: string,
    options?: { first?: number; skip?: number; state?: string },
  ): Promise<Proposal[]> {
    const data = await this.graphql<{ proposals: any[] }>(PROPOSALS_QUERY, {
      space,
      first: options?.first || 20,
      skip: options?.skip || 0,
      state: options?.state,
    });

    return data.proposals.map(this.mapProposal);
  }

  async getProposal(id: string): Promise<Proposal | null> {
    const data = await this.graphql<{ proposal: any }>(PROPOSAL_QUERY, { id });
    if (!data.proposal) return null;
    return this.mapProposal(data.proposal);
  }

  async getVotes(proposalId: string, options?: { first?: number; skip?: number }): Promise<Vote[]> {
    const data = await this.graphql<{ votes: any[] }>(VOTES_QUERY, {
      proposal: proposalId,
      first: options?.first || 100,
      skip: options?.skip || 0,
    });

    return data.votes.map((v) => ({
      voter: v.voter,
      choice: typeof v.choice === 'object' ? v.choice[0] || 1 : v.choice,
      power: v.vp || 0,
      reason: v.reason || undefined,
      timestamp: v.created * 1000,
    }));
  }

  async getUserVotingPower(
    space: string,
    voter: string,
  ): Promise<{ vp: number; vp_by_strategy: number[]; vp_state: string }> {
    const data = await this.graphql<{
      vp: { vp: number; vp_by_strategy: number[]; vp_state: string };
    }>(USER_VOTING_POWER_QUERY, { space, voter });
    return data.vp;
  }

  // ─── Proposal Mapper ──────────────────────────────────────────────────────

  private mapProposal(p: any): Proposal {
    const statusMap: Record<string, ProposalStatus> = {
      pending: 'pending',
      active: 'active',
      closed: 'closed',
      approved: 'approved',
      rejected: 'rejected',
      executed: 'executed',
      cancelled: 'cancelled',
    };

    // Build scores map from array
    const scores: Record<number, number> = {};
    if (p.scores && Array.isArray(p.scores)) {
      p.scores.forEach((score: number, i: number) => {
        scores[i + 1] = score;
      });
    }

    return {
      id: p.id,
      spaceId: p.space || '',
      title: p.title,
      body: p.body || '',
      discussion: p.discussion || undefined,
      choices: p.choices || [],
      type: (p.type as VotingType) || 'single-choice',
      status: statusMap[p.state] || 'pending',
      author: p.author,
      start: p.start * 1000,
      end: p.end * 1000,
      snapshotBlock: p.snapshot,
      scores,
      scores_total: p.scores_total || 0,
      quorumReached: (p.scores_total || 0) >= (p.quorum || 0),
      created: p.created * 1000,
      labels: p.labels?.filter((l: string) => l) || undefined,
    };
  }

  // ─── Space Creation (via Sequencer) ───────────────────────────────────────

  /**
   * Build the envelope for creating/updating a Snapshot space.
   * The actual signing is done client-side via wallet.
   *
   * Returns the data payload that should be EIP-712 signed and sent to the sequencer.
   */
  buildSpacePayload(
    spaceId: string,
    settingsJson: string,
    _creator: string,
  ): { space: string; settings: string; timestamp: number } {
    return {
      space: spaceId,
      settings: settingsJson,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Build the proposal payload for Snapshot.
   */
  buildProposalPayload(
    space: string,
    title: string,
    body: string,
    choices: string[],
    start: number,
    end: number,
    type: VotingType,
    snapshotBlock: number,
    options?: {
      discussion?: string;
      plugins?: string;
      labels?: string[];
    },
  ): Record<string, any> {
    return {
      space,
      type,
      title,
      body,
      discussion: options?.discussion || '',
      choices,
      start,
      end,
      snapshot: snapshotBlock,
      plugins: options?.plugins || JSON.stringify({}),
      labels: options?.labels || [],
      app: 'degenfeed-dao',
    };
  }

  /**
   * Build the vote payload for Snapshot.
   */
  buildVotePayload(
    space: string,
    proposal: string,
    type: VotingType,
    choice: number | number[] | Record<number, number>,
    options?: { reason?: string; privacy?: string },
  ): Record<string, any> {
    return {
      space,
      proposal,
      type,
      choice,
      reason: options?.reason || '',
      app: 'degenfeed-dao',
      privacy: options?.privacy || 'none',
    };
  }

  /**
   * Submit a signed message to the Snapshot sequencer.
   * This is the low-level send — the signing should happen via
   * @snapshot-labs/sx SDK or ethers/wallet.
   */
  async send(envelope: any): Promise<{ id: string }> {
    const response = await fetch(this.sequencerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Snapshot sequencer error: ${response.status} ${text}`);
    }

    return response.json();
  }
}

// ─── Convenience Exports ──────────────────────────────────────────────────────

/**
 * Default Snapshot hub endpoints.
 */
export const SNAPSHOT_ENDPOINTS = {
  hub: SNAPSHOT_HUB,
  sequencer: SNAPSHOT_SEQUENCER,
  graphql: SNAPSHOT_GRAPHQL,
} as const;

/**
 * Chain IDs for Snapshot.
 */
export const SNAPSHOT_CHAIN_IDS: Record<string, string> = {
  base: '8453',
  ethereum: '1',
  polygon: '137',
  arbitrum: '42161',
  optimism: '10',
  solana: '900725', // Placeholder for Solana
} as const;

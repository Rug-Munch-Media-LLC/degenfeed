/**
 * @degenfeed/api-worker — DAO Types
 *
 * Shared types extracted from the monolithic dao.ts.
 */

// ─── Enums / Union Types ─────────────────────────────────────────────

export type DaoVisibility = 'public' | 'private' | 'unlisted';
export type ProposalStatus = 'active' | 'passed' | 'failed' | 'cancelled' | 'queued' | 'executed';
export type VoteChoice = 'for' | 'against' | 'abstain';
export type ActivityType =
  | 'proposal_created'
  | 'proposal_passed'
  | 'proposal_failed'
  | 'proposal_executed'
  | 'vote_cast'
  | 'member_joined'
  | 'member_left'
  | 'treasury_transfer'
  | 'treasury_stream_started'
  | 'delegation_changed'
  | 'grant_created'
  | 'grant_milestone_completed';

// ─── DAO Entity ──────────────────────────────────────────────────────

export interface Dao {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  banner?: string;
  creator: string;
  createdAt: number;
  chain: 'ethereum' | 'solana' | 'base' | 'polygon';
  contractAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  visibility: DaoVisibility;
  memberCount: number;
  proposalCount: number;
  treasuryValue?: string;
  tags?: string[];
  website?: string;
  discord?: string;
  twitter?: string;
  governance: {
    votingPeriod: number; // ms
    quorumPercent: number; // 0-100
    minDelay: number; // ms (timelock)
    executeWindow: number; // ms after timelock
    proposalThreshold: number; // tokens needed to propose
    votingDelay: number; // ms before voting starts
  };
}

// ─── Proposals ───────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  daoId: string;
  title: string;
  description: string;
  creator: string;
  createdAt: number;
  startAt: number;
  endAt: number;
  status: ProposalStatus;
  type: 'text' | 'transfer' | 'config_change' | 'membership' | 'grant' | 'stream' | 'custom';
  targets?: string[];
  values?: string[];
  calldatas?: string[];
  descriptionHash?: string;
  voteSummary?: {
    for: number;
    against: number;
    abstain: number;
    totalPower: number;
  };
  executedAt?: number;
  executionTxHash?: string;
  queuedAt?: number;
}

export interface VoteRecord {
  votes: Array<{
    voter: string;
    choice: VoteChoice;
    power: number;
    timestamp: number;
  }>;
  totals: {
    for: number;
    against: number;
    abstain: number;
  };
  totalPowerParticipated: number;
}

// ─── Delegation ──────────────────────────────────────────────────────

export interface Delegation {
  delegator: string;
  delegate: string;
  amount: number;
  timestamp: number;
}

// ─── Treasury ────────────────────────────────────────────────────────

export interface TreasuryOverview {
  totalBalance: string;
  tokenCount: number;
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    balance: string;
    valueUsd: number;
  }>;
  nativeBalance: string;
  nativeValueUsd: number;
  updatedAt: number;
}

export interface TreasuryTransaction {
  id: string;
  daoId: string;
  type: 'transfer' | 'stream' | 'grant' | 'deposit' | 'swap';
  from: string;
  to: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  amount: string;
  valueUsd: number;
  txHash?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  proposalId?: string;
}

export interface TreasuryStream {
  id: string;
  daoId: string;
  recipient: string;
  tokenAddress: string;
  tokenSymbol: string;
  totalAmount: string;
  releasedAmount: string;
  startTime: number;
  endTime: number;
  interval: number; // ms between releases
  amountPerInterval: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: number;
  cancelledAt?: number;
  proposalId?: string;
}

export interface GrantProgram {
  id: string;
  daoId: string;
  title: string;
  description: string;
  totalBudget: string;
  remainingBudget: string;
  tokenAddress: string;
  tokenSymbol: string;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    amount: string;
    status: 'pending' | 'completed';
    completedAt?: number;
  }>;
  recipient: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: number;
  proposalId?: string;
}

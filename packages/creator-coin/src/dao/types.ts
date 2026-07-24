/**
 * DegenFeed DAO Framework — Shared Types
 *
 * Types for the unified DAO system that enables creator coins
 * to auto-create DAOs on bonding curve graduation.
 *
 * Uses Snapshot (off-chain voting) as the primary governance layer
 * with OpenZeppelin Governor + TimelockController for on-chain execution.
 */

import type { Address } from 'viem';

// ─── DAO Templates ──────────────────────────────────────────────────────────

/** Available DAO templates a creator can choose when creating their coin */
export type DAOTemplateType =
  | 'investment' // Pool funds, vote on investments
  | 'creator' // Manage content, revenue, partnerships
  | 'protocol' // Manage protocol parameters
  | 'social'; // Manage community decisions

export interface DAOTemplate {
  type: DAOTemplateType;
  name: string;
  description: string;
  icon: string;
  /** Default voting configuration for this template */
  defaultVotingConfig: VotingConfig;
  /** Default permissions / roles */
  defaultPermissions: DAOPermissions;
  /** Suggested treasury allocation (percentage of token supply) */
  treasuryAllocationBps: number;
  /** Minimum proposal threshold (in tokens) */
  minProposalThreshold: string;
  /** Features enabled for this template */
  features: DAOFeature[];
}

export const DAO_TEMPLATES: Record<DAOTemplateType, DAOTemplate> = {
  investment: {
    type: 'investment',
    name: 'Investment DAO',
    description:
      'Pool treasury funds and vote on investment strategies, asset allocations, and yield opportunities.',
    icon: '📈',
    defaultVotingConfig: {
      votingType: 'single-choice',
      votingPeriod: 604800, // 7 days
      votingDelay: 86400, // 1 day
      quorumPercent: 10, // 10% quorum
      proposalThreshold: 0.01, // 1% of supply to propose
      approvalThreshold: 51, // Simple majority
      allowDelegation: true,
      allowQuadratic: true,
    },
    defaultPermissions: {
      canPropose: 'token_holders',
      canVote: 'token_holders',
      canExecute: 'timelock',
      emergencyMultisigThreshold: 3,
      emergencyMultisigMembers: 5,
    },
    treasuryAllocationBps: 1000, // 10% to treasury
    minProposalThreshold: '100000000000000000000000', // 100k tokens
    features: ['treasury', 'voting', 'delegation', 'multisig_emergency'],
  },
  creator: {
    type: 'creator',
    name: 'Creator DAO',
    description:
      "Manage the creator's content strategy, revenue sharing, partnerships, and brand decisions.",
    icon: '🎨',
    defaultVotingConfig: {
      votingType: 'single-choice',
      votingPeriod: 432000, // 5 days
      votingDelay: 43200, // 12 hours
      quorumPercent: 15, // 15% quorum
      proposalThreshold: 0.05, // 0.5% of supply to propose
      approvalThreshold: 51,
      allowDelegation: true,
      allowQuadratic: false,
    },
    defaultPermissions: {
      canPropose: 'token_holders',
      canVote: 'token_holders',
      canExecute: 'creator_multisig',
      emergencyMultisigThreshold: 2,
      emergencyMultisigMembers: 3,
    },
    treasuryAllocationBps: 1500, // 15% to treasury
    minProposalThreshold: '50000000000000000000000', // 50k tokens
    features: ['treasury', 'voting', 'delegation', 'revenue_sharing'],
  },
  protocol: {
    type: 'protocol',
    name: 'Protocol DAO',
    description:
      'Manage protocol parameters, fee adjustments, upgrades, and strategic initiatives.',
    icon: '⚙️',
    defaultVotingConfig: {
      votingType: 'single-choice',
      votingPeriod: 864000, // 10 days
      votingDelay: 172800, // 2 days
      quorumPercent: 20, // 20% quorum
      proposalThreshold: 0.01, // 1% of supply to propose
      approvalThreshold: 60, // Supermajority
      allowDelegation: true,
      allowQuadratic: true,
    },
    defaultPermissions: {
      canPropose: 'token_holders',
      canVote: 'token_holders',
      canExecute: 'timelock',
      emergencyMultisigThreshold: 4,
      emergencyMultisigMembers: 7,
    },
    treasuryAllocationBps: 2000, // 20% to treasury
    minProposalThreshold: '100000000000000000000000', // 100k tokens
    features: ['treasury', 'voting', 'delegation', 'timelock', 'multisig_emergency'],
  },
  social: {
    type: 'social',
    name: 'Social DAO',
    description:
      'Make community decisions, manage events, allocate community grants, and set guidelines.',
    icon: '🌐',
    defaultVotingConfig: {
      votingType: 'single-choice',
      votingPeriod: 259200, // 3 days
      votingDelay: 0, // No delay
      quorumPercent: 5, // 5% quorum
      proposalThreshold: 0.1, // 0.1% of supply to propose
      approvalThreshold: 51,
      allowDelegation: true,
      allowQuadratic: false,
    },
    defaultPermissions: {
      canPropose: 'token_holders',
      canVote: 'token_holders',
      canExecute: 'anyone',
      emergencyMultisigThreshold: 2,
      emergencyMultisigMembers: 3,
    },
    treasuryAllocationBps: 500, // 5% to treasury
    minProposalThreshold: '10000000000000000000000', // 10k tokens
    features: ['voting', 'delegation', 'grants'],
  },
};

// ─── Voting Config ───────────────────────────────────────────────────────────

export interface VotingConfig {
  /** Voting system type: single-choice, weighted, quadratic, approval */
  votingType: VotingType;
  /** Voting period in seconds (default 7 days = 604800) */
  votingPeriod: number;
  /** Delay before voting starts in seconds */
  votingDelay: number;
  /** Minimum % of total voting power required for quorum (0-100) */
  quorumPercent: number;
  /** Minimum % of token supply needed to create a proposal */
  proposalThreshold: number;
  /** % of votes required for approval (simple majority = 51) */
  approvalThreshold: number;
  /** Allow vote delegation */
  allowDelegation: boolean;
  /** Allow quadratic voting */
  allowQuadratic: boolean;
}

export type VotingType = 'single-choice' | 'weighted' | 'quadratic' | 'approval' | 'basic';

// ─── Permissions ─────────────────────────────────────────────────────────────

export interface DAOPermissions {
  /** Who can create proposals */
  canPropose: 'token_holders' | 'whitelist' | 'multisig';
  /** Who can vote */
  canVote: 'token_holders' | 'whitelist';
  /** Who can execute passed proposals */
  canExecute: 'timelock' | 'creator_multisig' | 'anyone';
  /** Number of multisig signers required for emergency actions */
  emergencyMultisigThreshold: number;
  /** Total emergency multisig members */
  emergencyMultisigMembers: number;
}

export type DAOFeature =
  | 'treasury'
  | 'voting'
  | 'delegation'
  | 'timelock'
  | 'multisig_emergency'
  | 'revenue_sharing'
  | 'grants'
  | 'governance_upgrade';

// ─── DAO State ────────────────────────────────────────────────────────────────

export type DAOStatus = 'pending' | 'active' | 'graduated' | 'frozen';

export interface DAOState {
  /** Unique DAO identifier (ENS name or UUID) */
  id: string;
  /** The creator coin this DAO governs */
  coinAddress: string;
  /** Creator's wallet */
  creator: string;
  /** DAO name */
  name: string;
  /** Template type */
  template: DAOTemplateType;
  /** Current status */
  status: DAOStatus;
  /** Snapshot space ID (ENS or generated) */
  snapshotSpaceId: string;
  /** Snapshot space ENS */
  snapshotEns?: string;
  /** Governor contract address (if on-chain execution deployed) */
  governorAddress?: Address;
  /** Timelock contract address */
  timelockAddress?: Address;
  /** Treasury wallet address */
  treasuryAddress: string;
  /** Token address for the governance token */
  tokenAddress: string;
  /** Chain this DAO operates on */
  chain: 'base' | 'solana';
  /** Current treasury balance (in ETH/SOL) */
  treasuryBalance: string;
  /** Treasury in USD */
  treasuryBalanceUsd: number;
  /** Total token supply */
  totalSupply: string;
  /** % of supply allocated to treasury (in bps) */
  treasuryAllocationBps: number;
  /** Creation timestamp */
  createdAt: number;
  /** Graduation timestamp */
  graduatedAt?: number;
  /** Active proposal count */
  activeProposals: number;
  /** Total proposals created */
  totalProposals: number;
  /** Total voters */
  totalVoters: number;
  /** Voting configuration */
  votingConfig: VotingConfig;
  /** DAO metadata */
  metadata: DAOMetadata;
}

export interface DAOMetadata {
  description: string;
  avatar?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  github?: string;
  guidelines?: string;
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'pending'
  | 'active'
  | 'closed'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export interface Proposal {
  /** Proposal ID (IPFS hash from Snapshot) */
  id: string;
  /** DAO space ID */
  spaceId: string;
  /** Proposal title */
  title: string;
  /** Proposal body (markdown) */
  body: string;
  /** Discussion link */
  discussion?: string;
  /** Voting choices */
  choices: string[];
  /** Voting type */
  type: VotingType;
  /** Current status */
  status: ProposalStatus;
  /** Author address */
  author: string;
  /** Start timestamp */
  start: number;
  /** End timestamp */
  end: number;
  /** Snapshot block number */
  snapshotBlock: number;
  /** Vote counts per choice */
  scores: Record<number, number>;
  /** Total voting power */
  scores_total: number;
  /** Quorum reached */
  quorumReached: boolean;
  /** Creator's vote (if any) */
  userVote?: number;
  /** Labels/tags */
  labels?: string[];
  /** Created at */
  created: number;
  /** On-chain execution data */
  executionData?: ProposalExecutionData;
}

export interface ProposalExecutionData {
  /** Target contract address */
  target: Address;
  /** Value to send */
  value: string;
  /** Calldata for execution */
  calldata: string;
  /** Description hash */
  descriptionHash: string;
  /** Whether proposal has been queued in timelock */
  queued: boolean;
  /** Whether proposal has been executed */
  executed: boolean;
  /** Execution transaction hash */
  executionTx?: string;
}

export interface Vote {
  /** Voter address */
  voter: string;
  /** Choice index (1-based) */
  choice: number;
  /** Voting power */
  power: number;
  /** Reason */
  reason?: string;
  /** Timestamp */
  timestamp: number;
}

// ─── DAO Creation Input ──────────────────────────────────────────────────────

export interface DAOCreationInput {
  /** Creator coin address */
  coinAddress: string;
  /** Creator wallet */
  creator: string;
  /** DAO name */
  name: string;
  /** Template type */
  template: DAOTemplateType;
  /** Token info */
  token: {
    address: string;
    symbol: string;
    totalSupply: string;
    chain: 'base' | 'solana';
  };
  /** Custom voting config (overrides template defaults) */
  votingConfig?: Partial<VotingConfig>;
  /** Custom metadata */
  metadata?: Partial<DAOMetadata>;
  /** Emergency multisig members */
  emergencySigners?: string[];
  /** Treasury allocation in bps */
  treasuryAllocationBps?: number;
}

// ─── DAO Client Config ───────────────────────────────────────────────────────

export interface DAOClientConfig {
  /** Snapshot hub URL */
  snapshotHubUrl?: string;
  /** Snapshot sequencer URL */
  snapshotSequencerUrl?: string;
  /** Tally API key (optional, for governance indexing) */
  tallyApiKey?: string;
  /** Base RPC URL */
  baseRpcUrl?: string;
  /** Private key for on-chain operations */
  privateKey?: string;
  /** KV store for space registry */
  kv?: any;
}

// ─── On-Chain Governor Deployment ────────────────────────────────────────────

export interface GovernorDeploymentParams {
  /** Token address (ERC20Votes or compatible) */
  tokenAddress: Address;
  /** DAO name */
  name: string;
  /** Voting delay in blocks */
  votingDelay: number;
  /** Voting period in blocks */
  votingPeriod: number;
  /** Quorum (as percentage or absolute) */
  quorum: bigint;
  /** Proposal threshold */
  proposalThreshold: bigint;
  /** Timelock minimum delay in seconds */
  timelockDelay: number;
  /** Emergency multisig addresses */
  emergencySigners: Address[];
  /** Emergency multisig threshold */
  emergencyThreshold: number;
}

export interface GovernorDeploymentResult {
  governorAddress: Address;
  timelockAddress: Address;
  treasuryAddress: Address;
  deployTx: string;
}

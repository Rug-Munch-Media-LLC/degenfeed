/**
 * @degenfeed/api-worker — Investment Management Service (TASK 4)
 *
 * Tools for DAO treasuries to manage investments across DeFi protocols.
 * Includes portfolio tracking, yield opportunities, investment proposals,
 * risk assessment, and performance tracking.
 *
 * All state persisted in KV under `investment:{namespace}:{daoId}:{id}`.
 */

import type { Address } from 'viem';
import type { Env } from '../types';
import { log } from '../types';
import {
  investmentIndexKey,
  investmentKey,
  investmentProposalIndexKey,
  investmentProposalKey,
  portfolioKey,
  yieldOpportunitiesKey,
} from '../kv-key-patterns';

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_TTL = 365 * 86400;
const USD_PRECISION = 2;

// ─── Types ────────────────────────────────────────────────────────────────

export type InvestmentType =
  | 'lending'
  | 'staking'
  | 'lp'
  | 'liquid_staking'
  | 'vault'
  | 'bond'
  | 'other';
export type InvestmentStatus = 'active' | 'withdrawn' | 'failed' | 'proposed';
export type ProposalStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'executed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface InvestmentPosition {
  id: string;
  daoId: string;
  /** Type of investment */
  type: InvestmentType;
  /** Protocol name (e.g. "Lido", "Aave", "Uniswap") */
  protocol: string;
  /** Protocol address */
  protocolAddress: Address;
  /** Token(s) invested */
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Amount invested (in smallest units) */
  amountInvested: string;
  /** USD value at time of investment */
  usdInvested: number;
  /** Current USD value */
  usdCurrent: number;
  /** Current amount (with yield) */
  amountCurrent: string;
  /** Total yield earned (in USD) */
  yieldEarnedUsd: number;
  /** Yield percentage (APY/APR) */
  yieldPercent: number;
  /** Investment APY */
  apy: number;
  /** When the investment was made */
  investedAt: number;
  /** When the position was last updated */
  lastUpdated: number;
  /** Current status */
  status: InvestmentStatus;
  /** Associated proposal ID if from a vote */
  proposalId?: string;
  /** Risk assessment */
  risk: RiskAssessment;
  /** Notes */
  notes?: string;
  /** Metadata */
  metadata?: Record<string, string>;
}

export interface RiskAssessment {
  level: RiskLevel;
  /** Protocol audit status */
  audited: boolean;
  /** Audit provider (if audited) */
  auditProvider?: string;
  /** Impermanent loss risk (for LP positions) */
  ilRisk: 'none' | 'low' | 'medium' | 'high';
  /** Protocol age in days */
  protocolAgeDays: number;
  /** Total value locked in protocol */
  tvlUsd?: number;
  /** Smart contract risk score (0-100) */
  contractRiskScore: number;
  /** Overall risk score (0-100) */
  overallScore: number;
}

export interface YieldOpportunity {
  id: string;
  protocol: string;
  protocolAddress: Address;
  type: InvestmentType;
  tokenSymbol: string;
  tokenAddress: Address;
  apy: number;
  tvlUsd: number;
  minDeposit: string;
  risk: RiskLevel;
  audited: boolean;
  /** URL to app */
  appUrl: string;
  /** Requirements (e.g. "min 30 day lock") */
  requirements?: string;
  /** Positive attributes */
  pros: string[];
  cons: string[];
}

export interface InvestmentProposal {
  id: string;
  daoId: string;
  title: string;
  description: string;
  /** Investment details */
  investment: {
    type: InvestmentType;
    protocol: string;
    protocolAddress: Address;
    tokenAddress: Address;
    tokenSymbol: string;
    amount: string;
    expectedApy: number;
    durationDays?: number;
  };
  /** Author of the proposal */
  proposer: Address;
  /** Current status */
  status: ProposalStatus;
  /** Vote tally */
  votes: {
    for: number;
    against: number;
    abstain: number;
  };
  /** Risk assessment */
  riskAssessment: RiskAssessment;
  /** Supporting research links */
  researchLinks: string[];
  created: number;
  votingEndsAt: number;
  executedAt?: number;
  executedPositionId?: string;
}

export interface Portfolio {
  daoId: string;
  /** All assets including non-invested */
  assets: AssetBalance[];
  /** Active investment positions */
  positions: InvestmentPosition[];
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** Total yield earned */
  totalYieldUsd: number;
  /** Average APY across investments */
  averageApy: number;
  /** Allocation percentages */
  allocation: Record<string, number>;
  /** Risk distribution */
  riskDistribution: Record<RiskLevel, number>;
  lastUpdated: number;
}

export interface AssetBalance {
  tokenAddress: Address;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  balance: string;
  usdValue: number;
  /** Percentage of total portfolio */
  allocationPercent: number;
  /** Where this asset is held */
  location: 'treasury' | 'investment' | 'streaming' | 'grants';
}

export interface InvestmentFilter {
  type?: InvestmentType;
  status?: InvestmentStatus;
  protocol?: string;
  risk?: RiskLevel;
  limit?: number;
  offset?: number;
}

// ─── Mock yield data ──────────────────────────────────────────────────────
// In production, these would be fetched from DeFi protocols / oracles.

const MOCK_YIELD_OPPORTUNITIES: YieldOpportunity[] = [
  {
    id: 'lido-eth',
    protocol: 'Lido',
    protocolAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as Address,
    type: 'liquid_staking',
    tokenSymbol: 'stETH',
    tokenAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as Address,
    apy: 3.9,
    tvlUsd: 35_000_000_000,
    minDeposit: '0.01',
    risk: 'low',
    audited: true,
    appUrl: 'https://lido.fi',
    pros: ['Industry-leading LST', 'Deep liquidity', 'Multiple audit firms'],
    cons: ['stETH/ETH peg can deviate', 'Protocol fees on rewards'],
  },
  {
    id: 'aave-usdc',
    protocol: 'Aave',
    protocolAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' as Address,
    type: 'lending',
    tokenSymbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    apy: 5.2,
    tvlUsd: 12_000_000_000,
    minDeposit: '10',
    risk: 'low',
    audited: true,
    appUrl: 'https://aave.com',
    pros: ['Battle-tested protocol', 'Insurance fund', 'Multiple chains'],
    cons: ['Variable APY', 'Smart contract risk'],
  },
  {
    id: 'uniswap-eth-usdc',
    protocol: 'Uniswap V3',
    protocolAddress: '0x1f98431c8aD98523631AE4a59f267346ea31F984' as Address,
    type: 'lp',
    tokenSymbol: 'ETH/USDC',
    tokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    apy: 15.0,
    tvlUsd: 3_000_000_000,
    minDeposit: '0.1',
    risk: 'medium',
    audited: true,
    appUrl: 'https://app.uniswap.org',
    pros: ['Highest liquidity DEX', 'Concentrated liquidity = higher yields', 'Fee tiers'],
    cons: [
      'IL risk with volatile pairs',
      'Requires active management',
      'Gas costs for rebalancing',
    ],
  },
  {
    id: 'morpho-blue',
    protocol: 'Morpho Blue',
    protocolAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as Address,
    type: 'lending',
    tokenSymbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    apy: 8.5,
    tvlUsd: 2_500_000_000,
    minDeposit: '100',
    risk: 'medium',
    audited: true,
    appUrl: 'https://morpho.org',
    pros: ['Efficient lending market', 'Permissionless', 'Higher rates than Aave'],
    cons: ['Newer protocol', 'Less liquidity than Aave', 'No insurance fund'],
  },
  {
    id: 'eigenlayer-eth',
    protocol: 'EigenLayer',
    protocolAddress: '0x0000000000000000000000000000000000000000' as Address,
    type: 'liquid_staking',
    tokenSymbol: 'ETH',
    tokenAddress: '0x0000000000000000000000000000000000000000' as Address,
    apy: 3.5,
    tvlUsd: 15_000_000_000,
    minDeposit: '0.1',
    risk: 'medium',
    audited: true,
    appUrl: 'https://eigenlayer.xyz',
    pros: ['Restaking = extra yield', 'AVS ecosystem', 'Strong team'],
    cons: ['Complex risks', 'Long unbonding period', 'Protocol is evolving'],
  },
  {
    id: 'aerodrome-base',
    protocol: 'Aerodrome',
    protocolAddress: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' as Address,
    type: 'lp',
    tokenSymbol: 'AERO/ETH',
    tokenAddress: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' as Address,
    apy: 25.0,
    tvlUsd: 800_000_000,
    minDeposit: '0.1',
    risk: 'high',
    audited: true,
    appUrl: 'https://aerodrome.finance',
    pros: ['Native Base DEX', 'Deep AERO incentives', 'Vote-escrow model'],
    cons: ['High IL risk', 'AERO token price volatility', 'Incentive-dependent yields'],
  },
];

// ─── Service ──────────────────────────────────────────────────────────────

export class InvestmentService {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.env = env;
    this.kv = env.TREASURY as unknown as KVNamespace;
  }

  // ─── Portfolio Overview ───────────────────────────────────────────

  /**
   * Get full portfolio overview for a DAO treasury.
   * Combines data from on-chain balances + stored investment positions.
   */
  async getPortfolio(daoId: string): Promise<Portfolio> {
    // Try cache first
    const cached = await this.kv.get(portfolioKey(daoId));
    if (cached) {
      return JSON.parse(cached) as Portfolio;
    }

    const positions = await this.listPositions(daoId, { limit: 100 });
    const activePositions = positions.positions.filter((p) => p.status === 'active');

    // Build asset list from positions
    const assetMap = new Map<string, AssetBalance>();
    let totalValueUsd = 0;
    let totalYieldUsd = 0;
    let apySum = 0;

    for (const pos of activePositions) {
      const assetKey = pos.tokenAddress.toLowerCase();

      if (assetMap.has(assetKey)) {
        const existing = assetMap.get(assetKey)!;
        existing.balance = (BigInt(existing.balance) + BigInt(pos.amountCurrent)).toString();
        existing.usdValue += pos.usdCurrent;
      } else {
        assetMap.set(assetKey, {
          tokenAddress: pos.tokenAddress,
          tokenSymbol: pos.tokenSymbol,
          tokenName: pos.tokenSymbol,
          tokenDecimals: pos.tokenDecimals,
          balance: pos.amountCurrent,
          usdValue: pos.usdCurrent,
          allocationPercent: 0,
          location: 'investment',
        });
      }

      totalValueUsd += pos.usdCurrent;
      totalYieldUsd += pos.yieldEarnedUsd;
      apySum += pos.apy;
    }

    // Calculate allocation percentages
    const allocation: Record<string, number> = {};
    for (const [, asset] of assetMap) {
      asset.allocationPercent = totalValueUsd > 0 ? (asset.usdValue / totalValueUsd) * 100 : 0;
      allocation[asset.tokenSymbol] = asset.allocationPercent;
    }

    // Risk distribution
    const riskDistribution: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const pos of activePositions) {
      riskDistribution[pos.risk.level] = (riskDistribution[pos.risk.level] || 0) + pos.usdCurrent;
    }

    // Convert to percentages
    for (const key of Object.keys(riskDistribution)) {
      riskDistribution[key as RiskLevel] =
        totalValueUsd > 0 ? (riskDistribution[key as RiskLevel] / totalValueUsd) * 100 : 0;
    }

    const portfolio: Portfolio = {
      daoId,
      assets: Array.from(assetMap.values()),
      positions: activePositions,
      totalValueUsd,
      totalYieldUsd,
      averageApy: activePositions.length > 0 ? apySum / activePositions.length : 0,
      allocation,
      riskDistribution,
      lastUpdated: Date.now(),
    };

    // Cache for 5 minutes
    await this.kv.put(portfolioKey(daoId), JSON.stringify(portfolio), { expirationTtl: 300 });

    return portfolio;
  }

  // ─── Investment Positions ─────────────────────────────────────────

  /**
   * Record a new investment position.
   */
  async addPosition(
    daoId: string,
    position: Omit<InvestmentPosition, 'id' | 'daoId' | 'lastUpdated'>,
  ): Promise<InvestmentPosition> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const pos: InvestmentPosition = {
      ...position,
      id,
      daoId,
      lastUpdated: now,
    };

    await this.kv.put(investmentKey(daoId, id), JSON.stringify(pos), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#addToIndex(daoId, id);

    log('info', '[investment] Position added', {
      daoId,
      positionId: id,
      type: pos.type,
      protocol: pos.protocol,
      amount: pos.amountInvested,
    });

    return pos;
  }

  /**
   * Update an existing position (e.g., yield accrual, withdrawal).
   */
  async updatePosition(
    daoId: string,
    positionId: string,
    updates: Partial<
      Pick<
        InvestmentPosition,
        | 'amountCurrent'
        | 'usdCurrent'
        | 'yieldEarnedUsd'
        | 'yieldPercent'
        | 'apy'
        | 'status'
        | 'notes'
        | 'metadata'
      >
    >,
  ): Promise<InvestmentPosition> {
    const pos = await this.#getPosition(daoId, positionId);
    if (!pos) {
      throw new Error(`Investment position not found: ${positionId}`);
    }

    const updated: InvestmentPosition = {
      ...pos,
      ...updates,
      id: pos.id, // Ensure id doesn't change
      lastUpdated: Date.now(),
    };

    await this.kv.put(investmentKey(daoId, positionId), JSON.stringify(updated), {
      expirationTtl: DEFAULT_TTL,
    });

    return updated;
  }

  /**
   * Get all investment positions for a DAO.
   */
  async listPositions(
    daoId: string,
    filter?: InvestmentFilter,
  ): Promise<{ positions: InvestmentPosition[]; total: number }> {
    const index = await this.#getIndex(daoId);
    const limited = filter?.offset ? index.slice(filter.offset) : index;

    const slice = filter?.limit ? limited.slice(0, filter.limit) : limited.slice(0, 50);

    const positions: InvestmentPosition[] = [];

    for (const id of slice) {
      const pos = await this.#getPosition(daoId, id);
      if (pos && this.#matchesFilter(pos, filter)) {
        positions.push(pos);
      }
    }

    return {
      positions: positions.sort((a, b) => b.investedAt - a.investedAt),
      total: index.length,
    };
  }

  // ─── Yield Opportunities ─────────────────────────────────────────

  /**
   * Get available yield opportunities across DeFi protocols.
   * In production, this would query on-chain data + APIs.
   */
  async getYieldOpportunities(filter?: {
    type?: InvestmentType;
    maxRisk?: RiskLevel;
    minApy?: number;
    limit?: number;
  }): Promise<YieldOpportunity[]> {
    // Check cache
    const cached = await this.kv.get(yieldOpportunitiesKey());
    let opportunities: YieldOpportunity[];

    if (cached) {
      opportunities = JSON.parse(cached) as YieldOpportunity[];
    } else {
      // In production: fetch from DeFi APIs, for now use mock data
      opportunities = MOCK_YIELD_OPPORTUNITIES;

      // Cache for 10 minutes
      await this.kv.put(yieldOpportunitiesKey(), JSON.stringify(opportunities), {
        expirationTtl: 600,
      });
    }

    // Apply filters
    if (filter) {
      if (filter.type) {
        opportunities = opportunities.filter((o) => o.type === filter.type);
      }
      if (filter.maxRisk) {
        const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
        const maxIdx = riskOrder.indexOf(filter.maxRisk);
        opportunities = opportunities.filter((o) => {
          const idx = riskOrder.indexOf(o.risk);
          return idx >= 0 && idx <= maxIdx;
        });
      }
      if (filter.minApy !== undefined) {
        opportunities = opportunities.filter((o) => o.apy >= filter.minApy!);
      }
      if (filter.limit) {
        opportunities = opportunities.slice(0, filter.limit);
      }
    }

    return opportunities;
  }

  // ─── Investment Proposals ─────────────────────────────────────────

  /**
   * Create an investment proposal for DAO members to vote on.
   */
  async createProposal(
    daoId: string,
    proposal: Omit<InvestmentProposal, 'id' | 'daoId' | 'status' | 'votes' | 'created'>,
  ): Promise<InvestmentProposal> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const invProposal: InvestmentProposal = {
      ...proposal,
      id,
      daoId,
      status: 'pending',
      votes: { for: 0, against: 0, abstain: 0 },
      created: now,
    };

    await this.kv.put(investmentProposalKey(daoId, id), JSON.stringify(invProposal), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#addToProposalIndex(daoId, id);

    log('info', '[investment] Investment proposal created', {
      daoId,
      proposalId: id,
      protocol: proposal.investment.protocol,
      amount: proposal.investment.amount,
      proposer: proposal.proposer.slice(0, 10),
    });

    return invProposal;
  }

  /**
   * Vote on an investment proposal.
   */
  async voteOnProposal(
    daoId: string,
    proposalId: string,
    _voter: Address,
    choice: 'for' | 'against' | 'abstain',
  ): Promise<InvestmentProposal> {
    const proposal = await this.#getProposal(daoId, proposalId);
    if (!proposal) {
      throw new Error(`Investment proposal not found: ${proposalId}`);
    }

    if (proposal.status !== 'active') {
      throw new Error(`Proposal is not active (status: ${proposal.status})`);
    }

    if (Date.now() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    proposal.votes[choice]++;
    proposal.status = this.#tallyProposal(proposal);

    await this.kv.put(investmentProposalKey(daoId, proposalId), JSON.stringify(proposal), {
      expirationTtl: DEFAULT_TTL,
    });

    return proposal;
  }

  /**
   * List investment proposals for a DAO.
   */
  async listProposals(daoId: string, status?: ProposalStatus): Promise<InvestmentProposal[]> {
    const index = await this.#getProposalIndex(daoId);
    const proposals: InvestmentProposal[] = [];

    for (const id of index) {
      const proposal = await this.#getProposal(daoId, id);
      if (proposal && (!status || proposal.status === status)) {
        proposals.push(proposal);
      }
    }

    return proposals.sort((a, b) => b.created - a.created);
  }

  // ─── Risk Assessment ──────────────────────────────────────────────

  /**
   * Get a risk assessment for a specific protocol or investment.
   * Combines multiple factors into an overall score.
   */
  assessRisk(params: {
    protocol: string;
    audited: boolean;
    protocolAgeDays: number;
    tvlUsd?: number;
    type: InvestmentType;
    hasILRisk: boolean;
  }): RiskAssessment {
    let score = 0;

    // Audit status (major factor)
    if (!params.audited) score += 40;
    else score += 10;

    // Protocol age
    if (params.protocolAgeDays < 30) score += 25;
    else if (params.protocolAgeDays < 180) score += 15;
    else if (params.protocolAgeDays < 365) score += 10;
    else score += 5;

    // TVL confidence
    if (params.tvlUsd) {
      if (params.tvlUsd < 10_000_000) score += 20;
      else if (params.tvlUsd < 100_000_000) score += 15;
      else if (params.tvlUsd < 1_000_000_000) score += 10;
      else score += 5;
    }

    // Type-specific risk
    if (params.type === 'lp' && params.hasILRisk) score += 15;
    if (params.type === 'vault') score += 10;

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    let level: RiskLevel;
    if (score <= 25) level = 'low';
    else if (score <= 50) level = 'medium';
    else if (score <= 75) level = 'high';
    else level = 'critical';

    return {
      level,
      audited: params.audited,
      protocolAgeDays: params.protocolAgeDays,
      tvlUsd: params.tvlUsd,
      ilRisk: params.hasILRisk ? (params.type === 'lp' ? 'high' : 'medium') : 'none',
      contractRiskScore: score,
      overallScore: score,
    };
  }

  // ─── Performance Tracking ─────────────────────────────────────────

  /**
   * Calculate ROI for an investment position.
   */
  calculateROI(position: InvestmentPosition): {
    roiPercent: number;
    annualizedRoi: number;
    duration: number;
  } {
    const invested = Number(position.usdInvested);
    const current = Number(position.usdCurrent);
    const durationMs = Date.now() - position.investedAt;
    const durationYears = durationMs / (365 * 86400 * 1000);

    if (invested === 0) return { roiPercent: 0, annualizedRoi: 0, duration: durationMs };

    const roiPercent = ((current - invested) / invested) * 100;
    const annualizedRoi =
      durationYears > 0 ? ((1 + roiPercent / 100) ** (1 / durationYears) - 1) * 100 : roiPercent;

    return {
      roiPercent,
      annualizedRoi,
      duration: durationMs,
    };
  }

  /**
   * Get historical performance for all positions.
   */
  async getPerformanceSummary(daoId: string): Promise<{
    totalInvestedUsd: number;
    totalCurrentUsd: number;
    totalROIPercent: number;
    bestPerformer: { id: string; protocol: string; roi: number } | null;
    worstPerformer: { id: string; protocol: string; roi: number } | null;
    positions: Array<{ id: string; protocol: string; type: string; roi: number; apy: number }>;
  }> {
    const { positions } = await this.listPositions(daoId, { status: 'active' });

    let totalInvested = 0;
    let totalCurrent = 0;
    let best: { id: string; protocol: string; roi: number } | null = null;
    let worst: { id: string; protocol: string; roi: number } | null = null;

    const rois = positions.map((pos) => {
      const roi = this.calculateROI(pos);
      totalInvested += pos.usdInvested;
      totalCurrent += pos.usdCurrent;

      if (!best || roi.roiPercent > best.roi) {
        best = { id: pos.id, protocol: pos.protocol, roi: roi.roiPercent };
      }
      if (!worst || roi.roiPercent < worst.roi) {
        worst = { id: pos.id, protocol: pos.protocol, roi: roi.roiPercent };
      }

      return {
        id: pos.id,
        protocol: pos.protocol,
        type: pos.type,
        roi: roi.roiPercent,
        apy: pos.apy,
      };
    });

    return {
      totalInvestedUsd: totalInvested,
      totalCurrentUsd: totalCurrent,
      totalROIPercent:
        totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
      bestPerformer: best,
      worstPerformer: worst,
      positions: rois,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  async #getPosition(daoId: string, positionId: string): Promise<InvestmentPosition | null> {
    try {
      const raw = await this.kv.get(investmentKey(daoId, positionId));
      return raw ? (JSON.parse(raw) as InvestmentPosition) : null;
    } catch {
      return null;
    }
  }

  async #getProposal(daoId: string, proposalId: string): Promise<InvestmentProposal | null> {
    try {
      const raw = await this.kv.get(investmentProposalKey(daoId, proposalId));
      return raw ? (JSON.parse(raw) as InvestmentProposal) : null;
    } catch {
      return null;
    }
  }

  async #addToIndex(daoId: string, positionId: string): Promise<void> {
    const key = investmentIndexKey(daoId);
    const existing = await this.kv.get(key);
    const index: string[] = existing ? JSON.parse(existing) : [];
    index.unshift(positionId);
    await this.kv.put(key, JSON.stringify(index), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #getIndex(daoId: string): Promise<string[]> {
    try {
      const raw = await this.kv.get(investmentIndexKey(daoId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  async #addToProposalIndex(daoId: string, proposalId: string): Promise<void> {
    const key = investmentProposalIndexKey(daoId);
    const existing = await this.kv.get(key);
    const index: string[] = existing ? JSON.parse(existing) : [];
    index.unshift(proposalId);
    await this.kv.put(key, JSON.stringify(index), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #getProposalIndex(daoId: string): Promise<string[]> {
    try {
      const raw = await this.kv.get(investmentProposalIndexKey(daoId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  #tallyProposal(proposal: InvestmentProposal): ProposalStatus {
    const total = proposal.votes.for + proposal.votes.against;
    if (total === 0) return 'active';

    // Simple majority: >50% of votes
    const forPercent = (proposal.votes.for / total) * 100;
    if (forPercent > 50) {
      return 'approved';
    }
    return 'rejected';
  }

  #matchesFilter(pos: InvestmentPosition, filter?: InvestmentFilter): boolean {
    if (!filter) return true;
    if (filter.type && pos.type !== filter.type) return false;
    if (filter.status && pos.status !== filter.status) return false;
    if (filter.protocol && pos.protocol.toLowerCase() !== filter.protocol.toLowerCase())
      return false;
    if (filter.risk && pos.risk.level !== filter.risk) return false;
    return true;
  }
}

// ─── Standalone helpers ───────────────────────────────────────────────────

/**
 * Format USD value with proper precision.
 */
export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(USD_PRECISION)}`;
}

/**
 * Get a human-readable label for an investment type.
 */
export function getInvestmentTypeLabel(type: InvestmentType): string {
  const labels: Record<InvestmentType, string> = {
    lending: 'Lending',
    staking: 'Staking',
    lp: 'Liquidity Pool',
    liquid_staking: 'Liquid Staking',
    vault: 'Yield Vault',
    bond: 'Bond',
    other: 'Other',
  };
  return labels[type] ?? type;
}

/**
 * Get risk color CSS variable.
 */
export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    low: 'var(--color-success)',
    medium: 'var(--color-accent-secondary)',
    high: 'var(--color-warning)',
    critical: 'var(--color-error)',
  };
  return colors[level] ?? 'var(--color-muted)';
}

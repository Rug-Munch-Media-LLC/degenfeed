/**
 * @degenfeed/api-worker — Grant Program Management Service (TASK 3)
 *
 * Community grant programs for DAOs. Manages the full grant lifecycle:
 * program creation → application → review → voting → milestone tracking → distribution.
 *
 * All state persisted in KV under `grant:{namespace}:{daoId}:{id}` namespace.
 */

import type { Address } from 'viem';
import type { Env } from '../types';
import { log } from '../logger';
import {
  grantAnalyticsKey,
  grantApplicationIndexKey,
  grantApplicationKey,
  grantMilestoneKey,
  grantProgramIndexKey,
  grantProgramKey,
  grantVoteKey,
} from '../kv-key-patterns';

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_TTL = 365 * 86400; // 1 year

// ─── Types ────────────────────────────────────────────────────────────────

export type GrantCategory = 'development' | 'marketing' | 'community' | 'research' | 'other';
export type GrantApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'funded'
  | 'completed'
  | 'cancelled';
export type MilestoneStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface GrantProgram {
  id: string;
  daoId: string;
  /** Program name */
  title: string;
  /** Program description with guidelines */
  description: string;
  /** Total budget for the program (in smallest token units) */
  totalBudget: string;
  /** Remaining budget */
  remainingBudget: string;
  /** Maximum amount per single grant */
  maxPerGrant: string;
  /** Token used for grants */
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Review period in days */
  reviewPeriodDays: number;
  /** Allowed categories */
  categories: GrantCategory[];
  /** Minimum reputation threshold (0 = no minimum) */
  reputationThreshold: number;
  /** Whether KYC is required */
  kycRequired: boolean;
  /** Whether the program is active */
  active: boolean;
  /** When the program starts accepting applications */
  startAt: number;
  /** When the program stops accepting applications (null = no deadline) */
  deadlineAt: number | null;
  /** Who created this program */
  createdBy: Address;
  createdAt: number;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

export interface GrantApplication {
  id: string;
  /** Grant program ID */
  programId: string;
  daoId: string;
  /** Applicant wallet */
  applicant: Address;
  /** Title of the proposal */
  title: string;
  /** Detailed description */
  description: string;
  /** Requested amount in smallest token units */
  requestedAmount: string;
  /** Category this application belongs to */
  category: GrantCategory;
  /** Milestones with amounts and deliverables */
  milestones: GrantMilestone[];
  /** Team information */
  team: GrantTeamInfo;
  /** External links */
  links: GrantLinks;
  /** Current status */
  status: GrantApplicationStatus;
  /** Review comments */
  reviews: GrantReview[];
  /** Vote tally */
  votes: GrantVote[];
  /** Vote counts */
  voteCounts: {
    for: number;
    against: number;
    abstain: number;
  };
  /** Voting config (snapshot of program settings) */
  votingConfig: {
    votingPeriodEnd: number;
    approvalThreshold: number;
    totalEligibleVoters: number;
  };
  /** Timestamp */
  submittedAt: number;
  /** When status last changed */
  updatedAt: number;
  /** USD value at time of submission */
  usdValue?: number;
  /** Metadata */
  metadata?: Record<string, string>;
}

export interface GrantMilestone {
  id: string;
  /** Milestone title */
  title: string;
  /** Description of deliverables */
  description: string;
  /** Amount to be released on approval */
  amount: string;
  /** Current status */
  status: MilestoneStatus;
  /** Proof of completion (links, hashes, etc.) */
  proof?: string;
  /** Reviewer feedback */
  feedback?: string;
  /** When submitted for review */
  submittedAt?: number;
  /** When approved/rejected */
  resolvedAt?: number;
  /** Index for ordering */
  index: number;
}

export interface GrantTeamInfo {
  /** Team member wallet addresses */
  members: Address[];
  /** Team name */
  name?: string;
  /** Email contact */
  email?: string;
  /** Brief bio/background */
  bio?: string;
  /** Previous experience */
  experience?: string;
}

export interface GrantLinks {
  github?: string;
  website?: string;
  portfolio?: string;
  twitter?: string;
  discord?: string;
  additionalLinks?: string[];
}

export interface GrantReview {
  reviewer: Address;
  comment: string;
  rating: number; // 1-5
  timestamp: number;
}

export interface GrantVote {
  voter: Address;
  choice: 'for' | 'against' | 'abstain';
  reason?: string;
  timestamp: number;
}

export interface GrantAnalytics {
  daoId: string;
  totalPrograms: number;
  activePrograms: number;
  totalApplications: number;
  totalApproved: number;
  totalRejected: number;
  totalDistributed: string;
  totalRequested: string;
  grantsByCategory: Record<GrantCategory, number>;
  successRate: number; // 0-1
  topGrantees: Array<{
    applicant: Address;
    totalReceived: string;
    count: number;
  }>;
  averageGrantSize: string;
  lastUpdated: number;
}

export interface CreateGrantProgramInput {
  title: string;
  description: string;
  totalBudget: string;
  maxPerGrant: string;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  reviewPeriodDays: number;
  categories: GrantCategory[];
  reputationThreshold?: number;
  kycRequired?: boolean;
  startAt?: number;
  deadlineAt?: number | null;
  createdBy: Address;
  metadata?: Record<string, string>;
}

export interface SubmitGrantApplicationInput {
  programId: string;
  applicant: Address;
  title: string;
  description: string;
  requestedAmount: string;
  category: GrantCategory;
  milestones: Array<{
    title: string;
    description: string;
    amount: string;
  }>;
  team: GrantTeamInfo;
  links: GrantLinks;
  usdValue?: number;
  metadata?: Record<string, string>;
}

export interface GrantFilter {
  status?: GrantApplicationStatus;
  category?: GrantCategory;
  applicant?: Address;
  programId?: string;
  limit?: number;
  offset?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

export class GrantsService {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.env = env;
    this.kv = env.TREASURY as unknown as KVNamespace;
  }

  // ─── Create Grant Program ─────────────────────────────────────────

  /**
   * Create a new grant program.
   */
  async createGrantProgram(daoId: string, input: CreateGrantProgramInput): Promise<GrantProgram> {
    this.#validateBudget(input.totalBudget, input.maxPerGrant, input.tokenDecimals);

    const id = crypto.randomUUID();
    const now = Date.now();

    const program: GrantProgram = {
      id,
      daoId,
      title: input.title,
      description: input.description,
      totalBudget: input.totalBudget,
      remainingBudget: input.totalBudget,
      maxPerGrant: input.maxPerGrant,
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      tokenDecimals: input.tokenDecimals,
      reviewPeriodDays: input.reviewPeriodDays,
      categories: input.categories,
      reputationThreshold: input.reputationThreshold ?? 0,
      kycRequired: input.kycRequired ?? false,
      active: true,
      startAt: input.startAt ?? now,
      deadlineAt: input.deadlineAt ?? null,
      createdBy: input.createdBy,
      createdAt: now,
      metadata: input.metadata,
    };

    await this.kv.put(grantProgramKey(daoId, id), JSON.stringify(program), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#addToProgramIndex(daoId, id);

    log('info', '[grants] Grant program created', {
      daoId,
      programId: id,
      title: input.title,
      budget: input.totalBudget,
      categories: input.categories.join(','),
    });

    return program;
  }

  // ─── Get Grant Program ────────────────────────────────────────────

  /**
   * Get a grant program by ID.
   */
  async getGrantProgram(daoId: string, programId: string): Promise<GrantProgram | null> {
    try {
      const raw = await this.kv.get(grantProgramKey(daoId, programId));
      return raw ? (JSON.parse(raw) as GrantProgram) : null;
    } catch {
      return null;
    }
  }

  // ─── List Grant Programs ──────────────────────────────────────────

  /**
   * List all grant programs for a DAO.
   */
  async listGrantPrograms(
    daoId: string,
    filter?: { active?: boolean; category?: GrantCategory },
  ): Promise<GrantProgram[]> {
    const index = await this.#getProgramIndex(daoId);
    const programs: GrantProgram[] = [];

    for (const id of index) {
      const program = await this.getGrantProgram(daoId, id);
      if (!program) continue;

      if (filter?.active !== undefined && program.active !== filter.active) continue;
      if (filter?.category && !program.categories.includes(filter.category)) continue;

      programs.push(program);
    }

    return programs.sort((a, b) => b.createdAt - a.createdAt);
  }

  // ─── Submit Grant Application ─────────────────────────────────────

  /**
   * Submit a grant application.
   */
  async submitApplication(
    daoId: string,
    input: SubmitGrantApplicationInput,
  ): Promise<GrantApplication> {
    // Verify grant program exists and is active
    const program = await this.getGrantProgram(daoId, input.programId);
    if (!program) {
      throw new Error(`Grant program not found: ${input.programId}`);
    }
    if (!program.active) {
      throw new Error('Grant program is not active');
    }
    if (program.deadlineAt && Date.now() > program.deadlineAt) {
      throw new Error('Grant program deadline has passed');
    }

    // Validate requested amount
    const requested = BigInt(input.requestedAmount);
    const maxPerGrant = BigInt(program.maxPerGrant);
    const remaining = BigInt(program.remainingBudget);

    if (requested <= 0n) {
      throw new Error('Requested amount must be greater than 0');
    }
    if (requested > maxPerGrant) {
      throw new Error(`Requested amount exceeds maximum per grant (${program.maxPerGrant})`);
    }
    if (requested > remaining) {
      throw new Error(`Insufficient budget. Remaining: ${program.remainingBudget}`);
    }

    // Validate category
    if (!input.category || !program.categories.includes(input.category)) {
      throw new Error(`Invalid category. Allowed: ${program.categories.join(', ')}`);
    }

    // Validate milestones sum equals requested amount
    const milestonesTotal = input.milestones.reduce((sum, m) => sum + BigInt(m.amount), 0n);
    if (milestonesTotal !== requested) {
      throw new Error(
        `Milestone amounts (${milestonesTotal}) must sum to requested amount (${requested})`,
      );
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    // Build milestone objects with IDs
    const milestones: GrantMilestone[] = input.milestones.map((m, i) => ({
      id: crypto.randomUUID(),
      title: m.title,
      description: m.description,
      amount: m.amount,
      status: 'pending' as MilestoneStatus,
      index: i,
    }));

    // Calculate voting period end
    const votingPeriodEnd = now + program.reviewPeriodDays * 86400 * 1000;

    const application: GrantApplication = {
      id,
      programId: input.programId,
      daoId,
      applicant: input.applicant,
      title: input.title,
      description: input.description,
      requestedAmount: input.requestedAmount,
      category: input.category,
      milestones,
      team: input.team,
      links: input.links,
      status: 'submitted',
      reviews: [],
      votes: [],
      voteCounts: { for: 0, against: 0, abstain: 0 },
      votingConfig: {
        votingPeriodEnd,
        approvalThreshold: 51, // Default simple majority
        totalEligibleVoters: 0,
      },
      submittedAt: now,
      updatedAt: now,
      usdValue: input.usdValue,
      metadata: input.metadata,
    };

    await this.kv.put(grantApplicationKey(daoId, id), JSON.stringify(application), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#addToApplicationIndex(daoId, id);

    log('info', '[grants] Application submitted', {
      daoId,
      appId: id,
      programId: input.programId,
      applicant: input.applicant.slice(0, 10),
      amount: input.requestedAmount,
    });

    return application;
  }

  // ─── Get Application ──────────────────────────────────────────────

  /**
   * Get a grant application by ID.
   */
  async getApplication(daoId: string, appId: string): Promise<GrantApplication | null> {
    try {
      const raw = await this.kv.get(grantApplicationKey(daoId, appId));
      return raw ? (JSON.parse(raw) as GrantApplication) : null;
    } catch {
      return null;
    }
  }

  // ─── List Applications ────────────────────────────────────────────

  /**
   * List grant applications with optional filters.
   */
  async listApplications(
    daoId: string,
    filter?: GrantFilter,
  ): Promise<{ applications: GrantApplication[]; total: number }> {
    const index = await this.#getApplicationIndex(daoId);
    const limited = filter?.offset ? index.slice(filter.offset) : index;

    const slice = filter?.limit ? limited.slice(0, filter.limit) : limited.slice(0, 50);

    const applications: GrantApplication[] = [];

    for (const id of slice) {
      const app = await this.getApplication(daoId, id);
      if (app && this.#matchesFilter(app, filter)) {
        applications.push(app);
      }
    }

    return {
      applications: applications.sort((a, b) => b.submittedAt - a.submittedAt),
      total: index.length,
    };
  }

  // ─── Review Application ───────────────────────────────────────────

  /**
   * Add a review comment to an application.
   */
  async addReview(
    daoId: string,
    appId: string,
    reviewer: Address,
    comment: string,
    rating: number,
  ): Promise<GrantApplication> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const app = await this.getApplication(daoId, appId);
    if (!app) {
      throw new Error(`Application not found: ${appId}`);
    }

    const review: GrantReview = {
      reviewer,
      comment,
      rating,
      timestamp: Date.now(),
    };

    app.reviews.push(review);
    app.updatedAt = Date.now();

    // Auto-move to under_review if submitted
    if (app.status === 'submitted') {
      app.status = 'under_review';
    }

    await this.kv.put(grantApplicationKey(daoId, appId), JSON.stringify(app), {
      expirationTtl: DEFAULT_TTL,
    });

    return app;
  }

  // ─── Vote on Application ──────────────────────────────────────────

  /**
   * Cast a vote on a grant application.
   */
  async castVote(
    daoId: string,
    appId: string,
    voter: Address,
    choice: 'for' | 'against' | 'abstain',
    reason?: string,
  ): Promise<GrantApplication> {
    const app = await this.getApplication(daoId, appId);
    if (!app) {
      throw new Error(`Application not found: ${appId}`);
    }

    // Check voting period
    if (Date.now() > app.votingConfig.votingPeriodEnd) {
      throw new Error('Voting period has ended');
    }

    // Check if already voted
    if (app.votes.some((v) => v.voter.toLowerCase() === voter.toLowerCase())) {
      throw new Error(`Already voted by ${voter.slice(0, 10)}`);
    }

    const vote: GrantVote = {
      voter,
      choice,
      reason,
      timestamp: Date.now(),
    };

    app.votes.push(vote);

    // Update vote counts
    app.voteCounts.for = app.votes.filter((v) => v.choice === 'for').length;
    app.voteCounts.against = app.votes.filter((v) => v.choice === 'against').length;
    app.voteCounts.abstain = app.votes.filter((v) => v.choice === 'abstain').length;

    app.updatedAt = Date.now();

    // Store vote separately for audit
    await this.kv.put(grantVoteKey(daoId, appId, voter), JSON.stringify(vote), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.kv.put(grantApplicationKey(daoId, appId), JSON.stringify(app), {
      expirationTtl: DEFAULT_TTL,
    });

    return app;
  }

  // ─── Approve / Reject Application ─────────────────────────────────

  /**
   * Finalize an application (approve or reject) after voting period.
   * Approving deducts from program budget.
   */
  async finalizeApplication(
    daoId: string,
    appId: string,
    decision: 'approved' | 'rejected',
    finalizedBy: Address,
    reason?: string,
  ): Promise<GrantApplication> {
    const app = await this.getApplication(daoId, appId);
    if (!app) {
      throw new Error(`Application not found: ${appId}`);
    }

    if (app.status !== 'under_review' && app.status !== 'submitted') {
      throw new Error(`Application cannot be finalized (status: ${app.status})`);
    }

    app.status = decision as GrantApplicationStatus;
    app.updatedAt = Date.now();

    if (decision === 'approved') {
      app.status = 'approved';

      // Deduct from program budget
      const program = await this.getGrantProgram(daoId, app.programId);
      if (program) {
        const newRemaining = BigInt(program.remainingBudget) - BigInt(app.requestedAmount);
        program.remainingBudget = newRemaining.toString();
        await this.kv.put(grantProgramKey(daoId, app.programId), JSON.stringify(program), {
          expirationTtl: DEFAULT_TTL,
        });
      }
    }

    // Add resolution note as review
    if (reason) {
      app.reviews.push({
        reviewer: finalizedBy,
        comment: `[FINALIZED: ${decision}] ${reason}`,
        rating: decision === 'approved' ? 5 : 1,
        timestamp: Date.now(),
      });
    }

    await this.kv.put(grantApplicationKey(daoId, appId), JSON.stringify(app), {
      expirationTtl: DEFAULT_TTL,
    });

    log('info', '[grants] Application finalized', {
      daoId,
      appId,
      decision,
      finalizedBy: finalizedBy.slice(0, 10),
      amount: app.requestedAmount,
    });

    return app;
  }

  // ─── Milestone Management ─────────────────────────────────────────

  /**
   * Submit milestone completion with proof.
   */
  async submitMilestone(
    daoId: string,
    appId: string,
    milestoneId: string,
    proof: string,
  ): Promise<GrantApplication> {
    const app = await this.getApplication(daoId, appId);
    if (!app) {
      throw new Error(`Application not found: ${appId}`);
    }

    if (app.status !== 'approved' && app.status !== 'funded') {
      throw new Error(`Application must be approved to submit milestones (status: ${app.status})`);
    }

    const milestone = app.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }

    if (milestone.status !== 'pending') {
      throw new Error(`Milestone already ${milestone.status}`);
    }

    milestone.status = 'submitted';
    milestone.proof = proof;
    milestone.submittedAt = Date.now();
    app.updatedAt = Date.now();

    await this.kv.put(grantMilestoneKey(daoId, appId, milestoneId), JSON.stringify(milestone), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.kv.put(grantApplicationKey(daoId, appId), JSON.stringify(app), {
      expirationTtl: DEFAULT_TTL,
    });

    return app;
  }

  /**
   * Approve or reject a milestone submission.
   * On approval, marks for fund release.
   */
  async reviewMilestone(
    daoId: string,
    appId: string,
    milestoneId: string,
    approved: boolean,
    feedback: string,
    _reviewer: Address,
  ): Promise<GrantApplication> {
    const app = await this.getApplication(daoId, appId);
    if (!app) {
      throw new Error(`Application not found: ${appId}`);
    }

    const milestone = app.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }

    if (milestone.status !== 'submitted') {
      throw new Error(`Milestone is not submitted (status: ${milestone.status})`);
    }

    milestone.status = approved ? 'approved' : 'rejected';
    milestone.feedback = feedback;
    milestone.resolvedAt = Date.now();
    app.updatedAt = Date.now();

    await this.kv.put(grantMilestoneKey(daoId, appId, milestoneId), JSON.stringify(milestone), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.kv.put(grantApplicationKey(daoId, appId), JSON.stringify(app), {
      expirationTtl: DEFAULT_TTL,
    });

    // Update application status if all milestones approved
    if (approved) {
      const allApproved = app.milestones.every(
        (m) => m.status === 'approved' || m.id === milestoneId,
      );
      if (allApproved) {
        app.status = 'completed';
        await this.kv.put(grantApplicationKey(daoId, appId), JSON.stringify(app), {
          expirationTtl: DEFAULT_TTL,
        });

        log('info', '[grants] Grant completed', {
          daoId,
          appId,
          totalAmount: app.requestedAmount,
        });
      }
    }

    return app;
  }

  // ─── Analytics ────────────────────────────────────────────────────

  /**
   * Get comprehensive grant analytics for a DAO.
   */
  async getAnalytics(daoId: string): Promise<GrantAnalytics> {
    const programs = await this.listGrantPrograms(daoId);
    const { applications } = await this.listApplications(daoId, { limit: 500 });

    const totalApproved = applications.filter(
      (a) => a.status === 'approved' || a.status === 'funded' || a.status === 'completed',
    );
    const totalRejected = applications.filter((a) => a.status === 'rejected');
    const totalFunded = applications.filter(
      (a) => a.status === 'funded' || a.status === 'completed',
    );

    const totalDistributedWei = totalFunded.reduce((sum, a) => sum + BigInt(a.requestedAmount), 0n);
    const totalRequestedWei = applications.reduce((sum, a) => sum + BigInt(a.requestedAmount), 0n);

    // Grants by category
    const grantsByCategory = {
      development: 0,
      marketing: 0,
      community: 0,
      research: 0,
      other: 0,
    } as Record<GrantCategory, number>;

    for (const app of applications) {
      if (app.status === 'approved' || app.status === 'funded' || app.status === 'completed') {
        grantsByCategory[app.category] = (grantsByCategory[app.category] || 0) + 1;
      }
    }

    // Top grantees
    const granteeTotals = new Map<string, { total: bigint; count: number }>();
    for (const app of totalFunded) {
      const key = app.applicant.toLowerCase();
      const existing = granteeTotals.get(key) || { total: 0n, count: 0 };
      existing.total += BigInt(app.requestedAmount);
      existing.count++;
      granteeTotals.set(key, existing);
    }

    const topGrantees = Array.from(granteeTotals.entries())
      .map(([addr, data]) => ({
        applicant: addr as Address,
        totalReceived: data.total.toString(),
        count: data.count,
      }))
      .sort((a, b) => Number(BigInt(b.totalReceived) - BigInt(a.totalReceived)))
      .slice(0, 10);

    const decided = totalApproved.length + totalRejected.length;

    const analytics: GrantAnalytics = {
      daoId,
      totalPrograms: programs.length,
      activePrograms: programs.filter((p) => p.active).length,
      totalApplications: applications.length,
      totalApproved: totalApproved.length,
      totalRejected: totalRejected.length,
      totalDistributed: totalDistributedWei.toString(),
      totalRequested: totalRequestedWei.toString(),
      grantsByCategory,
      successRate: decided > 0 ? totalApproved.length / decided : 0,
      topGrantees,
      averageGrantSize:
        totalApproved.length > 0
          ? (totalDistributedWei / BigInt(totalApproved.length)).toString()
          : '0',
      lastUpdated: Date.now(),
    };

    // Cache analytics
    await this.kv.put(grantAnalyticsKey(daoId), JSON.stringify(analytics), { expirationTtl: 3600 });

    return analytics;
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  #validateBudget(totalBudget: string, maxPerGrant: string, _decimals: number): void {
    const total = BigInt(totalBudget);
    const max = BigInt(maxPerGrant);

    if (total <= 0n) {
      throw new Error('Total budget must be greater than 0');
    }
    if (max <= 0n) {
      throw new Error('Max per grant must be greater than 0');
    }
    if (max > total) {
      throw new Error('Max per grant cannot exceed total budget');
    }
  }

  async #addToProgramIndex(daoId: string, programId: string): Promise<void> {
    const key = grantProgramIndexKey(daoId);
    const existing = await this.kv.get(key);
    const index: string[] = existing ? JSON.parse(existing) : [];
    index.unshift(programId);
    await this.kv.put(key, JSON.stringify(index), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #getProgramIndex(daoId: string): Promise<string[]> {
    try {
      const raw = await this.kv.get(grantProgramIndexKey(daoId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  async #addToApplicationIndex(daoId: string, appId: string): Promise<void> {
    const key = grantApplicationIndexKey(daoId);
    const existing = await this.kv.get(key);
    const index: string[] = existing ? JSON.parse(existing) : [];
    index.unshift(appId);
    await this.kv.put(key, JSON.stringify(index), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #getApplicationIndex(daoId: string): Promise<string[]> {
    try {
      const raw = await this.kv.get(grantApplicationIndexKey(daoId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  #matchesFilter(app: GrantApplication, filter?: GrantFilter): boolean {
    if (!filter) return true;

    if (filter.status && app.status !== filter.status) return false;
    if (filter.category && app.category !== filter.category) return false;
    if (filter.applicant && app.applicant.toLowerCase() !== filter.applicant.toLowerCase()) {
      return false;
    }
    if (filter.programId && app.programId !== filter.programId) return false;

    return true;
  }
}

// ─── Standalone helpers ───────────────────────────────────────────────────

/**
 * Get a human-readable status label for grant applications.
 */
export function getApplicationStatusLabel(status: GrantApplicationStatus): string {
  const labels: Record<GrantApplicationStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    funded: 'Funded',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}

/**
 * Get a color for the application status (CSS variable name).
 */
export function getApplicationStatusColor(status: GrantApplicationStatus): string {
  const colors: Record<GrantApplicationStatus, string> = {
    draft: 'var(--color-muted)',
    submitted: 'var(--color-accent)',
    under_review: 'var(--color-accent-secondary)',
    approved: 'var(--color-success)',
    rejected: 'var(--color-error)',
    funded: 'var(--color-success)',
    completed: 'var(--color-success)',
    cancelled: 'var(--color-muted)',
  };
  return colors[status] ?? 'var(--color-muted)';
}

/**
 * Calculate milestone completion percentage.
 */
export function getMilestoneProgress(milestones: GrantMilestone[]): number {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter(
    (m) => m.status === 'approved' || m.status === 'submitted',
  ).length;
  return Math.round((completed / milestones.length) * 100);
}

/**
 * DegenFeed DAO Framework — Unified Client
 *
 * High-level client for DAO operations.
 * Wraps Snapshot integration + DAO factory + treasury tracking.
 */

import { type DAOFactory, getDAOFactory } from './factory';
import { SnapshotClient } from './snapshot';
import { getTemplate } from './templates';
import { TreasuryTracker } from './treasury';
import type {
  DAOClientConfig,
  DAOCreationInput,
  DAOState,
  DAOTemplateType,
  Proposal,
  Vote,
  VotingConfig,
  VotingType,
} from './types';

export class DAOClient {
  public factory: DAOFactory;
  public snapshot: SnapshotClient;
  public treasury: TreasuryTracker;
  private config: DAOClientConfig;

  constructor(config: DAOClientConfig = {}) {
    this.config = config;
    this.snapshot = new SnapshotClient({
      hubUrl: config.snapshotHubUrl,
      sequencerUrl: config.snapshotSequencerUrl,
    });
    this.factory = getDAOFactory({ kv: config.kv });
    this.treasury = new TreasuryTracker(config.baseRpcUrl);
  }

  // ─── DAO Lifecycle ────────────────────────────────────────────────────────

  /**
   * Register a new DAO at coin creation time.
   * User picks a template, and the DAO is registered in pending state.
   */
  async createDAO(input: DAOCreationInput): Promise<DAOState> {
    return this.factory.registerDAO(input);
  }

  /**
   * Get a DAO by its ID.
   */
  async getDAO(id: string): Promise<DAOState | null> {
    return this.factory.getDAO(id);
  }

  /**
   * Get DAO by coin address.
   */
  async getDAOByCoin(coinAddress: string): Promise<DAOState | null> {
    return this.factory.getDAOByCoin(coinAddress);
  }

  // ─── Proposals ────────────────────────────────────────────────────────────

  /**
   * Get proposals for a DAO's Snapshot space.
   */
  async getProposals(
    spaceId: string,
    options?: { first?: number; skip?: number; state?: string },
  ): Promise<Proposal[]> {
    return this.snapshot.getProposals(spaceId, options);
  }

  /**
   * Get a single proposal by ID.
   */
  async getProposal(id: string): Promise<Proposal | null> {
    return this.snapshot.getProposal(id);
  }

  /**
   * Get votes for a proposal.
   */
  async getVotes(proposalId: string, options?: { first?: number; skip?: number }): Promise<Vote[]> {
    return this.snapshot.getVotes(proposalId, options);
  }

  /**
   * Build a proposal payload for signing.
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
  ) {
    return this.snapshot.buildProposalPayload(
      space,
      title,
      body,
      choices,
      start,
      end,
      type,
      snapshotBlock,
    );
  }

  /**
   * Build a vote payload for signing.
   */
  buildVotePayload(
    space: string,
    proposal: string,
    type: VotingType,
    choice: number | number[] | Record<number, number>,
    reason?: string,
  ) {
    return this.snapshot.buildVotePayload(space, proposal, type, choice, { reason });
  }

  // ─── Voting Power ─────────────────────────────────────────────────────────

  /**
   * Get voting power for a user in a space.
   */
  async getVotingPower(space: string, voter: string): Promise<number> {
    try {
      const result = await this.snapshot.getUserVotingPower(space, voter);
      return result.vp;
    } catch {
      return 0;
    }
  }

  // ─── Treasury ─────────────────────────────────────────────────────────────

  /**
   * Get treasury balance for a DAO.
   */
  async getTreasuryBalance(dao: DAOState): Promise<{ balance: string; usd: number }> {
    return this.treasury.getBalance(dao);
  }

  /**
   * Get treasury transaction history.
   */
  async getTreasuryTransactions(dao: DAOState, limit?: number): Promise<any[]> {
    return this.treasury.getTransactions(dao, limit);
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  /**
   * Get all available DAO templates.
   */
  getTemplates() {
    const { DAO_TEMPLATES } = require('./templates');
    return Object.values(DAO_TEMPLATES);
  }

  /**
   * Get a specific template.
   */
  getTemplate(type: DAOTemplateType) {
    return getTemplate(type);
  }

  // ─── Snapshot Space ───────────────────────────────────────────────────────

  /**
   * Get a Snapshot space by its ID.
   */
  async getSnapshotSpace(spaceId: string) {
    return this.snapshot.getSpace(spaceId);
  }

  /**
   * Send a signed envelope to the Snapshot sequencer.
   */
  async sendToSequencer(envelope: any): Promise<{ id: string }> {
    return this.snapshot.send(envelope);
  }
}

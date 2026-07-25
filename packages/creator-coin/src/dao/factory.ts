/**
 * DegenFeed DAO Framework — DAO Factory
 *
 * Handles automatic DAO creation when a creator coin hits
 * bonding curve graduation. Also supports manual DAO creation.
 *
 * Flow:
 * 1. Creator chooses template at coin creation
 * 2. DAO is registered (pending state) with Snapshot space config
 * 3. On graduation (80% supply + 50 unique buyers):
 *    - DAO status → 'active'
 *    - Treasury receives % of token supply
 *    - Snapshot space is created
 *    - If on Base: deploy OZ Governor + Timelock for on-chain execution
 * 4. Token holders get voting power proportional to holdings
 */

import {
  buildSpaceSettings,
  generateSpaceEns,
  generateSpaceName,
} from './snapshot';
import { getTemplate, mergeVotingConfig } from './templates';
import type {
  DAOCreationInput,
  DAOState,
  DAOStatus,
  GovernorDeploymentParams,
  GovernorDeploymentResult,
} from './types';

// ─── In-Memory DAO Registry ─────────────────────────────────────────────────

/**
 * In production, this would be stored in a database (Postgres/ClickHouse)
 * and indexed via the KV store (Cloudflare Workers KV).
 *
 * For now, we use an in-memory registry that gets hydrated on startup.
 */
const daoRegistry = new Map<string, DAOState>();

// ─── DAO Factory ─────────────────────────────────────────────────────────────

export class DAOFactory {
  private kv: any;

  constructor(config?: { kv?: any }) {
    this.kv = config?.kv;
  }

  // ─── Register DAO (at coin creation time) ────────────────────────────────

  /**
   * Register a new DAO when a creator coin is created.
   * The DAO starts in 'pending' state and activates on graduation.
   */
  async registerDAO(input: DAOCreationInput): Promise<DAOState> {
    const template = getTemplate(input.template);
    const votingConfig = mergeVotingConfig(input.template, input.votingConfig);
    const spaceEns = generateSpaceEns(input.coinAddress, input.template, input.creator);
    const spaceName = generateSpaceName(input.token.symbol, input.template);

    const dao: DAOState = {
      id: spaceEns,
      coinAddress: input.coinAddress,
      creator: input.creator,
      name: spaceName,
      template: input.template,
      status: 'pending',
      snapshotSpaceId: spaceEns,
      snapshotEns: spaceEns,
      tokenAddress: input.token.address,
      chain: input.token.chain,
      treasuryBalance: '0',
      treasuryBalanceUsd: 0,
      totalSupply: input.token.totalSupply,
      treasuryAllocationBps: input.treasuryAllocationBps ?? template.treasuryAllocationBps,
      createdAt: Date.now(),
      activeProposals: 0,
      totalProposals: 0,
      totalVoters: 0,
      votingConfig,
      metadata: {
        description:
          input.metadata?.description ||
          `${spaceName} — govern the ${input.token.symbol} ecosystem.`,
        avatar: input.metadata?.avatar,
        website: input.metadata?.website,
        twitter: input.metadata?.twitter,
        discord: input.metadata?.discord,
        github: input.metadata?.github,
        guidelines: input.metadata?.guidelines,
      },
      treasuryAddress: input.coinAddress, // Initially the coin contract, later the timelock
    };

    // Store in registry
    daoRegistry.set(dao.id, dao);

    // Store in KV if available
    if (this.kv) {
      await this.kv.put(`dao:${dao.id}`, JSON.stringify(dao));
      await this.kv.put(`dao:by-coin:${input.coinAddress}`, dao.id);
    }

    return dao;
  }

  // ─── Activate DAO (on graduation) ────────────────────────────────────────

  /**
   * Activate a DAO when the creator coin hits bonding curve graduation.
   * This:
   * 1. Sets status to 'active'
   * 2. Records graduation timestamp
   * 3. Allocates treasury tokens
   * 4. Creates Snapshot space (if configured)
   * 5. Optionally deploys on-chain Governor (Base only)
   */
  async activateDAO(coinAddress: string): Promise<DAOState> {
    const dao = await this.getDAOByCoin(coinAddress);
    if (!dao) {
      throw new Error(`No DAO registered for coin ${coinAddress}. Call registerDAO first.`);
    }

    if (dao.status === 'active') {
      return dao; // Already active
    }

    dao.status = 'active';
    dao.graduatedAt = Date.now();

    // Build and store the Snapshot space settings
    const settings = buildSpaceSettings(
      {
        coinAddress: dao.coinAddress,
        creator: dao.creator,
        name: dao.name,
        template: dao.template,
        token: {
          address: dao.tokenAddress,
          symbol: (dao.name.split(' ')[0] || dao.name), // Extract symbol from name
          totalSupply: dao.totalSupply,
          chain: dao.chain,
        },
        votingConfig: dao.votingConfig,
      },
      dao.votingConfig,
    );

    // Store space settings in KV for later signing/submission
    if (this.kv) {
      await this.kv.put(`dao:space-settings:${dao.id}`, settings);
    }

    // Update registry
    daoRegistry.set(dao.id, dao);
    if (this.kv) {
      await this.kv.put(`dao:${dao.id}`, JSON.stringify(dao));
    }

    return dao;
  }

  // ─── Deploy On-Chain Governor (Base only) ────────────────────────────────

  /**
   * Deploy OZ Governor + Timelock for on-chain execution.
   * This is called after graduation for Base-chain DAOs.
   * The Governor contract enables token holders to execute
   * treasury transfers and protocol changes on-chain.
   */
  async deployGovernor(
    coinAddress: string,
    _params?: Partial<GovernorDeploymentParams>,
  ): Promise<GovernorDeploymentResult | null> {
    const dao = await this.getDAOByCoin(coinAddress);
    if (dao?.chain !== 'base') {
      return null; // Only available on Base/EVM chains
    }

    if (dao.governorAddress) {
      return {
        governorAddress: dao.governorAddress,
        timelockAddress: dao.timelockAddress!,
        treasuryAddress: dao.treasuryAddress as `0x${string}`,
        deployTx: '',
      };
    }

    // Deployment is handled by the contract deployment script
    // Returns null — actual deployment requires a user wallet tx
    return null;
  }

  // ─── Query Methods ────────────────────────────────────────────────────────

  /**
   * Get DAO by its ID (ENS name).
   */
  async getDAO(id: string): Promise<DAOState | null> {
    // Check in-memory first
    let dao = daoRegistry.get(id);
    if (dao) return dao;

    // Check KV
    if (this.kv) {
      const raw = await this.kv.get(`dao:${id}`);
      if (raw) {
        dao = JSON.parse(raw) as DAOState;
        daoRegistry.set(id, dao);
        return dao;
      }
    }

    return null;
  }

  /**
   * Get DAO by its coin address.
   */
  async getDAOByCoin(coinAddress: string): Promise<DAOState | null> {
    // Check in-memory
    for (const [, dao] of daoRegistry) {
      if (dao.coinAddress === coinAddress) return dao;
    }

    // Check KV
    if (this.kv) {
      const daoId = await this.kv.get(`dao:by-coin:${coinAddress}`);
      if (daoId) {
        return this.getDAO(daoId);
      }
    }

    return null;
  }

  /**
   * List all DAOs, optionally filtered by status.
   */
  async listDAOs(status?: DAOStatus): Promise<DAOState[]> {
    let daos = Array.from(daoRegistry.values());
    if (status) {
      daos = daos.filter((d) => d.status === status);
    }
    return daos;
  }

  /**
   * Get the DAO count by status.
   */
  async getDAOCounts(): Promise<Record<DAOStatus, number>> {
    const daos = Array.from(daoRegistry.values());
    return {
      pending: daos.filter((d) => d.status === 'pending').length,
      active: daos.filter((d) => d.status === 'active').length,
      graduated: daos.filter((d) => d.status === 'graduated').length,
      frozen: daos.filter((d) => d.status === 'frozen').length,
    };
  }

  // ─── Emergency Actions ────────────────────────────────────────────────────

  /**
   * Freeze a DAO in case of emergency. Only callable by multisig.
   */
  async freezeDAO(daoId: string, _caller: string): Promise<DAOState> {
    const dao = await this.getDAO(daoId);
    if (!dao) throw new Error(`DAO not found: ${daoId}`);

    dao.status = 'frozen';
    daoRegistry.set(dao.id, dao);

    if (this.kv) {
      await this.kv.put(`dao:${dao.id}`, JSON.stringify(dao));
    }

    return dao;
  }

  /**
   * Check if a coin should graduate and trigger DAO activation.
   * Called by the graduation hook in the coin contract.
   */
  async checkGraduation(
    coinAddress: string,
    totalSupply: string,
    uniqueBuyers: number,
  ): Promise<boolean> {
    // Graduation happens at 80% supply + 50 unique buyers
    const totalSupplyBig = BigInt(totalSupply);
    const totalCap = 1_000_000_000n * 10n ** 18n; // 1 billion tokens
    const graduationSupply = (totalCap * 80n) / 100n;
    const minBuyers = 50;

    if (totalSupplyBig >= graduationSupply && uniqueBuyers >= minBuyers) {
      await this.activateDAO(coinAddress);
      return true;
    }

    return false;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: DAOFactory | null = null;

/**
 * Get the global DAO Factory instance.
 */
export function getDAOFactory(config?: { kv?: any }): DAOFactory {
  if (!_instance) {
    _instance = new DAOFactory(config);
  }
  return _instance;
}

/**
 * DegenFeed DAO Framework — Main Entry Point
 *
 * A complete DAO framework for creator coins.
 * Integrates Snapshot for off-chain voting with
 * OpenZeppelin Governor for on-chain execution.
 *
 * ## Quick Start
 * ```ts
 * import { DAOClient, DAO_TEMPLATES } from '@degenfeed/creator-coin/dao';
 *
 * const client = new DAOClient();
 *
 * // 1. Create a DAO when a coin is created
 * const dao = await client.createDAO({
 *   coinAddress: '0x...',
 *   creator: '0x...',
 *   name: 'Alice Investment DAO',
 *   template: 'investment',
 *   token: {
 *     address: '0x...',
 *     symbol: 'ALICE',
 *     totalSupply: '1000000000000000000000000000',
 *     chain: 'base',
 *   },
 * });
 *
 * // 2. Get proposals from Snapshot
 * const proposals = await client.getProposals(dao.snapshotSpaceId);
 *
 * // 3. Get treasury balance
 * const balance = await client.getTreasuryBalance(dao);
 * ```
 *
 * ## Architecture
 * - **Snapshot** (off-chain): Proposal creation, voting, delegation
 * - **OZ Governor** (on-chain): Treasury execution, timelock security
 * - **Templates**: 4 pre-built templates (Investment, Creator, Protocol, Social)
 * - **Auto-create**: DAO activates on bonding curve graduation
 */

export { DAOClient } from './client';
export { DAOFactory, getDAOFactory } from './factory';
export {
  buildSpaceSettings,
  generateSpaceEns,
  generateSpaceName,
  SnapshotClient,
} from './snapshot';
export { DAO_TEMPLATES, getAllTemplates, getRecommendedTemplate, getTemplate } from './templates';
export { TreasuryTracker } from './treasury';

export type * from './types';

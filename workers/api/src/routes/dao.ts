/**
 * @degenfeed/api-worker — DAO Routes (barrel)
 *
 * Thin re-export barrel. Implementation lives in sibling modules:
 *   - dao-core.ts           (types, helpers, CRUD handlers)
 *   - dao-types.ts          (shared types)
 *   - dao-proposals.ts      (proposal + voting handlers)
 *   - dao-delegation.ts     (delegation handlers)
 *   - dao-membership.ts     (join, leave, members list)
 *   - dao-treasury-inline.ts (treasury handlers from original dao.ts)
 *
 * All exports are backward-compatible. app.ts imports from './routes/dao'
 * continue to work unchanged.
 */

export {
  handleDaoCreate,
  handleDaoDiscover,
  handleDaoGet,
  handleDaoMine,
  handleDaoStats,
  handleDaoUpdate,
} from './dao-core';
export {
  handleDaoDelegate,
  handleDaoDelegatesTop,
  handleDaoDelegationMine,
  handleDaoDelegationStatus,
  handleDaoRevokeDelegation,
} from './dao-delegation';
export {
  handleDaoJoin,
  handleDaoLeave,
  handleDaoMemberGet,
  handleDaoMembersList,
} from './dao-membership';
export {
  handleDaoProposalCreate,
  handleDaoProposalDelete,
  handleDaoProposalExecute,
  handleDaoProposalGet,
  handleDaoProposalMyVote,
  handleDaoProposalQueue,
  handleDaoProposalsList,
  handleDaoProposalUpdate,
  handleDaoProposalVote,
  handleDaoProposalVotes,
} from './dao-proposals';
export {
  handleDaoTreasuryGrantCreate,
  handleDaoTreasuryGrantMilestone,
  handleDaoTreasuryGrants,
  handleDaoTreasuryOverview,
  handleDaoTreasuryStreamCreate,
  handleDaoTreasuryStreamDelete,
  handleDaoTreasuryStreams,
  handleDaoTreasuryTransactions,
  handleDaoTreasuryTransfer,
} from './dao-treasury-inline';
export type {
  ActivityType,
  Dao,
  DaoVisibility,
  Delegation,
  GrantProgram,
  Proposal,
  ProposalStatus,
  TreasuryOverview,
  TreasuryStream,
  TreasuryTransaction,
  VoteChoice,
  VoteRecord,
} from './dao-types';

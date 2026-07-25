/**
 * @degenfeed/api-worker — DAO Routes (barrel)
 *
 * Thin re-export barrel. Implementation lives in sibling modules:
 *   - dao-crud.ts           (types, helpers, CRUD handlers)
 *   - dao-proposals.ts      (proposal handlers)
 *   - dao-delegation.ts     (delegation handlers)
 *   - dao-treasury-inline.ts (treasury handlers from original dao.ts)
 *
 * All exports are backward-compatible. app.ts imports from './routes/dao'
 * continue to work unchanged.
 */

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
} from './dao-crud';

export {
  handleDaoCreate,
  handleDaoDiscover,
  handleDaoGet,
  handleDaoJoin,
  handleDaoLeave,
  handleDaoMine,
  handleDaoStats,
  handleDaoUpdate,
} from './dao-crud';
export {
  handleDaoDelegate,
  handleDaoDelegatesTop,
  handleDaoDelegationMine,
  handleDaoDelegationStatus,
  handleDaoRevokeDelegation,
} from './dao-delegation';
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

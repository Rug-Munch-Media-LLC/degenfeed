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
  Dao, DaoVisibility, Proposal, ProposalStatus, VoteChoice, VoteRecord,
  Delegation, TreasuryOverview, TreasuryTransaction, TreasuryStream,
  GrantProgram, ActivityType,
} from './dao-crud';

export {
  handleDaoCreate, handleDaoGet, handleDaoUpdate, handleDaoMine,
  handleDaoDiscover, handleDaoStats, handleDaoJoin, handleDaoLeave,
} from './dao-crud';

export {
  handleDaoProposalCreate, handleDaoProposalsList, handleDaoProposalGet,
  handleDaoProposalUpdate, handleDaoProposalDelete, handleDaoProposalVote,
  handleDaoProposalVotes, handleDaoProposalMyVote, handleDaoProposalQueue,
  handleDaoProposalExecute,
} from './dao-proposals';

export {
  handleDaoDelegate, handleDaoRevokeDelegation, handleDaoDelegationMine,
  handleDaoDelegationStatus, handleDaoDelegatesTop,
} from './dao-delegation';

export {
  handleDaoTreasuryOverview, handleDaoTreasuryTransactions,
  handleDaoTreasuryTransfer, handleDaoTreasuryStreamCreate,
  handleDaoTreasuryStreams, handleDaoTreasuryStreamDelete,
  handleDaoTreasuryGrantCreate, handleDaoTreasuryGrants,
  handleDaoTreasuryGrantMilestone,
} from './dao-treasury-inline';

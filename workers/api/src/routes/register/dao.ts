/**
 * @degenfeed/api-worker - Dao route registration
 *
 * Register Dao-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';

import {
  handleDaoRegistryGet,
  handleDaoRegistryLink,
  handleDaoRegistryList,
  handleDaoRegistryRegister,
  handleDaoRegistryVerify,
} from '../../lib/dao-registry';
import {
  handleDefenderDisable,
  handleDefenderSetup,
  handleDefenderStatus,
  handleDefenderSync,
} from '../../lib/defender-integration';
import {
  handleDelegationSync,
  handleSnapshotImportVotes,
  handleSnapshotStrategyGenerate,
  handleSnapshotSyncProposal,
} from '../../lib/snapshot-integration';
import {
  handleTallyCompatibilityCheck,
  handleTallyRegister,
  handleTallyStatus,
} from '../../lib/tally-integration';
import {
  handleDaoCreate,
  handleDaoDelegate,
  handleDaoDelegatesTop,
  handleDaoDelegationMine,
  handleDaoDelegationStatus,
  handleDaoDiscover,
  handleDaoGet,
  handleDaoJoin,
  handleDaoLeave,
  handleDaoMine,
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
  handleDaoRevokeDelegation,
  handleDaoStats,
  handleDaoTreasuryGrantMilestone,
  handleDaoTreasuryGrants,
  handleDaoTreasuryOverview,
  handleDaoTreasuryStreamDelete,
  handleDaoTreasuryStreams,
  handleDaoTreasuryTransactions,
  handleDaoTreasuryTransfer,
  handleDaoUpdate,
} from '../../routes/dao';
import { handleDaoActivity, handleMyDaoActivity } from '../../routes/dao-activity';
import {
  handleGrantAnalytics,
  handleGrantApply,
  handleGrantCreateProgram,
  handleGrantFinalize,
  handleGrantListApplications,
  handleGrantListPrograms,
  handleGrantReview,
  handleGrantSubmitMilestone,
  handleGrantVote,
  handleInvestmentCreateProposal,
  handleInvestmentListProposals,
  handleInvestmentPerformance,
  handleInvestmentPortfolio,
  handleInvestmentVote,
  handleInvestmentYields,
  handleMultisigCancel,
  handleMultisigConfig,
  handleMultisigExecute,
  handleMultisigList,
  handleMultisigPropose,
  handleMultisigSaveConfig,
  handleMultisigSign,
  handleStreamAnalytics,
  handleStreamCancel,
  handleStreamCreate,
  handleStreamGet,
  handleStreamHistory,
  handleStreamList,
  handleStreamModify,
  handleStreamPause,
  handleStreamResume,
  handleTreasuryAnalytics,
} from '../../routes/dao-treasury';
import { withSession } from '../../routes/route-registry';

export function registerDaoRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: DAO Activity Feed, Notifications & Subscribe ---
  app.get('/api/dao/:daoId/feed', async (c) => {
    const { handleDaoActivity } = await import('../../routes/dao-activity');
    return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
  });
  app.post('/api/dao/:daoId/activity', async (c) => {
    const { handleDaoActivity } = await import('../../routes/dao-activity');
    return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
  });
  app.get('/api/dao/:daoId/realtime', async (c) => {
    const { handleDaoActivity } = await import('../../routes/dao-activity');
    return jsonResponse({ poll: true, daoId: c.req.param('daoId') });
  });
  app.get('/api/dao/:daoId/notifications', async (c) => {
    const { handleDaoActivity } = await import('../../routes/dao-activity');
    return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
  });
  app.post('/api/dao/:daoId/notifications/read', async (_c) => {
    return jsonResponse({ ok: true });
  });
  app.post('/api/dao/:daoId/subscribe', async (_c) => {
    return jsonResponse({ ok: true });
  });
  app.get('/api/dao/:daoId/subscribe/status', async (_c) => {
    return jsonResponse({ subscribed: false });
  });

  // --- API: DAO System ---
  app.get('/api/dao/mine', async (c) => handleDaoMine(c.req.raw, c.env));
  app.get('/api/dao/discover', async (c) => handleDaoDiscover(c.req.raw, c.env));
  app.get('/api/dao/activity/mine', async (c) => handleMyDaoActivity(c.req.raw, c.env));
  app.post('/api/dao/create', async (c) => withSession(c, () => handleDaoCreate(c.req.raw, c.env)));
  app.get('/api/dao/:daoId', async (c) => handleDaoGet(c.req.raw, c.env, c.req.param('daoId')));
  app.put('/api/dao/:daoId', async (c) =>
    withSession(c, () => handleDaoUpdate(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/stats', async (c) =>
    handleDaoStats(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.post('/api/dao/:daoId/join', async (c) =>
    withSession(c, () => handleDaoJoin(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.post('/api/dao/:daoId/leave', async (c) =>
    withSession(c, () => handleDaoLeave(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/activity', async (c) =>
    handleDaoActivity(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.post('/api/dao/:daoId/proposals', async (c) =>
    withSession(c, () => handleDaoProposalCreate(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/proposals', async (c) =>
    handleDaoProposalsList(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.get('/api/dao/:daoId/proposals/:proposalId', async (c) =>
    handleDaoProposalGet(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  );
  app.put('/api/dao/:daoId/proposals/:proposalId', async (c) =>
    withSession(c, () =>
      handleDaoProposalUpdate(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
    ),
  );
  app.delete('/api/dao/:daoId/proposals/:proposalId', async (c) =>
    withSession(c, () =>
      handleDaoProposalDelete(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
    ),
  );
  app.post('/api/dao/:daoId/proposals/:proposalId/vote', async (c) =>
    withSession(c, () =>
      handleDaoProposalVote(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
    ),
  );
  app.get('/api/dao/:daoId/proposals/:proposalId/votes', async (c) =>
    handleDaoProposalVotes(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  );
  app.get('/api/dao/:daoId/proposals/:proposalId/vote/me', async (c) =>
    handleDaoProposalMyVote(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  );
  app.post('/api/dao/:daoId/proposals/:proposalId/queue', async (c) =>
    withSession(c, () =>
      handleDaoProposalQueue(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
    ),
  );
  app.post('/api/dao/:daoId/proposals/:proposalId/execute', async (c) =>
    withSession(c, () =>
      handleDaoProposalExecute(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
    ),
  );
  app.post('/api/dao/:daoId/delegate', async (c) =>
    withSession(c, () => handleDaoDelegate(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.post('/api/dao/:daoId/revoke-delegation', async (c) =>
    withSession(c, () => handleDaoRevokeDelegation(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/delegation/mine', async (c) =>
    handleDaoDelegationMine(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.get('/api/dao/:daoId/delegation/:address', async (c) =>
    handleDaoDelegationStatus(c.req.raw, c.env, c.req.param('daoId'), c.req.param('address')),
  );
  app.get('/api/dao/:daoId/delegates', async (c) =>
    handleDaoDelegatesTop(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.get('/api/dao/:daoId/treasury', async (c) =>
    handleDaoTreasuryOverview(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.get('/api/dao/:daoId/treasury/transactions', async (c) =>
    handleDaoTreasuryTransactions(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.post('/api/dao/:daoId/treasury/transfer', async (c) =>
    withSession(c, () => handleDaoTreasuryTransfer(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/treasury/streams', async (c) =>
    handleDaoTreasuryStreams(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.delete('/api/dao/:daoId/treasury/streams/:streamId', async (c) =>
    withSession(c, () =>
      handleDaoTreasuryStreamDelete(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('streamId'),
      ),
    ),
  );
  app.get('/api/dao/:daoId/treasury/grants', async (c) =>
    handleDaoTreasuryGrants(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.post('/api/dao/:daoId/treasury/grant/:grantId/milestone', async (c) =>
    withSession(c, () =>
      handleDaoTreasuryGrantMilestone(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('grantId'),
      ),
    ),
  );

  // --- API: DAO Registry (static before parameterized) ---
  app.get('/api/dao/registry', async (c) => handleDaoRegistryList(c.req.raw, c.env));
  app.post('/api/dao/registry', async (c) =>
    withSession(c, () => handleDaoRegistryRegister(c.req.raw, c.env)),
  );

  // --- API: External DAO Integrations — Snapshot ---
  app.post('/api/dao/:daoId/snapshot/strategy', async (c) =>
    withSession(c, () => handleSnapshotStrategyGenerate(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.post('/api/dao/:daoId/snapshot/sync-proposal', async (c) =>
    withSession(c, () => handleSnapshotSyncProposal(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/snapshot/votes/:proposalId', async (c) =>
    handleSnapshotImportVotes(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
  );
  app.post('/api/dao/:daoId/snapshot/delegation-sync', async (c) =>
    withSession(c, () => handleDelegationSync(c.req.raw, c.env, c.req.param('daoId'))),
  );

  // --- API: External DAO Integrations — Tally ---
  app.post('/api/dao/:daoId/tally/check', async (c) =>
    withSession(c, () => handleTallyCompatibilityCheck(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.post('/api/dao/:daoId/tally/register', async (c) =>
    withSession(c, () => handleTallyRegister(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/tally/status', async (c) =>
    handleTallyStatus(c.req.raw, c.env, c.req.param('daoId')),
  );

  // --- API: External DAO Integrations — Defender ---
  app.post('/api/dao/:daoId/defender/setup', async (c) =>
    withSession(c, () => handleDefenderSetup(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.get('/api/dao/:daoId/defender/status', async (c) =>
    handleDefenderStatus(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.post('/api/dao/:daoId/defender/sync', async (c) =>
    withSession(c, () => handleDefenderSync(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.delete('/api/dao/:daoId/defender', async (c) =>
    withSession(c, () => handleDefenderDisable(c.req.raw, c.env, c.req.param('daoId'))),
  );

  // --- API: DAO Registry — Entry detail ---
  app.get('/api/dao/registry/:daoId', async (c) =>
    handleDaoRegistryGet(c.req.raw, c.env, c.req.param('daoId')),
  );
  app.post('/api/dao/registry/:daoId/link', async (c) =>
    withSession(c, () => handleDaoRegistryLink(c.req.raw, c.env, c.req.param('daoId'))),
  );
  app.post('/api/dao/registry/:daoId/verify', async (c) =>
    withSession(c, () => handleDaoRegistryVerify(c.req.raw, c.env, c.req.param('daoId'))),
  );

  // --- API: DAO Treasury ---
  app.get('/api/dao/:daoId/treasury/multisig', async (c) => handleMultisigList(c.req.raw, c.env));
  app.get('/api/dao/:daoId/treasury/multisig/config', async (c) =>
    handleMultisigConfig(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/multisig/config', async (c) =>
    handleMultisigSaveConfig(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/multisig/propose', async (c) =>
    handleMultisigPropose(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/multisig/:txId/sign', async (c) =>
    handleMultisigSign(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/multisig/:txId/execute', async (c) =>
    handleMultisigExecute(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/multisig/:txId/cancel', async (c) =>
    handleMultisigCancel(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/stream', async (c) => handleStreamList(c.req.raw, c.env));
  app.post('/api/dao/:daoId/treasury/stream', async (c) =>
    withSession(c, () => handleStreamCreate(c.req.raw, c.env)),
  );
  app.get('/api/dao/:daoId/treasury/stream/analytics', async (c) =>
    handleStreamAnalytics(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/stream/:streamId', async (c) =>
    handleStreamGet(c.req.raw, c.env),
  );
  app.put('/api/dao/:daoId/treasury/stream/:streamId', async (c) =>
    handleStreamModify(c.req.raw, c.env),
  );
  app.delete('/api/dao/:daoId/treasury/stream/:streamId', async (c) =>
    handleStreamCancel(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/stream/:streamId/pause', async (c) =>
    handleStreamPause(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/stream/:streamId/resume', async (c) =>
    handleStreamResume(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/stream/:streamId/history', async (c) =>
    handleStreamHistory(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/grant', async (c) => handleGrantListPrograms(c.req.raw, c.env));
  app.post('/api/dao/:daoId/treasury/grant', async (c) =>
    withSession(c, () => handleGrantCreateProgram(c.req.raw, c.env)),
  );
  app.get('/api/dao/:daoId/treasury/grant/applications', async (c) =>
    handleGrantListApplications(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/grant/analytics', async (c) =>
    handleGrantAnalytics(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/grant/:grantId/apply', async (c) =>
    handleGrantApply(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/review', async (c) =>
    handleGrantReview(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/vote', async (c) =>
    handleGrantVote(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/finalize', async (c) =>
    handleGrantFinalize(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/milestone/:milestoneId/submit', async (c) =>
    handleGrantSubmitMilestone(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/investment/portfolio', async (c) =>
    handleInvestmentPortfolio(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/investment/yields', async (c) =>
    handleInvestmentYields(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/investment/performance', async (c) =>
    handleInvestmentPerformance(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/investment/proposal', async (c) =>
    handleInvestmentCreateProposal(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/investment/proposals', async (c) =>
    handleInvestmentListProposals(c.req.raw, c.env),
  );
  app.post('/api/dao/:daoId/treasury/investment/proposal/:proposalId/vote', async (c) =>
    handleInvestmentVote(c.req.raw, c.env),
  );
  app.get('/api/dao/:daoId/treasury/analytics', async (c) =>
    handleTreasuryAnalytics(c.req.raw, c.env),
  );
}

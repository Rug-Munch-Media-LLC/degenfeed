/**
 * @degenfeed/api-worker - Dao route registration
 *
 * Register Dao-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
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
import { jsonResponse, ok, serverError } from '../../response-helpers';
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
  handleDaoMemberGet,
  handleDaoMembersList,
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
import type { Env } from '../../types';
export function registerDaoRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: DAO Activity Feed, Notifications & Subscribe ---
  app.get('/api/dao/:daoId/feed', async (c) => {
    try {
      return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/activity', async (c) => {
    const { handleDaoActivity } = await import('../../routes/dao-activity');
    return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
  });
  app.get('/api/dao/:daoId/realtime', async (c) => {
    return jsonResponse({ poll: true, daoId: c.req.param('daoId') });
  });
  app.get('/api/dao/:daoId/notifications', async (c) => {
    return handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
  });
  app.post('/api/dao/:daoId/notifications/read', async (_c) => {
    return ok({ ok: true });
  });
  app.post('/api/dao/:daoId/subscribe', async (_c) => {
    return ok({ ok: true });
  });
  app.get('/api/dao/:daoId/subscribe/status', async (_c) => {
    return ok({ subscribed: false });
  });

  // --- API: DAO System ---
  app.get('/api/dao/mine', async (c) => handleDaoMine(c.req.raw, c.env));
  app.get('/api/dao/discover', async (c) => handleDaoDiscover(c.req.raw, c.env));
  app.get('/api/dao/activity/mine', async (c) => handleMyDaoActivity(c.req.raw, c.env));
  app.post('/api/dao/create', async (c) => withSession(c, () => handleDaoCreate(c.req.raw, c.env)));
  app.get('/api/dao/:daoId', async (c) => handleDaoGet(c.req.raw, c.env, c.req.param('daoId')));
  app.put('/api/dao/:daoId', async (c) => {
    try {
      return await withSession(c, () => handleDaoUpdate(c.req.raw, c.env, c.req.param('daoId')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/stats', async (c) => {
    try {
      const result = await handleDaoStats(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/join', async (c) => {
    try {
      return await withSession(c, () => handleDaoJoin(c.req.raw, c.env, c.req.param('daoId')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/leave', async (c) => {
    try {
      return await withSession(c, () => handleDaoLeave(c.req.raw, c.env, c.req.param('daoId')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/members', async (c) => {
    try {
      const result = await handleDaoMembersList(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/members/:address', async (c) => {
    try {
      const result = await handleDaoMemberGet(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('address'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/activity', async (c) => {
    try {
      const result = await handleDaoActivity(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/proposals', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoProposalCreate(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/proposals', async (c) => {
    try {
      const result = await handleDaoProposalsList(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/proposals/:proposalId', async (c) => {
    try {
      const result = await handleDaoProposalGet(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('proposalId'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/dao/:daoId/proposals/:proposalId', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoProposalUpdate(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/dao/:daoId/proposals/:proposalId', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoProposalDelete(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/proposals/:proposalId/vote', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoProposalVote(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/proposals/:proposalId/votes', async (c) => {
    try {
      const result = await handleDaoProposalVotes(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('proposalId'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/proposals/:proposalId/vote/me', async (c) => {
    try {
      const result = await handleDaoProposalMyVote(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('proposalId'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/proposals/:proposalId/queue', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoProposalQueue(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/proposals/:proposalId/execute', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoProposalExecute(c.req.raw, c.env, c.req.param('daoId'), c.req.param('proposalId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/delegate', async (c) => {
    try {
      return await withSession(c, () => handleDaoDelegate(c.req.raw, c.env, c.req.param('daoId')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/revoke-delegation', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoRevokeDelegation(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/delegation/mine', async (c) => {
    try {
      const result = await handleDaoDelegationMine(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/delegation/:address', async (c) => {
    try {
      const result = await handleDaoDelegationStatus(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('address'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/delegates', async (c) => {
    try {
      const result = await handleDaoDelegatesTop(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury', async (c) => {
    try {
      const result = await handleDaoTreasuryOverview(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/transactions', async (c) => {
    try {
      const result = await handleDaoTreasuryTransactions(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/transfer', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoTreasuryTransfer(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/streams', async (c) => {
    try {
      const result = await handleDaoTreasuryStreams(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/dao/:daoId/treasury/streams/:streamId', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoTreasuryStreamDelete(
          c.req.raw,
          c.env,
          c.req.param('daoId'),
          c.req.param('streamId'),
        ),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/grants', async (c) => {
    try {
      const result = await handleDaoTreasuryGrants(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant/:grantId/milestone', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoTreasuryGrantMilestone(
          c.req.raw,
          c.env,
          c.req.param('daoId'),
          c.req.param('grantId'),
        ),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: DAO Registry (static before parameterized) ---
  app.get('/api/dao/registry', async (c) => {
    try {
      const result = await handleDaoRegistryList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/registry', async (c) => {
    try {
      return await withSession(c, () => handleDaoRegistryRegister(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: External DAO Integrations — Snapshot ---
  app.post('/api/dao/:daoId/snapshot/strategy', async (c) => {
    try {
      return await withSession(c, () =>
        handleSnapshotStrategyGenerate(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/snapshot/sync-proposal', async (c) => {
    try {
      return await withSession(c, () =>
        handleSnapshotSyncProposal(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/snapshot/votes/:proposalId', async (c) => {
    try {
      const result = await handleSnapshotImportVotes(
        c.req.raw,
        c.env,
        c.req.param('daoId'),
        c.req.param('proposalId'),
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/snapshot/delegation-sync', async (c) => {
    try {
      return await withSession(c, () =>
        handleDelegationSync(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: External DAO Integrations — Tally ---
  app.post('/api/dao/:daoId/tally/check', async (c) => {
    try {
      return await withSession(c, () =>
        handleTallyCompatibilityCheck(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/tally/register', async (c) => {
    try {
      return await withSession(c, () =>
        handleTallyRegister(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/tally/status', async (c) => {
    try {
      const result = await handleTallyStatus(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: External DAO Integrations — Defender ---
  app.post('/api/dao/:daoId/defender/setup', async (c) => {
    try {
      return await withSession(c, () =>
        handleDefenderSetup(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/defender/status', async (c) => {
    try {
      const result = await handleDefenderStatus(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/defender/sync', async (c) => {
    try {
      return await withSession(c, () => handleDefenderSync(c.req.raw, c.env, c.req.param('daoId')));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/dao/:daoId/defender', async (c) => {
    try {
      return await withSession(c, () =>
        handleDefenderDisable(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: DAO Registry — Entry detail ---
  app.get('/api/dao/registry/:daoId', async (c) => {
    try {
      const result = await handleDaoRegistryGet(c.req.raw, c.env, c.req.param('daoId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/registry/:daoId/link', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoRegistryLink(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/registry/:daoId/verify', async (c) => {
    try {
      return await withSession(c, () =>
        handleDaoRegistryVerify(c.req.raw, c.env, c.req.param('daoId')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: DAO Treasury ---
  app.get('/api/dao/:daoId/treasury/multisig', async (c) => {
    try {
      const result = await handleMultisigList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/multisig/config', async (c) => {
    try {
      const result = await handleMultisigConfig(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/multisig/config', async (c) => {
    try {
      const result = await handleMultisigSaveConfig(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/multisig/propose', async (c) => {
    try {
      const result = await handleMultisigPropose(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/multisig/:txId/sign', async (c) => {
    try {
      const result = await handleMultisigSign(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/multisig/:txId/execute', async (c) => {
    try {
      const result = await handleMultisigExecute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/multisig/:txId/cancel', async (c) => {
    try {
      const result = await handleMultisigCancel(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/stream', async (c) => {
    try {
      const result = await handleStreamList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/stream', async (c) => {
    try {
      return await withSession(c, () => handleStreamCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/stream/analytics', async (c) => {
    try {
      const result = await handleStreamAnalytics(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/stream/:streamId', async (c) => {
    try {
      const result = await handleStreamGet(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/dao/:daoId/treasury/stream/:streamId', async (c) => {
    try {
      const result = await handleStreamModify(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/dao/:daoId/treasury/stream/:streamId', async (c) => {
    try {
      const result = await handleStreamCancel(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/stream/:streamId/pause', async (c) => {
    try {
      const result = await handleStreamPause(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/stream/:streamId/resume', async (c) => {
    try {
      const result = await handleStreamResume(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/stream/:streamId/history', async (c) => {
    try {
      const result = await handleStreamHistory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/grant', async (c) => {
    try {
      const result = await handleGrantListPrograms(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant', async (c) => {
    try {
      return await withSession(c, () => handleGrantCreateProgram(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/grant/applications', async (c) => {
    try {
      const result = await handleGrantListApplications(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/grant/analytics', async (c) => {
    try {
      const result = await handleGrantAnalytics(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant/:grantId/apply', async (c) => {
    try {
      const result = await handleGrantApply(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/review', async (c) => {
    try {
      const result = await handleGrantReview(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/vote', async (c) => {
    try {
      const result = await handleGrantVote(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/finalize', async (c) => {
    try {
      const result = await handleGrantFinalize(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/grant/app/:appId/milestone/:milestoneId/submit', async (c) => {
    try {
      const result = await handleGrantSubmitMilestone(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/investment/portfolio', async (c) => {
    try {
      const result = await handleInvestmentPortfolio(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/investment/yields', async (c) => {
    try {
      const result = await handleInvestmentYields(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/investment/performance', async (c) => {
    try {
      const result = await handleInvestmentPerformance(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/investment/proposal', async (c) => {
    try {
      const result = await handleInvestmentCreateProposal(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/investment/proposals', async (c) => {
    try {
      const result = await handleInvestmentListProposals(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/dao/:daoId/treasury/investment/proposal/:proposalId/vote', async (c) => {
    try {
      const result = await handleInvestmentVote(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/dao/:daoId/treasury/analytics', async (c) => {
    try {
      const result = await handleTreasuryAnalytics(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

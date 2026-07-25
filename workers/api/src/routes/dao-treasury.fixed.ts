/**
 * @degenfeed/api-worker — DAO Treasury Route Handlers
 *
 * REST API for multi-sig, streaming payments, grants, and investments.
 * Each handler instantiates the appropriate service and delegates.
 *
 * Security fixes applied per DAO-SECURITY-AUDIT.md (2026-07-25):
 *   A-03: Treasury endpoints now use requireSession + derive wallet from session
 *         instead of accepting signer/canceller/pauser from request body
 */

import type { Address } from 'viem';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import { GrantsService } from '../lib/grants-service';
import { InvestmentService } from '../lib/investment-service';
import { formatSignatureProgress, MultiSigService } from '../lib/multisig-service';
import {
  flowRateToMonthly,
  formatFlowRate,
  StreamingPaymentsService,
} from '../lib/streaming-payments';
import { requireSession } from '../session';

// ─── Request Body Parsing ─────────────────────────────────────────

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getDaoId(request: Request): string | null {
  const url = new URL(request.url);
  const match = url.pathname.match(/\/api\/dao\/([^/]+)\/treasury/);
  return match ? (match[1] ?? null) : null;
}

function getPathSegmentAfter(request: Request, keyword: string): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const idx = parts.indexOf(keyword);
  if (idx === -1 || idx + 1 >= parts.length) return null;
  return parts[idx + 1] ?? null;
}

function getStreamId(request: Request): string | null {
  return getPathSegmentAfter(request, 'stream');
}

function getAppId(request: Request): string | null {
  return getPathSegmentAfter(request, 'app');
}

function getMilestoneId(request: Request): string | null {
  return getPathSegmentAfter(request, 'milestone');
}

function getProposalId(request: Request): string | null {
  return getPathSegmentAfter(request, 'proposal');
}

function getMultisigTxId(request: Request): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const idx = parts.indexOf('multisig');
  if (idx === -1 || idx + 1 >= parts.length) return null;
  const candidate = parts[idx + 1] ?? null;
  if (candidate && ['config', 'propose', 'list'].includes(candidate)) return null;
  return candidate;
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-SIG ROUTES
// ═══════════════════════════════════════════════════════════════════

export async function handleMultisigPropose(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase();

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const body = await parseBody(request);
  if (!body) return jsonResponse({ error: 'Invalid request body' }, 400);

  // A-03: Ensure creator matches session
  body.creator = wallet;

  try {
    const service = new MultiSigService(env);
    const tx = await service.proposeTransaction(daoId, { ...body, proposer: wallet });
    return jsonResponse({ data: tx }, 201);
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to propose transaction' }, 400);
  }
}

export async function handleMultisigSign(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const txId = getMultisigTxId(request);
  if (!txId) return jsonResponse({ error: 'Missing transaction ID' }, 400);

  const body = await parseBody(request);

  try {
    const service = new MultiSigService(env);
    const tx = await service.signTransaction(
      daoId,
      txId,
      wallet, // A-03: Use session address, not body.signer
      body?.approved ?? true,
      body?.reason,
      body?.signature,
    );
    const summary = service.getSignatureSummary(tx);
    return jsonResponse({
      data: tx,
      summary,
      progress: formatSignatureProgress(summary.approved, tx.threshold),
    });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to sign transaction' }, 400);
  }
}

export async function handleMultisigExecute(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const txId = getMultisigTxId(request);
  if (!txId) return jsonResponse({ error: 'Missing transaction ID' }, 400);

  const body = await parseBody(request);

  try {
    const service = new MultiSigService(env);
    const tx = await service.executeTransaction(daoId, txId, body?.executionTx);
    return jsonResponse({ data: tx });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to execute transaction' }, 400);
  }
}

export async function handleMultisigCancel(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const txId = getMultisigTxId(request);
  if (!txId) return jsonResponse({ error: 'Missing transaction ID' }, 400);

  const body = await parseBody(request);

  try {
    const service = new MultiSigService(env);
    const tx = await service.cancelTransaction(
      daoId,
      txId,
      wallet, // A-03: Use session address, not body.cancelledBy
      body?.reason,
    );
    return jsonResponse({ data: tx });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to cancel transaction' }, 400);
  }
}

export async function handleMultisigList(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') as any;
  const type = url.searchParams.get('type') as any;
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    const service = new MultiSigService(env);
    const result = await service.listTransactions(daoId, { status, type, limit });
    return jsonResponse({ data: result.transactions, total: result.total });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to list transactions' }, 400);
  }
}

export async function handleMultisigConfig(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const service = new MultiSigService(env);
    const config = await service.getConfig(daoId);
    if (!config) return jsonResponse({ error: 'Multi-sig not configured' }, 404);
    return jsonResponse({ data: config });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get config' }, 400);
  }
}

export async function handleMultisigSaveConfig(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const body = await parseBody(request);
  if (!body) return jsonResponse({ error: 'Invalid request body' }, 400);

  try {
    const service = new MultiSigService(env);
    const config = await service.saveConfig({ ...body, daoId });
    return jsonResponse({ data: config }, 201);
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to save config' }, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STREAMING PAYMENT ROUTES
// ═══════════════════════════════════════════════════════════════════

export async function handleStreamCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const body = await parseBody(request);
  if (!body) return jsonResponse({ error: 'Invalid request body' }, 400);

  try {
    const service = new StreamingPaymentsService(env);
    const stream = await service.createStream(daoId, { ...body, createdBy: wallet });
    const monthly = flowRateToMonthly(stream.flowRate, stream.tokenDecimals, stream.tokenSymbol);
    return jsonResponse(
      {
        data: stream,
        display: {
          monthly,
          flowRateFormatted: formatFlowRate(stream.flowRate, stream.tokenDecimals),
        },
      },
      201,
    );
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to create stream' }, 400);
  }
}

export async function handleStreamList(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') as any;
  const category = url.searchParams.get('category') as any;

  try {
    const service = new StreamingPaymentsService(env);
    const result = await service.listStreams(daoId, { status, category });
    return jsonResponse({ data: result.streams, total: result.total });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to list streams' }, 400);
  }
}

export async function handleStreamGet(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const streamId = getStreamId(request);
  if (!streamId) return jsonResponse({ error: 'Missing stream ID' }, 400);

  try {
    const service = new StreamingPaymentsService(env);
    const result = await service.getStream(daoId, streamId);
    return jsonResponse({ data: result });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get stream' }, 400);
  }
}

export async function handleStreamModify(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const streamId = getStreamId(request);
  if (!streamId) return jsonResponse({ error: 'Missing stream ID' }, 400);

  const body = await parseBody(request);

  try {
    const service = new StreamingPaymentsService(env);
    const stream = await service.modifyStream(daoId, streamId, body, wallet);
    return jsonResponse({ data: stream });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to modify stream' }, 400);
  }
}

export async function handleStreamCancel(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const streamId = getStreamId(request);
  if (!streamId) return jsonResponse({ error: 'Missing stream ID' }, 400);

  const _body = await parseBody(request);

  try {
    const service = new StreamingPaymentsService(env);
    const result = await service.cancelStream(daoId, streamId, wallet);
    return jsonResponse({ data: result });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to cancel stream' }, 400);
  }
}

export async function handleStreamPause(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const streamId = getStreamId(request);
  if (!streamId) return jsonResponse({ error: 'Missing stream ID' }, 400);

  const _body = await parseBody(request);

  try {
    const service = new StreamingPaymentsService(env);
    const stream = await service.pauseStream(daoId, streamId, wallet);
    return jsonResponse({ data: stream });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to pause stream' }, 400);
  }
}

export async function handleStreamResume(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const streamId = getStreamId(request);
  if (!streamId) return jsonResponse({ error: 'Missing stream ID' }, 400);

  const _body = await parseBody(request);

  try {
    const service = new StreamingPaymentsService(env);
    const stream = await service.resumeStream(daoId, streamId, wallet);
    return jsonResponse({ data: stream });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to resume stream' }, 400);
  }
}

export async function handleStreamHistory(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const streamId = getStreamId(request);
  if (!streamId) return jsonResponse({ error: 'Missing stream ID' }, 400);

  try {
    const service = new StreamingPaymentsService(env);
    const events = await service.getStreamHistory(daoId, streamId);
    return jsonResponse({ data: events });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get stream history' }, 400);
  }
}

export async function handleStreamAnalytics(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const service = new StreamingPaymentsService(env);
    const analytics = await service.getAnalytics(daoId);
    return jsonResponse({ data: analytics });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get analytics' }, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// GRANT ROUTES
// ═══════════════════════════════════════════════════════════════════

export async function handleGrantCreateProgram(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const body = await parseBody(request);
  if (!body) return jsonResponse({ error: 'Invalid request body' }, 400);

  try {
    const service = new GrantsService(env);
    const program = await service.createGrantProgram(daoId, body);
    return jsonResponse({ data: program }, 201);
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to create grant program' }, 400);
  }
}

export async function handleGrantListPrograms(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const service = new GrantsService(env);
    const programs = await service.listGrantPrograms(daoId);
    return jsonResponse({ data: programs });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to list grant programs' }, 400);
  }
}

export async function handleGrantApply(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const body = await parseBody(request);
  if (!body) return jsonResponse({ error: 'Invalid request body' }, 400);

  try {
    const service = new GrantsService(env);
    const app = await service.submitApplication(daoId, { ...body, applicant: wallet });
    return jsonResponse({ data: app }, 201);
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to submit application' }, 400);
  }
}

export async function handleGrantListApplications(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') as any;
  const category = url.searchParams.get('category') as any;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    const service = new GrantsService(env);
    const result = await service.listApplications(daoId, { status, category, limit });
    return jsonResponse({ data: result.applications, total: result.total });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to list applications' }, 400);
  }
}

export async function handleGrantReview(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const appId = getAppId(request);
  if (!appId) return jsonResponse({ error: 'Missing application ID' }, 400);

  const body = await parseBody(request);
  if (!body?.comment) return jsonResponse({ error: 'Missing comment' }, 400);

  try {
    const service = new GrantsService(env);
    const app = await service.addReview(daoId, appId, wallet, body.comment, body.rating ?? 3);
    return jsonResponse({ data: app });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to add review' }, 400);
  }
}

export async function handleGrantVote(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const appId = getAppId(request);
  if (!appId) return jsonResponse({ error: 'Missing application ID' }, 400);

  const body = await parseBody(request);
  if (!body?.choice) return jsonResponse({ error: 'Missing choice' }, 400);

  try {
    const service = new GrantsService(env);
    const app = await service.castVote(daoId, appId, wallet, body.choice, body.reason);
    return jsonResponse({ data: app });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to cast vote' }, 400);
  }
}

export async function handleGrantFinalize(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const appId = getAppId(request);
  if (!appId) return jsonResponse({ error: 'Missing application ID' }, 400);

  const body = await parseBody(request);
  if (!body?.decision) return jsonResponse({ error: 'Missing decision' }, 400);

  try {
    const service = new GrantsService(env);
    const app = await service.finalizeApplication(daoId, appId, body.decision, wallet, body.reason);
    return jsonResponse({ data: app });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to finalize application' }, 400);
  }
}

export async function handleGrantSubmitMilestone(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const milestoneId = getMilestoneId(request);
  const appId = getAppId(request);
  if (!milestoneId || !appId)
    return jsonResponse({ error: 'Missing milestone or application ID' }, 400);

  const body = await parseBody(request);
  if (!body?.proof) return jsonResponse({ error: 'Missing proof' }, 400);

  try {
    const service = new GrantsService(env);
    const app = await service.submitMilestone(daoId, appId, milestoneId, body.proof);
    return jsonResponse({ data: app });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to submit milestone' }, 400);
  }
}

export async function handleGrantAnalytics(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const service = new GrantsService(env);
    const analytics = await service.getAnalytics(daoId);
    return jsonResponse({ data: analytics });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get analytics' }, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// INVESTMENT ROUTES
// ═══════════════════════════════════════════════════════════════════

export async function handleInvestmentPortfolio(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const service = new InvestmentService(env);
    const portfolio = await service.getPortfolio(daoId);
    return jsonResponse({ data: portfolio });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get portfolio' }, 400);
  }
}

export async function handleInvestmentYields(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') as any;
  const maxRisk = url.searchParams.get('maxRisk') as any;
  const minApy = url.searchParams.get('minApy')
    ? parseFloat(url.searchParams.get('minApy')!)
    : undefined;
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    const service = new InvestmentService(env);
    const opportunities = await service.getYieldOpportunities({ type, maxRisk, minApy, limit });
    return jsonResponse({ data: opportunities });
  } catch (err: unknown) {
    return jsonResponse(
      { error: (err as Error).message || 'Failed to get yield opportunities' },
      400,
    );
  }
}

export async function handleInvestmentPerformance(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const service = new InvestmentService(env);
    const performance = await service.getPerformanceSummary(daoId);
    return jsonResponse({ data: performance });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get performance' }, 400);
  }
}

export async function handleInvestmentCreateProposal(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const body = await parseBody(request);
  if (!body) return jsonResponse({ error: 'Invalid request body' }, 400);

  try {
    const service = new InvestmentService(env);
    const proposal = await service.createProposal(daoId, body);
    return jsonResponse({ data: proposal }, 201);
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to create proposal' }, 400);
  }
}

export async function handleInvestmentListProposals(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') as any;

  try {
    const service = new InvestmentService(env);
    const proposals = await service.listProposals(daoId, status);
    return jsonResponse({ data: proposals });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to list proposals' }, 400);
  }
}

export async function handleInvestmentVote(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase() as Address;

  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  const proposalId = getProposalId(request);
  if (!proposalId) return jsonResponse({ error: 'Missing proposal ID' }, 400);

  const body = await parseBody(request);
  if (!body?.choice) return jsonResponse({ error: 'Missing choice' }, 400);

  try {
    const service = new InvestmentService(env);
    const proposal = await service.voteOnProposal(daoId, proposalId, wallet, body.choice);
    return jsonResponse({ data: proposal });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to vote on proposal' }, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// GENERIC TREASURY ANALYTICS
// ═══════════════════════════════════════════════════════════════════

export async function handleTreasuryAnalytics(request: Request, env: Env): Promise<Response> {
  const daoId = getDaoId(request);
  if (!daoId) return jsonResponse({ error: 'Invalid DAO ID' }, 400);

  try {
    const multisigService = new MultiSigService(env);
    const streamService = new StreamingPaymentsService(env);
    const grantService = new GrantsService(env);
    const investService = new InvestmentService(env);

    const [pendingTxs, streamAnalytics, grantAnalytics, portfolio] = await Promise.all([
      multisigService.getActiveTransactions(daoId),
      streamService.getAnalytics(daoId).catch(() => null),
      grantService.getAnalytics(daoId).catch(() => null),
      investService.getPortfolio(daoId).catch(() => null),
    ]);

    return jsonResponse({
      data: {
        pendingTransactions: pendingTxs.length,
        streamAnalytics,
        grantAnalytics,
        portfolio,
        timestamp: Date.now(),
      },
    });
  } catch (err: unknown) {
    return jsonResponse({ error: (err as Error).message || 'Failed to get analytics' }, 400);
  }
}

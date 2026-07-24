/**
 * @degenfeed/api-worker — Feddy Communities: Treasury & Token
 *
 * Community treasury management, token configuration, token gates, and rewards.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  addTreasuryTx,
  checkTokenGate,
  getCommunityByName,
  getTokenConfig,
  getTokenGates,
  getTreasury,
  getTreasuryTxs,
  setTokenConfig,
  setTokenGates,
  setTreasury,
  updateMemberTokenBalance,
  getAllCommunityMembers,
} from '../lib/feddy-store';
import {
  checkPremium,
  csrfCheck,
  requireModOrResponse,
  requireOwnerOrResponse,
  requireSession,
  sanitizeHtml,
  sanitizeString,
  shortenWallet,
} from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── Treasury ──────────────────────────────────────────────────────────

feddy.get('/:name/treasury', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const treasury = await getTreasury(c.env, community.id);
  if (!treasury) return jsonResponse({ error: 'No treasury configured' }, 404);

  return noCacheJsonResponse(treasury);
});

feddy.post('/:name/treasury/deposit', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface TreasuryDepositBody {
    amount?: string;
    memo?: string;
    txSignature?: string;
  }
  let body: TreasuryDepositBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.amount) return jsonResponse({ error: 'Amount required' }, 400);

  const tx: import('../lib/feddy-store').TreasuryTx = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: 'deposit',
    amount: body.amount,
    from: session.address,
    to: community.id,
    memo: sanitizeString(body.memo ?? 'Treasury deposit', 500),
    txSignature: sanitizeString(body.txSignature ?? '', 128),
    createdAt: Date.now(),
  };

  await addTreasuryTx(c.env, tx);

  // Update treasury balance
  const treasury = await getTreasury(c.env, community.id);
  if (treasury) {
    const newBalance = (BigInt(treasury.balance) + BigInt(body.amount)).toString();
    treasury.balance = newBalance;
    treasury.totalDeposits = (BigInt(treasury.totalDeposits) + BigInt(body.amount)).toString();
    treasury.updatedAt = Date.now();
    await setTreasury(c.env, treasury);
  }

  return jsonResponse(tx, 201);
});

feddy.post('/:name/treasury/withdraw', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const ownerCheck = await requireOwnerOrResponse(c.env, community.id, session.address);
  if (ownerCheck.error) return ownerCheck.error;

  interface WithdrawBody {
    amount?: string;
    to?: string;
    memo?: string;
    txSignature?: string;
  }
  let body: WithdrawBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.amount || !body.to)
    return jsonResponse({ error: 'Amount and recipient required' }, 400);

  const tx: import('../lib/feddy-store').TreasuryTx = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: 'withdrawal',
    amount: body.amount,
    from: community.id,
    to: sanitizeString(body.to, 128),
    memo: sanitizeString(body.memo ?? 'Treasury withdrawal', 500),
    txSignature: sanitizeString(body.txSignature ?? '', 128),
    createdAt: Date.now(),
  };

  await addTreasuryTx(c.env, tx);

  const treasury = await getTreasury(c.env, community.id);
  if (treasury) {
    const newBalance = (BigInt(treasury.balance) - BigInt(body.amount)).toString();
    treasury.balance = newBalance;
    treasury.totalWithdrawals = (
      BigInt(treasury.totalWithdrawals) + BigInt(body.amount)
    ).toString();
    treasury.updatedAt = Date.now();
    await setTreasury(c.env, treasury);
  }

  return jsonResponse(tx, 201);
});

feddy.get('/:name/treasury/tx', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const limit = Number(c.req.query('limit') || 20);
  const txs = await getTreasuryTxs(c.env, community.id, Math.min(limit, 100));
  return noCacheJsonResponse({ transactions: txs });
});

// ─── Community Token ───────────────────────────────────────────────────

feddy.post('/:name/token-config', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const ownerCheck = await requireOwnerOrResponse(c.env, community.id, session.address);
  if (ownerCheck.error) return ownerCheck.error;

  interface TokenBody {
    mintAddress?: string;
    symbol?: string;
    tokenName?: string;
    decimals?: number;
    totalSupply?: number;
    isTradeable?: boolean;
    feeSharePercent?: number;
    rewardPerPost?: number;
  }
  let body: TokenBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.mintAddress || !body.symbol) {
    return jsonResponse({ error: 'mintAddress and symbol required' }, 400);
  }

  const config: import('../lib/feddy-store').CommunityTokenConfig = {
    communityId: community.id,
    mintAddress: sanitizeString(body.mintAddress, 128),
    symbol: sanitizeString(body.symbol, 20).toUpperCase(),
    name: sanitizeString(body.tokenName ?? body.symbol ?? '', 100),
    decimals: body.decimals ?? 9,
    totalSupply: body.totalSupply ?? 0,
    isTradeable: body.isTradeable ?? true,
    feeSharePercent: Math.min(Math.max(body.feeSharePercent ?? 0, 0), 100),
    rewardPerPost: body.rewardPerPost ?? 0,
    createdAt: Date.now(),
  };

  await setTokenConfig(c.env, config);
  return jsonResponse(config, 201);
});

feddy.get('/:name/token-config', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const config = await getTokenConfig(c.env, community.id);
  if (!config) return jsonResponse({ error: 'No token configured' }, 404);
  return noCacheJsonResponse(config);
});

// ─── Token Gates ───────────────────────────────────────────────────────

feddy.post('/:name/token-gates', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface GatesBody {
    gates?: Array<{
      name?: string;
      minBalance?: number;
      isRequired?: boolean;
      channelName?: string;
    }>;
  }
  let body: GatesBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const gates = (body.gates ?? []).map((g) => ({
    id: crypto.randomUUID(),
    name: sanitizeString(g.name ?? 'Token Gate', 100),
    minBalance: Math.max(g.minBalance ?? 0, 0),
    isRequired: g.isRequired ?? true,
    channelName: g.channelName ? sanitizeString(g.channelName, 100) : undefined,
    createdAt: Date.now(),
  }));

  await setTokenGates(c.env, community.id, gates);
  return jsonResponse({ ok: true, gates });
});

feddy.get('/:name/token-gates', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const gates = await getTokenGates(c.env, community.id);
  return noCacheJsonResponse({ gates });
});

feddy.get('/:name/token-gates/check', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const result = await checkTokenGate(c.env, community.id, session.address);
  return noCacheJsonResponse(result);
});

// ─── Token Rewards ─────────────────────────────────────────────────────

feddy.post('/:name/reward', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface RewardBody {
    wallet?: string;
    amount?: number;
    reason?: string;
  }
  let body: RewardBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) return jsonResponse({ error: 'Wallet required' }, 400);
  if (!body.amount || body.amount <= 0)
    return jsonResponse({ error: 'Positive amount required' }, 400);

  // Update member token balance
  const member = (await getAllCommunityMembers(c.env, community.id)).find(
    (m) => m.wallet === targetWallet,
  );
  const currentBalance = member?.tokenBalance ?? 0;
  await updateMemberTokenBalance(c.env, community.id, targetWallet, currentBalance + body.amount);

  // Record the reward
  const rewardTx: import('../lib/feddy-store').TreasuryTx = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: 'reward',
    amount: String(body.amount),
    from: community.id,
    to: targetWallet,
    memo: sanitizeString(body.reason ?? 'Community reward', 500),
    txSignature: '',
    createdAt: Date.now(),
  };
  await addTreasuryTx(c.env, rewardTx);

  return jsonResponse({
    ok: true,
    rewarded: targetWallet,
    amount: body.amount,
  });
});

export default feddy;

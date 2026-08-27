/**
 * @degenfeed/api-worker — Coin Community Challenges (TASK 4)
 *
 * Gamified community challenges for creator coins:
 *   GET  /api/coin/:symbol/challenges       — Active challenges
 *   POST /api/coin/:symbol/challenges       — Creator creates challenge
 *
 * Challenge types:
 *   - holder_milestone: Reach N holders → badge for all
 *   - buy_pressure: Buy N tokens in 24h → price boost
 *   - community_vote: Vote on next feature → earn reputation
 *   - referral_race: Invite most new holders → exclusive NFT
 *   - content_contest: Best meme/video → community votes
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChallengeType =
  | 'holder_milestone'
  | 'buy_pressure'
  | 'community_vote'
  | 'referral_race'
  | 'content_contest';

export type ChallengeStatus = 'active' | 'completed' | 'expired';

export interface Challenge {
  id: string;
  coinSymbol: string;
  type: ChallengeType;
  title: string;
  description: string;
  target: number;
  current: number;
  status: ChallengeStatus;
  reward: ChallengeReward;
  startsAt: number;
  endsAt: number;
  createdBy: string;
  createdByLabel?: string;
  participants?: number;
  winner?: string;
  winnerLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface ChallengeReward {
  type: 'badge' | 'price_boost' | 'reputation' | 'nft' | 'community_vote';
  label: string;
  value?: string;
  badgeName?: string;
  badgeIcon?: string;
  boostBps?: number;
  reputationAmount?: number;
  nftName?: string;
}

export interface CreateChallengeRequest {
  type: ChallengeType;
  title: string;
  description: string;
  target: number;
  reward: ChallengeReward;
  durationHours: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const KV_PREFIX = 'coin:challenges:';
const MAX_CHALLENGES = 50;
const CACHE_TTL = 60; // 1 minute

const CHALLENGE_TYPES: Record<ChallengeType, { label: string; icon: string; description: string }> =
  {
    holder_milestone: {
      label: 'Holder Milestone',
      icon: '👥',
      description: 'Reach a target number of holders',
    },
    buy_pressure: {
      label: 'Buy Pressure',
      icon: '📈',
      description: 'Buy a target amount of tokens within a time window',
    },
    community_vote: {
      label: 'Community Vote',
      icon: '🗳️',
      description: 'Vote on the next feature or decision',
    },
    referral_race: {
      label: 'Referral Race',
      icon: '🏁',
      description: 'Invite the most new holders to win',
    },
    content_contest: {
      label: 'Content Contest',
      icon: '🎨',
      description: 'Best meme or video about the coin wins',
    },
  };

// ─── KV Helpers ────────────────────────────────────────────────────────────

async function getChallenges(env: Env, symbol: string): Promise<Challenge[]> {
  try {
    const key = KV_PREFIX + symbol.toLowerCase();
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as Challenge[];
  } catch {
    // Fall through
  }
  return [];
}

async function setChallenges(env: Env, symbol: string, challenges: Challenge[]): Promise<void> {
  try {
    const key = KV_PREFIX + symbol.toLowerCase();
    await env.CACHE?.put(key, JSON.stringify(challenges.slice(0, MAX_CHALLENGES)), {
      expirationTtl: CACHE_TTL,
    });
  } catch {
    // Non-critical
  }
}

// ─── GET /api/coin/:symbol/challenges ─────────────────────────────────────

export async function handleCoinChallengesList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const symbol = extractSymbol(parts);

  if (!symbol) {
    return jsonResponse({ error: 'Symbol is required' }, 400);
  }

  const statusFilter = url.searchParams.get('status') as ChallengeStatus | 'all' | null;
  const typeFilter = url.searchParams.get('type') as ChallengeType | null;

  const challenges = await getChallenges(env, symbol);

  if (challenges.length > 0) {
    // Update statuses based on time
    const now = Date.now();
    challenges = challenges.map((c) => {
      if (c.status !== 'completed') {
        if (c.endsAt <= now) return { ...c, status: 'expired' as const };
        if (c.current >= c.target) return { ...c, status: 'completed' as const };
      }
      return c;
    });
    await setChallenges(env, symbol, challenges);
  }

  // Apply filters
  let filtered = challenges;
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter((c) => c.status === statusFilter);
  }
  if (typeFilter) {
    filtered = filtered.filter((c) => c.type === typeFilter);
  }

  return noCacheJsonResponse({
    challenges: filtered,
    total: filtered.length,
    symbol: symbol.toUpperCase(),
  });
}

// ─── POST /api/coin/:symbol/challenges ────────────────────────────────────

export async function handleCoinChallengeCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const symbol = extractSymbol(parts);

  if (!symbol) {
    return jsonResponse({ error: 'Symbol is required' }, 400);
  }

  // Verify creator owns this coin (simplified check)
  const coinKey = `coin:data:${symbol.toLowerCase()}`;
  const coinData = await getCoinData(env, coinKey);
  if (coinData && coinData.creator?.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the coin creator can create challenges' }, 403);
  }

  let body: CreateChallengeRequest;
  try {
    body = (await request.json()) as CreateChallengeRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.type || !body.title || !body.target || !body.reward || !body.durationHours) {
    return jsonResponse(
      { error: 'type, title, target, reward, and durationHours are required' },
      400,
    );
  }

  if (!CHALLENGE_TYPES[body.type]) {
    return jsonResponse(
      {
        error: `Invalid challenge type. Must be one of: ${Object.keys(CHALLENGE_TYPES).join(', ')}`,
      },
      400,
    );
  }

  const now = Date.now();
  const challenge: Challenge = {
    id: `ch_${Date.now()}_${symbol}`,
    coinSymbol: symbol.toUpperCase(),
    type: body.type,
    title: sanitizeString(body.title, 200) || body.title,
    description: sanitizeString(body.description, 1000) || '',
    target: body.target,
    current: 0,
    status: 'active',
    reward: body.reward,
    startsAt: now,
    endsAt: now + body.durationHours * 3600_000,
    createdBy: session.address,
    createdByLabel: `${session.address.slice(0, 6)}...${session.address.slice(-4)}`,
    participants: 0,
  };

  const challenges = await getChallenges(env, symbol);
  challenges.unshift(challenge);
  await setChallenges(env, symbol, challenges);

  return jsonResponse({ success: true, challenge }, 201);
}

// ─── POST /api/coin/:symbol/challenges/:id/progress ──────────────────────

const _VALID_CHALLENGE_PROGRESS_BODIES = new Set(['increment']);

export async function handleCoinChallengeProgress(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const symbol = extractSymbol(parts);
  const challengeId = parts[parts.length - 2]; // .../:id/progress

  if (!symbol || !challengeId) {
    return jsonResponse({ error: 'Symbol and challenge ID are required' }, 400);
  }

  let body: { increment?: number };
  try {
    body = (await request.json()) as { increment?: number };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const increment = Math.max(1, Math.min(body.increment ?? 1, 1000000)); // Sanity cap
  const challenges = await getChallenges(env, symbol);
  const challenge = challenges.find((c) => c.id === challengeId);

  if (!challenge) {
    return jsonResponse({ error: 'Challenge not found' }, 404);
  }

  if (challenge.status !== 'active') {
    return jsonResponse({ error: 'Challenge is not active' }, 400);
  }

  challenge.current = Math.min(challenge.current + increment, challenge.target);
  challenge.participants = (challenge.participants ?? 0) + 1;

  if (challenge.current >= challenge.target) {
    challenge.status = 'completed';
  }

  await setChallenges(env, symbol, challenges);

  return noCacheJsonResponse({
    success: true,
    challenge,
    completed: challenge.status === 'completed',
    progressPercent: Math.round((challenge.current / challenge.target) * 100),
  });
}

// ─── PATCH /api/coin/:symbol/challenges/:id ──────────────────────────────

export async function handleCoinChallengeUpdate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const symbol = extractSymbol(parts);
  const challengeId = parts[parts.length - 1];

  if (!symbol || !challengeId) {
    return jsonResponse({ error: 'Symbol and challenge ID are required' }, 400);
  }

  let body: {
    title?: string;
    description?: string;
    status?: 'active' | 'completed' | 'expired';
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Verify creator owns this coin
  const coinKey = `coin:data:${symbol.toLowerCase()}`;
  const coinData = await getCoinData(env, coinKey);
  if (coinData && coinData.creator?.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the coin creator can update challenges' }, 403);
  }

  const challenges = await getChallenges(env, symbol);
  const challenge = challenges.find((c) => c.id === challengeId);

  if (!challenge) {
    return jsonResponse({ error: 'Challenge not found' }, 404);
  }

  if (body.title !== undefined)
    challenge.title = sanitizeString(body.title, 200) || challenge.title;
  if (body.description !== undefined)
    challenge.description = sanitizeString(body.description, 1000) || challenge.description;
  if (body.status !== undefined && ['active', 'completed', 'expired'].includes(body.status)) {
    challenge.status = body.status;
  }

  await setChallenges(env, symbol, challenges);

  return jsonResponse({ success: true, challenge });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractSymbol(parts: string[]): string {
  const coinIdx = parts.indexOf('coin');
  if (coinIdx === -1) return '';
  return parts[coinIdx + 1] ?? '';
}

async function getCoinData(env: Env, key: string): Promise<{ creator?: string } | null> {
  try {
    const raw = await env.CACHE?.get(key);
    return raw ? (JSON.parse(raw) as { creator?: string }) : null;
  } catch {
    return null;
  }
}

// ─── Mock Data ─────────────────────────────────────────────────────────────



export { CHALLENGE_TYPES };

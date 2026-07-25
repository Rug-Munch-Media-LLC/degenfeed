/**
 * @degenfeed/api-worker — DAO Badge System
 *
 * 20+ badges across voting, proposal, treasury, community, and special categories.
 * Badges are stored in the CACHE KV namespace and awarded by checking conditions.
 *
 * KV schema:
 *   badge:{userId}:{badgeId}     → BadgeAward (the badge detail + awardedAt)
 *   badges:{userId}              → string[] (list of badge IDs for the user)
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BadgeCategory = 'voting' | 'proposal' | 'treasury' | 'community' | 'special';

export interface DAOBadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  /** If true, only one DAO member may hold this badge at a time */
  exclusive?: boolean;
}

export interface BadgeAward extends DAOBadgeDef {
  awardedAt: number;
  daoId: string;
}

// ─── All 21 Badge Definitions ──────────────────────────────────────────────

export const DAO_BADGES: DAOBadgeDef[] = [
  // ── Voting badges (5) ──────────────────────────────────────────────
  {
    id: 'first_vote',
    name: 'First Vote',
    description: 'Voted in your first proposal',
    icon: '🗳️',
    category: 'voting',
  },
  {
    id: 'consistent_voter',
    name: 'Consistent Voter',
    description: 'Voted in 10 consecutive proposals',
    icon: '✅',
    category: 'voting',
  },
  {
    id: 'quadratic_voter',
    name: 'Quadratic Voter',
    description: 'Participated in a quadratic voting proposal',
    icon: '📐',
    category: 'voting',
  },
  {
    id: 'early_voter',
    name: 'Early Voter',
    description: 'Voted within the first hour of 5 proposals',
    icon: '⏰',
    category: 'voting',
  },
  {
    id: 'swing_voter',
    name: 'Swing Voter',
    description: 'Cast the deciding vote on a tied proposal',
    icon: '⚖️',
    category: 'voting',
  },

  // ── Proposal badges (4) ─────────────────────────────────────────────
  {
    id: 'first_proposal',
    name: 'First Proposal',
    description: 'Created your first proposal',
    icon: '📝',
    category: 'proposal',
  },
  {
    id: 'passed_proposal',
    name: 'Passed!',
    description: 'Your proposal passed',
    icon: '🎉',
    category: 'proposal',
  },
  {
    id: 'bipartisan',
    name: 'Bipartisan',
    description: "Voted FOR a proposal you didn't create",
    icon: '🤝',
    category: 'proposal',
  },
  {
    id: 'constitutional',
    name: 'Constitutional',
    description: 'Created a constitutional proposal',
    icon: '📜',
    category: 'proposal',
  },

  // ── Treasury badges (4) ─────────────────────────────────────────────
  {
    id: 'treasurer',
    name: 'Treasurer',
    description: 'Executed a treasury transaction',
    icon: '💰',
    category: 'treasury',
  },
  {
    id: 'grant_reviewer',
    name: 'Grant Reviewer',
    description: 'Reviewed and voted on 5 grant proposals',
    icon: '🔍',
    category: 'treasury',
  },
  {
    id: 'streamer',
    name: 'Streamer',
    description: 'Set up a streaming payment',
    icon: '🌊',
    category: 'treasury',
  },
  {
    id: 'multi_sig_signer',
    name: 'Multi-sig Signer',
    description: "You're a treasury signer",
    icon: '✍️',
    category: 'treasury',
  },

  // ── Community badges (5) ────────────────────────────────────────────
  {
    id: 'recruiter',
    name: 'Recruiter',
    description: 'Invited 5+ members',
    icon: '📢',
    category: 'community',
  },
  {
    id: 'mentor',
    name: 'Mentor',
    description: 'Someone delegated to you',
    icon: '🧑‍🏫',
    category: 'community',
  },
  {
    id: 'diplomat',
    name: 'Diplomat',
    description: 'Voted in 3+ different DAOs',
    icon: '🌐',
    category: 'community',
  },
  {
    id: 'og',
    name: 'OG',
    description: 'Member for 6+ months',
    icon: '👴',
    category: 'community',
  },
  {
    id: 'helpful',
    name: 'Helpful',
    description: 'Answered 10+ questions in the forum',
    icon: '💡',
    category: 'community',
  },

  // ── Special badges (3) ──────────────────────────────────────────────
  {
    id: 'whale',
    name: 'Whale',
    description: 'Top 10% voting power in DAO',
    icon: '🐋',
    category: 'special',
    exclusive: true,
  },
  {
    id: 'quadratic_champion',
    name: 'Quadratic Champion',
    description: 'Used quadratic voting power optimally',
    icon: '🏆',
    category: 'special',
    exclusive: false,
  },
  {
    id: 'gasless_goat',
    name: 'Gasless Goat',
    description: 'Used gasless voting (signature)',
    icon: '🐐',
    category: 'special',
  },
];

// ─── KV helpers ────────────────────────────────────────────────────────────

/** User badge list key in CACHE. */
function userBadgesKey(userId: string): string {
  return `badges:${userId}`;
}

/** Single badge award key in CACHE. */
function badgeKey(userId: string, badgeId: string): string {
  return `badge:${userId}:${badgeId}`;
}

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return null;
}

async function kvPut(env: Env, key: string, value: unknown, ttl = 0): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), ttl > 0 ? { expirationTtl: ttl } : undefined);
  } catch {
    /* ignore */
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function hasBadge(env: Env, userId: string, badgeId: string): Promise<boolean> {
  const existing = await env.CACHE?.get(badgeKey(userId, badgeId));
  return existing !== null;
}

/**
 * Award a badge to a user. Best-effort writes. Returns true if newly awarded.
 */
export async function awardBadge(
  env: Env,
  userId: string,
  badgeId: string,
  daoId: string,
): Promise<boolean> {
  if (!env.CACHE) return false;

  const def = DAO_BADGES.find((b) => b.id === badgeId);
  if (!def) return false;

  // Don't re-award
  if (await hasBadge(env, userId, badgeId)) return false;

  const award: BadgeAward = {
    ...def,
    awardedAt: Date.now(),
    daoId,
  };

  try {
    await env.CACHE.put(badgeKey(userId, badgeId), JSON.stringify(award), {
      expirationTtl: 60 * 60 * 24 * 365, // 1 year
    });

    // Update user badge list
    const listKey = userBadgesKey(userId);
    const raw = await env.CACHE.get(listKey);
    const badges: string[] = raw ? JSON.parse(raw) : [];
    if (!badges.includes(badgeId)) {
      badges.push(badgeId);
      await env.CACHE.put(listKey, JSON.stringify(badges), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get all badges a user has earned.
 */
export async function getUserBadges(env: Env, userId: string): Promise<BadgeAward[]> {
  if (!env.CACHE) return [];

  try {
    const raw = await env.CACHE.get(userBadgesKey(userId));
    const badgeIds: string[] = raw ? JSON.parse(raw) : [];

    const badges: BadgeAward[] = [];
    for (const id of badgeIds) {
      const awardRaw = await env.CACHE.get(badgeKey(userId, id));
      if (awardRaw) {
        badges.push(JSON.parse(awardRaw) as BadgeAward);
      }
    }
    return badges;
  } catch {
    return [];
  }
}

/**
 * Get badge progress (all badges with unlock status) for a user.
 */
export async function getBadgeProgress(
  env: Env,
  userId: string,
): Promise<Array<DAOBadgeDef & { unlocked: boolean; awardedAt: number | null }>> {
  const userBadges = await getUserBadges(env, userId);
  const unlockedIds = new Set(userBadges.map((b) => b.id));

  return DAO_BADGES.map((def) => {
    const award = userBadges.find((b) => b.id === def.id);
    return {
      ...def,
      unlocked: unlockedIds.has(def.id),
      awardedAt: award?.awardedAt ?? null,
    };
  });
}

/**
 * Count total badges unlocked by a user.
 */
export async function countBadges(env: Env, userId: string): Promise<number> {
  if (!env.CACHE) return 0;
  try {
    const raw = await env.CACHE.get(userBadgesKey(userId));
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Check badge conditions and award badges based on provided user stats.
 * Call this after relevant actions (vote, proposal create, treasury tx, etc.)
 */
export interface BadgeCheckContext {
  userId: string;
  daoId: string;
  /** Total proposals voted on */
  totalVotes: number;
  /** Consecutive proposals voted */
  consecutiveVotes: number;
  /** Proposals voted within first hour */
  earlyVotes: number;
  /** Proposals created */
  proposalsCreated: number;
  /** Proposals passed */
  proposalsPassed: number;
  /** Grant proposals voted on */
  grantVotes: number;
  /** Treasury transactions executed */
  treasuryTxCount: number;
  /** Members invited */
  membersInvited: number;
  /** Has a delegation to them */
  hasDelegation: boolean;
  /** Different DAOs voted in */
  daosVotedIn: number;
  /** Days since joining */
  daysSinceJoin: number;
  /** Voting power percentile (0-100) */
  votingPowerPercentile: number;
  /** Used quadratic voting */
  usedQuadratic: boolean;
  /** Used gasless voting */
  usedGasless: boolean;
  /** Is a multi-sig signer */
  isMultiSigSigner: boolean;
  /** Has used streaming payment */
  hasStreamingPayment: boolean;
  /** Created a constitutional proposal */
  hasConstitutionalProposal: boolean;
  /** Voted on a proposal they didn't create */
  votedBipartisan: boolean;
  /** Cast deciding vote on a tied proposal */
  castSwingVote: boolean;
  /** Forum questions answered */
  forumAnswers: number;
}

/**
 * Check all badge conditions for a user and award any newly earned badges.
 * Returns list of newly awarded badge IDs.
 */
export async function checkBadges(env: Env, ctx: BadgeCheckContext): Promise<string[]> {
  if (!env.CACHE) return [];

  const awarded: string[] = [];

  // ── Voting badges ──────────────────────────────────────────────────
  if (ctx.totalVotes >= 1) {
    if (await tryAward(env, ctx.userId, 'first_vote', ctx.daoId)) awarded.push('first_vote');
  }
  if (ctx.consecutiveVotes >= 10) {
    if (await tryAward(env, ctx.userId, 'consistent_voter', ctx.daoId))
      awarded.push('consistent_voter');
  }
  if (ctx.usedQuadratic) {
    if (await tryAward(env, ctx.userId, 'quadratic_voter', ctx.daoId))
      awarded.push('quadratic_voter');
  }
  if (ctx.earlyVotes >= 5) {
    if (await tryAward(env, ctx.userId, 'early_voter', ctx.daoId)) awarded.push('early_voter');
  }
  if (ctx.castSwingVote) {
    if (await tryAward(env, ctx.userId, 'swing_voter', ctx.daoId)) awarded.push('swing_voter');
  }

  // ── Proposal badges ────────────────────────────────────────────────
  if (ctx.proposalsCreated >= 1) {
    if (await tryAward(env, ctx.userId, 'first_proposal', ctx.daoId))
      awarded.push('first_proposal');
  }
  if (ctx.proposalsPassed >= 1) {
    if (await tryAward(env, ctx.userId, 'passed_proposal', ctx.daoId))
      awarded.push('passed_proposal');
  }
  if (ctx.votedBipartisan) {
    if (await tryAward(env, ctx.userId, 'bipartisan', ctx.daoId)) awarded.push('bipartisan');
  }
  if (ctx.hasConstitutionalProposal) {
    if (await tryAward(env, ctx.userId, 'constitutional', ctx.daoId))
      awarded.push('constitutional');
  }

  // ── Treasury badges ────────────────────────────────────────────────
  if (ctx.treasuryTxCount >= 1) {
    if (await tryAward(env, ctx.userId, 'treasurer', ctx.daoId)) awarded.push('treasurer');
  }
  if (ctx.grantVotes >= 5) {
    if (await tryAward(env, ctx.userId, 'grant_reviewer', ctx.daoId))
      awarded.push('grant_reviewer');
  }
  if (ctx.hasStreamingPayment) {
    if (await tryAward(env, ctx.userId, 'streamer', ctx.daoId)) awarded.push('streamer');
  }
  if (ctx.isMultiSigSigner) {
    if (await tryAward(env, ctx.userId, 'multi_sig_signer', ctx.daoId))
      awarded.push('multi_sig_signer');
  }

  // ── Community badges ───────────────────────────────────────────────
  if (ctx.membersInvited >= 5) {
    if (await tryAward(env, ctx.userId, 'recruiter', ctx.daoId)) awarded.push('recruiter');
  }
  if (ctx.hasDelegation) {
    if (await tryAward(env, ctx.userId, 'mentor', ctx.daoId)) awarded.push('mentor');
  }
  if (ctx.daosVotedIn >= 3) {
    if (await tryAward(env, ctx.userId, 'diplomat', ctx.daoId)) awarded.push('diplomat');
  }
  if (ctx.daysSinceJoin >= 180) {
    if (await tryAward(env, ctx.userId, 'og', ctx.daoId)) awarded.push('og');
  }
  if (ctx.forumAnswers >= 10) {
    if (await tryAward(env, ctx.userId, 'helpful', ctx.daoId)) awarded.push('helpful');
  }

  // ── Special badges ─────────────────────────────────────────────────
  if (ctx.votingPowerPercentile >= 90) {
    if (await tryAward(env, ctx.userId, 'whale', ctx.daoId)) awarded.push('whale');
  }
  if (ctx.usedQuadratic) {
    if (await tryAward(env, ctx.userId, 'quadratic_champion', ctx.daoId))
      awarded.push('quadratic_champion');
  }
  if (ctx.usedGasless) {
    if (await tryAward(env, ctx.userId, 'gasless_goat', ctx.daoId)) awarded.push('gasless_goat');
  }

  return awarded;
}

async function tryAward(
  env: Env,
  userId: string,
  badgeId: string,
  daoId: string,
): Promise<boolean> {
  return awardBadge(env, userId, badgeId, daoId);
}

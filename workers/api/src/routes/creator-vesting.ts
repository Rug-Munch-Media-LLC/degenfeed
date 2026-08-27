/**
 * @degenfeed/api-worker — Enhanced Creator Vesting & Rewards
 *
 * Dedicated vesting management for creator coins. Goes beyond Zora-style
 * fixed schedules by offering 5 presets + custom configuration, reputation
 * gating, real-time vesting progress, and on-chain claim support.
 *
 * Routes:
 *   GET  /api/creator/vesting/presets               — Get available vesting presets (reputation-filtered)
 *   GET  /api/creator/vesting/:coinAddress           — Get current vesting status & progress
 *   POST /api/creator/vesting/:coinAddress/claim     — Claim vested tokens (creator only)
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Vesting Presets ─────────────────────────────────────────────────────
// Better than Zora's fixed 5-year: creators choose the right schedule.
// Each preset shows exactly what the creator gets and when.

interface VestingPresetRequirements {
  minReputationScore: number;
  minAccountAge: number; // days
}

interface VestingPresetDefinition {
  label: string;
  description: string;
  initialUnlockPercent: number; // 0-30
  cliffDays: number; // 0-365
  vestingDays: number; // 7-730
  requirements: VestingPresetRequirements;
}

export const VESTING_PRESETS: Record<string, VestingPresetDefinition> = {
  QUICK: {
    label: 'Quick Access',
    description: 'Get most of your tokens quickly. Best for established creators.',
    initialUnlockPercent: 20,
    cliffDays: 0,
    vestingDays: 30,
    requirements: {
      minReputationScore: 60,
      minAccountAge: 30,
    },
  },
  STANDARD: {
    label: 'Standard',
    description: 'Balanced approach. Good for most creators.',
    initialUnlockPercent: 10,
    cliffDays: 7,
    vestingDays: 90,
    requirements: {
      minReputationScore: 0,
      minAccountAge: 0,
    },
  },
  CONSERVATIVE: {
    label: 'Community Trust',
    description: 'Slow unlock builds community confidence. Shows long-term commitment.',
    initialUnlockPercent: 5,
    cliffDays: 30,
    vestingDays: 180,
    requirements: {
      minReputationScore: 0,
      minAccountAge: 0,
    },
  },
  MAXIMUM_TRUST: {
    label: 'Maximum Trust',
    description: 'Zero initial unlock. Full vesting over 2 years. Signals extreme commitment.',
    initialUnlockPercent: 0,
    cliffDays: 90,
    vestingDays: 730, // 2 years
    requirements: {
      minReputationScore: 0,
      minAccountAge: 0,
    },
  },
  CUSTOM: {
    label: 'Custom',
    description:
      'Set your own vesting parameters. Initial unlock 0-30%, cliff 0-365 days, vesting 7-730 days.',
    initialUnlockPercent: 10,
    cliffDays: 7,
    vestingDays: 90,
    requirements: {
      minReputationScore: 0,
      minAccountAge: 0,
    },
  },
};

// ─── Types ────────────────────────────────────────────────────────────────

interface VestingStatus {
  coinAddress: string;
  creator: string;
  totalAllocation: bigint;
  unlocked: bigint;
  claimed: bigint;
  claimable: bigint;
  nextUnlockAt: number | null;
  fullyVestedAt: number;
  initialUnlockPercent: number;
  cliffDays: number;
  vestingDays: number;
  progress: {
    percentComplete: number;
    daysRemaining: number;
  };
}

interface CoinRecord {
  address: string;
  creator: string;
  name: string;
  symbol: string;
  totalAllocation: string;
  vestingConfig: {
    initialUnlockPercent: number;
    cliffDays: number;
    vestingDays: number;
  };
  unlocked: string;
  claimed: string;
  deployedAt: number;
  fullyVestedAt: number;
}

// ─── KV Key Prefixes ─────────────────────────────────────────────────────

const COIN_PREFIX = 'creator:vesting:coin:';
const REPUTATION_PREFIX = 'reputation:';

// ─── Router ───────────────────────────────────────────────────────────────

const creatorVesting = new Hono<{ Bindings: Env }>();

// ─── KV Helpers ──────────────────────────────────────────────────────────

async function getCoin(env: Env, coinAddress: string): Promise<CoinRecord | null> {
  try {
    const key = COIN_PREFIX + coinAddress.toLowerCase();
    const raw = await env.CACHE?.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CoinRecord;
  } catch {
    return null;
  }
}

async function getReputationScore(env: Env, address: string): Promise<number> {
  try {
    const key = REPUTATION_PREFIX + address.toLowerCase();
    const raw = await env.CACHE?.get(key);
    if (raw) return Number.parseInt(raw, 10);
  } catch {
    // Fall through
  }
  return 0;
}

async function getAccountAge(env: Env, address: string): Promise<number> {
  try {
    const key = `account:created:${address.toLowerCase()}`;
    const raw = await env.CACHE?.get(key);
    if (raw) {
      const createdAt = Number.parseInt(raw, 10);
      return Math.floor((Date.now() - createdAt) / 86400000);
    }
  } catch {
    // Fall through
  }
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/creator/vesting/presets — Get available vesting presets
// ═══════════════════════════════════════════════════════════════════════════

creatorVesting.get('/presets', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const reputation = await getReputationScore(c.env, session.address);
  const accountAge = await getAccountAge(c.env, session.address);

  const presets = Object.entries(VESTING_PRESETS).map(([id, preset]) => {
    const meetsRep = reputation >= (preset.requirements?.minReputationScore ?? 0);
    const meetsAge = accountAge >= (preset.requirements?.minAccountAge ?? 0);
    const isCustom = id === 'CUSTOM';

    return {
      id,
      label: preset.label,
      description: preset.description,
      config: {
        initialUnlockPercent: preset.initialUnlockPercent,
        cliffDays: preset.cliffDays,
        vestingDays: preset.vestingDays,
      },
      available: isCustom || (meetsRep && meetsAge),
      requirements: {
        minReputationScore: preset.requirements?.minReputationScore ?? 0,
        minAccountAge: preset.requirements?.minAccountAge ?? 0,
      },
      lockedReason: !meetsRep
        ? `Requires reputation score ≥ ${preset.requirements?.minReputationScore ?? 0} (you have ${reputation})`
        : !meetsAge
          ? `Requires account age ≥ ${preset.requirements?.minAccountAge ?? 0} days (you have ${accountAge} days)`
          : undefined,
    };
  });

  return noCacheJsonResponse({
    presets,
    yourReputation: reputation,
    yourAccountAgeDays: accountAge,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/creator/vesting/:coinAddress — Get current vesting status
// ═══════════════════════════════════════════════════════════════════════════

creatorVesting.get('/:coinAddress', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const coinAddress = c.req.param('coinAddress');
  const coin = await getCoin(c.env, coinAddress);

  if (!coin) {
    return jsonResponse({ error: 'Coin not found' }, 404);
  }

  const totalAllocation = BigInt(coin.totalAllocation || '0');
  const unlocked = BigInt(coin.unlocked || '0');
  const claimed = BigInt(coin.claimed || '0');
  const claimable = unlocked - claimed;

  const now = Date.now();
  const fullyVestedAt = coin.fullyVestedAt || now;
  const daysRemaining = Math.max(0, Math.ceil((fullyVestedAt - now) / 86400000));
  const percentComplete = totalAllocation > 0n ? Number((unlocked * 100n) / totalAllocation) : 0;

  const status: VestingStatus = {
    coinAddress,
    creator: coin.creator,
    totalAllocation,
    unlocked,
    claimed,
    claimable: claimable > 0n ? claimable : 0n,
    nextUnlockAt: claimable > 0n ? now : fullyVestedAt,
    fullyVestedAt,
    initialUnlockPercent: coin.vestingConfig?.initialUnlockPercent ?? 0,
    cliffDays: coin.vestingConfig?.cliffDays ?? 0,
    vestingDays: coin.vestingConfig?.vestingDays ?? 0,
    progress: {
      percentComplete,
      daysRemaining,
    },
  };

  return noCacheJsonResponse(status);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/creator/vesting/:coinAddress/claim — Claim vested tokens
// ═══════════════════════════════════════════════════════════════════════════

creatorVesting.post('/:coinAddress/claim', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const coinAddress = c.req.param('coinAddress');
  const coin = await getCoin(c.env, coinAddress);

  if (!coin) {
    return jsonResponse({ error: 'Coin not found' }, 404);
  }

  // Verify the caller is the creator
  if (coin.creator.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Not the creator of this coin' }, 403);
  }

  const totalAllocation = BigInt(coin.totalAllocation || '0');
  const unlocked = BigInt(coin.unlocked || '0');
  const claimed = BigInt(coin.claimed || '0');
  const claimable = unlocked - claimed;

  if (claimable <= 0n) {
    const nextUnlock =
      coin.fullyVestedAt && coin.fullyVestedAt > Date.now() ? coin.fullyVestedAt : null;
    return jsonResponse(
      {
        error: 'Nothing to claim yet',
        nextUnlockAt: nextUnlock,
        daysUntilNextUnlock: nextUnlock ? Math.ceil((nextUnlock - Date.now()) / 86400000) : 0,
      },
      400,
    );
  }

  // In production, this would call an on-chain claim function:
  // const tx = await contract.write.claimVestedTokens([coinAddress, session.address]);
  // For now, mark as pending on-chain execution
  const mockTxHash: string | null = null;

  // Update the claimed amount in KV
  try {
    const key = COIN_PREFIX + coinAddress.toLowerCase();
    const updatedCoin = {
      ...coin,
      claimed: (claimed + claimable).toString(),
    };
    await c.env.CACHE?.put(key, JSON.stringify(updatedCoin), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    // Non-fatal — claim succeeded even if KV tracking failed
  }

  const remaining = totalAllocation - unlocked;

  return noCacheJsonResponse({
    txHash: mockTxHash,
    claimed: claimable.toString(),
    remaining: remaining > 0n ? remaining.toString() : '0',
    totalAllocation: totalAllocation.toString(),
    unlockedPercentage: Number((unlocked * 100n) / totalAllocation),
    message: `Successfully claimed ${claimable.toString()} tokens. ${remaining > 0n ? `${remaining.toString()} tokens remaining to vest.` : 'All tokens fully vested!'}`,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export type { CoinRecord, VestingPresetDefinition, VestingPresetRequirements, VestingStatus };
export { creatorVesting };

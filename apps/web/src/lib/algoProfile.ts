/**
 * @degenfeed/web — Algo Profile (personalization for the top-tier 2026 feed algorithm)
 *
 * Lightweight client-side engagement profile persisted to localStorage
 * (a server API can replace it later — the shape is intentionally plain).
 *
 * The profile tracks which protocols, topics (niches), and creators the user
 * engages with so the feed can:
 *   - boost similar content (personalization),
 *   - avoid the user's bubble when the "Discover" slider is raised
 *     (serendipity injection),
 *   - power the "Why this?" transparency copy ("You engage with Nostr posts").
 *
 * Affinities decay over a 14-day half-life so stale interests fade out.
 */

import type { UnifiedPost } from '@degenfeed/types';

export const ALGO_PROFILE_STORAGE_KEY = 'df_algo_profile_v1';

export type AlgoEngagementAction =
  | 'like'
  | 'repost'
  | 'reply'
  | 'tip'
  | 'bookmark'
  | 'dismiss'
  | 'view';

export interface AlgoProfile {
  /** protocol → 0..1 engagement weight */
  protocols: Record<string, number>;
  /** topic/niche → -1..1 interest weight (positive = interested) */
  topics: Record<string, number>;
  /** engaged creator ids, most recent first (FIFO cap 100) */
  creators: string[];
  /** last write timestamp (unix ms) */
  updatedAt: number;
}

export const EMPTY_ALGO_PROFILE: AlgoProfile = {
  protocols: {},
  topics: {},
  creators: [],
  updatedAt: 0,
};

const AFFINITY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MAX_CREATORS = 100;

export const ALGO_ACTION_WEIGHTS: Record<AlgoEngagementAction, number> = {
  like: 0.3,
  repost: 0.4,
  reply: 0.5,
  tip: 0.6,
  bookmark: 0.4,
  view: 0.05,
  dismiss: -0.3,
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const clamp11 = (v: number): number => Math.min(1, Math.max(-1, v));

export function emptyAlgoProfile(): AlgoProfile {
  return { protocols: {}, topics: {}, creators: [], updatedAt: 0 };
}

/** Load the persisted profile (safe on the server / private mode). */
export function loadAlgoProfile(): AlgoProfile {
  if (typeof window === 'undefined') return emptyAlgoProfile();
  try {
    const raw = window.localStorage.getItem(ALGO_PROFILE_STORAGE_KEY);
    if (!raw) return emptyAlgoProfile();
    const parsed = JSON.parse(raw) as Partial<AlgoProfile>;
    return {
      protocols: parsed.protocols && typeof parsed.protocols === 'object' ? parsed.protocols : {},
      topics: parsed.topics && typeof parsed.topics === 'object' ? parsed.topics : {},
      creators: Array.isArray(parsed.creators) ? parsed.creators : [],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return emptyAlgoProfile();
  }
}

/** Persist the profile (best-effort — localStorage can be full/blocked). */
export function saveAlgoProfile(profile: AlgoProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ALGO_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* storage full / unavailable — profile stays in memory for the session */
  }
}

/** Apply exponential decay to all affinities based on elapsed time. */
export function decayAlgoProfile(profile: AlgoProfile, now = Date.now()): AlgoProfile {
  if (!profile.updatedAt) return { ...profile, updatedAt: now };
  const elapsed = now - profile.updatedAt;
  if (elapsed <= 0) return { ...profile, updatedAt: now };
  const factor = 0.5 ** (elapsed / AFFINITY_HALF_LIFE_MS);

  const protocols: Record<string, number> = {};
  for (const [k, v] of Object.entries(profile.protocols)) protocols[k] = clamp01(v * factor);
  const topics: Record<string, number> = {};
  for (const [k, v] of Object.entries(profile.topics)) topics[k] = clamp11(v * factor);

  return { protocols, topics, creators: [...profile.creators], updatedAt: now };
}

/**
 * Record an engagement with a post and return an updated profile.
 * Positive actions (like/repost/reply/tip/bookmark) strengthen protocol,
 * topic, and creator affinity; dismiss weakens topic affinity.
 */
export function recordAlgoEngagement(
  profile: AlgoProfile,
  post: UnifiedPost,
  action: AlgoEngagementAction,
): AlgoProfile {
  const weight = ALGO_ACTION_WEIGHTS[action] ?? 0;
  if (weight === 0) return profile;
  const next = decayAlgoProfile(profile);

  // Protocol affinity — engagement-weighted, gentle.
  const protoKey = post.protocol;
  next.protocols[protoKey] = clamp01((next.protocols[protoKey] ?? 0) + weight * 0.5);

  // Topic (niche) affinity — full weight, signed (dismiss demotes).
  for (const niche of post.niches ?? []) {
    const key = niche.toLowerCase();
    next.topics[key] = clamp11((next.topics[key] ?? 0) + weight);
  }

  // Creator affinity — positive signals only, most-recent-first FIFO.
  if (weight > 0.15 && post.author?.id) {
    next.creators = [post.author.id, ...next.creators.filter((id) => id !== post.author.id)].slice(
      0,
      MAX_CREATORS,
    );
  }

  next.updatedAt = Date.now();
  return next;
}

/** True once the profile has enough signal to personalize (or define a bubble). */
export function hasAlgoProfileSignal(profile: AlgoProfile): boolean {
  const topicSignals = Object.values(profile.topics).filter((w) => Math.abs(w) > 0.05).length;
  const protocolSignals = Object.values(profile.protocols).filter((w) => w > 0.05).length;
  return topicSignals + protocolSignals + profile.creators.length >= 3;
}

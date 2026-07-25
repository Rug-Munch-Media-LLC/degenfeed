/**
 * @degenfeed/feed-core — Feed Personalization V2
 *
 * Enhanced personalization beyond V1 with:
 * 1. Implicit signals: scroll depth, dwell time, click-through rate
 * 2. Explicit signals: "Show more like this" / "Show less like this"
 * 3. Temporal preferences: Different content at different times of day
 * 4. Session optimization: Show best content first in each session
 *
 * Integrates with existing feedback and dwell tracking systems.
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ImplicitSignal {
  /** Total milliseconds spent viewing this type of content */
  totalDwellMs: number;
  /** Average scroll depth (0-1, how far user scrolled) */
  avgScrollDepth: number;
  /** Click-through rate (0-1) */
  clickThroughRate: number;
  /** How often user engages with this content type (0-1) */
  engagementFrequency: number;
  /** Time of day user typically sees this (0-23) */
  preferredHour: number;
  /** Day of week user typically sees this (0-6) */
  preferredDayOfWeek: number;
}

export interface ExplicitSignal {
  /** Number of "show more like this" actions */
  showMoreCount: number;
  /** Number of "show less like this" actions */
  showLessCount: number;
  /** Net preference score (-3 to +3) */
  netScore: number;
  /** Most recent action timestamp */
  lastActionAt: number;
}

export interface CreatorAffinity {
  creatorId: string;
  /** 0-1: how much the user likes this creator */
  affinity: number;
  /** Number of interactions with this creator */
  interactionCount: number;
  /** Average dwell time on this creator's content (ms) */
  avgDwellMs: number;
  /** Last interaction timestamp */
  lastInteractionAt: number;
}

export interface TemporalPreference {
  /** Hour of day (0-23) */
  hour: number;
  /** Preferred niches at this hour */
  preferredNiches: string[];
  /** Preferred content types at this hour */
  preferredContentTypes: string[];
  /** Preferred protocol(s) at this hour */
  preferredProtocols: string[];
  /** Engagement level at this hour (0-1) */
  engagementLevel: number;
}

export interface PersonalizationV2Profile {
  /** Creator affinities, keyed by creator ID */
  creatorAffinities: Map<string, CreatorAffinity>;
  /** Niche affinity scores (0-1) */
  nicheAffinities: Map<string, number>;
  /** Content type preferences (0-1) */
  contentTypePreferences: Map<string, number>;
  /** Protocol preferences (0-1) */
  protocolPreferences: Map<string, number>;
  /** Temporal preferences by hour */
  temporalPreferences: TemporalPreference[];
  /** Implicit signals per niche */
  implicitSignals: Map<string, ImplicitSignal>;
  /** Explicit signals per niche */
  explicitSignals: Map<string, ExplicitSignal>;
  /** Session history for session optimization */
  sessionHistory: SessionEntry[];
  /** Last updated timestamp */
  lastUpdated: number;
}

export interface SessionEntry {
  /** Session start timestamp */
  sessionStart: number;
  /** Posts viewed in this session */
  postIds: string[];
  /** Average dwell time for this session */
  avgDwellMs: number;
  /** Total engagement actions in this session */
  totalEngagements: number;
  /** What niches were viewed */
  nichesViewed: string[];
}

export interface PersonalizationV2Result {
  /** Multiplicative boost (0.1-3.0) applied to post score */
  multiplier: number;
  /** Reasons for the multiplier */
  reasons: string[];
  /** Creator affinity score (0-1) */
  creatorAffinity: number;
  /** Niche affinity score (0-1) */
  nicheAffinity: number;
  /** Temporal match score (0-1) */
  temporalMatch: number;
  /** Session boost (0-1) */
  sessionBoost: number;
}

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_SESSION_HISTORY = 50;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min without activity = new session
const AFFINITY_DECAY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Profile Management ────────────────────────────────────────────────

export function emptyPersonalizationV2Profile(): PersonalizationV2Profile {
  return {
    creatorAffinities: new Map(),
    nicheAffinities: new Map(),
    contentTypePreferences: new Map(),
    protocolPreferences: new Map(),
    temporalPreferences: HOURS.map((hour) => ({
      hour,
      preferredNiches: [],
      preferredContentTypes: [],
      preferredProtocols: [],
      engagementLevel: 0.5,
    })),
    implicitSignals: new Map(),
    explicitSignals: new Map(),
    sessionHistory: [],
    lastUpdated: Date.now(),
  };
}

// ─── Implicit Signal Learning ──────────────────────────────────────────

/**
 * Learn from implicit signals: scroll depth, dwell time, click-through.
 * Updates creator affinities and niche preferences.
 */
export function learnFromImplicitSignal(
  profile: PersonalizationV2Profile,
  post: UnifiedPost,
  dwellMs: number,
  scrollDepth: number,
  clickedThrough: boolean,
  now: number,
): PersonalizationV2Profile {
  const updated = { ...profile };
  applyDecay(updated, now);

  // ── Update creator affinity ────────────────────────────────────────
  const creatorId = post.author.id;
  const existingCreator = updated.creatorAffinities.get(creatorId);
  const interactionWeight = dwellMs > 30000 ? 0.3 : dwellMs > 5000 ? 0.15 : 0.05;

  if (existingCreator) {
    const decay = 0.95;
    existingCreator.affinity = existingCreator.affinity * decay + interactionWeight * (1 - decay);
    existingCreator.interactionCount++;
    existingCreator.avgDwellMs = (existingCreator.avgDwellMs * (existingCreator.interactionCount - 1) + dwellMs) / existingCreator.interactionCount;
    existingCreator.lastInteractionAt = now;
    updated.creatorAffinities.set(creatorId, existingCreator);
  } else {
    updated.creatorAffinities.set(creatorId, {
      creatorId,
      affinity: 0.1 + interactionWeight,
      interactionCount: 1,
      avgDwellMs: dwellMs,
      lastInteractionAt: now,
    });
  }

  // ── Update niche affinities ─────────────────────────────────────────
  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    const existingNiche = updated.nicheAffinities.get(lower) ?? 0;
    // Dwell time weights the signal
    const dwellWeight = Math.min(1, dwellMs / 30000);
    const signalStrength = clickedThrough ? 0.2 : 0.05;
    const newValue = existingNiche * 0.9 + (dwellWeight * signalStrength) * 0.1;
    updated.nicheAffinities.set(lower, Math.min(1, newValue));
  }

  // ── Update implicit signals per niche ───────────────────────────────
  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    const existing = updated.implicitSignals.get(lower) ?? {
      totalDwellMs: 0,
      avgScrollDepth: 0,
      clickThroughRate: 0,
      engagementFrequency: 0,
      preferredHour: new Date(now).getHours(),
      preferredDayOfWeek: new Date(now).getDay(),
    };

    existing.totalDwellMs += dwellMs;
    existing.avgScrollDepth = existing.avgScrollDepth * 0.95 + scrollDepth * 0.05;
    existing.clickThroughRate = existing.clickThroughRate * 0.95 + (clickedThrough ? 0.3 : 0) * 0.05;
    existing.engagementFrequency = existing.engagementFrequency * 0.9 + 0.1;

    updated.implicitSignals.set(lower, existing);
  }

  // ── Update content type preferences ─────────────────────────────────
  const contentType = (post as unknown as Record<string, unknown>).contentType as string ?? 'text';
  const existingCtype = updated.contentTypePreferences.get(contentType) ?? 0.5;
  const ctypeSignal = dwellMs > 10000 ? 0.1 : 0.02;
  updated.contentTypePreferences.set(contentType, Math.min(1, existingCtype * 0.9 + ctypeSignal * 0.1));

  // ── Update protocol preferences ─────────────────────────────────────
  const existingProto = updated.protocolPreferences.get(post.protocol) ?? 0.5;
  const protoSignal = dwellMs > 5000 ? 0.05 : 0.01;
  updated.protocolPreferences.set(post.protocol, Math.min(1, existingProto * 0.95 + protoSignal * 0.05));

  updated.lastUpdated = now;
  return updated;
}

// ─── Explicit Signal Learning ──────────────────────────────────────────

/**
 * Process explicit "Show more like this" / "Show less like this" feedback.
 */
export function learnFromExplicitSignal(
  profile: PersonalizationV2Profile,
  post: UnifiedPost,
  action: 'show-more' | 'show-less',
  now: number,
): PersonalizationV2Profile {
  const updated = { ...profile };
  applyDecay(updated, now);

  const delta = action === 'show-more' ? 0.3 : -0.5;

  // ── Update niche explicit signals ───────────────────────────────────
  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    const existing = updated.explicitSignals.get(lower) ?? {
      showMoreCount: 0,
      showLessCount: 0,
      netScore: 0,
      lastActionAt: 0,
    };

    if (action === 'show-more') existing.showMoreCount++;
    else existing.showLessCount++;

    existing.netScore = Math.max(-3, Math.min(3, existing.netScore + delta));
    existing.lastActionAt = now;
    updated.explicitSignals.set(lower, existing);

    // Also update niche affinities directly
    const currentAffinity = updated.nicheAffinities.get(lower) ?? 0.5;
    updated.nicheAffinities.set(lower, Math.max(0, Math.min(1, currentAffinity + delta * 0.1)));
  }

  // ── Update creator directly ─────────────────────────────────────────
  const creatorId = post.author.id;
  const existingCreator = updated.creatorAffinities.get(creatorId);
  if (existingCreator) {
    const creatorDelta = action === 'show-more' ? 0.2 : -0.4;
    existingCreator.affinity = Math.max(0, Math.min(1, existingCreator.affinity + creatorDelta));
    existingCreator.lastInteractionAt = now;
    updated.creatorAffinities.set(creatorId, existingCreator);
  }

  // ── Update content type ─────────────────────────────────────────────
  const contentType = (post as unknown as Record<string, unknown>).contentType as string ?? 'text';
  const existingCtype = updated.contentTypePreferences.get(contentType) ?? 0.5;
  const ctypeDelta = action === 'show-more' ? 0.15 : -0.3;
  updated.contentTypePreferences.set(contentType, Math.max(0, Math.min(1, existingCtype + ctypeDelta)));

  updated.lastUpdated = now;
  return updated;
}

// ─── Temporal Preference Learning ──────────────────────────────────────

/**
 * Update temporal preferences based on when the user engages with content.
 */
export function learnTemporalPreference(
  profile: PersonalizationV2Profile,
  post: UnifiedPost,
  dwellMs: number,
  now: number,
): PersonalizationV2Profile {
  const updated = { ...profile };
  const hour = new Date(now).getHours();

  // Update the temporal slot for this hour
  const slotIndex = updated.temporalPreferences.findIndex((t) => t.hour === hour);
  if (slotIndex >= 0) {
    const slot = { ...updated.temporalPreferences[slotIndex]! };

    // Track niches at this hour
    for (const niche of post.niches) {
      if (!slot.preferredNiches.includes(niche) && dwellMs > 3000) {
        slot.preferredNiches.push(niche);
      }
    }

    // Track content types at this hour
    const contentType = (post as unknown as Record<string, unknown>).contentType as string ?? 'text';
    if (!slot.preferredContentTypes.includes(contentType) && dwellMs > 3000) {
      slot.preferredContentTypes.push(contentType);
    }

    // Track protocols at this hour
    if (!slot.preferredProtocols.includes(post.protocol) && dwellMs > 5000) {
      slot.preferredProtocols.push(post.protocol);
    }

    // Update engagement level (rolling average)
    slot.engagementLevel = slot.engagementLevel * 0.9 + (dwellMs > 5000 ? 0.1 : 0);

    const updatedSlots = [...updated.temporalPreferences];
    updatedSlots[slotIndex] = slot;
    updated.temporalPreferences = updatedSlots;
  }

  updated.lastUpdated = now;
  return updated;
}

// ─── Session Optimization ──────────────────────────────────────────────

/**
 * Record a post view in the current session.
 * Sessions are time-bucketed (30 min timeout).
 */
export function recordSessionView(
  profile: PersonalizationV2Profile,
  post: UnifiedPost,
  dwellMs: number,
  now: number,
): PersonalizationV2Profile {
  const updated = { ...profile };

  // Find or create current session
  const lastSession = updated.sessionHistory[0];
  let currentSession: SessionEntry;

  if (lastSession && (now - lastSession.sessionStart) < SESSION_TIMEOUT_MS) {
    currentSession = { ...lastSession };
    // Remove old reference
    updated.sessionHistory.shift();
  } else {
    currentSession = {
      sessionStart: now,
      postIds: [],
      avgDwellMs: 0,
      totalEngagements: 0,
      nichesViewed: [],
    };
  }

  currentSession.postIds = [...currentSession.postIds, post.id];
  if (currentSession.postIds.length > 1) {
    const prevAvg = currentSession.avgDwellMs;
    const prevCount = currentSession.postIds.length - 1;
    currentSession.avgDwellMs = (prevAvg * prevCount + dwellMs) / currentSession.postIds.length;
  } else {
    currentSession.avgDwellMs = dwellMs;
  }

  for (const niche of post.niches) {
    if (!currentSession.nichesViewed.includes(niche)) {
      currentSession.nichesViewed.push(niche);
    }
  }

  updated.sessionHistory = [currentSession, ...updated.sessionHistory].slice(0, MAX_SESSION_HISTORY);
  updated.lastUpdated = now;
  return updated;
}

/**
 * Compute session optimization boost.
 * Shows more content similar to what the user engaged with in this session.
 */
export function computeSessionBoost(
  profile: PersonalizationV2Profile,
  post: UnifiedPost,
  now: number,
): number {
  const currentSession = profile.sessionHistory[0];
  if (!currentSession || (now - currentSession.sessionStart) > SESSION_TIMEOUT_MS) return 1.0;

  // If session has no meaningful engagement, no boost
  if (currentSession.postIds.length < 2) return 1.0;

  let boost = 1.0;

  // Boost for same niches as session
  const nicheOverlap = post.niches.filter((n) => currentSession.nichesViewed.includes(n)).length;
  if (nicheOverlap > 0) {
    boost += nicheOverlap * 0.1;
  }

  // Boost for similar content based on session engagement level
  if (currentSession.avgDwellMs > 20000) {
    boost += 0.2; // User is deeply engaged, show more substantive content
  } else if (currentSession.avgDwellMs < 3000 && currentSession.postIds.length > 5) {
    boost += 0.15; // User is scrolling fast, show shorter content
  }

  // Don't repeat posts already seen this session
  if (currentSession.postIds.includes(post.id)) {
    boost = 0.01; // Effectively filter out
  }

  return Math.max(0.01, Math.min(3.0, boost));
}

// ─── Decay ─────────────────────────────────────────────────────────────

function applyDecay(profile: PersonalizationV2Profile, now: number): void {
  const elapsed = now - profile.lastUpdated;
  if (elapsed <= 0) return;

  const decayFactor = Math.pow(0.5, elapsed / AFFINITY_DECAY_HALF_LIFE_MS);

  // Decay niche affinities
  for (const [niche, value] of profile.nicheAffinities) {
    profile.nicheAffinities.set(niche, value * decayFactor);
  }

  // Decay creator affinities
  for (const [id, creator] of profile.creatorAffinities) {
    creator.affinity *= decayFactor;
    profile.creatorAffinities.set(id, creator);
  }

  // Decay content type preferences
  for (const [type, value] of profile.contentTypePreferences) {
    profile.contentTypePreferences.set(type, value * decayFactor);
  }

  // Decay temporal engagement levels
  for (let i = 0; i < profile.temporalPreferences.length; i++) {
    profile.temporalPreferences[i]!.engagementLevel *= decayFactor;
  }
}

// ─── Scoring ───────────────────────────────────────────────────────────

export function scorePersonalizationV2(
  profile: PersonalizationV2Profile,
  post: UnifiedPost,
  now: number,
): PersonalizationV2Result {
  const reasons: string[] = [];

  // ── 1. Creator Affinity ────────────────────────────────────────────
  const creatorAff = profile.creatorAffinities.get(post.author.id);
  let creatorScore = 0.5; // baseline
  if (creatorAff) {
    creatorScore = Math.min(1, creatorAff.affinity * 2); // Scale up
    if (creatorScore > 0.8) reasons.push('top-creator');
    else if (creatorScore > 0.5) reasons.push('preferred-creator');
  }

  // ── 2. Niche Affinity ──────────────────────────────────────────────
  let nicheScore = 0.5;
  let nicheMatches = 0;
  for (const niche of post.niches) {
    const affinity = profile.nicheAffinities.get(niche.toLowerCase()) ?? 0;
    if (affinity > 0.5) nicheMatches++;
    nicheScore += affinity;
  }
  nicheScore = post.niches.length > 0
    ? Math.min(1, nicheScore / Math.max(post.niches.length, 1))
    : 0.5;

  // ── 3. Explicit signal adjustment ──────────────────────────────────
  for (const niche of post.niches) {
    const signal = profile.explicitSignals.get(niche.toLowerCase());
    if (signal) {
      if (signal.netScore > 1) {
        nicheScore = Math.min(1, nicheScore + 0.2);
        reasons.push('explicit-boost');
      } else if (signal.netScore < -1) {
        nicheScore = Math.max(0, nicheScore - 0.3);
        reasons.push('explicit-demote');
      }
    }
  }

  // ── 4. Content Type Affinity ───────────────────────────────────────
  const contentType = (post as unknown as Record<string, unknown>).contentType as string ?? 'text';
  const ctypePref = profile.contentTypePreferences.get(contentType) ?? 0.5;

  // ── 5. Protocol Affinity ───────────────────────────────────────────
  const protoPref = profile.protocolPreferences.get(post.protocol) ?? 0.5;

  // ── 6. Temporal Match ──────────────────────────────────────────────
  const hour = new Date(now).getHours();
  const temporalSlot = profile.temporalPreferences.find((t) => t.hour === hour);
  let temporalScore = 0.5;
  if (temporalSlot) {
    const nicheMatch = post.niches.some((n) => temporalSlot.preferredNiches.includes(n));
    const typeMatch = temporalSlot.preferredContentTypes.includes(contentType);
    const protoMatch = temporalSlot.preferredProtocols.includes(post.protocol);

    if (nicheMatch && temporalSlot.engagementLevel > 0.6) temporalScore = 1.0;
    else if (typeMatch || protoMatch) temporalScore = 0.8;
    else if (temporalSlot.engagementLevel > 0.8) temporalScore = 0.7; // User is active now
    else temporalScore = 0.4;

    if (temporalScore > 0.7) reasons.push('temporal-match');
  }

  // ── 7. Session Optimization ────────────────────────────────────────
  const sessionBoost = computeSessionBoost(profile, post, now);
  if (sessionBoost > 1.2) reasons.push('session-optimized');

  // ── 8. Implicit signal check ───────────────────────────────────────
  let implicitBoost = 1.0;
  for (const niche of post.niches) {
    const signal = profile.implicitSignals.get(niche.toLowerCase());
    if (signal) {
      // High click-through = strong relevance signal
      if (signal.clickThroughRate > 0.3) implicitBoost = Math.max(implicitBoost, 1.3);
      // High dwell time = deep interest
      if (signal.avgScrollDepth > 0.7) implicitBoost = Math.max(implicitBoost, 1.2);
    }
  }
  if (implicitBoost > 1.1) reasons.push('implicit-interest');

  // ── Composite multiplier ───────────────────────────────────────────
  const weights = {
    creator: 0.25,
    niche: 0.25,
    temporal: 0.15,
    session: 0.15,
    contentType: 0.10,
    protocol: 0.10,
  };

  const composite =
    creatorScore * weights.creator +
    nicheScore * weights.niche +
    temporalScore * weights.temporal +
    Math.min(1, sessionBoost * 0.5) * weights.session +
    ctypePref * weights.contentType +
    protoPref * weights.protocol;

  // Scale from 0-1 to multiplier 0.3-2.0
  const multiplier = 0.3 + composite * 1.7;
  const clampedMultiplier = implicitBoost > 1 ? Math.min(multiplier * 1.2, 3.0) : multiplier;

  return {
    multiplier: Math.round(clampedMultiplier * 100) / 100,
    reasons: [...new Set(reasons)],
    creatorAffinity: Math.round(creatorScore * 100) / 100,
    nicheAffinity: Math.round(nicheScore * 100) / 100,
    temporalMatch: Math.round(temporalScore * 100) / 100,
    sessionBoost: Math.round(sessionBoost * 100) / 100,
  };
}

// ─── Serialization ─────────────────────────────────────────────────────

/**
 * Serialize profile to plain object for storage (Map → object).
 */
export function serializePersonalizationV2(profile: PersonalizationV2Profile): unknown {
  return {
    creatorAffinities: Object.fromEntries(profile.creatorAffinities),
    nicheAffinities: Object.fromEntries(profile.nicheAffinities),
    contentTypePreferences: Object.fromEntries(profile.contentTypePreferences),
    protocolPreferences: Object.fromEntries(profile.protocolPreferences),
    temporalPreferences: profile.temporalPreferences,
    implicitSignals: Object.fromEntries(profile.implicitSignals),
    explicitSignals: Object.fromEntries(profile.explicitSignals),
    sessionHistory: profile.sessionHistory,
    lastUpdated: profile.lastUpdated,
  };
}

/**
 * Deserialize plain object back to PersonalizationV2Profile.
 */
export function deserializePersonalizationV2(data: unknown): PersonalizationV2Profile {
  const d = data as Record<string, unknown>;

  const creatorEntries = Object.entries((d.creatorAffinities as Record<string, unknown>) ?? {});
  const creatorAffinities: Map<string, CreatorAffinity> = new Map();
  for (const [key, val] of creatorEntries) {
    creatorAffinities.set(key, val as CreatorAffinity);
  }

  const nicheEntries = Object.entries((d.nicheAffinities as Record<string, unknown>) ?? {});
  const nicheAffinities: Map<string, number> = new Map();
  for (const [key, val] of nicheEntries) {
    nicheAffinities.set(key, val as number);
  }

  const ctypeEntries = Object.entries((d.contentTypePreferences as Record<string, unknown>) ?? {});
  const contentTypePreferences: Map<string, number> = new Map();
  for (const [key, val] of ctypeEntries) {
    contentTypePreferences.set(key, val as number);
  }

  const protoEntries = Object.entries((d.protocolPreferences as Record<string, unknown>) ?? {});
  const protocolPreferences: Map<string, number> = new Map();
  for (const [key, val] of protoEntries) {
    protocolPreferences.set(key, val as number);
  }

  const implicitEntries = Object.entries((d.implicitSignals as Record<string, unknown>) ?? {});
  const implicitSignals: Map<string, ImplicitSignal> = new Map();
  for (const [key, val] of implicitEntries) {
    implicitSignals.set(key, val as ImplicitSignal);
  }

  const explicitEntries = Object.entries((d.explicitSignals as Record<string, unknown>) ?? {});
  const explicitSignals: Map<string, ExplicitSignal> = new Map();
  for (const [key, val] of explicitEntries) {
    explicitSignals.set(key, val as ExplicitSignal);
  }

  return {
    creatorAffinities,
    nicheAffinities,
    contentTypePreferences,
    protocolPreferences,
    temporalPreferences: (d.temporalPreferences as TemporalPreference[]) ?? HOURS.map((hour) => ({
      hour,
      preferredNiches: [],
      preferredContentTypes: [],
      preferredProtocols: [],
      engagementLevel: 0.5,
    })),
    implicitSignals,
    explicitSignals,
    sessionHistory: (d.sessionHistory as SessionEntry[]) ?? [],
    lastUpdated: (d.lastUpdated as number) ?? Date.now(),
  };
}

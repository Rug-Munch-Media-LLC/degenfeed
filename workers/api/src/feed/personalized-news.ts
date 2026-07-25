/**
 * personalized-news — Personalized news feed engine.
 *
 * Scores and ranks news stories per user based on:
 * - Topic preferences (weighted from reading history)
 * - Source preferences (boost sources the user engages with)
 * - Novelty vs familiarity (70% preferred topics, 30% discovery)
 * - Depth preferences (deep analysis vs headlines)
 * - Time-of-day optimization (morning/midday/evening)
 *
 * newsScore = (
 *   topicalRelevance × 0.35 +
 *   sourceCredibility × 0.20 +
 *   freshness × 0.20 +
 *   engagementVelocity × 0.15 +
 *   depthMatch × 0.10
 * ) × storyImportance × sentimentBias
 */

import type { AggregatedStory } from './news-aggregator';
import { classifyStory } from './topic-modeler';

// ─── User Preferences ──────────────────────────────────────────────────

export interface NewsPreferences {
  /** Topic weights (0–100): categoryId → weight */
  topicWeights: Record<string, number>;
  /** Source boost: sourceId → boost multiplier */
  sourceBoosts: Record<string, number>;
  /** Muted categories */
  mutedCategories: string[];
  /** Muted sources */
  mutedSources: string[];
  /** Muted entities (tokens, authors) */
  mutedEntities: string[];
  /** Depth preference: 'headlines' | 'balanced' | 'deep' */
  depthPreference: 'headlines' | 'balanced' | 'deep';
  /** Discovery ratio: 0–1 (default 0.3 = 30% discovery) */
  discoveryRatio: number;
}

export const DEFAULT_PREFERENCES: NewsPreferences = {
  topicWeights: {
    bitcoin: 50,
    ethereum: 50,
    solana: 50,
    defi: 50,
    ai: 50,
    regulation: 50,
    security: 50,
    markets: 50,
    macro: 40,
    vc: 30,
    layer2: 40,
    nft: 30,
    memes: 20,
    gaming: 30,
  },
  sourceBoosts: {},
  mutedCategories: [],
  mutedSources: [],
  mutedEntities: [],
  depthPreference: 'balanced',
  discoveryRatio: 0.3,
};

// ─── Reading History (KV-backed) ───────────────────────────────────────

export interface ReadHistoryEntry {
  storyId: string;
  categoryId: string;
  sourceId: string;
  readAt: number;
  dwellTimeMs: number;
  engaged: boolean; // true if user liked/saved/shared
}

export interface UserProfile {
  /** Preferred categories weighted by reading history engagement */
  topicWeights: Record<string, number>;
  /** Sources the user consistently engages with */
  preferredSources: string[];
  /** Average reading depth (headline vs deep) */
  avgDwellTimeMs: number;
  /** Reading time-of-day pattern */
  timeOfDayPreference: 'morning' | 'midday' | 'evening';
  /** Total stories read */
  totalRead: number;
  /** Last updated */
  lastUpdated: number;
}

// ─── Score Computation ─────────────────────────────────────────────────

export interface NewsScoreComponents {
  topicalRelevance: number;
  sourceCredibility: number;
  freshness: number;
  engagementVelocity: number;
  depthMatch: number;
  sentimentBias: number;
  storyImportance: number;
  total: number;
}

/**
 * Compute the personalized news score for a story given user preferences.
 */
export function computePersonalizedScore(
  story: AggregatedStory,
  prefs: NewsPreferences,
  profile: UserProfile | null,
  now: number,
): NewsScoreComponents {
  // 1. Topical Relevance (0–1)
  const classification = classifyStory(story);
  const primaryCat = classification.primary.categoryId;
  const topicWeight = prefs.topicWeights[primaryCat] ?? 30;
  const hasMutedCategory = prefs.mutedCategories.includes(primaryCat);
  const topicalRelevance = hasMutedCategory ? 0 : topicWeight / 100;

  // Boost if user has preferred this category before
  const profileBoost = profile?.topicWeights[primaryCat]
    ? profile.topicWeights[primaryCat] / 100
    : 0;
  const effectiveTopicalRelevance = Math.max(topicalRelevance, profileBoost * 0.5);

  // 2. Source Credibility (0–1)
  const sourceBoost = prefs.sourceBoosts[story.sourceMeta.id] ?? 1;
  const isMutedSource = prefs.mutedSources.includes(story.sourceMeta.id);
  const sourceCredibility = isMutedSource ? 0 : Math.min(1, story.credibility * sourceBoost);

  // 3. Freshness (0–1)
  const ageMs = now - story.publishedAt;
  const ageHrs = ageMs / 3600000;
  const freshness = Math.max(0, 1 - ageHrs / 72); // Decays over 72 hours, breaking news boost

  // 4. Engagement Velocity (0–1)
  const velocity = Math.min(1, story.velocity / 10);

  // 5. Depth Match (0–1)
  const wordCount = story.body.split(/\s+/).length;
  let depthMatch: number;
  if (prefs.depthPreference === 'headlines') {
    depthMatch = wordCount < 100 ? 1 : Math.max(0, 1 - (wordCount - 100) / 500);
  } else if (prefs.depthPreference === 'deep') {
    depthMatch = wordCount > 300 ? 1 : Math.max(0, wordCount / 300);
  } else {
    depthMatch = wordCount > 100 && wordCount < 500 ? 1 : 0.5;
  }

  // 6. Sentiment Bias (0.8–1.2)
  const sentimentBias =
    story.sentiment.label === 'bullish' ? 1.1 : story.sentiment.label === 'bearish' ? 0.9 : 1.0;

  // 7. Story Importance (0–2 multiplier)
  const alsoCovered = story.alsoCoveredBy.length;
  const entityRichness = story.entities.tokens.length + story.entities.protocols.length;
  const storyImportance =
    1 + (alsoCovered > 3 ? 0.3 : 0) + (entityRichness > 3 ? 0.2 : 0) + (story.isBreaking ? 0.5 : 0);

  // 8. Time-of-day optimization
  const hour = new Date(now).getHours();
  let timeOfDayBoost = 1;
  if (profile?.timeOfDayPreference === 'morning' && hour >= 6 && hour < 10) {
    // Morning: prefer market open news, briefings
    if (['markets', 'macro', 'bitcoin', 'regulation'].includes(primaryCat)) timeOfDayBoost = 1.15;
  } else if (profile?.timeOfDayPreference === 'midday' && hour >= 12 && hour < 17) {
    // Midday: prefer deep dives, analysis
    if (['defi', 'ai', 'layer2', 'vc', 'security'].includes(primaryCat)) timeOfDayBoost = 1.15;
  } else if (profile?.timeOfDayPreference === 'evening' && hour >= 18) {
    // Evening: prefer summaries
    timeOfDayBoost = 1.1;
  }

  // 9. Final formula
  const total =
    (effectiveTopicalRelevance * 0.35 +
      sourceCredibility * 0.2 +
      freshness * 0.2 +
      velocity * 0.15 +
      depthMatch * 0.1) *
    storyImportance *
    sentimentBias *
    timeOfDayBoost;

  return {
    topicalRelevance: effectiveTopicalRelevance,
    sourceCredibility,
    freshness,
    engagementVelocity: velocity,
    depthMatch,
    sentimentBias,
    storyImportance,
    total,
  };
}

// ─── Personalize / Score Stories ───────────────────────────────────────

export interface PersonalizedStory extends AggregatedStory {
  scoreComponents: NewsScoreComponents;
  isDiscovery: boolean;
  classification: ReturnType<typeof classifyStory>;
}

/**
 * Take a list of aggregated stories, apply user preferences, return
 * personalized ranking with 70/30 familiarity/discovery mix.
 */
export function personalizeNewsFeed(
  stories: AggregatedStory[],
  prefs: NewsPreferences = DEFAULT_PREFERENCES,
  profile: UserProfile | null = null,
  now: number = Date.now(),
): PersonalizedStory[] {
  // Score every story
  const scored: PersonalizedStory[] = stories.map((story) => {
    const classification = classifyStory(story);
    const scoreComponents = computePersonalizedScore(story, prefs, profile, now);
    const primaryCat = classification.primary.categoryId;
    const isPreferred = (prefs.topicWeights[primaryCat] ?? 30) >= 40;
    const isDiscovery = !isPreferred;

    return {
      ...story,
      scoreComponents,
      isDiscovery,
      classification,
    };
  });

  // Separate into preferred and discovery buckets
  const preferred = scored.filter((s) => !s.isDiscovery);
  const discovery = scored.filter((s) => s.isDiscovery);

  const discoveryRatio = prefs.discoveryRatio;

  // Determine counts from ratio
  const totalCount = scored.length;
  const discoveryCount = Math.round(totalCount * discoveryRatio);
  const preferredCount = totalCount - discoveryCount;

  // Sort each bucket by score
  preferred.sort((a, b) => b.scoreComponents.total - a.scoreComponents.total);
  discovery.sort((a, b) => b.scoreComponents.total - a.scoreComponents.total);

  // Interleave: preferred first, then discovery
  const interleaved: PersonalizedStory[] = [];
  let pIdx = 0;
  let dIdx = 0;

  while (pIdx < preferred.length || dIdx < discovery.length) {
    // Add 2-3 preferred, then 1 discovery
    for (let i = 0; i < 3 && pIdx < preferred.length; i++) {
      const s = preferred[pIdx++];
      if (s) interleaved.push(s);
    }
    if (dIdx < discovery.length) {
      const s = discovery[dIdx++];
      if (s) interleaved.push(s);
    }
  }

  // Update scores to reflect final score
  return interleaved;
}

// ─── User Profile Inference ────────────────────────────────────────────

/**
 * Infer/update a user profile from reading history.
 */
export function inferUserProfile(history: ReadHistoryEntry[]): UserProfile {
  if (history.length === 0) {
    const hour = new Date().getHours();
    return {
      topicWeights: {},
      preferredSources: [],
      avgDwellTimeMs: 0,
      timeOfDayPreference: hour < 12 ? 'morning' : hour < 17 ? 'midday' : 'evening',
      totalRead: 0,
      lastUpdated: Date.now(),
    };
  }

  // Topic weights from engagement
  const topicEngagement = new Map<string, { reads: number; engaged: number; totalDwell: number }>();
  for (const entry of history) {
    const existing = topicEngagement.get(entry.categoryId) ?? {
      reads: 0,
      engaged: 0,
      totalDwell: 0,
    };
    existing.reads++;
    if (entry.engaged) existing.engaged++;
    existing.totalDwell += entry.dwellTimeMs;
    topicEngagement.set(entry.categoryId, existing);
  }

  const topicWeights: Record<string, number> = {};
  let maxWeight = 0;
  for (const [catId, data] of topicEngagement) {
    const engagementRate = data.reads > 0 ? data.engaged / data.reads : 0;
    const weight = Math.min(
      100,
      Math.round(((data.reads * 2 + engagementRate * 50) / history.length) * 100),
    );
    topicWeights[catId] = weight;
    if (weight > maxWeight) maxWeight = weight;
  }

  // Preferred sources: those with highest engagement
  const sourceEngagement = new Map<string, number>();
  for (const entry of history) {
    if (entry.engaged) {
      sourceEngagement.set(entry.sourceId, (sourceEngagement.get(entry.sourceId) ?? 0) + 1);
    }
  }
  const preferredSources = Array.from(sourceEngagement.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source]) => source);

  // Average dwell time for depth preference
  const avgDwellMs = history.reduce((sum, e) => sum + e.dwellTimeMs, 0) / history.length;

  // Time-of-day preference
  const hourCounts = { morning: 0, midday: 0, evening: 0 };
  for (const entry of history) {
    const hour = new Date(entry.readAt).getHours();
    if (hour >= 5 && hour < 12) hourCounts.morning++;
    else if (hour >= 12 && hour < 18) hourCounts.midday++;
    else hourCounts.evening++;
  }
  const timeOfDayPreference = (
    hourCounts.morning > hourCounts.midday && hourCounts.morning > hourCounts.evening
      ? 'morning'
      : hourCounts.midday > hourCounts.morning && hourCounts.midday > hourCounts.evening
        ? 'midday'
        : 'evening'
  ) as UserProfile['timeOfDayPreference'];

  return {
    topicWeights,
    preferredSources,
    avgDwellTimeMs: avgDwellMs,
    timeOfDayPreference,
    totalRead: history.length,
    lastUpdated: Date.now(),
  };
}

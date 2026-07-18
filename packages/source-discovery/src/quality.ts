/**
 * @degenfeed/source-discovery — Quality scoring and auto-approval heuristics.
 *
 * Each source is assigned a composite quality score 0.0–1.0 based on:
 *   - Subscriber count (log-scaled)
 *   - Weekly activity level
 *   - Source age (older = more established)
 *   - Content relevance to crypto/tech
 *   - Blocklist/known-spam check
 *
 * Also provides trending detection, stale source detection, and
 * source health scoring for the auto-discovery v2 system.
 */

import type { DiscoveredSource, DiscoveryConfig, SourceHealth, TrendingSource, SourceLifecycle } from './types';

/**
 * Compute a composite quality score for a discovered source.
 * Returns both the raw score and a breakdown of signals.
 */
export function computeQualityScore(
  source: Omit<DiscoveredSource, 'score' | 'autoApproved' | 'status' | 'discoveredAt'>,
  config: DiscoveryConfig,
): { score: number; signals: Record<string, number>; passed: boolean } {
  const signals: Record<string, number> = {};

  // ── Subscriber score (log-scaled, 0.0–0.3) ──
  const subscriberScore = Math.min(0.3, Math.log10(Math.max(1, source.subscriberCount)) * 0.06);
  signals.subscribers = subscriberScore;

  // ── Weekly activity score (0.0–0.2) ──
  const activityScore = Math.min(0.2, source.weeklyActivity * 0.04);
  signals.activity = activityScore;

  // ── Source age score (0.0–0.2) ──
  let ageScore = 0;
  if (source.sourceCreatedAt) {
    const ageDays = (Date.now() - source.sourceCreatedAt) / 86_400_000;
    ageScore = Math.min(0.2, ageDays / 365 * 0.2); // ramps to 0.2 after ~1 year
  } else {
    ageScore = 0.05; // small default if unknown
  }
  signals.age = ageScore;

  // ── Relevance score (0.0–0.2) ──
  const relevanceScore = source.relevanceScore * 0.2;
  signals.relevance = relevanceScore;

  // ── Name/reputation penalty (0.0 to -0.1) ──
  let penalty = 0;
  for (const pattern of config.blocklistPatterns) {
    if (pattern.test(source.name) || pattern.test(source.description ?? '')) {
      penalty -= 0.1;
    }
  }
  signals.penalty = penalty;

  const totalScore = Math.max(0, Math.min(1, subscriberScore + activityScore + ageScore + relevanceScore + penalty));

  const passed =
    source.subscriberCount >= config.minSubscribers &&
    source.weeklyActivity >= config.minWeeklyActivity &&
    source.relevanceScore >= config.minRelevanceScore &&
    totalScore >= config.autoApproveThreshold;

  return { score: totalScore, signals, passed };
}

/**
 * Check if a source name/description matches known spam patterns.
 */
export function isBlocklisted(
  name: string,
  description: string | undefined,
  config: DiscoveryConfig,
): boolean {
  return config.blocklistPatterns.some(
    (pattern) => pattern.test(name) || (description && pattern.test(description)),
  );
}

/**
 * Estimate crypto/tech relevance of a source by name and description.
 * Returns 0.0–1.0 based on keyword matches.
 */
import { CRYPTO_KEYWORDS } from './types';

export function estimateRelevance(name: string, description?: string): number {
  const text = `${name} ${description ?? ''}`.toLowerCase();
  let matches = 0;
  for (const kw of CRYPTO_KEYWORDS) {
    if (text.includes(kw)) matches++;
  }
  // Boost for exact matches in the name
  const nameLower = name.toLowerCase();
  const nameMatches = CRYPTO_KEYWORDS.filter((kw) => nameLower.includes(kw)).length;

  const totalKeywords = CRYPTO_KEYWORDS.length;
  return Math.min(1, (matches * 0.05 + nameMatches * 0.15));
}

// ────────────────────────────────────────────────────────────────────────────
// Source Health Scoring (v2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute composite source health score from tracked metrics.
 * Score 0.0–1.0 based on:
 *   - Post frequency (≥3 posts/week = full points)
 *   - Low spam score (inverse, zero spam = full 0.3)
 *   - Engagement (high engagement = up to 0.25)
 *   - Relevance (up to 0.15)
 */
export function computeSourceHealthScore(health: Partial<SourceHealth> & { compositeScore?: number }): {
  score: number;
  signals: Record<string, number>;
  lifecycle: SourceLifecycle;
} {
  const signals: Record<string, number> = {};
  const now = Date.now();
  const staleDays = 14;
  const dormantDays = 30;

  // ── Post frequency (0.0–0.3) ──
  const freqScore = Math.min(0.3, (health.postFrequency ?? 0) * 0.1);
  signals.frequency = freqScore;

  // ── Inverse spam score (0.0–0.3) ──
  const spamScore = health.spamScore ?? 0;
  const cleanScore = Math.max(0, 0.3 - spamScore * 0.3);
  signals.cleanliness = cleanScore;

  // ── Engagement (0.0–0.25) ──
  const engScore = Math.min(0.25, (health.engagementScore ?? 0) * 0.25);
  signals.engagement = engScore;

  // ── Relevance (0.0–0.15) ──
  const relScore = Math.min(0.15, (health.relevanceScore ?? 0.5) * 0.15);
  signals.relevance = relScore;

  const score = Math.max(0, Math.min(1, freqScore + cleanScore + engScore + relScore));

  // ── Lifecycle determination ──
  const daysSinceLastPost = health.lastPostAt ? (now - health.lastPostAt) / 86_400_000 : Infinity;
  let lifecycle: SourceLifecycle = 'active';
  if (daysSinceLastPost >= dormantDays) {
    lifecycle = 'dormant';
  } else if (daysSinceLastPost >= staleDays) {
    lifecycle = 'stale';
  }
  if (score < 0.3 && daysSinceLastPost >= staleDays) {
    lifecycle = 'culled';
  }

  return { score, signals, lifecycle };
}

/**
 * Detect sources that haven't posted in the given threshold.
 */
export function detectStaleSources(
  sources: SourceHealth[],
  thresholdDays = 14,
): SourceHealth[] {
  const now = Date.now();
  const threshold = now - thresholdDays * 86_400_000;
  return sources.filter((s) => s.lastPostAt < threshold);
}

/**
 * Compute trending score based on engagement velocity vs baseline.
 * Returns 0.0–1.0 where 1.0 = 10x above baseline.
 */
export function computeTrendingScore(
  currentVelocity: number,
  baselineRate: number,
): number {
  if (baselineRate <= 0) return Math.min(1, currentVelocity * 0.1);
  const ratio = currentVelocity / baselineRate;
  return Math.min(1, Math.log10(ratio + 1) / 1.5);
}

/**
 * Build a trending source record from raw engagement data.
 */
export function buildTrendingSource(
  sourceId: string,
  name: string,
  platform: DiscoveredSource['platform'],
  engagementVelocity: number,
  postVelocity: number,
  baselineRate: number,
  windowStart: number,
  windowEnd: number,
): TrendingSource {
  return {
    sourceId,
    name,
    platform,
    engagementVelocity,
    postVelocity,
    trendingScore: computeTrendingScore(engagementVelocity, baselineRate),
    baselineRate,
    windowStart,
    windowEnd,
  };
}

/**
 * Filter sources discovered within the last N days.
 */
export function getNewThisWeek(
  sources: DiscoveredSource[],
  now: number = Date.now(),
  days = 7,
): DiscoveredSource[] {
  const cutoff = now - days * 86_400_000;
  return sources.filter((s) => s.discoveredAt >= cutoff);
}

/**
 * Aggregate discovery stats from source lists.
 */
export function aggregateStats(
  allSources: DiscoveredSource[],
  healthMap: Map<string, SourceHealth>,
  runs: Array<{ platform: string; discovered: number; autoApproved: number; pending: number }>,
): {
  totalRuns: number;
  totalDiscovered: number;
  totalApproved: number;
  totalRejected: number;
  pendingCount: number;
  activeSources: number;
  staleSources: number;
  newThisWeek: number;
  perPlatform: Record<string, { discovered: number; approved: number; pending: number }>;
} {
  const now = Date.now();
  const staleThreshold = now - 14 * 86_400_000;
  const newThreshold = now - 7 * 86_400_000;

  const approved = allSources.filter((s) => s.status === 'approved');
  const pending = allSources.filter((s) => s.status === 'pending');
  const rejected = allSources.filter((s) => s.status === 'rejected');

  let staleSources = 0;
  for (const s of approved) {
    const health = healthMap.get(s.id);
    if (health && health.lastPostAt < staleThreshold) staleSources++;
  }

  const perPlatform: Record<string, { discovered: number; approved: number; pending: number }> = {};
  for (const s of allSources) {
    if (!perPlatform[s.platform]) {
      perPlatform[s.platform] = { discovered: 0, approved: 0, pending: 0 };
    }
    perPlatform[s.platform].discovered++;
    if (s.status === 'approved') perPlatform[s.platform].approved++;
    if (s.status === 'pending') perPlatform[s.platform].pending++;
  }

  return {
    totalRuns: runs.length,
    totalDiscovered: allSources.length,
    totalApproved: approved.length,
    totalRejected: rejected.length,
    pendingCount: pending.length,
    activeSources: approved.length,
    staleSources,
    newThisWeek: allSources.filter((s) => s.discoveredAt >= newThreshold).length,
    perPlatform,
  };
}

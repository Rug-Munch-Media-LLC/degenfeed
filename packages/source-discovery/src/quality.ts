/**
 * @degenfeed/source-discovery — Quality scoring and auto-approval heuristics.
 *
 * Each source is assigned a composite quality score 0.0–1.0 based on:
 *   - Subscriber count (log-scaled)
 *   - Weekly activity level
 *   - Source age (older = more established)
 *   - Content relevance to crypto/tech
 *   - Blocklist/known-spam check
 */

import type { DiscoveredSource, DiscoveryConfig } from './types';

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

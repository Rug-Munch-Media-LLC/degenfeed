/**
 * @degenfeed/ui — PostCard Helpers
 */

import type { UnifiedPost } from '@degenfeed/types';

export const scheduleIdle =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn: () => void) => setTimeout(fn, 1);

export const MAX_TEXT_LENGTH = 500;

export function buildScoreTooltip(score: NonNullable<UnifiedPost['score']>): string {
  const lines = [
    `Score: ${score.total.toFixed(2)}`,
    `  recency: ${score.recency.toFixed(2)}`,
    `  engagement: ${score.engagement.toFixed(2)}`,
    `  relevance: ${score.relevance.toFixed(2)}`,
    `  quality: ${score.quality.toFixed(2)}`,
    `  source: ${score.source.toFixed(2)}`,
    `  velocity: ${score.velocity.toFixed(2)}`,
  ];
  if ((score.reasons?.length ?? 0) > 0) lines.push(`Signals: ${score.reasons.join(', ')}`);
  return lines.join('\n');
}

export function buildQualityTooltip(quality: NonNullable<UnifiedPost['qualityScore']>): string {
  const lines = [`Protocol quality: ${quality.score}/${quality.max}`];
  if ((quality.reasons?.length ?? 0) > 0) lines.push(`Signals: ${quality.reasons.join(', ')}`);
  return lines.join('\n');
}

/**
 * Pure utility helpers for ShortVideoCard
 */

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w-]+/g);
  return matches ?? [];
}

export function truncateText(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

// ─── Text similarity primitives ───────────────────────────────────────
// Single responsibility: quantify how similar two strings are.

export const URL_RE = /https?:\/\/[^\s<>"']+/gi;
export const TICKER_RE = /\$[A-Z]{2,10}\b/g;
export const NON_ALPHA_RE = /[^a-z0-9\s]/g;

export function normalizeStripped(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(NON_ALPHA_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordSet(text: string): Set<string> {
  return new Set(
    normalizeStripped(text)
      .split(' ')
      .filter((w) => w.length > 2),
  );
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/**
 * Compute Levenshtein distance between two strings.
 * Used for short-text near-duplicate detection where Jaccard
 * similarity on word sets misses subtle near-matches.
 * O(n*m) time, O(min(n,m)) memory using two-row optimization.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  if (an < bn) return levenshteinDistance(b, a);

  const prev: number[] = new Array(bn + 1);
  const curr: number[] = new Array(bn + 1);

  for (let j = 0; j <= bn; j++) {
    prev[j] = j;
    curr[j] = 0;
  }

  for (let i = 1; i <= an; i++) {
    curr[0] = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const pj = prev[j] as number;
      const cj1 = curr[j - 1] as number;
      const pj1 = prev[j - 1] as number;
      curr[j] = Math.min(pj + 1, cj1 + 1, pj1 + cost);
    }
    for (let j = 0; j <= bn; j++) prev[j] = curr[j] as number;
  }
  return prev[bn] as number;
}

/**
 * Normalized Levenshtein similarity (0-1).
 * 1.0 = identical, 0.0 = completely different.
 * Only computed for strings where it's useful (short texts < 200 chars).
 */
export function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(
    a
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
    b
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
  );
  return 1.0 - dist / Math.max(maxLen, 1);
}

/**
 * Perceptual-style image fingerprint using URL structure + metadata.
 * Real pHash requires image decoding; we use URL path structure,
 * image dimensions (if available), and file name patterns to
 * create a stable fingerprint that survives CDN URL differences.
 */

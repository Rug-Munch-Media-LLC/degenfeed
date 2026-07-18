'use client';

/**
 * Lightweight fuzzy-search utilities for client-side result ranking.
 *
 * - Levenshtein distance for typo-tolerant matching
 * - Re-ranking: exact matches first, then prefix, then fuzzy
 * - Highlight helper for matched substrings
 */

// ═══════════════════════════════════════════════════════════════════
// Levenshtein distance
// ═══════════════════════════════════════════════════════════════════

export function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = i;
  for (let i = 1; i <= an; i++) {
    let prev = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(
        matrix[j] + 1, // deletion
        prev + 1, // insertion
        matrix[j - 1] + cost, // substitution
      );
      matrix[j - 1] = prev;
      prev = val;
    }
    matrix[bn] = prev;
  }
  return matrix[bn];
}

// ═══════════════════════════════════════════════════════════════════
// Match quality enum
// ═══════════════════════════════════════════════════════════════════

export type MatchQuality = 'exact' | 'prefix' | 'fuzzy' | 'none';

export interface FuzzyScore {
  quality: MatchQuality;
  distance: number;
  score: number; // higher = better match
}

/**
 * Score a single field against a search query.
 * Returns quality + numeric score for ranking.
 */
export function scoreField(field: string, query: string): FuzzyScore {
  const f = field.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q) return { quality: 'none', distance: Infinity, score: 0 };

  // Exact match (highest priority)
  if (f === q) return { quality: 'exact', distance: 0, score: 100 };

  // Starts with
  if (f.startsWith(q)) return { quality: 'prefix', distance: 0, score: 80 };

  // Contains the query as a word
  if (f.includes(` ${q}`) || f.includes(`${q} `)) {
    return { quality: 'prefix', distance: 0, score: 70 };
  }

  // Contains substring
  if (f.includes(q)) return { quality: 'prefix', distance: 0, score: 60 };

  // Word-level fuzzy: check each word in the field
  const fieldWords = f.split(/\s+/).filter(Boolean);
  const queryWords = q.split(/\s+/).filter(Boolean);

  let totalDist = 0;
  let matchedWords = 0;
  for (const qw of queryWords) {
    let bestDist = Infinity;
    for (const fw of fieldWords) {
      const dist = levenshtein(fw, qw);
      if (dist < bestDist) bestDist = dist;
    }
    if (bestDist <= Math.max(1, Math.floor(qw.length / 3))) {
      totalDist += bestDist;
      matchedWords++;
    } else {
      totalDist += qw.length; // penalty for unmatchable word
    }
  }

  if (matchedWords > 0) {
    const matchRatio = matchedWords / queryWords.length;
    const score = Math.round(40 * matchRatio - totalDist * 2);
    return { quality: 'fuzzy', distance: totalDist, score: Math.max(0, score) };
  }

  return { quality: 'none', distance: Infinity, score: 0 };
}

// ═══════════════════════════════════════════════════════════════════
// Re-ranking helper for search results
// ═══════════════════════════════════════════════════════════════════

export interface RankableResult {
  /** The primary text field to match against */
  searchText: string;
  /** Optional secondary field (author name, etc.) */
  searchAuthor?: string;
  /** Original index in the source array */
  originalIndex: number;
}

/**
 * Re-rank an array of results: exact matches first, then prefix,
 * then fuzzy, then original order.
 *
 * @param results - results wrapped with their searchable text
 * @param query - the user's search query
 * @returns re-ordered results with .score attached
 */
export function rerankResults<T extends RankableResult>(
  results: T[],
  query: string,
): (T & { fuzzyScore: FuzzyScore })[] {
  const scored = results.map((r) => {
    const textScore = scoreField(r.searchText, query);
    const authorScore = r.searchAuthor ? scoreField(r.searchAuthor, query) : null;
    // Use the best of text or author score
    const best = authorScore && authorScore.score > textScore.score ? authorScore : textScore;
    return { ...r, fuzzyScore: best };
  });

  scored.sort((a, b) => {
    // Sort by quality tier first
    const tierOrder: Record<MatchQuality, number> = { exact: 0, prefix: 1, fuzzy: 2, none: 3 };
    const tierDiff = tierOrder[a.fuzzyScore.quality] - tierOrder[b.fuzzyScore.quality];
    if (tierDiff !== 0) return tierDiff;
    // Within same tier, sort by score descending
    return b.fuzzyScore.score - a.fuzzyScore.score;
  });

  return scored;
}

// ═══════════════════════════════════════════════════════════════════
// "Did you mean?" — find closest matching known term
// ═══════════════════════════════════════════════════════════════════

export function didYouMean(query: string, knownTerms: string[]): string | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  let bestTerm: string | null = null;
  let bestDist = Infinity;

  for (const term of knownTerms) {
    const t = term.toLowerCase().trim();
    if (t === q) continue; // exact match, no suggestion needed
    const dist = levenshtein(t, q);
    const maxLen = Math.max(t.length, q.length);
    const normalized = dist / maxLen;
    // Only suggest if reasonably close (< 30% different)
    if (normalized < 0.3 && dist < bestDist) {
      bestDist = dist;
      bestTerm = term;
    }
  }

  return bestTerm;
}

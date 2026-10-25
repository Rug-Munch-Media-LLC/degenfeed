// ─── Near-duplicate passes ──────────────────────────────────────────────
// Single responsibility: catch reworded copies that share no exact signal.
import type { UnifiedPost } from '@degenfeed/types';
import type { PostSignals } from './dedup-state';
import { markCrossPosted } from './dedup-state';
import { jaccardSimilarity, normalizedLevenshtein } from './text-similarity';

const JACCARD_THRESHOLD = 0.7;
const MIN_TEXT_LENGTH = 20;

export interface Candidate {
  words: Set<string>;
  index: number;
}

export interface ShortCandidate {
  text: string;
  index: number;
}

function jaccardMatch(
  p: UnifiedPost,
  s: PostSignals,
  candidates: Candidate[],
  out: UnifiedPost[],
): boolean {
  if (s.qid || s.words.size < 3 || p.text.length <= MIN_TEXT_LENGTH) return false;
  for (const cand of candidates) {
    if (jaccardSimilarity(s.words, cand.words) >= JACCARD_THRESHOLD) {
      const existing = out[cand.index];
      if (existing) markCrossPosted(existing, p.protocol);
      return true;
    }
  }
  return false;
}

function levenshteinMatch(
  p: UnifiedPost,
  s: PostSignals,
  shortCandidates: ShortCandidate[],
  out: UnifiedPost[],
): boolean {
  if (s.qid || p.text.length <= 15 || p.text.length >= 300) return false;
  if (s.cleanText.length <= 10) return false;
  for (const cand of shortCandidates) {
    if (normalizedLevenshtein(s.cleanText, cand.text) >= 0.85) {
      const existing = out[cand.index];
      if (existing) markCrossPosted(existing, p.protocol);
      return true;
    }
  }
  return false;
}

/** True when the post is a near-duplicate of something already kept. */
export function isNearDuplicate(
  p: UnifiedPost,
  s: PostSignals,
  candidates: Candidate[],
  shortCandidates: ShortCandidate[],
  out: UnifiedPost[],
): boolean {
  if (jaccardMatch(p, s, candidates, out)) return true;
  return levenshteinMatch(p, s, shortCandidates, out);
}

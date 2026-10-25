// ─── Feed deduplication ─────────────────────────────────────────────────
// Single responsibility: orchestrate the dedup passes in their original order.
// Pass order is part of the behaviour: exact identity, RSS origin, aggregator,
// then fuzzy similarity. Each pass has a side effect (cross-post bookkeeping or
// seen-set recording) that must stay in this sequence.
import type { UnifiedPost } from '@degenfeed/types';
import { isAggregatorDuplicate } from './dedup-aggregator';
import { isRssOriginDuplicate } from './dedup-rss';
import { collectSignals } from './dedup-signals';
import { type Candidate, isNearDuplicate, type ShortCandidate } from './dedup-similarity';
import { isExactDuplicate } from './dedup-skip';
import { createSeen, markSeen } from './dedup-state';

export function deduplicatePosts(posts: UnifiedPost[]): UnifiedPost[] {
  const seen = createSeen();
  const candidates: Candidate[] = [];
  const shortCandidates: ShortCandidate[] = [];
  const out: UnifiedPost[] = [];

  for (const p of posts) {
    const s = collectSignals(p);

    if (isExactDuplicate(p, s, seen, out)) continue;
    if (isRssOriginDuplicate(p, seen, out)) continue;
    if (isAggregatorDuplicate(p, out)) continue;
    if (isNearDuplicate(p, s, candidates, shortCandidates, out)) continue;

    markSeen(seen, p, s);
    candidates.push({ words: s.words, index: out.length });
    if (s.cleanText.length > 10 && s.cleanText.length < 300) {
      shortCandidates.push({ text: s.cleanText, index: out.length });
    }
    out.push(p);
  }

  return out;
}

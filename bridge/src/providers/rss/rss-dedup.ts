import type { UnifiedPost } from '../../server/types';

export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'mc_cid',
      'mc_eid',
    ]) {
      u.searchParams.delete(p);
    }
    const host = u.hostname.replace(/^www\./i, '');
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${host}${path}`.toLowerCase();
  } catch {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .split('?')[0]!;
  }
}

/** Extract the canonical link URL from a post's embeds. */
export function extractLinkUrl(post: UnifiedPost): string | undefined {
  for (const embed of post.embeds) {
    if (embed.kind === 'link' && embed.url) return embed.url;
  }
  return undefined;
}

/**
 * Tokenize a title for fuzzy similarity: lowercase, strip punctuation,
 * drop very short tokens and common stopwords.
 */
const TITLE_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'for',
  'with',
  'from',
  'its',
  'this',
  'that',
  'these',
  'those',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'will',
  'would',
  'could',
  'should',
  'into',
  'over',
  'under',
  'after',
  'before',
]);

export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !TITLE_STOPWORDS.has(t));
}

/**
 * Jaccard similarity between two titles (token sets).
 * 1.0 = identical; >0.75 = same story.
 */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  const setB = new Set(tb);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Fuzzy title-similarity threshold for "same story" detection. */
const TITLE_SIM_THRESHOLD = 0.6;

/** Number of most-recent posts to fuzzy-match against (bounded scan). */
const TITLE_SCAN_WINDOW = 80;

/**
 * Deduplicate posts across all sources using:
 *  1. exact canonical URL match (normalized),
 *  2. exact content hash (first 120 chars of text),
 *  3. fuzzy title similarity (Jaccard > 0.6) within a bounded window.
 *
 * When duplicates are found the best copy is kept, niches are merged, and
 * a crossReference list (feed labels covering the same story) is recorded —
 * this feeds the ranking/grounding pass (cross-reference authority).
 */
export function deduplicatePosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  const kept: UnifiedPost[] = [];

  // Sort by creation date (newest first) to keep the freshest copy
  const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt);

  for (const post of sorted) {
    const url = extractLinkUrl(post);
    const urlKey = url ? normalizeUrlKey(url) : '';
    const contentKey = post.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 120);
    const raw = post.raw as Record<string, unknown> | undefined;
    const feedLabel = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    let matched: UnifiedPost | undefined;

    // Layer 1: exact canonical URL
    if (urlKey) {
      matched = kept.find((p) => {
        const pu = extractLinkUrl(p);
        return pu ? normalizeUrlKey(pu) === urlKey : false;
      });
    }

    // Layer 2: exact content key (same title text verbatim)
    if (!matched && contentKey.length >= 20) {
      matched = kept.find((p) => {
        const pk = p.text
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 120);
        return pk === contentKey;
      });
    }

    // Layer 3: fuzzy title similarity (bounded scan for performance)
    if (!matched && post.text.length > 10) {
      const window = kept.slice(0, TITLE_SCAN_WINDOW);
      let bestSim = 0;
      for (const p of window) {
        const sim = titleSimilarity(post.text, p.text);
        if (sim > bestSim) {
          bestSim = sim;
          matched = p;
        }
      }
      if (bestSim < TITLE_SIM_THRESHOLD) matched = undefined;
    }

    if (matched) {
      // Merge niches
      const mergedNiches = new Set([...matched.niches, ...post.niches]);
      matched.niches = [...mergedNiches];

      // Record cross-reference (grounding signal): which feed labels cover
      // this same story. Also copy over the original URLs for authority.
      const mRaw = matched.raw as Record<string, unknown> | undefined;
      const refs = new Set<string>((mRaw?.crossReference as string[] | undefined) ?? []);
      if (feedLabel) refs.add(feedLabel);
      const otherRef = (raw?.feedLabel as string | undefined) || feedLabel;
      if (otherRef) refs.add(otherRef);
      if (mRaw) mRaw.crossReference = [...refs];
      const urls = new Set<string>((mRaw?.crossReferenceUrls as string[] | undefined) ?? []);
      if (url) urls.add(url);
      const otherUrl = extractLinkUrl(post);
      if (otherUrl) urls.add(otherUrl);
      if (mRaw) mRaw.crossReferenceUrls = [...urls];
    } else {
      // Fresh copy — seed its cross-reference tracking
      if (raw) {
        if (feedLabel && !Array.isArray(raw.crossReference)) {
          raw.crossReference = [feedLabel];
        }
        if (url && !Array.isArray(raw.crossReferenceUrls)) {
          raw.crossReferenceUrls = [url];
        }
      }
      kept.push(post);
    }
  }

  return kept.slice(0, limit);
}

// ─── Ranking & Grounding ────────────────────────────────────────────

/**
 * Source reputation tiers (1 = most authoritative, 4 = long tail).
 * Used for source reputation scoring in the news ranking pass.
 */

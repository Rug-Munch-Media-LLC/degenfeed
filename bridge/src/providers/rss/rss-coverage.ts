export interface BiasDistribution {
  left: number;
  'center-left': number;
  center: number;
  'center-right': number;
  right: number;
}

export interface StoryCoverage {
  /** Unique source labels covering this story (own feed + cross-reference). */
  sources: string[];
  sourceCount: number;
  bias: BiasDistribution;
  factuality: { 'very-high': number; high: number; mixed: number; low: number; 'very-low': number };
  /** True when coverage skews heavily to one political side. */
  echoChamber: boolean;
  echoDirection: 'left' | 'right' | null;
}

const EMPTY_BIAS: BiasDistribution = {
  left: 0,
  'center-left': 0,
  center: 0,
  'center-right': 0,
  right: 0,
};

function emptyCoverage(sources: string[]): StoryCoverage {
  return {
    sources,
    sourceCount: sources.length,
    bias: { ...EMPTY_BIAS },
    factuality: { 'very-high': 0, high: 0, mixed: 0, low: 0, 'very-low': 0 },
    echoChamber: false,
    echoDirection: null,
  };
}

/**
 * Compute per-story coverage: which sources, bias distribution, and whether
 * the story is an echo chamber (>=3 sources, >=75% one political side).
 * Attaches the result to `raw.coverage` on each post and returns it.
 */
export function computeStoryCoverage(posts: UnifiedPost[]): StoryCoverage[] {
  const coverages: StoryCoverage[] = [];
  for (const post of posts) {
    const raw = post.raw as Record<string, unknown> | undefined;
    const ownLabel = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    const refs = Array.isArray(raw?.crossReference) ? (raw.crossReference as string[]) : [];
    const sources = Array.from(new Set([ownLabel, ...refs].filter(Boolean)));

    const coverage = emptyCoverage(sources);
    for (const label of sources) {
      const bias = sourceBias(label);
      coverage.bias[bias] = (coverage.bias[bias] ?? 0) + 1;
      const factual = sourceFactuality(label);
      coverage.factuality[factual] = (coverage.factuality[factual] ?? 0) + 1;
    }

    if (sources.length >= 3) {
      const leftish = coverage.bias.left + coverage.bias['center-left'];
      const rightish = coverage.bias.right + coverage.bias['center-right'];
      const total = sources.length;
      if (leftish / total >= 0.75) {
        coverage.echoChamber = true;
        coverage.echoDirection = 'left';
      } else if (rightish / total >= 0.75) {
        coverage.echoChamber = true;
        coverage.echoDirection = 'right';
      }
    }

    if (raw) raw.coverage = coverage;
    coverages.push(coverage);
  }
  return coverages;
}

export interface BlindspotItem {
  postId: string;
  title: string;
  url: string;
  source: string;
  tier: number;
  type: 'under-the-radar' | 'echo-chamber';
  reason: string;
  coverage: StoryCoverage;
  /** Suggested "other side" sources covering the same story (for echo chambers). */
  otherSideSources: string[];
  publishedAt: number;
  rank: number;
}

/**
 * Blindspot detection — the Ground News signature feature, for free.
 *
 * Two signals:
 *  1. "Under the radar": high-credibility (tier 1/2) stories with LOW
 *     cross-source coverage — good stories the mainstream echo missed.
 *  2. "Echo chamber alert": stories covered by >=3 sources where >=75%
 *     come from one political side. The "other side" perspective is
 *     suggested by sourcing stories whose bias distribution is opposite.
 */
export function computeBlindspots(posts: UnifiedPost[], max = 10): BlindspotItem[] {
  const coverages = computeStoryCoverage(posts);
  const items: BlindspotItem[] = [];

  posts.forEach((post, i) => {
    const raw = post.raw as Record<string, unknown> | undefined;
    const coverage = coverages[i];
    if (!coverage) return;
    const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    const tier = sourceTier(label);
    const rank = typeof raw?.rank === 'number' ? (raw.rank as number) : 0;
    const url = extractLinkUrl(post) || '';
    const refs = Array.isArray(raw?.crossReference) ? (raw.crossReference as string[]) : [];
    const otherSideSources = otherSideFor(coverage, posts);

    if (coverage.echoChamber) {
      items.push({
        postId: post.id,
        title: post.text,
        url,
        source: label,
        tier,
        type: 'echo-chamber',
        reason:
          coverage.echoDirection === 'left'
            ? `Covered by ${coverage.sourceCount} sources, ${Math.round(
                ((coverage.bias.left + coverage.bias['center-left']) / coverage.sourceCount) * 100,
              )}% left-leaning — you're likely only seeing one side.`
            : `Covered by ${coverage.sourceCount} sources, ${Math.round(
                ((coverage.bias.right + coverage.bias['center-right']) / coverage.sourceCount) *
                  100,
              )}% right-leaning — you're likely only seeing one side.`,
        coverage,
        otherSideSources,
        publishedAt: post.createdAt,
        rank,
      });
    } else if (tier <= 2 && refs.length <= 1 && rank >= 55) {
      items.push({
        postId: post.id,
        title: post.text,
        url,
        source: label,
        tier,
        type: 'under-the-radar',
        reason: `High-credibility story (${label}) barely covered elsewhere — worth a look before the echo picks it up.`,
        coverage,
        otherSideSources: [],
        publishedAt: post.createdAt,
        rank,
      });
    }
  });

  // Echo chambers first (most dangerous), then by rank
  return items
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'echo-chamber' ? -1 : 1;
      return b.rank - a.rank;
    })
    .slice(0, max);
}

/**
 * Suggest "other side" sources for an echo-chamber story: high-factuality
 * sources whose bias is opposite to the dominant direction and that cover
 * the same story (share a cross-reference URL or are a known alternative).
 */
function otherSideFor(coverage: StoryCoverage, posts: UnifiedPost[]): string[] {
  const dominant = coverage.echoDirection;
  if (!dominant) return [];
  const wanted: BiasLabel[] =
    dominant === 'left' ? ['center-right', 'right', 'center'] : ['center-left', 'left', 'center'];
  const candidates: string[] = [];
  for (const post of posts) {
    const raw = post.raw as Record<string, unknown> | undefined;
    const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    if (!label) continue;
    const bias = sourceBias(label);
    if (wanted.includes(bias)) {
      const tier = sourceTier(label);
      const factual = sourceFactuality(label);
      if (tier <= 2 && factual !== 'low' && factual !== 'very-low') {
        candidates.push(label);
      }
    }
    if (candidates.length >= 4) break;
  }
  return Array.from(new Set(candidates));
}

// ─── Story Clustering (Ground News "Full Coverage") ───────────────────
// Groups posts about the same event into stories using Jaccard title
// similarity + existing cross-reference data. Each cluster shows the
// representative headline, how many sources cover it, and the bias
// distribution (e.g. "3 left, 2 center, 1 right").

export interface StoryClusterOutput {
  id: string;
  title: string;
  storyCount: number;
  sources: string[];
  bias: BiasDistribution;
  factuality: { 'very-high': number; high: number; mixed: number; low: number; 'very-low': number };
  topCategories: string[];
  /** Per-perspective headline snippets for the "Full Coverage" view. */
  perspectives: Array<{ source: string; title: string; url: string; bias: BiasLabel }>;
  firstSeen: number;
  lastSeen: number;
  score: number;
}

/**
 * Cluster a batch of posts into stories. Two layers:
 *  1. Cross-reference groups: posts that were already merged by the dedup
 *     pass share a crossReference — those are one story.
 *  2. Fuzzy title similarity (Jaccard > 0.55 within a bounded window) for
 *     near-duplicate headlines that the dedup pass missed.
 *
 * The representative post is the highest-ranked; perspectives are the
 * cross-referenced source labels with their own headlines when available.
 */
export function clusterStories(posts: UnifiedPost[], limit = 12): StoryClusterOutput[] {
  const clusters: StoryClusterOutput[] = [];
  const used = new Set<string>();

  for (const post of posts) {
    if (used.has(post.id)) continue;
    const raw = post.raw as Record<string, unknown> | undefined;
    const ownLabel = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    const refs = Array.isArray(raw?.crossReference) ? (raw.crossReference as string[]) : [];

    // Layer 1: cross-reference group (same story merged by dedup)
    const members = [post];
    used.add(post.id);
    for (const other of posts) {
      if (used.has(other.id)) continue;
      const oRaw = other.raw as Record<string, unknown> | undefined;
      const oLabel = (oRaw?.feedLabel as string | undefined) || other.author?.displayName || '';
      const oRefs = Array.isArray(oRaw?.crossReference) ? (oRaw.crossReference as string[]) : [];
      // Same story if either shares a cross-reference label with our group
      const groupLabels = new Set<string>([
        ownLabel,
        ...refs,
        ...members.map((m) => {
          const mr = m.raw as Record<string, unknown> | undefined;
          return (mr?.feedLabel as string | undefined) || m.author?.displayName || '';
        }),
      ]);
      if (oRefs.some((r) => groupLabels.has(r)) || groupLabels.has(oLabel)) {
        members.push(other);
        used.add(other.id);
      }
    }

    // Layer 2: fuzzy title similarity against the group
    if (members.length === 1) {
      for (const other of posts) {
        if (used.has(other.id)) continue;
        if (titleSimilarity(post.text, other.text) > 0.55) {
          members.push(other);
          used.add(other.id);
        }
      }
    }

    if (members.length === 0) continue;

    // Representative = highest ranked member
    const sortedMembers = [...members].sort((a, b) => {
      const ar = (a.raw as Record<string, unknown> | undefined)?.rank as number | undefined;
      const br = (b.raw as Record<string, unknown> | undefined)?.rank as number | undefined;
      return (br ?? 0) - (ar ?? 0);
    });
    const rep = sortedMembers[0];
    if (!rep) continue;
    const repRaw = rep.raw as Record<string, unknown> | undefined;

    const sourceSet = new Set<string>();
    for (const m of members) {
      const mr = m.raw as Record<string, unknown> | undefined;
      const label = (mr?.feedLabel as string | undefined) || m.author?.displayName || '';
      if (label) sourceSet.add(label);
      if (Array.isArray(mr?.crossReference)) {
        for (const ref of mr.crossReference as string[]) if (ref) sourceSet.add(ref);
      }
    }
    const sources = Array.from(sourceSet);

    const bias: BiasDistribution = { ...EMPTY_BIAS };
    const factuality: StoryCoverage['factuality'] = {
      'very-high': 0,
      high: 0,
      mixed: 0,
      low: 0,
      'very-low': 0,
    };
    for (const s of sources) {
      bias[sourceBias(s)] = (bias[sourceBias(s)] ?? 0) + 1;
      factuality[sourceFactuality(s)] = (factuality[sourceFactuality(s)] ?? 0) + 1;
    }

    // Perspectives: each member's own headline + source
    const perspectives = sortedMembers.slice(0, 6).map((m) => {
      const mr = m.raw as Record<string, unknown> | undefined;
      const label = (mr?.feedLabel as string | undefined) || m.author?.displayName || '';
      return {
        source: label,
        title: m.text,
        url: extractLinkUrl(m) || '',
        bias: sourceBias(label),
      };
    });

    const categories = Array.from(new Set(members.flatMap((m) => m.niches ?? []).slice(0, 5)));

    clusters.push({
      id: `story:${rep.id}`,
      title: rep.text,
      storyCount: sources.length,
      sources,
      bias,
      factuality,
      topCategories: categories,
      perspectives,
      firstSeen: Math.min(...members.map((m) => m.createdAt)),
      lastSeen: Math.max(...members.map((m) => m.createdAt)),
      score: (repRaw?.rank as number | undefined) ?? 0,
    });
  }

  return clusters.sort((a, b) => b.storyCount - a.storyCount || b.score - a.score).slice(0, limit);
}

// ─── Lazy Cache ──────────────────────────────────────────────────────


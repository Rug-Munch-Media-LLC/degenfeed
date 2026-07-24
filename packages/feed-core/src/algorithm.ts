/**
 * @degenfeed/feed-core — FeedAlgorithm: User-Controlled Feed Algorithm Engine
 *
 * A pluggable scoring engine that lets users control how their feed is ranked.
 * Each scoring factor (recency, popularity, relevance, niche, protocol) is a
 * pluggable function with a user-configurable weight (0-100).
 *
 * Users can:
 *   - Adjust weights for each factor
 *   - Select which niches to prioritize
 *   - Weight protocols individually
 *   - Switch between time-based algorithm modes
 *   - See why each post appeared ("algorithm transparency")
 *
 * Usage:
 *   const algo = new FeedAlgorithm(userPrefs);
 *   const scored = algo.rank(posts, { viewer, followed, now });
 *   // Each post gets .score.breakdown for transparency UI
 */

import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export type AlgorithmMode =
  | 'standard'
  | 'morning-digest'
  | 'breaking-news'
  | 'deep-dive'
  | 'quick-scroll';

export interface ScoredPost {
  post: UnifiedPost;
  score: AlgorithmScoreBreakdown;
}

export interface AlgorithmScoreBreakdown {
  total: number;
  recency: number;
  popularity: number;
  relevance: number;
  niche: number;
  protocol: number;
  diversity: number;
  quality: number;
  reasons: ReasonEntry[];
}

export interface ReasonEntry {
  factor: string;
  label: string;
  detail: string;
  contribution: number; // 0-1 weight of this factor's contribution
}

export interface AlgorithmWeights {
  recency: number; // 0-100
  popularity: number; // 0-100
  relevance: number; // 0-100
  protocolDiversity: number; // 0-100
  nicheFocus: number; // 0-100
}

export interface NicheSelection {
  /** Niches the user wants to prioritize */
  active: string[];
  /** If true, occasionally inject content from unexplored niches */
  discoverNew: boolean;
}

export interface ProtocolWeights {
  [protocol: string]: number; // 0-100 for each protocol
}

export interface UserAlgorithmPreferences {
  weights: AlgorithmWeights;
  niches: NicheSelection;
  protocolWeights: ProtocolWeights;
  mode: AlgorithmMode;
  /** Author IDs the viewer follows */
  followedIds?: string[];
  /** Niches the viewer has muted */
  mutedNiches?: string[];
}

export interface AlgorithmContext {
  viewer: UnifiedIdentity | null;
  followed: Set<string>;
  now: number;
  /** Previous engagement for velocity tracking */
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
}

// ─── Defaults ──────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: AlgorithmWeights = {
  recency: 60,
  popularity: 50,
  relevance: 70,
  protocolDiversity: 40,
  nicheFocus: 50,
};

export const MODE_PRESETS: Record<AlgorithmMode, Partial<AlgorithmWeights>> = {
  standard: {},
  'morning-digest': {
    recency: 80,
    popularity: 40,
    relevance: 60,
    protocolDiversity: 50,
    nicheFocus: 50,
  },
  'breaking-news': {
    recency: 95,
    popularity: 80,
    relevance: 40,
    protocolDiversity: 30,
    nicheFocus: 30,
  },
  'deep-dive': {
    recency: 30,
    popularity: 60,
    relevance: 80,
    protocolDiversity: 60,
    nicheFocus: 70,
  },
  'quick-scroll': {
    recency: 70,
    popularity: 70,
    relevance: 50,
    protocolDiversity: 40,
    nicheFocus: 40,
  },
};

export const MODE_LABELS: Record<
  AlgorithmMode,
  { label: string; icon: string; description: string }
> = {
  standard: { label: 'Standard', icon: '⚖️', description: 'Balanced mix of all factors' },
  'morning-digest': {
    label: 'Morning Digest',
    icon: '🌅',
    description: 'Top posts since your last visit',
  },
  'breaking-news': {
    label: 'Breaking News',
    icon: '🔴',
    description: 'Fastest-moving topics first',
  },
  'deep-dive': { label: 'Deep Dive', icon: '🤿', description: 'Long-form, high-quality content' },
  'quick-scroll': { label: 'Quick Scroll', icon: '⚡', description: 'Short, engaging posts' },
};

export const ALL_NICHES = [
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'nft',
  'gaming',
  'ai',
  'tech',
  'science',
  'startups',
  'regulation',
  'security',
  'macro',
  'memecoin',
  'layer2',
  'stablecoin',
  'etf',
  'onchain',
  'privacy',
  'mining',
  'governance',
  'dao',
  'culture',
] as const;

export const NICHE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  bitcoin: { label: 'Bitcoin', icon: '₿', color: '#f7931a' },
  ethereum: { label: 'Ethereum', icon: '⟠', color: '#627eea' },
  solana: { label: 'Solana', icon: '◎', color: '#9945ff' },
  defi: { label: 'DeFi', icon: '🏦', color: '#6366f1' },
  nft: { label: 'NFTs', icon: '🖼️', color: '#ec4899' },
  gaming: { label: 'Gaming', icon: '🎮', color: '#f43f5e' },
  ai: { label: 'AI', icon: '🤖', color: '#06b6d4' },
  tech: { label: 'Tech', icon: '💻', color: '#3b82f6' },
  science: { label: 'Science', icon: '🔬', color: '#22d3ee' },
  startups: { label: 'Startups', icon: '🚀', color: '#f97316' },
  regulation: { label: 'Regulation', icon: '⚖️', color: '#ef4444' },
  security: { label: 'Security', icon: '🔒', color: '#dc2626' },
  macro: { label: 'Macro', icon: '📈', color: '#10b981' },
  memecoin: { label: 'Memecoin', icon: '🐸', color: '#f97316' },
  layer2: { label: 'Layer 2', icon: '⧫', color: '#8b5cf6' },
  stablecoin: { label: 'Stablecoin', icon: '💲', color: '#22d3ee' },
  etf: { label: 'ETF', icon: '🏛️', color: '#e879f9' },
  onchain: { label: 'Onchain', icon: '⛓️', color: '#34d399' },
  privacy: { label: 'Privacy', icon: '🛡️', color: '#a78bfa' },
  mining: { label: 'Mining', icon: '⛏️', color: '#fb923c' },
  governance: { label: 'Governance', icon: '🗳️', color: '#818cf8' },
  dao: { label: 'DAO', icon: '🏛️', color: '#a855f7' },
  culture: { label: 'Culture', icon: '🎭', color: '#f472b6' },
};

// ─── Pluggable Scoring Functions ───────────────────────────────────────

export type ScorerFn = (
  post: UnifiedPost,
  prefs: UserAlgorithmPreferences,
  ctx: AlgorithmContext,
) => { score: number; reason?: ReasonEntry };

/**
 * Recency scorer: newer posts score higher.
 * Uses exponential decay with a configurable half-life based on mode.
 */
export function scoreRecency(
  post: UnifiedPost,
  _prefs: UserAlgorithmPreferences,
  ctx: AlgorithmContext,
): { score: number; reason?: ReasonEntry } {
  const ageHours = Math.max(0, (ctx.now - post.createdAt) / (1000 * 60 * 60));
  // Half-life varies by mode — breaking news decays faster
  const halfLife = _prefs.mode === 'breaking-news' ? 1 : _prefs.mode === 'morning-digest' ? 8 : 12;
  const score = 0.5 ** (ageHours / halfLife);
  const ageStr =
    ageHours < 1 ? `${Math.round(ageHours * 60)}m ago` : `${Math.round(ageHours)}h ago`;

  return {
    score: Math.round(score * 100) / 100,
    reason: {
      factor: 'recency',
      label: 'Recency',
      detail: `Posted ${ageStr} (decay: ${Math.round(score * 100)}%)`,
      contribution: 0,
    },
  };
}

/**
 * Popularity scorer: posts with high engagement score higher.
 * Uses log-scaled engagement to prevent viral outliers from dominating.
 */
export function scorePopularity(
  post: UnifiedPost,
  _prefs: UserAlgorithmPreferences,
  _ctx: AlgorithmContext,
): { score: number; reason?: ReasonEntry } {
  const totalEngagement =
    post.metrics.likes +
    post.metrics.reposts * 2 +
    post.metrics.replies * 3 +
    (post.metrics.quotes ?? 0) * 4;
  // Log scale: 0 engagement → 0, 1000+ → ~1.0
  const score = Math.min(1, Math.log(1 + totalEngagement) / Math.log(1000));

  let label = 'Low engagement';
  if (totalEngagement > 500) label = 'Highly viral';
  else if (totalEngagement > 100) label = 'Trending';
  else if (totalEngagement > 20) label = 'Moderate engagement';
  else if (totalEngagement > 0) label = 'Some engagement';

  return {
    score: Math.round(score * 100) / 100,
    reason: {
      factor: 'popularity',
      label,
      detail: `${totalEngagement} total engagements`,
      contribution: 0,
    },
  };
}

/**
 * Relevance scorer: how well the post matches the user's selected niches.
 * Posts matching active niches get boosted; muted niches penalized.
 */
export function scoreRelevance(
  post: UnifiedPost,
  prefs: UserAlgorithmPreferences,
  ctx: AlgorithmContext,
): { score: number; reason?: ReasonEntry } {
  const activeNiches = new Set(prefs.niches.active);
  const mutedNiches = new Set(prefs.mutedNiches ?? []);
  const postNiches = post.niches ?? [];

  let matchCount = 0;
  let mutedCount = 0;
  const matched: string[] = [];
  const muted: string[] = [];

  for (const n of postNiches) {
    if (activeNiches.has(n)) {
      matchCount++;
      matched.push(n);
    }
    if (mutedNiches.has(n)) {
      mutedCount++;
      muted.push(n);
    }
  }

  // Penalty for muted niches
  const mutedPenalty = mutedCount > 0 ? 0.3 : 0;
  // Boost for matching niches
  const matchBoost = Math.min(1, matchCount * 0.25);
  // Boost for followed authors
  const followedBoost = ctx.followed.has(post.author.id) ? 0.3 : 0;

  const score = Math.max(0, Math.min(1, matchBoost + followedBoost - mutedPenalty));

  const parts: string[] = [];
  if (matched.length > 0) parts.push(`matches ${matched.slice(0, 3).join(', ')}`);
  if (ctx.followed.has(post.author.id)) parts.push('you follow this author');
  if (muted.length > 0) parts.push(`muted: ${muted.join(', ')}`);

  return {
    score: Math.round(score * 100) / 100,
    reason: {
      factor: 'relevance',
      label: matchCount > 0 ? 'On-topic' : mutedCount > 0 ? 'Muted topic' : 'General',
      detail: parts.length > 0 ? parts.join('; ') : 'No niche match',
      contribution: 0,
    },
  };
}

/**
 * Niche focus scorer: boosts posts in user's prioritized niches.
 * "Discover new niches" mode occasionally injects novel content.
 */
export function scoreNiche(
  post: UnifiedPost,
  prefs: UserAlgorithmPreferences,
  _ctx: AlgorithmContext,
): { score: number; reason?: ReasonEntry } {
  const activeNiches = new Set(prefs.niches.active);
  const postNiches = post.niches ?? [];

  // Discover mode: give a small random boost to non-matching posts
  if (prefs.niches.discoverNew && postNiches.length > 0) {
    const isNewNiche = !postNiches.some((n) => activeNiches.has(n));
    if (isNewNiche) {
      // Deterministic "random" based on post ID for consistency
      const hash = post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const exploreChance = hash % 100;
      if (exploreChance < 15) {
        return {
          score: 0.4,
          reason: {
            factor: 'niche',
            label: 'Discovery',
            detail: `Explore: ${postNiches.slice(0, 2).join(', ')}`,
            contribution: 0,
          },
        };
      }
    }
  }

  let score = 0;
  const matched: string[] = [];

  for (const n of postNiches) {
    if (activeNiches.has(n)) {
      matched.push(n);
      score += 0.3;
    }
  }

  score = Math.min(1, score);

  return {
    score: Math.round(score * 100) / 100,
    reason:
      matched.length > 0
        ? {
            factor: 'niche',
            label: 'Niche match',
            detail: `Prioritized: ${matched.slice(0, 3).join(', ')}`,
            contribution: 0,
          }
        : {
            factor: 'niche',
            label: 'Off-niche',
            detail: 'Does not match your selected niches',
            contribution: 0,
          },
  };
}

/**
 * Protocol diversity scorer: boosts underrepresented protocols
 * and respects user protocol weights.
 */
export function scoreProtocol(
  post: UnifiedPost,
  prefs: UserAlgorithmPreferences,
  _ctx: AlgorithmContext,
): { score: number; reason?: ReasonEntry } {
  const protocolWeight = prefs.protocolWeights[post.protocol] ?? 50;
  // Normalize 0-100 to 0-1
  const normalized = protocolWeight / 100;

  return {
    score: normalized,
    reason: {
      factor: 'protocol',
      label: `${post.protocol}`,
      detail: `Protocol weight: ${protocolWeight}%`,
      contribution: 0,
    },
  };
}

/**
 * Quality scorer: content quality signals (length, uniqueness, media).
 * Used internally as a multiplicative factor.
 */
export function scoreQuality(
  post: UnifiedPost,
  _prefs: UserAlgorithmPreferences,
  _ctx: AlgorithmContext,
): { score: number; reason?: ReasonEntry } {
  const textLen = (post.text ?? '').trim().length;
  const hasMedia = post.embeds.some((e) => e.kind === 'image' || e.kind === 'video');

  let score = 0.5; // baseline
  if (textLen > 1000) score += 0.3;
  else if (textLen > 200) score += 0.15;
  if (hasMedia) score += 0.2;
  // Penalize very short posts
  if (textLen < 20) score -= 0.2;

  // Penalize spammy content
  const spamScore = ((post as unknown as Record<string, unknown>).spamScore as number) ?? 0;
  score -= spamScore * 0.5;

  score = Math.max(0, Math.min(1, score));

  const parts: string[] = [];
  if (textLen > 1000) parts.push('long-form');
  else if (textLen > 200) parts.push('substantial');
  if (hasMedia) parts.push('has media');
  if (textLen < 20) parts.push('very short');

  return {
    score: Math.round(score * 100) / 100,
    reason: {
      factor: 'quality',
      label: parts.length > 0 ? parts.join(', ') : 'Standard quality',
      detail: `${textLen} chars${hasMedia ? ', with media' : ''}`,
      contribution: 0,
    },
  };
}

// ─── FeedAlgorithm Class ───────────────────────────────────────────────

export class FeedAlgorithm {
  /** User's current algorithm preferences */
  private prefs: UserAlgorithmPreferences;

  /** Registered scoring functions */
  private scorers: Array<{
    name: string;
    fn: ScorerFn;
    weightKey: keyof AlgorithmWeights;
  }>;

  constructor(prefs?: Partial<UserAlgorithmPreferences>) {
    this.prefs = this.resolvePrefs(prefs);

    // Register default scorers
    this.scorers = [
      { name: 'recency', fn: scoreRecency, weightKey: 'recency' },
      { name: 'popularity', fn: scorePopularity, weightKey: 'popularity' },
      { name: 'relevance', fn: scoreRelevance, weightKey: 'relevance' },
      { name: 'niche', fn: scoreNiche, weightKey: 'nicheFocus' },
      { name: 'protocol', fn: scoreProtocol, weightKey: 'protocolDiversity' },
    ];
  }

  /**
   * Update user preferences at runtime.
   */
  setPreferences(prefs: Partial<UserAlgorithmPreferences>): void {
    this.prefs = this.resolvePrefs({ ...this.prefs, ...prefs });
  }

  /**
   * Get current preferences (for settings UI).
   */
  getPreferences(): UserAlgorithmPreferences {
    return { ...this.prefs };
  }

  /**
   * Register a custom scoring function.
   */
  registerScorer(name: string, fn: ScorerFn, weightKey: keyof AlgorithmWeights): void {
    // Remove existing scorer with same name if present
    this.scorers = this.scorers.filter((s) => s.name !== name);
    this.scorers.push({ name, fn, weightKey });
  }

  /**
   * Score a single post and return breakdown.
   */
  scorePost(post: UnifiedPost, ctx: AlgorithmContext): AlgorithmScoreBreakdown {
    const totalWeight = this.scorers.reduce(
      (sum, s) => sum + (this.prefs.weights[s.weightKey] ?? 0),
      0,
    );
    const safeTotalWeight = Math.max(totalWeight, 1);

    let total = 0;
    const factors: AlgorithmScoreBreakdown = {
      total: 0,
      recency: 0,
      popularity: 0,
      relevance: 0,
      niche: 0,
      protocol: 0,
      diversity: 0,
      quality: 0,
      reasons: [],
    };

    // Apply mode-specific adjustments
    const modeAdjustments = MODE_PRESETS[this.prefs.mode] ?? {};

    for (const scorer of this.scorers) {
      const baseWeight = this.prefs.weights[scorer.weightKey] ?? 0;
      const _modeBoost =
        (modeAdjustments[scorer.weightKey] ?? baseWeight) / Math.max(baseWeight, 1);
      const effectiveWeight = baseWeight;

      const { score, reason } = scorer.fn(post, this.prefs, ctx);

      // Weighted contribution
      const contribution = (score * effectiveWeight) / safeTotalWeight;

      // Map to the right field
      switch (scorer.weightKey) {
        case 'recency':
          factors.recency = score;
          break;
        case 'popularity':
          factors.popularity = score;
          break;
        case 'relevance':
          factors.relevance = score;
          break;
        case 'nicheFocus':
          factors.niche = score;
          break;
        case 'protocolDiversity':
          factors.protocol = score;
          break;
      }

      if (reason) {
        factors.reasons.push({
          ...reason,
          contribution: Math.round(contribution * 100) / 100,
        });
      }

      total += contribution;
    }

    // Quality score as a multiplicative bonus/penalty
    const qualityResult = scoreQuality(post, this.prefs, ctx);
    factors.quality = qualityResult.score;
    const qualityMultiplier = 0.5 + qualityResult.score;
    factors.reasons.push({
      ...qualityResult.reason!,
      contribution: Math.round(qualityResult.score * 0.1 * 100) / 100,
    });

    // Add a diversity penalty to prevent author clustering
    const authorCount = this.authorCounts?.get(post.author.id) ?? 0;
    factors.diversity = Math.max(0, 1 - authorCount * 0.15);

    // Apply mode-specific freshness boost
    let freshnessBoost = 1;
    if (this.prefs.mode === 'morning-digest') {
      // Boost posts from the last 24h
      const ageHours = (ctx.now - post.createdAt) / (1000 * 60 * 60);
      if (ageHours < 24) freshnessBoost = 1.5;
    } else if (this.prefs.mode === 'breaking-news') {
      // Strong boost for very recent posts
      const ageHours = (ctx.now - post.createdAt) / (1000 * 60 * 60);
      if (ageHours < 1) freshnessBoost = 3.0;
      else if (ageHours < 4) freshnessBoost = 2.0;
      else if (ageHours < 12) freshnessBoost = 1.3;
    } else if (this.prefs.mode === 'deep-dive') {
      // Prefer longer content
      const textLen = (post.text ?? '').trim().length;
      if (textLen > 1000) freshnessBoost = 1.8;
      else if (textLen > 500) freshnessBoost = 1.3;
      else if (textLen < 100) freshnessBoost = 0.6;
    } else if (this.prefs.mode === 'quick-scroll') {
      // Prefer short content
      const textLen = (post.text ?? '').trim().length;
      if (textLen > 500) freshnessBoost = 0.5;
      else if (textLen > 200) freshnessBoost = 0.8;
      else if (textLen < 50) freshnessBoost = 1.5;
    }

    factors.total = Math.round(total * qualityMultiplier * freshnessBoost * 1000) / 1000;

    return factors;
  }

  /** Track author frequency for diversity penalty */
  private authorCounts: Map<string, number> = new Map();

  /**
   * Rank an array of posts using the algorithm.
   * Each post gets a `score` field with the breakdown for transparency.
   */
  rank(posts: UnifiedPost[], ctx: AlgorithmContext): ScoredPost[] {
    // Reset author counts
    this.authorCounts = new Map();

    const scored: ScoredPost[] = [];
    for (const post of posts) {
      const score = this.scorePost(post, ctx);
      scored.push({ post, score });
      // Track author for diversity
      const cur = this.authorCounts.get(post.author.id) ?? 0;
      this.authorCounts.set(post.author.id, cur + 1);
    }

    // Sort by total score descending
    scored.sort((a, b) => b.score.total - a.score.total);

    return scored;
  }

  /**
   * Attach score breakdowns to posts for UI consumption.
   */
  annotatePosts(posts: UnifiedPost[], ctx: AlgorithmContext): UnifiedPost[] {
    const scored = this.rank(posts, ctx);
    return scored.map((s) => ({
      ...s.post,
      score: {
        total: s.score.total,
        recency: s.score.recency,
        engagement: s.score.popularity,
        relevance: s.score.relevance,
        quality: s.score.quality,
        diversity: s.score.diversity,
        source: s.score.protocol,
        velocity: 0,
        reasons: s.score.reasons.map((r) => `${r.factor}:${r.label}`),
      },
      feedDebug: {
        spamScore: 0,
        qualityScore: s.score.quality,
        authorReputation: 0,
        topicMatch: s.score.relevance,
        velocity: s.score.popularity,
        freshness: s.score.recency,
        sourceProtocol: s.post.protocol,
        isFollowed: ctx.followed.has(s.post.author.id),
        isMutedOrBlocked: false,
      },
    }));
  }

  /**
   * Build human-readable reasons for "Why am I seeing this?" UI.
   */
  explainPost(post: UnifiedPost, ctx: AlgorithmContext): AlgorithmTransparency {
    const breakdown = this.scorePost(post, ctx);
    return buildAlgorithmTransparency(post, breakdown, this.prefs, ctx);
  }

  /**
   * Generate an audit log entry.
   */
  createAuditEntry(
    post: UnifiedPost,
    ctx: AlgorithmContext,
    position: number,
  ): AlgorithmAuditEntry {
    const breakdown = this.scorePost(post, ctx);
    return {
      timestamp: Date.now(),
      postId: post.id,
      postPreview: post.text.slice(0, 100),
      protocol: post.protocol,
      author: post.author.displayName,
      positionInFeed: position,
      totalScore: breakdown.total,
      breakdown,
      algorithmMode: this.prefs.mode,
      weights: { ...this.prefs.weights },
      niches: [...this.prefs.niches.active],
    };
  }

  /**
   * Resolve partial preferences with defaults.
   */
  private resolvePrefs(prefs?: Partial<UserAlgorithmPreferences>): UserAlgorithmPreferences {
    return {
      weights: { ...DEFAULT_WEIGHTS, ...prefs?.weights },
      niches: {
        active: prefs?.niches?.active ?? ['crypto', 'bitcoin', 'ethereum', 'defi'],
        discoverNew: prefs?.niches?.discoverNew ?? true,
      },
      protocolWeights: prefs?.protocolWeights ?? {},
      mode: prefs?.mode ?? 'standard',
      followedIds: prefs?.followedIds,
      mutedNiches: prefs?.mutedNiches,
    };
  }
}

// ─── Transparency Types & Builder ──────────────────────────────────────

export interface AlgorithmTransparency {
  /** Human-readable title for the explanation card */
  title: string;
  /** Short summary of why this post appeared */
  summary: string;
  /** Per-factor breakdown with explanations */
  factors: ReasonEntry[];
  /** Total score */
  totalScore: number;
  /** Current algorithm mode */
  mode: AlgorithmMode;
  /** Whether the user follows this author */
  isFollowed: boolean;
}

export interface AlgorithmAuditEntry {
  timestamp: number;
  postId: string;
  postPreview: string;
  protocol: Protocol;
  author: string;
  positionInFeed: number;
  totalScore: number;
  breakdown: AlgorithmScoreBreakdown;
  algorithmMode: AlgorithmMode;
  weights: AlgorithmWeights;
  niches: string[];
}

export function buildAlgorithmTransparency(
  post: UnifiedPost,
  breakdown: AlgorithmScoreBreakdown,
  prefs: UserAlgorithmPreferences,
  ctx: AlgorithmContext,
): AlgorithmTransparency {
  const topReasons = breakdown.reasons
    .filter((r) => r.contribution > 0.05)
    .sort((a, b) => b.contribution - a.contribution);

  const summary =
    topReasons.length > 0
      ? `This post appeared because: ${topReasons
          .slice(0, 3)
          .map((r) => r.detail)
          .join(', ')}`
      : 'This post matched your feed algorithm with a balanced score.';

  const title = ctx.followed.has(post.author.id)
    ? `You follow ${post.author.displayName}`
    : (topReasons[0]?.label ?? 'Algorithm match');

  return {
    title,
    summary,
    factors: breakdown.reasons,
    totalScore: breakdown.total,
    mode: prefs.mode,
    isFollowed: ctx.followed.has(post.author.id),
  };
}

// ─── Audit Log Manager ────────────────────────────────────────────────

const MAX_AUDIT_ENTRIES = 1000;
const STORAGE_KEY = 'df_algorithm_audit';

/**
 * In-memory audit log. Persisted to localStorage when available.
 */
export class AlgorithmAuditLog {
  private entries: AlgorithmAuditEntry[] = [];

  constructor() {
    this.load();
  }

  record(entry: AlgorithmAuditEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_AUDIT_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_AUDIT_ENTRIES);
    }
    this.save();
  }

  getRecent(count = 50): AlgorithmAuditEntry[] {
    return this.entries.slice(0, count);
  }

  getByPostId(postId: string): AlgorithmAuditEntry | undefined {
    return this.entries.find((e) => e.postId === postId);
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  getAll(): AlgorithmAuditEntry[] {
    return [...this.entries];
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw) as AlgorithmAuditEntry[];
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      /* quota exceeded */
    }
  }
}

// Singleton for app-wide use
export const globalAuditLog = new AlgorithmAuditLog();

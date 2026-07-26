/**
 * unified-feed — Orchestrator that blends social posts (Nostr, Farcaster, etc.)
 * with content-platform posts (Lemmy, PeerTube, YouTube, Mastodon) into a
 * single interleaved timeline.
 */

import { deduplicatePosts } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';
import { applyCurationPipeline } from './feed-curation-rules';
import type { ExecutionContext } from './feed-fetcher';
import {
  collectProviderResults,
  FEED_GENERATION_TIMEOUT_MS,
  fetchFromProviders,
} from './feed-fetcher';
import {
  applyQualityPipeline,
  DEFAULT_FRESHNESS_CONFIG,
  type FreshnessScoringConfig,
  HOT_FRESHNESS_CONFIG,
  type QualityPipelineOptions,
  TOP_FRESHNESS_CONFIG,
  TRENDING_FRESHNESS_CONFIG,
} from './feed-quality-gates';
import { fetchLemmyPosts, fetchPeerTubeVideos, fetchYouTubeVideos } from './unified-fetchers';

const SOCIAL_PROTOCOLS: Protocol[] = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];

export type SourceCategory =
  | 'social'
  | 'lemmy'
  | 'peertube'
  | 'youtube'
  | 'mastodon'
  | 'rss'
  | 'reddit';

export interface UnifiedFeedOptions {
  /** Comma-separated source list: social,lemmy,peertube,youtube,mastodon */
  sources?: string;
  /** Blend mode: balanced, social-heavy, video-heavy, discussion-heavy */
  mix?: 'balanced' | 'social-heavy' | 'video-heavy' | 'discussion-heavy';
  limit?: number;
  section?: string;
  cursor?: string;
  /** Quality pipeline options. Set qualityGate.freshnessConfig to null to disable freshness scoring. */
  qualityGate?: QualityPipelineOptions;
  /** Tab name for freshness config selection (hot, trending, top, new). Overrides qualityGate.freshnessConfig. */
  freshnessTab?: 'everything' | 'hot' | 'trending' | 'top' | 'new';
  /** "Show more from X" — boost a specific protocol weight */
  showMoreProtocol?: string;
  /** "Show less from X" — reduce a specific protocol weight */
  showLessProtocol?: string;
  /** Exclude specific protocols entirely */
  excludeProtocols?: string[];
  /** Minimum posts from each enabled source category */
  minPerSource?: number;
}

export interface UnifiedFeedPost extends UnifiedPost {
  sourceBadge: string;
  sourceColor: string;
  sourceLabel: string;
}

const BADGES: Record<string, { emoji: string; color: string; label: string }> = {
  nostr: { emoji: '\u26A1', color: '#8e30eb', label: 'Nostr' },
  farcaster: { emoji: '\uD83D\uDFE3', color: '#8a63d2', label: 'Farcaster' },
  lens: { emoji: '\uD83C\uDF3F', color: '#abfe2c', label: 'Lens' },
  bluesky: { emoji: '\uD83E\uDD8B', color: '#1185fe', label: 'Bluesky' },
  mastodon: { emoji: '\uD83D\uDC18', color: '#6364ff', label: 'Mastodon' },
  pleroma: { emoji: '\uD83D\uDC18', color: '#9b59b6', label: 'Pleroma' },
  akkoma: { emoji: '\uD83D\uDC18', color: '#e67e22', label: 'Akkoma' },
  misskey: { emoji: '\uD83D\uDCF7', color: '#4ecdc4', label: 'Misskey' },
  firefish: { emoji: '\uD83D\uDCF7', color: '#ff6b6b', label: 'Firefish' },
  lemmy: { emoji: '\uD83C\uDF4B', color: '#00b868', label: 'Lemmy' },
  peertube: { emoji: '\uD83D\uDCF9', color: '#f1680d', label: 'PeerTube' },
  youtube: { emoji: '\u25B6\uFE0F', color: '#ff0000', label: 'YouTube' },
  rss: { emoji: '\uD83D\uDCE1', color: '#ffa500', label: 'RSS' },
  reddit: { emoji: '\uD83D\uDD34', color: '#ff4500', label: 'Reddit' },
};

/**
 * Resolve badge for a post. Mastodon posts check the raw _fediverseSoftware
 * field to render Pleroma/Akkoma/Misskey/Firefish badges instead.
 */
function badgeFor(
  protocol: string,
  post?: { raw?: Record<string, unknown> },
): { emoji: string; color: string; label: string } {
  // Fediverse software detection: any mastodon-protocol post with _fediverseSoftware
  if (protocol === 'mastodon' && post?.raw) {
    const software = (post.raw as Record<string, unknown>)._fediverseSoftware as string | undefined;
    if (software && BADGES[software]) {
      return BADGES[software] as {
        emoji: string;
        color: string;
        label: string;
      };
    }
  }
  return BADGES[protocol] ?? { emoji: '\u25CF', color: '#666', label: protocol };
}

// ─── Freshness config per tab ─────────────────────────────────────

function freshnessConfigForTab(tab: string): FreshnessScoringConfig {
  switch (tab) {
    case 'trending':
      return TRENDING_FRESHNESS_CONFIG;
    case 'top':
      return TOP_FRESHNESS_CONFIG;
    case 'new':
      return DEFAULT_FRESHNESS_CONFIG;
    default:
      return HOT_FRESHNESS_CONFIG;
  }
}

// ─── Mix weights by blend mode ─────────────────────────────────────

interface MixWeights {
  social: number;
  lemmy: number;
  peertube: number;
  youtube: number;
  mastodon: number;
  rss: number;
  reddit: number;
}

function getMixWeights(mix: string): MixWeights {
  switch (mix) {
    case 'social-heavy':
      return {
        social: 5,
        lemmy: 1,
        peertube: 1,
        youtube: 1,
        mastodon: 1,
        rss: 1,
        reddit: 1,
      };
    case 'video-heavy':
      return {
        social: 1,
        lemmy: 1,
        peertube: 3,
        youtube: 3,
        mastodon: 1,
        rss: 1,
        reddit: 1,
      };
    case 'discussion-heavy':
      return {
        social: 1,
        lemmy: 4,
        peertube: 1,
        youtube: 1,
        mastodon: 2,
        rss: 1,
        reddit: 2,
      };
    default: // balanced
      return {
        social: 2,
        lemmy: 2,
        peertube: 2,
        youtube: 2,
        mastodon: 2,
        rss: 2,
        reddit: 1,
      };
  }
}

/**
 * Adjust mix weights based on showMore/showLess options.
 */
function adjustMixForPreference(
  mix: MixWeights,
  showMore?: string,
  showLess?: string,
  excludeProtocols?: string[],
): MixWeights {
  const adjusted = { ...mix };

  // Helper: safely multiply a source weight
  const boostSource = (sourceKey: keyof MixWeights, factor: number): void => {
    const current = adjusted[sourceKey];
    if (current !== undefined) {
      (adjusted as Record<string, number>)[sourceKey] = Math.min(10, Math.floor(current * factor));
    }
  };
  const reduceSource = (sourceKey: keyof MixWeights, divisor: number): void => {
    const current = adjusted[sourceKey];
    if (current !== undefined) {
      (adjusted as Record<string, number>)[sourceKey] = Math.max(0, Math.floor(current / divisor));
    }
  };

  const protocolMap: Record<string, keyof MixWeights> = {
    nostr: 'social',
    farcaster: 'social',
    lens: 'social',
    bluesky: 'social',
    threads: 'social',
    mastodon: 'mastodon',
    lemmy: 'lemmy',
    peertube: 'peertube',
    youtube: 'youtube',
    rss: 'rss',
    reddit: 'reddit',
  };

  // "Show more from X" — triple the weight for that source
  if (showMore) {
    const key = showMore.toLowerCase() as keyof MixWeights;
    if (key in adjusted) boostSource(key, 3);
    if (key in protocolMap) boostSource(protocolMap[key]!, 3);
  }

  // "Show less from X" — halve the weight
  if (showLess) {
    const key = showLess.toLowerCase() as keyof MixWeights;
    if (key in adjusted) reduceSource(key, 2);
    if (key in protocolMap) reduceSource(protocolMap[key]!, 2);
  }

  // Exclude specific protocols — zero their weights
  if (excludeProtocols && excludeProtocols.length > 0) {
    for (const proto of excludeProtocols) {
      const mapKey = protocolMap[proto.toLowerCase()];
      if (mapKey) (adjusted as Record<string, number>)[mapKey] = 0;
      const protoKey = proto.toLowerCase() as keyof MixWeights;
      if (protoKey in adjusted) (adjusted as Record<string, number>)[protoKey] = 0;
    }
  }

  return adjusted;
}

// ─── Source resolution ─────────────────────────────────────────────

function resolveSources(rawSources?: string): Set<SourceCategory> {
  if (!rawSources || rawSources === 'all') {
    return new Set<SourceCategory>([
      'social',
      'lemmy',
      'peertube',
      'youtube',
      'mastodon',
      'rss',
      'reddit',
    ]);
  }
  const valid = new Set<SourceCategory>([
    'social',
    'lemmy',
    'peertube',
    'youtube',
    'mastodon',
    'rss',
    'reddit',
  ]);
  const requested = rawSources.split(',').map((s) => s.trim().toLowerCase());
  const result = new Set<SourceCategory>();
  for (const s of requested) {
    if (valid.has(s as SourceCategory)) result.add(s as SourceCategory);
  }
  if (result.size === 0) return new Set<SourceCategory>(['social']);
  return result;
}

// ─── Main orchestrator ─────────────────────────────────────────────

export async function buildUnifiedFeed(
  env: Env,
  opts: UnifiedFeedOptions = {},
  execCtx?: ExecutionContext,
): Promise<{
  posts: UnifiedFeedPost[];
  meta: Record<string, unknown>;
}> {
  const startTime = Date.now();
  const sources = resolveSources(opts.sources);
  let mix = getMixWeights(opts.mix ?? 'balanced');
  mix = adjustMixForPreference(
    mix,
    opts.showMoreProtocol,
    opts.showLessProtocol,
    opts.excludeProtocols,
  );
  const limit = Math.min(opts.limit ?? 100, 200);
  const section = opts.section ?? 'hot';

  const fetchPromises: Promise<{
    source: SourceCategory;
    posts: UnifiedPost[];
    error?: string;
  }>[] = [];

  // Social protocols via the main provider pipeline
  if (sources.has('social')) {
    fetchPromises.push(
      (async () => {
        try {
          const results = await fetchFromProviders(
            env,
            SOCIAL_PROTOCOLS,
            Math.ceil((limit * mix.social) / 5),
            [],
            execCtx,
          );
          const { posts } = collectProviderResults(results);
          return { source: 'social' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'social' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  // Lemmy
  if (sources.has('lemmy')) {
    fetchPromises.push(
      (async () => {
        try {
          const { posts } = await fetchLemmyPosts(
            section,
            opts.cursor,
            Math.ceil(limit * mix.lemmy),
          );
          return { source: 'lemmy' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'lemmy' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  // PeerTube
  if (sources.has('peertube')) {
    fetchPromises.push(
      (async () => {
        try {
          const posts = await fetchPeerTubeVideos(Math.ceil(limit * mix.peertube));
          return { source: 'peertube' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'peertube' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  // YouTube
  if (sources.has('youtube')) {
    fetchPromises.push(
      (async () => {
        try {
          const { posts } = await fetchYouTubeVideos(Math.ceil(limit * mix.youtube));
          return { source: 'youtube' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'youtube' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  // Mastodon (also in social, but if requested standalone)
  if (sources.has('mastodon') && !sources.has('social')) {
    fetchPromises.push(
      (async () => {
        try {
          const results = await fetchFromProviders(
            env,
            ['mastodon'],
            Math.ceil(limit * mix.mastodon),
            [],
            execCtx,
          );
          const { posts } = collectProviderResults(results);
          return { source: 'mastodon' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'mastodon' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  // RSS and Reddit (news sources)
  if (sources.has('rss')) {
    fetchPromises.push(
      (async () => {
        try {
          const results = await fetchFromProviders(
            env,
            ['rss'],
            Math.ceil(limit * mix.rss),
            [],
            execCtx,
          );
          const { posts } = collectProviderResults(results);
          return { source: 'rss' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'rss' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  if (sources.has('reddit')) {
    fetchPromises.push(
      (async () => {
        try {
          const results = await fetchFromProviders(
            env,
            ['reddit'],
            Math.ceil(limit * mix.reddit),
            [],
            execCtx,
          );
          const { posts } = collectProviderResults(results);
          return { source: 'reddit' as SourceCategory, posts };
        } catch (err) {
          return {
            source: 'reddit' as SourceCategory,
            posts: [],
            error: err instanceof Error ? err.message : 'failed',
          };
        }
      })(),
    );
  }

  // Race source fetches against feed generation timeout.
  // If any source takes too long, return partial results.
  type FetchResult = PromiseSettledResult<{
    source: SourceCategory;
    posts: UnifiedPost[];
    error?: string;
  }>;

  const fetchTimeout: Promise<{ results: FetchResult[]; timedOut: boolean }> = Promise.race([
    Promise.allSettled(fetchPromises).then((r) => ({
      results: r,
      timedOut: false,
    })),
    new Promise<{ results: FetchResult[]; timedOut: boolean }>((resolve) =>
      setTimeout(() => resolve({ results: [], timedOut: true }), FEED_GENERATION_TIMEOUT_MS),
    ),
  ]);

  const { results, timedOut } = await fetchTimeout;

  // Collect all posts, tag with source category
  const allPosts: Array<UnifiedPost & { sourceCategory: SourceCategory }> = [];
  const errors: string[] = [];
  const perSource: Record<string, number> = {};
  const feedTimedOut = timedOut;

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const src = r.value.source;
      perSource[src] = (perSource[src] ?? 0) + r.value.posts.length;
      if (r.value.error) errors.push(`${src}: ${r.value.error}`);
      for (const p of r.value.posts) {
        (p as unknown as Record<string, unknown>).sourceCategory = r.value.source;
        allPosts.push(p as unknown as UnifiedPost & { sourceCategory: SourceCategory });
      }
    } else {
      errors.push(`fetch: ${r.reason instanceof Error ? r.reason.message : 'unknown'}`);
    }
  }

  // If the feed timed out, add a notice
  if (feedTimedOut) {
    errors.push(
      `feed generation timed out after ${FEED_GENERATION_TIMEOUT_MS}ms — partial results`,
    );
  }

  // Deduplicate across all sources
  const deduped = deduplicatePosts(allPosts as unknown as UnifiedPost[]) as unknown as Array<
    UnifiedPost & { sourceCategory: SourceCategory }
  >;

  // Interleave by time (newest first), not grouped by source
  deduped.sort((a, b) => b.createdAt - a.createdAt);

  // ── Quality pipeline ───────────────────────────────────────────
  // quality gate → engagement floor → language filter → dedup
  // → freshness → diversity → curation
  const freshnessTab = opts.freshnessTab ?? 'hot';
  const freshnessConfig = freshnessConfigForTab(freshnessTab);
  const qualityOpts: QualityPipelineOptions = {
    minQualityScore: freshnessTab === 'everything' ? 0 : 0.3,
    enforceEngagementFloor: freshnessTab !== 'everything',
    engagementFloorAgeHours: 24,
    preferEnglish: freshnessTab !== 'everything',
    crossProtocolDedup: true,
    freshnessConfig,
    maxPctPerSource: 30,
    now: Date.now(),
    ...opts.qualityGate,
  };
  const qualityResult = applyQualityPipeline(deduped as unknown as UnifiedPost[], qualityOpts);

  // Apply curation pipeline: freshness boost, protocol interleaving, content type
  // variety, and category rotation before limiting — now on quality-filtered posts
  const curated = applyCurationPipeline(qualityResult.posts, {
    freshnessBoost: freshnessTab !== 'everything',
    interleaveProtocols: true,
    maxConsecutiveProtocols: opts.showMoreProtocol ? 3 : 2,
    contentTypeVariety: true,
    maxConsecutiveContentType: 3,
    categoryRotation: true,
    minCategories: 3,
    showMoreProtocol: opts.showMoreProtocol,
    showLessProtocol: opts.showLessProtocol,
  }) as unknown as Array<UnifiedPost & { sourceCategory: SourceCategory }>;

  // Limit
  const limited = curated.slice(0, limit);

  // Attach badge metadata
  const enriched: UnifiedFeedPost[] = limited.map((p) => {
    const protocol = (p as unknown as { protocol?: string }).protocol ?? 'rss';
    const raw = (p as unknown as { raw?: Record<string, unknown> }).raw;
    const badge = badgeFor(protocol, raw ? { raw } : undefined);
    return {
      ...p,
      sourceBadge: badge.emoji,
      sourceColor: badge.color,
      sourceLabel: badge.label,
    } as unknown as UnifiedFeedPost;
  });

  const elapsed = Date.now() - startTime;

  return {
    posts: enriched,
    meta: {
      total: enriched.length,
      limit,
      perSource,
      errors: errors.length > 0 ? errors : undefined,
      fetchedAt: Date.now(),
      feedTimedOut,
      feedGenerationMs: elapsed,
      feedTimeoutMs: FEED_GENERATION_TIMEOUT_MS,
      mix: opts.mix ?? 'balanced',
      sources: Array.from(sources),
      qualityGate: {
        qualityFiltered: qualityResult.meta.quality.filtered,
        engagementDeprioritized: qualityResult.meta.engagement.deprioritized,
        languageFiltered: qualityResult.meta.language.filtered,
        crossProtocolDeduped: qualityResult.meta.dedup.deduped,
        crossProtocolDedupCount: qualityResult.meta.dedup.crossProtocol,
        urlDedupCount: qualityResult.meta.dedup.urlDedup,
        rssDedupCount: qualityResult.meta.dedup.rssDedup,
        aggregatorDedupCount: qualityResult.meta.dedup.aggregatorDedup,
        canonicalUrlDedupCount: qualityResult.meta.dedup.canonicalUrlDedup,
        sourceDiverse: qualityResult.meta.diversity.diverse,
        sourceBreakdown: qualityResult.meta.diversity.sourceBreakdown,
        freshnessConfig: freshnessTab,
        totalFiltered: qualityResult.meta.totalFiltered,
        inputPosts: qualityResult.meta.inputCount,
      },
      showMoreProtocol: opts.showMoreProtocol,
      showLessProtocol: opts.showLessProtocol,
    },
  };
}

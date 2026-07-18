/**
 * unified-feed — Orchestrator that blends social posts (Nostr, Farcaster, etc.)
 * with content-platform posts (Lemmy, PeerTube, YouTube, Mastodon) into a
 * single interleaved timeline.
 */

import { deduplicatePosts } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../index';
import type { ExecutionContext } from './feed-fetcher';
import {
  collectProviderResults,
  FEED_GENERATION_TIMEOUT_MS,
  fetchFromProviders,
  ProviderTimer,
} from './feed-fetcher';
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
  lemmy: { emoji: '\uD83C\uDF4B', color: '#00b868', label: 'Lemmy' },
  peertube: { emoji: '\uD83D\uDCF9', color: '#f1680d', label: 'PeerTube' },
  youtube: { emoji: '\u25B6\uFE0F', color: '#ff0000', label: 'YouTube' },
  rss: { emoji: '\uD83D\uDCE1', color: '#ffa500', label: 'RSS' },
  reddit: { emoji: '\uD83D\uDD34', color: '#ff4500', label: 'Reddit' },
};

function badgeFor(protocol: string) {
  return BADGES[protocol] ?? { emoji: '\u25CF', color: '#666', label: protocol };
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
      return { social: 5, lemmy: 1, peertube: 1, youtube: 1, mastodon: 1, rss: 1, reddit: 1 };
    case 'video-heavy':
      return { social: 1, lemmy: 1, peertube: 3, youtube: 3, mastodon: 1, rss: 1, reddit: 1 };
    case 'discussion-heavy':
      return { social: 1, lemmy: 4, peertube: 1, youtube: 1, mastodon: 2, rss: 1, reddit: 2 };
    default: // balanced
      return { social: 2, lemmy: 2, peertube: 2, youtube: 2, mastodon: 2, rss: 2, reddit: 1 };
  }
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
  const mix = getMixWeights(opts.mix ?? 'balanced');
  const limit = Math.min(opts.limit ?? 50, 100);
  const section = opts.section ?? 'hot';

  const fetchPromises: Promise<{ source: SourceCategory; posts: UnifiedPost[]; error?: string }>[] =
    [];

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
    Promise.allSettled(fetchPromises).then((r) => ({ results: r, timedOut: false })),
    new Promise<{ results: FetchResult[]; timedOut: boolean }>((resolve) =>
      setTimeout(
        () => resolve({ results: [], timedOut: true }),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]);

  const { results, timedOut } = await fetchTimeout;

  // Collect all posts, tag with source category
  const allPosts: Array<UnifiedPost & { sourceCategory: SourceCategory }> = [];
  const errors: string[] = [];
  const perSource: Record<string, number> = {};
  let feedTimedOut = timedOut;

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
    errors.push(`feed generation timed out after ${FEED_GENERATION_TIMEOUT_MS}ms — partial results`);
  }

  // Deduplicate across all sources
  const deduped = deduplicatePosts(allPosts as unknown as UnifiedPost[]) as unknown as Array<
    UnifiedPost & { sourceCategory: SourceCategory }
  >;

  // Interleave by time (newest first), not grouped by source
  deduped.sort((a, b) => b.createdAt - a.createdAt);

  // Limit
  const limited = deduped.slice(0, limit);

  // Attach badge metadata
  const enriched: UnifiedFeedPost[] = limited.map((p) => {
    const protocol = (p as unknown as { protocol?: string }).protocol ?? 'rss';
    const badge = badgeFor(protocol);
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
    },
  };
}

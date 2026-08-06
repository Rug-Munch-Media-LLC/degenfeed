/**
 * news-aggregator — Smart news aggregation engine.
 *
 * Thin orchestrator: fetches from all sources, enriches, deduplicates,
 * clusters, scores, and ranks news stories.
 *
 * Layer in the feed stack: fetch → enrich → dedup → cluster → score → rank
 *
 * CPU budget (Cloudflare error 1102 guard):
 *  - The whole pipeline races a wall-clock deadline (NEWS.AGGREGATION_TIMEOUT_MS,
 *    default 25s, override NEWS_AGGREGATION_TIMEOUT_MS). On timeout we return
 *    whatever partial results have been produced so far instead of crashing.
 *  - RSS fan-out is bounded (3 concurrent fetches, 4s per feed) with an early
 *    bail once NEWS.MAX_ARTICLES raw items are collected.
 *  - Article enrichment is capped (NEWS.ENRICH_LIMIT, default 10, override
 *    NEWS_ENRICH_LIMIT) with 2 concurrent fetches and a 2s per-article timeout.
 */

import type { Env } from '../types';
import { log } from '../logger';
import { detectNiches } from '@degenfeed/feed-core';
import type {
  AggregatedStory,
  AggregationOptions,
  AggregationResult,
  ArticleEnrichment,
  NewsSourceMeta,
  ParsedRssItem,
  StoryCluster,
} from './news-types';

// Re-export types for consumers still importing from this file
export type { AggregatedStory, AggregationOptions, AggregationResult } from './news-types';
import {
  analyzeSentiment,
  computeCredibility,
  computeFreshness,
  contentHash,
  estimateReadingTime,
  extractEntities,
  jaccardSimilarity,
  mergeStory,
  normalizeUrl,
  stripTags,
  titleSimilarity,
  withConcurrencyLimit,
} from './news-helpers';
import { fetchRssFeed, parseFeedXml } from './news-rss-parser';
import { NEWS_SOURCES, NEWSLETTER_FEEDS } from './news-source-tiers';
import {
  computeBiasDistribution,
  sourceBias,
  sourceBiasScore,
  sourceFactuality,
  type BiasLabel,
} from './news-bias';
import { NEWS } from '../constants';

/**
 * Parse a positive integer env override; falls back to `fallback` when the
 * value is unset, non-numeric, or <= 0.
 */
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Total number of unique news sources.
 */
export function computeTotalSourceCount(): number {
  const mainIds = new Set(NEWS_SOURCES.map((s) => s.id));
  const nlIds = new Set(NEWSLETTER_FEEDS.map((s) => s.id));
  return mainIds.size + nlIds.size;
}

/**
 * Fetch stories from protocol-based sources (Nostr, Farcaster, Bluesky).
 */
async function fetchProtocolSources(
  env: Env,
): Promise<Array<{ item: ParsedRssItem; source: NewsSourceMeta }>> {
  const results: Array<{ item: ParsedRssItem; source: NewsSourceMeta }> = [];

  try {
    const { getProvider } = await import('./feed-fetcher');
    const providers = ['nostr', 'farcaster', 'bluesky'] as const;

    const providerResults = await Promise.allSettled(
      providers.map(async (protocol) => {
        try {
          const provider = getProvider(protocol, env);
          const result = await provider.fetchFeed({ timeoutMs: 4000, concurrency: 2 });
          return result.posts
            .filter((p) => {
              const text = `${p.text} ${p.niches?.join(' ') ?? ''}`.toLowerCase();
              return (
                p.embeds?.some((e) => e.kind === 'link') &&
                (p.niches?.length > 0 || text.includes('news') || text.includes('report'))
              );
            })
            .map((post): { item: ParsedRssItem; source: NewsSourceMeta } => ({
              item: {
                title: post.text.slice(0, 200).split('\n')[0] || `Post from ${post.author.displayName}`,
                link: post.embeds?.find((e) => e.kind === 'link')?.url ?? `https://degenfeed.xyz/post/${post.id}`,
                description: post.text.slice(0, 500),
                pubDate: new Date(post.createdAt).toISOString(),
                creator: post.author.displayName,
                content: post.html || post.text,
                image: post.embeds?.find((e) => e.kind === 'image')?.url ?? '',
                categories: post.niches ?? [],
              },
              source: {
                id: `${protocol}:${post.id.slice(0, 8)}`,
                name: `${protocol.charAt(0).toUpperCase() + protocol.slice(1)} News`,
                category: 'crypto',
                tier: 3,
                credibility: 0.65,
                weight: 0.9,
                url: '',
                type: protocol,
              },
            }));
        } catch {
          return [] as Array<{ item: ParsedRssItem; source: NewsSourceMeta }>;
        }
      }),
    );

    for (const r of providerResults) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
  } catch {
    /* protocol sources unavailable */
  }

  return results;
}

/**
 * Lightweight fetch to extract og:image, meta description, and author
 * from an article page. Per-article budget is 2s.
 */
async function enrichArticle(url: string, timeoutMs = 2000): Promise<ArticleEnrichment> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; DegenFeed/1.0; +https://degenfeed.xyz)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };
    }

    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let chunk: ReadableStreamReadResult<Uint8Array>;
      while (!(chunk = await reader.read()).done && html.length < 65536) {
        html += decoder.decode(chunk.value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
      html = html.slice(0, 65536);
    }

    const enrichment: ArticleEnrichment = { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };

    const ogImageMatch = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i);
    if (ogImageMatch?.[1]) enrichment.heroImage = ogImageMatch[1];

    if (!enrichment.heroImage) {
      const twImageMatch = html.match(/<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i);
      if (twImageMatch?.[1]) enrichment.heroImage = twImageMatch[1];
    }

    if (!enrichment.heroImage) {
      const firstImg = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*(?:width\s*=\s*["'](\d+)["'])?[^>]*>/i);
      if (firstImg?.[1] && (!firstImg[2] || Number(firstImg[2]) > 200)) {
        if (firstImg[1].startsWith('http')) enrichment.heroImage = firstImg[1];
      }
    }

    const descMatch = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']+)["']/i);
    if (descMatch?.[1]) enrichment.metaDescription = descMatch[1].slice(0, 300);

    if (!enrichment.metaDescription) {
      const ogDescMatch = html.match(/<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']+)["']/i);
      if (ogDescMatch?.[1]) enrichment.metaDescription = ogDescMatch[1].slice(0, 300);
    }

    const authorMatch = html.match(/<meta[^>]+name\s*=\s*["']author["'][^>]+content\s*=\s*["']([^"']+)["']/i);
    if (authorMatch?.[1]) enrichment.authorName = authorMatch[1];

    if (!enrichment.authorName) {
      const ogAuthorMatch = html.match(/<meta[^>]+property\s*=\s*["']article:author["'][^>]+content\s*=\s*["']([^"']+)["']/i);
      if (ogAuthorMatch?.[1]) enrichment.authorName = ogAuthorMatch[1];
    }

    return enrichment;
  } catch {
    return { heroImage: '', metaDescription: '', authorName: '', readingTime: 0 };
  }
}

/**
 * Cluster related stories by similarity.
 */
function clusterStories(stories: AggregatedStory[]): StoryCluster[] {
  const clusters: StoryCluster[] = [];
  const assigned = new Set<string>();

  for (const story of stories) {
    if (assigned.has(story.id)) continue;

    const cluster: AggregatedStory[] = [story];
    assigned.add(story.id);

    for (const other of stories) {
      if (assigned.has(other.id)) continue;
      if (other.id === story.id) continue;

      const titleSim = jaccardSimilarity(story.title, other.title);
      const entityOverlap =
        [...new Set([...story.entities.tokens, ...story.entities.protocols])].filter(
          (t) => [...new Set([...other.entities.tokens, ...other.entities.protocols])].includes(t),
        ).length;

      if (titleSim > 0.3 || entityOverlap >= 2) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    const sortedCluster = cluster.sort((a, b) => b.score - a.score);
    const topCategories = [...new Set(sortedCluster.flatMap((s) => s.categories))].slice(0, 5);
    const topEntities = {
      tokens: [...new Set(sortedCluster.flatMap((s) => s.entities.tokens))].slice(0, 10),
      protocols: [...new Set(sortedCluster.flatMap((s) => s.entities.protocols))].slice(0, 5),
      people: [...new Set(sortedCluster.flatMap((s) => s.entities.people))].slice(0, 5),
      companies: [...new Set(sortedCluster.flatMap((s) => s.entities.companies))].slice(0, 5),
      chains: [...new Set(sortedCluster.flatMap((s) => s.entities.chains))].slice(0, 5),
      nfts: [...new Set(sortedCluster.flatMap((s) => s.entities.nfts))].slice(0, 3),
    };
    const sentimentScores = sortedCluster.map((s) => s.sentiment.score);
    const avgSentiment =
      sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 0;

    const firstStory = sortedCluster[0];
    if (!firstStory) continue;

    clusters.push({
      id: `cluster:${firstStory.id}`,
      title: firstStory.title,
      stories: sortedCluster,
      topCategories,
      topEntities,
      totalCoverage: sortedCluster.length,
      firstSeen: Math.min(...sortedCluster.map((s) => s.publishedAt)),
      lastSeen: Math.max(...sortedCluster.map((s) => s.publishedAt)),
      aggregateSentiment: {
        label: avgSentiment > 0.1 ? 'bullish' : avgSentiment < -0.1 ? 'bearish' : 'neutral',
        score: avgSentiment,
        confidence: Math.min(1, sentimentScores.length / 5),
        signals: [],
      },
    });
  }

  return clusters.sort((a, b) => b.totalCoverage - a.totalCoverage);
}

/**
 * Compute freshness, credibility, velocity, final score, and the bias
 * diversity boost for every story. Idempotent: safe to run on partial
 * results when the aggregation deadline fires mid-pipeline.
 */
function scoreAndBoost(stories: AggregatedStory[]): void {
  if (stories.length === 0) return;

  const now = Date.now();
  for (const story of stories) {
    const { freshScore, isBreaking } = computeFreshness(story.publishedAt, now);
    story.isBreaking = isBreaking;
    story.credibility = computeCredibility(story.sourceMeta, story);
    story.velocity = story.alsoCoveredBy.length * 0.5 + (story.isBreaking ? 2 : 0);
    story.score =
      story.sourceMeta.weight * 1.5 +
      freshScore * 2.0 +
      story.credibility * 1.5 +
      story.velocity * 0.5 +
      story.sentiment.confidence * 0.5;
    if (story.entities.tokens.length > 0) story.score += 0.3;
    if (story.entities.protocols.length > 0) story.score += 0.2;
    if (story.entities.people.length > 0) story.score += 0.2;
  }

  // Bias diversity boost (Ground News-style balance): gently lift
  // stories from bias groups that are under-represented in the top slice
  // so the feed shows a balanced mix of left / center / right coverage.
  const topStories = [...stories].sort((a, b) => b.score - a.score).slice(0, 50);
  const biasCounts: Record<string, number> = { left: 0, center: 0, right: 0 };
  for (const s of topStories) {
    const label = s.bias ?? 'center';
    const bucket = label === 'left' || label === 'center-left' ? 'left' : label === 'right' || label === 'center-right' ? 'right' : 'center';
    biasCounts[bucket] = (biasCounts[bucket] ?? 0) + 1;
  }
  const maxBias = Math.max(1, ...Object.values(biasCounts));
  for (const story of stories) {
    const label = story.bias ?? 'center';
    const bucket = label === 'left' || label === 'center-left' ? 'left' : label === 'right' || label === 'center-right' ? 'right' : 'center';
    const share = biasCounts[bucket] ?? 0;
    // Under-represented buckets get up to a +1.8 score lift.
    const boost = (1 - share / maxBias) * 1.8;
    if (boost > 0) story.score += boost;
  }
}

/**
 * Filter, sort, aggregate sentiment/trending, attach display attribution,
 * and assemble the final AggregationResult. Shared by the full pipeline and
 * the timeout partial-result path.
 */
function finalizeNewsResult(
  stories: AggregatedStory[],
  clusters: StoryCluster[],
  opts: AggregationOptions,
  errors: string[],
  sourceCount: number,
  startTime: number,
): AggregationResult {
  const now = Date.now();
  const limit = opts.limit ?? 50;

  // Filter by category / search query, then sort.
  let filtered = stories;
  if (opts.category && opts.category !== 'all') {
    const cat = opts.category.toLowerCase();
    filtered = stories.filter(
      (s) => s.categories.includes(cat) || s.niches.includes(cat) || s.sourceMeta.category === cat,
    );
  }
  if (opts.query) {
    const q = opts.query.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.entities.tokens.some((t) => t.toLowerCase().includes(q)),
    );
  }
  const sort = opts.sort ?? 'score';
  if (sort === 'newest') filtered.sort((a, b) => b.publishedAt - a.publishedAt);
  else if (sort === 'trending') filtered.sort((a, b) => b.velocity - a.velocity);
  else filtered.sort((a, b) => b.score - a.score);

  // Source diversity: cap any single outlet at ~30% of the returned feed so
  // no one publication dominates the page (Ground News-style balance). The
  // cap is only enforced past the first story of each source, and only when
  // enough unique sources exist to fill the page.
  const maxPerSource = Math.max(1, Math.ceil(limit * 0.3));
  const sourceCounts = new Map<string, number>();
  const diversified: AggregatedStory[] = [];
  for (const story of filtered) {
    const source = story.source || 'unknown';
    const used = sourceCounts.get(source) ?? 0;
    if (used >= maxPerSource && sourceCounts.size >= 2) continue;
    sourceCounts.set(source, used + 1);
    diversified.push(story);
    if (diversified.length >= limit) break;
  }
  filtered = diversified;

  // Aggregate sentiment.
  const sentimentTotals = { bullish: 0, bearish: 0, neutral: 0 };
  for (const s of filtered) {
    if (s.sentiment.label === 'bullish') sentimentTotals.bullish++;
    else if (s.sentiment.label === 'bearish') sentimentTotals.bearish++;
    else sentimentTotals.neutral++;
  }

  // Trending topics.
  const trendingMap = new Map<string, { count: number; score: number }>();
  for (const s of filtered.slice(0, 100)) {
    for (const niche of s.niches) {
      const entry = trendingMap.get(niche) ?? { count: 0, score: 0 };
      entry.count++; entry.score += 1;
      trendingMap.set(niche, entry);
    }
    for (const token of s.entities.tokens) {
      const entry = trendingMap.get(token) ?? { count: 0, score: 0 };
      entry.count++; entry.score += 2;
      trendingMap.set(token, entry);
    }
  }
  const trending = Array.from(trendingMap.entries())
    .map(([topic, v]) => ({ topic, count: v.count, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const elapsed = Date.now() - startTime;
  log('info', `[news-aggregator] aggregated ${stories.length} stories from ${sourceCount} sources in ${elapsed}ms`);

  for (const story of filtered) {
    const displaySources = story.alsoCoveredBy.filter((s) => s !== story.source);
    (story as unknown as Record<string, unknown>).alsoCoveredByDisplay =
      displaySources.length > 0
        ? `Also reported by ${displaySources.slice(0, 3).join(', ')}${displaySources.length > 3 ? ` +${displaySources.length - 3} more` : ''}`
        : undefined;
    (story as unknown as Record<string, unknown>).alsoCoveredByCount = displaySources.length;
  }

  return {
    stories: filtered.slice(0, limit),
    clusters,
    meta: {
      total: filtered.length,
      sourceCount,
      sourcedCount: NEWS_SOURCES.length + NEWSLETTER_FEEDS.length,
      fetchedAt: now,
      errors,
      sentiment: sentimentTotals,
      trending,
      biasDistribution: computeBiasDistribution(filtered),
    },
  };
}

/**
 * Shared progress state between the pipeline and the timeout race. The
 * `stories` reference is live — the deadline callback reads whatever has
 * been accumulated so far.
 */
interface AggregationProgress {
  stories: AggregatedStory[];
  clusters: StoryCluster[];
  errors: string[];
  sourceCount: number;
  fetchedAt: number;
  stage: 'fetching' | 'deduping' | 'enriching' | 'scored' | 'clustered';
}

/**
 * Core aggregation pipeline. Updates `progress` at each stage boundary so a
 * timeout can resolve with partial results.
 */
async function runAggregationPipeline(
  env: Env,
  opts: AggregationOptions,
  progress: AggregationProgress,
  startTime: number,
): Promise<AggregationResult> {
  const errors: string[] = [];
  progress.errors = errors;
  const maxArticles = NEWS.MAX_ARTICLES;
  const enrichLimit = parsePositiveInt(env.NEWS_ENRICH_LIMIT, NEWS.ENRICH_LIMIT);

  const sources = opts.sourceIds
    ? NEWS_SOURCES.filter((s) => opts.sourceIds?.includes(s.id) ?? false)
    : NEWS_SOURCES;
  const newsletters = opts.includeNewsletters !== false ? NEWSLETTER_FEEDS : [];
  const allSources = [...sources, ...newsletters];
  progress.sourceCount = allSources.length;

  // 1. Fetch all RSS/Atom feeds in parallel (bounded concurrency + early bail)
  const rawItems: Array<{ item: ParsedRssItem; source: NewsSourceMeta }> = [];
  let rawCount = 0;

  await withConcurrencyLimit(allSources, NEWS.RSS_FETCH_CONCURRENCY, async (source) => {
    // Early bail: once we have enough raw articles, stop fetching sources.
    if (rawCount >= maxArticles) return;
    const xml = await fetchRssFeed(source.url, NEWS.RSS_FETCH_TIMEOUT_MS);
    if (!xml) return;
    if (xml.length > 2_000_000) return;
    const parsed = parseFeedXml(xml, 15);
    for (const item of parsed) {
      if (rawCount >= maxArticles) break;
      rawItems.push({ item, source });
    }
    rawCount = rawItems.length;
  });

  // 2. Fetch from protocol-based sources
  if (!opts.sourceIds) {
    try {
      const protocolItems = await fetchProtocolSources(env);
      for (const pi of protocolItems) {
        rawItems.push(pi);
      }
    } catch (err) {
      errors.push(`protocol sources: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  // 3. Convert to AggregatedStory with multi-layer dedup
  const seenUrls = new Map<string, AggregatedStory>();
  const seenHashes = new Map<string, AggregatedStory>();
  const stories: AggregatedStory[] = [];
  progress.stories = stories; // live reference — timeout sees partial dedup results
  progress.stage = 'deduping';

  for (const { item, source } of rawItems) {
    const canonicalUrl = normalizeUrl(item.link);
    const text = stripTags(item.content || item.description || item.title);
    const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
    const publishedAt = Number.isNaN(pubDate) ? Date.now() : pubDate;
    const categoriesStr = item.categories?.join(' ') ?? '';
    const niches = detectNiches(`${text} ${item.title} ${source.name} ${categoriesStr}`);
    const entities = extractEntities(`${text} ${item.title}`);
    const sentiment = analyzeSentiment(`${item.title} ${text}`);
    const bodyText = text || item.description || item.title || '';
    const readingTime = estimateReadingTime(bodyText);
    const hash = contentHash(text, 500);
    const bias: BiasLabel = sourceBias(source.name);

    const story: AggregatedStory = {
      id: `news:${canonicalUrl.slice(0, 128).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      title: item.title,
      summary: text.slice(0, 300),
      body: text,
      url: item.link,
      source: source.name,
      sourceMeta: source,
      protocol: source.type === 'reddit' ? 'reddit' : 'rss',
      allUrls: [canonicalUrl],
      alsoCoveredBy: [source.name],
      categories: [...new Set([source.category, ...(item.categories ?? []).map((c) => c.toLowerCase()), ...niches])],
      entities,
      sentiment,
      credibility: source.credibility,
      score: 0,
      publishedAt,
      fetchedAt: startTime,
      imageUrl: item.image || item.mediaThumbnail || undefined,
      author: item.creator || source.name,
      niches,
      velocity: 0,
      isBreaking: false,
      readingTime,
      heroImage: item.image || item.mediaThumbnail || undefined,
      metaDescription: item.description?.slice(0, 300),
      authorName: item.creator || undefined,
      // Ground News-style ratings — free informational metadata
      bias,
      biasScore: sourceBiasScore(source.name),
      factualRating: sourceFactuality(source.name),
    };

    // Dedup Layer 1: URL exact match
    const urlExisting = seenUrls.get(canonicalUrl);
    if (urlExisting) { mergeStory(urlExisting, story); continue; }

    // Dedup Layer 2: Content hash
    if (hash) {
      const hashExisting = seenHashes.get(hash);
      if (hashExisting) {
        mergeStory(hashExisting, story);
        seenUrls.set(canonicalUrl, hashExisting);
        continue;
      }
    }

    // Dedup Layer 3: Title similarity (>85%)
    let merged = false;
    for (const [, existingStory] of seenUrls) {
      if (titleSimilarity(item.title, existingStory.title) > 0.85) {
        mergeStory(existingStory, story);
        seenUrls.set(canonicalUrl, existingStory);
        if (hash) seenHashes.set(hash, existingStory);
        merged = true; break;
      }
    }
    if (merged) continue;

    // Dedup Layer 4: Jaccard text similarity (backup)
    for (const [, existingStory] of seenUrls) {
      if (jaccardSimilarity(item.title, existingStory.title) > 0.7) {
        mergeStory(existingStory, story);
        seenUrls.set(canonicalUrl, existingStory);
        if (hash) seenHashes.set(hash, existingStory);
        merged = true; break;
      }
    }
    if (merged) continue;

    stories.push(story);
    seenUrls.set(canonicalUrl, story);
    if (hash) seenHashes.set(hash, story);
  }

  // 4. Enrich articles with hero images, meta descriptions, and author names
  progress.stage = 'enriching';
  const enrichCandidates = stories
    .filter((s) => !s.heroImage || !s.metaDescription || s.authorName === s.source)
    .slice(0, enrichLimit);

  await withConcurrencyLimit(enrichCandidates, NEWS.ENRICH_CONCURRENCY, async (story) => {
    const enrichment = await enrichArticle(story.url, NEWS.ENRICH_TIMEOUT_MS);
    if (enrichment.heroImage && !story.heroImage) {
      story.heroImage = enrichment.heroImage;
      story.imageUrl = enrichment.heroImage;
    }
    if (enrichment.metaDescription && !story.metaDescription) {
      story.metaDescription = enrichment.metaDescription;
      if (story.summary === story.body?.slice(0, 300)) {
        story.summary = enrichment.metaDescription;
      }
    }
    if (enrichment.authorName) {
      story.authorName = enrichment.authorName;
      story.author = enrichment.authorName;
    }
  });

  // 5. Compute freshness, velocity, final scores, and bias diversity boost
  scoreAndBoost(stories);
  progress.stage = 'scored';

  // 6. Story clustering
  const clusters = clusterStories(stories);
  progress.clusters = clusters;
  progress.stage = 'clustered';

  // 7-11. Filter, search, sort, aggregate, and build the result
  return finalizeNewsResult(stories, clusters, opts, errors, allSources.length, startTime);
}

/**
 * Build the best AggregationResult we can from whatever the pipeline had
 * produced when the deadline fired. Stories that were still mid-dedup or
 * mid-enrich get scored on the spot so the partial result is usable.
 */
function buildPartialResult(
  progress: AggregationProgress,
  opts: AggregationOptions,
  startTime: number,
  timeoutMs: number,
): AggregationResult {
  const stories = progress.stories ?? [];
  const errors = [...progress.errors, `aggregation timed out after ${timeoutMs}ms`];

  if (progress.stage === 'fetching' || progress.stage === 'deduping' || progress.stage === 'enriching') {
    scoreAndBoost(stories);
  }

  const clusters =
    progress.clusters.length > 0 ? progress.clusters : stories.length > 0 ? clusterStories(stories) : [];

  log(
    'warn',
    `[news-aggregator] timeout after ${timeoutMs}ms — returning ${stories.length} partial stories`,
  );

  return finalizeNewsResult(
    stories,
    clusters,
    opts,
    errors,
    progress.sourceCount,
    startTime,
  );
}

/**
 * Main entry point: fetch news from all available sources, deduplicate,
 * enrich with entities/sentiment/credibility, cluster stories, and return
 * ranked results.
 *
 * The entire pipeline races a wall-clock deadline (default 25s, override via
 * NEWS_AGGREGATION_TIMEOUT_MS). If the deadline fires first, whatever partial
 * results exist so far are returned instead of erroring with a CPU-time
 * exceeded (Cloudflare 1102) crash.
 */
export async function aggregateNews(
  env: Env,
  opts: AggregationOptions = {},
): Promise<AggregationResult> {
  const startTime = Date.now();
  const timeoutMs = parsePositiveInt(env.NEWS_AGGREGATION_TIMEOUT_MS, NEWS.AGGREGATION_TIMEOUT_MS);

  const progress: AggregationProgress = {
    stories: [],
    clusters: [],
    errors: [],
    sourceCount: 0,
    fetchedAt: startTime,
    stage: 'fetching',
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<AggregationResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(buildPartialResult(progress, opts, startTime, timeoutMs));
    }, timeoutMs);
  });

  const pipeline = runAggregationPipeline(env, opts, progress, startTime);

  const result = await Promise.race([pipeline, deadline]);
  if (timeoutId) clearTimeout(timeoutId);

  // If the deadline won, the pipeline is still running in the background —
  // swallow any late rejection so it never surfaces as an unhandled rejection.
  void pipeline.catch(() => {});

  return result;
}

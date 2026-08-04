const RSS_CACHE_TTL = 300_000; // 5 minutes
/**
 * Minimum number of posts to fetch + cache on every RSS refresh, regardless
 * of the requested limit. Prevents the bridge prewarm (which calls providers
 * with a small per-provider limit) from caching only ~5 posts and then serving
 * an empty/starved /api/feed/rss to larger requests.
 */
const RSS_CACHE_MIN_POOL = 50;
let rssCache: {
  posts: UnifiedPost[];
  clusters: StoryClusterOutput[];
  blindspots: BlindspotItem[];
  fetchedAt: number;
} | null = null;
/** Single-flight lock: coalesce concurrent cold fetches into one refresh. */
const rssFetchInFlight: Promise<UnifiedPost[]> | null = null;

/**
 * Fetch from ALL RSS feeds (100+ sources) with lazy initialization + TTL cache.
 * Respects per-source limits to ensure diversity.
 */
export async function fetchRssPosts(limit = 50): Promise<UnifiedPost[]> {
  // Always fetch and cache a minimum pool of posts (50) so small requests
  // (e.g. the bridge prewarm calling with perProviderLimit=5) never poison
  // the 5-minute cache with only a handful of entries. A later request with
  // a larger limit then still gets a useful cache hit.
  const cacheLimit = Math.max(limit, RSS_CACHE_MIN_POOL);

  // Return cached data if still fresh
  if (rssCache && Date.now() - rssCache.fetchedAt < RSS_CACHE_TTL) {
    const cached = rssCache.posts.slice(0, limit);
    console.log(
      `[rss] Cache HIT: ${cached.length} posts (age: ${Math.round((Date.now() - rssCache.fetchedAt) / 1000)}s)`,
    );
    return cached;
  }

  // Rate limit: 60 requests/minute
  if (!checkRateLimit('rss', { maxRequests: 60, windowMs: 60_000 })) {
    // Return stale cache if available (better than nothing)
    if (rssCache) {
      const stale = rssCache.posts.slice(0, limit);
      console.log(`[rss] Rate limited, serving ${stale.length} stale cached posts`);
      return stale;
    }
    console.log('[rss] Rate limited, skipping fetch');
    return [];
  }

  // Single-flight: if a cold RSS refresh is already in progress (e.g. the
  // prewarm and a live request both miss the cache at once), join it instead
  // of starting a second full 248-feed fetch that would hammer sources and
  // race to overwrite the shared cache with a degraded result.
  if (rssFetchInFlight) {
    const posts = await rssFetchInFlight;
    return posts.slice(0, limit);
  }

  // Overall start time — used to bound the og:image enrichment so the RSS
  // provider stays inside the bridge's provider timeout (~5s).
  const fetchStartedAt = Date.now();
  const all: UnifiedPost[] = [];

  // Determine how many items to fetch per feed based on total feeds and
  // desired cache pool size.
  const activeFeeds = ALL_FEEDS;
  const perFeed = Math.max(1, Math.ceil((cacheLimit * 2) / activeFeeds.length));

  console.log(`[rss] Fetching ${activeFeeds.length} feeds, ${perFeed} items per feed`);

  // Fetch feeds in parallel with concurrency control. Stop fetching once we
  // have enough posts (early exit) — fetching all 148 feeds for a small limit
  // was the dominant cold-start cost (~7s).
  const BATCH_SIZE = 25;
  for (let i = 0; i < activeFeeds.length; i += BATCH_SIZE) {
    const batch = activeFeeds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((feed) => fetchFeed(feed, perFeed)));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      }
    }

    // Early exit once we have enough raw posts for the requested cache pool
    if (all.length >= cacheLimit) break;

    // Small delay between batches to avoid hammering servers
    if (i + BATCH_SIZE < activeFeeds.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Deduplicate — against the cache pool size, not the requested limit
  const deduped = deduplicatePosts(all, cacheLimit);

  // Rank by source reputation + freshness + cross-reference grounding
  const ranked = rankNewsPosts(deduped);

  // Ground News-beating features: story clusters (Full Coverage) + blindspots
  const clusters = clusterStories(ranked, 12);
  const blindspots = computeBlindspots(ranked, 10);

  // Backfill missing images from article OpenGraph tags (bounded time budget
  // that shrinks with feed-fetch time so the provider stays < ~4.5s total).
  const enrichBudgetMs = Math.max(400, 3200 - (Date.now() - fetchStartedAt));
  const enriched = await enrichPostImages(ranked, enrichBudgetMs);

  // Log stats
  const byCategory = new Map<string, number>();
  for (const feed of activeFeeds) {
    const count = all.filter((p) => {
      const raw = p.raw as { feedLabel?: string };
      return raw.feedLabel === feed.label;
    }).length;
    if (count > 0) {
      byCategory.set(feed.category, (byCategory.get(feed.category) || 0) + count);
    }
  }

  console.log(
    `[rss] Total: ${deduped.length} posts from ~${activeFeeds.length} feeds (${all.length} raw)`,
  );
  for (const [cat, count] of byCategory) {
    console.log(`[rss]   ${cat}: ${count} posts`);
  }

  // Anti-poisoning: never replace a healthy cache with a degraded fetch.
  // The bridge's feed builder kills provider fetches after FETCH_TIMEOUT_MS
  // (5s), but the killed promise keeps running in the background and would
  // otherwise overwrite rssCache with whatever it scraped before the kill —
  // often a handful of posts that then serve /api/feed/rss for the whole
  // 5-minute TTL. If we already have a larger, fresher cache, keep it and
  // serve from it instead of writing the degraded result.
  if (
    rssCache &&
    Date.now() - rssCache.fetchedAt < RSS_CACHE_TTL &&
    rssCache.posts.length > 0 &&
    deduped.length < Math.min(RSS_CACHE_MIN_POOL, rssCache.posts.length)
  ) {
    console.log(
      `[rss] Degraded fetch (${deduped.length} posts) — keeping existing cache (${rssCache.posts.length} posts, age ${Math.round((Date.now() - rssCache.fetchedAt) / 1000)}s)`,
    );
    return rssCache.posts.slice(0, limit);
  }

  // Update cache with deduplicated + ranked + image-enriched results
  rssCache = { posts: enriched, clusters, blindspots, fetchedAt: Date.now() };

  return enriched.slice(0, limit);
}

/**
 * Return the latest story clusters (computed on the last RSS fetch).
 * If the cache is cold, triggers a fetch. Returns [] on failure.
 */
export async function fetchStoryClusters(limit = 12): Promise<StoryClusterOutput[]> {
  try {
    await fetchRssPosts(Math.max(limit * 4, 60));
  } catch {
    // fall through — return whatever is cached
  }
  if (rssCache && rssCache.clusters) return rssCache.clusters.slice(0, limit);
  return [];
}

/**
 * Return the latest blindspot items (computed on the last RSS fetch).
 * If the cache is cold, triggers a fetch. Returns [] on failure.
 */
export async function fetchBlindspots(max = 10): Promise<BlindspotItem[]> {
  try {
    await fetchRssPosts(Math.max(max * 6, 60));
  } catch {
    // fall through — return whatever is cached
  }
  if (rssCache && rssCache.blindspots) return rssCache.blindspots.slice(0, max);
  return [];
}

/**
 * Fetch only newsletter-platform feeds (Substack, Medium, Mirror, Paragraph, Ghost, Beehiiv).
 */
export async function fetchNewsletterPosts(limit = 30): Promise<UnifiedPost[]> {
  const newsletters = getNewsletterFeeds();
  const all: UnifiedPost[] = [];
  const perFeed = Math.max(1, Math.ceil((limit * 2) / newsletters.length));

  const results = await Promise.allSettled(newsletters.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const deduped = deduplicatePosts(all, limit);
  console.log(`[rss] Newsletters: ${deduped.length} posts from ${newsletters.length} sources`);
  return deduped;
}

/**
 * Fetch by specific category.
 */
export async function fetchByCategory(category: FeedCategory, limit = 20): Promise<UnifiedPost[]> {
  const feeds = getFeedsByCategory(category);
  if (feeds.length === 0) return [];

  const all: UnifiedPost[] = [];
  const perFeed = Math.max(2, Math.ceil((limit * 1.5) / feeds.length));

  const results = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  return deduplicatePosts(all, limit);
}

/**
 * Fetch only featured/priority feeds.
 */
export async function fetchFeaturedPosts(limit = 30): Promise<UnifiedPost[]> {
  const featured = getFeaturedFeeds();
  const all: UnifiedPost[] = [];
  const perFeed = Math.max(2, Math.ceil((limit * 1.5) / featured.length));

  const results = await Promise.allSettled(featured.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  return deduplicatePosts(all, limit);
}

/**
 * Fetch only podcast feeds (crypto/web3 shows). Episodes carry an audio
 * enclosure embed and `contentType: 'podcast'` plus raw audioUrl/duration
 * metadata so clients can render inline players.
 */
export async function fetchPodcastPosts(limit = 30): Promise<UnifiedPost[]> {
  const podcasts = getPodcastFeeds();
  if (podcasts.length === 0) return [];

  const all: UnifiedPost[] = [];
  // Fetch a little more per feed than the target so dedup + ranking leaves
  // a healthy pool of recent episodes.
  const perFeed = Math.max(3, Math.ceil((limit * 1.5) / podcasts.length));

  const results = await Promise.allSettled(podcasts.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by episode link/guid, then rank by publish recency so the
  // most recent episodes surface first (like a podcast app inbox).
  const deduped = deduplicatePosts(all, Math.max(limit, 25));
  const ranked = [...deduped].sort((a, b) => b.createdAt - a.createdAt);
  return ranked.slice(0, limit);
}

// ─── Schema & Exports ────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'rss',
  name: 'RSS & Newsletter Aggregator',
  description: `Aggregates from ${FEED_COUNT}+ RSS feeds, newsletters, and podcasts across crypto, DeFi, AI, security, and tech`,
  endpoint: '/api/feed/news',
  requiresAuth: false,
  contentType: 'link',
};

/**
 * Main fetch function — fetches from ALL sources and returns deduplicated posts.
 * Used by the bridge to populate the news feed.
 */
export async function fetch(limit = 50): Promise<UnifiedPost[]> {
  return fetchRssPosts(limit);
}

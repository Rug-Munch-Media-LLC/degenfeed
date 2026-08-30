'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NewsMeta, NewsStory, StoryCluster } from '../../components/news';
import {
  getReadingList,
  NewsCategoryTabs,
  NewsFilters,
  NewsHeroCard,
  NewsMarketSidebar,
  NewsRightSidebar,
  NewsStoryCard,
  NewsTrendingBar,
  SentimentBar,
  ShareModal,
  StorySkeleton,
  toggleReadingList,
} from '../../components/news';

/**
 * Bias-aware story shape. The worker attaches `biasScore` (the numeric
 * SOURCE_BIAS_SCORE value, -1.0..+1.0) to every story; the shared
 * NewsStory type in components/news predates it, so read it via a local
 * intersection so the news page can surface the Ground News-style rating
 * without touching the shared component library.
 */
type BiasAwareStory = NewsStory & { biasScore?: number };

type BiasDistribution = { left: number; center: number; right: number };

interface BiasSummary {
  left: number;
  center: number;
  right: number;
  total: number;
  avgScore: number | null;
  hasRated: boolean;
}

/** Map a 5-point bias label to the 3-bucket distribution. */
function biasBucket(bias: string | undefined): 'left' | 'center' | 'right' {
  if (bias === 'left' || bias === 'center-left') return 'left';
  if (bias === 'right' || bias === 'center-right') return 'right';
  return 'center';
}

function summarizeBias(
  stories: NewsStory[],
  metaDistribution: BiasDistribution | undefined,
): BiasSummary {
  const counts = { left: 0, center: 0, right: 0 };
  let scored = 0;
  let scoreSum = 0;
  for (const s of stories) {
    counts[biasBucket(s.bias)] += 1;
    const score = (s as BiasAwareStory).biasScore;
    if (typeof score === 'number' && Number.isFinite(score)) {
      scored += 1;
      scoreSum += score;
    }
  }
  const localTotal = counts.left + counts.center + counts.right;
  const hasRated = stories.some((s) => s.bias) || scored > 0;
  const distTotal = metaDistribution
    ? metaDistribution.left + metaDistribution.center + metaDistribution.right
    : 0;

  if (metaDistribution && distTotal > 0) {
    return {
      left: metaDistribution.left,
      center: metaDistribution.center,
      right: metaDistribution.right,
      total: distTotal,
      avgScore: scored > 0 ? scoreSum / scored : null,
      hasRated,
    };
  }
  return {
    left: counts.left,
    center: counts.center,
    right: counts.right,
    total: localTotal,
    avgScore: scored > 0 ? scoreSum / scored : null,
    hasRated,
  };
}

function biasLeanLabel(avg: number | null): { label: string; color: string } {
  if (avg == null) return { label: 'Unrated', color: '#6b7280' };
  if (avg <= -0.25) return { label: 'Left-leaning', color: '#dc2626' };
  if (avg >= 0.25) return { label: 'Right-leaning', color: '#2563eb' };
  return { label: 'Center-leaning', color: '#6b7280' };
}

function formatBiasScore(avg: number | null): string {
  if (avg == null) return '—';
  const v = avg.toFixed(2);
  return avg > 0 ? `+${v}` : v;
}

interface NewsClientProps {
  initialStories?: NewsStory[];
  initialMeta?: NewsMeta | null;
  initialClusters?: StoryCluster[];
}

export default function NewsClient({
  initialStories = [],
  initialMeta = null,
  initialClusters = [],
}: NewsClientProps) {
  const [stories, setStories] = useState<NewsStory[]>(initialStories);
  const [clusters, setClusters] = useState<StoryCluster[]>(initialClusters);
  const [meta, setMeta] = useState<NewsMeta | null>(initialMeta);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loaded');
  const [error, setError] = useState<string>();
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<string>('score');
  const [searchInput, setSearchInput] = useState('');
  const [newAvailable, setNewAvailable] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [masonryLayout, setMasonryLayout] = useState(false);
  const [readingList, setReadingList] = useState<Set<string>>(getReadingList);
  const [shareStory, setShareStory] = useState<NewsStory | null>(null);
  const [_page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [marketPrices, setMarketPrices] = useState<
    Record<string, { price: string; change24h: number }>
  >({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchNews = useCallback(
    async (showIndicator = false, pageNum = 1) => {
      if (pageNum === 1 && !showIndicator) setState('loading');
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');
        params.set('sort', sort);
        params.set('page', String(pageNum));
        if (category) params.set('category', category);
        if (query) params.set('q', query);
        const res = await fetch(`/api/news/feed?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        const data = (await res.json()) as {
          data?: NewsStory[];
          clusters?: StoryCluster[];
          meta?: NewsMeta;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load news');
        if (showIndicator && data.data && data.data.length > 0) {
          setNewAvailable(true);
          return;
        }
        if (pageNum === 1) {
          setStories(data.data || []);
          setClusters(data.clusters || []);
        } else {
          setStories((prev) => {
            const e = new Set(prev.map((s) => s.id));
            return [...prev, ...(data.data || []).filter((s) => !e.has(s.id))];
          });
        }
        setMeta(data.meta || null);
        setHasMore((data.data?.length ?? 0) >= 50);
        setState('loaded');
        setLoadingMore(false);
      } catch (err) {
        if (!showIndicator) {
          setError(err instanceof Error ? err.message : 'Failed to load news');
          setState('error');
        }
        setLoadingMore(false);
      }
    },
    [category, query, sort],
  );

  const fetchMarketPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const res = await fetch('/api/market/prices?tokens=BTC,ETH,SOL', { cache: 'no-store' });
      if (res.ok)
        setMarketPrices((await res.json()) as Record<string, { price: string; change24h: number }>);
    } catch {
    } finally {
      setPricesLoading(false);
    }
  }, []);

  const refreshNow = useCallback(() => {
    setNewAvailable(false);
    setPage(1);
    fetchNews(false, 1);
  }, [fetchNews]);
  useEffect(() => {
    setPage(1);
    fetchNews(false, 1);
    fetchMarketPrices();
  }, [fetchNews, fetchMarketPrices]);
  useEffect(() => {
    const id = setInterval(() => fetchNews(true), 60000);
    return () => clearInterval(id);
  }, [fetchNews]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && state === 'loaded') {
          setLoadingMore(true);
          setPage((p) => {
            const np = p + 1;
            fetchNews(false, np);
            return np;
          });
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, state, fetchNews]);

  const handleBookmark = useCallback(
    (id: string) => setReadingList(new Set(toggleReadingList(id))),
    [],
  );
  const handleShare = useCallback((s: NewsStory) => setShareStory(s), []);
  const featured = stories.find((s) => s.isBreaking) || stories[0];
  const rest = stories.filter((s) => s.id !== featured?.id) || [];

  // ── Source bias summary (Ground News-style, powered by SOURCE_BIAS_SCORE) ──
  const bias = useMemo<BiasSummary>(() => {
    const metaDist = (meta as (NewsMeta & { biasDistribution?: BiasDistribution }) | null)
      ?.biasDistribution;
    return summarizeBias(stories, metaDist);
  }, [stories, meta]);
  const lean = biasLeanLabel(bias.avgScore);
  const pct = (n: number) => (bias.total > 0 ? Math.round((n / bias.total) * 100) : 0);
  const showBiasMeter = bias.hasRated && bias.total > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">DegenFeed News</h1>
              <span className="rounded-full bg-degen-500/10 px-2.5 py-0.5 text-xs font-medium text-degen-400 ring-1 ring-degen-500/20">
                LIVE
              </span>
              {meta?.personalized && (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
                  Personalized
                </span>
              )}
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400 ring-1 ring-purple-500/20">
                {meta?.sourceCount || 100}+ Sources
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Intelligent news from {meta?.sourceCount || '100+'} sources
              {meta?.personalized ? ' — ranked for your interests' : ''}
            </p>
          </div>
        </div>
        <SentimentBar sentiment={meta?.sentiment} />
        {/* Ground News-style source bias meter — distribution + average score
            computed from the worker's SOURCE_BIAS_SCORE / biasDistribution. */}
        {showBiasMeter && (
          <div className="mb-4 rounded-xl border border-gray-800/80 bg-gradient-to-b from-gray-900/90 to-gray-950/90 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Source Bias
                </h2>
                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-medium text-purple-400 ring-1 ring-purple-500/20">
                  Better than Ground News
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-gray-800/80 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-gray-300">
                  Avg {formatBiasScore(bias.avgScore)}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-white/10"
                  style={{ color: lean.color, backgroundColor: `${lean.color}15` }}
                >
                  {lean.label}
                </span>
              </div>
            </div>

            {/* Three-segment bias bar */}
            <div
              className="flex h-2 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={`Source bias: ${pct(bias.left)}% left, ${pct(bias.center)}% center, ${pct(bias.right)}% right`}
            >
              <div
                className="h-full"
                style={{ width: `${pct(bias.left)}%`, backgroundColor: '#dc2626' }}
              />
              <div
                className="h-full"
                style={{ width: `${pct(bias.center)}%`, backgroundColor: '#4b5563' }}
              />
              <div
                className="h-full"
                style={{ width: `${pct(bias.right)}%`, backgroundColor: '#2563eb' }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] font-medium">
              <span className="text-red-400">Left {pct(bias.left)}%</span>
              <span className="text-gray-500">Center {pct(bias.center)}%</span>
              <span className="text-blue-400">Right {pct(bias.right)}%</span>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
              {bias.total} rated source{bias.total === 1 ? '' : 's'} · numeric bias score −1.0
              (left) to +1.0 (right), 0 = neutral — weighted from each outlet&apos;s editorial
              coverage.
            </p>
          </div>
        )}
        <NewsTrendingBar stories={stories} />
        {newAvailable && (
          <button
            type="button"
            onClick={refreshNow}
            className="mb-4 w-full animate-pulse rounded-xl border border-degen-500/20 bg-degen-500/10 py-2.5 text-sm font-medium text-degen-400 hover:bg-degen-500/20"
          >
            New stories — refresh
          </button>
        )}
        <NewsFilters
          sort={sort}
          setSort={setSort}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          query={query}
          setQuery={setQuery}
          masonryLayout={masonryLayout}
          setMasonryLayout={setMasonryLayout}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          showSidebar={showSidebar}
        />
        <NewsCategoryTabs activeCategory={category} onCategoryChange={setCategory} />
      </div>
      <div className="flex gap-6">
        {showSidebar && (
          <div className="hidden w-64 shrink-0 lg:block">
            <NewsMarketSidebar marketPrices={marketPrices} pricesLoading={pricesLoading} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {state === 'loading' && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <StorySkeleton key={i} masonry={masonryLayout} />
              ))}
            </div>
          )}
          {state === 'error' && (
            <div className="rounded-xl border border-red-900/30 bg-red-950/20 py-16 text-center">
              <p className="text-red-300">{error || 'Failed to load news'}</p>
            </div>
          )}
          {state === 'loaded' && stories.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 py-16 text-center">
              <p className="text-gray-400">No stories found.</p>
            </div>
          )}
          {state === 'loaded' && stories.length > 0 && (
            <>
              {featured && (
                <div className="mb-6">
                  <NewsHeroCard
                    story={featured}
                    isBookmarked={readingList.has(featured.id)}
                    onBookmark={() => handleBookmark(featured.id)}
                    onShare={() => handleShare(featured)}
                  />
                </div>
              )}
              {masonryLayout ? (
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                  {rest.map((s) => (
                    <NewsStoryCard
                      key={s.id}
                      story={s}
                      masonry
                      onBookmark={() => handleBookmark(s.id)}
                      isBookmarked={readingList.has(s.id)}
                      onShare={() => handleShare(s)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((s) => (
                    <NewsStoryCard
                      key={s.id}
                      story={s}
                      onBookmark={() => handleBookmark(s.id)}
                      isBookmarked={readingList.has(s.id)}
                      onShare={() => handleShare(s)}
                    />
                  ))}
                </div>
              )}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="py-4 text-center text-xs text-gray-500">Loading more...</div>
              )}
            </>
          )}
        </div>
        {showSidebar && (
          <div className="hidden w-72 shrink-0 xl:block">
            <NewsRightSidebar
              stories={stories}
              meta={meta}
              clusters={clusters}
              onQueryChange={setQuery}
            />
          </div>
        )}
      </div>
      {shareStory && <ShareModal story={shareStory} onClose={() => setShareStory(null)} />}
    </div>
  );
}

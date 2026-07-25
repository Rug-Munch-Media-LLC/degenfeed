'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [page, setPage] = useState(1);
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
  }, [category, sort, query, fetchNews, fetchMarketPrices]);
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

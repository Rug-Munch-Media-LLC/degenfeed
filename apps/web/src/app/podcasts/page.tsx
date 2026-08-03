'use client';

/**
 * @degenfeed/web — /podcasts (Podcast Hub)
 *
 * Combined podcast hub featuring:
 *   - Curated Top 100 podcasts (crypto, tech, AI)
 *   - DegenFeed creator podcasts
 *   - Tabbed interface: Curated | Our Creators | All
 *   - Podcast cards with "Curated" or "Creator" badge
 *   - Category filter at top
 *   - Trending episodes section
 *   - Search across all podcasts
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────

interface Podcast {
  id: string;
  title: string;
  description: string;
  category: string;
  coverUrl?: string;
  hostName: string;
  hostAddress?: string;
  hostAvatarUrl?: string;
  episodeCount: number;
  totalPlays: number;
  subscriberCount: number;
  activityPubId?: string;
  feedUrl?: string;
  /** 'curated' or 'creator' — distinguishes source */
  source?: 'curated' | 'creator';
  /** Curated-only fields */
  host?: string;
  rssUrl?: string;
  website?: string;
  language?: string;
}


interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  coverUrl?: string;
  publishedAt?: number;
  plays: number;
  podcastTitle?: string;
  category?: string;
  podcast?: Podcast;
}

// ─── Constants ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🎧' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'tech', label: 'Tech', icon: '⚙' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'defi', label: 'DeFi', icon: '🏦' },
  { id: 'nfts', label: 'NFTs', icon: '🖼' },
  { id: 'culture', label: 'Culture', icon: '🎭' },
  { id: 'news', label: 'News', icon: '📰' },
  { id: 'trading', label: 'Trading', icon: '📊' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'interviews', label: 'Interviews', icon: '🎙' },
];

const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#F7931A',
  tech: '#00FF41',
  ai: '#8B5CF6',
  defi: '#627EEA',
  nfts: '#FF6B35',
  culture: '#E1306C',
  news: '#1DA1F2',
  trading: '#00C853',
  gaming: '#9146FF',
  science: '#00BCD4',
  interviews: '#FF5722',
};

const TABS = [
  { id: 'all', label: 'All', icon: '🎧' },
  { id: 'curated', label: 'Curated', icon: '⭐' },
  { id: 'creators', label: 'Our Creators', icon: '🎙' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatPlays(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Podcast Card Component ────────────────────────────────────────────

function PodcastCard({ podcast }: { podcast: Podcast }) {
  const displayName = podcast.hostName || podcast.host || 'Host';
  const isCurated = podcast.source === 'curated';
  const coverUrl = podcast.coverUrl || '/podcast-cover-placeholder.svg';

  return (
    <Link
      href={isCurated ? `/podcasts/curated/${podcast.id}` : `/podcasts/${podcast.id}`}
      className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition-all hover:border-[var(--color-accent)] hover:shadow-lg"
    >
      {/* Cover Art */}
      <div
        className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
      >
        {/* Category Badge */}
        <span
          className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: CATEGORY_COLORS[podcast.category] || '#888' }}
        >
          {podcast.category}
        </span>
        {/* Source Badge */}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isCurated ? 'bg-purple-500/90 text-white' : 'bg-[var(--color-accent)]/90 text-black'
          }`}
        >
          {isCurated ? 'Curated' : 'Creator'}
        </span>
        {/* Play overlay */}
        <div className="flex h-full items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-2xl text-black shadow-lg">
            ▶
          </div>
        </div>
      </div>

      {/* Info */}
      <h3 className="truncate text-base font-semibold">{podcast.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
        {podcast.description}
      </p>

      {/* Meta */}
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-2">
          {podcast.hostAvatarUrl ? (
            <img src={podcast.hostAvatarUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[10px]">
              🎙
            </span>
          )}
          <span className="truncate max-w-[100px]">{displayName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{podcast.episodeCount} ep.</span>
          {podcast.totalPlays > 0 && (
            <>
              <span>•</span>
              <span>🎧 {formatPlays(podcast.totalPlays)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Episode Card Component ────────────────────────────────────────────

function EpisodeCard({ episode }: { episode: PodcastEpisode }) {
  return (
    <Link
      href={`/podcasts/${episode.podcastId}`}
      className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-all hover:border-[var(--color-accent)] hover:shadow-lg"
    >
      <div
        className="aspect-[16/9] w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${episode.coverUrl || '/podcast-default-bg.svg'})` }}
      >
        <div className="flex h-full items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)] text-xl text-black">
            ▶
          </div>
        </div>
        {episode.podcastTitle && (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {episode.podcastTitle}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{episode.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <span>🎧 {formatPlays(episode.plays)}</span>
          <span>•</span>
          <span>{formatDuration(episode.duration)}</span>
          {episode.publishedAt && (
            <>
              <span>•</span>
              <span>{timeAgo(episode.publishedAt)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function PodcastHubPage() {
  const [curatedPodcasts, setCuratedPodcasts] = useState<Podcast[]>([]);
  const [creatorPodcasts, setCreatorPodcasts] = useState<Podcast[]>([]);
  const [trending, setTrending] = useState<PodcastEpisode[]>([]);
  const [curatedLatest, setCuratedLatest] = useState<PodcastEpisode[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [curatedStats, setCuratedStats] = useState<Record<string, number> | null>(null);

  // ─── Fetch curated podcasts ──────────────────────────────────────

  const fetchCurated = useCallback(async (category: string) => {
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      params.set('limit', '100');

      const res = await fetch(`/api/podcast/curated?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { podcasts: Podcast[]; total: number };
        return data.podcasts || [];
      }
    } catch {
      /* non-critical */
    }
    return [];
  }, []);

  // ─── Fetch creator podcasts ─────────────────────────────────────

  const fetchCreators = useCallback(async (category: string, search: string) => {
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');

      const res = await fetch(`/api/podcast/discover?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { podcasts: Podcast[]; total: number };
        return (data.podcasts || []).map((p) => ({ ...p, source: 'creator' as const }));
      }
    } catch {
      /* non-critical */
    }
    return [];
  }, []);

  // ─── Fetch curated stats ────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/podcast/curated/stats', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { stats: Record<string, number> };
        setCuratedStats(data.stats);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  // ─── Fetch trending episodes ────────────────────────────────────

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/podcast/curated/trending?limit=10', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { episodes: PodcastEpisode[] };
        setTrending(data.episodes || []);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  // ─── Fetch curated latest ──────────────────────────────────────

  const fetchCuratedLatest = useCallback(async (category: string) => {
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      params.set('limit', '20');

      const res = await fetch(`/api/podcast/curated/latest?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { episodes: PodcastEpisode[]; total: number };
        setCuratedLatest(data.episodes || []);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  // ─── Search (combined) ──────────────────────────────────────────

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/podcast/search?q=${encodeURIComponent(q.trim())}&limit=20`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          curatedPodcasts: Podcast[];
          creatorPodcasts: Podcast[];
          curatedEpisodes: PodcastEpisode[];
        };
        setCuratedPodcasts(
          (data.curatedPodcasts || []).map((p) => ({ ...p, source: 'curated' as const })),
        );
        setCreatorPodcasts(
          (data.creatorPodcasts || []).map((p) => ({ ...p, source: 'creator' as const })),
        );
      }
    } catch {
      /* non-critical */
    }
    setLoading(false);
  }, []);

  // ─── Initial load ────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);

    if (searchQuery.trim()) {
      handleSearch(searchQuery);
      return;
    }

    Promise.all([
      fetchCurated(activeCategory),
      fetchCreators(activeCategory, ''),
      fetchStats(),
      fetchTrending(),
      fetchCuratedLatest(activeCategory),
    ])
      .then(([curated, creators]) => {
        setCuratedPodcasts(curated.map((p) => ({ ...p, source: 'curated' as const })));
        setCreatorPodcasts(creators);
      })
      .catch(() => setError('Failed to load podcasts'))
      .finally(() => setLoading(false));
  }, [
    activeCategory,
    fetchCurated,
    fetchCreators,
    fetchStats,
    fetchTrending,
    fetchCuratedLatest,
    handleSearch,
    searchQuery,
  ]);

  // ─── Filter by tab + category + search ─────────────────────────

  const displayedPodcasts = useMemo(() => {
    let combined: Podcast[] = [];

    if (activeTab === 'curated') {
      combined = curatedPodcasts;
    } else if (activeTab === 'creators') {
      combined = creatorPodcasts;
    } else {
      // "All" — interleave curated + creator, curated first
      combined = [...curatedPodcasts, ...creatorPodcasts];
    }

    // Client-side search filter if already loaded
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      combined = combined.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.hostName || p.host || '').toLowerCase().includes(q),
      );
    }

    return combined;
  }, [activeTab, curatedPodcasts, creatorPodcasts, searchQuery]);

  // ─── Episodes to show ──────────────────────────────────────────

  const episodesToShow = searchQuery.trim()
    ? curatedLatest
    : trending.length > 0
      ? trending
      : curatedLatest;

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎙</span>
            <div>
              <h1 className="text-2xl font-bold">Podcasts</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {curatedStats
                  ? `${curatedStats.total} curated + creator podcasts`
                  : 'Discover & distribute podcasts'}
              </p>
            </div>
          </div>
          <Link
            href="/creator/podcast"
            className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110"
          >
            + Create Podcast
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* ─── Stats Bar ───────────────────────────────────────── */}
        {curatedStats && !searchQuery && (
          <div className="mb-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              ⭐ {curatedStats.total} Curated
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              ₿ {curatedStats.crypto} Crypto
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              ⚙ {curatedStats.tech} Tech
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              🤖 {curatedStats.ai} AI
            </span>
          </div>
        )}

        {/* ─── Search Bar ───────────────────────────────────────── */}
        <div className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search podcasts by title, host, or topic…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 pl-12 text-sm outline-none transition-all placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)]"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[var(--color-text-tertiary)]">
            🔍
          </span>
        </div>

        {/* ─── Tab Bar ────────────────────────────────────────── */}
        <div className="mb-4 flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--color-accent)] text-black shadow-lg'
                  : 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Category Filters ────────────────────────────────── */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-[var(--color-accent)] text-black shadow-lg'
                  : 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Episode strip (trending / latest) ──────────────── */}
        {episodesToShow.length > 0 && !searchQuery && activeTab !== 'creators' && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-bold">
              {trending.length > 0 ? '🔥 Trending Episodes' : '📡 Latest Episodes'}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {episodesToShow.slice(0, 5).map((ep) => (
                <EpisodeCard key={ep.id} episode={ep} />
              ))}
            </div>
          </section>
        )}

        {/* ─── Podcast Grid ────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-2xl bg-[var(--color-bg-secondary)]" />
                <div className="mt-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <span className="text-4xl">⚠️</span>
            <p className="text-[var(--color-text-secondary)]">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black"
            >
              Retry
            </button>
          </div>
        ) : displayedPodcasts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <span className="text-5xl">🎧</span>
            <p className="text-lg font-semibold">No podcasts found</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {searchQuery
                ? 'Try a different search term'
                : activeTab === 'curated'
                  ? 'No curated podcasts in this category'
                  : activeTab === 'creators'
                    ? 'No creator podcasts yet'
                    : 'Be the first to create a podcast'}
            </p>
            {activeTab !== 'curated' && (
              <Link
                href="/creator/podcast"
                className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black"
              >
                Create Your Podcast
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {activeTab === 'curated'
                  ? '⭐ Curated Podcasts'
                  : activeTab === 'creators'
                    ? '🎙 Creator Podcasts'
                    : '🎧 All Podcasts'}
                {activeCategory !== 'all' && (
                  <span className="ml-2 text-sm font-normal text-[var(--color-text-tertiary)]">
                    — {CATEGORIES.find((c) => c.id === activeCategory)?.label || activeCategory}
                  </span>
                )}
                <span className="ml-2 text-sm font-normal text-[var(--color-text-tertiary)]">
                  ({displayedPodcasts.length})
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedPodcasts.map((podcast) => (
                <PodcastCard
                  key={`${podcast.source || 'creator'}-${podcast.id}`}
                  podcast={podcast}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

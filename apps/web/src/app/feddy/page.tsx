'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CommunityCard } from '../../components/feddy/CommunityCard';
import { CategoryBrowser } from '../../components/feddy/CategoryBrowser';
import { FeddyHeader } from '../../components/feddy/FeddyHeader';
import type { FeddyCategory } from '../../components/feddy/types';

// ─── Types ─────────────────────────────────────────────────────────────

interface DirectoryEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: FeddyCategory;
  tags: string[];
  memberCount: number;
  postCount: number;
  createdAt: number;
  avatarUrl: string;
  federationStatus: 'active' | 'limited' | 'suspended';
  linkedCoin: string | null;
  trendingScore: number;
}

interface DirectoryResult {
  entries: DirectoryEntry[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function DirectorySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[var(--color-muted)]/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-[var(--color-muted)]/20" />
              <div className="h-3 w-16 rounded bg-[var(--color-muted)]/10" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-[var(--color-muted)]/10" />
            <div className="h-3 w-3/4 rounded bg-[var(--color-muted)]/10" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-16 rounded-full bg-[var(--color-muted)]/10" />
            <div className="h-5 w-20 rounded-full bg-[var(--color-muted)]/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────

function EmptyDirectory({ category, search }: { category?: string; search?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 text-5xl">🏘️</span>
      <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">No communities yet</h3>
      <p className="mb-6 max-w-md text-sm text-[var(--color-muted)]">
        {search
          ? `No results for "${search}" in ${category || 'all categories'}. Try a different search or category.`
          : category
            ? `No communities in "${category}" yet. Be the first to create one.`
            : 'No communities in the directory yet. Premium users can create the first one!'}
      </p>
      <Link
        href="/feddy/create"
        className="rounded-xl bg-degen-500 px-6 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]"
      >
        Create Community
      </Link>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────

export default function FeddyDirectoryPage() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<FeddyCategory | undefined>();
  const [sort, setSort] = useState<'members' | 'newest' | 'trending' | 'posts'>('members');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchDirectory = useCallback(
    async (opts: { cursor?: string; append?: boolean; reset?: boolean } = {}) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        params.set('sort', sort);
        if (opts.cursor) params.set('cursor', opts.cursor);
        else if (search) params.set('search', search);
        params.set('limit', '48');

        const res = await fetch(`/api/feddy/directory?${params.toString()}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);

        const data = (await res.json()) as DirectoryResult;

        if (opts.reset || !opts.append) {
          setEntries(data.entries);
        } else {
          setEntries((prev) => [...prev, ...data.entries]);
        }
        setTotal(data.total);
        setCursor(data.cursor);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load communities');
      } finally {
        setLoading(false);
      }
    },
    [category, sort, search],
  );

  // Initial load and reload on filter changes
  useEffect(() => {
    fetchDirectory({ reset: true });
  }, [category, sort, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchDirectory({ cursor: cursor ?? undefined, append: true });
  }, [hasMore, loading, cursor, fetchDirectory]);

  // Search submission
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearch(searchInput.trim());
    },
    [searchInput],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 animate-page-enter">
      {/* Header */}
      <FeddyHeader
        totalCommunities={total}
        onCreateLink="/feddy/create"
      />

      {/* Search bar */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search communities by name, description, or tags..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-all focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400"
          >
            Search
          </button>
        </form>
      </div>

      {/* Category browser */}
      <div className="mb-6">
        <CategoryBrowser
          selected={category}
          onSelect={(cat) => {
            setCategory(cat);
            setCursor(null);
          }}
        />
      </div>

      {/* Sort tabs */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {(['members', 'newest', 'trending', 'posts'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSort(s);
                setCursor(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                sort === s
                  ? 'bg-degen-500/15 text-degen-400'
                  : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {s === 'members' ? 'Most Members' : s === 'newest' ? 'Newest' : s === 'trending' ? 'Trending' : 'Most Posts'}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-muted)]">
          {total} {total === 1 ? 'community' : 'communities'}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">Failed to load communities: {error}</p>
          <button
            type="button"
            onClick={() => fetchDirectory({ reset: true })}
            className="mt-2 text-xs font-medium text-red-400 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && entries.length === 0 && <DirectorySkeleton />}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <EmptyDirectory category={category} search={search} />
      )}

      {/* Community grid */}
      {entries.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entries.map((entry) => (
              <CommunityCard key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-8 py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

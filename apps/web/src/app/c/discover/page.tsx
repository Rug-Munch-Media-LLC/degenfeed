'use client';

/**
 * Browse Communities — Discover communities across the Lemmy fediverse.
 *
 * Fetches from /api/communities/discover with category, search, and sort filters.
 * Shows federated community cards with instance badges and subscriber counts.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface FederatedCommunity {
  id: string;
  name: string;
  instance: string;
  title: string;
  description: string;
  subscribers: number;
  usersActiveMonth: number;
  posts: number;
  niche: string;
  qualityTier: 'low' | 'medium' | 'high' | 'vibrant';
  lastActive: number;
  isLocal: boolean;
}

interface DiscoverMeta {
  total: number;
  category: string | null;
  sort: string;
  minSubs: number;
  categoryCounts: Record<string, number>;
  fetchedAt: number;
}

// ─── Category definitions ───────────────────────────────────────────────────

const CATEGORIES = [
  { id: '', label: 'All', emoji: '🌐' },
  { id: 'crypto', label: 'Crypto', emoji: '₿' },
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'nft', label: 'NFT', emoji: '🖼' },
  { id: 'trading', label: 'Trading', emoji: '📊' },
  { id: 'tech', label: 'Tech', emoji: '⚙' },
  { id: 'security', label: 'Security', emoji: '🔒' },
  { id: 'privacy', label: 'Privacy', emoji: '👁' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'opensource', label: 'OSS', emoji: '📖' },
  { id: 'memes', label: 'Memes', emoji: '🎭' },
  { id: 'news', label: 'News', emoji: '📰' },
  { id: 'governance', label: 'Governance', emoji: '🗳' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'philosophy', label: 'Philosophy', emoji: '🤔' },
] as const;

const SORT_OPTIONS = [
  { id: 'subscribers', label: 'Popular' },
  { id: 'active', label: 'Most Active' },
  { id: 'posts', label: 'Most Posts' },
  { id: 'new', label: 'Newest' },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function qualityColor(tier: string): string {
  switch (tier) {
    case 'vibrant':
      return '#22c55e';
    case 'high':
      return '#3b82f6';
    case 'medium':
      return '#eab308';
    default:
      return '#6b7280';
  }
}

function qualityLabel(tier: string): string {
  switch (tier) {
    case 'vibrant':
      return '🔥 Vibrant';
    case 'high':
      return '● Active';
    case 'medium':
      return '○ Growing';
    default:
      return '○ Quiet';
  }
}

// ─── Community Card ─────────────────────────────────────────────────────────

function CommunityCard({ community }: { community: FederatedCommunity }) {
  const qColor = qualityColor(community.qualityTier);
  const isLocal = community.isLocal;
  const _instanceShort = community.instance.replace(/\.(xyz|com|org|ml|ee|dev)$/, '');

  return (
    <Link
      href={`https://${community.instance}/c/${community.name}`}
      target="_blank"
      className="card group flex flex-col transition-all hover:border-degen-500/30 hover:shadow-[0_0_20px_rgba(0,255,65,0.05)]"
    >
      {/* Top section */}
      <div className="flex items-start gap-3 p-4 pb-2">
        {/* Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/10 text-lg font-bold text-[var(--color-fg)]">
          {community.title.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--color-fg)]">
              c/{community.name}
            </h3>
            {/* Federation badge */}
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                isLocal ? 'bg-degen-500/15 text-degen-400' : 'bg-blue-500/15 text-blue-400'
              }`}
            >
              {isLocal ? '🏠 Local' : '🌐 Federated'}
            </span>
          </div>

          {/* Instance name */}
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
            on <span className="font-mono">{community.instance}</span>
          </p>

          {/* Niche badge */}
          <span className="mt-1.5 inline-block rounded-full bg-[var(--color-overlay)] px-1.5 py-0.5 text-[9px] text-[var(--color-muted)]">
            {community.niche}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-auto flex items-center gap-4 border-t border-white/[0.04] px-4 py-2.5 text-[11px] text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-[var(--color-fg)]">
            {formatCount(community.subscribers)}
          </span>
          subs
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-[var(--color-fg)]">
            {formatCount(community.usersActiveMonth)}
          </span>
          /mo
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-[var(--color-fg)]">
            {formatCount(community.posts)}
          </span>
          posts
        </span>
        <span className="ml-auto flex items-center gap-1" style={{ color: qColor }}>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: qColor }}
          />
          {qualityLabel(community.qualityTier)}
        </span>
      </div>
    </Link>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="flex items-start gap-3 p-4 pb-2">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--color-overlay)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-[var(--color-overlay)]" />
              <div className="h-3 w-32 rounded bg-[var(--color-overlay)]" />
            </div>
          </div>
          <div className="mt-2 flex gap-4 border-t border-white/[0.04] px-4 py-2.5">
            <div className="h-3 w-16 rounded bg-[var(--color-overlay)]" />
            <div className="h-3 w-12 rounded bg-[var(--color-overlay)]" />
            <div className="h-3 w-12 rounded bg-[var(--color-overlay)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function BrowseCommunitiesPage() {
  const [communities, setCommunities] = useState<FederatedCommunity[]>([]);
  const [meta, setMeta] = useState<DiscoverMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<string>('subscribers');
  const [minSubs, setMinSubs] = useState(0);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Fetch communities
  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (sort) params.set('sort', sort);
      if (minSubs > 0) params.set('min_subs', String(minSubs));
      params.set('limit', '50');

      const res = await fetch(`/api/communities/discover?${params.toString()}`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { data: FederatedCommunity[]; meta: DiscoverMeta };
      setCommunities(data.data ?? []);
      setMeta(data.meta ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch, sort, minSubs]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  // Count categories in loaded results
  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of communities) {
      counts[c.niche] = (counts[c.niche] ?? 0) + 1;
    }
    return counts;
  }, [communities]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/10 text-lg">
              🌐
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Browse Communities</h1>
              <p className="text-sm text-[var(--color-muted)]">
                Discover {meta ? `${meta.total} communities` : 'communities'} across the Lemmy
                fediverse
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Search + Sort row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search communities…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/50"
              />
            </div>
            <div className="flex gap-2">
              {/* Sort dropdown */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Min subs filter */}
              <select
                value={minSubs}
                onChange={(e) => setMinSubs(Number(e.target.value))}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-degen-500/50"
              >
                <option value={0}>Any size</option>
                <option value={100}>100+ subs</option>
                <option value={1000}>1K+ subs</option>
                <option value={10000}>10K+ subs</option>
              </select>
            </div>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.id;
              const count = cat.id ? (categoryCount[cat.id] ?? 0) : communities.length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-degen-500/15 text-degen-400 ring-1 ring-degen-500/30'
                      : 'border border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-[var(--color-fg)]'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className="ml-0.5 text-[10px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
            <button
              type="button"
              onClick={fetchCommunities}
              className="ml-3 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <CardsSkeleton count={12} />}

        {/* Empty */}
        {!loading && !error && communities.length === 0 && (
          <div className="py-20 text-center">
            <div className="mb-4 text-5xl">🔍</div>
            <p className="text-lg text-[var(--color-muted)]">
              {search || category ? 'No communities match your filters.' : 'No communities found.'}
            </p>
            {(search || category) && (
              <button
                type="button"
                onClick={() => {
                  setCategory('');
                  setSearch('');
                  setDebouncedSearch('');
                }}
                className="mt-4 text-sm text-degen-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {!loading && !error && communities.length > 0 && (
          <>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Showing {communities.length} community{communities.length !== 1 ? 'ies' : 'y'}
              {meta?.category ? ` in "${meta.category}"` : ''}
              {sort !== 'subscribers' ? ` sorted by ${sort}` : ''}
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {communities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

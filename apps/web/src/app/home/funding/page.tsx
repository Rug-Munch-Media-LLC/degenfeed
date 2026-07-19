'use client';

import { FundingCard, type FundingRound } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

type StageFilter = '' | 'seed' | 'private' | 'public' | 'series-a' | 'series-b';

const STAGES: { value: StageFilter; label: string }[] = [
  { value: '', label: 'All Stages' },
  { value: 'seed', label: 'Seed' },
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
];

const CHAINS = ['', 'ethereum', 'solana', 'bitcoin', 'base', 'arbitrum'] as const;
const CHAIN_LABELS: Record<string, string> = {
  '': 'All Chains',
  ethereum: 'Ethereum',
  solana: 'Solana',
  bitcoin: 'Bitcoin',
  base: 'Base',
  arbitrum: 'Arbitrum',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function FundingSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="mb-3 skeleton h-4 w-3/4 rounded" />
      <div className="mb-4 flex gap-4">
        <div className="skeleton h-12 flex-1 rounded-xl" />
        <div className="skeleton h-12 flex-1 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-8 w-20 rounded-full" />
        <div className="skeleton h-8 w-20 rounded-full" />
        <div className="skeleton h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

// ─── Stats Mini Card ──────────────────────────────────────────────────────

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/50 px-4 py-3 backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tracking-tight" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────

function FilterPill<T extends string>({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? 'border-degen-500/40 bg-degen-500/15 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.08)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)]/50 text-[var(--color-muted)] hover:border-degen-500/30 hover:text-[var(--color-fg)]'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────

function EmptyFunding({
  chainFilter,
  stageFilter,
  onClear,
}: {
  chainFilter: string;
  stageFilter: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)]/30 px-6 py-16 backdrop-blur-sm">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]/50">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          className="text-[var(--color-muted)]"
          aria-hidden="true"
        >
          <path
            d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm-2 4a2 2 0 1 1 4 0v1h-4V6zm-4 5h12v8H6v-8z"
            fill="currentColor"
            opacity="0.5"
          />
          <circle cx="12" cy="14" r="2" fill="currentColor" opacity="0.8" />
          <path
            d="M12 16v3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">No Funding Rounds Found</h3>
      <p className="mb-2 max-w-sm text-center text-xs text-[var(--color-muted)]">
        {chainFilter || stageFilter
          ? 'No rounds match your current filters. Try adjusting your search criteria.'
          : 'Funding rounds from across the crypto ecosystem will appear here once data sources populate.'}
      </p>
      <p className="mb-5 text-[10px] text-[var(--color-muted)]">
        Data sourced from ecosystem APIs — cached every 15 minutes
      </p>
      {(chainFilter || stageFilter) && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-xl bg-degen-500/15 px-5 py-2.5 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/25 hover:shadow-[0_0_16px_rgba(0,255,65,0.12)]"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function FundingPage() {
  const [rounds, setRounds] = useState<FundingRound[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [chainFilter, setChainFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<StageFilter>('');
  const [meta, setMeta] = useState<{ totalRaised?: number }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRounds = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      const url = new URL('/api/feed/funding', window.location.origin);
      if (chainFilter) url.searchParams.set('chain', chainFilter);
      if (stageFilter) url.searchParams.set('stage', stageFilter);
      url.searchParams.set('limit', '50');
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || `API error (${res.status})`);
      }
      const data = (await res.json()) as {
        data?: FundingRound[];
        meta?: { totalRaised?: number };
      };
      if (!mountedRef.current) return;
      if (data.data?.length) {
        setRounds(data.data);
        setMeta(data.meta || {});
        setState('loaded');
      } else {
        setState('empty');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load funding data');
      setState('error');
    }
  }, [chainFilter, stageFilter]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  const activeFilterCount = useMemo(
    () => (chainFilter ? 1 : 0) + (stageFilter ? 1 : 0),
    [chainFilter, stageFilter],
  );

  const handleClearFilters = useCallback(() => {
    setChainFilter('');
    setStageFilter('');
  }, []);

  // ── Stats ──
  const stats = useMemo(() => {
    if (rounds.length === 0) return null;
    const totalRaised = rounds.reduce((s, r) => {
      const cleaned = (r.amount || '').replace(/[^0-9.]/g, '');
      const parsed = Number.parseFloat(cleaned);
      return s + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
    return {
      totalRaised,
      activeRounds: rounds.length,
    };
  }, [rounds]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter">
      {/* ═══ Header ═══ */}
      <div className="mb-6">
        <a
          href="/home"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          All sections
        </a>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-degen-500/20 bg-degen-500/10">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-degen-400"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <circle cx="12" cy="14" r="2" fill="currentColor" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[var(--color-fg)]">
                  Funding Tracker
                </h1>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  Crypto raises, rounds, and investments across the ecosystem
                </p>
              </div>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 rounded-full border border-degen-500/20 bg-degen-500/5 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-degen-400">
              Live
            </span>
          </div>
        </div>

        {meta.totalRaised ? (
          <p className="mt-2 text-xs text-degen-400">
            <span className="font-semibold">${(meta.totalRaised / 1_000_000).toFixed(1)}M</span>{' '}
            total raised across {rounds.length} round{rounds.length !== 1 ? 's' : ''}
          </p>
        ) : null}
      </div>

      {/* ═══ Stats Summary ═══ */}
      {state === 'loaded' && stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniStat
            label="Total Raised"
            value={formatCompact(stats.totalRaised)}
            accent="#00ff41"
          />
          <MiniStat label="Active Rounds" value={String(stats.activeRounds)} accent="#8a63d2" />
          <MiniStat
            label="Chains Tracked"
            value={String(new Set(rounds.map((r) => r.chain).filter(Boolean)).size)}
            accent="#1185fe"
          />
        </div>
      )}

      {/* ═══ Filters ═══ */}
      <div className="mb-5 space-y-3">
        {/* Chain filter */}
        <div className="flex flex-wrap gap-2">
          {CHAINS.map((c) => (
            <FilterPill
              key={c}
              label={CHAIN_LABELS[c] || c}
              active={chainFilter === c}
              onClick={() => setChainFilter(c)}
            />
          ))}
        </div>

        {/* Stage filter */}
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <FilterPill
              key={s.value}
              label={s.label}
              active={stageFilter === s.value}
              onClick={() => setStageFilter(s.value)}
            />
          ))}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-glass-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:border-red-500/30 hover:text-red-400"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* ═══ Loading ═══ */}
      {state === 'loading' && (
        <div className="space-y-4" role="status" aria-label="Loading funding rounds">
          {Array.from({ length: 4 }).map((_, i) => (
            <FundingSkeleton key={i} />
          ))}
          <span className="sr-only">Loading funding data...</span>
        </div>
      )}

      {/* ═══ Loaded ═══ */}
      {state === 'loaded' && (
        <div className="space-y-4 stagger-enter">
          {rounds.map((r, i) => (
            <div
              key={r.id}
              className="stagger-item"
              style={{ '--stagger-item-index': i } as React.CSSProperties}
            >
              <FundingCard round={r} />
            </div>
          ))}
        </div>
      )}

      {/* ═══ Empty ═══ */}
      {state === 'empty' && (
        <EmptyFunding
          chainFilter={chainFilter}
          stageFilter={stageFilter}
          onClear={handleClearFilters}
        />
      )}

      {/* ═══ Error ═══ */}
      {state === 'error' && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-900/40 bg-red-950/20 px-6 py-14 backdrop-blur-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-red-400"
              aria-hidden="true"
            >
              <path
                d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Failed to Load</h3>
          {errorMsg && <p className="mb-4 max-w-sm text-center text-xs text-red-400">{errorMsg}</p>}
          <p className="mb-5 text-[10px] text-[var(--color-muted)]">
            Try refreshing the page or check back later
          </p>
          <button
            type="button"
            onClick={loadRounds}
            className="rounded-xl border border-red-900/40 bg-red-950/30 px-5 py-2.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-950/40 active:scale-[0.97]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ═══ Footer ═══ */}
      {state === 'loaded' && rounds.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-[10px] text-[var(--color-muted)]">
            Data sourced from ecosystem APIs — cached for 15 minutes · {rounds.length} rounds shown
          </p>
        </div>
      )}

      <div className="h-20 lg:hidden" />
    </div>
  );
}

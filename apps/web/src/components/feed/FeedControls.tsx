'use client';

/**
 * @degenfeed/web — FeedControls
 *
 * User-controllable feed controls: sort, protocol mix, content type, time
 * range, niche/topic filter, and the "My Algorithm" weight panel.
 *
 * Every control is reflected in the URL (?sort=&protocols=&types=&time=
 * &niches=&algo=) via useFeedControls, so a feed configuration is
 * shareable and never a black box.
 */

import { NICHE_LABELS } from '@degenfeed/feed-core';
import { getProtocolColor } from '@degenfeed/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  CONTENT_TYPE_LABELS,
  DEFAULT_FEED_CONTROLS,
  type FeedContentType,
  type FeedControls as FeedControlsState,
  type FeedTimeRange,
  SORT_LABELS,
  TIME_RANGE_LABELS,
} from '../../lib/feedRanking';
import { SortSelector } from './SortSelector';

// ─── Protocol chips (multi-select) ─────────────────────────────────────

const PROTOCOL_CHIPS = [
  { id: 'nostr', label: 'Nostr', icon: '⚡' },
  { id: 'farcaster', label: 'Farcaster', icon: '🟣' },
  { id: 'lens', label: 'Lens', icon: '🌿' },
  { id: 'bluesky', label: 'Bluesky', icon: '🦋' },
  { id: 'mastodon', label: 'Mastodon', icon: '🐘' },
  { id: 'lemmy', label: 'Lemmy', icon: '🗣' },
  { id: 'reddit', label: 'Reddit', icon: '🔴' },
  { id: 'rss', label: 'RSS', icon: '📰' },
];

// ─── Niche facets (MeiliSearch with static fallback) ───────────────────

const STATIC_NICHES = Object.keys(NICHE_LABELS);
let nicheFacetCache: Promise<string[]> | null = null;

/**
 * Best-effort niche list from MeiliSearch facet distribution.
 * Falls back to the curated feed-core niche taxonomy when the facet
 * endpoint is unavailable (today it 404s — see design doc).
 */
function loadNicheFacets(): Promise<string[]> {
  if (nicheFacetCache) return nicheFacetCache;
  nicheFacetCache = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch('/api/search/facets?facet=niches', {
        signal: ctrl.signal,
        credentials: 'include',
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const json = (await res.json()) as {
        facets?: Record<string, Record<string, number>>;
        facetDistribution?: Record<string, Record<string, number>>;
      };
      const dist = json?.facets?.niches ?? json?.facetDistribution?.niches;
      if (!dist || typeof dist !== 'object') return [];
      return Object.entries(dist)
        .sort((a, b) => b[1] - a[1])
        .map(([n]) => n)
        .slice(0, 32);
    } catch {
      return [];
    }
  })();
  return nicheFacetCache;
}

// ─── Small UI atoms ────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  color,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
        active ? 'shadow-sm' : 'opacity-70 hover:opacity-100 hover:bg-[var(--color-overlay)]'
      }`}
      style={
        color && active
          ? {
              backgroundColor: `${color}1a`,
              color,
              border: `1px solid ${color}40`,
            }
          : { border: '1px solid var(--color-glass-border)' }
      }
    >
      {children}
    </button>
  );
}

function AlgoSlider({
  label,
  left,
  right,
  value,
  onChange,
  hint,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
        <span>{left}</span>
        <span className="font-semibold text-[var(--color-fg)]">{label}</span>
        <span>{right}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--degen-400) ${value}%, var(--color-glass-border) ${value}%)`,
        }}
      />
      <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hint}</p>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────

export interface FeedControlsProps {
  controls: FeedControlsState;
  onChange: (next: FeedControlsState) => void;
  /** Live result count for the current configuration. */
  resultCount?: number;
  className?: string;
}

export function FeedControls({
  controls,
  onChange,
  resultCount,
  className = '',
}: FeedControlsProps) {
  const [niches, setNiches] = useState<string[]>(STATIC_NICHES);
  const [algoOpen, setAlgoOpen] = useState(false);
  const [showAllNiches, setShowAllNiches] = useState(false);

  // Enrich with MeiliSearch facets once (falls back to the static taxonomy).
  useEffect(() => {
    let mounted = true;
    loadNicheFacets().then((fetched) => {
      if (!mounted) return;
      if (fetched.length > 0) setNiches((prev) => [...new Set([...fetched, ...prev])]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeFilterCount =
    controls.protocols.length +
    controls.contentTypes.length +
    controls.niches.length +
    (controls.timeRange !== DEFAULT_FEED_CONTROLS.timeRange ? 1 : 0) +
    (controls.sort !== DEFAULT_FEED_CONTROLS.sort ? 1 : 0);

  const algoDirty = useMemo(() => {
    const a = controls.algorithm;
    return (
      a.recencyQuality !== 50 ||
      a.engagementDiversity !== 50 ||
      a.protocolDiversity !== 50 ||
      a.familiarDiscover !== 50 ||
      a.creatorSize !== 50
    );
  }, [controls.algorithm]);

  const toggleProtocol = (id: string) => {
    const next = controls.protocols.includes(id)
      ? controls.protocols.filter((p) => p !== id)
      : [...controls.protocols, id];
    onChange({ ...controls, protocols: next });
  };

  const toggleContentType = (id: FeedContentType) => {
    const next = controls.contentTypes.includes(id)
      ? controls.contentTypes.filter((t) => t !== id)
      : [...controls.contentTypes, id];
    onChange({ ...controls, contentTypes: next });
  };

  const toggleNiche = (id: string) => {
    const next = controls.niches.includes(id)
      ? controls.niches.filter((n) => n !== id)
      : [...controls.niches, id];
    onChange({ ...controls, niches: next });
  };

  const setTimeRange = (range: FeedTimeRange) => {
    onChange({ ...controls, timeRange: range });
  };

  const setAlgorithm = (patch: Partial<FeedControlsState['algorithm']>) => {
    onChange({ ...controls, algorithm: { ...controls.algorithm, ...patch } });
  };

  const visibleNiches = showAllNiches ? niches : niches.slice(0, 14);

  return (
    <section
      aria-label="Feed controls"
      className={`mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-2.5 ${className}`}
    >
      {/* Row 1 — sort + algorithm + reset */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SortSelector mode={controls.sort} onChange={(sort) => onChange({ ...controls, sort })} />
          {resultCount !== undefined && (
            <span className="text-[10px] text-[var(--color-muted)]" aria-live="polite">
              {resultCount} post{resultCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FEED_CONTROLS)}
              className="rounded-lg border border-[var(--color-glass-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Reset · {activeFilterCount}
            </button>
          )}
          <button
            type="button"
            aria-expanded={algoOpen}
            onClick={() => setAlgoOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              algoOpen || algoDirty
                ? 'border-degen-500/40 bg-degen-500/10 text-degen-400'
                : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span aria-hidden="true">🧪</span>
            My Algorithm
            {algoDirty && <span aria-hidden="true">•</span>}
          </button>
        </div>
      </div>

      {/* Row 2 — protocol mix */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-16 shrink-0 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Protocols
        </span>
        <Chip
          active={controls.protocols.length === 0}
          onClick={() => onChange({ ...controls, protocols: [] })}
          title="Show posts from every network"
        >
          ✦ All
        </Chip>
        {PROTOCOL_CHIPS.map((p) => (
          <Chip
            key={p.id}
            active={controls.protocols.includes(p.id)}
            onClick={() => toggleProtocol(p.id)}
            color={getProtocolColor(p.id)}
          >
            <span aria-hidden="true">{p.icon}</span> {p.label}
          </Chip>
        ))}
      </div>

      {/* Row 3 — content type */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-16 shrink-0 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Content
        </span>
        {(Object.keys(CONTENT_TYPE_LABELS) as FeedContentType[]).map((t) => (
          <Chip
            key={t}
            active={controls.contentTypes.includes(t)}
            onClick={() => toggleContentType(t)}
            color="var(--color-accent)"
          >
            <span aria-hidden="true">{CONTENT_TYPE_LABELS[t].icon}</span>{' '}
            {CONTENT_TYPE_LABELS[t].label}
          </Chip>
        ))}
      </div>

      {/* Row 4 — time range */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 w-16 shrink-0 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Time
        </span>
        {(Object.keys(TIME_RANGE_LABELS) as FeedTimeRange[]).map((r) => (
          <Chip
            key={r}
            active={controls.timeRange === r}
            onClick={() => setTimeRange(r)}
            color="var(--color-accent)"
          >
            {TIME_RANGE_LABELS[r]}
          </Chip>
        ))}
      </div>

      {/* Row 5 — niche / topic */}
      <div className="mt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-16 shrink-0 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            Topics
          </span>
          <Chip
            active={controls.niches.length === 0}
            onClick={() => onChange({ ...controls, niches: [] })}
          >
            ✦ All
          </Chip>
          {visibleNiches.map((n) => (
            <Chip
              key={n}
              active={controls.niches.includes(n)}
              onClick={() => toggleNiche(n)}
              color={NICHE_LABELS[n]?.color}
            >
              {NICHE_LABELS[n]?.icon ? (
                <span aria-hidden="true">{NICHE_LABELS[n].icon}</span>
              ) : null}{' '}
              {NICHE_LABELS[n]?.label ?? n}
            </Chip>
          ))}
          {niches.length > 14 && (
            <button
              type="button"
              onClick={() => setShowAllNiches((v) => !v)}
              className="shrink-0 rounded-full border border-[var(--color-glass-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              {showAllNiches ? '− Less' : `+ ${niches.length - 14} more`}
            </button>
          )}
        </div>
        <p className="mt-1 text-[9px] text-[var(--color-muted)]">
          Topics are sourced from live MeiliSearch facets when available (curated taxonomy as
          fallback).
        </p>
      </div>

      {/* My Algorithm panel */}
      {algoOpen && (
        <div className="mt-3 space-y-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--color-fg)]">My Algorithm</h3>
            <button
              type="button"
              onClick={() => onChange({ ...controls, algorithm: DEFAULT_FEED_CONTROLS.algorithm })}
              className="rounded-lg border border-[var(--color-glass-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Reset weights
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
            Your feed is ranked by your weights, not a hidden formula. Sliders apply to For You /
            Trending / Quality / Engaged sorts — New stays chronological.
          </p>
          <AlgoSlider
            label="Recency ↔ Quality"
            left="Fresh"
            right="Signal"
            value={controls.algorithm.recencyQuality}
            onChange={(v) => setAlgorithm({ recencyQuality: v })}
            hint="Fresh pushes newer posts; Signal favors high-quality content."
          />
          <AlgoSlider
            label="Engagement ↔ Diversity"
            left="Popular"
            right="Varied"
            value={controls.algorithm.engagementDiversity}
            onChange={(v) => setAlgorithm({ engagementDiversity: v })}
            hint="Popular favors viral posts; Varied spreads coverage across many creators."
          />
          <AlgoSlider
            label="Protocol diversity"
            left="Focused"
            right="Mixed"
            value={controls.algorithm.protocolDiversity}
            onChange={(v) => setAlgorithm({ protocolDiversity: v })}
            hint="Mixed enforces rotation across networks (Nostr, Farcaster, Bluesky…)."
          />
          <AlgoSlider
            label="Familiar ↔ Discover"
            left="Familiar"
            right="Discover"
            value={controls.algorithm.familiarDiscover}
            onChange={(v) => setAlgorithm({ familiarDiscover: v })}
            hint="Discover reserves a slice of your feed (up to ~20%) for protocols and topics outside your usual bubble."
          />
          <AlgoSlider
            label="Creator size"
            left="Indie"
            right="Big"
            value={controls.algorithm.creatorSize}
            onChange={(v) => setAlgorithm({ creatorSize: v })}
            hint="Indie boosts small and new creators (with a first-24h discovery boost); Big favors established accounts."
          />
          <p className="text-[10px] text-[var(--color-muted)]">
            Current sort:{' '}
            <span className="font-semibold text-[var(--color-fg)]">
              {SORT_LABELS[controls.sort].label}
            </span>{' '}
            — {SORT_LABELS[controls.sort].hint}.
          </p>
        </div>
      )}
    </section>
  );
}

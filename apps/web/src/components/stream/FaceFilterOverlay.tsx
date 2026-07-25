'use client';

/**
 * @degenfeed/web — TikTok-Style Face Filter Overlay
 *
 * Swipeable filter carousel for live streams.
 * Filters include: hats, masks, beauty effects, background replacement.
 * Free filters + premium/NFT-gated filters.
 * Filter previews show on the camera feed with overlay assets.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import './stream-tiktok-animations.css';

// ─── Types ───────────────────────────────────────────────────────────────

export interface FilterItem {
  id: string;
  name: string;
  category: 'hat' | 'mask' | 'beauty' | 'background' | 'accessory';
  thumbnailUrl: string;
  overlayUrl?: string;
  access: 'free' | 'premium' | 'nft' | 'creator_only';
  creatorLabel?: string;
  purchaseSats: number;
  purchaseUsd: number;
  usesFaceTracking: boolean;
  isBackground: boolean;
  owned: boolean;
}

interface FiltersResponse {
  filters: FilterItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  hat: '🎩 Hats',
  mask: '🎭 Masks',
  beauty: '✨ Beauty',
  background: '🌌 BG',
  accessory: '🕶️ Style',
};

const CATEGORY_ORDER = ['hat', 'mask', 'beauty', 'background', 'accessory'] as const;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
};

// ─── Props ───────────────────────────────────────────────────────────────

interface FaceFilterOverlayProps {
  /** Currently active filter ID */
  activeFilterId?: string;
  /** Called when a filter is selected */
  onFilterSelect: (filter: FilterItem | null) => void;
  /** Whether the filter panel is visible */
  visible: boolean;
  /** Called to close/hide the panel */
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export function FaceFilterOverlay({
  activeFilterId,
  onFilterSelect,
  visible,
  onClose,
}: FaceFilterOverlayProps) {
  const [activeCategory, setActiveCategory] = useState<string>('hat');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user's filters
  const { data, error, mutate } = useSWR<FiltersResponse>('/api/live/filters/my-filters', fetcher, {
    revalidateOnFocus: false,
  });

  const allFilters = useMemo(() => {
    const filters = data?.filters ?? [];
    // Separate owned and unowned
    return {
      owned: filters.filter((f) => f.owned),
      unowned: filters.filter((f) => !f.owned && f.access !== 'creator_only'),
    };
  }, [data]);

  const handleSelect = useCallback(
    (filter: FilterItem) => {
      if (activeFilterId === filter.id) {
        onFilterSelect(null); // Toggle off
      } else if (filter.owned) {
        onFilterSelect(filter);
      }
    },
    [activeFilterId, onFilterSelect],
  );

  const handleBuy = useCallback(
    async (filter: FilterItem) => {
      setBuyingId(filter.id);
      try {
        const res = await fetch(`/api/live/filters/${filter.id}/buy`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chain: 'ethereum' }),
        });
        if (res.ok) {
          mutate();
        }
      } catch {
        // silently fail
      } finally {
        setBuyingId(null);
      }
    },
    [mutate],
  );

  // Scroll active category into view
  useEffect(() => {
    if (scrollRef.current && visible) {
      const btn = scrollRef.current.querySelector(
        `[data-category="${activeCategory}"]`,
      ) as HTMLElement;
      btn?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, [activeCategory, visible]);

  if (!visible) return null;

  // ─── Filtered list for current category ───────────────────────────

  const categoryFilters = useMemo(() => {
    const owned = allFilters.owned.filter((f) => f.category === activeCategory);
    const unowned = allFilters.unowned.filter(
      (f) => f.category === activeCategory && f.purchaseSats > 0,
    );
    return { owned, unowned };
  }, [allFilters, activeCategory]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 animate-slide-up">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"
        style={{ height: '200%', bottom: 0 }}
      />

      {/* Content */}
      <div className="relative z-10 pb-4">
        {/* Category tabs */}
        <div ref={scrollRef} className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              data-category={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 backdrop-blur-sm'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Filter cards - horizontal scroll */}
        <div className="relative px-4">
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {/* None filter */}
            <button
              type="button"
              onClick={() => onFilterSelect(null)}
              className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-20 transition-all ${
                !activeFilterId ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-80'
              }`}
            >
              <div
                className={`h-20 w-20 rounded-2xl border-2 flex items-center justify-center ${
                  !activeFilterId
                    ? 'border-degen-500 bg-degen-500/20'
                    : 'border-white/20 bg-white/10'
                }`}
              >
                <span className="text-3xl">🚫</span>
              </div>
              <span className="text-[9px] font-medium text-white/60">None</span>
            </button>

            {/* Owned filters */}
            {categoryFilters.owned.map((filter) => {
              const isActive = activeFilterId === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleSelect(filter)}
                  className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-20 transition-all ${
                    isActive ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-90'
                  }`}
                >
                  <div
                    className={`h-20 w-20 rounded-2xl border-2 overflow-hidden flex items-center justify-center text-3xl ${
                      isActive
                        ? 'border-degen-500 bg-degen-500/20 shadow-[0_0_15px_rgba(0,255,65,0.3)]'
                        : 'border-white/15 bg-white/10'
                    }`}
                  >
                    {filter.thumbnailUrl.match(/[🤠👑🧙🎩🎉🐱🐶🤖👽💀✨🌟🌸🌫️🌌🌃😎🧐]/u) ? (
                      <span className="text-3xl filter-effect-hover">{filter.thumbnailUrl}</span>
                    ) : (
                      <span className="text-xl">{filter.thumbnailUrl}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-medium text-white/80 truncate max-w-full">
                    {filter.name}
                  </span>
                  {filter.access === 'premium' && filter.owned && (
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[7px] text-purple-400 font-semibold">
                      Premium
                    </span>
                  )}
                </button>
              );
            })}

            {/* Unowned (purchasable) filters */}
            {categoryFilters.unowned.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => handleBuy(filter)}
                disabled={buyingId === filter.id}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 w-20 transition-all opacity-60 hover:opacity-90"
              >
                <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-1">
                  {buyingId === filter.id ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span className="text-lg">{filter.thumbnailUrl}</span>
                      <span className="text-[8px] font-bold text-degen-400">
                        ${filter.purchaseUsd.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[9px] font-medium text-white/50 truncate max-w-full">
                  {filter.name}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[7px] font-semibold ${
                    filter.access === 'nft'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {filter.access === 'nft' ? 'NFT' : 'Buy'}
                </span>
              </button>
            ))}

            {/* Empty state */}
            {categoryFilters.owned.length === 0 && categoryFilters.unowned.length === 0 && (
              <div className="flex items-center justify-center h-20 px-6">
                <p className="text-[10px] text-white/30">No filters in this category</p>
              </div>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <p className="px-4 text-[9px] text-red-400 mt-1">
            Failed to load filters. Swipe to retry.
          </p>
        )}

        {/* Active filter indicator */}
        {activeFilterId && (
          <div className="flex items-center justify-center mt-2 px-4">
            <div className="rounded-full bg-degen-500/20 backdrop-blur-sm px-3 py-1 border border-degen-500/20">
              <span className="text-[9px] text-degen-400 font-medium">
                Filter active — tap again to remove
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

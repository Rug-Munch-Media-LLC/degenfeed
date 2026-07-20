'use client';

/**
 * @degenfeed/web — YouTubeCategoryBar
 *
 * Horizontal scrollable category pills for YouTube content filtering.
 * Each pill has an emoji icon and category label.
 * Active state shown with red accent (matching YouTube brand).
 */

import { memo, useRef, useState } from 'react';
import type { YouTubeCategory } from './useYouTube';

// === Types ===============================================================

export interface YouTubeCategoryBarProps {
  /** Available categories */
  categories: YouTubeCategory[];
  /** Currently active category ID */
  activeCategory: string;
  /** Called when a category is selected */
  onCategoryChange: (categoryId: string) => void;
  /** Include "All" option at the start */
  showAll?: boolean;
}

// === Component ===========================================================

export const YouTubeCategoryBar = memo(function YouTubeCategoryBar({
  categories,
  activeCategory,
  onCategoryChange,
  showAll = true,
}: YouTubeCategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 300);
  };

  const allItems = showAll
    ? [{ id: 'all', label: 'All', icon: '\uD83D\uDD0D' }, ...categories]
    : categories;

  return (
    <div className="relative flex items-center gap-1">
      {/* Scroll left button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 rounded-full p-1 bg-[var(--color-card)] border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] shadow-md transition-colors focus:outline-none"
          aria-label="Scroll categories left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18L9 12L15 6" />
          </svg>
        </button>
      )}

      {/* Categories scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto py-1 scrollbar-none snap-x snap-mandatory"
        onScroll={checkScroll}
        role="tablist"
        aria-label="YouTube categories"
      >
        {allItems.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all snap-start focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
                isActive
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10'
                  : 'bg-[var(--color-card)] text-[var(--color-muted)] border border-[var(--color-glass-border)] hover:border-red-500/20 hover:text-[var(--color-fg)]'
              }`}
            >
              {cat.icon && <span className="text-sm">{cat.icon}</span>}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scroll right button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 rounded-full p-1 bg-[var(--color-card)] border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] shadow-md transition-colors focus:outline-none"
          aria-label="Scroll categories right"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18L15 12L9 6" />
          </svg>
        </button>
      )}
    </div>
  );
});

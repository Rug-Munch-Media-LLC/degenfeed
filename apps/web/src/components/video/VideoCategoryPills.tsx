'use client';

/**
 * @degenfeed/web — VideoCategoryPills
 *
 * Horizontal scrollable category selector with icons and active state.
 * Passes the selected category up to the parent for filtering.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// === Categories definition ===============================================

export interface CategoryPill {
  id: string;
  label: string;
  icon: string;
  color?: string;
  count?: number;
}

export const DEFAULT_CATEGORIES: CategoryPill[] = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#9146FF' },
  { id: 'music', label: 'Music', icon: '🎵', color: '#FF4081' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '🪙', color: '#0052FF' },
  { id: 'tech', label: 'Tech & Coding', icon: '💻', color: '#00BCD4' },
  { id: 'art', label: 'Art & Creative', icon: '🎨', color: '#FF6B35' },
  { id: 'education', label: 'Education', icon: '📚', color: '#2196F3' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#E91E63' },
  { id: 'sports', label: 'Sports', icon: '⚽', color: '#F44336' },
  { id: 'news', label: 'News', icon: '📰', color: '#607D8B' },
  { id: 'science', label: 'Science', icon: '🔬', color: '#4CAF50' },
  { id: 'comedy', label: 'Comedy', icon: '😂', color: '#FFC107' },
  { id: 'irl', label: 'IRL & Lifestyle', icon: '🌍', color: '#00C853' },
  { id: 'talk', label: 'Talk & Podcasts', icon: '🎙️', color: '#FFD600' },
  { id: 'trading', label: 'Trading & Finance', icon: '📈', color: '#FF5722' },
];

interface VideoCategoryPillsProps {
  categories?: CategoryPill[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  className?: string;
  showScrollButtons?: boolean;
}

export function VideoCategoryPills({
  categories = DEFAULT_CATEGORIES,
  activeCategory,
  onCategoryChange,
  className = '',
  showScrollButtons = true,
}: VideoCategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Left scroll button */}
      {showScrollButtons && canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy('left')}
          className="absolute left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-card)]/90 text-[var(--color-muted)] shadow-lg backdrop-blur-sm hover:text-[var(--color-fg)] transition-colors"
          aria-label="Scroll categories left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Scrollable pills container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none py-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'border-degen-500/40 bg-degen-500/15 text-degen-400 shadow-[0_0_8px_rgba(0,255,65,0.1)]'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-fg)]'
              }`}
              style={
                isActive && cat.color
                  ? {
                      borderColor: `${cat.color}40`,
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                    }
                  : undefined
              }
            >
              <span className="text-sm" aria-hidden="true">
                {cat.icon}
              </span>
              <span>{cat.label}</span>
              {cat.count !== undefined && (
                <span className={`text-[10px] ${isActive ? 'opacity-70' : 'text-[var(--color-muted)]'}`}>
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right scroll button */}
      {showScrollButtons && canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy('right')}
          className="absolute right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-card)]/90 text-[var(--color-muted)] shadow-lg backdrop-blur-sm hover:text-[var(--color-fg)] transition-colors"
          aria-label="Scroll categories right"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

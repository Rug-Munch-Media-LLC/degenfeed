'use client';

import { getCategoryInfo, STREAM_CATEGORIES, type StreamCategory } from './types';

/* === Category Pill ============================================ */

interface StreamCategoryPillProps {
  category: StreamCategory;
  active?: boolean;
  onClick?: (category: StreamCategory) => void;
}

export function StreamCategoryPill({ category, active = false, onClick }: StreamCategoryPillProps) {
  const info = getCategoryInfo(category);
  return (
    <button
      type="button"
      onClick={() => onClick?.(category)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all active:scale-[0.97] whitespace-nowrap ${
        active ? 'text-white shadow-sm' : 'text-white/50 hover:text-white/80 border border-white/10'
      }`}
      style={active ? { backgroundColor: info.color, color: '#000' } : {}}
    >
      <span aria-hidden="true">{info.icon}</span>
      {info.label}
    </button>
  );
}

/* === Category Bar ============================================= */

interface StreamCategoriesBarProps {
  activeCategory?: StreamCategory | 'all';
  onCategoryChange?: (category: StreamCategory | 'all') => void;
}

export function StreamCategoriesBar({
  activeCategory = 'all',
  onCategoryChange,
}: StreamCategoriesBarProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
      role="tablist"
      aria-label="Stream categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeCategory === 'all'}
        onClick={() => onCategoryChange?.('all')}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap active:scale-[0.97] ${
          activeCategory === 'all'
            ? 'bg-white text-black'
            : 'border border-white/10 text-white/50 hover:text-white/80'
        }`}
      >
        All
      </button>

      {STREAM_CATEGORIES.map((cat) => (
        <StreamCategoryPill
          key={cat.id}
          category={cat.id}
          active={activeCategory === cat.id}
          onClick={(id) => onCategoryChange?.(id)}
        />
      ))}
    </div>
  );
}

/* === Category Grid (for discovery) ============================ */

interface StreamCategoryGridProps {
  onSelectCategory?: (category: StreamCategory) => void;
}

export function StreamCategoryGrid({ onSelectCategory }: StreamCategoryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {STREAM_CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelectCategory?.(cat.id)}
          className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-center transition-all hover:border-degen-500/20 hover:bg-white/10 active:scale-[0.97]"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${cat.color}15` }}
          >
            {cat.icon}
          </div>
          <span className="text-xs font-semibold text-white/80 group-hover:text-white">
            {cat.label}
          </span>
          <span className="text-[9px] text-white/30">{cat.description}</span>
        </button>
      ))}
    </div>
  );
}

export { STREAM_CATEGORIES };

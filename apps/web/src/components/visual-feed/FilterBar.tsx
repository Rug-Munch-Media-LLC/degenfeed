'use client';

/**
 * FilterBar — Source toggles + sort + filter for the visual feed.
 */

interface FilterOption {
  id: string;
  label: string;
  icon: string;
}

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  activeSort: string;
  onSortChange: (sort: string) => void;
  sourceCounts?: Record<string, number>;
}

const FILTERS: FilterOption[] = [
  { id: 'all', label: 'All', icon: '📱' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'nfts', label: 'NFTs', icon: '🎨' },
  { id: 'video', label: 'Video', icon: '🎬' },
  { id: 'bluesky', label: 'Bluesky', icon: '🦋' },
];

const SORTS: FilterOption[] = [
  { id: 'newest', label: 'Newest', icon: '🕐' },
  { id: 'trending', label: 'Trending', icon: '🔥' },
  { id: 'top', label: 'Top', icon: '🏆' },
];

export function FilterBar({
  activeFilter,
  onFilterChange,
  activeSort,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Media type filters */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Media type filters">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onFilterChange(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500/30'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
              }`}
            >
              <span aria-hidden="true">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <span className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--color-glass-border)' }} />

      {/* Sort controls */}
      <fieldset className="m-0 flex gap-1" aria-label="Sort order">
        {SORTS.map((s) => {
          const isActive = activeSort === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSortChange(s.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-overlay)] text-[var(--color-fg)] ring-1 ring-[var(--color-border)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
              aria-label={`Sort by ${s.label}`}
            >
              <span aria-hidden="true">{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}

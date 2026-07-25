'use client';

const LAYOUT_PREF_KEY = 'degenfeed:news:layout';

export const SORT_OPTIONS = [
  { id: 'score', label: 'Recommended' },
  { id: 'newest', label: 'Newest' },
  { id: 'trending', label: 'Trending' },
];

export function NewsFilters({ sort, setSort, searchInput, setSearchInput, query, setQuery, masonryLayout, setMasonryLayout, onToggleSidebar, showSidebar }: {
  sort: string; setSort: (s: string) => void; searchInput: string; setSearchInput: (s: string) => void;
  query: string; setQuery: (q: string) => void; masonryLayout: boolean; setMasonryLayout: (v: boolean) => void;
  onToggleSidebar?: () => void; showSidebar?: boolean;
}) {
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setQuery(searchInput); };
  const handleMasonryToggle = () => {
    const v = !masonryLayout;
    setMasonryLayout(v);
    try { localStorage.setItem(LAYOUT_PREF_KEY, v ? 'true' : 'false'); } catch { /* */ }
  };
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
      <form onSubmit={handleSearch} className="flex-1">
        <div className="relative">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search news, tokens, topics..."
            className="w-full rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-degen-500/50 focus:ring-1 focus:ring-degen-500/30" />
          <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-degen-500 px-3 py-1 text-xs font-medium text-black hover:bg-degen-400">Search</button>
        </div>
      </form>
      <div className="flex gap-1">
        {SORT_OPTIONS.map((opt) => (
          <button key={opt.id} type="button" onClick={() => setSort(opt.id)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${sort === opt.id ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500/30' : 'text-gray-400 hover:text-white'}`}>
            {opt.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={handleMasonryToggle}
        className={`rounded-lg border px-3 py-2 text-xs transition-all ${masonryLayout ? 'border-degen-500/30 bg-degen-500/10 text-degen-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
        title={masonryLayout ? 'Switch to grid layout' : 'Switch to masonry layout'}>
        {masonryLayout ? '⊞ Grid' : '⊟ Masonry'}
      </button>
      {onToggleSidebar && (
        <button type="button" onClick={onToggleSidebar}
          className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-gray-600">
          {showSidebar ? 'Hide' : 'Show'} Sidebar
        </button>
      )}
    </div>
  );
}

'use client';

export type SearchTab = 'top' | 'latest' | 'people' | 'communities' | 'videos';
const PROTOCOL_FILTERS = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'lemmy', label: 'Lemmy', color: '#00bc8c' },
  { id: 'peertube', label: 'PeerTube', color: '#f1680d' },
  { id: 'rss', label: 'News', color: '#ffa500' },
];

interface SearchFiltersProps {
  protocolFilter: string | null;
  onProtocolFilterChange: (id: string | null) => void;
  tab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  identityCount: number;
  communityCount: number;
  videoCount: number;
  searched: boolean;
  loading: boolean;
}

export function SearchFilters({
  protocolFilter,
  onProtocolFilterChange,
  tab,
  onTabChange,
  identityCount,
  communityCount,
  videoCount,
  searched,
  loading,
}: SearchFiltersProps) {
  if (loading || !searched) return null;

  return (
    <>
      {/* Protocol filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onProtocolFilterChange(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            protocolFilter === null
              ? 'bg-degen-500/20 text-degen-400'
              : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          All
        </button>
        {PROTOCOL_FILTERS.map((pf) => (
          <button
            key={pf.id}
            type="button"
            onClick={() => onProtocolFilterChange(protocolFilter === pf.id ? null : pf.id)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: protocolFilter === pf.id ? `${pf.color}22` : 'var(--color-card)',
              color: protocolFilter === pf.id ? pf.color : 'rgb(156,163,175)',
            }}
          >
            {pf.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[var(--color-card)] p-1">
        {[
          { id: 'top' as const, label: 'Top' },
          { id: 'latest' as const, label: 'Latest' },
          { id: 'people' as const, label: 'People' },
          { id: 'communities' as const, label: 'Communities' },
          { id: 'videos' as const, label: 'Videos' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-degen-500/20 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {t.label}
            {t.id === 'people' && identityCount > 0 && ` (${identityCount})`}
            {t.id === 'communities' && communityCount > 0 && ` (${communityCount})`}
            {t.id === 'videos' && videoCount > 0 && ` (${videoCount})`}
          </button>
        ))}
      </div>
    </>
  );
}

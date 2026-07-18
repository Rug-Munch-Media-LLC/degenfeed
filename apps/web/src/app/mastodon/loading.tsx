import {
  ContentShellSkeleton,
  ListSkeleton,
  SidebarSkeleton,
} from '@/components/loading/PageSkeleton';

const MASTODON_INDIGO = '#6364ff';

export default function MastodonLoading() {
  return (
    <ContentShellSkeleton sidebar={<SidebarSkeleton />}>
      {/* Protocol Hero Skeleton */}
      <div
        className="mb-6 overflow-hidden rounded-2xl border p-6"
        style={{ borderColor: `${MASTODON_INDIGO}33` }}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-16 w-16 animate-pulse rounded-2xl"
            style={{ backgroundColor: `${MASTODON_INDIGO}33` }}
          />
          <div className="flex-1 space-y-2 pt-1">
            <div
              className="h-7 w-32 animate-pulse rounded-lg"
              style={{ backgroundColor: `${MASTODON_INDIGO}22` }}
            />
            <div
              className="h-4 w-64 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-5 w-24 animate-pulse rounded-lg"
              style={{ backgroundColor: `${MASTODON_INDIGO}22` }}
            />
          ))}
        </div>
      </div>
      {/* Tab Skeleton */}
      <div className="mb-6 flex gap-2">
        {['🔥 Hot', '⭐ Quality', '✨ New', '📈 Trending', '🏠 Local'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: `${MASTODON_INDIGO}18` }}
          />
        ))}
      </div>
      <ListSkeleton count={6} />
    </ContentShellSkeleton>
  );
}

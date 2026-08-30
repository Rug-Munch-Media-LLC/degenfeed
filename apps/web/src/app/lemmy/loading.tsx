import {
  ContentShellSkeleton,
  ListSkeleton,
  SidebarSkeleton,
} from '@/components/loading/PageSkeleton';

const LEMMY_BLUE = '#2d9cdb';

export default function LemmyLoading() {
  return (
    <ContentShellSkeleton sidebar={<SidebarSkeleton />}>
      {/* Protocol Header Skeleton */}
      <div
        className="mb-6 overflow-hidden rounded-2xl border p-6"
        style={{ borderColor: `${LEMMY_BLUE}33` }}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-16 w-16 animate-pulse rounded-2xl"
            style={{ backgroundColor: `${LEMMY_BLUE}33` }}
          />
          <div className="flex-1 space-y-2 pt-1">
            <div
              className="h-7 w-32 animate-pulse rounded-lg"
              style={{ backgroundColor: `${LEMMY_BLUE}22` }}
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
              style={{ backgroundColor: `${LEMMY_BLUE}22` }}
            />
          ))}
        </div>
      </div>
      {/* Filter Skeleton */}
      <div className="mb-6 flex gap-2">
        {['🔥 Hot', '⭐ Quality', '✨ New', '📈 Trending'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: `${LEMMY_BLUE}18` }}
          />
        ))}
      </div>
      <ListSkeleton count={6} />
    </ContentShellSkeleton>
  );
}

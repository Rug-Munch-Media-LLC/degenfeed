import { PostCardSkeleton } from '@degenfeed/ui/server';
import { ContentShellSkeleton, SidebarSkeleton } from '@/components/loading/PageSkeleton';

export default function ProtocolFeedLoading() {
  return (
    <ContentShellSkeleton sidebar={<SidebarSkeleton />}>
      {/* Protocol header skeleton */}
      <div className="mb-4 space-y-2">
        <div
          className="h-7 w-48 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <div
          className="h-4 w-72 max-w-full animate-pulse rounded"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
        />
      </div>

      {/* Protocol tabs skeleton */}
      <div
        className="mb-4 flex gap-4 border-b pb-3"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {['Latest', 'Top', 'Fresh'].map((t) => (
          <div
            key={t}
            className="h-8 w-20 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Feed posts — mirrors PostCard layout exactly (no layout shift) */}
      <PostCardSkeleton count={8} />
    </ContentShellSkeleton>
  );
}

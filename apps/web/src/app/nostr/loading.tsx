import {
  ContentShellSkeleton,
  ListSkeleton,
  SidebarSkeleton,
} from '@/components/loading/PageSkeleton';

export default function NostrLoading() {
  return (
    <ContentShellSkeleton sidebar={<SidebarSkeleton />}>
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        <div className="h-6 w-28 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
      </div>
      <div className="mb-6 flex gap-2">
        {['Posts', 'Trending', 'Communities'].map((t) => (
          <div key={t} className="h-8 w-20 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }} />
        ))}
      </div>
      <ListSkeleton count={6} />
    </ContentShellSkeleton>
  );
}

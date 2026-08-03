import { ContentShellSkeleton, ListSkeleton } from '@/components/loading/PageSkeleton';

export default function ActivityLoading() {
  return (
    <ContentShellSkeleton>
      <div className="space-y-6">
        <div
          className="mb-4 h-8 w-32 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <ListSkeleton count={8} />
      </div>
    </ContentShellSkeleton>
  );
}

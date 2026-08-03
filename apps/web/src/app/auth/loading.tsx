import { CardSkeleton, ContentShellSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function AuthLoading() {
  return (
    <ContentShellSkeleton>
      <div className="mx-auto max-w-md py-20">
        <CardSkeleton>
          <Line width="w-48" height="h-6" />
          <Line width="w-full" height="h-3" />
          <div
            className="h-12 w-full animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
          <Line width="w-3/4" height="h-3" />
        </CardSkeleton>
      </div>
    </ContentShellSkeleton>
  );
}

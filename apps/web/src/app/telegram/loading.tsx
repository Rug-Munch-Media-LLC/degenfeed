import { ContentShellSkeleton, CardSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function TelegramLoading() {
  return (
    <ContentShellSkeleton>
      <div className="mx-auto max-w-lg py-12 text-center">
        <div className="mx-auto mb-6 h-20 w-20 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        <div className="mx-auto mb-4 h-8 w-56 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        <CardSkeleton>
          <Line width="w-full" height="h-4" />
          <Line width="w-3/4" height="h-4" />
          <div className="mx-auto mt-4 h-12 w-40 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        </CardSkeleton>
      </div>
    </ContentShellSkeleton>
  );
}

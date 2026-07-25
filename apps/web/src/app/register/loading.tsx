import { ContentShellSkeleton, CardSkeleton, Line, FormFieldSkeleton } from '@/components/loading/PageSkeleton';

export default function RegisterLoading() {
  return (
    <ContentShellSkeleton>
      <div className="mx-auto max-w-md py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
          <div className="mx-auto h-8 w-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        </div>
        <CardSkeleton>
          <FormFieldSkeleton />
          <FormFieldSkeleton />
          <div className="h-12 w-full animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        </CardSkeleton>
      </div>
    </ContentShellSkeleton>
  );
}

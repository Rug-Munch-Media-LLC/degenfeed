import { ContentShellSkeleton, CardSkeleton, Line, Avatar } from '@/components/loading/PageSkeleton';

export default function PostLoading() {
  return (
    <ContentShellSkeleton>
      <div className="mx-auto max-w-2xl py-6">
        <CardSkeleton>
          <div className="flex items-center gap-3">
            <Avatar />
            <div className="flex-1 space-y-2">
              <Line width="w-32" height="h-4" />
              <Line width="w-20" height="h-3" />
            </div>
          </div>
          <Line width="w-full" height="h-4" />
          <Line width="w-full" height="h-4" />
          <Line width="w-3/4" height="h-4" />
          <Line width="w-1/2" height="h-3" />
          <div className="flex gap-4 pt-2">
            <Line width="w-16" height="h-8" />
            <Line width="w-16" height="h-8" />
            <Line width="w-16" height="h-8" />
          </div>
        </CardSkeleton>
      </div>
    </ContentShellSkeleton>
  );
}

import { ContentShellSkeleton, GridSkeleton, HeaderSkeleton } from '@/components/loading/PageSkeleton';

export default function BooksLoading() {
  return (
    <ContentShellSkeleton>
      <HeaderSkeleton titleWidth="w-32" subtitleWidth="w-56" />
      <GridSkeleton cols="sm:grid-cols-2 lg:grid-cols-3" count={6} />
    </ContentShellSkeleton>
  );
}

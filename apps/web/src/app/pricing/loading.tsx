import { ContentShellSkeleton, GridSkeleton, HeaderSkeleton } from '@/components/loading/PageSkeleton';

export default function PricingLoading() {
  return (
    <ContentShellSkeleton>
      <HeaderSkeleton titleWidth="w-40" subtitleWidth="w-80" />
      <GridSkeleton cols="sm:grid-cols-2 lg:grid-cols-3" count={3} />
    </ContentShellSkeleton>
  );
}

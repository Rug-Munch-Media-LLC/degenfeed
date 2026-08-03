import {
  ContentShellSkeleton,
  GridSkeleton,
  HeaderSkeleton,
} from '@/components/loading/PageSkeleton';

export default function SocialLoading() {
  return (
    <ContentShellSkeleton>
      <HeaderSkeleton titleWidth="w-40" subtitleWidth="w-64" />
      <GridSkeleton cols="sm:grid-cols-2 lg:grid-cols-3" count={6} />
    </ContentShellSkeleton>
  );
}

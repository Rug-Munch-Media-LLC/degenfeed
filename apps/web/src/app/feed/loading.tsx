import { PostCardSkeleton } from '@degenfeed/ui';
import {
  ContentShellSkeleton,
  SidebarSkeleton,
} from '@/components/loading/PageSkeleton';

export default function FeedLoading() {
  return (
    <ContentShellSkeleton sidebar={<SidebarSkeleton />}>
      {/* Tabs skeleton */}
      <div
        className="mb-4 flex gap-4 border-b pb-3"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {['For You', 'Following', 'Everything'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Protocol pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'rss'].map((p) => (
          <div
            key={p}
            className="h-7 w-20 animate-pulse rounded-full"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
          />
        ))}
      </div>

      {/* Feed posts — uses PostCardSkeleton that matches PostCard layout exactly */}
      <PostCardSkeleton count={8} />
    </ContentShellSkeleton>
  );
}

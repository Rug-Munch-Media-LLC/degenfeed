import { ContentShellSkeleton, CardSkeleton, Line, RowSkeleton } from '@/components/loading/PageSkeleton';

export default function ConnectLoading() {
  return (
    <ContentShellSkeleton>
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        <div className="space-y-4">
          {['Nostr', 'Farcaster', 'Bluesky', 'Mastodon', 'Lens'].map((p) => (
            <CardSkeleton key={p}>
              <div className="flex items-center justify-between">
                <Line width="w-24" height="h-5" />
                <Line width="w-20" height="h-8" />
              </div>
              <Line width="w-3/4" height="h-3" />
            </CardSkeleton>
          ))}
        </div>
      </div>
    </ContentShellSkeleton>
  );
}

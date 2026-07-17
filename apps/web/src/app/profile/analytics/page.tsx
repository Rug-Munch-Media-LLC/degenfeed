import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';

const AnalyticsDashboard = nextDynamic(
  () => import('./AnalyticsDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64 rounded-lg bg-gray-800" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl bg-gray-800" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-xl bg-gray-800" />
        </div>
      </div>
    ),
  },
);

export const metadata: Metadata = {
  title: 'Creator Analytics — DegenFeed',
  description:
    'Cross-protocol creator analytics: reach, tips, followers, and top-performing content across Nostr, Farcaster, Lens, Bluesky, and Mastodon.',
};

export const dynamic = 'force-dynamic';

export default function CreatorAnalyticsPage() {
  return <AnalyticsDashboard />;
}

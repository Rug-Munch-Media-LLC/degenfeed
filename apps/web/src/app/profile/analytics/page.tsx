import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';

const AnalyticsDashboard = nextDynamic(
  () => import('./AnalyticsDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64 rounded-lg bg-[var(--color-muted)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl bg-[var(--color-muted)]" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-xl bg-[var(--color-muted)]" />
        </div>
      </div>
    ),
  },
);

export const metadata: Metadata = {
  title: 'Creator Analytics — DegenFeed',
  description:
    'Cross-protocol creator analytics: reach, tips, followers, and top-performing content across Nostr, Farcaster, Lens, Bluesky, and Mastodon.',
  openGraph: {
    title: 'Creator Analytics — DegenFeed',
    description:
      'Cross-protocol creator analytics for reach, tips, followers, and top content.',
    url: 'https://app.degenfeed.xyz/profile/analytics',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Creator Analytics',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Analytics — DegenFeed',
    description: 'Cross-protocol creator analytics.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/profile/analytics' },
};

export const dynamic = 'force-dynamic';

export default function CreatorAnalyticsPage() {
  return <AnalyticsDashboard />;
}

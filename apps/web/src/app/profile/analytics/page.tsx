import type { Metadata } from 'next';
import AnalyticsDashboardClient from './AnalyticsDashboardClient';

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
  return <AnalyticsDashboardClient />;
}

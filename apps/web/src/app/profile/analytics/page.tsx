import type { Metadata } from 'next';
import AnalyticsDashboard from './AnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Creator Analytics — DegenFeed',
  description:
    'Cross-protocol creator analytics: reach, tips, followers, and top-performing content across Nostr, Farcaster, Lens, Bluesky, and Mastodon.',
};

export const dynamic = 'force-dynamic';

export default function CreatorAnalyticsPage() {
  return <AnalyticsDashboard />;
}

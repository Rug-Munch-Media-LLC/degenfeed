import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard — DegenFeed',
  description:
    'Top content, creators, and communities across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. Ranked by engagement, tips, and reach.',
  openGraph: {
    title: 'Leaderboard — DegenFeed',
    description: 'Top content and creators across the open social web.',
    url: 'https://app.degenfeed.xyz/leaderboard',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Leaderboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leaderboard — DegenFeed',
    description: 'Top content and creators across the open social web.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/leaderboard' },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}

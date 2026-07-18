import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Creator Studio — DegenFeed',
  description:
    'Your unified creator dashboard: scheduling, analytics, monetization, and cross-protocol publishing across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
  openGraph: {
    title: 'Creator Studio — DegenFeed',
    description: 'Cross-protocol creator dashboard for scheduling, analytics, and monetization.',
    url: 'https://app.degenfeed.xyz/creator',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Creator Studio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Studio — DegenFeed',
    description: 'Cross-protocol creator dashboard for scheduling, analytics, and monetization.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/creator' },
};

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

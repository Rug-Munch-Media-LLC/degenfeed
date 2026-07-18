import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Launch Your Community',
  description:
    'Spin up your own self-hosted Lemmy, PeerTube, or Mastodon instance. DegenFeed handles federation and discovery.',
  openGraph: {
    title: 'Launch Your Community — DegenFeed',
    description: 'Spin up self-hosted Lemmy, PeerTube, or Mastodon instances with DegenFeed.',
    url: 'https://app.degenfeed.xyz/deploy',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Launch Your Community',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Launch Your Community — DegenFeed',
    description: 'Spin up self-hosted Lemmy, PeerTube, or Mastodon instances.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/deploy' },
};

export default function DeployLayout({ children }: { children: React.ReactNode }) {
  return children;
}

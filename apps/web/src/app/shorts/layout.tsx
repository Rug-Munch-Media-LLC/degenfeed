import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shorts — DegenFeed',
  description:
    'Full-screen vertical short-form video feed. Swipe through crypto, web3, and degen short videos with TikTok-style navigation.',
  openGraph: {
    title: 'Shorts — DegenFeed',
    description:
      'Full-screen vertical short-form crypto video feed. Swipe through web3 shorts.',
    url: 'https://app.degenfeed.xyz/shorts',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Shorts',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shorts — DegenFeed',
    description: 'Full-screen vertical short-form crypto video feed.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/shorts' },
};

export default function ShortsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

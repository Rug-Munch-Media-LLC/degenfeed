import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Digest — DegenFeed',
  description:
    'Daily and weekly digests of the best web3 social content. Curated summaries of trending posts, top discussions, and key stories across all protocols.',
  openGraph: {
    title: 'Digest — DegenFeed',
    description: 'Curated digests of the best web3 social content.',
    url: 'https://app.degenfeed.xyz/digest',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Digest',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Digest — DegenFeed',
    description: 'Curated digests of the best web3 social content.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/digest' },
};

export default function DigestLayout({ children }: { children: React.ReactNode }) {
  return children;
}

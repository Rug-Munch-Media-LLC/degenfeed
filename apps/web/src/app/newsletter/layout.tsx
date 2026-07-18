import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsletter',
  description:
    'Subscribe to the DegenFeed daily digest. Curated web3, crypto, and AI news from 8 protocols delivered to your inbox.',
  openGraph: {
    title: 'Newsletter — DegenFeed',
    description: 'Daily digest of curated web3, crypto, and AI news from 8 protocols.',
    url: 'https://app.degenfeed.xyz/newsletter',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Newsletter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Newsletter — DegenFeed',
    description: 'Daily digest of curated web3, crypto, and AI news from 8 protocols.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/newsletter' },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

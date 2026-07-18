import type { Metadata } from 'next';
import { FAQClient } from './faq-client';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'FAQ — DegenFeed',
  description:
    'Frequently asked questions about DegenFeed — accounts, protocols, cross-posting, tipping, communities, self-hosting, and more.',
  alternates: { canonical: 'https://app.degenfeed.xyz/faq' },
  openGraph: {
    title: 'FAQ — DegenFeed',
    description:
      'Answers to the most common questions about the open-source multi-protocol web3 social aggregator.',
    url: 'https://app.degenfeed.xyz/faq',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed FAQ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ — DegenFeed',
    description: 'Frequently asked questions about DegenFeed.',
  },
};

export default function FAQPage() {
  return <FAQClient />;
}

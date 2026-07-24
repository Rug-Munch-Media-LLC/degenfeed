import type { Metadata } from 'next';
import { PricingPageContent } from './pricing-content';

export const metadata: Metadata = {
  title: 'Pricing — DegenFeed | Free, Creator, Pro & Enterprise Plans',
  description:
    'Start free forever. Creator ($4.99/mo): coins, analytics, subscriptions. Pro ($9.99/mo): unlimited protocols, cross-publishing, API. Enterprise ($29.99/mo): self-host, white-label, custom domain.',
  keywords: [
    'degenfeed pricing',
    'web3 social platform cost',
    'creator subscription',
    'cross platform posting price',
    'creator coin pricing',
    'decentralized social premium',
    'social media aggregator pricing',
    'self-host social media',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz/pricing' },
  openGraph: {
    title: 'DegenFeed Pricing — Free Forever or From $4.99/mo',
    description:
      'Free to browse all protocols. Creator $4.99/mo. Pro $9.99/mo. Enterprise $29.99/mo. No platform fees on tips.',
    url: 'https://app.degenfeed.xyz/pricing',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Pricing Plans',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed Pricing — Free Forever or From $4.99/mo',
    description:
      'Free to browse. Creator $4.99/mo. Pro $9.99/mo. Enterprise $29.99/mo. 14-day free trial. Own your social network.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

export default function PricingPage() {
  return <PricingPageContent />;
}

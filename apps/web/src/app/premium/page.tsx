import type { Metadata } from 'next';
import { PremiumContent } from './premium-content';

export const metadata: Metadata = {
  title: 'Pricing & Premium — DegenFeed Web3 Social Platform',
  description:
    'Free to browse. Premium ($10/mo) unlocks cross-protocol posting, creator coins, livestreaming, and priority support. Creator ($25/mo) adds analytics, custom domains, scheduling, and API access. No platform fees on tips. 14-day free trial.',
  keywords: [
    'degenfeed premium pricing',
    'web3 social platform cost',
    'creator subscription crypto',
    'cross platform posting price',
    'creator coin deployment cost',
    'decentralized social premium',
    'social media aggregator pricing',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz/premium' },
  openGraph: {
    title: 'DegenFeed Premium — Free & Paid Plans for Web3 Social',
    description:
      'Free to browse all protocols. Premium ($10/mo): cross-post, creator coins, livestreaming. Creator ($25/mo): analytics, scheduling, API. No platform fees.',
    url: 'https://app.degenfeed.xyz/premium',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Premium Plans — free and paid web3 social platform tiers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed Premium — Free Forever or $10/mo for Creators',
    description:
      'Free to browse. Premium from $10/mo. No platform fees. 14-day free trial. Own your social network.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

export default function PremiumPage() {
  return <PremiumContent />;
}

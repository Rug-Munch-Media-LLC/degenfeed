import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DegenFeed Premium — Cross-Platform Registration, Advanced Analytics',
  description:
    'Unlock cross-platform posting, advanced filtering, custom feeds, noise reduction, analytics, and more. Pro $10/mo, Creator $25/mo, Enterprise $50/mo.',
  keywords: [
    'DegenFeed Premium',
    'cross-platform registration',
    'Farcaster registration',
    'Bluesky invite codes',
    'analytics',
    'social media aggregator',
    'pro plan',
    'creator tools',
  ],
  openGraph: {
    title: 'DegenFeed Premium — Cross-Platform Registration, Advanced Analytics',
    description:
      'First month $10 for Pro. Unlock cross-platform posting, advanced analytics, and creator monetization.',
    url: 'https://app.degenfeed.xyz/premium',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Premium Plans',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed Premium — Cross-Platform Registration, Advanced Analytics',
    description:
      'First month $10 for Pro. Unlock cross-platform posting, advanced analytics, and creator monetization.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/premium' },
};

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Premium',
  description:
    'Unlock advanced filtering, custom feeds, noise reduction, analytics, and cross-posting. $5/mo Pro, $15/mo Creator.',
  openGraph: {
    title: 'Premium — DegenFeed',
    description: 'Unlock Pro ($5/mo) or Creator ($15/mo) for advanced DegenFeed features.',
    url: 'https://app.degenfeed.xyz/premium',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Premium',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Premium — DegenFeed',
    description: 'Unlock Pro ($5/mo) or Creator ($15/mo) for advanced DegenFeed features.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/premium' },
};

export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Funding',
  description:
    'Track crypto funding rounds, VC raises, and investment news across the web3 ecosystem.',
  openGraph: {
    title: 'Funding — DegenFeed',
    description: 'Crypto funding rounds, VC raises, and investment news across web3.',
    url: 'https://app.degenfeed.xyz/home/funding',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Funding',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Funding — DegenFeed',
    description: 'Crypto funding rounds, VC raises, and investment news across web3.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/home/funding' },
};

export default function FundingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

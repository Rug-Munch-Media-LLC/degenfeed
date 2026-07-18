import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your DegenFeed profile, connected wallets, and social accounts.',
  openGraph: {
    title: 'Profile — DegenFeed',
    description: 'Manage your DegenFeed profile and connected social accounts.',
    url: 'https://app.degenfeed.xyz/profile',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Profile',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Profile — DegenFeed',
    description: 'Manage your DegenFeed profile and connected social accounts.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/profile' },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

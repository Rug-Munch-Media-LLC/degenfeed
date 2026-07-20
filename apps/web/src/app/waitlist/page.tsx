import type { Metadata } from 'next';
import { WaitlistForm } from './waitlist-form';

export const metadata: Metadata = {
  title: 'Join the Waitlist — DegenFeed Web3 Social Media Platform',
  description:
    'Be the first to access the most comprehensive web3 social media platform. Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon & more. Cross-post, tip in crypto, launch creator coins. Join 1,200+ creators on the waitlist.',
  keywords: [
    'join web3 social platform waitlist',
    'decentralized social media early access',
    'creator coin platform waitlist',
    'nostr farcaster aggregator beta',
    'web3 social network sign up',
    'crypto social media early access',
    'fediverse cross-platform waitlist',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz/waitlist' },
  openGraph: {
    title: 'Join the DegenFeed Waitlist — Early Access to Web3 Social Superapp',
    description:
      'Be first to access cross-protocol posting, creator coins, live streaming, and cross-chain tipping. Join 1,200+ creators on the waitlist.',
    url: 'https://app.degenfeed.xyz/waitlist',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Join the DegenFeed waitlist for early access to web3 social media',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join the DegenFeed Waitlist — Web3 Social Early Access',
    description:
      'Be first to access the web3 social superapp. Cross-post, creator coins, tipping, livestreaming. 1,200+ creators waiting.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function WaitlistPage() {
  return <WaitlistForm />;
}

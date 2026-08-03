import type { Metadata } from 'next';
import Script from 'next/script';
import { YouTubeFeed } from '../../../components/feed/YouTubeFeed';

const youtubeBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'YouTube',
      item: 'https://app.degenfeed.xyz/feed/youtube',
    },
  ],
};

export const metadata: Metadata = {
  title: 'YouTube Feed — Crypto, Tech & AI Videos | DegenFeed',
  description:
    'Top crypto, tech & AI videos from Coin Bureau, Bankless, Finematics, Fireship, Two Minute Papers, AI Explained and 15+ channels — with embedded players.',
  keywords: ['youtube feed', 'crypto youtube', 'tech videos', 'ai videos', 'video feed'],
  openGraph: {
    title: 'YouTube Feed — DegenFeed',
    description: 'Top crypto, tech & AI videos aggregated in one feed, with embedded players.',
    url: 'https://app.degenfeed.xyz/feed/youtube',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/youtube' },
};

export default function YouTubeFeedPage() {
  return (
    <>
      <Script id="breadcrumb-youtube-feed" type="application/ld+json">
        {JSON.stringify(youtubeBreadcrumb)}
      </Script>
      <YouTubeFeed />
    </>
  );
}

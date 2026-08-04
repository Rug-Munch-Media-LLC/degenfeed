import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const loopsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Loops',
      item: 'https://app.degenfeed.xyz/feed/loops',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Loops Feed — Short-Form Videos | DegenFeed',
  description:
    'Browse Loops short-form videos from loops.degenfeed.xyz. ActivityPub-federated TikTok alternative aggregated in your DegenFeed timeline.',
  keywords: [
    'loops feed',
    'loops videos',
    'short-form video',
    'decentralized video',
    'tiktok alternative',
  ],
  openGraph: {
    title: 'Loops Feed — DegenFeed',
    description: 'Short-form loop videos from loops.degenfeed.xyz.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/loops' },
};

export default function LoopsFeedPage() {
  return (
    <>
      <Script id="breadcrumb-loops-feed" type="application/ld+json">
        {JSON.stringify(loopsBreadcrumb)}
      </Script>
      <ProtocolFeed source="loops" />
    </>
  );
}

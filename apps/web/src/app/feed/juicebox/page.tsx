import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const juiceboxBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Juicebox',
      item: 'https://app.degenfeed.xyz/feed/juicebox',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Juicebox DAO Funding Feed — Crypto Projects | DegenFeed',
  description: 'Browse Juicebox DAO fundraising projects and programmable funding activity.',
  keywords: [
    'juicebox feed',
    'dao funding',
    'crypto fundraising',
    'project treasury',
    'ethereum funding',
  ],
  openGraph: {
    title: 'Juicebox DAO Funding Feed — DegenFeed',
    description: 'DAO fundraising projects from Juicebox aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/juicebox',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/juicebox' },
};

export default function JuiceboxFeedPage() {
  return (
    <>
      <Script id="breadcrumb-juicebox-feed" type="application/ld+json">
        {JSON.stringify(juiceboxBreadcrumb)}
      </Script>
      <ProtocolFeed source="juicebox" />
    </>
  );
}

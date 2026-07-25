import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const pixelfedBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Pixelfed',
      item: 'https://app.degenfeed.xyz/feed/pixelfed',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Pixelfed Feed — Decentralized Photos | DegenFeed',
  description:
    'Browse Pixelfed photos and image sharing from the fediverse. Decentralized Instagram alternative on ActivityPub.',
  keywords: ['pixelfed feed', 'pixelfed photos', 'decentralized images', 'fediverse photos'],
  openGraph: {
    title: 'Pixelfed Feed — DegenFeed',
    description: 'Pixelfed images and photos from across the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/pixelfed' },
};

export default function PixelfedFeedPage() {
  return (
    <>
      <Script id="breadcrumb-pixelfed-feed" type="application/ld+json">
        {JSON.stringify(pixelfedBreadcrumb)}
      </Script>
      <ProtocolFeed source="pixelfed" />
    </>
  );
}

import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const imagesBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Images',
      item: 'https://app.degenfeed.xyz/feed/images',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Image Feed — Pixelfed & Photo Sharing | DegenFeed',
  description:
    'Browse photos and images from Pixelfed and Bluesky. Decentralized image sharing on the fediverse and AT Protocol.',
  keywords: ['pixelfed feed', 'fediverse photos', 'decentralized images', 'bluesky images'],
  openGraph: {
    title: 'Image Feed — DegenFeed',
    description: 'Photos and images from Pixelfed and the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/images' },
};

export default function ImagesFeedPage() {
  return (
    <>
      <Script id="breadcrumb-images-feed" type="application/ld+json">
        {JSON.stringify(imagesBreadcrumb)}
      </Script>
      <ProtocolFeed source="pixelfed" />
    </>
  );
}

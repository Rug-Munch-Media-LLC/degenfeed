import type { Metadata } from 'next';
import Script from 'next/script';
import { MediaFeed } from '../../../components/media/MediaFeed';

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
  title: 'Image Feed — Photos & NFTs | DegenFeed',
  description:
    'Browse photos, NFTs, and images from Pixelfed, Bluesky, Zora, Nostr, and more. Pinterest-style masonry grid with lightbox viewer.',
  keywords: [
    'pixelfed feed',
    'fediverse photos',
    'decentralized images',
    'bluesky images',
    'zora nfts',
    'nostr images',
  ],
  openGraph: {
    title: 'Image Feed — DegenFeed',
    description: 'Photos, NFTs, and images from every protocol.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/images' },
};

export default function ImagesFeedPage() {
  return (
    <>
      <Script id="breadcrumb-images-feed" type="application/ld+json">
        {JSON.stringify(imagesBreadcrumb)}
      </Script>
      <MediaFeed defaultFilter="images" hideHeader={false} />
    </>
  );
}

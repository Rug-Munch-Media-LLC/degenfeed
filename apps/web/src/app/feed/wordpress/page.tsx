import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'WordPress + ActivityPub',
      item: 'https://app.degenfeed.xyz/feed/wordpress',
    },
  ],
};

export const metadata: Metadata = {
  title: 'WordPress — Blog Posts with ActivityPub | DegenFeed',
  description: 'Blog posts from WordPress sites using the ActivityPub federation plugin.',
  keywords: ['wordpress feed', 'decentralized social', 'fediverse', 'wordpress'],
  openGraph: {
    title: 'WordPress + ActivityPub — DegenFeed',
    description: 'Blog posts from WordPress sites using the ActivityPub federation plugin.',
    url: 'https://app.degenfeed.xyz/feed/wordpress',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/wordpress' },
};

export default function WordpressFeedPage() {
  return (
    <>
      <Script id="breadcrumb-wordpress-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="wordpress" />
    </>
  );
}

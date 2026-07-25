import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const microblogBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Micro.blog',
      item: 'https://app.degenfeed.xyz/feed/microblog',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Micro.blog Feed — Decentralized Content | DegenFeed',
  description: 'Browse Micro.blog content aggregated in your DegenFeed timeline.',
  keywords: ['microblog feed', 'microblog content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Micro.blog Feed — DegenFeed',
    description: 'Micro.blog content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/microblog',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/microblog' },
};

export default function Micro.blogFeedPage() {
  return (
    <>
      <Script id="breadcrumb-microblog-feed" type="application/ld+json">
        {JSON.stringify(microblogBreadcrumb)}
      </Script>
      <ProtocolFeed source="microblog" />
    </>
  );
}

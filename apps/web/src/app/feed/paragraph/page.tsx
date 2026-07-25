import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const paragraphBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Paragraph',
      item: 'https://app.degenfeed.xyz/feed/paragraph',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Paragraph Feed — Web3 Publishing | DegenFeed',
  description:
    'Browse Paragraph articles — web3 newsletters, writer coins, and decentralized publishing aggregated in your DegenFeed timeline.',
  keywords: ['paragraph feed', 'paragraph content', 'web3 publishing', 'newsletter'],
  openGraph: {
    title: 'Paragraph Feed — DegenFeed',
    description: 'Paragraph newsletters and articles aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/paragraph',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/paragraph' },
};

export default function ParagraphFeedPage() {
  return (
    <>
      <Script id="breadcrumb-paragraph-feed" type="application/ld+json">
        {JSON.stringify(paragraphBreadcrumb)}
      </Script>
      <ProtocolFeed source="paragraph" />
    </>
  );
}

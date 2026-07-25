import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const githubBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'GitHub',
      item: 'https://app.degenfeed.xyz/feed/github',
    },
  ],
};

export const metadata: Metadata = {
  title: 'GitHub Feed — Decentralized Content | DegenFeed',
  description: 'Browse GitHub content aggregated in your DegenFeed timeline.',
  keywords: ['github feed', 'github content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'GitHub Feed — DegenFeed',
    description: 'GitHub content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/github',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/github' },
};

export default function GitHubFeedPage() {
  return (
    <>
      <Script id="breadcrumb-github-feed" type="application/ld+json">
        {JSON.stringify(githubBreadcrumb)}
      </Script>
      <ProtocolFeed source="github" />
    </>
  );
}

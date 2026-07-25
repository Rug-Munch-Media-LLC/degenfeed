import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const discordBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Discord',
      item: 'https://app.degenfeed.xyz/feed/discord',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Discord Feed — Decentralized Content | DegenFeed',
  description: 'Browse Discord content aggregated in your DegenFeed timeline.',
  keywords: ['discord feed', 'discord content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Discord Feed — DegenFeed',
    description: 'Discord content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/discord',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/discord' },
};

export default function DiscordFeedPage() {
  return (
    <>
      <Script id="breadcrumb-discord-feed" type="application/ld+json">
        {JSON.stringify(discordBreadcrumb)}
      </Script>
      <ProtocolFeed source="discord" />
    </>
  );
}

import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const telegramBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Telegram',
      item: 'https://app.degenfeed.xyz/feed/telegram',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Telegram Feed — Decentralized Content | DegenFeed',
  description: 'Browse Telegram content aggregated in your DegenFeed timeline.',
  keywords: ['telegram feed', 'telegram content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Telegram Feed — DegenFeed',
    description: 'Telegram content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/telegram',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/telegram' },
};

export default function TelegramFeedPage() {
  return (
    <>
      <Script id="breadcrumb-telegram-feed" type="application/ld+json">
        {JSON.stringify(telegramBreadcrumb)}
      </Script>
      <ProtocolFeed source="telegram" />
    </>
  );
}

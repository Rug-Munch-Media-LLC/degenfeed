import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const unlockBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Unlock Protocol',
      item: 'https://app.degenfeed.xyz/feed/unlock',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Unlock Protocol Feed — Token-Gated Memberships | DegenFeed',
  description: 'Browse Unlock Protocol membership NFTs, locks and token-gated content activity.',
  keywords: [
    'unlock protocol feed',
    'token-gated content',
    'membership nft',
    'nft locks',
    'creator monetization',
  ],
  openGraph: {
    title: 'Unlock Protocol Feed — DegenFeed',
    description: 'Token-gated membership content from Unlock Protocol aggregated in your timeline.',
    url: 'https://app.degenfeed.xyz/feed/unlock',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/unlock' },
};

export default function UnlockFeedPage() {
  return (
    <>
      <Script id="breadcrumb-unlock-feed" type="application/ld+json">
        {JSON.stringify(unlockBreadcrumb)}
      </Script>
      <ProtocolFeed source="unlock" />
    </>
  );
}

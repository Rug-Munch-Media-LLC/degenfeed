import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

const lensBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Lens Feed', item: 'https://app.degenfeed.xyz/lens' },
  ],
};

export const metadata: Metadata = {
  title: 'Lens Protocol Feed — Browse Publications & Mirrors | DegenFeed',
  description:
    'Browse the Lens Protocol timeline — publications, mirrors, and collects from the decentralized social graph on Polygon. Lens feed with cross-post to Nostr, Farcaster, Bluesky. The best Lens web app.',
  keywords: [
    'lens protocol feed',
    'lens web app',
    'lens publications',
    'lens protocol social',
    'lens polygon social',
    'decentralized social graph',
  ],
  openGraph: {
    title: 'Lens Protocol Feed — Browse Publications & Mirrors | DegenFeed',
    description:
      'Browse Lens Protocol publications, mirrors, and collects from the decentralized social graph on Polygon. Cross-post to Nostr, Farcaster. Best Lens web app.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/lens' },
};

export default function LensPage() {
  return (
    <>
      <Script id="breadcrumb-lens" type="application/ld+json">
        {JSON.stringify(lensBreadcrumb)}
      </Script>
      <ProtocolFeedPage protocol="lens" />
    </>
  );
}

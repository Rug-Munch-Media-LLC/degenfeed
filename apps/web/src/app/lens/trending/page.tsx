import type { Metadata } from 'next';
import Script from 'next/script';
import { PerPlatformTrending } from '../../../components/PerPlatformTrending';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Lens', item: 'https://app.degenfeed.xyz/lens' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Lens Trending',
      item: 'https://app.degenfeed.xyz/lens/trending',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Lens Trending — Trending Publications, Profiles & Topics',
  description:
    'Trending Lens Protocol publications, profiles, and topics ranked by engagement velocity. See what the Lens ecosystem is talking about right now.',
  keywords: [
    'lens trending',
    'trending publications',
    'lens protocol trending',
    'trending topics lens',
    'lens social trending',
  ],
  openGraph: {
    title: 'Lens Trending — Trending Publications, Profiles & Topics | DegenFeed',
    description:
      'Trending Lens Protocol publications, profiles, and topics ranked by engagement velocity.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/lens/trending' },
};

export default function LensTrendingPage() {
  return (
    <>
      <Script id="breadcrumb-lens-trending" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <PerPlatformTrending protocol="lens" />
    </>
  );
}

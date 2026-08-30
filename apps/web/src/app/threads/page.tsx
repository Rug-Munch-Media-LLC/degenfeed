import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../components/feed/ProtocolFeed';

const threadsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Threads Feed',
      item: 'https://app.degenfeed.xyz/threads',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Threads Feed — Browse Threads Posts & Trending Topics | DegenFeed',
  description:
    'Browse the Threads timeline — posts, trending topics, and creator content from Meta’s microblogging network. Threads feed with cross-post to Nostr, Farcaster, Lens, Bluesky. The best Threads web reader.',
  keywords: [
    'threads feed',
    'threads web reader',
    'threads posts',
    'meta threads',
    'fediverse threads',
    'threads aggregator',
  ],
  openGraph: {
    title: 'Threads Feed — Browse Posts & Trending Topics | DegenFeed',
    description:
      'Browse Threads posts, trending topics, and creator content. Cross-post to Nostr, Farcaster, Lens, Bluesky. The best Threads web reader.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/threads' },
};

export default function ThreadsPage() {
  return (
    <>
      <Script id="breadcrumb-threads" type="application/ld+json">
        {JSON.stringify(threadsBreadcrumb)}
      </Script>
      <ProtocolFeed source="threads" />
    </>
  );
}

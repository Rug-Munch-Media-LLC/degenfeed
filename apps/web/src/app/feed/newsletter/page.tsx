import type { Metadata } from 'next';
import Script from 'next/script';
import { NewsletterFeed } from '../../../components/feed/NewsletterFeed';

const newsletterBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Newsletters',
      item: 'https://app.degenfeed.xyz/feed/newsletter',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Newsletters — Curated Crypto & Web3 Reads | DegenFeed',
  description:
    'Curated crypto and web3 newsletters aggregated from Substack, Medium, Mirror, Paragraph, and Ghost. Bankless, The Defiant, Messari, Delphi Digital, Not Boring, Milk Road, and more in one feed.',
  keywords: [
    'crypto newsletter',
    'web3 newsletter',
    'substack',
    'bankless',
    'the defiant',
    'messari',
    'delphi digital',
    'milk road',
    'newsletter aggregator',
  ],
  openGraph: {
    title: 'Newsletters — DegenFeed',
    description: 'Curated crypto & web3 newsletters from 5 publishing platforms in one feed.',
    url: 'https://app.degenfeed.xyz/feed/newsletter',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Newsletters — DegenFeed',
    description: 'Curated crypto & web3 newsletters from 5 publishing platforms in one feed.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/newsletter' },
};

export default function NewsletterFeedPage() {
  return (
    <>
      <Script id="breadcrumb-newsletter-feed" type="application/ld+json">
        {JSON.stringify(newsletterBreadcrumb)}
      </Script>
      <NewsletterFeed />
    </>
  );
}

import type { Metadata } from 'next';
import Script from 'next/script';

const shortsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Shorts', item: 'https://app.degenfeed.xyz/shorts' },
  ],
};

export const metadata: Metadata = {
  title: 'Shorts — Crypto Short Videos & Web3 Vertical Feed',
  description:
    'Full-screen vertical short-form crypto video feed. Swipe through web3, blockchain, and degen short videos with TikTok-style navigation. The best crypto short video platform.',
  keywords: [
    'crypto shorts', 'web3 short videos', 'crypto tiktok alternative',
    'blockchain short form content', 'crypto video feed', 'web3 vertical video',
  ],
  openGraph: {
    title: 'Shorts — Crypto Short Videos & Web3 Vertical Feed | DegenFeed',
    description:
      'Full-screen vertical short-form crypto video feed. Swipe through web3 shorts.',
    url: 'https://app.degenfeed.xyz/shorts',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed shorts — crypto short videos and web3 vertical feed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shorts — Crypto Short Videos | DegenFeed',
    description:
      'Full-screen vertical short-form crypto video feed. Swipe through web3 shorts.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/shorts' },
};

export default function ShortsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-shorts" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(shortsBreadcrumb) }} />
      {children}
    </>
  );
}

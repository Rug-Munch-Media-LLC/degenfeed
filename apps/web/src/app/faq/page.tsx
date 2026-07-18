import type { Metadata } from 'next';
import Script from 'next/script';
import { FAQClient } from './faq-client';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'FAQ — Web3 Social Media Questions Answered | DegenFeed',
  description:
    'Frequently asked questions about DegenFeed — the web3 social media platform. Learn about cross-protocol posting, crypto tipping, Nostr, Farcaster, Lens, Bluesky, communities, self-hosting, and more.',
  keywords: [
    'web3 social media faq', 'decentralized social network questions',
    'crypto tipping how to', 'nostr vs farcaster', 'what is web3 social',
    'cross protocol posting guide', 'decentralized twitter alternative faq',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz/faq' },
  openGraph: {
    title: 'FAQ — Web3 Social Media Questions Answered | DegenFeed',
    description:
      'Learn about cross-protocol posting, crypto tipping, Nostr, Farcaster, Lens, Bluesky, and self-hosting.',
    url: 'https://app.degenfeed.xyz/faq',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed FAQ — web3 social media questions answered',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ — Web3 Social Media Q&A | DegenFeed',
    description:
      'Frequently asked questions about cross-protocol posting, crypto tipping, and web3 social.',
  },
};

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is DegenFeed?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DegenFeed is an open-source, multi-protocol social aggregator for web3. It pulls posts from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified, ranked timeline. No account needed to browse. Connect a wallet to post, tip, and engage across protocols.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is DegenFeed different from Twitter/X?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DegenFeed is not a walled garden. It reads from 10+ open protocols and lets you post to multiple networks simultaneously. There are no ads, no algorithm manipulation, no data selling. The ranking algorithm is transparent, open source (AGPL-3.0), and self-hostable.',
      },
    },
    {
      '@type': 'Question',
      name: 'What protocols does DegenFeed support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nostr, Farcaster (casts via Hub API), Lens (profiles via GraphQL v2), Bluesky (AT Protocol), Mastodon/ActivityPub, Threads (read-only), Reddit (RSS + JSON API), RSS/Atom (550+ sources), and Lemmy (federated communities).',
      },
    },
    {
      '@type': 'Question',
      name: 'How does cross-protocol posting work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The DegenFeed composer lets you select which protocols to publish to simultaneously. Content is sent to each protocol using its native API — Nostr via signed events, Farcaster via protobuf, Lens via typed data, Bluesky via XRPC, Mastodon via REST API. Cross-posting requires connecting at least one protocol account.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does crypto tipping work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Tap the tip button on any post to send ETH, SOL, or USDC directly to the creator\'s wallet. DegenFeed uses on-chain transactions with zero platform fees. For Nostr posts, Lightning Network zaps are supported via LNURL. To receive tips, connect a wallet with your account.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is DegenFeed free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Browsing the feed is completely free and requires no account. Premium ($5/mo) adds advanced filtering, custom feeds, noise reduction, and priority support. Creator ($15/mo) unlocks analytics, cross-posting analytics, post scheduling, and API access.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I use DegenFeed without a wallet?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. You can browse all feeds, read posts, watch videos, and read news without any wallet. You only need a wallet to sign in for posting, tipping, and account features. DegenFeed supports Solana wallets (Phantom, Backpack, Solflare) and EVM wallets (MetaMask, Rainbow, WalletConnect).',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I self-host DegenFeed?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. DegenFeed is AGPL-3.0 licensed and designed for easy self-hosting. Clone the repo, run pnpm install && pnpm dev, and you\'re running your own instance. The recommended deployment is Cloudflare Pages + Workers (free-tier eligible). Full documentation is available.',
      },
    },
  ],
};

export default function FAQPage() {
  return (
    <>
      <Script
        id="faq-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <FAQClient />
    </>
  );
}

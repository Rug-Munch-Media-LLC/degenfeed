import type { Metadata } from 'next';
import Script from 'next/script';
import { FAQClient } from './faq-client';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'FAQ — DegenFeed Web3 Social Universe Questions Answered',
  description:
    'Everything you need to know about DegenFeed — the Web3 Social Universe. What makes it web3, how cross-posting works, creator coins, self-hosting, data ownership, and how to get started on 25+ decentralized social protocols.',
  keywords: [
    'web3 social media faq',
    'decentralized social network questions',
    'how does degenfeed work',
    'what makes it web3',
    'nostr vs farcaster vs bluesky',
    'what is web3 social',
    'cross protocol posting guide',
    'decentralized twitter alternative faq',
    'creator coins explained',
    'self host social media',
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
        text: 'DegenFeed is an open-source, multi-protocol social aggregator for web3. It pulls posts from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified, ranked timeline. No account needed to browse. Connect a wallet to post, tip, and engage across protocols. Creators can launch their own coins, livestream to multiple platforms, and earn tips in crypto.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is DegenFeed different from Twitter/X?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DegenFeed is not a walled garden. It reads from 15+ open protocols and lets you post to multiple networks simultaneously. There are no ads, no algorithm manipulation, no data selling. The ranking algorithm is transparent, open source (AGPL-3.0), and self-hostable. Creators can launch tokens, earn tips across chains, and stream live — none of which is possible on traditional social media.',
      },
    },
    {
      '@type': 'Question',
      name: 'What protocols does DegenFeed support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nostr, Farcaster (casts via Hub API), Lens (profiles via GraphQL v2), Bluesky (AT Protocol), Mastodon/ActivityPub, Threads (read-only), Reddit (RSS + JSON API), RSS/Atom (353+ sources), YouTube, PeerTube, Lemmy, Discord, Matrix, GitHub, Telegram, and Substack/Ghost.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does cross-protocol posting work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The DegenFeed composer lets you select which protocols to publish to simultaneously. Content is sent to each protocol using its native API — Nostr via signed events, Farcaster via protobuf, Lens via typed data, Bluesky via XRPC, Mastodon via REST API. Each post gets a canonical DegenFeed ID so engagement (likes, replies) can be aggregated across protocols. Cross-posting requires connecting at least one protocol account.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does crypto tipping work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Tap the tip button on any post to send ETH, SOL, or USDC directly to the creator's wallet. DegenFeed uses on-chain transactions with zero platform fees. For Nostr posts, Lightning Network zaps are supported via LNURL. Tips support batch tipping (up to 50 recipients), streaming payments (pay-per-minute during livestreams), and cross-chain bridging via Wormhole. To receive tips, connect a wallet with your account.",
      },
    },
    {
      '@type': 'Question',
      name: 'What are Creator Coins?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Creator Coins are personalized tokens (ERC-20 on Base or SPL on Solana) that creators deploy to build their own economy. Each coin uses a sigmoid bonding curve with 5 pricing eras and built-in anti-exploit protection including per-wallet caps, cooldowns, and bundle detection. Creators configure revenue splits, vesting schedules, and supply caps. Liquidity is locked via smart contract.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is DegenFeed free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Browsing the feed is completely free and requires no account. Premium ($10/mo) adds cross-platform posting, Feddy Communities, creator coins, livestreaming, and priority support. Creator ($25/mo) unlocks advanced analytics, custom domains, post scheduling, and API access. All subscriptions fund development and infrastructure.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I be deplatformed?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. DegenFeed is built on open protocols — Nostr, Farcaster, Bluesky, Lens, and Mastodon. Your identity lives on these protocols, not on DegenFeed. Even if the hosted instance goes offline, your accounts remain independently accessible. You can self-host the entire DegenFeed stack on your own infrastructure, ensuring no single entity can ever silence you.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I own my data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Social protocol credentials are encrypted in your browser and never sent to our servers. Your posts are published to open protocols where you control the keys. Export all your data at any time via /api/account/export in JSON or CSV. If you self-host, you have full database access. DegenFeed never sells or monetizes your data.',
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
        text: "Yes. DegenFeed is AGPL-3.0 licensed and designed for easy self-hosting. Clone the repo, run pnpm install && pnpm dev, and you're running your own instance. The recommended deployment is Cloudflare Pages + Workers (free-tier eligible). Full documentation is available at /docs including environment variables and deployment guides.",
      },
    },
    {
      '@type': 'Question',
      name: 'What are Feddy Communities?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Feddy Communities are cross-protocol communities that span Nostr, Farcaster, Lens, Bluesky, and Mastodon. A member on Nostr can interact with a member on Farcaster in the same community. Communities support token gating (restrict access based on token/NFT ownership across EVM and Solana), on-chain governance with quadratic voting, and cross-protocol moderation tools.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I go live / start streaming?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Navigate to the Live page and click "Go Live". Connect OBS using the provided RTMP stream key. Your stream is broadcast via PeerTube and simultaneously announced on Nostr, Farcaster, Bluesky, Mastodon, and Telegram. Choose between solo streams, collaborative broadcasts, Spaces-style audio rooms, or coin launch events with live minting.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the ranking algorithm work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every post is scored on a 7-factor model: Recency (24%, 12-hour half-life), Engagement (35%, weighted log-scale), Relevance (18%), Quality (14%, author reputation), Diversity (10%), Source (8%), and Velocity (12%). Posts under 15 minutes get a 2x freshness boost. You can use ?sort=new for chronological order. The algorithm is fully open source.',
      },
    },
  ],
};

export default function FAQPage() {
  return (
    <>
      <Script id="faq-structured-data" type="application/ld+json">
        {JSON.stringify(faqStructuredData)}
      </Script>
      <FAQClient />
    </>
  );
}

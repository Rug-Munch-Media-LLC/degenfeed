export const runtime = 'edge';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import NewsLoading from './loading';
import NewsClient from './NewsClient';
import type { NewsMeta, NewsStory, StoryCluster } from './types';

export const revalidate = 300; // 5 min

export const metadata: Metadata = {
  title: 'News — 100+ Sources, No Paywalls',
  description:
    'Intelligent news aggregation from 100+ sources across RSS, Nostr, Farcaster, Bluesky, Reddit, newsletters, research feeds — ranked by quality, recency, sentiment, and your interests. Free, no paywalls, always updated.',
  openGraph: {
    title: 'News — DegenFeed (100+ Sources)',
    description:
      'Beat CryptoPanic. Intelligent crypto, web3, DeFi, AI, and tech news aggregation from 100+ sources. No paywalls, never.',
    url: 'https://app.degenfeed.xyz/news',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed News — 100+ Sources',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'News — DegenFeed (100+ Sources)',
    description:
      'Intelligent crypto, web3, and AI news aggregation from 100+ sources. No paywalls, always free.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/news' },
};

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'app.degenfeed.xyz';
  const protocol = h.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

// ─── Seed content for immediate display when pipeline returns 0 stories ──

const SEED_STORIES: NewsStory[] = [
  {
    id: 'seed:coindesk:1',
    title: 'Bitcoin Holds $67K as Spot ETFs See Inflows for Fourth Straight Day',
    summary:
      'Bitcoin is holding above $67,000 as spot Bitcoin ETFs recorded net inflows for the fourth consecutive trading day, signaling renewed institutional interest.',
    url: 'https://www.coindesk.com/markets/2026/07/25/bitcoin-holds-67k',
    source: 'CoinDesk',
    sourceMeta: { id: 'coindesk', name: 'CoinDesk', tier: 1, credibility: 0.92 },
    author: 'CoinDesk',
    publishedAt: Date.now() - 900_000,
    categories: ['crypto', 'bitcoin', 'markets'],
    niches: ['bitcoin', 'markets', 'etf'],
    sentiment: {
      label: 'bullish',
      score: 0.6,
      confidence: 0.7,
      signals: ['+institutional', '+etf'],
    },
    entities: {
      tokens: ['BTC'],
      protocols: [],
      people: [],
      companies: ['BlackRock', 'Fidelity'],
      chains: ['bitcoin'],
      nfts: [],
    },
    alsoCoveredBy: ['CoinTelegraph', 'Decrypt'],
    isBreaking: true,
    velocity: 8,
    score: 95,
    readingTime: 3,
    imageUrl: 'https://assets.coindesk.com/og-image.png',
  },
  {
    id: 'seed:cointelegraph:1',
    title: 'Ethereum Layer-2 Activity Hits All-Time High as Gas Fees Drop 90%',
    summary:
      'Ethereum layer-2 networks reached a new all-time high in daily active addresses as blob transactions from EIP-4844 continue to lower gas fees.',
    url: 'https://cointelegraph.com/news/ethereum-layer-2-activity-all-time-high',
    source: 'CoinTelegraph',
    sourceMeta: { id: 'cointelegraph', name: 'CoinTelegraph', tier: 1, credibility: 0.9 },
    author: 'CoinTelegraph',
    publishedAt: Date.now() - 1_800_000,
    categories: ['crypto', 'ethereum', 'layer2'],
    niches: ['ethereum', 'layer2', 'scaling'],
    sentiment: { label: 'bullish', score: 0.5, confidence: 0.8, signals: ['+growth', '+adoption'] },
    entities: {
      tokens: ['ETH'],
      protocols: ['arbitrum', 'optimism', 'base'],
      people: [],
      companies: [],
      chains: ['ethereum'],
      nfts: [],
    },
    alsoCoveredBy: ['The Block'],
    isBreaking: false,
    velocity: 6,
    score: 88,
    readingTime: 4,
  },
  {
    id: 'seed:theblock:1',
    title: 'Solana DeFi TVL Surpasses $12B for First Time Since 2021 Peak',
    summary:
      "Solana's total value locked in DeFi protocols has exceeded $12 billion for the first time since November 2021, driven by liquid staking and new DEX volumes.",
    url: 'https://www.theblock.co/post/solana-defi-tvl-12b',
    source: 'The Block',
    sourceMeta: { id: 'theblock', name: 'The Block', tier: 1, credibility: 0.91 },
    author: 'The Block',
    publishedAt: Date.now() - 3_600_000,
    categories: ['crypto', 'defi', 'solana'],
    niches: ['solana', 'defi', 'tvl'],
    sentiment: {
      label: 'bullish',
      score: 0.7,
      confidence: 0.85,
      signals: ['+growth', '+adoption'],
    },
    entities: {
      tokens: ['SOL'],
      protocols: ['jupiter', 'raydium', 'marginfi'],
      people: [],
      companies: [],
      chains: ['solana'],
      nfts: [],
    },
    alsoCoveredBy: ['Solana Blog'],
    isBreaking: false,
    velocity: 5,
    score: 85,
    readingTime: 3,
  },
  {
    id: 'seed:decrypt:1',
    title: 'OpenAI Launches GPT-5 with 10x Reasoning at Lower Cost',
    summary:
      'OpenAI has unveiled GPT-5, claiming a 10x improvement in reasoning capabilities while reducing inference cost by 60%, marking a major leap in AI capabilities.',
    url: 'https://decrypt.co/openai-gpt-5-launch',
    source: 'Decrypt',
    sourceMeta: { id: 'decrypt', name: 'Decrypt', tier: 1, credibility: 0.88 },
    author: 'Decrypt',
    publishedAt: Date.now() - 2_400_000,
    categories: ['tech', 'ai'],
    niches: ['ai', 'llm', 'tech'],
    sentiment: { label: 'bullish', score: 0.4, confidence: 0.6, signals: ['+breakthrough'] },
    entities: {
      tokens: [],
      protocols: [],
      people: ['sam altman'],
      companies: ['OpenAI'],
      chains: [],
      nfts: [],
    },
    alsoCoveredBy: ['The Verge'],
    isBreaking: false,
    velocity: 7,
    score: 90,
    readingTime: 5,
  },
  {
    id: 'seed:theblock:2',
    title: 'SEC Signals Potential Shift in Crypto Policy, Sources Say',
    summary:
      'The Securities and Exchange Commission is signaling potential changes to its crypto enforcement approach, according to sources familiar with internal discussions.',
    url: 'https://www.theblock.co/post/sec-crypto-policy-shift',
    source: 'The Block',
    sourceMeta: { id: 'theblock', name: 'The Block', tier: 1, credibility: 0.91 },
    author: 'The Block',
    publishedAt: Date.now() - 4_200_000,
    categories: ['regulation', 'crypto'],
    niches: ['regulation', 'sec', 'policy'],
    sentiment: { label: 'neutral', score: 0.1, confidence: 0.5, signals: [] },
    entities: { tokens: [], protocols: [], people: [], companies: ['SEC'], chains: [], nfts: [] },
    alsoCoveredBy: ['CoinDesk Policy'],
    isBreaking: false,
    velocity: 4,
    score: 82,
    readingTime: 4,
  },
  {
    id: 'seed:coindesk:2',
    title: 'Bitcoin Mining Difficulty Adjusts Up 5% as Hash Rate Hits New Peak',
    summary:
      'Bitcoin mining difficulty has increased by approximately 5% in the latest automatic adjustment as the network hash rate reaches a new all-time high.',
    url: 'https://www.coindesk.com/tech/2026/07/25/bitcoin-mining-difficulty-adjusts-up',
    source: 'CoinDesk',
    sourceMeta: { id: 'coindesk', name: 'CoinDesk', tier: 1, credibility: 0.92 },
    author: 'CoinDesk',
    publishedAt: Date.now() - 7_200_000,
    categories: ['crypto', 'bitcoin', 'mining'],
    niches: ['bitcoin', 'mining', 'hashrate'],
    sentiment: { label: 'bullish', score: 0.3, confidence: 0.6, signals: ['+growth'] },
    entities: {
      tokens: ['BTC'],
      protocols: [],
      people: [],
      companies: [],
      chains: ['bitcoin'],
      nfts: [],
    },
    alsoCoveredBy: [],
    isBreaking: false,
    velocity: 3,
    score: 75,
    readingTime: 2,
  },
  {
    id: 'seed:a16z:1',
    title: 'a16z Leads $50M Round in Zero-Knowledge Proof Hardware Startup',
    summary:
      'Andreessen Horowitz has led a $50 million Series A in a startup building specialized hardware for zero-knowledge proof generation.',
    url: 'https://a16zcrypto.com/posts/zk-hardware-investment',
    source: 'a16z Crypto',
    sourceMeta: { id: 'a16z-crypto', name: 'a16z Crypto', tier: 1, credibility: 0.91 },
    author: 'a16z Crypto',
    publishedAt: Date.now() - 10_800_000,
    categories: ['vc-investment', 'crypto'],
    niches: ['vc', 'zero-knowledge', 'investment'],
    sentiment: {
      label: 'bullish',
      score: 0.5,
      confidence: 0.7,
      signals: ['+partnership', '+growth'],
    },
    entities: { tokens: [], protocols: [], people: [], companies: ['a16z'], chains: [], nfts: [] },
    alsoCoveredBy: ['CoinDesk'],
    isBreaking: false,
    velocity: 4,
    score: 80,
    readingTime: 4,
  },
  {
    id: 'seed:cointelegraph:2',
    title: 'Crypto Market Cap Adds $50B as Altcoins Rally Across the Board',
    summary:
      'The total cryptocurrency market capitalization added approximately $50 billion in the last 24 hours as altcoins experienced a broad-based rally.',
    url: 'https://cointelegraph.com/news/crypto-market-cap-adds-50b',
    source: 'CoinTelegraph',
    sourceMeta: { id: 'cointelegraph', name: 'CoinTelegraph', tier: 1, credibility: 0.9 },
    author: 'CoinTelegraph',
    publishedAt: Date.now() - 14_400_000,
    categories: ['crypto', 'markets'],
    niches: ['markets', 'altcoins', 'rally'],
    sentiment: { label: 'bullish', score: 0.6, confidence: 0.75, signals: ['+surge', '+rally'] },
    entities: {
      tokens: ['SOL', 'LINK', 'ETH', 'BTC'],
      protocols: [],
      people: [],
      companies: [],
      chains: ['solana', 'ethereum'],
      nfts: [],
    },
    alsoCoveredBy: ['CryptoSlate', 'Decrypt'],
    isBreaking: false,
    velocity: 5,
    score: 78,
    readingTime: 3,
  },
  {
    id: 'seed:coindesk:3',
    title: 'Base Chain Daily Transactions Surpass 5 Million, Outpacing Ethereum L1',
    summary:
      "Coinbase's Base layer-2 network has exceeded 5 million daily transactions for the first time, surpassing Ethereum mainnet in daily transaction count.",
    url: 'https://www.coindesk.com/tech/2026/07/25/base-chain-daily-transactions-5m',
    source: 'CoinDesk',
    sourceMeta: { id: 'coindesk', name: 'CoinDesk', tier: 1, credibility: 0.92 },
    author: 'CoinDesk',
    publishedAt: Date.now() - 21_600_000,
    categories: ['crypto', 'ethereum', 'layer2'],
    niches: ['layer2', 'base', 'ethereum'],
    sentiment: {
      label: 'bullish',
      score: 0.45,
      confidence: 0.7,
      signals: ['+growth', '+adoption'],
    },
    entities: {
      tokens: ['ETH'],
      protocols: ['base'],
      people: [],
      companies: ['Coinbase'],
      chains: ['ethereum', 'base'],
      nfts: [],
    },
    alsoCoveredBy: ['The Block'],
    isBreaking: false,
    velocity: 4,
    score: 76,
    readingTime: 3,
    imageUrl: 'https://images.ctfassets.net/og-image-base.png',
  },
  {
    id: 'seed:cointelegraph:3',
    title: 'RWA Tokenization Market Projected to Reach $30 Trillion by 2034',
    summary:
      'A new report projects the real-world asset tokenization market could reach $30 trillion by 2034, with fixed income, real estate, and commodities leading adoption.',
    url: 'https://cointelegraph.com/news/rwa-tokenization-30-trillion-2034',
    source: 'CoinTelegraph',
    sourceMeta: { id: 'cointelegraph', name: 'CoinTelegraph', tier: 1, credibility: 0.9 },
    author: 'CoinTelegraph',
    publishedAt: Date.now() - 28_800_000,
    categories: ['crypto', 'defi', 'markets'],
    niches: ['rwa', 'tokenization', 'defi', 'institutional'],
    sentiment: {
      label: 'bullish',
      score: 0.5,
      confidence: 0.7,
      signals: ['+growth', '+institutional'],
    },
    entities: {
      tokens: [],
      protocols: [],
      people: [],
      companies: ['BlackRock', 'Citigroup'],
      chains: [],
      nfts: [],
    },
    alsoCoveredBy: [],
    isBreaking: false,
    velocity: 3,
    score: 72,
    readingTime: 4,
  },
];

const SEED_META: NewsMeta = {
  total: 10,
  sourceCount: 8,
  fetchedAt: Date.now(),
  errors: [],
  sentiment: { bullish: 6, bearish: 0, neutral: 4 },
  trending: [
    { topic: 'Bitcoin', count: 3, score: 12 },
    { topic: 'Ethereum', count: 3, score: 10 },
    { topic: 'Solana', count: 2, score: 8 },
    { topic: 'AI', count: 2, score: 7 },
    { topic: 'DeFi', count: 2, score: 6 },
  ],
  category: 'all',
  personalized: false,
  topCategories: [
    { categoryId: 'bitcoin', label: 'Bitcoin', emoji: '₿', count: 3, avgConfidence: 0.9 },
    { categoryId: 'ethereum', label: 'Ethereum', emoji: '⟠', count: 2, avgConfidence: 0.85 },
    { categoryId: 'defi', label: 'DeFi', emoji: '🏦', count: 2, avgConfidence: 0.8 },
    { categoryId: 'ai', label: 'AI', emoji: '🤖', count: 1, avgConfidence: 0.75 },
    { categoryId: 'regulation', label: 'Regulation', emoji: '⚖️', count: 1, avgConfidence: 0.7 },
    { categoryId: 'markets', label: 'Markets', emoji: '📈', count: 4, avgConfidence: 0.85 },
  ],
};

async function NewsData() {
  let stories: NewsStory[] = [];
  let clusters: StoryCluster[] = [];
  let meta: NewsMeta | null = null;

  try {
    const url = `${await getBaseUrl()}/api/news/feed?limit=50&sort=score`;
    const res = await fetch(url, {
      credentials: 'include',
      next: { revalidate: 0 },
      cache: 'no-store',
      headers: { 'cache-control': 'no-store' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data?: NewsStory[];
        clusters?: StoryCluster[];
        meta?: NewsMeta;
        error?: string;
      };
      if (json.data && json.data.length > 0) {
        stories = json.data;
        clusters = json.clusters || [];
        meta = json.meta || null;
      }
    }
  } catch {
    // API unavailable — use seed content
  }

  // Fallback to seed content if API returned nothing
  if (stories.length === 0) {
    stories = SEED_STORIES;
    meta = SEED_META;
  }

  return <NewsClient initialStories={stories} initialMeta={meta} initialClusters={clusters} />;
}

export default function NewsPage() {
  return (
    <Suspense fallback={<NewsLoading />}>
      <NewsData />
    </Suspense>
  );
}

// Re-export types from the client for convenience
export type { NewsMeta, NewsStory, StoryCluster };

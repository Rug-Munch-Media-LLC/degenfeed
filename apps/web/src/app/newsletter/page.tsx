'use client';

import { getProtocolColor } from '@degenfeed/ui';
import { useCallback, useMemo, useState } from 'react';
import { QuickTipButton } from '../../components/QuickTipButton';

// ── Newsletter Categories ───────────────────────────────────────────

const NEWSLETTER_CATEGORIES = [
  { id: 'crypto', label: 'Crypto', color: '#f7931a', icon: '₿' },
  { id: 'tech', label: 'Tech', color: '#3b82f6', icon: '⚙' },
  { id: 'ai', label: 'AI', color: '#a855f7', icon: '🤖' },
  { id: 'defi', label: 'DeFi', color: '#10b981', icon: '🏦' },
  { id: 'nft', label: 'NFT', color: '#ec4899', icon: '🖼' },
  { id: 'regulation', label: 'Regulation', color: '#f59e0b', icon: '⚖' },
  { id: 'macro', label: 'Macro', color: '#6366f1', icon: '📊' },
  { id: 'startups', label: 'Startups', color: '#14b8a6', icon: '🚀' },
  { id: 'science', label: 'Science', color: '#06b6d4', icon: '🔬' },
];

// ── Newsletter Entry Type ───────────────────────────────────────────

interface NewsletterEntry {
  name: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'irregular';
  isPaid?: boolean;
  premium?: boolean;
  description?: string;
}

// ── All Newsletters ─────────────────────────────────────────────────

const ALL_NEWSLETTERS: NewsletterEntry[] = [
  // ═══ CRYPTO ═══
  {
    name: 'CoinTelegraph Newsletter',
    schedule: 'daily',
    description: 'Top crypto news and analysis',
  },
  { name: 'CoinDesk Newsletter', schedule: 'daily', description: 'Leading crypto news source' },
  {
    name: 'The Block Newsletter',
    schedule: 'daily',
    description: 'Research-driven crypto coverage',
  },
  { name: 'Blockworks Daily', schedule: 'daily', description: 'Markets-focused crypto news' },
  { name: 'Bankless', schedule: 'daily', isPaid: true, description: 'Guide to crypto and DeFi' },
  { name: 'Milk Road', schedule: 'daily', description: 'Fun daily crypto digest' },
  { name: 'Token Dispatch', schedule: 'daily', description: 'Curated crypto token news' },
  {
    name: 'Messari Daily',
    schedule: 'daily',
    isPaid: true,
    description: 'Institutional crypto research',
  },
  { name: 'Delphi Daily', schedule: 'weekly', isPaid: true, description: 'Deep crypto research' },
  { name: 'The Scoop', schedule: 'daily', description: 'Crypto news and interviews' },
  { name: 'Empire', schedule: 'daily', description: 'Crypto market intelligence' },
  { name: 'The Tie', schedule: 'daily', description: 'Crypto data and research' },
  { name: 'Crypto Briefing', schedule: 'daily', description: 'Daily crypto news roundup' },
  { name: 'BeInCrypto', schedule: 'daily', description: 'Global crypto news coverage' },
  { name: '24/7 Crypto', schedule: 'daily', description: 'Round-the-clock crypto news' },
  { name: 'Crypto Native', schedule: 'weekly', description: 'Deep dives into crypto culture' },

  // ═══ TECH ═══
  { name: 'TLDR Tech', schedule: 'daily', description: 'Tech news in 5 minutes' },
  { name: 'The Hustle', schedule: 'daily', description: 'Business and tech news' },
  {
    name: 'Benedict Evans',
    schedule: 'weekly',
    premium: true,
    description: 'Tech strategy and analysis',
  },
  { name: 'Stratechery', schedule: 'daily', isPaid: true, description: 'Tech strategy deep dives' },
  {
    name: 'Platformer',
    schedule: 'weekly',
    premium: true,
    description: 'Social media and platform news',
  },
  { name: 'The Verge Newsletter', schedule: 'daily', description: 'Consumer tech and culture' },
  {
    name: 'Ars Technica Newsletter',
    schedule: 'daily',
    description: 'Deep tech and science coverage',
  },
  {
    name: 'Wired Newsletter',
    schedule: 'daily',
    isPaid: true,
    description: 'Tech, science, and culture',
  },
  { name: 'TechCrunch Daily', schedule: 'daily', description: 'Startup and tech news' },
  { name: 'Hacker Newsletter', schedule: 'weekly', description: 'Best of Hacker News curated' },
  {
    name: 'Not Boring',
    schedule: 'weekly',
    isPaid: true,
    description: 'Tech and business deep dives',
  },
  {
    name: 'Exponential View',
    schedule: 'weekly',
    isPaid: true,
    description: 'Tech and future trends',
  },

  // ═══ AI ═══
  {
    name: 'The Batch (Andrew Ng)',
    schedule: 'weekly',
    description: 'Weekly AI news from DeepLearning.AI',
  },
  { name: 'TLDR AI', schedule: 'weekly', description: 'Daily AI news in 5 minutes' },
  { name: 'Import AI', schedule: 'weekly', description: 'AI research and policy news' },
  { name: 'Supervised', schedule: 'weekly', isPaid: true, description: 'AI x Crypto research' },
  { name: 'The Algorithmic Bridge', schedule: 'weekly', description: 'AI philosophy and impact' },
  { name: 'AI Supremacy', schedule: 'weekly', description: 'AI industry analysis' },
  { name: 'Last Week in AI', schedule: 'weekly', description: 'Comprehensive AI weekly roundup' },
  { name: 'The Neuron', schedule: 'daily', description: 'Daily AI tools and trends' },
  { name: "Ben's Bites", schedule: 'daily', description: 'Daily AI digest' },
  {
    name: 'AI Tool Report',
    schedule: 'daily',
    premium: true,
    description: 'AI tools and productivity',
  },
  { name: 'TheSequence', schedule: 'weekly', description: 'ML and AI research explained' },

  // ═══ DEFI ═══
  { name: 'Week in Ethereum News', schedule: 'weekly', description: 'Ethereum ecosystem updates' },
  { name: 'The Daily Gwei', schedule: 'daily', description: 'Ethereum and L2 news' },
  { name: 'DeFi Times', schedule: 'daily', description: 'DeFi industry coverage' },
  { name: 'OurNetwork', schedule: 'weekly', isPaid: true, description: 'On-chain data deep dives' },
  { name: 'DeFi Weekly', schedule: 'weekly', description: 'Weekly DeFi roundup' },
  { name: 'Blockcrunch', schedule: 'weekly', description: 'DeFi research and analysis' },
  { name: 'DeFi Dad', schedule: 'weekly', description: 'DeFi yield and strategies' },
  { name: 'Route 2 FI', schedule: 'weekly', description: 'DeFi and financial independence' },
  {
    name: 'Ignas DeFi Research',
    schedule: 'weekly',
    isPaid: true,
    description: 'Deep DeFi research',
  },
  {
    name: 'Token Terminal',
    schedule: 'weekly',
    isPaid: true,
    description: 'Crypto fundamentals data',
  },
  { name: 'Dune Digest', schedule: 'weekly', description: 'On-chain analytics highlights' },
  { name: 'The Defiant', schedule: 'daily', description: 'DeFi news and alpha' },
  { name: 'The Drop', schedule: 'weekly', description: 'DeFi airdrops and opportunities' },
  { name: 'How to DeFi', schedule: 'weekly', description: 'DeFi education and guides' },
  { name: 'Proof of Work', schedule: 'daily', description: 'Crypto mining and infrastructure' },
  { name: 'The Rollup', schedule: 'weekly', description: 'Ethereum L2 ecosystem news' },

  // ═══ BITCOIN ═══
  {
    name: 'Bitcoin Magazine Pro',
    schedule: 'weekly',
    isPaid: true,
    description: 'Bitcoin market analysis',
  },
  { name: "Satoshi's Journal", schedule: 'weekly', description: 'Bitcoin culture and tech' },
  {
    name: 'The Bitcoin Layer',
    schedule: 'weekly',
    isPaid: true,
    description: 'Bitcoin macro analysis',
  },
  {
    name: 'Nik Bhatia',
    schedule: 'weekly',
    isPaid: true,
    description: 'Bitcoin and monetary policy',
  },
  { name: 'Pomp Letter', schedule: 'daily', description: 'Bitcoin and macro commentary' },
  { name: 'Pantera Blockchain', schedule: 'weekly', description: 'Blockchain investment insights' },
  { name: 'Ecoinometrics', schedule: 'weekly', description: 'Bitcoin on-chain metrics' },

  // ═══ TRADING / MARKETS ═══
  { name: 'MacroScope', schedule: 'daily', isPaid: true, description: 'Macro and crypto markets' },
  {
    name: 'The Transcript',
    schedule: 'daily',
    isPaid: true,
    description: 'Crypto market transcripts',
  },
  {
    name: 'Exec Sum',
    schedule: 'daily',
    isPaid: true,
    description: 'Daily market executive summary',
  },
  { name: 'The Market Ear', schedule: 'daily', description: 'Market sentiment and flows' },
  {
    name: 'Cane Island Digital',
    schedule: 'weekly',
    isPaid: true,
    description: 'Digital asset research',
  },
  { name: 'CoinMarketCap Blog', schedule: 'daily', description: 'Market data and insights' },
  { name: 'Kaito Research', schedule: 'daily', description: 'AI-powered crypto research' },

  // ═══ WEB3 BUILDERS ═══
  { name: 'Developer DAO', schedule: 'weekly', description: 'Web3 developer community' },
  {
    name: 'Web3 with a16z',
    schedule: 'weekly',
    isPaid: true,
    description: 'Web3 from a16z crypto',
  },
  {
    name: 'Li Jin (Variant)',
    schedule: 'weekly',
    isPaid: true,
    description: 'Web3 creator economy',
  },
  { name: 'Mirror Development', schedule: 'irregular', description: 'Web3 publishing on Mirror' },
  { name: 'Paragraph Blog', schedule: 'irregular', description: 'Web3 newsletter platform' },
  { name: 'Unchained', schedule: 'weekly', description: 'Crypto interviews and news' },
  { name: 'Chainlink Today', schedule: 'daily', description: 'Chainlink and oracle news' },
  { name: 'Solana Beach', schedule: 'weekly', description: 'Solana ecosystem updates' },
  { name: '0xResearch', schedule: 'daily', description: 'Crypto research newsletter' },
  {
    name: 'The Block Research',
    schedule: 'weekly',
    isPaid: true,
    description: 'Institutional crypto research',
  },
  {
    name: 'Reflexivity Research',
    schedule: 'weekly',
    isPaid: true,
    description: 'Macro crypto research',
  },
  {
    name: 'Messari Unqualified',
    schedule: 'weekly',
    isPaid: true,
    description: 'Crypto data analysis',
  },

  // ═══ AI x CRYPTO ═══
  {
    name: 'Supervised',
    schedule: 'weekly',
    isPaid: true,
    description: 'AI x Crypto at the frontier',
  },
  { name: 'The AI Report', schedule: 'weekly', description: 'AI and crypto intersection' },
  { name: 'TLDR AI', schedule: 'weekly', description: 'AI news for busy people' },
  { name: 'Import AI', schedule: 'weekly', description: 'AI research and policy' },
  { name: 'Last Week in AI', schedule: 'weekly', description: 'Weekly AI news roundup' },
  { name: 'AI Supremacy', schedule: 'weekly', description: 'AI industry and geopolitics' },
  { name: 'The Algorithmic Bridge', schedule: 'weekly', description: 'AI philosophy and society' },
];

// ── Newsletter Topics (groupings) ───────────────────────────────────

const NEWSLETTER_TOPICS = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'tech', label: 'Tech' },
  { id: 'ai', label: 'AI' },
  { id: 'defi', label: 'DeFi' },
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'trading-markets', label: 'Trading/Markets' },
  { id: 'web3-builders', label: 'Web3/Builders' },
  { id: 'startups', label: 'Startups' },
  { id: 'science', label: 'Science' },
];

const NEWSLETTERS_BY_TOPIC: Record<string, NewsletterEntry[]> = {
  crypto: [
    { name: 'CoinTelegraph Newsletter', schedule: 'daily' },
    { name: 'CoinDesk Newsletter', schedule: 'daily' },
    { name: 'The Block Newsletter', schedule: 'daily' },
    { name: 'Blockworks Daily', schedule: 'daily' },
    { name: 'Bankless', schedule: 'daily', isPaid: true },
    { name: 'Milk Road', schedule: 'daily' },
    { name: 'Token Dispatch', schedule: 'daily' },
    { name: 'Messari Daily', schedule: 'daily', isPaid: true },
    { name: 'Delphi Daily', schedule: 'weekly', isPaid: true },
    { name: 'The Scoop', schedule: 'daily' },
    { name: 'Empire', schedule: 'daily' },
    { name: 'The Tie', schedule: 'daily' },
    { name: 'Crypto Briefing', schedule: 'daily' },
    { name: 'BeInCrypto', schedule: 'daily' },
    { name: '24/7 Crypto', schedule: 'daily' },
    { name: 'Crypto Native', schedule: 'weekly' },
  ],
  tech: [
    { name: 'TLDR Tech', schedule: 'daily' },
    { name: 'The Hustle', schedule: 'daily' },
    { name: 'Benedict Evans', schedule: 'weekly', premium: true },
    { name: 'Stratechery', schedule: 'daily', isPaid: true },
    { name: 'Platformer', schedule: 'weekly', premium: true },
    { name: 'The Verge Newsletter', schedule: 'daily' },
    { name: 'Ars Technica Newsletter', schedule: 'daily' },
    { name: 'Wired Newsletter', schedule: 'daily', isPaid: true },
    { name: 'TechCrunch Daily', schedule: 'daily' },
    { name: 'Hacker Newsletter', schedule: 'weekly' },
    { name: 'Not Boring', schedule: 'weekly', isPaid: true },
    { name: 'Exponential View', schedule: 'weekly', isPaid: true },
  ],
  ai: [
    { name: 'The Batch (Andrew Ng)', schedule: 'weekly' },
    { name: 'TLDR AI', schedule: 'weekly' },
    { name: 'Import AI', schedule: 'weekly' },
    { name: 'Supervised', schedule: 'weekly', isPaid: true },
    { name: 'The Algorithmic Bridge', schedule: 'weekly' },
    { name: 'AI Supremacy', schedule: 'weekly' },
    { name: 'Last Week in AI', schedule: 'weekly' },
    { name: 'The Neuron', schedule: 'daily' },
    { name: "Ben's Bites", schedule: 'daily' },
    { name: 'AI Tool Report', schedule: 'daily', premium: true },
    { name: 'TheSequence', schedule: 'weekly' },
  ],
  defi: [
    { name: 'Week in Ethereum News', schedule: 'weekly' },
    { name: 'The Daily Gwei', schedule: 'daily' },
    { name: 'DeFi Times', schedule: 'daily' },
    { name: 'OurNetwork', schedule: 'weekly', isPaid: true },
    { name: 'DeFi Weekly', schedule: 'weekly' },
    { name: 'Blockcrunch', schedule: 'weekly' },
    { name: 'DeFi Dad', schedule: 'weekly' },
    { name: 'Route 2 FI', schedule: 'weekly' },
    { name: 'Ignas DeFi Research', schedule: 'weekly', isPaid: true },
    { name: 'Token Terminal', schedule: 'weekly', isPaid: true },
    { name: 'Dune Digest', schedule: 'weekly' },
    { name: 'The Defiant', schedule: 'daily' },
    { name: 'The Drop', schedule: 'weekly' },
    { name: 'How to DeFi', schedule: 'weekly' },
    { name: 'Proof of Work', schedule: 'daily' },
    { name: 'The Rollup', schedule: 'weekly' },
  ],
  bitcoin: [
    { name: 'Bitcoin Magazine Pro', schedule: 'weekly', isPaid: true },
    { name: "Satoshi's Journal", schedule: 'weekly' },
    { name: 'The Bitcoin Layer', schedule: 'weekly', isPaid: true },
    { name: 'Nik Bhatia', schedule: 'weekly', isPaid: true },
    { name: 'Pomp Letter', schedule: 'daily' },
    { name: 'Pantera Blockchain', schedule: 'weekly' },
    { name: 'Ecoinometrics', schedule: 'weekly' },
  ],
  'trading-markets': [
    { name: 'MacroScope', schedule: 'daily', isPaid: true },
    { name: 'The Transcript', schedule: 'daily', isPaid: true },
    { name: 'Exec Sum', schedule: 'daily', isPaid: true },
    { name: 'The Market Ear', schedule: 'daily' },
    { name: 'Cane Island Digital', schedule: 'weekly', isPaid: true },
    { name: 'CoinMarketCap Blog', schedule: 'daily' },
    { name: 'Kaito Research', schedule: 'daily' },
  ],
  'web3-builders': [
    { name: 'Developer DAO', schedule: 'weekly' },
    { name: 'Web3 with a16z', schedule: 'weekly', isPaid: true },
    { name: 'Li Jin (Variant)', schedule: 'weekly', isPaid: true },
    { name: 'Mirror Development', schedule: 'irregular' },
    { name: 'Paragraph Blog', schedule: 'irregular' },
    { name: 'Unchained', schedule: 'weekly' },
    { name: 'Chainlink Today', schedule: 'daily' },
    { name: 'Solana Beach', schedule: 'weekly' },
  ],
  startups: [
    { name: 'The Hustle', schedule: 'daily' },
    { name: 'TechCrunch Daily', schedule: 'daily' },
    { name: 'Not Boring', schedule: 'weekly', isPaid: true },
    { name: 'Exponential View', schedule: 'weekly', isPaid: true },
    { name: 'Hacker Newsletter', schedule: 'weekly' },
    { name: 'Benedict Evans', schedule: 'weekly', premium: true },
  ],
  science: [
    { name: 'Ars Technica Newsletter', schedule: 'daily' },
    { name: 'Wired Newsletter', schedule: 'daily', isPaid: true },
    { name: 'Nature Briefing', schedule: 'daily' },
    { name: 'New Scientist Newsletter', schedule: 'weekly', isPaid: true },
  ],
};

// ── "New Today" Counts ──────────────────────────────────────────────

function computeNewTodayStats(): { categoryCounts: Record<string, number>; totalDaily: number } {
  const daily = ALL_NEWSLETTERS.filter((n) => n.schedule === 'daily');
  const categoryCounts: Record<string, number> = {
    crypto: daily.filter((n) =>
      [
        'CoinTelegraph Newsletter',
        'CoinDesk Newsletter',
        'The Block Newsletter',
        'Blockworks Daily',
        'Bankless',
        'Milk Road',
        'Token Dispatch',
        'Messari Daily',
        'The Scoop',
        'Empire',
        'The Tie',
        'Crypto Briefing',
        'BeInCrypto',
        '24/7 Crypto',
        'Pomp Letter',
      ].includes(n.name),
    ).length,
    tech: daily.filter((n) =>
      [
        'TLDR Tech',
        'The Hustle',
        'Stratechery',
        'The Verge Newsletter',
        'Ars Technica Newsletter',
        'Wired Newsletter',
        'TechCrunch Daily',
      ].includes(n.name),
    ).length,
    ai: daily.filter((n) => ['The Neuron', "Ben's Bites", 'AI Tool Report'].includes(n.name))
      .length,
    defi: daily.filter((n) =>
      ['The Daily Gwei', 'DeFi Times', 'The Defiant', 'Proof of Work', 'The Drop'].includes(n.name),
    ).length,
  };
  return {
    categoryCounts,
    totalDaily: daily.length,
  };
}

// ── Trending Feed (simulated weekly top) ────────────────────────────

const TOP_NEWSLETTERS_THIS_WEEK = [
  { name: 'The Neuron', category: 'ai', reason: 'Daily AI tools & trends loved by 700K+' },
  { name: 'TLDR Tech', category: 'tech', reason: '5-minute tech roundup for busy pros' },
  { name: 'The Batch', category: 'ai', reason: "Andrew Ng's curated AI insights" },
  { name: 'Bankless', category: 'crypto', reason: '#1 crypto newsletter on Ethereum' },
  { name: 'Milk Road', category: 'crypto', reason: 'Fun daily crypto for normies' },
  { name: 'Stratechery', category: 'tech', reason: 'Deep tech strategy analysis' },
  { name: 'Last Week in AI', category: 'ai', reason: 'Comprehensive AI weekly roundup' },
  { name: 'Blockworks Daily', category: 'crypto', reason: 'Markets-first crypto news' },
  { name: 'The Hustle', category: 'startups', reason: 'Business and tech in your inbox' },
  { name: "Ben's Bites", category: 'ai', reason: 'Daily AI tools and news' },
];

const ALL_NICHES = [
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' },
  { id: 'defi', label: 'DeFi' },
  { id: 'ai', label: 'AI' },
  { id: 'security', label: 'Security' },
  { id: 'regulation', label: 'Regulation' },
  { id: 'macro', label: 'Macro' },
  { id: 'nft', label: 'NFTs' },
  { id: 'layer2', label: 'Layer 2' },
  { id: 'memecoin', label: 'Memes' },
  { id: 'stablecoin', label: 'Stablecoins' },
  { id: 'etf', label: 'ETFs' },
  { id: 'onchain', label: 'On-Chain' },
];

const ALL_PROTOCOLS = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'rss', label: 'RSS', color: '#ffa500' },
];

interface DigestItem {
  id: string;
  protocol: string;
  author: string;
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

interface DigestMeta {
  total: number;
  fetchedAt: number;
  niches: string[];
  protocols: string[];
  trending: Array<{ topic: string; count: number; score: number }>;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function protocolEmoji(p: string): string {
  const map: Record<string, string> = {
    nostr: '⚡',
    farcaster: '🟣',
    lens: '🌿',
    bluesky: '🦋',
    mastodon: '🐘',
    threads: '🧵 (experimental)',
    rss: '📡',
  };
  return map[p] ?? '●';
}

/** Count newsletters by category for stats display */
function getCategoryStats() {
  return NEWSLETTER_CATEGORIES.map((cat) => {
    let count = 0;
    switch (cat.id) {
      case 'crypto':
        count = NEWSLETTERS_BY_TOPIC.crypto.length;
        break;
      case 'tech':
        count = NEWSLETTERS_BY_TOPIC.tech.length;
        break;
      case 'ai':
        count = NEWSLETTERS_BY_TOPIC.ai.length;
        break;
      case 'defi':
        count = NEWSLETTERS_BY_TOPIC.defi.length;
        break;
      case 'nft':
        count = 2;
        break;
      case 'regulation':
        count = 3;
        break;
      case 'macro':
        count = 5;
        break;
      case 'startups':
        count = NEWSLETTERS_BY_TOPIC.startups.length;
        break;
      case 'science':
        count = NEWSLETTERS_BY_TOPIC.science.length;
        break;
      default:
        count = 0;
    }
    return { ...cat, count };
  });
}

function PaywallBadge({ isPaid, premium }: { isPaid?: boolean; premium?: boolean }) {
  if (!isPaid && !premium) return null;
  if (premium) {
    return (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-1.5 py-0.5 text-[9px] font-medium text-purple-400">
        <span className="text-[8px]">◈</span> Premium
      </span>
    );
  }
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
      <span className="text-[8px]">🔒</span> Paid
    </span>
  );
}

export default function NewsletterPage() {
  const [email, setEmail] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [digest, setDigest] = useState<DigestItem[]>([]);
  const [digestMeta, setDigestMeta] = useState<DigestMeta | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState('all');
  const [showAllNewsletters, setShowAllNewsletters] = useState(false);

  const newTodayStats = useMemo(() => computeNewTodayStats(), []);
  const categoryStats = useMemo(() => getCategoryStats(), []);

  const toggleNiche = (id: string) => {
    setSelectedNiches((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  };

  const toggleProtocol = (id: string) => {
    setSelectedProtocols((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSubscribe = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setStatus('error');
        setStatusMsg('Please enter a valid email address.');
        return;
      }
      setStatus('subscribing');
      try {
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            niches: selectedNiches,
            protocols: selectedProtocols.length > 0 ? selectedProtocols : undefined,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Subscription failed');
        setStatus('subscribed');
        setStatusMsg('You are subscribed! Check your inbox for the daily digest.');
      } catch (err) {
        setStatus('error');
        setStatusMsg(err instanceof Error ? err.message : 'Subscription failed');
      }
    },
    [email, selectedNiches, selectedProtocols],
  );

  const loadDigest = useCallback(async () => {
    setDigestLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedNiches.length > 0) params.set('niches', selectedNiches.join(','));
      if (selectedProtocols.length > 0) params.set('protocols', selectedProtocols.join(','));
      const res = await fetch(`/api/newsletter/digest?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      const data = (await res.json()) as { data?: DigestItem[]; meta?: DigestMeta };
      setDigest(data.data ?? []);
      setDigestMeta(data.meta ?? null);
    } catch {
      setDigest([]);
    } finally {
      setDigestLoading(false);
    }
  }, [selectedNiches, selectedProtocols]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500 to-emerald-600 text-2xl shadow-[0_0_24px_rgba(34,197,94,0.3)]">
          ◆
        </div>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-[var(--color-fg)]">
          DegenFeed Daily
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          The best of web3, AI, and tech — aggregated from Nostr, Farcaster, Lens, Bluesky,
          Mastodon, 353 RSS sources, and 85+ curated newsletters across crypto, tech, AI, DeFi, and
          more. Ranked by quality, recency, and diversity. Delivered to your inbox every morning.
        </p>

        {/* Stats bar */}
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          <span className="rounded-full bg-degen-500/10 px-3 py-1 text-[10px] font-medium text-degen-400">
            85+ Newsletters
          </span>
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-medium text-blue-400">
            {newTodayStats.totalDaily} New Daily
          </span>
          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-medium text-purple-400">
            9 Categories
          </span>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-400">
            353 RSS Sources
          </span>
        </div>
      </div>

      {/* Newsletter Discovery Section */}
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Newsletter Discovery</h2>
        </div>

        {/* New Today bar */}
        <div className="mb-4 rounded-xl border border-degen-500/10 bg-gradient-to-r from-degen-500/5 to-emerald-500/5 p-3">
          <p className="mb-2 text-xs font-semibold text-degen-400">
            📬 New today — {newTodayStats.totalDaily} newsletters published
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(newTodayStats.categoryCounts).map(([catId, count]) => {
              const cat = NEWSLETTER_CATEGORIES.find((c) => c.id === catId);
              if (!cat || count === 0) return null;
              return (
                <span
                  key={catId}
                  className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                >
                  {cat.icon} {cat.label}{' '}
                  <span className="font-medium text-[var(--color-muted)]">{count}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Top Newsletters This Week */}
        <div className="mb-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Top Newsletters This Week
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOP_NEWSLETTERS_THIS_WEEK.slice(0, 6).map((nl) => {
              const cat = NEWSLETTER_CATEGORIES.find((c) => c.id === nl.category);
              return (
                <div key={nl.name} className="card flex items-start gap-2.5 p-2.5">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px]"
                    style={{ backgroundColor: `${cat?.color}20` ?? '#1f2937' }}
                  >
                    {cat?.icon ?? '📰'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--color-fg)]">{nl.name}</p>
                    <p className="truncate text-[10px] text-[var(--color-muted)]">{nl.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Browse by Category */}
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Browse by Category
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {categoryStats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTopic(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                  activeTopic === cat.id
                    ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                    : 'card-hover text-[var(--color-muted)]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="text-gray-600">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Subscribe form */}
        <div className="lg:col-span-3">
          <div className="card border-degen-500/10 bg-gradient-to-br from-gray-900/90 to-gray-950/90 p-6">
            <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Subscribe</h2>
            <p className="mb-5 text-sm text-[var(--color-muted)]">
              Pick your topics and protocols, then enter your email.
            </p>

            <form onSubmit={handleSubscribe}>
              {/* Niche selection */}
              <div className="mb-5">
                <label
                  htmlFor="newsletter-topics"
                  className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Topics
                </label>
                <div id="newsletter-topics" className="flex flex-wrap gap-1.5">
                  {ALL_NICHES.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNiche(n.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedNiches.includes(n.id)
                          ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                          : 'card-hover text-[var(--color-muted)]'
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Protocol selection */}
              <div className="mb-5">
                <label
                  htmlFor="newsletter-sources"
                  className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Sources
                </label>
                <div id="newsletter-sources" className="flex flex-wrap gap-1.5">
                  {ALL_PROTOCOLS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProtocol(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedProtocols.includes(p.id)
                          ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                          : 'card-hover text-[var(--color-muted)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email input */}
              <div className="mb-4">
                <label
                  htmlFor="newsletter-email"
                  className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]"
                >
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                  disabled={status === 'subscribed'}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'subscribing' || status === 'subscribed'}
                className="btn-primary w-full"
              >
                {status === 'subscribing'
                  ? 'Subscribing...'
                  : status === 'subscribed'
                    ? 'Subscribed ✓'
                    : 'Subscribe'}
              </button>

              {status === 'error' && <p className="mt-2 text-xs text-red-400">{statusMsg}</p>}
              {status === 'subscribed' && (
                <p className="mt-2 text-xs text-degen-400">{statusMsg}</p>
              )}
            </form>
          </div>

          {/* Digest preview */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Preview Digest</h2>
              <button
                type="button"
                onClick={loadDigest}
                disabled={digestLoading}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
              >
                {digestLoading ? 'Loading...' : 'Load Preview'}
              </button>
            </div>

            {digest.length === 0 && !digestLoading && (
              <div className="card py-8 text-center">
                <p className="text-xs text-[var(--color-muted)]">
                  Select topics/sources above and click "Load Preview" to see what your daily digest
                  will look like.
                </p>
              </div>
            )}

            {digestLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card animate-pulse p-4">
                    <div className="mb-2 h-3 w-32 rounded bg-[var(--color-muted)]" />
                    <div className="mb-2 h-4 w-full rounded bg-[var(--color-muted)]" />
                    <div className="h-3 w-3/4 rounded bg-[var(--color-muted)]" />
                  </div>
                ))}
              </div>
            )}

            {digest.length > 0 && !digestLoading && (
              <div className="space-y-3">
                {digestMeta?.trending && digestMeta.trending.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {digestMeta.trending.slice(0, 6).map((t) => (
                      <span
                        key={t.topic}
                        className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                      >
                        #{t.topic} <span className="text-gray-600">{t.count}</span>
                      </span>
                    ))}
                  </div>
                )}
                {digest.slice(0, 5).map((item) => (
                  <div key={item.id} className="card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: getProtocolColor(item.protocol) }}
                      >
                        {protocolEmoji(item.protocol)} {item.protocol}
                      </span>
                      <span className="text-[10px] text-gray-600">{item.author}</span>
                      <span className="ml-auto text-[10px] text-gray-600">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-snug text-[var(--color-muted)] line-clamp-2">
                      {item.text}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        className="mt-1 inline-block text-[11px] text-degen-500 hover:underline"
                        rel="noopener"
                      >
                        Read more →
                      </a>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <QuickTipButton
                        recipientProtocol={item.protocol}
                        recipientAuthorId={item.author}
                        recipientDisplayName={item.author}
                        publicationId={item.id}
                        subtle
                      />
                    </div>
                  </div>
                ))}
                {digestMeta && (
                  <p className="text-center text-[10px] text-gray-600">
                    {digestMeta.total} stories · {new Date(digestMeta.fetchedAt).toUTCString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                What you get
              </h3>
              <ul className="space-y-2 text-xs text-[var(--color-muted)]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Top 15 stories from all protocols, ranked by quality</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Sentiment analysis and trending topics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>
                    Multi-protocol aggregation (Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Curated RSS feeds (353 sources across 11 categories)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>Curated newsletter content from 85+ top publications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>HTML and plaintext versions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">◆</span>
                  <span>One-click unsubscribe</span>
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Browse by Topic
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {NEWSLETTER_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTopic(t.id)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                      activeTopic === t.id
                        ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                        : 'card-hover text-[var(--color-muted)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Newsletter Sources
                {activeTopic !== 'all' && (
                  <span className="ml-1 text-degen-400">
                    — {NEWSLETTERS_BY_TOPIC[activeTopic]?.length ?? 0}
                  </span>
                )}
              </h3>
              <div className="space-y-3 text-xs">
                {(activeTopic === 'all'
                  ? Object.entries(NEWSLETTERS_BY_TOPIC)
                  : ([[activeTopic, NEWSLETTERS_BY_TOPIC[activeTopic] ?? []]] as [
                      string,
                      NewsletterEntry[],
                    ][])
                ).map(([topic, newsletters]) => (
                  <div key={topic}>
                    <p className="mb-1 font-medium text-[var(--color-muted)]">
                      {NEWSLETTER_TOPICS.find((t) => t.id === topic)?.label ?? topic}
                    </p>
                    <ul className="space-y-1 text-[var(--color-muted)]">
                      {newsletters
                        .slice(0, activeTopic === 'all' && !showAllNewsletters ? 5 : 99)
                        .map((nl) => (
                          <li key={nl.name}>
                            ✦ {nl.name}
                            <PaywallBadge isPaid={nl.isPaid} premium={nl.premium} />
                            <span className="text-gray-600"> ({nl.schedule})</span>
                          </li>
                        ))}
                      {activeTopic === 'all' && newsletters.length > 5 && !showAllNewsletters && (
                        <li>
                          <button
                            type="button"
                            onClick={() => setShowAllNewsletters(true)}
                            className="text-gray-600 italic hover:text-degen-400"
                          >
                            + {newsletters.length - 5} more...
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
                {activeTopic === 'all' && showAllNewsletters && (
                  <button
                    type="button"
                    onClick={() => setShowAllNewsletters(false)}
                    className="text-[10px] text-degen-500 hover:underline"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>

            {/* Trending section */}
            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Trending This Week
              </h3>
              <div className="space-y-2">
                {TOP_NEWSLETTERS_THIS_WEEK.slice(0, 5).map((nl, i) => (
                  <div key={nl.name} className="flex items-center gap-2">
                    <span className="w-4 text-[10px] font-bold text-gray-600">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-[var(--color-fg)]">
                        {nl.name}
                      </p>
                    </div>
                    <span
                      className="rounded px-1.5 py-0.5 text-[8px] font-medium uppercase"
                      style={{
                        backgroundColor:
                          `${NEWSLETTER_CATEGORIES.find((c) => c.id === nl.category)?.color}15` ??
                          '#1f2937',
                        color:
                          NEWSLETTER_CATEGORIES.find((c) => c.id === nl.category)?.color ??
                          '#9ca3af',
                      }}
                    >
                      {nl.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Paywall info */}
            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Content Access
              </h3>
              <div className="space-y-1.5 text-[10px] text-[var(--color-muted)]">
                <p>
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-400">
                    🔒 Paid
                  </span>{' '}
                  — Full content requires subscription. Preview shown in digest.
                </p>
                <p>
                  <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/10 px-1 py-0.5 text-[9px] font-medium text-purple-400">
                    ◈ Premium
                  </span>{' '}
                  — Some articles behind paywall. Free tier included in digest.
                </p>
                <p className="mt-2 text-gray-600">
                  The DegenFeed digest always shows free previews. Click through to subscribe to
                  paid newsletters directly.
                </p>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                RSS Feeds
              </h3>
              <ul className="space-y-2 text-xs text-[var(--color-muted)]">
                <li>
                  <a
                    href="/api/feed/rss.xml"
                    target="_blank"
                    className="text-degen-500 hover:underline"
                    rel="noopener"
                  >
                    Full Feed (RSS 2.0)
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?format=atom"
                    target="_blank"
                    className="text-degen-500 hover:underline"
                    rel="noopener"
                  >
                    Full Feed (Atom 1.0)
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?category=bitcoin"
                    target="_blank"
                    className="text-degen-500 hover:underline"
                    rel="noopener"
                  >
                    Bitcoin Feed
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?category=defi"
                    target="_blank"
                    className="text-degen-500 hover:underline"
                    rel="noopener"
                  >
                    DeFi Feed
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?category=ai"
                    target="_blank"
                    className="text-degen-500 hover:underline"
                    rel="noopener"
                  >
                    AI Feed
                  </a>
                </li>
                <li>
                  <a
                    href="/api/feed/rss.xml?category=tech"
                    target="_blank"
                    className="text-degen-500 hover:underline"
                    rel="noopener"
                  >
                    Tech Feed
                  </a>
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                API
              </h3>
              <ul className="space-y-1.5 text-xs text-[var(--color-muted)]">
                <li>
                  <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                    GET /api/newsletter/digest
                  </code>
                </li>
                <li>
                  <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                    GET /api/newsletter/digest?format=html
                  </code>
                </li>
                <li>
                  <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                    GET /api/newsletter/digest?format=text
                  </code>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

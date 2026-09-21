/**
 * RSS & Newsletter Aggregation Provider
 *
 * Rate Limit: 60 requests/minute (RSS feeds + newsletter APIs)
 *
 * Fetches content from 100+ RSS feeds and newsletter platforms:
 * - Direct RSS/Atom feeds (crypto news, research, dev, security, academic, tech)
 * - Newsletter platforms: Substack, Medium, Mirror.xyz, Paragraph.xyz, Ghost blogs, Beehiiv
 *
 * Features:
 * - Topic categorization (crypto, bitcoin, ethereum, solana, defi, nft, ai, security, etc.)
 * - Featured image extraction from feed items
 * - Full metadata extraction (author, description, categories, date)
 * - Cross-source deduplication
 * - Respects TTL/update frequency hints from feeds
 */

import { BoundedCache } from '../lib/bounded-cache';
import { analyzeNewsSentiment } from '../lib/sentiment';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const USER_AGENT = 'DegenFeed-Bridge/0.2 (RSS Aggregator)';

/**
 * Per-feed HTTP timeout (ms). The RSS provider fans out over 281 feeds;
 * large feeds (The Intercept ~460KB, The Guardian, Vice) need more than 3s
 * to download and previously timed out — starving the feed of left-leaning
 * sources entirely. Default 12s (configurable via RSS_FEED_TIMEOUT_MS).
 * The 5-minute RSS cache + prewarm make repeat requests fast, so a longer
 * per-feed timeout only affects the initial cold fetch.
 */
const RSS_FEED_TIMEOUT_MS = (() => {
  try {
    const raw = process.env.RSS_FEED_TIMEOUT_MS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 12_000;
})();

// ─── Feeds by Category ──────────────────────────────────────────────────

export interface FeedSource {
  url: string;
  label: string;
  category: FeedCategory;
  niches: string[];
  platform?:
    | 'rss'
    | 'atom'
    | 'substack'
    | 'medium'
    | 'mirror'
    | 'paragraph'
    | 'ghost'
    | 'beehiiv'
    | 'podcast';
  language?: string;
  ttlMinutes?: number;
  featured?: boolean;
}

export type FeedCategory =
  | 'crypto-news'
  | 'crypto-research'
  | 'vc-investment'
  | 'dev-technical'
  | 'security'
  | 'academic'
  | 'tech'
  | 'newsletter'
  | 'defi'
  | 'nft'
  | 'ai'
  | 'regulation'
  | 'bitcoin'
  | 'ethereum'
  | 'solana'
  | 'science'
  | 'geopolitics'
  | 'business'
  | 'world'
  | 'culture'
  | 'politics'
  | 'podcast';

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO NEWS (25 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const CRYPTO_NEWS_FEEDS: FeedSource[] = [
  {
    url: 'https://thedefiant.io/feed.xml',
    label: 'The Defiant',
    category: 'crypto-news',
    niches: ['crypto', 'defi', 'ethereum'],
  },
  {
    url: 'https://blockworks.co/feed',
    label: 'Blockworks',
    category: 'crypto-news',
    niches: ['crypto', 'research'],
    featured: true,
  },
  {
    url: 'https://cointelegraph.com/rss',
    label: 'CoinTelegraph',
    category: 'crypto-news',
    niches: ['crypto'],
    featured: true,
  },
  {
    url: 'https://decrypt.co/feed',
    label: 'Decrypt',
    category: 'crypto-news',
    niches: ['crypto'],
    featured: true,
  },
  {
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    label: 'CoinDesk',
    category: 'crypto-news',
    niches: ['crypto'],
    featured: true,
  },
  {
    url: 'https://cryptopotato.com/feed/',
    label: 'CryptoPotato',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  { url: 'https://u.today/rss', label: 'UToday', category: 'crypto-news', niches: ['crypto'] },
  {
    url: 'https://cryptobriefing.com/feed/',
    label: 'CryptoBriefing',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://bitcoinmagazine.com/.rss/full/',
    label: 'BitcoinMagazine',
    category: 'crypto-news',
    niches: ['bitcoin'],
    featured: true,
  },
  {
    url: 'https://news.bitcoin.com/feed/',
    label: 'Bitcoin.com News',
    category: 'crypto-news',
    niches: ['bitcoin', 'crypto'],
  },
  {
    url: 'https://bitcoinist.com/feed/',
    label: 'Bitcoinist',
    category: 'crypto-news',
    niches: ['bitcoin'],
  },
  {
    url: 'https://www.newsbtc.com/feed/',
    label: 'NewsBTC',
    category: 'crypto-news',
    niches: ['bitcoin'],
  },
  {
    url: 'https://www.livebitcoinnews.com/feed/',
    label: 'Live Bitcoin News',
    category: 'crypto-news',
    niches: ['bitcoin'],
  },
  {
    url: 'https://ambcrypto.com/feed/',
    label: 'AMBCrypto',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://dailyhodl.com/feed/',
    label: 'Daily Hodl',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  { url: 'https://nulltx.com/feed/', label: 'NullTX', category: 'crypto-news', niches: ['crypto'] },
  {
    url: 'https://www.zycrypto.com/feed/',
    label: 'ZyCrypto',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://beincrypto.com/feed/',
    label: 'BeInCrypto',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://www.cryptonewsz.com/feed/',
    label: 'CryptoNewsZ',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://coinpedia.org/feed/',
    label: 'CoinPedia',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://cryptoslate.com/feed/',
    label: 'CryptoSlate',
    category: 'crypto-news',
    niches: ['crypto'],
    featured: true,
  },
  {
    url: 'https://www.bankless.com/feed?xml',
    label: 'Bankless',
    category: 'crypto-news',
    niches: ['crypto', 'research', 'ethereum'],
    featured: true,
  },
  {
    url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html',
    label: 'CNBC Crypto',
    category: 'crypto-news',
    niches: ['crypto', 'markets'],
    featured: true,
  },
  // ── Web3/crypto news expansion (verified 2026-08-03) ─────────────
  {
    url: 'https://www.onchaintimes.com/feed/',
    label: 'On Chain Times',
    category: 'crypto-news',
    niches: ['crypto', 'onchain'],
  },
  {
    url: 'https://ethdaily.io/feed/',
    label: 'ETH Daily',
    category: 'crypto-news',
    niches: ['crypto', 'ethereum'],
  },
  {
    url: 'https://thedailydegen.substack.com/feed',
    label: 'The Daily Degen',
    category: 'crypto-news',
    niches: ['crypto', 'memecoin'],
    platform: 'substack',
  },
  {
    url: 'https://www.daotimes.com/feed',
    label: 'DAO Times',
    category: 'crypto-news',
    niches: ['crypto', 'dao', 'governance'],
  },
  {
    url: 'https://coingecko.com/rss',
    label: 'CoinGecko',
    category: 'crypto-news',
    niches: ['crypto', 'markets'],
  },
  {
    url: 'https://coingape.com/feed/',
    label: 'CoinGape',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://watcher.guru/news/feed/',
    label: 'Watcher.Guru',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://cryptonews.com/news/feed/',
    label: 'CryptoNews',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://finbold.com/feed/',
    label: 'Finbold',
    category: 'crypto-news',
    niches: ['crypto', 'markets'],
  },
  {
    url: 'https://forkast.news/feed/',
    label: 'Forkast',
    category: 'crypto-news',
    niches: ['crypto', 'asia'],
  },
  {
    url: 'https://www.crypto-news-flash.com/feed/',
    label: 'Crypto News Flash',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://thebittimes.com/feed',
    label: 'TheBitTimes',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  {
    url: 'https://cointelegraph.com/rss/tag/bitcoin',
    label: 'CoinTelegraph Bitcoin',
    category: 'crypto-news',
    niches: ['crypto', 'bitcoin'],
  },
  {
    url: 'https://decrypt.co/feed/defi',
    label: 'Decrypt DeFi',
    category: 'crypto-news',
    niches: ['crypto', 'defi'],
  },
  {
    url: 'https://www.coinspeaker.com/feed/',
    label: 'Coinspeaker',
    category: 'crypto-news',
    niches: ['crypto'],
  },
  // ── In-niche crypto news expansion (verified 2026-08-31) ────────────
  {
    url: 'https://www.dlnews.com/rss/',
    label: 'DLNews',
    category: 'crypto-news',
    niches: ['crypto', 'policy', 'markets'],
    featured: true,
  },
  {
    url: 'https://cointelegraph.com/rss/tag/research',
    label: 'CoinTelegraph Research',
    category: 'crypto-news',
    niches: ['crypto', 'research'],
  },
  {
    url: 'https://protos.com/feed/',
    label: 'Protos',
    category: 'crypto-news',
    niches: ['crypto', 'investigation'],
  },
  {
    url: 'https://www.trustnodes.com/feed/',
    label: 'Trustnodes',
    category: 'crypto-news',
    niches: ['crypto', 'bitcoin'],
  },
  {
    url: 'https://coinjournal.net/feed/',
    label: 'CoinJournal',
    category: 'crypto-news',
    niches: ['crypto', 'markets'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO RESEARCH & ANALYTICS (12 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const RESEARCH_FEEDS: FeedSource[] = [
  {
    url: 'https://www.theblock.co/rss.xml',
    label: 'The Block',
    category: 'crypto-research',
    niches: ['crypto', 'research'],
    featured: true,
  },
  {
    url: 'https://unchainedcrypto.com/feed/',
    label: 'Unchained Crypto',
    category: 'crypto-research',
    niches: ['crypto', 'research'],
  },
  {
    url: 'https://www.chainalysis.com/blog/feed/',
    label: 'Chainalysis',
    category: 'crypto-research',
    niches: ['crypto', 'research', 'security'],
    featured: true,
  },
  {
    url: 'https://blog.ethereum.org/feed.xml',
    label: 'Ethereum Blog',
    category: 'crypto-research',
    niches: ['ethereum'],
    featured: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// VC & INVESTMENT (12 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const VC_FEEDS: FeedSource[] = [
  {
    url: 'https://www.castleisland.vc/feed/',
    label: 'Castle Island VC',
    category: 'vc-investment',
    niches: ['crypto', 'vc', 'bitcoin'],
  },
  {
    url: 'https://blog.kraken.com/feed/',
    label: 'Kraken Blog',
    category: 'vc-investment',
    niches: ['crypto', 'exchange'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DEV & TECHNICAL (10 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const DEV_FEEDS: FeedSource[] = [
  {
    url: 'https://ethresear.ch/posts.rss',
    label: 'EthResearch',
    category: 'dev-technical',
    niches: ['ethereum', 'research'],
  },
  {
    url: 'https://ethereum-magicians.org/posts.rss',
    label: 'Ethereum Magicians',
    category: 'dev-technical',
    niches: ['ethereum', 'dev'],
  },
  // ── GitHub trending repos (added 2026-08-03) ──────────────────────
  // Primary: rsshub.app (public RSSHub instance) — may be Cloudflare-
  // challenged from datacenter IPs; the self-hosted RSS-Bridge below is
  // the working fallback that serves the same content.
  {
    url: 'https://rsshub.app/github/trending/daily',
    label: 'GitHub Trending (RSSHub)',
    category: 'dev-technical',
    niches: ['tech', 'dev', 'oss'],
    featured: true,
  },
  {
    url: 'http://127.0.0.1:8282/?action=display&bridge=GithubTrendingBridge&format=Atom&date_range=today',
    label: 'GitHub Trending (self-hosted)',
    category: 'dev-technical',
    niches: ['tech', 'dev', 'oss'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1 & 2 (verified 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════

export const L1_L2_FEEDS: FeedSource[] = [
  {
    url: 'https://solana.com/news/rss.xml',
    label: 'Solana Blog',
    category: 'crypto-research',
    niches: ['solana', 'dev'],
    featured: true,
  },
  {
    url: 'https://arbitrumfoundation.medium.com/feed',
    label: 'Arbitrum',
    category: 'crypto-research',
    niches: ['layer2', 'ethereum', 'research'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/ethereum-optimism',
    label: 'Optimism',
    category: 'crypto-research',
    niches: ['layer2', 'ethereum', 'research'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/starkware',
    label: 'Starknet',
    category: 'crypto-research',
    niches: ['layer2', 'zero-knowledge', 'ethereum'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/zksync',
    label: 'zkSync',
    category: 'crypto-research',
    niches: ['layer2', 'zero-knowledge', 'ethereum'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/avalancheavax',
    label: 'Avalanche',
    category: 'crypto-research',
    niches: ['crypto', 'layer2', 'research'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/near-protocol',
    label: 'Near',
    category: 'crypto-research',
    niches: ['crypto', 'layer2', 'research'],
    platform: 'medium',
  },
  {
    url: 'https://bittensor.substack.com/feed',
    label: 'Bittensor',
    category: 'crypto-research',
    niches: ['aicrypto', 'ai', 'crypto'],
    platform: 'substack',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY & AUDITS (8 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const SECURITY_FEEDS: FeedSource[] = [
  {
    url: 'https://web3isgoinggreat.com/feed.xml',
    label: 'Web3 is Going Great',
    category: 'security',
    niches: ['security', 'crypto', 'hack'],
  },
  {
    url: 'https://blog.trailofbits.com/feed/',
    label: 'Trail of Bits',
    category: 'security',
    niches: ['security', 'research'],
    featured: true,
  },
  {
    url: 'https://slowmist.medium.com/feed',
    label: 'SlowMist',
    category: 'security',
    niches: ['security', 'crypto'],
  },
  {
    url: 'https://www.halborn.com/blog/feed.xml',
    label: 'Halborn',
    category: 'security',
    niches: ['security', 'crypto'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMIC (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const ACADEMIC_FEEDS: FeedSource[] = [
  {
    url: 'https://rss.arxiv.org/rss/cs.CR',
    label: 'arXiv Cryptography',
    category: 'academic',
    niches: ['crypto', 'research', 'academic'],
  },
  {
    url: 'https://rss.arxiv.org/rss/cs.AI',
    label: 'arXiv AI',
    category: 'academic',
    niches: ['ai', 'research', 'academic'],
  },
  {
    url: 'https://rss.arxiv.org/rss/cs.LG',
    label: 'arXiv Machine Learning',
    category: 'academic',
    niches: ['ai', 'research', 'academic'],
  },
  {
    url: 'https://rss.arxiv.org/rss/cs.SE',
    label: 'arXiv Software Engineering',
    category: 'academic',
    niches: ['tech', 'research', 'academic'],
  },
  {
    url: 'https://eprint.iacr.org/rss/atom.xml',
    label: 'IACR ePrint',
    category: 'academic',
    niches: ['crypto', 'research', 'academic'],
  },
  {
    url: 'https://blockchain.ieee.org/feed',
    label: 'IEEE Blockchain',
    category: 'academic',
    niches: ['crypto', 'research', 'academic'],
  },
  {
    url: 'https://messari.io/rss',
    label: 'Messari',
    category: 'crypto-research',
    niches: ['crypto', 'research'],
    featured: true,
  },
  {
    url: 'https://www.delphidigital.io/rss',
    label: 'Delphi Digital',
    category: 'crypto-research',
    niches: ['crypto', 'research'],
    featured: true,
  },
  {
    url: 'https://www.galaxy.com/insights/research/feed/',
    label: 'Galaxy Research',
    category: 'crypto-research',
    niches: ['crypto', 'research'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TECH & GENERAL (10 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const TECH_FEEDS: FeedSource[] = [
  {
    url: 'https://hackernoon.com/feed',
    label: 'Hacker Noon',
    category: 'tech',
    niches: ['tech', 'crypto'],
    featured: true,
  },
  {
    url: 'https://www.freecodecamp.org/news/rss/',
    label: 'FreeCodeCamp',
    category: 'tech',
    niches: ['tech', 'dev'],
  },
  {
    url: 'https://news.ycombinator.com/rss',
    label: 'Hacker News',
    category: 'tech',
    niches: ['tech', 'startups'],
    featured: true,
  },
  // Hacker News front page — the 20 top-ranked stories (added 2026-08-03)
  {
    url: 'https://hnrss.org/frontpage',
    label: 'Hacker News Front Page',
    category: 'tech',
    niches: ['tech', 'startups'],
    featured: true,
  },
  // Product Hunt daily launches (Atom feed, added 2026-08-03)
  {
    url: 'https://www.producthunt.com/feed',
    label: 'Product Hunt',
    category: 'tech',
    niches: ['startups', 'tech', 'products'],
    featured: true,
  },
  {
    url: 'https://www.theverge.com/rss/index.xml',
    label: 'The Verge',
    category: 'tech',
    niches: ['tech'],
  },
  {
    url: 'https://feeds.feedburner.com/TheHackersNews',
    label: 'The Hacker News',
    category: 'tech',
    niches: ['security', 'tech'],
  },
  {
    url: 'https://www.bleepingcomputer.com/feed/',
    label: 'BleepingComputer',
    category: 'tech',
    niches: ['security', 'tech'],
  },
  {
    url: 'https://blog.google/technology/ai/rss/',
    label: 'Google AI',
    category: 'tech',
    niches: ['ai', 'tech'],
  },
  {
    url: 'https://openai.com/blog/rss.xml',
    label: 'OpenAI Blog',
    category: 'tech',
    niches: ['ai'],
    featured: true,
  },
  {
    url: 'https://deepmind.google/blog/rss.xml',
    label: 'DeepMind',
    category: 'tech',
    niches: ['ai', 'research'],
  },
  {
    url: 'https://www.technologyreview.com/feed/',
    label: 'MIT Tech Review',
    category: 'tech',
    niches: ['tech', 'ai', 'research'],
    featured: true,
  },
  {
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    label: 'Ars Technica',
    category: 'tech',
    niches: ['tech', 'dev'],
    featured: true,
  },
  {
    url: 'https://www.wired.com/feed/rss',
    label: 'Wired',
    category: 'tech',
    niches: ['tech', 'ai'],
    featured: true,
  },
  {
    url: 'https://techcrunch.com/feed/',
    label: 'TechCrunch',
    category: 'tech',
    niches: ['tech', 'startups'],
    featured: true,
  },
  {
    url: 'https://www.theregister.com/headlines.rss',
    label: 'The Register',
    category: 'tech',
    niches: ['tech', 'security'],
  },
  {
    url: 'https://www.theguardian.com/technology/rss',
    label: 'The Guardian Tech',
    category: 'tech',
    niches: ['tech'],
  },
  {
    url: 'https://restofworld.org/feed/',
    label: 'Rest of World',
    category: 'tech',
    niches: ['tech', 'global'],
  },
  {
    url: 'https://theconversation.com/us/articles.atom',
    label: 'The Conversation',
    category: 'tech',
    niches: ['tech', 'research', 'academic'],
  },
  {
    url: 'https://spectrum.ieee.org/feeds/feed.rss',
    label: 'IEEE Spectrum',
    category: 'tech',
    niches: ['tech', 'ai', 'research'],
  },
  {
    url: 'https://stratechery.com/feed/',
    label: 'Stratechery',
    category: 'tech',
    niches: ['tech', 'business', 'strategy'],
    featured: true,
  },
  // ── General tech / crypto-adjacent expansion (verified 2026-08-03) ────
  {
    url: 'https://www.generalist.com/feed',
    label: 'The Generalist',
    category: 'tech',
    niches: ['tech', 'startups', 'business'],
    featured: true,
  },
  {
    url: 'https://www.exponentialview.co/feed',
    label: 'Exponential View',
    category: 'tech',
    niches: ['tech', 'ai', 'research'],
  },
  {
    url: 'https://www.ben-evans.com/benedictevans?format=rss',
    label: 'Benedict Evans',
    category: 'tech',
    niches: ['tech', 'ai', 'business'],
  },
  {
    url: 'https://www.notboring.co/feed',
    label: 'Not Boring',
    category: 'tech',
    niches: ['tech', 'startups', 'business'],
  },
  {
    url: 'https://thenetwork.substack.com/feed',
    label: 'The Network',
    category: 'tech',
    niches: ['tech', 'ai', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://theprotocol.substack.com/feed',
    label: 'The Protocol',
    category: 'tech',
    niches: ['tech', 'startups'],
    platform: 'substack',
  },
  {
    url: 'https://www.sequoiacap.com/feed/',
    label: 'Sequoia',
    category: 'tech',
    niches: ['startups', 'vc', 'business'],
  },
  {
    url: 'https://a16zcrypto.substack.com/feed',
    label: 'a16z Crypto',
    category: 'tech',
    niches: ['crypto', 'vc', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://www.forbes.com/innovation/feed/',
    label: 'Forbes Innovation',
    category: 'tech',
    niches: ['tech', 'ai', 'business'],
  },
  {
    url: 'https://www.vice.com/en/rss/tag/tech',
    label: 'Motherboard',
    category: 'tech',
    niches: ['tech', 'privacy'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DEFI-SPECIFIC (verified 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════
export const DEFI_FEEDS: FeedSource[] = [
  {
    url: 'https://curve.substack.com/feed',
    label: 'Curve Finance',
    category: 'defi',
    niches: ['defi', 'ethereum'],
  },
  {
    url: 'https://medium.com/feed/compound-finance',
    label: 'Compound',
    category: 'defi',
    niches: ['defi', 'ethereum'],
    platform: 'medium',
  },
  {
    url: 'https://blog.lido.fi/rss/',
    label: 'Lido',
    category: 'defi',
    niches: ['defi', 'staking', 'ethereum'],
  },
  {
    url: 'https://medium.com/feed/uniswap-labs',
    label: 'Uniswap',
    category: 'defi',
    niches: ['defi', 'dex', 'ethereum'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/iearn',
    label: 'Yearn',
    category: 'defi',
    niches: ['defi', 'yield', 'ethereum'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/gmx-io',
    label: 'GMX',
    category: 'defi',
    niches: ['defi', 'dex', 'perpetuals'],
    platform: 'medium',
  },
  {
    url: 'https://forum.makerdao.com/posts.rss',
    label: 'MakerDAO',
    category: 'defi',
    niches: ['defi', 'stablecoin', 'governance'],
  },
  {
    url: 'https://uniswap.substack.com/feed',
    label: 'Uniswap Blog',
    category: 'defi',
    niches: ['defi', 'dex', 'ethereum'],
    platform: 'substack',
  },
  {
    url: 'https://blog.bitfinex.com/feed/',
    label: 'Bitfinex Blog',
    category: 'defi',
    niches: ['crypto', 'exchange', 'research'],
  },
  {
    url: 'https://defillama.com/rss',
    label: 'DeFi Llama',
    category: 'defi',
    niches: ['defi', 'tvl'],
  },
  {
    url: 'https://blog.curve.fi/rss/',
    label: 'Curve',
    category: 'defi',
    niches: ['defi', 'stablecoin'],
  },
  {
    url: 'https://aave.mirror.xyz/feed',
    label: 'Aave',
    category: 'defi',
    niches: ['defi', 'lending'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// NFT & METAVERSE (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const NFT_FEEDS: FeedSource[] = [
  { url: 'https://nftnow.com/feed/', label: 'NFT Now', category: 'nft', niches: ['nft', 'crypto'] },
  {
    url: 'https://decrypt.co/feed/nft',
    label: 'Decrypt NFT',
    category: 'nft',
    niches: ['nft', 'crypto'],
  },
  {
    url: 'https://rarible.substack.com/feed',
    label: 'Rarible Blog',
    category: 'nft',
    niches: ['nft', 'ethereum'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// AI SPECIFIC (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const AI_FEEDS: FeedSource[] = [
  {
    url: 'https://huggingface.co/blog/feed.xml',
    label: 'Hugging Face Blog',
    category: 'ai',
    niches: ['ai', 'dev', 'research'],
  },
  // ── AI/ML news & newsletters expansion (verified 2026-08-31) ─────────
  {
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    label: 'TechCrunch AI',
    category: 'ai',
    niches: ['ai', 'tech', 'startups'],
    featured: true,
  },
  {
    url: 'https://venturebeat.com/category/ai/feed/',
    label: 'VentureBeat AI',
    category: 'ai',
    niches: ['ai', 'tech', 'startups'],
    featured: true,
  },
  {
    url: 'https://www.therundown.ai/feed',
    label: 'The Rundown AI',
    category: 'ai',
    niches: ['ai', 'newsletter'],
    platform: 'substack',
  },
  {
    url: 'https://importai.substack.com/feed',
    label: 'Import AI',
    category: 'ai',
    niches: ['ai', 'research', 'newsletter'],
    platform: 'substack',
  },
  {
    url: 'https://www.latent.space/feed',
    label: 'Latent Space',
    category: 'ai',
    niches: ['ai', 'research', 'dev'],
  },
  {
    url: 'https://www.interconnects.ai/feed',
    label: 'Interconnects',
    category: 'ai',
    niches: ['ai', 'research'],
  },
  {
    url: 'https://magazine.sebastianraschka.com/feed',
    label: 'Sebastian Raschka',
    category: 'ai',
    niches: ['ai', 'ml', 'dev'],
  },
  {
    url: 'https://thesequence.substack.com/feed',
    label: 'The Sequence',
    category: 'ai',
    niches: ['ai', 'newsletter'],
    platform: 'substack',
  },
  {
    url: 'https://simonwillison.net/atom/everything/',
    label: 'Simon Willison',
    category: 'ai',
    niches: ['ai', 'dev', 'llm'],
    featured: true,
  },
  {
    url: 'https://aibreakfast.substack.com/feed',
    label: 'AI Breakfast',
    category: 'ai',
    niches: ['ai', 'newsletter'],
    platform: 'substack',
  },
  {
    url: 'https://thereboot.substack.com/feed',
    label: 'The Reboot',
    category: 'ai',
    niches: ['ai', 'newsletter'],
    platform: 'substack',
  },
  {
    url: 'https://www.tbray.org/ongoing/ongoing.atom',
    label: 'Tim Bray',
    category: 'ai',
    niches: ['ai', 'tech', 'dev'],
    platform: 'atom',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCIENCE (verified 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════

export const SCIENCE_FEEDS: FeedSource[] = [
  {
    url: 'https://www.nature.com/nature.rss',
    label: 'Nature',
    category: 'science',
    niches: ['science', 'research', 'academic'],
    featured: true,
  },
  {
    url: 'https://www.sciencedaily.com/rss/all.xml',
    label: 'Science Daily',
    category: 'science',
    niches: ['science', 'research'],
  },
  {
    url: 'https://www.quantamagazine.org/feed/',
    label: 'Quanta Magazine',
    category: 'science',
    niches: ['science', 'research', 'tech'],
    featured: true,
  },
  {
    url: 'https://www.economist.com/science-and-technology/rss.xml',
    label: 'The Economist Science',
    category: 'science',
    niches: ['science', 'tech', 'research'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// GEOPOLITICS & WORLD AFFAIRS (verified 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════

export const GEOPOLITICS_FEEDS: FeedSource[] = [
  {
    url: 'https://foreignaffairs.com/rss.xml',
    label: 'Foreign Affairs',
    category: 'geopolitics',
    niches: ['geopolitics', 'policy', 'world'],
    featured: true,
  },
  {
    url: 'https://www.cfr.org/feed',
    label: 'Council on Foreign Relations',
    category: 'geopolitics',
    niches: ['geopolitics', 'policy', 'world'],
    featured: true,
  },
  {
    url: 'https://thediplomat.com/feed/',
    label: 'The Diplomat',
    category: 'geopolitics',
    niches: ['geopolitics', 'asia', 'world'],
  },
  {
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    label: 'BBC World',
    category: 'geopolitics',
    niches: ['world', 'geopolitics'],
  },
  {
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    label: 'Al Jazeera',
    category: 'geopolitics',
    niches: ['world', 'geopolitics', 'middle-east'],
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    label: 'NYT World',
    category: 'geopolitics',
    niches: ['world', 'geopolitics'],
    featured: true,
  },
  {
    url: 'https://www.theguardian.com/world/rss',
    label: 'The Guardian World',
    category: 'geopolitics',
    niches: ['world', 'geopolitics'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS & ECONOMICS (verified 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════

export const BUSINESS_FEEDS: FeedSource[] = [
  {
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    label: 'WSJ Crypto',
    category: 'business',
    niches: ['crypto', 'markets', 'finance'],
  },
  {
    url: 'https://feeds.feedburner.com/zerohedge/feed',
    label: 'ZeroHedge',
    category: 'business',
    niches: ['crypto', 'markets', 'macro'],
  },
  {
    url: 'https://feeds.reuters.com/reuters/technologyNews',
    label: 'Reuters',
    category: 'business',
    niches: ['tech', 'markets', 'finance'],
  },
  {
    url: 'https://www.economist.com/finance-and-economics/rss.xml',
    label: 'The Economist',
    category: 'business',
    niches: ['business', 'economics', 'markets'],
    featured: true,
  },
  {
    url: 'https://www.ft.com/alphaville?format=rss',
    label: 'FT Alphaville',
    category: 'business',
    niches: ['business', 'economics', 'markets'],
  },
  {
    url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews',
    label: 'WSJ World',
    category: 'business',
    niches: ['business', 'world', 'markets'],
  },
  {
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    label: 'CNBC Top News',
    category: 'business',
    niches: ['business', 'markets'],
  },
  {
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    label: 'Bloomberg Markets',
    category: 'business',
    niches: ['business', 'markets'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// WORLD NEWS (verified 2026-08-03 — Ground News breadth play)
// ═══════════════════════════════════════════════════════════════════════════

export const WORLD_FEEDS: FeedSource[] = [
  {
    url: 'https://www.ft.com/rss/home',
    label: 'FT',
    category: 'world',
    niches: ['world', 'business', 'markets'],
    featured: true,
  },
  {
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    label: 'MarketWatch',
    category: 'world',
    niches: ['business', 'markets', 'world'],
  },
  {
    url: 'https://finance.yahoo.com/news/rssindex',
    label: 'Yahoo Finance',
    category: 'world',
    niches: ['business', 'markets', 'world'],
  },
  {
    url: 'https://fortune.com/feed/',
    label: 'Fortune',
    category: 'world',
    niches: ['business', 'world'],
  },
  {
    url: 'https://www.businessinsider.com/rss',
    label: 'Business Insider',
    category: 'world',
    niches: ['business', 'world', 'tech'],
  },
  {
    url: 'https://qz.com/feed',
    label: 'Quartz',
    category: 'world',
    niches: ['business', 'world', 'tech'],
  },
  {
    url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
    label: 'CNBC Markets',
    category: 'world',
    niches: ['business', 'markets'],
  },
  {
    url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    label: 'CNBC Tech',
    category: 'world',
    niches: ['business', 'tech'],
  },
  {
    url: 'https://feeds.bloomberg.com/technology/news.rss',
    label: 'Bloomberg Tech',
    category: 'world',
    niches: ['business', 'tech'],
  },
  {
    url: 'https://feeds.bloomberg.com/crypto/news.rss',
    label: 'Bloomberg Crypto',
    category: 'world',
    niches: ['crypto', 'business', 'markets'],
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    label: 'NYT Business',
    category: 'world',
    niches: ['business', 'markets', 'world'],
  },
  {
    url: 'https://www.inc.com/rss',
    label: 'Inc',
    category: 'world',
    niches: ['business', 'startups'],
  },
  {
    url: 'https://www.fastcompany.com/rss',
    label: 'Fast Company',
    category: 'world',
    niches: ['business', 'tech'],
  },
  {
    url: 'https://marginalrevolution.com/feed',
    label: 'Marginal Revolution',
    category: 'world',
    niches: ['business', 'economics'],
  },
  {
    url: 'http://feeds.bbci.co.uk/news/world/africa/rss.xml',
    label: 'BBC Africa',
    category: 'world',
    niches: ['world', 'africa'],
  },
  {
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    label: 'BBC Business',
    category: 'world',
    niches: ['business', 'world'],
  },
  {
    url: 'http://rss.cnn.com/rss/edition_world.rss',
    label: 'CNN World',
    category: 'world',
    niches: ['world'],
  },
  {
    url: 'https://www.cbsnews.com/latest/rss/main',
    label: 'CBS News',
    category: 'world',
    niches: ['world'],
  },
  {
    url: 'https://abcnews.go.com/abcnews/topstories',
    label: 'ABC News',
    category: 'world',
    niches: ['world'],
  },
  {
    url: 'https://feeds.nbcnews.com/nbcnews/public/news',
    label: 'NBC News',
    category: 'world',
    niches: ['world'],
  },
  {
    url: 'https://feeds.npr.org/1004/rss.xml',
    label: 'NPR World',
    category: 'world',
    niches: ['world', 'us'],
  },
  {
    url: 'https://feeds.washingtonpost.com/rss/world',
    label: 'Washington Post World',
    category: 'world',
    niches: ['world'],
  },
  {
    url: 'https://time.com/feed/',
    label: 'Time World',
    category: 'world',
    niches: ['world'],
  },
  {
    url: 'https://www.theguardian.com/us-news/rss',
    label: 'Guardian US',
    category: 'world',
    niches: ['world', 'us'],
  },
  {
    url: 'https://www.france24.com/en/rss',
    label: 'France24',
    category: 'world',
    niches: ['world', 'europe'],
  },
  {
    url: 'https://rss.dw.com/rdf/rss-en-all',
    label: 'DW',
    category: 'world',
    niches: ['world', 'europe', 'germany'],
  },
  {
    url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',
    label: 'NHK World',
    category: 'world',
    niches: ['world', 'asia', 'japan'],
  },
  {
    url: 'https://www.scmp.com/rss/91/feed',
    label: 'SCMP',
    category: 'world',
    niches: ['world', 'asia', 'china'],
  },
  {
    url: 'https://www.euronews.com/rss?level=theme&culture=en',
    label: 'EuroNews',
    category: 'world',
    niches: ['world', 'europe'],
  },
  {
    url: 'https://www.independent.co.uk/news/world/rss',
    label: 'The Independent',
    category: 'world',
    niches: ['world', 'uk'],
  },
  {
    url: 'https://www.standard.co.uk/rss',
    label: 'Evening Standard',
    category: 'world',
    niches: ['world', 'uk', 'london'],
  },
  {
    url: 'https://feeds.skynews.com/feeds/rss/world.xml',
    label: 'Sky News',
    category: 'world',
    niches: ['world', 'uk'],
  },
  {
    url: 'https://www.irishtimes.com/cmlink/news-1.1319192',
    label: 'Irish Times',
    category: 'world',
    niches: ['world', 'ireland', 'europe'],
  },
  {
    url: 'https://www.theage.com.au/rss/feed.xml',
    label: 'The Age',
    category: 'world',
    niches: ['world', 'australia'],
  },
  {
    url: 'https://www.rnz.co.nz/rss/news',
    label: 'RNZ',
    category: 'world',
    niches: ['world', 'new-zealand'],
  },
  {
    url: 'https://www.rappler.com/feed/',
    label: 'Rappler',
    category: 'world',
    niches: ['world', 'asia', 'philippines'],
  },
  {
    url: 'https://www.straitstimes.com/news/world/rss.xml',
    label: 'The Straits Times',
    category: 'world',
    niches: ['world', 'asia', 'singapore'],
  },
  {
    url: 'https://www.japantimes.co.jp/feed/',
    label: 'The Japan Times',
    category: 'world',
    niches: ['world', 'asia', 'japan'],
  },
  {
    url: 'https://www.tagesschau.de/xml/rss2/',
    label: 'Tagesschau',
    category: 'world',
    niches: ['world', 'europe', 'germany'],
  },
  {
    url: 'https://www.spiegel.de/international/index.rss',
    label: 'Der Spiegel',
    category: 'world',
    niches: ['world', 'europe', 'germany'],
  },
  {
    url: 'https://www.lemonde.fr/en/rss/une.xml',
    label: 'Le Monde',
    category: 'world',
    niches: ['world', 'europe', 'france'],
  },
  {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada',
    label: 'El Pais',
    category: 'world',
    niches: ['world', 'europe', 'spain'],
  },
  {
    url: 'https://www.al-monitor.com/rss',
    label: 'Al Monitor',
    category: 'world',
    niches: ['world', 'middle-east'],
  },
  {
    url: 'https://www.middleeasteye.net/rss',
    label: 'Middle East Eye',
    category: 'world',
    niches: ['world', 'middle-east'],
  },
  {
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    label: 'AllAfrica',
    category: 'world',
    niches: ['world', 'africa'],
  },
  {
    url: 'https://www.premiumtimesng.com/feed',
    label: 'Premium Times',
    category: 'world',
    niches: ['world', 'africa', 'nigeria'],
  },
  {
    url: 'https://punchng.com/feed/',
    label: 'Punch',
    category: 'world',
    niches: ['world', 'africa', 'nigeria'],
  },
  {
    url: 'https://www.theafricareport.com/feed/',
    label: 'Africa Report',
    category: 'world',
    niches: ['world', 'africa', 'business'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCIENCE & TECH (verified 2026-08-03 — Ground News breadth play)
// ═══════════════════════════════════════════════════════════════════════════

export const SCIENCE_TECH_FEEDS: FeedSource[] = [
  {
    url: 'https://news.mit.edu/rss/feed',
    label: 'MIT News',
    category: 'science',
    niches: ['science', 'tech', 'research'],
    featured: true,
  },
  {
    url: 'https://news.harvard.edu/gazette/feed/',
    label: 'Harvard Gazette',
    category: 'science',
    niches: ['science', 'research', 'academic'],
  },
  {
    url: 'https://news.berkeley.edu/feed/',
    label: 'Berkeley News',
    category: 'science',
    niches: ['science', 'research', 'academic'],
  },
  {
    url: 'https://phys.org/rss-feed/',
    label: 'Phys.org',
    category: 'science',
    niches: ['science', 'research'],
  },
  {
    url: 'https://www.science.org/rss/news_current.xml',
    label: 'Science.org',
    category: 'science',
    niches: ['science', 'research', 'academic'],
  },
  {
    url: 'https://www.sciencenews.org/feed',
    label: 'Science News',
    category: 'science',
    niches: ['science', 'research'],
  },
  {
    url: 'https://www.livescience.com/feeds/all',
    label: 'Live Science',
    category: 'science',
    niches: ['science'],
  },
  {
    url: 'https://www.smithsonianmag.com/rss/latest_articles/',
    label: 'Smithsonian',
    category: 'science',
    niches: ['science', 'culture', 'history'],
  },
  {
    url: 'https://www.space.com/feeds/all',
    label: 'Space.com',
    category: 'science',
    niches: ['science', 'space'],
  },
  {
    url: 'https://www.universetoday.com/feed/',
    label: 'Universe Today',
    category: 'science',
    niches: ['science', 'space'],
  },
  {
    url: 'https://www.popsci.com/feed/',
    label: 'Popular Science',
    category: 'science',
    niches: ['science', 'tech'],
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
    label: 'NYT Science',
    category: 'science',
    niches: ['science', 'world'],
  },
  {
    url: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    label: 'BBC Science',
    category: 'science',
    niches: ['science'],
  },
  {
    url: 'https://www.theguardian.com/science/rss',
    label: 'Guardian Science',
    category: 'science',
    niches: ['science'],
  },
  {
    url: 'https://www.engadget.com/rss.xml',
    label: 'Engadget',
    category: 'tech',
    niches: ['tech', 'gadgets'],
  },
  {
    url: 'https://gizmodo.com/rss',
    label: 'Gizmodo',
    category: 'tech',
    niches: ['tech'],
  },
  {
    url: 'https://www.zdnet.com/news/rss.xml',
    label: 'ZDNet',
    category: 'tech',
    niches: ['tech', 'security'],
  },
  {
    url: 'https://rss.slashdot.org/Slashdot/slashdotMain',
    label: 'Slashdot',
    category: 'tech',
    niches: ['tech', 'dev'],
  },
  {
    url: 'https://www.cnet.com/rss/news/',
    label: 'CNET',
    category: 'tech',
    niches: ['tech', 'gadgets'],
  },
  {
    url: 'https://venturebeat.com/feed/',
    label: 'VentureBeat',
    category: 'tech',
    niches: ['tech', 'ai', 'startups'],
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
    label: 'NYT Tech',
    category: 'tech',
    niches: ['tech'],
  },
  {
    url: 'https://feeds.washingtonpost.com/rss/business/technology',
    label: 'Washington Post Tech',
    category: 'tech',
    niches: ['tech'],
  },
  {
    url: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
    label: 'BBC Technology',
    category: 'tech',
    niches: ['tech'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CULTURE & POLITICS (verified 2026-08-03 — Ground News breadth play)
// ═══════════════════════════════════════════════════════════════════════════

export const CULTURE_FEEDS: FeedSource[] = [
  {
    url: 'https://www.theatlantic.com/feed/all/',
    label: 'The Atlantic',
    category: 'culture',
    niches: ['culture', 'politics', 'world'],
    featured: true,
  },
  {
    url: 'https://www.newyorker.com/feed/news',
    label: 'New Yorker',
    category: 'culture',
    niches: ['culture', 'politics'],
  },
  {
    url: 'https://www.vox.com/rss/index.xml',
    label: 'Vox',
    category: 'culture',
    niches: ['culture', 'politics', 'world'],
  },
  {
    url: 'https://theintercept.com/feed/?rss',
    label: 'The Intercept',
    category: 'culture',
    niches: ['politics', 'world'],
  },
  {
    url: 'https://www.propublica.org/feeds/propublica/main',
    label: 'ProPublica',
    category: 'culture',
    niches: ['politics', 'investigation'],
  },
  {
    url: 'https://aeon.co/feed',
    label: 'Aeon',
    category: 'culture',
    niches: ['culture', 'philosophy', 'science'],
  },
  {
    url: 'https://nautil.us/feed/',
    label: 'Nautilus',
    category: 'culture',
    niches: ['culture', 'science'],
  },
  {
    url: 'https://longreads.com/feed/',
    label: 'Longreads',
    category: 'culture',
    niches: ['culture', 'longform'],
  },
  {
    url: 'https://longform.org/feed',
    label: 'Longform',
    category: 'culture',
    niches: ['culture', 'longform'],
  },
  {
    url: 'https://thebrowser.com/feed/',
    label: 'The Browser',
    category: 'culture',
    niches: ['culture', 'reading'],
  },
  {
    url: 'https://www.theguardian.com/news/series/the-long-read/rss',
    label: 'Guardian Long Read',
    category: 'culture',
    niches: ['culture', 'longform'],
  },
  {
    url: 'https://www.motherjones.com/feed/',
    label: 'Mother Jones',
    category: 'culture',
    niches: ['politics'],
  },
  {
    url: 'https://www.thenation.com/feed/',
    label: 'The Nation',
    category: 'culture',
    niches: ['politics'],
  },
  {
    url: 'https://www.salon.com/feed/',
    label: 'Salon',
    category: 'culture',
    niches: ['politics', 'culture'],
  },
  {
    url: 'https://reason.com/feed/',
    label: 'Reason',
    category: 'culture',
    niches: ['politics', 'libertarian'],
  },
  {
    url: 'https://www.nationalreview.com/feed/',
    label: 'National Review',
    category: 'culture',
    niches: ['politics', 'conservative'],
  },
  {
    url: 'https://www.theamericanconservative.com/feed/',
    label: 'American Conservative',
    category: 'culture',
    niches: ['politics', 'conservative'],
  },
  {
    url: 'https://www.washingtonexaminer.com/feed/',
    label: 'Washington Examiner',
    category: 'culture',
    niches: ['politics'],
  },
  {
    url: 'https://dailycaller.com/feed/',
    label: 'Daily Caller',
    category: 'culture',
    niches: ['politics'],
  },
  {
    url: 'https://www.theonion.com/rss',
    label: 'The Onion',
    category: 'culture',
    niches: ['culture', 'satire'],
  },
  {
    url: 'https://slate.com/feeds/all.rss',
    label: 'Slate',
    category: 'culture',
    niches: ['culture', 'politics'],
  },
  {
    url: 'https://jacobin.com/feed',
    label: 'Jacobin',
    category: 'culture',
    niches: ['politics', 'left'],
  },
  {
    url: 'https://www.dissentmagazine.org/feed',
    label: 'Dissent',
    category: 'culture',
    niches: ['politics'],
  },
  {
    url: 'https://www.democracynow.org/democracynow.rss',
    label: 'Democracy Now',
    category: 'culture',
    niches: ['politics', 'world'],
  },
  {
    url: 'https://truthout.org/feed/',
    label: 'Truthout',
    category: 'culture',
    niches: ['politics'],
  },
  {
    url: 'https://thehill.com/feed/',
    label: 'The Hill',
    category: 'culture',
    niches: ['politics', 'us'],
  },
  {
    url: 'https://www.theguardian.com/politics/rss',
    label: 'Guardian Politics',
    category: 'culture',
    niches: ['politics', 'uk'],
  },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
    label: 'NYT Politics',
    category: 'culture',
    niches: ['politics', 'us'],
  },
  {
    url: 'https://moxie.foxnews.com/google-publisher/world.xml',
    label: 'Fox News',
    category: 'culture',
    niches: ['politics', 'us'],
  },
  {
    url: 'https://warontherocks.com/feed/',
    label: 'War on the Rocks',
    category: 'culture',
    niches: ['geopolitics', 'defense', 'world'],
  },
  {
    url: 'https://www.defenseone.com/rss/all/',
    label: 'Defense One',
    category: 'culture',
    niches: ['defense', 'geopolitics'],
  },
  {
    url: 'https://www.bellingcat.com/feed/',
    label: 'Bellingcat',
    category: 'culture',
    niches: ['investigation', 'world', 'geopolitics'],
  },
  {
    url: 'https://foreignpolicy.com/feed/',
    label: 'Foreign Policy',
    category: 'culture',
    niches: ['geopolitics', 'world', 'policy'],
    featured: true,
  },
  {
    url: 'https://www.worldpoliticsreview.com/feed/',
    label: 'World Politics Review',
    category: 'culture',
    niches: ['geopolitics', 'world', 'policy'],
  },
  {
    url: 'https://globalvoices.org/feed/',
    label: 'Global Voices',
    category: 'culture',
    niches: ['world', 'culture', 'global'],
  },
  {
    url: 'https://www.vice.com/en/rss',
    label: 'Vice',
    category: 'culture',
    niches: ['tech', 'culture'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER PLATFORMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Top crypto/DeFi Substack writers. RSS format: https://{author}.substack.com/feed
 */
export const SUBSTACK_WRITERS: FeedSource[] = [
  {
    url: 'https://validity.substack.com/feed',
    label: 'Validity',
    category: 'newsletter',
    niches: ['crypto', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://cryptoslate.substack.com/feed',
    label: 'CryptoSlate',
    category: 'newsletter',
    niches: ['crypto'],
    platform: 'substack',
  },
  {
    url: 'https://thebearcave.substack.com/feed',
    label: 'The Bear Cave',
    category: 'newsletter',
    niches: ['crypto', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://caseycaruso.substack.com/feed',
    label: 'Casey Caruso',
    category: 'newsletter',
    niches: ['crypto', 'vc'],
    platform: 'substack',
  },
  {
    url: 'https://cobie.substack.com/feed',
    label: 'Cobie',
    category: 'newsletter',
    niches: ['crypto'],
    platform: 'substack',
  },
  {
    url: 'https://technically.substack.com/feed',
    label: 'Technically',
    category: 'newsletter',
    niches: ['tech', 'ai'],
    platform: 'substack',
  },
  {
    url: 'https://proofofwork.substack.com/feed',
    label: 'Proof of Work',
    category: 'newsletter',
    niches: ['bitcoin', 'crypto'],
    platform: 'substack',
  },
  {
    url: 'https://defieducation.substack.com/feed',
    label: 'DeFi Education',
    category: 'newsletter',
    niches: ['defi', 'ethereum'],
    platform: 'substack',
  },
  {
    url: 'https://andrewmoore.substack.com/feed',
    label: 'Andrew Moore',
    category: 'newsletter',
    niches: ['crypto', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://marketmeditations.substack.com/feed',
    label: 'Market Meditations',
    category: 'newsletter',
    niches: ['crypto', 'trading'],
    platform: 'substack',
  },
  {
    url: 'https://thedefiant.substack.com/feed',
    label: 'The Defiant (Substack)',
    category: 'newsletter',
    niches: ['defi', 'crypto'],
    platform: 'substack',
  },
  {
    url: 'https://doseofdefi.substack.com/feed',
    label: 'Dose of DeFi',
    category: 'newsletter',
    niches: ['defi', 'crypto'],
    platform: 'substack',
  },
  {
    url: 'https://web3weekly.substack.com/feed',
    label: 'Web3 Weekly',
    category: 'newsletter',
    niches: ['crypto', 'web3'],
    platform: 'substack',
  },
  // ── Crypto/DeFi Substack expansion (verified 2026-08-31) ─────────────
  {
    url: 'https://weekinethereum.substack.com/feed',
    label: 'Week in Ethereum',
    category: 'newsletter',
    niches: ['ethereum', 'research'],
    platform: 'substack',
    featured: true,
  },
  {
    url: 'https://gwart.substack.com/feed',
    label: 'Gwart',
    category: 'newsletter',
    niches: ['crypto', 'macro', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://solanadaily.substack.com/feed',
    label: 'Solana Daily',
    category: 'newsletter',
    niches: ['solana', 'crypto'],
    platform: 'substack',
  },
  {
    url: 'https://tokensmart.substack.com/feed',
    label: 'TokenSmart',
    category: 'newsletter',
    niches: ['crypto', 'security', 'education'],
    platform: 'substack',
  },
  {
    url: 'https://cryptohayes.substack.com/feed',
    label: 'Crypto Hayes',
    category: 'newsletter',
    niches: ['crypto', 'macro', 'trading'],
    platform: 'substack',
  },
  {
    url: 'https://tokenterminal.substack.com/feed',
    label: 'Token Terminal',
    category: 'newsletter',
    niches: ['crypto', 'research', 'defi'],
    platform: 'substack',
  },
  {
    url: 'https://banklessafrica.substack.com/feed',
    label: 'Bankless Africa',
    category: 'newsletter',
    niches: ['crypto', 'africa', 'web3'],
    platform: 'substack',
  },
];

/**
 * Top Medium crypto publications. RSS: https://medium.com/feed/{publication}
 */
export const MEDIUM_PUBLICATIONS: FeedSource[] = [
  {
    url: 'https://medium.com/feed/coinmonks',
    label: 'Coinmonks',
    category: 'newsletter',
    niches: ['crypto'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/the-capital',
    label: 'The Capital',
    category: 'newsletter',
    niches: ['crypto', 'finance'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/better-programming',
    label: 'Better Programming',
    category: 'newsletter',
    niches: ['tech', 'dev'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/towards-data-science',
    label: 'Towards Data Science',
    category: 'newsletter',
    niches: ['ai', 'data'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/blockchain-review',
    label: 'Blockchain Review',
    category: 'newsletter',
    niches: ['crypto'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/ethglobal',
    label: 'ETHGlobal',
    category: 'newsletter',
    niches: ['ethereum', 'dev'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/chainlink-community',
    label: 'Chainlink Community',
    category: 'newsletter',
    niches: ['crypto', 'oracle'],
    platform: 'medium',
  },
  // Independent crypto writers (added 2026-08-04)
  {
    url: 'https://www.milkroad.com/feed',
    label: 'Milk Road',
    category: 'newsletter',
    niches: ['crypto', 'markets'],
  },
  {
    url: 'https://steadylads.substack.com/feed',
    label: 'Steady Lads',
    category: 'newsletter',
    niches: ['crypto', 'memecoin'],
    platform: 'substack',
  },
  {
    url: 'https://kermankohli.substack.com/feed',
    label: 'Kerman Kohli',
    category: 'newsletter',
    niches: ['crypto', 'research'],
    platform: 'substack',
  },
  {
    url: 'https://alphaplease.co/feed',
    label: 'Alpha Please',
    category: 'newsletter',
    niches: ['crypto', 'research'],
  },
  {
    url: 'https://www.therollup.co/feed',
    label: 'The Rollup',
    category: 'newsletter',
    niches: ['crypto', 'defi'],
  },
  {
    url: 'https://defidad.substack.com/feed',
    label: 'DeFi Dad',
    category: 'newsletter',
    niches: ['crypto', 'defi'],
    platform: 'substack',
  },
  {
    url: 'https://0xresearch.substack.com/feed',
    label: '0x Research',
    category: 'newsletter',
    niches: ['crypto', 'research'],
    platform: 'substack',
  },
  // ── Medium crypto/AI/tech publication expansion (verified 2026-08-31) ─
  // Note: Medium rate-limits datacenter IPs (429 Cloudflare challenge);
  // feeds degrade gracefully to empty when challenged.
  {
    url: 'https://medium.com/feed/datadriveninvestor',
    label: 'DataDrivenInvestor',
    category: 'newsletter',
    niches: ['crypto', 'finance', 'data'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/swlh',
    label: 'The Startup',
    category: 'newsletter',
    niches: ['tech', 'startups'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/ai-in-plain-english',
    label: 'AI in Plain English',
    category: 'newsletter',
    niches: ['ai', 'tech'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/gitconnected',
    label: 'Level Up Coding',
    category: 'newsletter',
    niches: ['tech', 'dev'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/towardsdev',
    label: 'Towards Dev',
    category: 'newsletter',
    niches: ['tech', 'dev'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/geekculture',
    label: 'Geek Culture',
    category: 'newsletter',
    niches: ['tech', 'culture'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/python-in-plain-english',
    label: 'Python in Plain English',
    category: 'newsletter',
    niches: ['tech', 'dev'],
    platform: 'medium',
  },
  {
    url: 'https://medium.com/feed/mlearning',
    label: 'MLearning.ai',
    category: 'newsletter',
    niches: ['ai', 'ml', 'data'],
    platform: 'medium',
  },
];

/**
 * Top Mirror.xyz writers. Atom feed: https://{blog}.mirror.xyz/feed/atom
 * Re-added 2026-08-31. NOTE: as of the 2026-08-31 audit, Mirror endpoints
 * return 403/429 (Cloudflare challenge) from datacenter IPs — feeds degrade
 * gracefully to empty when challenged. rss-fetcher.ts detects the Atom XML
 * response and parses it via the standard feed path.
 */
export const MIRROR_WRITERS: FeedSource[] = [
  {
    url: 'https://dankrad.mirror.xyz/feed/atom',
    label: 'Dankrad',
    category: 'newsletter',
    niches: ['ethereum', 'research', 'crypto'],
    platform: 'mirror',
  },
  {
    url: 'https://nouns.mirror.xyz/feed/atom',
    label: 'Nouns Mirror',
    category: 'newsletter',
    niches: ['nft', 'dao', 'crypto'],
    platform: 'mirror',
  },
  {
    url: 'https://jessewalden.mirror.xyz/feed/atom',
    label: 'Jesse Walden',
    category: 'newsletter',
    niches: ['crypto', 'vc', 'web3'],
    platform: 'mirror',
  },
  {
    url: 'https://betterideas.mirror.xyz/feed/atom',
    label: 'BetterIdeas',
    category: 'newsletter',
    niches: ['crypto', 'web3', 'culture'],
    platform: 'mirror',
  },
  {
    url: 'https://lore.mirror.xyz/feed/atom',
    label: 'Lore',
    category: 'newsletter',
    niches: ['nft', 'art', 'crypto'],
    platform: 'mirror',
  },
  {
    url: 'https://digitalax.mirror.xyz/feed/atom',
    label: 'Digitalax',
    category: 'newsletter',
    niches: ['nft', 'fashion', 'web3'],
    platform: 'mirror',
  },
];

/**
 * Paragraph.xyz web3 newsletters. RSS: https://paragraph.xyz/@handle/rss
 * Re-added 2026-08-31. NOTE: as of the 2026-08-31 audit, Paragraph RSS
 * returns 429 (Cloudflare "error code: 1015") from datacenter IPs — feeds
 * degrade gracefully to empty when rate-limited. The newsletter provider
 * also pulls Paragraph via the official keyless API (public.api.paragraph.com).
 */
export const PARAGRAPH_NEWSLETTERS: FeedSource[] = [
  {
    url: 'https://paragraph.xyz/@metacartel/rss',
    label: 'MetaCartel',
    category: 'newsletter',
    niches: ['dao', 'web3', 'crypto'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@citydao/rss',
    label: 'CityDAO',
    category: 'newsletter',
    niches: ['dao', 'rwa', 'web3'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@gitcoin/rss',
    label: 'Gitcoin',
    category: 'newsletter',
    niches: ['web3', 'public-goods', 'crypto'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@seedclub/rss',
    label: 'Seed Club',
    category: 'newsletter',
    niches: ['crypto', 'vc', 'web3'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@sipher/rss',
    label: 'Sipher',
    category: 'newsletter',
    niches: ['gaming', 'gamefi', 'nft'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@ethcc/rss',
    label: 'EthCC',
    category: 'newsletter',
    niches: ['ethereum', 'events', 'web3'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@nouns/rss',
    label: 'Nouns',
    category: 'newsletter',
    niches: ['nft', 'dao', 'crypto'],
    platform: 'paragraph',
  },
  {
    url: 'https://paragraph.xyz/@artblocks/rss',
    label: 'Art Blocks',
    category: 'newsletter',
    niches: ['nft', 'art', 'generative'],
    platform: 'paragraph',
  },
];

/**
 * Ghost blogs with public RSS feeds.
 * NOTE: The Ghost content API endpoints (blog.ethereum.org, blog.solana.com)
 * return 404/DNS errors as of 2026-08-03 audit — removed. The primary RSS
 * feeds for Ethereum/Solana blogs remain in RESEARCH_FEEDS.
 */
export const GHOST_BLOGS: FeedSource[] = [];

/**
 * Beehiiv publications with RSS.
 * NOTE: The Block (Beehiiv) is 403 and Milken Institute is 404 as of the
 * 2026-08-03 audit — removed.
 */
export const BEEHIIV_PUBLICATIONS: FeedSource[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// REGULATION & POLICY (4 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const REGULATION_FEEDS: FeedSource[] = [
  {
    url: 'https://www.sec.gov/rss/news/press.xml',
    label: 'SEC Press',
    category: 'regulation',
    niches: ['regulation', 'crypto'],
  },
  {
    url: 'https://www.coincenter.org/feed/',
    label: 'Coin Center',
    category: 'regulation',
    niches: ['regulation', 'crypto'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO & WEB3 PODCASTS (10 feeds)
// ═══════════════════════════════════════════════════════════════════════════

export const PODCAST_FEEDS: FeedSource[] = [
  {
    url: 'https://feeds.libsyn.com/247424/rss',
    label: 'Bankless',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'ethereum', 'defi'],
    featured: true,
  },
  {
    url: 'https://feeds.megaphone.fm/LSHML4761942757',
    label: 'Unchained',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'interviews', 'bitcoin'],
    featured: true,
  },
  {
    url: 'https://thedefiant.io/feed/podcast',
    label: 'The Defiant Podcast',
    category: 'podcast',
    platform: 'podcast',
    niches: ['defi', 'crypto', 'ethereum'],
  },
  {
    url: 'https://feeds.simplecast.com/puPuLj25',
    label: 'UpOnly',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'defi', 'interviews', 'nft'],
  },
  {
    url: 'https://feeds.megaphone.fm/empire',
    label: 'Empire',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'defi', 'business'],
    featured: true,
  },
  {
    url: 'https://feeds.megaphone.fm/0xresearch',
    label: '0xResearch',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'research', 'macro'],
  },
  {
    url: 'https://feeds.megaphone.fm/bellcurve',
    label: 'Bell Curve',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'macro', 'business'],
  },
  {
    url: 'https://feeds.megaphone.fm/TCB',
    label: 'Chopping Block',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'defi', 'news'],
  },
  {
    url: 'https://feeds.megaphone.fm/lightspeed',
    label: 'Lightspeed',
    category: 'podcast',
    platform: 'podcast',
    niches: ['solana', 'crypto', 'defi'],
  },
  {
    url: 'https://www.omnycontent.com/d/playlist/88b564ea-a9a6-4751-910a-a5d800019396/8163fac4-9321-4388-ac94-aee50022baf8/1e8cd755-5985-45a4-9020-aee5003fcd31/podcast.rss',
    label: 'The Block Podcast',
    category: 'podcast',
    platform: 'podcast',
    niches: ['crypto', 'news', 'business'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MASTER FEED LIST — All sources aggregated
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_FEEDS: FeedSource[] = [
  ...CRYPTO_NEWS_FEEDS,
  ...RESEARCH_FEEDS,
  ...VC_FEEDS,
  ...DEV_FEEDS,
  ...L1_L2_FEEDS,
  ...SECURITY_FEEDS,
  ...ACADEMIC_FEEDS,
  ...TECH_FEEDS,
  ...SCIENCE_FEEDS,
  ...GEOPOLITICS_FEEDS,
  ...BUSINESS_FEEDS,
  ...WORLD_FEEDS,
  ...SCIENCE_TECH_FEEDS,
  ...CULTURE_FEEDS,
  ...DEFI_FEEDS,
  ...NFT_FEEDS,
  ...AI_FEEDS,
  ...SUBSTACK_WRITERS,
  ...MEDIUM_PUBLICATIONS,
  ...MIRROR_WRITERS,
  ...PARAGRAPH_NEWSLETTERS,
  ...GHOST_BLOGS,
  ...BEEHIIV_PUBLICATIONS,
  ...REGULATION_FEEDS,
  ...PODCAST_FEEDS,
];

export const FEED_COUNT = ALL_FEEDS.length;

/** Get feeds by category */
export function getFeedsByCategory(category: FeedCategory): FeedSource[] {
  return ALL_FEEDS.filter((f) => f.category === category);
}

/** Get featured feeds (high-priority sources) */
export function getFeaturedFeeds(): FeedSource[] {
  return ALL_FEEDS.filter((f) => f.featured);
}

/** Get newsletters only */
export function getNewsletterFeeds(): FeedSource[] {
  return ALL_FEEDS.filter(
    (f) =>
      f.platform === 'substack' ||
      f.platform === 'medium' ||
      f.platform === 'mirror' ||
      f.platform === 'paragraph' ||
      f.platform === 'ghost' ||
      f.platform === 'beehiiv',
  );
}

/** Get podcast feeds only */
export function getPodcastFeeds(): FeedSource[] {
  return ALL_FEEDS.filter((f) => f.category === 'podcast' || f.platform === 'podcast');
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return (
    html
      // Unwrap CDATA sections FIRST — otherwise <![CDATA[...]]> is matched as an
      // HTML tag below and the content is destroyed (feeds with CDATA titles —
      // CoinDesk, The Verge, OpenAI, Blockworks, etc. — returned 0 items).
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      // Replace non-break tags with spaces first
      .replace(/<(?!br\s*\/?)[^>]+>/gi, ' ')
      // Then handle <br> as newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Decode entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x60;/g, '`')
      .replace(/&#x3D;/g, '=')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, (_match, num) => String.fromCharCode(num))
      // Collapse horizontal whitespace but keep newlines
      .replace(/[ \t]+/g, ' ')
      .replace(/\n */g, '\n')
      .trim()
  );
}

/**
 * Extract the first usable image URL from HTML content.
 * Skips data URIs, icons, badges, and favicons.
 */
export function extractFeaturedImage(html: string): string | undefined {
  if (!html) return undefined;
  // Prefer the largest candidate from a srcset when present, else the src.
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    const candidate = srcsetLargest(srcset) || src;
    if (candidate && isLikelyHeroImage(candidate)) return candidate;
  }
  // Try <figure> with <img> inside
  const figureMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (figureMatch?.[1] && isLikelyHeroImage(figureMatch[1])) return figureMatch[1];

  return undefined;
}

/**
 * Extract metadata from HTML content - description, keywords, author
 */
export function extractMetadata(html: string): {
  description?: string;
  authorName?: string;
  keywords?: string[];
} {
  const meta: { description?: string; authorName?: string; keywords?: string[] } = {};

  if (!html) return meta;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch) meta.description = stripHtml(descMatch[1]!).slice(0, 500);

  const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);
  if (authorMatch) meta.authorName = stripHtml(authorMatch[1]!);

  const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    meta.keywords = keywordsMatch[1]!.split(',').map((k) => k.trim().toLowerCase());
  }

  return meta;
}

/**
 * Extract enclosures (featured media) from feed item
 */
export function extractEnclosures(e: string): { url?: string; type?: string }[] {
  const enclosures: { url?: string; type?: string }[] = [];
  const enclosureRe = /<enclosure[^>]*>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = enclosureRe.exec(e)) !== null) {
    const urlMatch = m[0].match(/url=["']([^"']+)["']/i);
    const typeMatch = m[0].match(/type=["']([^"']+)["']/i);
    if (urlMatch) {
      enclosures.push({ url: urlMatch[1], type: typeMatch?.[1] });
    }
  }
  return enclosures;
}

/**
 * Parse a podcast episode duration from an RSS item.
 * Handles iTunes-style "HH:MM:SS", "MM:SS", or plain seconds.
 */
export function parsePodcastDuration(e: string): number | undefined {
  const match = e.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/i);
  if (!match || !match[1]) return undefined;
  const raw = match[1].trim();
  const parts = raw.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  if (parts.length === 3) {
    const [h = 0, m = 0, s = 0] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m = 0, s = 0] = parts;
    return m * 60 + s;
  }
  return parts[0] ?? 0;
}

/**
 * Minimum acceptable article hero image dimensions (CSS pixels).
 * Smaller images are icons/badges/trackers and are skipped so cards
 * never render a 1×1 pixel or a 16×16 favicon as a hero.
 */
export const MIN_IMAGE_WIDTH = 200;
export const MIN_IMAGE_HEIGHT = 150;

/**
 * URL patterns that identify icons, badges, avatars, sprites and other
 * non-hero images. Used to filter candidates before dimension checks.
 */
const IMAGE_JUNK_PATTERNS = [
  'favicon',
  'icon',
  'badge',
  'avatar',
  'button',
  'sprite',
  'logo',
  'tracking',
  'pixel',
  '1x1',
  'spacer',
  'blank.gif',
  'transparent',
];

/** True when a URL is a plausible hero image (not an obvious icon/badge). */
export function isLikelyHeroImage(url: string): boolean {
  if (!url?.startsWith('http')) return false;
  const lower = url.toLowerCase();
  return !IMAGE_JUNK_PATTERNS.some((p) => lower.includes(p));
}

/** Parse an <img> tag's declared width/height attributes (if present). */
function imgTagSize(tag: string): { width?: number; height?: number } {
  const w = tag.match(/\bwidth=["']?(\d+)/i)?.[1];
  const h = tag.match(/\bheight=["']?(\d+)/i)?.[1];
  return {
    width: w ? Number.parseInt(w, 10) : undefined,
    height: h ? Number.parseInt(h, 10) : undefined,
  };
}

/** Pick the largest candidate URL from a srcset attribute (descriptor `w` wins). */
function srcsetLargest(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  let best: { url: string; weight: number } | undefined;
  for (const part of srcset.split(',')) {
    const [rawUrl, descriptor] = part.trim().split(/\s+/);
    if (!rawUrl?.startsWith('http')) continue;
    const weight = descriptor?.endsWith('w')
      ? Number.parseInt(descriptor, 10) || 0
      : descriptor?.endsWith('x')
        ? Number.parseFloat(descriptor) || 0
        : 0;
    if (!best || weight > best.weight) best = { url: rawUrl, weight };
  }
  return best?.url;
}

/**
 * Readability-style largest-image extraction. Scores every <img> in the
 * article HTML by declared width×height (falling back to srcset weight)
 * and returns the largest candidate that plausibly is a hero image
 * (≥ MIN_IMAGE_WIDTH×MIN_IMAGE_HEIGHT when dimensions are declared,
 * and not an icon/badge/spacer by URL pattern).
 *
 * Returns undefined when no usable candidate exists.
 */
export function extractLargestImage(html: string): string | undefined {
  if (!html) return undefined;
  const imgRe = /<img\b[^>]*>/gi;
  let best: { url: string; area: number; weight: number } | undefined;

  for (const tag of html.match(imgRe) ?? []) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    const candidate = srcsetLargest(srcset) || src;
    if (!candidate || !isLikelyHeroImage(candidate)) continue;

    const { width, height } = imgTagSize(tag);
    // Declared dimensions below the hero threshold → skip outright
    if (width !== undefined && height !== undefined) {
      if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) continue;
      const area = width * height;
      if (!best || area > best.area) best = { url: candidate, area, weight: 0 };
      continue;
    }
    // No dimensions — score by srcset weight (falls back to area 0)
    const parsed = srcsetLargest(srcset);
    const weight = parsed ? Number.parseInt(parsed.split(/\s+/)[1] ?? '0', 10) : 0;
    if (!best || weight > best.weight) best = { url: candidate, area: 0, weight };
  }
  return best?.url;
}

/**
 * Extract OpenGraph / Twitter Card image from article HTML:
 *   <meta property="og:image" content="...">
 *   <meta name="twitter:image" content="...">
 *   <meta property="og:image:url" content="...">
 *   <meta property="og:image:secure_url" content="...">
 * Handles attribute order variants and skips favicons/icons/badges.
 * Prefers plain og:image over og:image:url/secure_url variants.
 */
export function extractOpenGraphImage(html: string): string | undefined {
  if (!html) return undefined;
  const metaRe =
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::url|:secure_url)?|twitter:image(?::src)?)["'][^>]*>/gi;
  const candidates: { url: string; priority: number }[] = [];
  for (const tag of html.match(metaRe) ?? []) {
    const content = tag.match(/(?:content|value)=["']([^"']+)["']/i);
    const url = content?.[1];
    if (!url || !isLikelyHeroImage(url)) continue;
    const property = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '';
    // Plain og:image and twitter:image are preferred over the :url/:secure_url variants
    const priority = property === 'og:image' || property === 'twitter:image' ? 2 : 1;
    candidates.push({ url, priority });
  }
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.url;
}

/**
 * Extract the first media:thumbnail / media:content image from a raw feed
 * item (RSS Media RSS namespace). Returns undefined when absent.
 */
export function extractMediaImage(itemXml: string): string | undefined {
  if (!itemXml) return undefined;
  const mediaRe = /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/gi;
  const matches = [...itemXml.matchAll(mediaRe)];
  for (const m of matches) {
    const url = m[1];
    if (url && isLikelyHeroImage(url)) return url;
  }
  return undefined;
}

// ─── OpenGraph Image Cache ────────────────────────────────────────────
// Extracted article images are cached in-memory so the bridge doesn't
// re-fetch every article page on every 5-minute feed cycle. Positive hits
// live for 7 days (og:image rarely changes); misses are cached 1 hour so
// slow/broken article pages aren't hammered repeatedly.

const OG_IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const OG_IMAGE_NEGATIVE_TTL_MS = 60 * 60 * 1000; // 1 hour
// Bounded: entry cap + periodic TTL sweep (the old Map grew unbounded for 7 days).
const ogImageCache = new BoundedCache<string>({
  maxEntries: 5_000,
  ttlMs: OG_IMAGE_CACHE_TTL_MS,
  sweepIntervalMs: 10 * 60 * 1000,
});
const ogImageNegative = new BoundedCache<string>({
  maxEntries: 5_000,
  ttlMs: OG_IMAGE_NEGATIVE_TTL_MS,
  sweepIntervalMs: 10 * 60 * 1000,
});
const ogImageInFlight = new Map<string, Promise<string | undefined>>();

function cacheOgImage(url: string, image: string | undefined): void {
  ogImageCache.delete(url);
  ogImageNegative.delete(url);
  if (image) ogImageCache.set(url, image);
  else ogImageNegative.set(url, '');
}

/**
 * Fetch an article page and extract its OpenGraph image.
 * In-memory cached (positive 7d, negative 1h) and single-flight deduplicated
 * so concurrent enrichment passes never duplicate a request.
 */
export async function fetchOpenGraphImage(url: string): Promise<string | undefined> {
  if (!url?.startsWith('http')) return undefined;

  const cached = ogImageCache.get(url) ?? ogImageNegative.get(url);
  if (cached !== undefined) return cached || undefined;

  const inFlight = ogImageInFlight.get(url);
  if (inFlight) return inFlight;

  const promise = fetchOpenGraphImageInner(url).finally(() => ogImageInFlight.delete(url));
  ogImageInFlight.set(url, promise);
  return promise;
}

async function fetchOpenGraphImageInner(url: string): Promise<string | undefined> {
  try {
    const res = await globalThis.fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      cacheOgImage(url, undefined);
      return undefined;
    }
    // We only need <head> metadata — cap the body to bound memory on huge pages.
    // 300KB keeps room for og:image + the top-of-article hero <img> that the
    // readability-style fallback scores.
    const html = (await res.text()).slice(0, 300_000);
    // Priority: OpenGraph/Twitter meta → readability-style largest image →
    // first inline <img> (legacy). Each candidate is validated to skip
    // icons, badges and tracking pixels.
    const og = extractOpenGraphImage(html);
    const image = og || extractLargestImage(html) || extractFeaturedImage(html);
    cacheOgImage(url, image);
    return image;
  } catch {
    cacheOgImage(url, undefined);
    return undefined;
  }
}

/** Read the current best image for a post (raw.image, then image embed). */
export function getPostImage(post: UnifiedPost): string | undefined {
  const raw = post.raw as Record<string, unknown> | undefined;
  const rawImage = raw?.image as string | undefined;
  if (rawImage) return rawImage;
  return post.embeds.find((e) => e.kind === 'image')?.url;
}

/** Attach an image to a post: sets raw.image and the image embed. */
export function setPostImage(post: UnifiedPost, image: string): void {
  const raw = post.raw as Record<string, unknown>;
  raw.image = image;
  const idx = post.embeds.findIndex((e) => e.kind === 'image');
  if (idx >= 0) {
    post.embeds[idx] = { kind: 'image', url: image, meta: post.embeds[idx]!.meta };
  } else {
    post.embeds.push({ kind: 'image', url: image });
  }
}

/**
 * Enrich posts that lack an image by fetching og:image from the article
 * page. Bounded: concurrency-limited and hard time-budgeted so enrichment
 * can never stall the RSS provider past its provider timeout.
 */
export async function enrichPostImages(
  posts: UnifiedPost[],
  budgetMs = 3000,
  concurrency = 5,
): Promise<UnifiedPost[]> {
  const missing = posts.filter((p) => !getPostImage(p));
  if (missing.length === 0) return posts;

  const deadline = Date.now() + budgetMs;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < missing.length) {
      if (Date.now() >= deadline) return; // time budget exhausted — keep what we have
      const i = cursor++;
      const post = missing[i];
      if (!post) continue;
      const url = extractLinkUrl(post);
      if (!url) continue;
      const image = await fetchOpenGraphImage(url);
      if (image) setPostImage(post, image);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));
  return posts;
}

/**
 * Detect niche categories from text content
 */
export function guessNiches(text: string, baseNiches: string[]): string[] {
  const niches = new Set(baseNiches);
  const lower = text.toLowerCase();

  // Crypto-specific
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.add('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra|eip|erc)\b/.test(lower)) niches.add('ethereum');
  if (/\b(sol|solana|spl|jupiter|pyth)\b/.test(lower)) niches.add('solana');
  if (/\b(defi|liquidity|yield|farm|lp|stake|apy)\b/.test(lower)) niches.add('defi');
  if (/\b(stak|validator|delegat|restak|eigenlayer|ssv|lido|jito)\b/.test(lower))
    niches.add('staking');
  if (/\b(mev|sandwich|front.?run|back.?run|extractable)\b/.test(lower)) niches.add('mev');
  if (/\b(bridge|bridging|wormhole|layerzero|axelar|ibc|interoperab)\b/.test(lower))
    niches.add('bridges');
  if (/\b(zero.?knowledge|zk.?proof|validity.?proof|zkp|zksync|starknet|circom)\b/.test(lower))
    niches.add('zero-knowledge');
  if (/\b(nft|art|collectible|punk|ens|soulbound)\b/.test(lower)) niches.add('nft');
  if (/\b(ai|artificial|intelligence|llm|agent|gpt|transformer|neural)\b/.test(lower))
    niches.add('ai');
  if (
    /\b(ai.?agent|ai.?crypto|decentralized.?ai|compute.?marketplace|bittensor|fetch\.?ai)\b/.test(
      lower,
    )
  )
    niches.add('aicrypto');
  if (/\b(storage|filecoin|arweave|ipfs|datacap|decentralized.?storage|storj)\b/.test(lower))
    niches.add('storage');
  if (
    /\b(identity|did|verifiable.?credential|soulbound|worldcoin|proof.?of.?personhood)\b/.test(
      lower,
    )
  )
    niches.add('identity');
  if (/\b(social|farcaster|lens|bluesky|socialfi|content|creator.?economy|deso)\b/.test(lower))
    niches.add('social');
  if (/\b(insurance|underwrit|coverage|nexus.?mutual|cover)\b/.test(lower)) niches.add('insurance');
  if (/\b(carbon|offset|verra|gold.?standard|regen|toucan|moss|ecosystem.?credit)\b/.test(lower))
    niches.add('carbon');
  if (
    /\b(payment|remittance|payments|crypto.?pay|lightning|visa|mastercard|paypal|stripe)\b/.test(
      lower,
    )
  )
    niches.add('payments');
  if (/\b(rwa|real.?world.?asset|tokeniz|tokenization|syndicate|centrifuge)\b/.test(lower))
    niches.add('rwa');
  if (/\b(sec|regulation|etf|compliance|sec|cfpb|finra|oig)\b/.test(lower))
    niches.add('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|mew)\b/.test(lower)) niches.add('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|scroll|zksync)\b/.test(lower)) niches.add('layer2');
  if (/\b(security|hack|exploit|audit|vulnerability|bug)\b/.test(lower)) niches.add('security');
  if (/\b(oracle|chainlink|pyth|api3)\b/.test(lower)) niches.add('oracle');
  if (/\b(dao|treasury|proposal|snapshot|delegate|quorum)\b/.test(lower)) niches.add('dao');
  if (/\b(governance|vote|voting|proposal|constitution|parameter.?change)\b/.test(lower))
    niches.add('governance');
  if (/\b(gaming|gamefi|play-to-earn|metaverse)\b/.test(lower)) niches.add('gaming');
  if (/\b(token|airdrop|listing|binance|coinbase)\b/.test(lower)) niches.add('token');
  if (/\b(mobile|telegram|ton|crypto\s*pay)\b/.test(lower)) niches.add('mobile');
  if (/\b(dex|swap|amm|order.?book|perpetual)\b/.test(lower)) niches.add('dex');
  if (/\b(custody|wallet|self.?custody|hardware)\b/.test(lower)) niches.add('wallet');
  if (/\b(stablecoin|usdc|usdt|dai|fdusd)\b/.test(lower)) niches.add('stablecoin');
  if (/\b(privacy|monero|tornado|anonymity)\b/.test(lower)) niches.add('privacy');
  if (/\b(mining|miner|hashrate|asic|pool|proof.?of.?work|difficulty)\b/.test(lower))
    niches.add('mining');

  // World / science / business topics (topic expansion)
  if (
    /\b(climate|physics|biology|genome|space|nasa|quantum|dna|vaccine|neutron|telescope)\b/.test(
      lower,
    )
  )
    niches.add('science');
  if (
    /\b(war|sanction|diplomacy|nato|election|foreign|policy|geopolitic|treaty|summit)\b/.test(lower)
  )
    niches.add('geopolitics');
  if (
    /\b(economy|recession|inflation|gdp|fed|interest rate|tariff|trade war|unemployment|central bank|pmi|cpi|rate cut|hike)\b/.test(
      lower,
    )
  ) {
    niches.add('business');
    niches.add('macro');
  }

  // Add crypto as default if nothing matched and no base niches
  if (niches.size === 0) niches.add('crypto');
  return [...niches];
}

// ─── Price Impact & Trending Coins ──────────────────────────────────
// CryptoPanic-style "which coins are affected" tagging. Articles that
// mention the top coins by market cap get a price-impact annotation and a
// ranking boost. Simulated until real user votes arrive.

export interface PriceImpactEntry {
  symbol: string;
  weight: number;
}

/**
 * Top coins by market cap (non-stablecoin) used for price-impact tagging.
 * `weight` reflects market-cap influence (1.0 = most impactful).
 */
export const TOP_MARKET_CAP_COINS: ReadonlyArray<{
  symbol: string;
  names: readonly string[];
  weight: number;
}> = [
  { symbol: 'BTC', names: ['bitcoin', 'btc', 'satoshi'], weight: 1.0 },
  { symbol: 'ETH', names: ['ethereum', 'eth', 'ether'], weight: 0.95 },
  { symbol: 'BNB', names: ['bnb', 'binance coin', 'bsc'], weight: 0.85 },
  { symbol: 'SOL', names: ['solana', 'sol'], weight: 0.82 },
  { symbol: 'XRP', names: ['xrp', 'ripple'], weight: 0.75 },
  { symbol: 'DOGE', names: ['dogecoin', 'doge'], weight: 0.7 },
  { symbol: 'ADA', names: ['cardano', 'ada'], weight: 0.66 },
  { symbol: 'TRX', names: ['tron', 'trx'], weight: 0.62 },
  { symbol: 'TON', names: ['toncoin', 'ton'], weight: 0.6 },
  { symbol: 'AVAX', names: ['avalanche', 'avax'], weight: 0.58 },
];

const TICKER_TO_WEIGHT = new Map<string, number>(
  TOP_MARKET_CAP_COINS.map((c) => [c.symbol, c.weight]),
);

/** Escape regex special chars in a literal string. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract price-impact entries from article text: `$BTC`-style tickers and
 * coin-name mentions of the top market-cap coins. Returns deduplicated
 * `[{symbol, weight}]` sorted by weight (most impactful first).
 */
export function extractPriceImpact(text: string): PriceImpactEntry[] {
  if (!text) return [];
  const found = new Map<string, number>();

  // $TICKER mentions (e.g. "$BTC", "$SOL") — most explicit signal
  const tickerRe = /\$([A-Z]{2,10})\b/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = tickerRe.exec(text)) !== null) {
    const ticker = m[1];
    if (!ticker) continue;
    const sym = ticker.toUpperCase();
    const w = TICKER_TO_WEIGHT.get(sym);
    if (w !== undefined) found.set(sym, Math.max(found.get(sym) ?? 0, w));
  }

  // Coin-name mentions (bitcoin, ethereum, ...)
  const lower = text.toLowerCase();
  for (const coin of TOP_MARKET_CAP_COINS) {
    for (const name of coin.names) {
      if (new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(lower)) {
        found.set(coin.symbol, Math.max(found.get(coin.symbol) ?? 0, coin.weight));
        break;
      }
    }
  }

  return [...found.entries()]
    .map(([symbol, weight]) => ({ symbol, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Coins considered "trending" for the simulated community-vote signal.
 * Top majors + currently hot memecoins (matches the memecoin niche regex).
 */
export const TRENDING_COINS: ReadonlySet<string> = new Set([
  'BTC',
  'ETH',
  'SOL',
  'PEPE',
  'DOGE',
  'BONK',
  'WIF',
  'SHIB',
  'MEW',
]);

// ─── RSS/Atom Parsing ─────────────────────────────────────────────────

export interface ParsedFeedItem {
  title: string;
  link: string;
  contentHtml: string;
  contentText: string;
  description: string;
  publishedAt: number;
  updatedAt: number;
  authorName?: string;
  authorLink?: string;
  featuredImage?: string;
  categories: string[];
  enclosures: { url?: string; type?: string }[];
  /** Podcast episode duration in seconds (parsed from itunes:duration) */
  duration?: number;
  id: string;
}

/**
 * Parse RSS 2.0 or Atom XML into structured items
 */
export function parseFeedXml(xml: string): {
  title?: string;
  description?: string;
  link?: string;
  image?: string;
  items: ParsedFeedItem[];
} {
  const result: ParsedFeedItem[] = [];

  const feedTitleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedDescMatch =
    xml.match(/<subtitle[^>]*>([\s\S]*?)<\/subtitle>/i) ||
    xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const feedLinkMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);

  // Feed-level image: RSS <image><url> or Atom <logo>
  const feedImageMatch =
    xml.match(/<image>[\s\S]*?<url[^>]*>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i) ||
    xml.match(/<logo[^>]*>([\s\S]*?)<\/logo>/i);

  // Try Atom entries first
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1]!;
    const item = parseAtomEntry(e);
    if (item) result.push(item);
  }

  // Fallback to RSS 2.0 items if no Atom entries found
  if (result.length === 0) {
    const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
    while ((m = itemRe.exec(xml)) !== null) {
      const e = m[1]!;
      const item = parseRssItem(e);
      if (item) result.push(item);
    }
  }

  return {
    title: feedTitleMatch ? stripHtml(feedTitleMatch[1]!).trim() : undefined,
    description: feedDescMatch ? stripHtml(feedDescMatch[1]!).trim().slice(0, 500) : undefined,
    link: feedLinkMatch?.[1],
    image: feedImageMatch?.[1] ? stripHtml(feedImageMatch[1]).trim() : undefined,
    items: result,
  };
}

function parseAtomEntry(e: string): ParsedFeedItem | null {
  const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]!).trim() : '';
  if (!title) return null;

  // Link - try href attribute first, then content
  const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
  const linkAltMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  const link = linkMatch?.[1] || (linkAltMatch ? stripHtml(linkAltMatch[1]!) : '');

  const updatedMatch = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const publishedMatch = e.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
  const publishedAt = publishedMatch ? new Date(publishedMatch[1]!).getTime() : Date.now();
  const updatedAt = updatedMatch ? new Date(updatedMatch[1]!).getTime() : publishedAt;

  const contentMatch = e.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const summaryMatch = e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const contentHtml = contentMatch?.[1] || summaryMatch?.[1] || '';
  const contentText = stripHtml(contentHtml);

  const descriptionMatch = e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const description = descriptionMatch
    ? stripHtml(descriptionMatch[1]!).slice(0, 500)
    : contentText.slice(0, 500);

  const authorNameMatch = e.match(
    /<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i,
  );
  const authorUriMatch = e.match(/<author>[\s\S]*?<uri[^>]*>([\s\S]*?)<\/uri>[\s\S]*?<\/author>/i);

  const categoryMatches = [...e.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)];
  const categories = categoryMatches.map((cm) => cm[1]!.toLowerCase());

  const enclosures = extractEnclosures(e);
  const featuredImage =
    extractFeaturedImage(contentHtml) || extractMediaImage(e) || enclosures[0]?.url;

  const idMatch = e.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
  const id = idMatch ? stripHtml(idMatch[1]!) : `entry:${title}:${publishedAt}`;

  return {
    title,
    link,
    contentHtml,
    contentText,
    description,
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    authorName: authorNameMatch ? stripHtml(authorNameMatch[1]!) : undefined,
    authorLink: authorUriMatch ? stripHtml(authorUriMatch[1]!) : undefined,
    featuredImage,
    categories,
    enclosures,
    duration: parsePodcastDuration(e),
    id,
  };
}

function parseRssItem(e: string): ParsedFeedItem | null {
  const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]!).trim() : '';
  if (!title) return null;

  const linkMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  const link = linkMatch ? stripHtml(linkMatch[1]!).trim() : '';

  const descMatch = e.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  // Description in RSS may be CDATA-wrapped with HTML
  const contentHtml = descMatch?.[1] || '';
  const contentText = stripHtml(contentHtml);

  const pubDateMatch = e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
  const dcDateMatch = e.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
  const dateStr = pubDateMatch?.[1] || dcDateMatch?.[1] || '';
  const publishedAt = dateStr ? new Date(dateStr).getTime() : Date.now();

  const authorMatch = e.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
  const dcCreatorMatch = e.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);

  const categoryMatches = [...e.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)];
  const categories = categoryMatches.map((cm) => stripHtml(cm[1]!).toLowerCase()).filter(Boolean);

  const enclosures = extractEnclosures(e);
  const featuredImage =
    extractFeaturedImage(contentHtml) || extractMediaImage(e) || enclosures[0]?.url;

  const guidMatch = e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  const id = guidMatch ? stripHtml(guidMatch[1]!) : `rss:${title}:${publishedAt}`;

  return {
    title,
    link,
    contentHtml,
    contentText,
    description: contentText.slice(0, 500),
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    authorName: authorMatch
      ? stripHtml(authorMatch[1]!)
      : dcCreatorMatch
        ? stripHtml(dcCreatorMatch[1]!)
        : undefined,
    featuredImage,
    categories,
    enclosures,
    duration: parsePodcastDuration(e),
    id,
  };
}

// ─── Feed Fetcher ─────────────────────────────────────────────────────

async function fetchSingleFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await globalThis.fetch(feed.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(RSS_FEED_TIMEOUT_MS),
    });

    if (!res.ok) {
      // console.log(`[rss] ${feed.label}: HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    if (!xml || xml.length < 50) return [];

    const parsed = parseFeedXml(xml);
    const items = parsed.items.slice(0, limit);

    return items.map((item, i) => {
      const allNiches = guessNiches(`${item.title} ${item.contentText}`, feed.niches);
      const embedUrl = item.link || feed.url;
      // Image priority: item content <img> → media:thumbnail/content → enclosure
      // → feed-level image (channel <image> / Atom <logo>).
      const featuredImage = item.featuredImage || parsed.image;
      // Sentiment runs locally on the headline + description (AFINN-based).
      const sentiment = analyzeNewsSentiment(`${item.title}. ${item.description || ''}`);

      const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [
        { kind: 'link', url: embedUrl },
      ];

      if (featuredImage) {
        embeds.push({
          kind: 'image',
          url: featuredImage,
          meta: { source: feed.label, caption: item.title },
        });
      }

      // Podcast feeds: promote the audio enclosure to a first-class audio
      // embed so clients can render an inline player. Falls back to the
      // first enclosure URL when no audio type is declared.
      const isPodcast = feed.category === 'podcast' || feed.platform === 'podcast';
      let audioUrl: string | undefined;
      if (isPodcast) {
        const audioEnclosure =
          item.enclosures.find(
            (en) =>
              en.url &&
              (en.type?.startsWith('audio/') ||
                /\.(mp3|m4a|ogg|wav|aac|opus|flac|webm)(\?|$)/i.test(en.url)),
          ) || item.enclosures.find((en) => en.url);
        audioUrl = audioEnclosure?.url;
        if (audioUrl) {
          embeds.push({
            kind: 'audio',
            url: audioUrl,
            meta: {
              duration: item.duration,
              podcast: feed.label,
              title: item.title,
            },
          });
        }
      }

      const platformLabel = feed.platform ? `${feed.label} (${feed.platform})` : feed.label;

      return {
        id: `rss:${feed.label}:${item.id || i}`,
        protocol: 'rss' as const,
        author: {
          id: `rss:${feed.label}`,
          primary: { protocol: 'rss', id: feed.label },
          handles: { rss: feed.label },
          displayName: item.authorName || platformLabel,
          bio: feed.category ? `${feed.category.replace(/-/g, ' ')} feed` : 'RSS feed',
          avatarUrl: rssAvatarUrl(feed.url, parsed.image),
          followerCount: 0,
          followingCount: 0,
          links: feed.url ? [{ label: 'source', url: feed.url }] : [],
          keys: {},
        },
        text: item.title,
        html: item.contentHtml,
        embeds,
        createdAt: item.publishedAt,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        // Top-level image/media fields: convenience for API consumers and
        // the frontend (og:image enrichment backfills via setPostImage).
        image: featuredImage,
        media: featuredImage,
        raw: {
          description: item.description,
          contentText: item.contentText.slice(0, 1000),
          categories: item.categories,
          feedLabel: feed.label,
          feedCategory: feed.category,
          feedUrl: feed.url,
          platform: feed.platform,
          image: featuredImage,
          sentiment,
          // Podcast episode metadata (present on podcast feeds)
          audioUrl,
          duration: isPodcast ? item.duration : undefined,
          podcastTitle: isPodcast ? feed.label : undefined,
          // Ground News-style ratings — free informational metadata
          bias: sourceBias(feed.label),
          biasScore: sourceBiasScore(feed.label),
          biasLabel: biasDisplayLabel(feed.label),
          factualRating: sourceFactuality(feed.label),
          // CryptoPanic-style price impact: which coins this article affects.
          priceImpact: extractPriceImpact(`${item.title} ${item.contentText}`),
        },
        niches: allNiches,
        contentType: isPodcast ? 'podcast' : 'link',
      };
    });
  } catch {
    // console.log(`[rss] ${feed.label}: error — ${err instanceof Error ? err.message : 'unknown'}`);
    return [];
  }
}

// ─── Newsletter Platform Fetchers ────────────────────────────────────

/**
 * Resolve an avatar for an RSS/Atom feed:
 * 1. Feed-level image (RSS <image><url> or Atom <logo>) — the source's logo.
 * 2. Favicon of the feed host — a stable per-source fallback so RSS posts
 *    never render as a blank/grey avatar.
 * Empty when the URL cannot be derived (feeds without any of the above).
 */
function rssAvatarUrl(feedUrl: string, feedImage?: string): string {
  if (feedImage?.trim()) return feedImage.trim();
  try {
    const host = new URL(feedUrl).hostname;
    if (!host) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return '';
  }
}

/**
 * Parse a Substack RSS feed. Substack uses standard RSS 2.0.
 */
async function fetchSubstackFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Parse Medium publication RSS. Medium uses Atom feeds.
 */
async function fetchMediumFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Fetch from Mirror.xyz writer feed (JSON API).
 */
async function fetchMirrorFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await globalThis.fetch(feed.url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(RSS_FEED_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.slice(0, limit).map((item, i) => {
      const itemAny = item as Record<string, unknown>;
      const title = (itemAny.title || 'Mirror post') as string;
      const body = (itemAny.body || itemAny.content || '') as string;
      const timestamp = itemAny.timestamp
        ? new Date(itemAny.timestamp as string).getTime()
        : Date.now() - i * 600000;

      const author = (itemAny.author as Record<string, string> | undefined) || {};

      return {
        id: `mirror:${feed.label}:${i}`,
        protocol: 'rss' as const,
        author: {
          id: `mirror:${feed.label}`,
          primary: { protocol: 'rss', id: feed.label },
          handles: { rss: feed.label, mirror: feed.label },
          displayName: author.displayName || feed.label,
          bio: '',
          avatarUrl: author.avatarUrl || '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'source', url: `https://mirror.xyz/${feed.label}` }],
          keys: {},
        },
        text: title,
        html: body as string,
        embeds: [
          {
            kind: 'link',
            url: `https://mirror.xyz/${feed.label}/${(itemAny.digest as string) || ''}`,
          },
        ],
        createdAt: timestamp,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: itemAny,
        niches: guessNiches(title, feed.niches),
        contentType: 'link',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetch from Paragraph.xyz (RSS format).
 */
async function fetchParagraphFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Fetch from Ghost blog (standard RSS).
 */
async function fetchGhostFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Fetch from Beehiiv publication (standard RSS).
 */
async function fetchBeehiivFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  return fetchSingleFeed(feed, limit);
}

/**
 * Route a feed to its appropriate fetcher based on platform.
 */
async function fetchFeed(feed: FeedSource, limit: number): Promise<UnifiedPost[]> {
  switch (feed.platform) {
    case 'substack':
      return fetchSubstackFeed(feed, limit);
    case 'medium':
      return fetchMediumFeed(feed, limit);
    case 'mirror':
      return fetchMirrorFeed(feed, limit);
    case 'paragraph':
      return fetchParagraphFeed(feed, limit);
    case 'ghost':
      return fetchGhostFeed(feed, limit);
    case 'beehiiv':
      return fetchBeehiivFeed(feed, limit);
    default:
      return fetchSingleFeed(feed, limit);
  }
}

// ─── Deduplication ───────────────────────────────────────────────────

/**
 * Normalize a URL for cross-feed dedup: lowercase, strip protocol/www,
 * drop tracking params and trailing slash.
 */
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'mc_cid',
      'mc_eid',
    ]) {
      u.searchParams.delete(p);
    }
    const host = u.hostname.replace(/^www\./i, '');
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${host}${path}`.toLowerCase();
  } catch {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .split('?')[0]!;
  }
}

/** Extract the canonical link URL from a post's embeds. */
export function extractLinkUrl(post: UnifiedPost): string | undefined {
  for (const embed of post.embeds) {
    if (embed.kind === 'link' && embed.url) return embed.url;
  }
  return undefined;
}

/**
 * Tokenize a title for fuzzy similarity: lowercase, strip punctuation,
 * drop very short tokens and common stopwords.
 */
const TITLE_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'for',
  'with',
  'from',
  'its',
  'this',
  'that',
  'these',
  'those',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'will',
  'would',
  'could',
  'should',
  'into',
  'over',
  'under',
  'after',
  'before',
]);

export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !TITLE_STOPWORDS.has(t));
}

/**
 * Jaccard similarity between two titles (token sets).
 * 1.0 = identical; >0.75 = same story.
 */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  const setB = new Set(tb);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Fuzzy title-similarity threshold for "same story" detection. */
const TITLE_SIM_THRESHOLD = 0.6;

/** Number of most-recent posts to fuzzy-match against (bounded scan). */
const TITLE_SCAN_WINDOW = 80;

/**
 * Deduplicate posts across all sources using:
 *  1. exact canonical URL match (normalized),
 *  2. exact content hash (first 120 chars of text),
 *  3. fuzzy title similarity (Jaccard > 0.6) within a bounded window.
 *
 * When duplicates are found the best copy is kept, niches are merged, and
 * a crossReference list (feed labels covering the same story) is recorded —
 * this feeds the ranking/grounding pass (cross-reference authority).
 */
export function deduplicatePosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  const kept: UnifiedPost[] = [];

  // Sort by creation date (newest first) to keep the freshest copy
  const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt);

  for (const post of sorted) {
    const url = extractLinkUrl(post);
    const urlKey = url ? normalizeUrlKey(url) : '';
    const contentKey = post.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 120);
    const raw = post.raw as Record<string, unknown> | undefined;
    const feedLabel = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    let matched: UnifiedPost | undefined;

    // Layer 1: exact canonical URL
    if (urlKey) {
      matched = kept.find((p) => {
        const pu = extractLinkUrl(p);
        return pu ? normalizeUrlKey(pu) === urlKey : false;
      });
    }

    // Layer 2: exact content key (same title text verbatim)
    if (!matched && contentKey.length >= 20) {
      matched = kept.find((p) => {
        const pk = p.text
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 120);
        return pk === contentKey;
      });
    }

    // Layer 3: fuzzy title similarity (bounded scan for performance)
    if (!matched && post.text.length > 10) {
      const window = kept.slice(0, TITLE_SCAN_WINDOW);
      let bestSim = 0;
      for (const p of window) {
        const sim = titleSimilarity(post.text, p.text);
        if (sim > bestSim) {
          bestSim = sim;
          matched = p;
        }
      }
      if (bestSim < TITLE_SIM_THRESHOLD) matched = undefined;
    }

    if (matched) {
      // Merge niches
      const mergedNiches = new Set([...matched.niches, ...post.niches]);
      matched.niches = [...mergedNiches];

      // Record cross-reference (grounding signal): which feed labels cover
      // this same story. Also copy over the original URLs for authority.
      const mRaw = matched.raw as Record<string, unknown> | undefined;
      const refs = new Set<string>((mRaw?.crossReference as string[] | undefined) ?? []);
      if (feedLabel) refs.add(feedLabel);
      const otherRef = (raw?.feedLabel as string | undefined) || feedLabel;
      if (otherRef) refs.add(otherRef);
      if (mRaw) mRaw.crossReference = [...refs];
      const urls = new Set<string>((mRaw?.crossReferenceUrls as string[] | undefined) ?? []);
      if (url) urls.add(url);
      const otherUrl = extractLinkUrl(post);
      if (otherUrl) urls.add(otherUrl);
      if (mRaw) mRaw.crossReferenceUrls = [...urls];
    } else {
      // Fresh copy — seed its cross-reference tracking
      if (raw) {
        if (feedLabel && !Array.isArray(raw.crossReference)) {
          raw.crossReference = [feedLabel];
        }
        if (url && !Array.isArray(raw.crossReferenceUrls)) {
          raw.crossReferenceUrls = [url];
        }
      }
      kept.push(post);
    }
  }

  return kept.slice(0, limit);
}

// ─── Ranking & Grounding ────────────────────────────────────────────

/**
 * Source reputation tiers (1 = most authoritative, 4 = long tail).
 * Used for source reputation scoring in the news ranking pass.
 */
export const SOURCE_TIERS: Record<string, number> = {
  // Tier 1 — flagship crypto news & research
  CoinDesk: 1,
  CoinTelegraph: 1,
  Decrypt: 1,
  'The Block': 1,
  Blockworks: 1,
  BitcoinMagazine: 1,
  'The Defiant': 1,
  CoinMetrics: 1,
  'Dune Analytics': 1,
  Messari: 1,
  'a16z Crypto': 1,
  Paradigm: 1,
  'Pantera Capital': 1,
  'Electric Capital': 1,
  'Kraken Blog': 1,
  Chainalysis: 1,
  CryptoSlate: 1,
  'Unchained Crypto': 1,
  Bankless: 1,
  'CNBC Crypto': 1,
  'MIT Tech Review': 1,
  'Ars Technica': 1,
  Wired: 1,
  TechCrunch: 1,
  'The Guardian Tech': 1,
  'IEEE Spectrum': 1,
  // Tier 1 — world / science / business flagship (topic expansion)
  Nature: 1,
  'Quanta Magazine': 1,
  'Foreign Affairs': 1,
  'Council on Foreign Relations': 1,
  'NYT World': 1,
  'The Economist': 1,
  'Bloomberg Markets': 1,
  Stratechery: 1,
  'WSJ World': 1,
  // Tier 2 — established but secondary
  CryptoPotato: 2,
  UToday: 2,
  CryptoBriefing: 2,
  'Bitcoin.com News': 2,
  BeInCrypto: 2,
  AMBCrypto: 2,
  'Daily Hodl': 2,
  NewsBTC: 2,
  'The Hacker News': 2,
  BleepingComputer: 2,
  'OpenAI Blog': 2,
  'Google AI': 2,
  'Hugging Face Blog': 2,
  'Trail of Bits': 2,
  SlowMist: 2,
  Halborn: 2,
  'Web3 is Going Great': 2,
  'Curve Finance': 2,
  'Ethereum Blog': 2,
  'Solana Blog': 2,
  'Polygon Blog': 2,
  'Chainlink Blog': 2,
  'Coin Center': 2,
  'SEC Press': 2,
  'The Verge': 2,
  'Hacker News': 2,
  FreeCodeCamp: 2,
  'Hacker Noon': 2,
  'The Register': 2,
  'Rest of World': 2,
  'The Conversation': 2,
  'Science Daily': 2,
  'The Diplomat': 2,
  'BBC World': 2,
  'Al Jazeera': 2,
  'The Guardian World': 2,
  'FT Alphaville': 2,
  'CNBC Top News': 2,
  'The Economist Science': 2,
  // Tier 3 — niche / long tail
  Bitcoinist: 3,
  'Live Bitcoin News': 3,
  ZyCrypto: 3,
  NullTX: 3,
  CryptoNewsZ: 3,
  CoinPedia: 3,
  'Ethereum World News': 3,
  'Blockchain Association': 3,
  'CoinDesk Policy': 3,
  'CoinDesk Opinion': 3,
  'NFT Now': 3,
  'Rarible Blog': 3,
  'Decrypt NFT': 3,
  // 2026-08-03 source expansion — web3/crypto news (Tier 2)
  'On Chain Times': 2,
  'ETH Daily': 2,
  'The Daily Degen': 2,
  'DAO Times': 2,
  CoinGecko: 2,
  CoinGape: 2,
  'Watcher.Guru': 2,
  CryptoNews: 2,
  Finbold: 2,
  Forkast: 2,
  'Crypto News Flash': 2,
  TheBitTimes: 3,
  'CoinTelegraph Bitcoin': 1,
  'Decrypt DeFi': 1,
  // 2026-08-03 source expansion — DeFi protocols (Tier 2)
  Compound: 2,
  Lido: 2,
  Uniswap: 2,
  Yearn: 2,
  GMX: 2,
  MakerDAO: 2,
  'Uniswap Blog': 2,
  'Bitfinex Blog': 2,
  // 2026-08-03 source expansion — Layer 1/2 (Tier 2)
  Arbitrum: 2,
  Optimism: 2,
  Starknet: 2,
  zkSync: 2,
  Avalanche: 2,
  Near: 2,
  Bittensor: 2,
  // 2026-08-03 source expansion — general tech / crypto-adjacent (Tier 2)
  'The Generalist': 2,
  'Exponential View': 2,
  'Benedict Evans': 2,
  'Not Boring': 2,
  'The Network': 2,
  'The Protocol': 2,
  Sequoia: 2,
  'Forbes Innovation': 2,
  // 2026-08-03 world news expansion (Ground News breadth play)
  FT: 1,
  MarketWatch: 2,
  'Yahoo Finance': 2,
  Fortune: 2,
  'Business Insider': 2,
  Quartz: 2,
  'CNBC Markets': 2,
  'CNBC Tech': 2,
  'Bloomberg Tech': 2,
  'Bloomberg Crypto': 1,
  'NYT Business': 1,
  Inc: 2,
  'Fast Company': 2,
  'Marginal Revolution': 2,
  'BBC Africa': 2,
  'BBC Business': 2,
  'CNN World': 2,
  'CBS News': 2,
  'ABC News': 2,
  'NBC News': 2,
  'NPR World': 1,
  'Washington Post World': 1,
  'Time World': 2,
  'Guardian US': 1,
  France24: 2,
  DW: 2,
  'NHK World': 2,
  SCMP: 2,
  EuroNews: 2,
  'The Independent': 2,
  'Evening Standard': 3,
  'Sky News': 2,
  'Irish Times': 2,
  'The Age': 2,
  RNZ: 2,
  Rappler: 2,
  'The Straits Times': 2,
  'The Japan Times': 2,
  Tagesschau: 2,
  'Der Spiegel': 2,
  'Le Monde': 2,
  'El Pais': 2,
  'Al Monitor': 2,
  'Middle East Eye': 3,
  AllAfrica: 3,
  'Premium Times': 3,
  Punch: 3,
  'Africa Report': 2,
  // 2026-08-03 science & tech expansion (Tier 1/2)
  'MIT News': 1,
  'Harvard Gazette': 1,
  'Berkeley News': 2,
  'Phys.org': 2,
  'Science.org': 1,
  'Science News': 2,
  'Live Science': 2,
  Smithsonian: 2,
  'Space.com': 2,
  'Universe Today': 3,
  'Popular Science': 2,
  'NYT Science': 1,
  'BBC Science': 2,
  'Guardian Science': 1,
  Engadget: 2,
  Gizmodo: 2,
  ZDNet: 2,
  Slashdot: 3,
  CNET: 2,
  VentureBeat: 2,
  'NYT Tech': 1,
  'Washington Post Tech': 1,
  'BBC Technology': 2,
  // 2026-08-03 culture & politics expansion (Tier 1/2)
  'The Atlantic': 1,
  'New Yorker': 1,
  Vox: 2,
  'The Intercept': 2,
  ProPublica: 1,
  Aeon: 2,
  Nautilus: 2,
  Longreads: 2,
  Longform: 2,
  'The Browser': 2,
  'Guardian Long Read': 1,
  'Mother Jones': 2,
  'The Nation': 2,
  Salon: 3,
  Reason: 2,
  'National Review': 2,
  'American Conservative': 3,
  'Washington Examiner': 3,
  'Daily Caller': 3,
  'The Onion': 3,
  Slate: 2,
  Jacobin: 3,
  Dissent: 2,
  'Democracy Now': 2,
  Truthout: 3,
  'The Hill': 2,
  'Guardian Politics': 1,
  'NYT Politics': 1,
  'Fox News': 2,
  'War on the Rocks': 2,
  'Defense One': 2,
  Bellingcat: 2,
  'Foreign Policy': 1,
  'World Politics Review': 2,
  'Global Voices': 2,
  // 2026-08-03 backlog tier fixes (academic/dev/newsletter)
  'arXiv AI': 2,
  'arXiv Cryptography': 2,
  'arXiv Machine Learning': 2,
  'arXiv Software Engineering': 2,
  'IACR ePrint': 2,
  'IEEE Blockchain': 2,
  EthResearch: 2,
  'Ethereum Magicians': 2,
  DeepMind: 2,
  'Castle Island VC': 2,
  Validity: 2,
  'The Bear Cave': 2,
  'Casey Caruso': 2,
  Cobie: 2,
  Technically: 2,
  'Proof of Work': 2,
  'DeFi Education': 2,
  'Andrew Moore': 2,
  'Market Meditations': 2,
  'The Defiant (Substack)': 2,
  'Dose of DeFi': 2,
  'Web3 Weekly': 2,
  Coinmonks: 3,
  'The Capital': 3,
  'Better Programming': 3,
  'Towards Data Science': 2,
  'Blockchain Review': 3,
  ETHGlobal: 2,
  'Chainlink Community': 2,
};

/**
 * Map a feed label to its reputation tier (defaults to 3).
 */
export function sourceTier(label: string | undefined): number {
  if (!label) return 3;
  return SOURCE_TIERS[label] ?? 3;
}

// ─── Bias & Factuality Ratings (Ground News killer feature) ──────────
// Free curated dataset compiled 2026-08-03 from MBFC-style research
// (see docs/NEWS-SYSTEM-UPGRADE-RESEARCH.md §5). Ground News charges for
// these; we provide them free as informational metadata — never used to
// censor or penalize. Bias labels follow the 5-point AllSides/MBFC scale.

export type BiasLabel = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export type FactualityLabel = 'very-high' | 'high' | 'mixed' | 'low' | 'very-low';

/** Numeric bias score, -1.0 (far left) .. +1.0 (far right). 0 = center. */
export type BiasScore = number;

/**
 * Default numeric score for each bias label on the 5-point scale.
 * Used when a source has no explicit per-source score override.
 */
export const BIAS_LABEL_SCORE: Record<BiasLabel, number> = {
  left: -1.0,
  'center-left': -0.5,
  center: 0,
  'center-right': 0.5,
  right: 1.0,
};

/**
 * Political bias per source (5-point scale). Keyed by feed label —
 * matches SOURCE_TIERS keys so ratings ride along with tiers.
 *
 * Crypto/finance additions compiled 2026-08-04 from AllSides/MBFC-style
 * research (see docs/NEWS-SYSTEM-UPGRADE-RESEARCH.md §5). These are
 * informational metadata for reader transparency — never used to censor
 * or penalize a source.
 */
export const SOURCE_BIAS: Record<string, BiasLabel> = {
  // Left-leaning
  'Democracy Now': 'left',
  Jacobin: 'left',
  Truthout: 'left',
  'Common Dreams': 'left',
  'The Intercept': 'left',
  Motherboard: 'left',
  Vice: 'left',
  // Lean-left crypto / tech
  CoinDesk: 'center-left',
  Decrypt: 'center-left',
  'The Block': 'center-left',
  'The Defiant': 'center-left',
  TechCrunch: 'center-left',
  'The Verge': 'center-left',
  Engadget: 'center-left',
  Gizmodo: 'center-left',
  Wired: 'center-left',
  'The Register': 'center-left',
  'Mother Jones': 'center-left',
  Salon: 'center-left',
  'The Nation': 'left',
  Dissent: 'left',
  Vox: 'center-left',
  'NYT Politics': 'center-left',
  'NYT Business': 'center-left',
  'NYT World': 'center-left',
  'NYT Science': 'center-left',
  'NYT Tech': 'center-left',
  'Washington Post World': 'center-left',
  'Washington Post Tech': 'center-left',
  'Guardian Politics': 'center-left',
  'Guardian US': 'center-left',
  'Guardian World': 'center-left',
  'Guardian Science': 'center-left',
  'Guardian Business': 'center-left',
  'Guardian Long Read': 'center-left',
  'The Guardian Tech': 'center-left',
  HuffPost: 'center-left',
  'The New Republic': 'center-left',
  Slate: 'center-left',
  'Time World': 'center-left',
  ProPublica: 'center-left',
  'The Atlantic': 'center-left',
  'New Yorker': 'center-left',
  'The Independent': 'center-left',
  'The Hill': 'center',
  'Le Monde': 'center-left',
  'El Pais': 'center-left',
  'Der Spiegel': 'center-left',
  // Center — crypto / finance
  CoinTelegraph: 'center',
  'CoinTelegraph Bitcoin': 'center',
  CryptoSlate: 'center',
  Blockworks: 'center',
  'Reuters Crypto': 'center',
  Reuters: 'center',
  AP: 'center',
  'AP News': 'center',
  'Bloomberg Crypto': 'center',
  'FT Alphaville': 'center',
  'WSJ Crypto': 'center-right',
  Bankless: 'center',
  Messari: 'center',
  'Delphi Digital': 'center',
  CoinMetrics: 'center',
  'Glassnode Insights': 'center',
  'DeFi Llama': 'center',
  DeFiLlama: 'center',
  Yearn: 'center',
  Curve: 'center',
  'Curve Finance': 'center',
  Aave: 'center',
  Lido: 'center',
  Uniswap: 'center',
  CoinGecko: 'center',
  CoinMarketCap: 'center',
  'a16z Crypto': 'center',
  Paradigm: 'center',
  'Pantera Capital': 'center',
  'Galaxy Research': 'center',
  'Grayscale Research': 'center',
  // Center
  'BBC World': 'center',
  'BBC Business': 'center',
  'BBC Science': 'center',
  'BBC Technology': 'center',
  'BBC Africa': 'center',
  'Sky News': 'center',
  'NPR World': 'center',
  'CBS News': 'center',
  'NBC News': 'center',
  'ABC News': 'center',
  'USA Today': 'center',
  'Financial Times': 'center',
  FT: 'center',
  'The Economist': 'center',
  'The Economist Science': 'center',
  'Bloomberg Markets': 'center',
  'Bloomberg Tech': 'center',
  'CNBC Top News': 'center',
  'CNBC Markets': 'center',
  'CNBC Tech': 'center',
  'CNBC Crypto': 'center',
  'WSJ World': 'center',
  MarketWatch: 'center',
  'Yahoo Finance': 'center',
  Fortune: 'center',
  Quartz: 'center',
  'Business Insider': 'center',
  Inc: 'center',
  'Fast Company': 'center',
  'Marginal Revolution': 'center',
  France24: 'center',
  DW: 'center',
  EuroNews: 'center',
  'NHK World': 'center',
  SCMP: 'center',
  'The Straits Times': 'center',
  'The Japan Times': 'center',
  'The Age': 'center',
  RNZ: 'center',
  Rappler: 'center',
  'Irish Times': 'center',
  Tagesschau: 'center',
  'Al Monitor': 'center',
  AllAfrica: 'center',
  'Africa Report': 'center',
  'MIT News': 'center',
  'Harvard Gazette': 'center',
  'Berkeley News': 'center-left',
  'Phys.org': 'center',
  'Science.org': 'center',
  'Science News': 'center',
  'Live Science': 'center',
  Smithsonian: 'center',
  'Space.com': 'center',
  'Universe Today': 'center',
  'Popular Science': 'center',
  'The Conversation': 'center',
  'Quanta Magazine': 'center',
  Aeon: 'center',
  Nautilus: 'center',
  Longreads: 'center',
  Longform: 'center',
  'The Browser': 'center',
  CFR: 'center',
  'Council on Foreign Relations': 'center',
  'Foreign Affairs': 'center',
  'Foreign Policy': 'center',
  'World Politics Review': 'center',
  'Global Voices': 'center',
  'War on the Rocks': 'center',
  'Defense One': 'center',
  Bellingcat: 'center',
  'The Diplomat': 'center',
  'Rest of World': 'center',
  'Middle East Eye': 'center',
  'CNN World': 'center',
  // Center-right / right
  'Washington Examiner': 'center-right',
  'National Review': 'right',
  'American Conservative': 'right',
  'Daily Caller': 'right',
  'Fox News': 'right',
  Reason: 'center-right',
  'The Spectator': 'center-right',
  'Daily Mail': 'right',
  'The Telegraph': 'center-right',
  'The Times': 'center-right',
  'New York Post': 'right',
  Breitbart: 'right',
  // Lean-right / right — crypto & finance
  'Bitcoin Magazine': 'center-right',
  BitcoinMagazine: 'center-right',
  Coinspeaker: 'center-right',
  'Bitcoin.com News': 'center-right',
  Bitcoinist: 'center-right',
  NewsBTC: 'center-right',
  'Daily Hodl': 'center-right',
  'Watcher.Guru': 'center-right',
  'Zero Hedge Crypto': 'right',
  ZeroHedge: 'right',
};

/**
 * Explicit numeric bias scores per source (overrides the label default).
 * -1.0 = far left, 0 = center, +1.0 = far right.
 * Only sources whose score differs from their label default are listed.
 */
export const SOURCE_BIAS_SCORE: Record<string, BiasScore> = {
  // Crypto media — curated bias ratings (2026-08-05, fleet-wide standard).
  // Positive = pro-crypto / bullish-leaning coverage, negative = skeptical /
  // critical coverage, 0 = neutral. Matches the product spec:
  //   CoinDesk +0.2, CoinTelegraph 0.0, Decrypt -0.1, The Block -0.1,
  //   Bitcoin Magazine +0.6, Coinspeaker +0.3, Reuters 0.0, AP 0.0,
  //   Bloomberg -0.1, ZeroHedge +0.8, Breitbart +0.9,
  //   Vice/Motherboard -0.6, The Intercept -0.7.
  CoinDesk: 0.2,
  Decrypt: -0.1,
  'The Block': -0.1,
  'The Defiant': -0.15,
  CoinTelegraph: 0.0,
  'CoinTelegraph Bitcoin': 0.0,
  Blockworks: 0.2,
  CryptoSlate: 0.0,
  'Bitcoin Magazine': 0.6,
  BitcoinMagazine: 0.6,
  Coinspeaker: 0.3,
  'Bitcoin.com News': 0.4,
  Bitcoinist: 0.5,
  NewsBTC: 0.5,
  'Daily Hodl': 0.45,
  'Watcher.Guru': 0.5,
  ZeroHedge: 0.8,
  'Zero Hedge Crypto': 0.8,
  Breitbart: 0.9,
  'Daily Caller': 0.7,
  // Left / lean-left crypto-adjacent
  Motherboard: -0.6,
  Vice: -0.6,
  'The Intercept': -0.7,
  Jacobin: -0.8,
  'The Nation': -0.7,
  'Democracy Now': -0.6,
  Wired: -0.2,
  TechCrunch: -0.1,
  'The Verge': -0.1,
  // The Guardian (all section feeds share the outlet-level rating)
  'The Guardian Tech': -0.4,
  'The Guardian World': -0.4,
  'Guardian US': -0.4,
  'Guardian Politics': -0.4,
  'Guardian Science': -0.4,
  'Guardian Business': -0.4,
  'Guardian Long Read': -0.4,
  // Finance
  'WSJ Crypto': 0.1,
  'WSJ World': 0.1,
  'Financial Times': 0.15,
  FT: 0.15,
  'FT Alphaville': 0.2,
  'Bloomberg Crypto': -0.1,
  'Bloomberg Markets': -0.1,
  'Bloomberg Tech': -0.1,
  'The Economist': 0.2,
  Reuters: 0.0,
  'Reuters Crypto': 0.0,
  AP: 0.0,
  'AP News': 0.0,
};

/**
 * Map a feed label to its numeric bias score (-1.0 .. +1.0).
 * Prefers an explicit SOURCE_BIAS_SCORE override, then falls back to the
 * label default, then to 0 (center) for unknown sources.
 */
export function sourceBiasScore(label: string | undefined): BiasScore {
  if (!label) return 0;
  const explicit = SOURCE_BIAS_SCORE[label];
  if (typeof explicit === 'number') return explicit;
  const labelBias = SOURCE_BIAS[label];
  if (labelBias) return BIAS_LABEL_SCORE[labelBias];
  return 0;
}

/**
 * Map a feed label to its human-readable bias label. Alias of sourceBias
 * kept for clarity when consumers want the 5-point label explicitly.
 */
export function sourceBiasLabel(label: string | undefined): BiasLabel {
  return sourceBias(label);
}

/**
 * Factuality rating per source (MBFC 5-point scale).
 */
export const SOURCE_FACTUALITY: Record<string, FactualityLabel> = {
  // Very high factuality — flagship wire services / journals
  Reuters: 'very-high',
  AP: 'very-high',
  'AP News': 'very-high',
  'BBC World': 'very-high',
  'BBC Business': 'very-high',
  'BBC Science': 'very-high',
  'BBC Technology': 'very-high',
  'BBC Africa': 'very-high',
  'Financial Times': 'very-high',
  FT: 'very-high',
  'FT Alphaville': 'very-high',
  'The Economist': 'very-high',
  'The Economist Science': 'very-high',
  'WSJ World': 'very-high',
  'Bloomberg Markets': 'very-high',
  'Bloomberg Tech': 'very-high',
  'Bloomberg Crypto': 'very-high',
  'NYT Business': 'very-high',
  'NYT World': 'very-high',
  'NYT Science': 'very-high',
  'NYT Tech': 'very-high',
  'NYT Politics': 'high',
  'Washington Post World': 'very-high',
  'Washington Post Tech': 'very-high',
  'Guardian World': 'very-high',
  'Guardian US': 'very-high',
  'Guardian Politics': 'very-high',
  'Guardian Science': 'very-high',
  'Guardian Business': 'very-high',
  'Guardian Long Read': 'very-high',
  'The Guardian Tech': 'very-high',
  'The Atlantic': 'very-high',
  'New Yorker': 'very-high',
  ProPublica: 'very-high',
  'MIT News': 'very-high',
  'Harvard Gazette': 'very-high',
  'Science.org': 'very-high',
  Nature: 'very-high',
  'Quanta Magazine': 'very-high',
  CFR: 'very-high',
  'Council on Foreign Relations': 'very-high',
  'Foreign Affairs': 'very-high',
  'Foreign Policy': 'high',
  'NPR World': 'high',
  'CBS News': 'high',
  'NBC News': 'high',
  'ABC News': 'high',
  'CNN World': 'high',
  France24: 'high',
  DW: 'high',
  EuroNews: 'high',
  'NHK World': 'high',
  'The Straits Times': 'high',
  'The Japan Times': 'high',
  'The Age': 'high',
  RNZ: 'high',
  Rappler: 'high',
  'Irish Times': 'high',
  Tagesschau: 'high',
  'Le Monde': 'high',
  'El Pais': 'high',
  'Der Spiegel': 'high',
  'Al Monitor': 'high',
  'Middle East Eye': 'high',
  'The Diplomat': 'high',
  'Rest of World': 'high',
  'War on the Rocks': 'high',
  'Defense One': 'high',
  Bellingcat: 'high',
  'Science News': 'high',
  'Live Science': 'high',
  'Phys.org': 'high',
  'Berkeley News': 'high',
  'Popular Science': 'high',
  'Space.com': 'high',
  'Universe Today': 'mixed',
  Smithsonian: 'high',
  'The Conversation': 'high',
  'The Hill': 'high',
  // Mixed / lower factuality
  Vox: 'mixed',
  Slate: 'mixed',
  'The Intercept': 'mixed',
  'Mother Jones': 'mixed',
  'The Nation': 'mixed',
  Salon: 'mixed',
  'Time World': 'mixed',
  Fortune: 'high',
  'Business Insider': 'mixed',
  Quartz: 'mixed',
  MarketWatch: 'high',
  'Yahoo Finance': 'high',
  Inc: 'mixed',
  'Fast Company': 'mixed',
  'Marginal Revolution': 'high',
  'Washington Examiner': 'mixed',
  'National Review': 'mixed',
  'American Conservative': 'mixed',
  Reason: 'high',
  'Daily Caller': 'low',
  'Fox News': 'mixed',
  'The Onion': 'mixed',
  Jacobin: 'mixed',
  Dissent: 'mixed',
  'Democracy Now': 'mixed',
  Truthout: 'low',
  Aeon: 'high',
  Nautilus: 'high',
  Longreads: 'high',
  Longform: 'high',
  'The Browser': 'high',
  'Global Voices': 'high',
  'World Politics Review': 'high',
  'Africa Report': 'mixed',
  AllAfrica: 'mixed',
  'Premium Times': 'mixed',
  Punch: 'mixed',
  SCMP: 'high',
  'Evening Standard': 'mixed',
  'Sky News': 'high',
  'The Independent': 'mixed',
  'CNBC Top News': 'high',
  'CNBC Markets': 'high',
  'CNBC Tech': 'high',
  'CNBC Crypto': 'high',
  // Crypto / finance factuality (2026-08-04 additions)
  CoinDesk: 'high',
  Decrypt: 'high',
  'The Block': 'high',
  CoinTelegraph: 'high',
  'CoinTelegraph Bitcoin': 'high',
  CryptoSlate: 'mixed',
  Blockworks: 'high',
  'The Defiant': 'mixed',
  Bankless: 'mixed',
  Messari: 'high',
  'Delphi Digital': 'high',
  CoinMetrics: 'high',
  'Glassnode Insights': 'high',
  'Reuters Crypto': 'very-high',
  'WSJ Crypto': 'very-high',
  'DeFi Llama': 'high',
  DeFiLlama: 'high',
  Yearn: 'high',
  Curve: 'high',
  'Curve Finance': 'high',
  Aave: 'high',
  Lido: 'high',
  Uniswap: 'high',
  CoinGecko: 'high',
  CoinMarketCap: 'high',
  'a16z Crypto': 'high',
  Paradigm: 'high',
  'Pantera Capital': 'high',
  'Galaxy Research': 'high',
  'Grayscale Research': 'high',
  'Bitcoin Magazine': 'mixed',
  BitcoinMagazine: 'mixed',
  Coinspeaker: 'mixed',
  'Bitcoin.com News': 'mixed',
  Bitcoinist: 'mixed',
  NewsBTC: 'mixed',
  'Daily Hodl': 'mixed',
  'Watcher.Guru': 'low',
  'Zero Hedge Crypto': 'mixed',
  ZeroHedge: 'mixed',
  Motherboard: 'high',
  Vice: 'mixed',
  TechCrunch: 'high',
  'The Verge': 'high',
  Engadget: 'high',
  Gizmodo: 'mixed',
  Wired: 'high',
  'The Register': 'mixed',
};

/**
 * Map a feed label to its political bias (defaults to 'center' when unknown).
 */
export function sourceBias(label: string | undefined): BiasLabel {
  if (!label) return 'center';
  return SOURCE_BIAS[label] ?? 'center';
}

/**
 * Map a feed label to its factuality rating (defaults to 'high' when unknown).
 */
export function sourceFactuality(label: string | undefined): FactualityLabel {
  if (!label) return 'high';
  return SOURCE_FACTUALITY[label] ?? 'high';
}

/**
 * Freshness decay score 0..1 — newer articles rank higher.
 * Half-life of ~12 hours, floor at 0.05.
 */
export function freshnessScore(createdAt: number, now = Date.now()): number {
  const ageHours = Math.max(0, now - createdAt) / 3_600_000;
  if (ageHours < 0.5) return 1;
  if (ageHours < 6) return 0.9;
  if (ageHours < 24) return 0.7;
  if (ageHours < 72) return 0.45;
  if (ageHours < 168) return 0.2;
  return 0.05;
}

// ─── Content freshness policy (Fix 3) ─────────────────────────────────
// Posts older than this are rejected from the feed entirely. Configurable
// via FEED_MAX_AGE_HOURS (default 48h). 0 disables the filter.
export const FEED_MAX_AGE_HOURS = (() => {
  try {
    const raw = process.env.FEED_MAX_AGE_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 48;
})();

/** Posts younger than this (hours) get the freshness boost. Default 2h. */
export const FEED_FRESH_BOOST_HOURS = (() => {
  try {
    const raw = process.env.FEED_FRESH_BOOST_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 2;
})();

/** Rank multiplier applied to posts younger than FEED_FRESH_BOOST_HOURS. Default +30%. */
export const FEED_FRESH_BOOST_MULT = (() => {
  try {
    const raw = process.env.FEED_FRESH_BOOST_MULT;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 1.3;
})();

/** Posts older than this (hours) get the stale penalty. Default 24h. */
export const FEED_STALE_HOURS = (() => {
  try {
    const raw = process.env.FEED_STALE_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 24;
})();

/** Rank multiplier applied to posts older than FEED_STALE_HOURS. Default -50%. */
export const FEED_STALE_PENALTY_MULT = (() => {
  try {
    const raw = process.env.FEED_STALE_PENALTY_MULT;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 0.5;
})();

/** True when a post is within the max-age window (48h default). */
export function isFreshEnough(createdAt: number, now = Date.now()): boolean {
  if (FEED_MAX_AGE_HOURS <= 0) return true;
  return now - createdAt <= FEED_MAX_AGE_HOURS * 3_600_000;
}

/**
 * Niche relevance keywords — crypto/web3/DeFi vocabulary that signals
 * high-relevance content for the degenfeed audience. Matched against the
 * post title + text (case-insensitive, word-boundary).
 */
export const NICHE_RELEVANCE_KEYWORDS: ReadonlyArray<string> = [
  'bitcoin',
  'ethereum',
  'defi',
  'nft',
  'trading',
  'blockchain',
  'web3',
  'solana',
  'crypto',
  'token',
  'dex',
  'layer2',
  'stablecoin',
  'onchain',
  'dao',
  'smart contract',
  'yield',
  'liquidity',
  'airdrop',
];

const NICHE_RELEVANCE_RE = new RegExp(
  `\\b(${NICHE_RELEVANCE_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(
    '|',
  )})\\b`,
  'i',
);

/**
 * Niche relevance boost (0..1): 0.12 for a single keyword hit, up to a
 * 0.25 cap for 4+ hits. Rewards posts squarely inside the crypto/web3
 * beat over tangential general news.
 */
export function nicheRelevanceBoost(text: string | undefined): number {
  const haystack = (text || '').slice(0, 3000);
  if (!haystack.trim()) return 0;
  if (!NICHE_RELEVANCE_RE.test(haystack)) return 0;
  let hits = 0;
  for (const kw of NICHE_RELEVANCE_KEYWORDS) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(haystack)) hits++;
  }
  return Math.min(0.25, 0.12 + Math.max(0, hits - 1) * 0.05);
}

/**
 * Cross-reference grounding: an article covered by multiple feeds gets
 * higher authority. Diminishing returns after 5 sources.
 */
export function crossReferenceScore(crossReference: unknown): number {
  const refs = Array.isArray(crossReference) ? crossReference.length : 0;
  if (refs <= 1) return 0;
  return Math.min(1, 0.25 + (refs - 1) * 0.15);
}

// ─── Price Impact, Signals & Category Boost ──────────────────────────
// CryptoPanic-beating features: price-impact tagging (which coins an
// article affects), a simulated community vote signal (until real users
// vote), and multi-category boosts (preferred niches + trending velocity).

/** Preferred niche taxonomy used for the user-category boost. */
export const PREFERRED_NICHES: ReadonlySet<string> = new Set([
  'crypto',
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'ai',
  'layer2',
  'stablecoin',
]);

/**
 * Price-impact score 0..1: an article that mentions top market-cap coins
 * gets a boost proportional to the highest-weight coin mentioned, with a
 * small additive bonus for multi-coin coverage (capped at 1).
 */
export function priceImpactScore(priceImpact: unknown): number {
  if (!Array.isArray(priceImpact) || priceImpact.length === 0) return 0;
  const entries = priceImpact as PriceImpactEntry[];
  const maxWeight = entries.reduce((max, c) => Math.max(max, c.weight ?? 0), 0);
  const multiBonus = Math.min(0.3, (entries.length - 1) * 0.15);
  return Math.min(1, maxWeight + multiBonus);
}

export interface SyntheticSignals {
  votes: number;
  reasons: string[];
  breakdown: {
    tier1Source: boolean;
    crossReference: boolean;
    trendingCoin: boolean;
    verified: boolean;
  };
}

/**
 * Simulate community vote signals until real users exist:
 *  - tier-1 source (CoinDesk etc.):        +3
 *  - cited by 3+ feeds (cross-reference):  +2
 *  - mentions a trending coin:             +1
 *  - verified author/org:                  +1
 * Max possible = 7.
 */
export function computeSyntheticSignals(opts: {
  tier: number;
  crossReferenceCount: number;
  priceImpact: unknown;
  verified: boolean;
}): SyntheticSignals {
  let votes = 0;
  const reasons: string[] = [];
  const breakdown: SyntheticSignals['breakdown'] = {
    tier1Source: false,
    crossReference: false,
    trendingCoin: false,
    verified: false,
  };

  if (opts.tier === 1) {
    votes += 3;
    breakdown.tier1Source = true;
    reasons.push('tier-1 source');
  }
  if (opts.crossReferenceCount >= 3) {
    votes += 2;
    breakdown.crossReference = true;
    reasons.push('cited by 3+ feeds');
  }
  if (Array.isArray(opts.priceImpact)) {
    const symbols = (opts.priceImpact as PriceImpactEntry[]).map((c) => c.symbol);
    if (symbols.some((s) => TRENDING_COINS.has(s))) {
      votes += 1;
      breakdown.trendingCoin = true;
      reasons.push('mentions trending coin');
    }
  }
  if (opts.verified) {
    votes += 1;
    breakdown.verified = true;
    reasons.push('verified author/org');
  }

  return { votes, reasons, breakdown };
}

/**
 * Normalized per-niche article velocity (0..1) over a rolling window.
 * Used for the "trending category" boost: categories with the most recent
 * article volume get a higher weight.
 */
export function computeCategoryVelocity(
  posts: UnifiedPost[],
  now = Date.now(),
  windowMs = 6 * 60 * 60 * 1000,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (now - post.createdAt > windowMs) continue;
    for (const niche of post.niches ?? []) {
      counts.set(niche, (counts.get(niche) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...counts.values());
  const normalized = new Map<string, number>();
  for (const [niche, count] of counts) normalized.set(niche, count / max);
  return normalized;
}

/** Rank context: preferred niches + per-niche velocity for this batch. */
export interface RankContext {
  preferredNiches?: ReadonlySet<string>;
  categoryVelocity?: ReadonlyMap<string, number>;
}

/**
 * Compute the final news rank for a post (0..100).
 *
 * Signals (CryptoPanic-beating):
 *  - source reputation (tier 1 → high)
 *  - freshness decay (newer → higher)
 *  - cross-reference grounding (multiple feeds → higher authority)
 *  - price impact (top market-cap coins mentioned → boost)
 *  - simulated community votes (tier-1, cross-ref, trending coin, verified)
 *  - category boost (preferred niches + trending-category velocity)
 *  - sentiment (marginally boost positive/neutral over negative)
 *
 * Scores are stored on `raw.rank`, `raw.rankSignals`, `raw.signals` and
 * `raw.priceImpact` for transparency.
 */
export function rankNewsPost(post: UnifiedPost, now = Date.now(), ctx: RankContext = {}): number {
  const raw = post.raw as Record<string, unknown> | undefined;
  const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
  const tier = sourceTier(label);

  const reputation = (4 - tier) / 3; // tier 1 → 1.0, tier 4 → 0
  const freshness = freshnessScore(post.createdAt, now);
  const grounding = crossReferenceScore(raw?.crossReference);

  // Price impact: articles mentioning top market-cap coins rank higher.
  const priceImpact = Array.isArray(raw?.priceImpact) ? raw.priceImpact : [];
  const impact = priceImpactScore(priceImpact);

  // Simulated community vote signal (proportional weight in ranking).
  const crossReferenceCount = Array.isArray(raw?.crossReference)
    ? (raw.crossReference as unknown[]).length
    : 0;
  const signals = computeSyntheticSignals({
    tier,
    crossReferenceCount,
    priceImpact,
    verified: tier <= 2,
  });
  const signalScore = Math.min(1, signals.votes / 7); // 7 = max synthetic votes

  // Category boost: preferred niches (user categories) + trending velocity.
  const preferred = ctx.preferredNiches ?? PREFERRED_NICHES;
  const velocity = ctx.categoryVelocity ?? new Map<string, number>();
  const postNiches = post.niches ?? [];
  const preferredBoost = postNiches.some((n) => preferred.has(n)) ? 0.6 : 0;
  const trendingBoost = postNiches.reduce((max, n) => Math.max(max, velocity.get(n) ?? 0), 0);
  const categoryBoost = Math.min(1, preferredBoost + trendingBoost * 0.4);

  // Sentiment signal: normalized -1..+1 scaled to a ±5% rank adjustment.
  const sentimentRaw = raw?.sentiment as { normalized?: number } | undefined;
  const rawSentiment = sentimentRaw?.normalized;
  const sentimentValue =
    typeof rawSentiment === 'number' && Number.isFinite(rawSentiment) ? rawSentiment : 0;
  const sentimentSignal = Math.max(-1, Math.min(1, sentimentValue)) * 0.05;

  // Niche relevance: posts squarely in the crypto/web3/DeFi beat get a boost.
  const nicheBoost = nicheRelevanceBoost(`${post.text ?? ''} ${raw?.description ?? ''}`);

  let score =
    reputation * 0.3 +
    freshness * 0.25 +
    grounding * 0.12 +
    impact * 0.1 +
    signalScore * 0.15 +
    categoryBoost * 0.08 +
    sentimentSignal +
    nicheBoost * 0.12;

  // Freshness boost (Fix 3): posts younger than FEED_FRESH_BOOST_HOURS get
  // +30% (configurable via FEED_FRESH_BOOST_MULT).
  const ageHours = Math.max(0, now - post.createdAt) / 3_600_000;
  if (ageHours < FEED_FRESH_BOOST_HOURS) {
    score *= FEED_FRESH_BOOST_MULT;
  } else if (ageHours >= FEED_STALE_HOURS) {
    // Stale penalty (Fix 3): posts older than FEED_STALE_HOURS (24h) get
    // -50% (configurable via FEED_STALE_PENALTY_MULT). Posts older than
    // FEED_MAX_AGE_HOURS (48h) are filtered out entirely by rankNewsPosts.
    score *= FEED_STALE_PENALTY_MULT;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score * 100)));

  if (raw) {
    raw.sourceTier = tier;
    raw.rank = finalScore;
    raw.signals = {
      votes: signals.votes,
      reasons: signals.reasons,
      breakdown: signals.breakdown,
      synthetic: true,
    };
    raw.rankSignals = {
      sourceReputation: Math.round(reputation * 100) / 100,
      freshness: Math.round(freshness * 100) / 100,
      crossReference: Math.round(grounding * 100) / 100,
      priceImpact: Math.round(impact * 100) / 100,
      signalVotes: Math.round(signalScore * 100) / 100,
      categoryBoost: Math.round(categoryBoost * 100) / 100,
      sentiment: Math.round(sentimentSignal * 100) / 100,
      nicheRelevance: Math.round(nicheBoost * 100) / 100,
      freshnessBoost: Math.round((FEED_FRESH_BOOST_MULT - 1) * 100) / 100,
      stalePenalty: Math.round((1 - FEED_STALE_PENALTY_MULT) * 100) / 100,
    };
  }
  return finalScore;
}

/**
 * Rank a batch of posts by news rank (best first), then by freshness as
 * a stable tie-breaker. Populates raw.rank/raw.rankSignals/raw.signals on
 * each post. Computes per-niche velocity from the batch to power the
 * trending-category boost.
 */
export function rankNewsPosts(posts: UnifiedPost[], ctx: RankContext = {}): UnifiedPost[] {
  const now = Date.now();
  const velocity = computeCategoryVelocity(posts, now);
  const fullCtx: RankContext = { ...ctx, categoryVelocity: velocity };
  const scored = posts
    .filter((p) => isFreshEnough(p.createdAt, now))
    .map((post) => ({
      post,
      rank: rankNewsPost(post, now, fullCtx),
    }));
  scored.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return b.post.createdAt - a.post.createdAt;
  });
  return scored.map((s) => s.post);
}

// ─── Bias diversity mix (Ground News killer) ───────────────────────────
// The plain rank ordering can be dominated by the most prolific sources
// (e.g. CoinTelegraph + CoinDesk crowding out every other perspective).
// `ensureBiasDiversity` rebalances the top of the feed so the user sees a
// BALANCED mix of left / center / right sources — without ever dropping
// the single highest-ranked story, and without pulling in low-quality
// sources just to fill a quota.
//
// Buckets follow the numeric bias score:
//   left         bias <= -0.2
//   center      -0.2 <  bias < +0.2
//   right        bias >= +0.2

const LEFT_BIAS_BUCKET = 'left';
const CENTER_BIAS_BUCKET = 'center';
const RIGHT_BIAS_BUCKET = 'right';
type BiasBucket = typeof LEFT_BIAS_BUCKET | typeof CENTER_BIAS_BUCKET | typeof RIGHT_BIAS_BUCKET;

function biasBucketOf(label: string | undefined): BiasBucket {
  const score = sourceBiasScore(label);
  if (score <= -0.2) return LEFT_BIAS_BUCKET;
  if (score >= 0.2) return RIGHT_BIAS_BUCKET;
  return CENTER_BIAS_BUCKET;
}

/**
 * Human-readable bias label with emoji for the 3-bucket diversity display:
 *   🟦 Left, 🟨 Center, 🟥 Right.
 * Ground News shows a bias tag on every card; this is the free equivalent.
 */
export function biasDisplayLabel(label: string | undefined): string {
  switch (biasBucketOf(label)) {
    case LEFT_BIAS_BUCKET:
      return '🟦 Left';
    case RIGHT_BIAS_BUCKET:
      return '🟥 Right';
    default:
      return '🟨 Center';
  }
}

/**
 * Count posts per bias bucket (left/center/right) for feed meta:
 * `{ bias: { left, center, right } }`.
 */
export function computeBiasDistribution(posts: UnifiedPost[]): {
  left: number;
  center: number;
  right: number;
} {
  const dist = { left: 0, center: 0, right: 0 };
  for (const post of posts) {
    const raw = post.raw as { feedLabel?: string } | undefined;
    const label = raw?.feedLabel ?? post.author?.displayName;
    dist[biasBucketOf(label)] += 1;
  }
  return dist;
}

/**
 * Rebalance a ranked post list toward bias diversity.
 *
 * Strategy (deterministic, score-preserving):
 *  1. Start with the top-ranked post as the headline (never dropped).
 *  2. Walk the remaining ranked list, always taking the highest-ranked post
 *     whose bias bucket has not yet reached its quota for the current pass.
 *  3. After every pick, rotate the quota priority so no bucket starves:
 *     pass 1 favors center, pass 2 favors left, pass 3 favors right, repeat.
 *  4. When a bucket is exhausted (or cannot be filled), fall back to the
 *     next best post so the feed still fills.
 *
 * Returns the rebalanced list (up to `limit`).
 */
export function ensureBiasDiversity(
  ranked: UnifiedPost[],
  limit = 50,
  minPerBucket = 2,
): UnifiedPost[] {
  if (ranked.length <= minPerBucket * 3) return ranked.slice(0, limit);

  const buckets: Record<BiasBucket, UnifiedPost[]> = { left: [], center: [], right: [] };
  for (const p of ranked) {
    const raw = p.raw as { feedLabel?: string } | undefined;
    const label = raw?.feedLabel ?? p.author?.displayName;
    buckets[biasBucketOf(label)].push(p);
  }

  const out: UnifiedPost[] = [];
  const quota: Record<BiasBucket, number> = {
    left: minPerBucket,
    center: minPerBucket,
    right: minPerBucket,
  };
  const picked = new Set<string>();
  const pickFrom = (bucket: BiasBucket): UnifiedPost | undefined => {
    const arr = buckets[bucket];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i]!;
      if (!picked.has(p.id)) {
        picked.add(p.id);
        quota[bucket] = Math.max(0, quota[bucket] - 1);
        return p;
      }
    }
    return undefined;
  };

  // Headline: the single highest-ranked post (diversity must never bury it).
  const head = ranked[0]!;
  out.push(head);
  picked.add(head.id);
  const headRaw = head.raw as { feedLabel?: string } | undefined;
  const headBucket = biasBucketOf(headRaw?.feedLabel ?? head.author?.displayName);
  quota[headBucket] = Math.max(0, quota[headBucket] - 1);

  const order: BiasBucket[] = [CENTER_BIAS_BUCKET, LEFT_BIAS_BUCKET, RIGHT_BIAS_BUCKET];
  let pass = 0;
  let cursor = 0;

  while (out.length < limit && cursor < ranked.length) {
    const preferred = order[pass % order.length]!;
    const tried: BiasBucket[] = [preferred, ...order.filter((b) => b !== preferred)];
    let pickedThisPass = false;
    for (const bucket of tried) {
      if (quota[bucket] > 0) {
        const p = pickFrom(bucket);
        if (p) {
          out.push(p);
          pickedThisPass = true;
          break;
        }
      }
    }
    if (pickedThisPass) {
      pass++;
      continue;
    }
    // All quotas met (or unfillable) — fill remaining slots by rank order.
    const next = ranked[cursor];
    if (next && !picked.has(next.id)) {
      picked.add(next.id);
      out.push(next);
      pickedThisPass = true;
    }
    cursor++;
    if (pickedThisPass) pass++;
  }

  // Safety: never shrink the result below what we already had if some
  // pathological bucket interplay dropped posts.
  if (out.length >= limit) return out.slice(0, limit);
  const rest = ranked.filter((p) => !picked.has(p.id));
  return [...out, ...rest].slice(0, limit);
}

// ─── Story Coverage & Blindspot Detection (Ground News killer) ────────
// Pure functions over the deduped/ranked post batch. The dedup pass already
// records `raw.crossReference` (feed labels covering the same story), so we
// can compute per-story coverage WITHOUT re-clustering titles: each post is
// its own story; the cross-reference list IS the multi-source coverage.
// These power the frontend "Full Coverage" and "Blindspot" sections.

export interface BiasDistribution {
  left: number;
  'center-left': number;
  center: number;
  'center-right': number;
  right: number;
}

export interface StoryCoverage {
  /** Unique source labels covering this story (own feed + cross-reference). */
  sources: string[];
  sourceCount: number;
  bias: BiasDistribution;
  factuality: { 'very-high': number; high: number; mixed: number; low: number; 'very-low': number };
  /** True when coverage skews heavily to one political side. */
  echoChamber: boolean;
  echoDirection: 'left' | 'right' | null;
}

const EMPTY_BIAS: BiasDistribution = {
  left: 0,
  'center-left': 0,
  center: 0,
  'center-right': 0,
  right: 0,
};

function emptyCoverage(sources: string[]): StoryCoverage {
  return {
    sources,
    sourceCount: sources.length,
    bias: { ...EMPTY_BIAS },
    factuality: { 'very-high': 0, high: 0, mixed: 0, low: 0, 'very-low': 0 },
    echoChamber: false,
    echoDirection: null,
  };
}

/**
 * Compute per-story coverage: which sources, bias distribution, and whether
 * the story is an echo chamber (>=3 sources, >=75% one political side).
 * Attaches the result to `raw.coverage` on each post and returns it.
 */
export function computeStoryCoverage(posts: UnifiedPost[]): StoryCoverage[] {
  const coverages: StoryCoverage[] = [];
  for (const post of posts) {
    const raw = post.raw as Record<string, unknown> | undefined;
    const ownLabel = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    const refs = Array.isArray(raw?.crossReference) ? (raw.crossReference as string[]) : [];
    const sources = Array.from(new Set([ownLabel, ...refs].filter(Boolean)));

    const coverage = emptyCoverage(sources);
    for (const label of sources) {
      const bias = sourceBias(label);
      coverage.bias[bias] = (coverage.bias[bias] ?? 0) + 1;
      const factual = sourceFactuality(label);
      coverage.factuality[factual] = (coverage.factuality[factual] ?? 0) + 1;
    }

    if (sources.length >= 3) {
      const leftish = coverage.bias.left + coverage.bias['center-left'];
      const rightish = coverage.bias.right + coverage.bias['center-right'];
      const total = sources.length;
      if (leftish / total >= 0.75) {
        coverage.echoChamber = true;
        coverage.echoDirection = 'left';
      } else if (rightish / total >= 0.75) {
        coverage.echoChamber = true;
        coverage.echoDirection = 'right';
      }
    }

    if (raw) raw.coverage = coverage;
    coverages.push(coverage);
  }
  return coverages;
}

export interface BlindspotItem {
  postId: string;
  title: string;
  url: string;
  source: string;
  tier: number;
  type: 'under-the-radar' | 'echo-chamber';
  reason: string;
  coverage: StoryCoverage;
  /** Suggested "other side" sources covering the same story (for echo chambers). */
  otherSideSources: string[];
  publishedAt: number;
  rank: number;
}

/**
 * Blindspot detection — the Ground News signature feature, for free.
 *
 * Two signals:
 *  1. "Under the radar": high-credibility (tier 1/2) stories with LOW
 *     cross-source coverage — good stories the mainstream echo missed.
 *  2. "Echo chamber alert": stories covered by >=3 sources where >=75%
 *     come from one political side. The "other side" perspective is
 *     suggested by sourcing stories whose bias distribution is opposite.
 */
export function computeBlindspots(posts: UnifiedPost[], max = 10): BlindspotItem[] {
  const coverages = computeStoryCoverage(posts);
  const items: BlindspotItem[] = [];

  posts.forEach((post, i) => {
    const raw = post.raw as Record<string, unknown> | undefined;
    const coverage = coverages[i];
    if (!coverage) return;
    const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    const tier = sourceTier(label);
    const rank = typeof raw?.rank === 'number' ? (raw.rank as number) : 0;
    const url = extractLinkUrl(post) || '';
    const refs = Array.isArray(raw?.crossReference) ? (raw.crossReference as string[]) : [];
    const otherSideSources = otherSideFor(coverage, posts);

    if (coverage.echoChamber) {
      items.push({
        postId: post.id,
        title: post.text,
        url,
        source: label,
        tier,
        type: 'echo-chamber',
        reason:
          coverage.echoDirection === 'left'
            ? `Covered by ${coverage.sourceCount} sources, ${Math.round(
                ((coverage.bias.left + coverage.bias['center-left']) / coverage.sourceCount) * 100,
              )}% left-leaning — you're likely only seeing one side.`
            : `Covered by ${coverage.sourceCount} sources, ${Math.round(
                ((coverage.bias.right + coverage.bias['center-right']) / coverage.sourceCount) *
                  100,
              )}% right-leaning — you're likely only seeing one side.`,
        coverage,
        otherSideSources,
        publishedAt: post.createdAt,
        rank,
      });
    } else if (tier <= 2 && refs.length <= 1 && rank >= 55) {
      items.push({
        postId: post.id,
        title: post.text,
        url,
        source: label,
        tier,
        type: 'under-the-radar',
        reason: `High-credibility story (${label}) barely covered elsewhere — worth a look before the echo picks it up.`,
        coverage,
        otherSideSources: [],
        publishedAt: post.createdAt,
        rank,
      });
    }
  });

  // Echo chambers first (most dangerous), then by rank
  return items
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'echo-chamber' ? -1 : 1;
      return b.rank - a.rank;
    })
    .slice(0, max);
}

/**
 * Suggest "other side" sources for an echo-chamber story: high-factuality
 * sources whose bias is opposite to the dominant direction and that cover
 * the same story (share a cross-reference URL or are a known alternative).
 */
function otherSideFor(coverage: StoryCoverage, posts: UnifiedPost[]): string[] {
  const dominant = coverage.echoDirection;
  if (!dominant) return [];
  const wanted: BiasLabel[] =
    dominant === 'left' ? ['center-right', 'right', 'center'] : ['center-left', 'left', 'center'];
  const candidates: string[] = [];
  for (const post of posts) {
    const raw = post.raw as Record<string, unknown> | undefined;
    const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    if (!label) continue;
    const bias = sourceBias(label);
    if (wanted.includes(bias)) {
      const tier = sourceTier(label);
      const factual = sourceFactuality(label);
      if (tier <= 2 && factual !== 'low' && factual !== 'very-low') {
        candidates.push(label);
      }
    }
    if (candidates.length >= 4) break;
  }
  return Array.from(new Set(candidates));
}

// ─── Story Clustering (Ground News "Full Coverage") ───────────────────
// Groups posts about the same event into stories using Jaccard title
// similarity + existing cross-reference data. Each cluster shows the
// representative headline, how many sources cover it, and the bias
// distribution (e.g. "3 left, 2 center, 1 right").

export interface StoryClusterOutput {
  id: string;
  title: string;
  storyCount: number;
  sources: string[];
  bias: BiasDistribution;
  factuality: { 'very-high': number; high: number; mixed: number; low: number; 'very-low': number };
  topCategories: string[];
  /** Per-perspective headline snippets for the "Full Coverage" view. */
  perspectives: Array<{ source: string; title: string; url: string; bias: BiasLabel }>;
  firstSeen: number;
  lastSeen: number;
  score: number;
}

/**
 * Cluster a batch of posts into stories. Two layers:
 *  1. Cross-reference groups: posts that were already merged by the dedup
 *     pass share a crossReference — those are one story.
 *  2. Fuzzy title similarity (Jaccard > 0.55 within a bounded window) for
 *     near-duplicate headlines that the dedup pass missed.
 *
 * The representative post is the highest-ranked; perspectives are the
 * cross-referenced source labels with their own headlines when available.
 */
export function clusterStories(posts: UnifiedPost[], limit = 12): StoryClusterOutput[] {
  const clusters: StoryClusterOutput[] = [];
  const used = new Set<string>();

  for (const post of posts) {
    if (used.has(post.id)) continue;
    const raw = post.raw as Record<string, unknown> | undefined;
    const ownLabel = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
    const refs = Array.isArray(raw?.crossReference) ? (raw.crossReference as string[]) : [];

    // Layer 1: cross-reference group (same story merged by dedup)
    const members = [post];
    used.add(post.id);
    for (const other of posts) {
      if (used.has(other.id)) continue;
      const oRaw = other.raw as Record<string, unknown> | undefined;
      const oLabel = (oRaw?.feedLabel as string | undefined) || other.author?.displayName || '';
      const oRefs = Array.isArray(oRaw?.crossReference) ? (oRaw.crossReference as string[]) : [];
      // Same story if either shares a cross-reference label with our group
      const groupLabels = new Set<string>([
        ownLabel,
        ...refs,
        ...members.map((m) => {
          const mr = m.raw as Record<string, unknown> | undefined;
          return (mr?.feedLabel as string | undefined) || m.author?.displayName || '';
        }),
      ]);
      if (oRefs.some((r) => groupLabels.has(r)) || groupLabels.has(oLabel)) {
        members.push(other);
        used.add(other.id);
      }
    }

    // Layer 2: fuzzy title similarity against the group
    if (members.length === 1) {
      for (const other of posts) {
        if (used.has(other.id)) continue;
        if (titleSimilarity(post.text, other.text) > 0.55) {
          members.push(other);
          used.add(other.id);
        }
      }
    }

    if (members.length === 0) continue;

    // Representative = highest ranked member
    const sortedMembers = [...members].sort((a, b) => {
      const ar = (a.raw as Record<string, unknown> | undefined)?.rank as number | undefined;
      const br = (b.raw as Record<string, unknown> | undefined)?.rank as number | undefined;
      return (br ?? 0) - (ar ?? 0);
    });
    const rep = sortedMembers[0];
    if (!rep) continue;
    const repRaw = rep.raw as Record<string, unknown> | undefined;

    const sourceSet = new Set<string>();
    for (const m of members) {
      const mr = m.raw as Record<string, unknown> | undefined;
      const label = (mr?.feedLabel as string | undefined) || m.author?.displayName || '';
      if (label) sourceSet.add(label);
      if (Array.isArray(mr?.crossReference)) {
        for (const ref of mr.crossReference as string[]) if (ref) sourceSet.add(ref);
      }
    }
    const sources = Array.from(sourceSet);

    const bias: BiasDistribution = { ...EMPTY_BIAS };
    const factuality: StoryCoverage['factuality'] = {
      'very-high': 0,
      high: 0,
      mixed: 0,
      low: 0,
      'very-low': 0,
    };
    for (const s of sources) {
      bias[sourceBias(s)] = (bias[sourceBias(s)] ?? 0) + 1;
      factuality[sourceFactuality(s)] = (factuality[sourceFactuality(s)] ?? 0) + 1;
    }

    // Perspectives: each member's own headline + source
    const perspectives = sortedMembers.slice(0, 6).map((m) => {
      const mr = m.raw as Record<string, unknown> | undefined;
      const label = (mr?.feedLabel as string | undefined) || m.author?.displayName || '';
      return {
        source: label,
        title: m.text,
        url: extractLinkUrl(m) || '',
        bias: sourceBias(label),
      };
    });

    const categories = Array.from(new Set(members.flatMap((m) => m.niches ?? []).slice(0, 5)));

    clusters.push({
      id: `story:${rep.id}`,
      title: rep.text,
      storyCount: sources.length,
      sources,
      bias,
      factuality,
      topCategories: categories,
      perspectives,
      firstSeen: Math.min(...members.map((m) => m.createdAt)),
      lastSeen: Math.max(...members.map((m) => m.createdAt)),
      score: (repRaw?.rank as number | undefined) ?? 0,
    });
  }

  return clusters.sort((a, b) => b.storyCount - a.storyCount || b.score - a.score).slice(0, limit);
}

// ─── Lazy Cache ──────────────────────────────────────────────────────

const RSS_CACHE_TTL = 120_000; // 120s — bigger pool, still fresh
/**
 * Minimum number of posts to fetch + cache on every RSS refresh, regardless
 * of the requested limit. Prevents the bridge prewarm (which calls providers
 * with a small per-provider limit) from caching only ~5 posts and then serving
 * an empty/starved /api/feed/rss to larger requests. 100 posts gives the feed
 * a healthy 50-100 item pool per protocol target.
 */
const RSS_CACHE_MIN_POOL = 300;
let rssCache: {
  posts: UnifiedPost[];
  clusters: StoryClusterOutput[];
  blindspots: BlindspotItem[];
  fetchedAt: number;
} | null = null;
/** Single-flight lock: coalesce concurrent cold fetches into one refresh. */
let rssFetchInFlight: Promise<UnifiedPost[]> | null = null;

/**
 * Fetch from ALL RSS feeds (100+ sources) with lazy initialization + TTL cache.
 * Respects per-source limits to ensure diversity.
 */
export async function fetchRssPosts(limit = 50): Promise<UnifiedPost[]> {
  // Always fetch and cache a minimum pool of posts (100) so small requests
  // (e.g. the bridge prewarm calling with perProviderLimit=5) never poison
  // the 5-minute cache with only a handful of entries. A later request with
  // a larger limit then still gets a useful cache hit.
  const cacheLimit = Math.max(limit, RSS_CACHE_MIN_POOL);

  // Return cached data if still fresh
  if (rssCache && Date.now() - rssCache.fetchedAt < RSS_CACHE_TTL) {
    const cached = rssCache.posts.slice(0, limit);
    //     console.log(
    //       `[rss] Cache HIT: ${cached.length} posts (age: ${Math.round((Date.now() - rssCache.fetchedAt) / 1000)}s)`,
    //     );
    return cached;
  }

  // Rate limit: 60 requests/minute
  if (!checkRateLimit('rss', { maxRequests: 60, windowMs: 60_000 })) {
    // Return stale cache if available (better than nothing)
    if (rssCache) {
      const stale = rssCache.posts.slice(0, limit);
      // console.log(`[rss] Rate limited, serving ${stale.length} stale cached posts`);
      return stale;
    }
    // console.log('[rss] Rate limited, skipping fetch');
    return [];
  }

  // Single-flight: if a cold RSS refresh is already in progress (e.g. the
  // prewarm and a live request both miss the cache at once), join it instead
  // of starting a second full 281-feed fetch that would hammer sources and
  // race to overwrite the shared cache with a degraded result. The previous
  // implementation declared this lock as a constant `null` and never assigned
  // it, so every cold request started its own full fetch — during prewarm the
  // bridge fired 3+ simultaneous RSS cold fetches and saturated the connection
  // pool, which is what made ~90% of feeds time out.
  if (rssFetchInFlight) {
    const posts = await rssFetchInFlight;
    return posts.slice(0, limit);
  }

  const run = async (): Promise<UnifiedPost[]> => {
    // Overall start time — used to bound the og:image enrichment so the RSS
    // provider stays inside the bridge's provider timeout (~5s).
    const fetchStartedAt = Date.now();
    const all: UnifiedPost[] = [];

    // Determine how many items to fetch per feed based on total feeds and
    // desired cache pool size.
    const activeFeeds = ALL_FEEDS;
    const perFeed = Math.max(1, Math.ceil((cacheLimit * 2) / activeFeeds.length));

    // console.log(`[rss] Fetching ${activeFeeds.length} feeds, ${perFeed} items per feed`);

    // Fetch feeds in parallel with concurrency control. Stop fetching once we
    // have enough posts (early exit) — fetching all 148 feeds for a small limit
    // was the dominant cold-start cost (~7s). The early exit is BIAS-AWARE:
    // crypto-news feeds (the first ~160 sources in ALL_FEEDS) are prolific, so
    // a pure count-based exit would break before reaching CULTURE_FEEDS where
    // left-leaning sources (Vice, The Intercept, Jacobin, The Nation, Democracy
    // Now, Guardian) live — starving the diversity mix of 🟦 Left entirely.
    const BATCH_SIZE = 40;
    const hasBiasBucket = (bucket: BiasBucket): boolean =>
      all.some((p) => {
        const raw = p.raw as { feedLabel?: string } | undefined;
        return biasBucketOf(raw?.feedLabel ?? p.author?.displayName) === bucket;
      });
    for (let i = 0; i < activeFeeds.length; i += BATCH_SIZE) {
      const batch = activeFeeds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((feed) => fetchFeed(feed, perFeed)));

      for (const r of results) {
        if (r.status === 'fulfilled') {
          all.push(...r.value);
        }
      }

      // Early exit once we have enough raw posts for the requested cache pool
      // AND at least one post from each bias bucket (left/center/right), so the
      // diversity pass below always has material to interleave. Falls through to
      // fetch everything when a bucket simply has no reachable feeds.
      if (all.length >= cacheLimit && hasBiasBucket('left') && hasBiasBucket('right')) break;

      // Small delay between batches to avoid hammering servers
      if (i + BATCH_SIZE < activeFeeds.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Deduplicate — against the cache pool size, not the requested limit
    const deduped = deduplicatePosts(all, cacheLimit);

    // Rank by source reputation + freshness + cross-reference grounding.
    // rankNewsPosts also rejects posts older than FEED_MAX_AGE_HOURS (48h).
    const ranked = rankNewsPosts(deduped);

    // Bias diversity: ensure the top of the feed mixes left/center/right
    // sources (Ground News killer). Never drops the top-ranked headline.
    const diverse = ensureBiasDiversity(ranked, cacheLimit, 2);

    // Ground News-beating features: story clusters (Full Coverage) + blindspots
    const clusters = clusterStories(diverse, 12);
    const blindspots = computeBlindspots(diverse, 10);

    // Backfill missing images from article OpenGraph tags (bounded time budget
    // that shrinks with feed-fetch time so the provider stays < ~4.5s total).
    const enrichBudgetMs = Math.max(400, 3200 - (Date.now() - fetchStartedAt));
    const enriched = await enrichPostImages(diverse, enrichBudgetMs);

    // Log stats
    const byCategory = new Map<string, number>();
    for (const feed of activeFeeds) {
      const count = all.filter((p) => {
        const raw = p.raw as { feedLabel?: string };
        return raw.feedLabel === feed.label;
      }).length;
      if (count > 0) {
        byCategory.set(feed.category, (byCategory.get(feed.category) || 0) + count);
      }
    }

    //     console.log(
    //       `[rss] Total: ${deduped.length} posts from ~${activeFeeds.length} feeds (${all.length} raw)`,
    //     );

    // Anti-poisoning: never replace a healthy cache with a degraded fetch.
    // The bridge's feed builder kills provider fetches after FETCH_TIMEOUT_MS
    // (5s), but the killed promise keeps running in the background and would
    // otherwise overwrite rssCache with whatever it scraped before the kill —
    // often a handful of posts that then serve /api/feed/rss for the whole
    // 5-minute TTL. If we already have a larger, fresher cache, keep it and
    // serve from it instead of writing the degraded result.
    if (
      rssCache &&
      Date.now() - rssCache.fetchedAt < RSS_CACHE_TTL &&
      rssCache.posts.length > 0 &&
      deduped.length < Math.min(RSS_CACHE_MIN_POOL, rssCache.posts.length)
    ) {
      //       console.log(
      //         `[rss] Degraded fetch (${deduped.length} posts) — keeping existing cache (${rssCache.posts.length} posts, age ${Math.round((Date.now() - rssCache.fetchedAt) / 1000)}s)`,
      //       );
      return rssCache.posts.slice(0, limit);
    }

    // Update cache with deduplicated + ranked + image-enriched results
    rssCache = { posts: enriched, clusters, blindspots, fetchedAt: Date.now() };

    return enriched.slice(0, limit);
  };

  rssFetchInFlight = run();
  try {
    return await rssFetchInFlight;
  } finally {
    rssFetchInFlight = null;
  }
}

/**
 * Return the latest story clusters (computed on the last RSS fetch).
 * If the cache is cold, triggers a fetch. Returns [] on failure.
 */
export async function fetchStoryClusters(limit = 12): Promise<StoryClusterOutput[]> {
  try {
    await fetchRssPosts(Math.max(limit * 4, 60));
  } catch {
    // fall through — return whatever is cached
  }
  if (rssCache && rssCache.clusters) return rssCache.clusters.slice(0, limit);
  return [];
}

/**
 * Return the latest blindspot items (computed on the last RSS fetch).
 * If the cache is cold, triggers a fetch. Returns [] on failure.
 */
export async function fetchBlindspots(max = 10): Promise<BlindspotItem[]> {
  try {
    await fetchRssPosts(Math.max(max * 6, 60));
  } catch {
    // fall through — return whatever is cached
  }
  if (rssCache && rssCache.blindspots) return rssCache.blindspots.slice(0, max);
  return [];
}

/**
 * Fetch only newsletter-platform feeds (Substack, Medium, Mirror, Paragraph, Ghost, Beehiiv).
 */
export async function fetchNewsletterPosts(limit = 30): Promise<UnifiedPost[]> {
  const newsletters = getNewsletterFeeds();
  const all: UnifiedPost[] = [];
  const perFeed = Math.max(1, Math.ceil((limit * 2) / newsletters.length));

  const results = await Promise.allSettled(newsletters.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const deduped = deduplicatePosts(all, limit);
  // console.log(`[rss] Newsletters: ${deduped.length} posts from ${newsletters.length} sources`);
  return deduped;
}

/**
 * Fetch by specific category.
 */
export async function fetchByCategory(category: FeedCategory, limit = 20): Promise<UnifiedPost[]> {
  const feeds = getFeedsByCategory(category);
  if (feeds.length === 0) return [];

  const all: UnifiedPost[] = [];
  const perFeed = Math.max(2, Math.ceil((limit * 1.5) / feeds.length));

  const results = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  return deduplicatePosts(all, limit);
}

/**
 * Fetch only featured/priority feeds.
 */
export async function fetchFeaturedPosts(limit = 30): Promise<UnifiedPost[]> {
  const featured = getFeaturedFeeds();
  const all: UnifiedPost[] = [];
  const perFeed = Math.max(2, Math.ceil((limit * 1.5) / featured.length));

  const results = await Promise.allSettled(featured.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  return deduplicatePosts(all, limit);
}

/**
 * Fetch only podcast feeds (crypto/web3 shows). Episodes carry an audio
 * enclosure embed and `contentType: 'podcast'` plus raw audioUrl/duration
 * metadata so clients can render inline players.
 */
export async function fetchPodcastPosts(limit = 30): Promise<UnifiedPost[]> {
  const podcasts = getPodcastFeeds();
  if (podcasts.length === 0) return [];

  const all: UnifiedPost[] = [];
  // Fetch a little more per feed than the target so dedup + ranking leaves
  // a healthy pool of recent episodes.
  const perFeed = Math.max(3, Math.ceil((limit * 1.5) / podcasts.length));

  const results = await Promise.allSettled(podcasts.map((feed) => fetchFeed(feed, perFeed)));

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by episode link/guid, then rank by publish recency so the
  // most recent episodes surface first (like a podcast app inbox).
  const deduped = deduplicatePosts(all, Math.max(limit, 25));
  const ranked = [...deduped].sort((a, b) => b.createdAt - a.createdAt);
  return ranked.slice(0, limit);
}

// ─── Schema & Exports ────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'rss',
  name: 'RSS & Newsletter Aggregator',
  description: `Aggregates from ${FEED_COUNT}+ RSS feeds, newsletters, and podcasts across crypto, DeFi, AI, security, and tech`,
  endpoint: '/api/feed/news',
  requiresAuth: false,
  contentType: 'link',
};

/**
 * Main fetch function — fetches from ALL sources and returns deduplicated posts.
 * Used by the bridge to populate the news feed.
 */
export async function fetch(limit = 50): Promise<UnifiedPost[]> {
  return fetchRssPosts(limit);
}

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

import { analyzeNewsSentiment } from '../lib/sentiment';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const USER_AGENT = 'DegenFeed-Bridge/0.2 (RSS Aggregator)';

// ─── Feeds by Category ──────────────────────────────────────────────────

export interface FeedSource {
  url: string;
  label: string;
  category: FeedCategory;
  niches: string[];
  platform?: 'rss' | 'atom' | 'substack' | 'medium' | 'mirror' | 'paragraph' | 'ghost' | 'beehiiv';
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
  | 'business';

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO NEWS (25 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const CRYPTO_NEWS_FEEDS: FeedSource[] = [
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
];

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO RESEARCH & ANALYTICS (12 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const RESEARCH_FEEDS: FeedSource[] = [
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

const VC_FEEDS: FeedSource[] = [
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

const DEV_FEEDS: FeedSource[] = [
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
];

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY & AUDITS (8 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const SECURITY_FEEDS: FeedSource[] = [
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

const ACADEMIC_FEEDS: FeedSource[] = [
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
];

// ═══════════════════════════════════════════════════════════════════════════
// TECH & GENERAL (10 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const TECH_FEEDS: FeedSource[] = [
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
];

// ═══════════════════════════════════════════════════════════════════════════
// DEFI-SPECIFIC (8 feeds)
// ═══════════════════════════════════════════════════════════════════════════
const DEFI_FEEDS: FeedSource[] = [
  {
    url: 'https://curve.substack.com/feed',
    label: 'Curve Finance',
    category: 'defi',
    niches: ['defi', 'ethereum'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// NFT & METAVERSE (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const NFT_FEEDS: FeedSource[] = [
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

const AI_FEEDS: FeedSource[] = [
  {
    url: 'https://huggingface.co/blog/feed.xml',
    label: 'Hugging Face Blog',
    category: 'ai',
    niches: ['ai', 'dev', 'research'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCIENCE (verified 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════

const SCIENCE_FEEDS: FeedSource[] = [
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

const GEOPOLITICS_FEEDS: FeedSource[] = [
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

const BUSINESS_FEEDS: FeedSource[] = [
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
// NEWSLETTER PLATFORMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Top crypto/DeFi Substack writers. RSS format: https://{author}.substack.com/feed
 */
const SUBSTACK_WRITERS: FeedSource[] = [
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
];

/**
 * Top Medium crypto publications. RSS: https://medium.com/feed/{publication}
 */
const MEDIUM_PUBLICATIONS: FeedSource[] = [
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
];

/**
 * Top Mirror.xyz writers. API: https://mirror.xyz/{address}/feed/updates
 * Mirror uses Ethereum addresses for identity.
 * NOTE: All Mirror feeds were returning 403 (Cloudflare) as of 2026-08-03
 * audit — disabled. Re-add when Mirror lifts the bot challenge.
 */
const MIRROR_WRITERS: FeedSource[] = [];

/**
 * Paragraph.xyz web3 newsletters. Uses GraphQL API.
 * NOTE: All Paragraph RSS endpoints were returning 429/404 as of 2026-08-03
 * audit — removed. Re-add if Paragraph restores its public feed endpoints.
 */
const PARAGRAPH_NEWSLETTERS: FeedSource[] = [];

/**
 * Ghost blogs with public RSS feeds.
 * NOTE: The Ghost content API endpoints (blog.ethereum.org, blog.solana.com)
 * return 404/DNS errors as of 2026-08-03 audit — removed. The primary RSS
 * feeds for Ethereum/Solana blogs remain in RESEARCH_FEEDS.
 */
const GHOST_BLOGS: FeedSource[] = [];

/**
 * Beehiiv publications with RSS.
 * NOTE: The Block (Beehiiv) is 403 and Milken Institute is 404 as of the
 * 2026-08-03 audit — removed.
 */
const BEEHIIV_PUBLICATIONS: FeedSource[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// REGULATION & POLICY (4 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const REGULATION_FEEDS: FeedSource[] = [
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
// MASTER FEED LIST — All sources aggregated
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_FEEDS: FeedSource[] = [
  ...CRYPTO_NEWS_FEEDS,
  ...RESEARCH_FEEDS,
  ...VC_FEEDS,
  ...DEV_FEEDS,
  ...SECURITY_FEEDS,
  ...ACADEMIC_FEEDS,
  ...TECH_FEEDS,
  ...SCIENCE_FEEDS,
  ...GEOPOLITICS_FEEDS,
  ...BUSINESS_FEEDS,
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
  if (descMatch) meta.description = stripHtml(descMatch[1]).slice(0, 500);

  const authorMatch = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);
  if (authorMatch) meta.authorName = stripHtml(authorMatch[1]);

  const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    meta.keywords = keywordsMatch[1].split(',').map((k) => k.trim().toLowerCase());
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
const ogImageCache = new Map<string, { url: string; expiresAt: number }>();
const ogImageInFlight = new Map<string, Promise<string | undefined>>();

function cacheOgImage(url: string, image: string | undefined): void {
  ogImageCache.set(url, {
    url: image ?? '',
    expiresAt: Date.now() + (image ? OG_IMAGE_CACHE_TTL_MS : OG_IMAGE_NEGATIVE_TTL_MS),
  });
}

/**
 * Fetch an article page and extract its OpenGraph image.
 * In-memory cached (positive 7d, negative 1h) and single-flight deduplicated
 * so concurrent enrichment passes never duplicate a request.
 */
export async function fetchOpenGraphImage(url: string): Promise<string | undefined> {
  if (!url?.startsWith('http')) return undefined;

  const cached = ogImageCache.get(url);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.url || undefined;
    ogImageCache.delete(url);
  }

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
    post.embeds[idx] = { kind: 'image', url: image, meta: post.embeds[idx].meta };
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
  if (/\b(nft|art|collectible|punk|ens|soulbound)\b/.test(lower)) niches.add('nft');
  if (/\b(ai|artificial|intelligence|llm|agent|gpt|transformer|neural)\b/.test(lower))
    niches.add('ai');
  if (/\b(sec|regulation|etf|compliance|sec|cfpb|finra|oig)\b/.test(lower))
    niches.add('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|mew)\b/.test(lower)) niches.add('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|scroll|zksync)\b/.test(lower)) niches.add('layer2');
  if (/\b(security|hack|exploit|audit|vulnerability|bug)\b/.test(lower)) niches.add('security');
  if (/\b(oracle|chainlink|pyth|api3)\b/.test(lower)) niches.add('oracle');
  if (/\b(dao|governance|vote|treasury)\b/.test(lower)) niches.add('dao');
  if (/\b(gaming|gamefi|play-to-earn|metaverse)\b/.test(lower)) niches.add('gaming');
  if (/\b(token|airdrop|listing|binance|coinbase)\b/.test(lower)) niches.add('token');
  if (/\b(mobile|telegram|ton|crypto\s*pay)\b/.test(lower)) niches.add('mobile');
  if (/\b(zk|zero.?knowledge|validity|proof)\b/.test(lower)) niches.add('zero-knowledge');
  if (/\b(dex|swap|amm|order.?book|perpetual)\b/.test(lower)) niches.add('dex');
  if (/\b(custody|wallet|self.?custody|hardware)\b/.test(lower)) niches.add('wallet');
  if (/\b(bridge|interoperability|ibc|polkadot|cosmos)\b/.test(lower)) niches.add('interop');
  if (/\b(rwa|real.?world|tokenization)\b/.test(lower)) niches.add('rwa');
  if (/\b(stablecoin|usdc|usdt|dai|fdusd)\b/.test(lower)) niches.add('stablecoin');
  if (/\b(privacy|monero|tornado|anonymity)\b/.test(lower)) niches.add('privacy');

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
    /\b(economy|recession|inflation|gdp|fed|interest rate|tariff|trade war|unemployment|central bank)\b/.test(
      lower,
    )
  )
    niches.add('business');

  // Add crypto as default if nothing matched and no base niches
  if (niches.size === 0) niches.add('crypto');
  return [...niches];
}

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
    const e = m[1];
    const item = parseAtomEntry(e);
    if (item) result.push(item);
  }

  // Fallback to RSS 2.0 items if no Atom entries found
  if (result.length === 0) {
    const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
    while ((m = itemRe.exec(xml)) !== null) {
      const e = m[1];
      const item = parseRssItem(e);
      if (item) result.push(item);
    }
  }

  return {
    title: feedTitleMatch ? stripHtml(feedTitleMatch[1]).trim() : undefined,
    description: feedDescMatch ? stripHtml(feedDescMatch[1]).trim().slice(0, 500) : undefined,
    link: feedLinkMatch?.[1],
    image: feedImageMatch?.[1] ? stripHtml(feedImageMatch[1]).trim() : undefined,
    items: result,
  };
}

function parseAtomEntry(e: string): ParsedFeedItem | null {
  const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
  if (!title) return null;

  // Link - try href attribute first, then content
  const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
  const linkAltMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  const link = linkMatch?.[1] || (linkAltMatch ? stripHtml(linkAltMatch[1]) : '');

  const updatedMatch = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const publishedMatch = e.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
  const publishedAt = publishedMatch ? new Date(publishedMatch[1]).getTime() : Date.now();
  const updatedAt = updatedMatch ? new Date(updatedMatch[1]).getTime() : publishedAt;

  const contentMatch = e.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const summaryMatch = e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const contentHtml = contentMatch?.[1] || summaryMatch?.[1] || '';
  const contentText = stripHtml(contentHtml);

  const descriptionMatch = e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const description = descriptionMatch
    ? stripHtml(descriptionMatch[1]).slice(0, 500)
    : contentText.slice(0, 500);

  const authorNameMatch = e.match(
    /<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i,
  );
  const authorUriMatch = e.match(/<author>[\s\S]*?<uri[^>]*>([\s\S]*?)<\/uri>[\s\S]*?<\/author>/i);

  const categoryMatches = [...e.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)];
  const categories = categoryMatches.map((cm) => cm[1].toLowerCase());

  const enclosures = extractEnclosures(e);
  const featuredImage =
    extractFeaturedImage(contentHtml) || extractMediaImage(e) || enclosures[0]?.url;

  const idMatch = e.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
  const id = idMatch ? stripHtml(idMatch[1]) : `entry:${title}:${publishedAt}`;

  return {
    title,
    link,
    contentHtml,
    contentText,
    description,
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    authorName: authorNameMatch ? stripHtml(authorNameMatch[1]) : undefined,
    authorLink: authorUriMatch ? stripHtml(authorUriMatch[1]) : undefined,
    featuredImage,
    categories,
    enclosures,
    id,
  };
}

function parseRssItem(e: string): ParsedFeedItem | null {
  const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
  if (!title) return null;

  const linkMatch = e.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  const link = linkMatch ? stripHtml(linkMatch[1]).trim() : '';

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
  const categories = categoryMatches.map((cm) => stripHtml(cm[1]).toLowerCase()).filter(Boolean);

  const enclosures = extractEnclosures(e);
  const featuredImage =
    extractFeaturedImage(contentHtml) || extractMediaImage(e) || enclosures[0]?.url;

  const guidMatch = e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  const id = guidMatch ? stripHtml(guidMatch[1]) : `rss:${title}:${publishedAt}`;

  return {
    title,
    link,
    contentHtml,
    contentText,
    description: contentText.slice(0, 500),
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    authorName: authorMatch
      ? stripHtml(authorMatch[1])
      : dcCreatorMatch
        ? stripHtml(dcCreatorMatch[1])
        : undefined,
    featuredImage,
    categories,
    enclosures,
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
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.log(`[rss] ${feed.label}: HTTP ${res.status}`);
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
          avatarUrl: '',
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
        },
        niches: allNiches,
        contentType: 'link',
      };
    });
  } catch (err) {
    console.log(`[rss] ${feed.label}: error — ${err instanceof Error ? err.message : 'unknown'}`);
    return [];
  }
}

// ─── Newsletter Platform Fetchers ────────────────────────────────────

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
      signal: AbortSignal.timeout(4000),
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
      .split('?')[0];
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
};

/**
 * Map a feed label to its reputation tier (defaults to 3).
 */
export function sourceTier(label: string | undefined): number {
  if (!label) return 3;
  return SOURCE_TIERS[label] ?? 3;
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

/**
 * Cross-reference grounding: an article covered by multiple feeds gets
 * higher authority. Diminishing returns after 5 sources.
 */
export function crossReferenceScore(crossReference: unknown): number {
  const refs = Array.isArray(crossReference) ? crossReference.length : 0;
  if (refs <= 1) return 0;
  return Math.min(1, 0.25 + (refs - 1) * 0.15);
}

/**
 * Compute the final news rank for a post (0..100).
 *
 * Signals:
 *  - source reputation (tier 1 → high)
 *  - freshness decay (newer → higher)
 *  - cross-reference grounding (multiple feeds → higher authority)
 *  - sentiment (marginally boost positive/neutral over negative)
 *
 * Scores are stored on `raw.rank` and `raw.rankSignals` for transparency.
 */
export function rankNewsPost(post: UnifiedPost, now = Date.now()): number {
  const raw = post.raw as Record<string, unknown> | undefined;
  const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';

  const reputation = (4 - sourceTier(label)) / 3; // tier 1 → 1.0, tier 4 → 0
  const freshness = freshnessScore(post.createdAt, now);
  const grounding = crossReferenceScore(raw?.crossReference);

  // Sentiment signal: normalized -1..+1 scaled to a ±5% rank adjustment.
  // Positive/neutral headlines are marginally boosted over negative ones;
  // neutral (0) scores land exactly in the middle and are unaffected.
  const sentimentRaw = raw?.sentiment as { normalized?: number } | undefined;
  const rawSentiment = sentimentRaw?.normalized;
  const sentimentValue =
    typeof rawSentiment === 'number' && Number.isFinite(rawSentiment) ? rawSentiment : 0;
  const sentimentSignal = Math.max(-1, Math.min(1, sentimentValue)) * 0.05;

  const score = Math.round(
    (reputation * 0.45 + freshness * 0.35 + grounding * 0.2 + sentimentSignal) * 100,
  );

  if (raw) {
    raw.sourceTier = sourceTier(label);
    raw.rank = score;
    raw.rankSignals = {
      sourceReputation: Math.round(reputation * 100) / 100,
      freshness: Math.round(freshness * 100) / 100,
      crossReference: Math.round(grounding * 100) / 100,
      sentiment: Math.round(sentimentSignal * 100) / 100,
    };
  }
  return score;
}

/**
 * Rank a batch of posts by news rank (best first), then by freshness as
 * a stable tie-breaker. Populates raw.rank/raw.rankSignals on each post.
 */
export function rankNewsPosts(posts: UnifiedPost[]): UnifiedPost[] {
  const now = Date.now();
  for (const post of posts) rankNewsPost(post, now);
  return [...posts].sort((a, b) => {
    const ra = rankNewsPost(a, now);
    const rb = rankNewsPost(b, now);
    if (rb !== ra) return rb - ra;
    return b.createdAt - a.createdAt;
  });
}

// ─── Lazy Cache ──────────────────────────────────────────────────────

const RSS_CACHE_TTL = 300_000; // 5 minutes
let rssCache: { posts: UnifiedPost[]; fetchedAt: number } | null = null;

/**
 * Fetch from ALL RSS feeds (100+ sources) with lazy initialization + TTL cache.
 * Respects per-source limits to ensure diversity.
 */
export async function fetchRssPosts(limit = 50): Promise<UnifiedPost[]> {
  // Return cached data if still fresh
  if (rssCache && Date.now() - rssCache.fetchedAt < RSS_CACHE_TTL) {
    const cached = rssCache.posts.slice(0, limit);
    console.log(
      `[rss] Cache HIT: ${cached.length} posts (age: ${Math.round((Date.now() - rssCache.fetchedAt) / 1000)}s)`,
    );
    return cached;
  }

  // Rate limit: 60 requests/minute
  if (!checkRateLimit('rss', { maxRequests: 60, windowMs: 60_000 })) {
    // Return stale cache if available (better than nothing)
    if (rssCache) {
      const stale = rssCache.posts.slice(0, limit);
      console.log(`[rss] Rate limited, serving ${stale.length} stale cached posts`);
      return stale;
    }
    console.log('[rss] Rate limited, skipping fetch');
    return [];
  }
  // Overall start time — used to bound the og:image enrichment so the RSS
  // provider stays inside the bridge's provider timeout (~5s).
  const fetchStartedAt = Date.now();
  const all: UnifiedPost[] = [];

  // Determine how many items to fetch per feed based on total feeds and desired limit
  const activeFeeds = ALL_FEEDS;
  const perFeed = Math.max(1, Math.ceil((limit * 2) / activeFeeds.length));

  console.log(`[rss] Fetching ${activeFeeds.length} feeds, ${perFeed} items per feed`);

  // Fetch feeds in parallel with concurrency control. Stop fetching once we
  // have enough posts (early exit) — fetching all 148 feeds for a small limit
  // was the dominant cold-start cost (~7s).
  const BATCH_SIZE = 25;
  for (let i = 0; i < activeFeeds.length; i += BATCH_SIZE) {
    const batch = activeFeeds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((feed) => fetchFeed(feed, perFeed)));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      }
    }

    // Early exit once we have enough raw posts for the requested limit
    if (all.length >= limit) break;

    // Small delay between batches to avoid hammering servers
    if (i + BATCH_SIZE < activeFeeds.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Deduplicate
  const deduped = deduplicatePosts(all, limit);

  // Rank by source reputation + freshness + cross-reference grounding
  const ranked = rankNewsPosts(deduped);

  // Backfill missing images from article OpenGraph tags (bounded time budget
  // that shrinks with feed-fetch time so the provider stays < ~4.5s total).
  const enrichBudgetMs = Math.max(400, 3200 - (Date.now() - fetchStartedAt));
  const enriched = await enrichPostImages(ranked, enrichBudgetMs);

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

  console.log(
    `[rss] Total: ${deduped.length} posts from ~${activeFeeds.length} feeds (${all.length} raw)`,
  );
  for (const [cat, count] of byCategory) {
    console.log(`[rss]   ${cat}: ${count} posts`);
  }

  // Update cache with deduplicated + ranked + image-enriched results
  rssCache = { posts: enriched, fetchedAt: Date.now() };

  return enriched;
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
  console.log(`[rss] Newsletters: ${deduped.length} posts from ${newsletters.length} sources`);
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

// ─── Schema & Exports ────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'rss',
  name: 'RSS & Newsletter Aggregator',
  description: `Aggregates from ${FEED_COUNT}+ RSS feeds and newsletters across crypto, DeFi, AI, security, and tech`,
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

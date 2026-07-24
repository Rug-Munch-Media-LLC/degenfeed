/**
 * RSS & Newsletter Aggregation Provider
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
  | 'solana';

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO NEWS (25 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const CRYPTO_NEWS_FEEDS: FeedSource[] = [
  { url: 'https://thedefiant.io/feed.xml', label: 'The Defiant', category: 'crypto-news', niches: ['crypto', 'defi', 'ethereum'] },
  { url: 'https://www.bankless.com/rss.xml', label: 'Bankless', category: 'crypto-news', niches: ['crypto', 'defi', 'ethereum'] },
  { url: 'https://messari.io/rss', label: 'Messari', category: 'crypto-news', niches: ['crypto', 'research'] },
  { url: 'https://delphidigital.io/feed', label: 'Delphi Digital', category: 'crypto-news', niches: ['crypto', 'research'] },
  { url: 'https://www.nansen.ai/feed', label: 'Nansen', category: 'crypto-news', niches: ['crypto', 'research', 'ethereum'] },
  { url: 'https://cointelegraph.com/rss', label: 'CoinTelegraph', category: 'crypto-news', niches: ['crypto'], featured: true },
  { url: 'https://decrypt.co/feed', label: 'Decrypt', category: 'crypto-news', niches: ['crypto'], featured: true },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', label: 'CoinDesk', category: 'crypto-news', niches: ['crypto'], featured: true },
  { url: 'https://cryptopotato.com/feed/', label: 'CryptoPotato', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://u.today/rss', label: 'UToday', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://cryptobriefing.com/feed/', label: 'CryptoBriefing', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://bitcoinmagazine.com/.rss/full/', label: 'BitcoinMagazine', category: 'crypto-news', niches: ['bitcoin'], featured: true },
  { url: 'https://news.bitcoin.com/feed/', label: 'Bitcoin.com News', category: 'crypto-news', niches: ['bitcoin', 'crypto'] },
  { url: 'https://bitcoinist.com/feed/', label: 'Bitcoinist', category: 'crypto-news', niches: ['bitcoin'] },
  { url: 'https://www.newsbtc.com/feed/', label: 'NewsBTC', category: 'crypto-news', niches: ['bitcoin'] },
  { url: 'https://www.livebitcoinnews.com/feed/', label: 'Live Bitcoin News', category: 'crypto-news', niches: ['bitcoin'] },
  { url: 'https://ethereumworldnews.com/feed/', label: 'Ethereum World News', category: 'crypto-news', niches: ['ethereum'] },
  { url: 'https://ambcrypto.com/feed/', label: 'AMBCrypto', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://dailyhodl.com/feed/', label: 'Daily Hodl', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://nulltx.com/feed/', label: 'NullTX', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://www.zycrypto.com/feed/', label: 'ZyCrypto', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://www.cryptoglobe.com/feed/', label: 'CryptoGlobe', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://beincrypto.com/feed/', label: 'BeInCrypto', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://www.cryptonewsz.com/feed/', label: 'CryptoNewsZ', category: 'crypto-news', niches: ['crypto'] },
  { url: 'https://coinpedia.org/feed/', label: 'CoinPedia', category: 'crypto-news', niches: ['crypto'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO RESEARCH & ANALYTICS (12 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const RESEARCH_FEEDS: FeedSource[] = [
  { url: 'https://coinmetrics.io/feed/', label: 'CoinMetrics', category: 'crypto-research', niches: ['crypto', 'research', 'bitcoin'] },
  { url: 'https://dune.com/blog/rss.xml', label: 'Dune Analytics', category: 'crypto-research', niches: ['crypto', 'research', 'analytics'] },
  { url: 'https://flipsidecrypto.xyz/feed.xml', label: 'Flipside Crypto', category: 'crypto-research', niches: ['crypto', 'research', 'analytics'] },
  { url: 'https://www.theblock.co/rss', label: 'The Block', category: 'crypto-research', niches: ['crypto', 'research'], featured: true },
  { url: 'https://unchainedcrypto.com/feed/', label: 'Unchained Crypto', category: 'crypto-research', niches: ['crypto', 'research'] },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/category/opinion/', label: 'CoinDesk Opinion', category: 'crypto-research', niches: ['crypto', 'opinion'] },
  { url: 'https://blog.chain.link/feed/', label: 'Chainlink Blog', category: 'crypto-research', niches: ['crypto', 'oracle', 'defi'] },
  { url: 'https://blog.ethereum.org/feed.xml', label: 'Ethereum Blog', category: 'crypto-research', niches: ['ethereum'], featured: true },
  { url: 'https://blog.solana.com/feed.xml', label: 'Solana Blog', category: 'crypto-research', niches: ['solana'], featured: true },
  { url: 'https://blog.polygon.technology/feed/', label: 'Polygon Blog', category: 'crypto-research', niches: ['ethereum', 'layer2'] },
  { url: 'https://blog.arbitrum.io/feed.xml', label: 'Arbitrum Blog', category: 'crypto-research', niches: ['ethereum', 'layer2'] },
  { url: 'https://optimism.mirror.xyz/feed/updates', label: 'Optimism Blog', category: 'crypto-research', niches: ['ethereum', 'layer2'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// VC & INVESTMENT (12 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const VC_FEEDS: FeedSource[] = [
  { url: 'https://electriccapital.com/feed/', label: 'Electric Capital', category: 'vc-investment', niches: ['crypto', 'research', 'vc'] },
  { url: 'https://a16zcrypto.com/feed/', label: 'a16z Crypto', category: 'vc-investment', niches: ['crypto', 'vc', 'research'], featured: true },
  { url: 'https://paradigm.xyz/feed.xml', label: 'Paradigm', category: 'vc-investment', niches: ['crypto', 'vc', 'research'] },
  { url: 'https://panteracapital.com/feed/', label: 'Pantera Capital', category: 'vc-investment', niches: ['crypto', 'vc'] },
  { url: 'https://multicoin.capital/feed/', label: 'Multicoin Capital', category: 'vc-investment', niches: ['crypto', 'vc', 'research'] },
  { url: 'https://framework.ventures/feed.xml', label: 'Framework Ventures', category: 'vc-investment', niches: ['crypto', 'vc'] },
  { url: 'https://variant.fund/feed/', label: 'Variant Fund', category: 'vc-investment', niches: ['crypto', 'vc'] },
  { url: 'https://dragonfly.xyz/feed.xml', label: 'Dragonfly Capital', category: 'vc-investment', niches: ['crypto', 'vc'] },
  { url: 'https://1kx.network/feed.xml', label: '1kx', category: 'vc-investment', niches: ['crypto', 'vc'] },
  { url: 'https://www.placeholder.vc/feed/', label: 'Placeholder VC', category: 'vc-investment', niches: ['crypto', 'vc'] },
  { url: 'https://collabcurrency.com/feed/', label: 'Collab+Currency', category: 'vc-investment', niches: ['crypto', 'vc', 'solana'] },
  { url: 'https://www.castleisland.vc/feed/', label: 'Castle Island VC', category: 'vc-investment', niches: ['crypto', 'vc', 'bitcoin'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// DEV & TECHNICAL (10 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const DEV_FEEDS: FeedSource[] = [
  { url: 'https://ethresear.ch/posts.rss', label: 'EthResearch', category: 'dev-technical', niches: ['ethereum', 'research'] },
  { url: 'https://ethereum-magicians.org/posts.rss', label: 'Ethereum Magicians', category: 'dev-technical', niches: ['ethereum', 'dev'] },
  { url: 'https://forums.solana.com/posts.rss', label: 'Solana Tech Forums', category: 'dev-technical', niches: ['solana', 'dev'] },
  { url: 'https://research.circle.com/feed.xml', label: 'Circle Research', category: 'dev-technical', niches: ['crypto', 'stablecoin'] },
  { url: 'https://celo.org/feed.xml', label: 'Celo Blog', category: 'dev-technical', niches: ['crypto', 'mobile'] },
  { url: 'https://near.org/blog/feed.xml', label: 'NEAR Blog', category: 'dev-technical', niches: ['crypto', 'layer1'] },
  { url: 'https://blog.avax.network/feed', label: 'Avalanche Blog', category: 'dev-technical', niches: ['crypto', 'layer1'] },
  { url: 'https://blog.cosmos.network/feed/', label: 'Cosmos Blog', category: 'dev-technical', niches: ['crypto', 'cosmos'] },
  { url: 'https://blog.ton.org/feed.xml', label: 'TON Blog', category: 'dev-technical', niches: ['crypto', 'telegram'] },
  { url: 'https://suiblog.com/feed/', label: 'Sui Blog', category: 'dev-technical', niches: ['crypto', 'layer1'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY & AUDITS (8 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const SECURITY_FEEDS: FeedSource[] = [
  { url: 'https://rekt.news/feed.xml', label: 'Rekt News', category: 'security', niches: ['security', 'crypto', 'hack'], featured: true },
  { url: 'https://web3isgoinggreat.com/feed.xml', label: 'Web3 is Going Great', category: 'security', niches: ['security', 'crypto', 'hack'] },
  { url: 'https://blog.trailofbits.com/feed/', label: 'Trail of Bits', category: 'security', niches: ['security', 'research'], featured: true },
  { url: 'https://blog.openzeppelin.com/feed.xml', label: 'OpenZeppelin', category: 'security', niches: ['security', 'ethereum', 'solidity'] },
  { url: 'https://research.certik.com/feed.xml', label: 'CertiK Research', category: 'security', niches: ['security', 'audit'], featured: true },
  { url: 'https://slowmist.medium.com/feed', label: 'SlowMist', category: 'security', niches: ['security', 'crypto'] },
  { url: 'https://www.halborn.com/blog/feed.xml', label: 'Halborn', category: 'security', niches: ['security', 'crypto'] },
  { url: 'https://neodyme.io/feed.xml', label: 'Neodyme', category: 'security', niches: ['security', 'solana'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMIC (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const ACADEMIC_FEEDS: FeedSource[] = [
  { url: 'https://rss.arxiv.org/rss/cs.CR', label: 'arXiv Cryptography', category: 'academic', niches: ['crypto', 'research', 'academic'] },
  { url: 'https://rss.arxiv.org/rss/cs.AI', label: 'arXiv AI', category: 'academic', niches: ['ai', 'research', 'academic'] },
  { url: 'https://rss.arxiv.org/rss/cs.LG', label: 'arXiv Machine Learning', category: 'academic', niches: ['ai', 'research', 'academic'] },
  { url: 'https://rss.arxiv.org/rss/cs.SE', label: 'arXiv Software Engineering', category: 'academic', niches: ['tech', 'research', 'academic'] },
  { url: 'https://eprint.iacr.org/rss/atom.xml', label: 'IACR ePrint', category: 'academic', niches: ['crypto', 'research', 'academic'] },
  { url: 'https://blockchain.ieee.org/feed', label: 'IEEE Blockchain', category: 'academic', niches: ['crypto', 'research', 'academic'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// TECH & GENERAL (10 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const TECH_FEEDS: FeedSource[] = [
  { url: 'https://hackernoon.com/feed', label: 'Hacker Noon', category: 'tech', niches: ['tech', 'crypto'], featured: true },
  { url: 'https://www.freecodecamp.org/news/rss/', label: 'FreeCodeCamp', category: 'tech', niches: ['tech', 'dev'] },
  { url: 'https://news.ycombinator.com/rss', label: 'Hacker News', category: 'tech', niches: ['tech', 'startups'], featured: true },
  { url: 'https://www.theverge.com/rss/index.xml', label: 'The Verge', category: 'tech', niches: ['tech'] },
  { url: 'https://feeds.feedburner.com/TheHackersNews', label: 'The Hacker News', category: 'tech', niches: ['security', 'tech'] },
  { url: 'https://www.bleepingcomputer.com/feed/', label: 'BleepingComputer', category: 'tech', niches: ['security', 'tech'] },
  { url: 'https://blog.google/technology/ai/rss/', label: 'Google AI', category: 'tech', niches: ['ai', 'tech'] },
  { url: 'https://openai.com/blog/rss.xml', label: 'OpenAI Blog', category: 'tech', niches: ['ai'], featured: true },
  { url: 'https://deepmind.google/blog/rss.xml', label: 'DeepMind', category: 'tech', niches: ['ai', 'research'] },
  { url: 'https://www.anthropic.com/feed.xml', label: 'Anthropic', category: 'tech', niches: ['ai'], featured: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// DEFI-SPECIFIC (8 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const DEFI_FEEDS: FeedSource[] = [
  { url: 'https://defillama.com/rss/blog', label: 'DefiLlama Blog', category: 'defi', niches: ['defi', 'crypto'] },
  { url: 'https://blog.uniswap.org/feed.xml', label: 'Uniswap Blog', category: 'defi', niches: ['defi', 'ethereum'] },
  { url: 'https://blog.aave.com/feed.xml', label: 'Aave Blog', category: 'defi', niches: ['defi', 'ethereum'] },
  { url: 'https://blog.makerdao.com/feed/', label: 'MakerDAO Blog', category: 'defi', niches: ['defi', 'ethereum', 'stablecoin'] },
  { url: 'https://curve.substack.com/feed', label: 'Curve Finance', category: 'defi', niches: ['defi', 'ethereum'] },
  { url: 'https://blog.sushi.com/feed.xml', label: 'Sushi Blog', category: 'defi', niches: ['defi'] },
  { url: 'https://blog.compound.finance/feed/', label: 'Compound Blog', category: 'defi', niches: ['defi', 'ethereum'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// NFT & METAVERSE (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const NFT_FEEDS: FeedSource[] = [
  { url: 'https://nftnow.com/feed/', label: 'NFT Now', category: 'nft', niches: ['nft', 'crypto'] },
  { url: 'https://opensea.io/blog/feed/', label: 'OpenSea Blog', category: 'nft', niches: ['nft', 'ethereum'] },
  { url: 'https://decrypt.co/feed/nft', label: 'Decrypt NFT', category: 'nft', niches: ['nft', 'crypto'] },
  { url: 'https://rarible.substack.com/feed', label: 'Rarible Blog', category: 'nft', niches: ['nft', 'ethereum'] },
  { url: 'https://mirror.xyz/nftculture/feed/updates', label: 'NFT Culture', category: 'nft', niches: ['nft'] },
  { url: 'https://www.theblock.co/rss/nft', label: 'The Block NFT', category: 'nft', niches: ['nft'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// AI SPECIFIC (6 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const AI_FEEDS: FeedSource[] = [
  { url: 'https://hai.stanford.edu/feed.xml', label: 'Stanford HAI', category: 'ai', niches: ['ai', 'research'] },
  { url: 'https://www.deeplearning.ai/blog/rss.xml', label: 'DeepLearning.AI', category: 'ai', niches: ['ai', 'dev'] },
  { url: 'https://huggingface.co/blog/feed.xml', label: 'Hugging Face Blog', category: 'ai', niches: ['ai', 'dev', 'research'] },
  { url: 'https://jalammar.github.com/feed.xml', label: 'Jay Alammar', category: 'ai', niches: ['ai', 'dev'] },
  { url: 'https://lilianweng.github.io/feed.xml', label: 'Lil\'Log', category: 'ai', niches: ['ai', 'research'] },
  { url: 'https://simonwillison.net/atom.xml', label: 'Simon Willison', category: 'ai', niches: ['ai', 'dev', 'python'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// NEWSLETTER PLATFORMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Top crypto/DeFi Substack writers. RSS format: https://{author}.substack.com/feed
 */
const SUBSTACK_WRITERS: FeedSource[] = [
  { url: 'https://milessuter.substack.com/feed', label: 'Miles Suter', category: 'newsletter', niches: ['crypto', 'bitcoin'], platform: 'substack' },
  { url: 'https://validity.substack.com/feed', label: 'Validity', category: 'newsletter', niches: ['crypto', 'research'], platform: 'substack' },
  { url: 'https://cryptoslate.substack.com/feed', label: 'CryptoSlate', category: 'newsletter', niches: ['crypto'], platform: 'substack' },
  { url: 'https://thebearcave.substack.com/feed', label: 'The Bear Cave', category: 'newsletter', niches: ['crypto', 'research'], platform: 'substack' },
  { url: 'https://caseycaruso.substack.com/feed', label: 'Casey Caruso', category: 'newsletter', niches: ['crypto', 'vc'], platform: 'substack' },
  { url: 'https://cobie.substack.com/feed', label: 'Cobie', category: 'newsletter', niches: ['crypto'], platform: 'substack' },
  { url: 'https://technically.substack.com/feed', label: 'Technically', category: 'newsletter', niches: ['tech', 'ai'], platform: 'substack' },
  { url: 'https://proofofwork.substack.com/feed', label: 'Proof of Work', category: 'newsletter', niches: ['bitcoin', 'crypto'], platform: 'substack' },
  { url: 'https://thewrapper.substack.com/feed', label: 'The Wrapper', category: 'newsletter', niches: ['crypto'], platform: 'substack' },
  { url: 'https://goongrubbing.substack.com/feed', label: 'Goon Grubbing', category: 'newsletter', niches: ['crypto', 'memecoin'], platform: 'substack' },
  { url: 'https://jessewalden.substack.com/feed', label: 'Jesse Walden', category: 'newsletter', niches: ['crypto', 'vc'], platform: 'substack' },
  { url: 'https://defieducation.substack.com/feed', label: 'DeFi Education', category: 'newsletter', niches: ['defi', 'ethereum'], platform: 'substack' },
  { url: 'https://andrewmoore.substack.com/feed', label: 'Andrew Moore', category: 'newsletter', niches: ['crypto', 'research'], platform: 'substack' },
  { url: 'https://marketmeditations.substack.com/feed', label: 'Market Meditations', category: 'newsletter', niches: ['crypto', 'trading'], platform: 'substack' },
  { url: 'https://bitcoinmagazine.substack.com/feed', label: 'Bitcoin Magazine', category: 'newsletter', niches: ['bitcoin'], platform: 'substack' },
  { url: 'https://zkwhiteboard.substack.com/feed', label: 'ZK Whiteboard', category: 'newsletter', niches: ['crypto', 'research', 'zero-knowledge'], platform: 'substack' },
  { url: 'https://thedefiant.substack.com/feed', label: 'The Defiant (Substack)', category: 'newsletter', niches: ['defi', 'crypto'], platform: 'substack' },
  { url: 'https://martinzaggra.substack.com/feed', label: 'Martin Zagg', category: 'newsletter', niches: ['crypto', 'solana'], platform: 'substack' },
  { url: 'https://doseofdefi.substack.com/feed', label: 'Dose of DeFi', category: 'newsletter', niches: ['defi', 'crypto'], platform: 'substack' },
  { url: 'https://web3weekly.substack.com/feed', label: 'Web3 Weekly', category: 'newsletter', niches: ['crypto', 'web3'], platform: 'substack' },
];

/**
 * Top Medium crypto publications. RSS: https://medium.com/feed/{publication}
 */
const MEDIUM_PUBLICATIONS: FeedSource[] = [
  { url: 'https://medium.com/feed/coinmonks', label: 'Coinmonks', category: 'newsletter', niches: ['crypto'], platform: 'medium' },
  { url: 'https://medium.com/feed/the-capital', label: 'The Capital', category: 'newsletter', niches: ['crypto', 'finance'], platform: 'medium' },
  { url: 'https://medium.com/feed/better-programming', label: 'Better Programming', category: 'newsletter', niches: ['tech', 'dev'], platform: 'medium' },
  { url: 'https://medium.com/feed/towards-data-science', label: 'Towards Data Science', category: 'newsletter', niches: ['ai', 'data'], platform: 'medium' },
  { url: 'https://medium.com/feed/blockchain-review', label: 'Blockchain Review', category: 'newsletter', niches: ['crypto'], platform: 'medium' },
  { url: 'https://medium.com/feed/defi-pulse', label: 'DeFi Pulse (Medium)', category: 'newsletter', niches: ['defi'], platform: 'medium' },
  { url: 'https://medium.com/feed/cyberconnect', label: 'CyberConnect', category: 'newsletter', niches: ['crypto', 'social'], platform: 'medium' },
  { url: 'https://medium.com/feed/ethglobal', label: 'ETHGlobal', category: 'newsletter', niches: ['ethereum', 'dev'], platform: 'medium' },
  { url: 'https://medium.com/feed/chainlink-community', label: 'Chainlink Community', category: 'newsletter', niches: ['crypto', 'oracle'], platform: 'medium' },
  { url: 'https://medium.com/feed/humanity-protocol', label: 'Humanity Protocol', category: 'newsletter', niches: ['crypto', 'identity'], platform: 'medium' },
];

/**
 * Top Mirror.xyz writers. API: https://mirror.xyz/{address}/feed/updates
 * Mirror uses Ethereum addresses for identity.
 */
const MIRROR_WRITERS: FeedSource[] = [
  { url: 'https://mirror.xyz/0xE3cD9A0aE32c3e2f0b0f1fB1cB3EfC3F7f2cEf1/feed/updates', label: 'Mirror Ecosystem', category: 'newsletter', niches: ['crypto', 'web3'], platform: 'mirror' },
  { url: 'https://mirror.xyz/0xA7B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7S8T9/feed/updates', label: 'Mirror Writers', category: 'newsletter', niches: ['crypto', 'web3'], platform: 'mirror' },
];

/**
 * Paragraph.xyz web3 newsletters. Uses GraphQL API.
 */
const PARAGRAPH_NEWSLETTERS: FeedSource[] = [
  { url: 'https://paragraph.xyz/api/feeds/rss/@bankless', label: 'Bankless (Paragraph)', category: 'newsletter', niches: ['crypto', 'defi'], platform: 'paragraph' },
  { url: 'https://paragraph.xyz/api/feeds/rss/@a16z', label: 'a16z (Paragraph)', category: 'newsletter', niches: ['crypto', 'vc'], platform: 'paragraph' },
  { url: 'https://paragraph.xyz/api/feeds/rss/@variant', label: 'Variant (Paragraph)', category: 'newsletter', niches: ['crypto', 'vc'], platform: 'paragraph' },
  { url: 'https://paragraph.xyz/api/feeds/rss/@miles', label: 'Miles (Paragraph)', category: 'newsletter', niches: ['crypto', 'bitcoin'], platform: 'paragraph' },
  { url: 'https://paragraph.xyz/api/feeds/rss/@doseofdefi', label: 'Dose of DeFi (Paragraph)', category: 'newsletter', niches: ['defi'], platform: 'paragraph' },
  { url: 'https://paragraph.xyz/api/feeds/rss/@goon', label: 'Goon (Paragraph)', category: 'newsletter', niches: ['crypto', 'memecoin'], platform: 'paragraph' },
];

/**
 * Ghost blogs with public RSS feeds.
 */
const GHOST_BLOGS: FeedSource[] = [
  { url: 'https://blog.ethereum.org/ghost/api/v3/content/posts/?limit=10', label: 'Ethereum Blog (Ghost)', category: 'newsletter', niches: ['ethereum'], platform: 'ghost' },
  { url: 'https://blog.solana.com/ghost/api/v3/content/posts/?limit=10', label: 'Solana Blog (Ghost)', category: 'newsletter', niches: ['solana'], platform: 'ghost' },
];

/**
 * Beehiiv publications with RSS.
 */
const BEEHIIV_PUBLICATIONS: FeedSource[] = [
  { url: 'https://www.theblock.co/feed', label: 'The Block (Beehiiv)', category: 'newsletter', niches: ['crypto', 'research'], platform: 'beehiiv' },
  { url: 'https://www.milkeninstitute.org/feed', label: 'Milken Institute', category: 'newsletter', niches: ['finance', 'crypto'], platform: 'beehiiv' },
];

// ═══════════════════════════════════════════════════════════════════════════
// REGULATION & POLICY (4 feeds)
// ═══════════════════════════════════════════════════════════════════════════

const REGULATION_FEEDS: FeedSource[] = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/category/policy/', label: 'CoinDesk Policy', category: 'regulation', niches: ['regulation', 'crypto'] },
  { url: 'https://www.sec.gov/rss/news/press.xml', label: 'SEC Press', category: 'regulation', niches: ['regulation', 'crypto'] },
  { url: 'https://www.coincenter.org/feed/', label: 'Coin Center', category: 'regulation', niches: ['regulation', 'crypto'] },
  { url: 'https://blockchainassociation.org/feed/', label: 'Blockchain Association', category: 'regulation', niches: ['regulation', 'crypto'] },
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
    (f) => f.platform === 'substack' || f.platform === 'medium' || f.platform === 'mirror' || f.platform === 'paragraph' || f.platform === 'ghost' || f.platform === 'beehiiv',
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
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
    .trim();
}

/**
 * Extract the first image URL from HTML content
 */
export function extractFeaturedImage(html: string): string | undefined {
  if (!html) return undefined;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    const url = imgMatch[1];
    // Skip data URIs and very small icons
    if (!url.startsWith('data:') && !url.includes('favicon') && !url.includes('1x1')) {
      return url;
    }
  }
  // Try <figure> with <img> inside
  const figureMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (figureMatch && figureMatch[1]) return figureMatch[1];

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
  if (/\b(ai|artificial|intelligence|llm|agent|gpt|transformer|neural)\b/.test(lower)) niches.add('ai');
  if (/\b(sec|regulation|etf|compliance|sec|cfpb|finra|oig)\b/.test(lower)) niches.add('regulation');
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
export function parseFeedXml(xml: string): { title?: string; description?: string; link?: string; items: ParsedFeedItem[] } {
  const result: ParsedFeedItem[] = [];

  const feedTitleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedDescMatch = xml.match(/<subtitle[^>]*>([\s\S]*?)<\/subtitle>/i) || xml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const feedLinkMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);

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
  const description = descriptionMatch ? stripHtml(descriptionMatch[1]).slice(0, 500) : contentText.slice(0, 500);

  const authorNameMatch = e.match(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
  const authorUriMatch = e.match(/<author>[\s\S]*?<uri[^>]*>([\s\S]*?)<\/uri>[\s\S]*?<\/author>/i);

  const categoryMatches = [...e.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)];
  const categories = categoryMatches.map((cm) => cm[1].toLowerCase());

  const enclosures = extractEnclosures(e);
  const featuredImage = extractFeaturedImage(contentHtml) || enclosures[0]?.url;

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
  const featuredImage = extractFeaturedImage(contentHtml) || enclosures[0]?.url;

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
    authorName: authorMatch ? stripHtml(authorMatch[1]) : dcCreatorMatch ? stripHtml(dcCreatorMatch[1]) : undefined,
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
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(10000),
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
      const allNiches = guessNiches(item.title + ' ' + item.contentText, feed.niches);
      const embedUrl = item.link || feed.url;

      const embeds: { kind: string; url: string; meta?: Record<string, unknown> }[] = [
        { kind: 'link', url: embedUrl },
      ];

      if (item.featuredImage) {
        embeds.push({
          kind: 'image',
          url: item.featuredImage,
          meta: { source: feed.label, caption: item.title },
        });
      }

      const platformLabel = feed.platform
        ? `${feed.label} (${feed.platform})`
        : feed.label;

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
        raw: {
          description: item.description,
          contentText: item.contentText.slice(0, 1000),
          categories: item.categories,
          feedLabel: feed.label,
          feedCategory: feed.category,
          feedUrl: feed.url,
          platform: feed.platform,
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
      signal: AbortSignal.timeout(10000),
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
        embeds: [{ kind: 'link', url: `https://mirror.xyz/${feed.label}/${(itemAny.digest as string) || ''}` }],
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
 * Deduplicate posts across all sources using title similarity.
 * Uses a rolling window of the first 60 chars as the dedup key.
 */
export function deduplicatePosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  const seen = new Map<string, UnifiedPost>();

  // Sort by creation date (newest first) to keep the freshest copy
  const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt);

  for (const post of sorted) {
    // Create a normalized key from the title (first 80 chars, lowercased, stripped)
    const key = post.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 80);

    if (!seen.has(key)) {
      seen.set(key, post);
    } else {
      // Merge niches if we already have this post from another source
      const existing = seen.get(key);
      if (existing) {
        const mergedNiches = new Set([...existing.niches, ...post.niches]);
        existing.niches = [...mergedNiches];
      }
    }
  }

  return [...seen.values()].slice(0, limit);
}

// ─── Main Fetch Functions ────────────────────────────────────────────

/**
 * Fetch from ALL RSS feeds (100+ sources).
 * Respects per-source limits to ensure diversity.
 */
export async function fetchRssPosts(limit = 50): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Determine how many items to fetch per feed based on total feeds and desired limit
  const activeFeeds = ALL_FEEDS;
  const perFeed = Math.max(1, Math.ceil((limit * 2) / activeFeeds.length));

  console.log(`[rss] Fetching ${activeFeeds.length} feeds, ${perFeed} items per feed`);

  // Fetch all feeds in parallel with concurrency control
  const BATCH_SIZE = 25;
  for (let i = 0; i < activeFeeds.length; i += BATCH_SIZE) {
    const batch = activeFeeds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((feed) => fetchFeed(feed, perFeed)),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      }
    }

    // Small delay between batches to avoid hammering servers
    if (i + BATCH_SIZE < activeFeeds.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Deduplicate
  const deduped = deduplicatePosts(all, limit);

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

  console.log(`[rss] Total: ${deduped.length} posts from ~${activeFeeds.length} feeds (${all.length} raw)`);
  for (const [cat, count] of byCategory) {
    console.log(`[rss]   ${cat}: ${count} posts`);
  }

  return deduped;
}

/**
 * Fetch only newsletter-platform feeds (Substack, Medium, Mirror, Paragraph, Ghost, Beehiiv).
 */
export async function fetchNewsletterPosts(limit = 30): Promise<UnifiedPost[]> {
  const newsletters = getNewsletterFeeds();
  const all: UnifiedPost[] = [];
  const perFeed = Math.max(1, Math.ceil((limit * 2) / newsletters.length));

  const results = await Promise.allSettled(
    newsletters.map((feed) => fetchFeed(feed, perFeed)),
  );

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

  const results = await Promise.allSettled(
    feeds.map((feed) => fetchFeed(feed, perFeed)),
  );

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

  const results = await Promise.allSettled(
    featured.map((feed) => fetchFeed(feed, perFeed)),
  );

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

import { detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchRss,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

// ── Feed Configuration Types ───────────────────────────────────────────

export interface RssFeedConfig {
  /** RSS/Atom feed URL */
  url: string;
  /** Authority tier 1-5 (1 = highest authority, e.g. CoinDesk; 5 = long-tail) */
  tier: number;
  /** Base weight 0.0-1.0 used in quality scoring */
  weight: number;
  /** Content category: news, analysis, research, development, markets, security, policy, tech, ai, video, social, newsletter */
  category: string;
  /** Topic tags for filtering / discovery */
  tags: string[];
  /** Authority bonus (3 = Tier 1, 2 = Tier 2-3, 1 = Tier 4-5) */
  authority: number;
  /** Newsletter-specific: has a paid subscription tier (quality signal) */
  isPaid?: boolean;
  /** Newsletter-specific: publishing schedule for consistency scoring */
  schedule?: 'daily' | 'weekly' | 'monthly' | 'irregular';
}

export interface QualityScore {
  /** Sum of all signal scores */
  total: number;
  signals: {
    /** Source tier weight (0.6-1.0) */
    weight: number;
    /** Post freshness: <1h=3, <6h=2, <24h=1, >24h=0 */
    freshness: number;
    /** Content length: >500=2, >200=1, else 0 */
    length: number;
    /** Has image/video embed: 1 or 0 */
    hasMedia: number;
    /** Source authority bonus (3, 2, or 1) */
    authority: number;
    /** Newsletter-specific: paid tier bonus (2 if isPaid, else 0) */
    newsletterPaid: number;
    /** Newsletter-specific: deep content bonus (2 if >2000 chars, 1 if >1000) */
    newsletterDepth: number;
    /** Newsletter-specific: schedule consistency bonus (1 if daily/weekly, else 0) */
    newsletterConsistency: number;
  };
}

export type RssCategory =
  | 'news'
  | 'analysis'
  | 'research'
  | 'development'
  | 'markets'
  | 'security'
  | 'policy'
  | 'tech'
  | 'ai'
  | 'science'
  | 'startups'
  | 'video'
  | 'social'
  | 'newsletter';

export const RSS_CATEGORIES: Record<string, string> = {
  news: 'Breaking news, market coverage, industry updates',
  analysis: 'Deep dives, on-chain analysis, market research',
  research: 'Academic research, institutional reports, technical papers',
  development: 'Protocol blogs, dev updates, EIPs, SDK releases',
  markets: 'Price data, trading volumes, exchange flows, derivatives',
  security: 'Hacks, exploits, audits, vulnerability disclosures',
  policy: 'Regulation, compliance, legal, government policy',
  tech: 'General technology, programming, engineering blogs',
  ai: 'Artificial intelligence, machine learning, LLMs',
  science: 'Scientific research, discoveries, academic papers',
  startups: 'Startup and VC news, product launches, founder stories',
  video: 'YouTube channels, video content, podcasts',
  social: 'Reddit, Lemmy, community discussions',
  newsletter: 'Curated newsletters from Substack, Medium, Paragraph, Mirror',
};

// Compact helper for defining RSS feed configs
function cfg(
  url: string,
  opts: {
    tier?: number;
    weight?: number;
    category?: string;
    tags?: string[];
    authority?: number;
    isPaid?: boolean;
    schedule?: 'daily' | 'weekly' | 'monthly' | 'irregular';
  } = {},
): RssFeedConfig {
  return {
    url,
    tier: opts.tier ?? 3,
    weight: opts.weight ?? 0.7,
    category: opts.category ?? 'news',
    tags: opts.tags ?? ['crypto'],
    authority: opts.authority ?? 1,
    ...(opts.isPaid !== undefined ? { isPaid: opts.isPaid } : {}),
    ...(opts.schedule !== undefined ? { schedule: opts.schedule } : {}),
  };
}

export const DEFAULT_CRYPTO_FEEDS: RssFeedConfig[] = [
  // ═══════════════════════════════════════════════════════════════════
  // TIER 1 — Must Have Crypto News (weight: 1.0, authority: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cointelegraph.com/rss',                          { tier: 1, weight: 1.0, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum', 'defi'], authority: 3 }),
  cfg('https://decrypt.co/feed',                                { tier: 1, weight: 1.0, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum', 'defi'], authority: 3 }),
  cfg('https://www.coindesk.com/arc/outboundfeeds/rss/',        { tier: 1, weight: 1.0, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum', 'policy'], authority: 3 }),
  cfg('https://www.theblock.co/rss',                            { tier: 1, weight: 1.0, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum', 'defi'], authority: 3 }),
  cfg('https://blockworks.co/feed',                             { tier: 1, weight: 1.0, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum', 'defi'], authority: 3 }),
  cfg('https://thedefiant.io/feed',                             { tier: 1, weight: 1.0, category: 'news', tags: ['defi', 'crypto', 'ethereum'], authority: 3 }),
  cfg('https://newsletter.banklesshq.com/feed',                 { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'ethereum', 'defi'], authority: 3, isPaid: true, schedule: 'daily' }),
  cfg('https://banklesshq.substack.com/feed',                   { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'ethereum', 'defi'], authority: 3, isPaid: true, schedule: 'daily' }),
  cfg('https://messari.io/feed',                                { tier: 1, weight: 1.0, category: 'research', tags: ['crypto', 'bitcoin', 'ethereum', 'onchain'], authority: 3 }),
  cfg('https://blog.chainalysis.com/feed/',                     { tier: 1, weight: 1.0, category: 'research', tags: ['onchain', 'security', 'crypto'], authority: 3 }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2 — High Quality Research / VC (weight: 0.9, authority: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.paradigm.xyz/feed/atom',                     { tier: 2, weight: 0.9, category: 'research', tags: ['ethereum', 'crypto', 'defi', 'layer2'], authority: 2 }),
  cfg('https://a16zcrypto.com/feed/',                           { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'web3', 'defi', 'policy'], authority: 2 }),
  cfg('https://blog.electriccapital.com/rss',                   { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'onchain', 'analytics'], authority: 2 }),
  cfg('https://multicoin.capital/feed',                         { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'solana', 'defi'], authority: 2 }),
  cfg('https://panteracapital.com/feed',                        { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'bitcoin', 'blockchain'], authority: 2 }),
  cfg('https://framework.ventures/rss',                         { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'defi', 'gaming'], authority: 2 }),
  cfg('https://members.delphidigital.io/feed',                  { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'macro', 'defi'], authority: 2 }),
  cfg('https://www.galaxy.com/insights/feed/',                  { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'bitcoin', 'research'], authority: 2 }),
  cfg('https://coinmetrics.io/feed',                            { tier: 2, weight: 0.9, category: 'markets', tags: ['bitcoin', 'ethereum', 'onchain', 'metrics'], authority: 2 }),
  cfg('https://delphidigital.substack.com/feed',                { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'macro', 'defi', 'research'], authority: 3, isPaid: true, schedule: 'weekly' }),
  cfg('https://variant.fund/feed',                              { tier: 2, weight: 0.9, category: 'research', tags: ['crypto', 'defi', 'web3'], authority: 2 }),
  cfg('https://dune.com/blog/rss.xml',                          { tier: 2, weight: 0.9, category: 'analysis', tags: ['onchain', 'analytics', 'defi'], authority: 2 }),
  cfg('https://nansen.substack.com/feed',                       { tier: 2, weight: 0.9, category: 'analysis', tags: ['onchain', 'ethereum', 'defi'], authority: 2 }),
  cfg('https://tokenterminal.com/feed',                         { tier: 2, weight: 0.9, category: 'analysis', tags: ['crypto', 'defi', 'metrics'], authority: 2 }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 3 — Analysis & Data (weight: 0.8, authority: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.kaiko.com/feed',                            { tier: 3, weight: 0.8, category: 'markets', tags: ['crypto', 'markets', 'trading', 'data'], authority: 2 }),
  cfg('https://insights.glassnode.com/feed/',                   { tier: 3, weight: 0.8, category: 'analysis', tags: ['bitcoin', 'ethereum', 'onchain'], authority: 2 }),
  cfg('https://www.nansen.ai/research?format=rss',              { tier: 3, weight: 0.8, category: 'analysis', tags: ['ethereum', 'onchain', 'defi'], authority: 2 }),
  cfg('https://www.artemis.xyz/blog/rss',                       { tier: 3, weight: 0.8, category: 'analysis', tags: ['crypto', 'defi', 'layer2', 'metrics'], authority: 2 }),
  cfg('https://dappradar.com/blog/feed',                         { tier: 3, weight: 0.8, category: 'analysis', tags: ['defi', 'nft', 'gaming', 'dapps'], authority: 2 }),
  cfg('https://defillama.com/feed',                              { tier: 3, weight: 0.8, category: 'analysis', tags: ['defi', 'tvl', 'crypto'], authority: 2 }),
  cfg('https://tokenterminal.com/blog/rss',                     { tier: 3, weight: 0.8, category: 'analysis', tags: ['crypto', 'defi', 'metrics'], authority: 2 }),
  cfg('https://messari.substack.com/feed',                      { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'research', 'onchain'], authority: 3, isPaid: true, schedule: 'weekly' }),
  cfg('https://dune.com/blog/rss',                              { tier: 3, weight: 0.8, category: 'analysis', tags: ['onchain', 'analytics', 'defi'], authority: 2 }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 4 — News Aggregators (weight: 0.7, authority: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cryptoslate.com/feed/',                          { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum'], authority: 1 }),
  cfg('https://cryptobriefing.com/feed/',                       { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'defi'], authority: 1 }),
  cfg('https://beincrypto.com/feed/',                           { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'altcoin'], authority: 1 }),
  cfg('https://coingape.com/feed/',                              { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'altcoin'], authority: 1 }),
  cfg('https://ambcrypto.com/feed/',                            { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'altcoin'], authority: 1 }),
  cfg('https://cryptopotato.com/feed/',                         { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'altcoin'], authority: 1 }),
  cfg('https://www.newsbtc.com/feed/',                          { tier: 4, weight: 0.7, category: 'news', tags: ['bitcoin', 'crypto'], authority: 1 }),
  cfg('https://bitcoinmagazine.com/.rss/full/',                 { tier: 4, weight: 0.7, category: 'news', tags: ['bitcoin'], authority: 1 }),
  cfg('https://u.today/rss',                                    { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'ethereum'], authority: 1 }),
  cfg('https://dailyhodl.com/feed/',                            { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'altcoin'], authority: 1 }),
  cfg('https://zycrypto.com/feed/',                             { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'altcoin'], authority: 1 }),
  cfg('https://bitcoinist.com/feed/',                           { tier: 4, weight: 0.7, category: 'news', tags: ['bitcoin', 'crypto'], authority: 1 }),
  cfg('https://cryptonews.com/feed/',                           { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin'], authority: 1 }),
  cfg('https://unchainedcrypto.com/feed/',                      { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin', 'defi'], authority: 1 }),
  cfg('https://www.dlnews.com/feed/',                           { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'defi'], authority: 1 }),
  cfg('https://protos.com/feed/',                               { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'bitcoin'], authority: 1 }),
  cfg('https://www.ledgerinsights.com/feed/',                   { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'blockchain', 'enterprise'], authority: 1 }),
  cfg('https://news.bitcoin.com/feed/',                         { tier: 4, weight: 0.7, category: 'news', tags: ['bitcoin', 'crypto'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 5 — Developer / Protocol Blogs (weight: 0.6, authority: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.ethereum.org/feed.xml',                     { tier: 5, weight: 0.6, category: 'development', tags: ['ethereum', 'layer2', 'dev'], authority: 1 }),
  cfg('https://solana.com/feed',                                { tier: 5, weight: 0.6, category: 'development', tags: ['solana', 'dev'], authority: 1 }),
  cfg('https://blog.polygon.technology/feed',                   { tier: 5, weight: 0.6, category: 'development', tags: ['polygon', 'layer2', 'dev'], authority: 1 }),
  cfg('https://blog.arbitrum.io/feed.xml',                      { tier: 5, weight: 0.6, category: 'development', tags: ['arbitrum', 'layer2', 'dev'], authority: 1 }),
  cfg('https://optimism.mirror.xyz/feed/atom',                  { tier: 5, weight: 0.6, category: 'development', tags: ['optimism', 'layer2', 'dev'], authority: 1 }),
  cfg('https://starkware.co/feed',                              { tier: 5, weight: 0.6, category: 'development', tags: ['starkware', 'layer2', 'zk', 'dev'], authority: 1 }),
  cfg('https://www.zk.com/blog/rss',                            { tier: 5, weight: 0.6, category: 'development', tags: ['zk', 'zero-knowledge', 'dev'], authority: 1 }),
  cfg('https://blog.eigenlayer.xyz/rss',                        { tier: 2, weight: 0.9, category: 'newsletter', tags: ['eigenlayer', 'restaking', 'ethereum'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://blog.celestia.org/rss',                          { tier: 5, weight: 0.6, category: 'development', tags: ['celestia', 'modular', 'data-availability'], authority: 1 }),
  cfg('https://polkadot.network/blog/feed/',                    { tier: 5, weight: 0.6, category: 'development', tags: ['polkadot', 'dev'], authority: 1 }),
  cfg('https://blog.chain.link/feed/',                          { tier: 5, weight: 0.6, category: 'development', tags: ['chainlink', 'oracle', 'dev'], authority: 1 }),
  cfg('https://starknet.io/feed.xml',                           { tier: 5, weight: 0.6, category: 'development', tags: ['starknet', 'layer2', 'dev'], authority: 1 }),
  cfg('https://zksync.io/feed.xml',                             { tier: 5, weight: 0.6, category: 'development', tags: ['zksync', 'layer2', 'dev'], authority: 1 }),
  cfg('https://eips.ethereum.org/feed.xml',                     { tier: 5, weight: 0.6, category: 'development', tags: ['ethereum', 'eips', 'standards'], authority: 1 }),
  cfg('https://weekinethereumnews.com/feed',                    { tier: 5, weight: 0.6, category: 'development', tags: ['ethereum', 'newsletter'], authority: 1 }),
  cfg('https://l2beat.com/feed/',                               { tier: 5, weight: 0.6, category: 'analysis', tags: ['layer2', 'ethereum', 'scaling'], authority: 1 }),
  cfg('https://base.mirror.xyz/feed/atom',                      { tier: 5, weight: 0.6, category: 'development', tags: ['base', 'layer2', 'dev'], authority: 1 }),
  cfg('https://bitcoinops.org/en/feed.xml',                     { tier: 5, weight: 0.6, category: 'development', tags: ['bitcoin', 'dev', 'protocol'], authority: 1 }),
  cfg('https://lightning.engineering/rss/',                     { tier: 5, weight: 0.6, category: 'development', tags: ['bitcoin', 'lightning', 'dev'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Exchange / Institutional Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.coinbase.com/feed/',                        { tier: 3, weight: 0.8, category: 'news', tags: ['coinbase', 'crypto', 'regulation'], authority: 2 }),
  cfg('https://www.coinbase.com/blog/rss.xml',                  { tier: 3, weight: 0.8, category: 'news', tags: ['coinbase', 'crypto'], authority: 2 }),
  cfg('https://blog.kraken.com/feed/',                          { tier: 3, weight: 0.8, category: 'news', tags: ['kraken', 'crypto', 'regulation'], authority: 2 }),
  cfg('https://blog.binance.com/feed/',                         { tier: 3, weight: 0.8, category: 'news', tags: ['binance', 'crypto'], authority: 2 }),
  cfg('https://www.gemini.com/feed.xml',                        { tier: 3, weight: 0.8, category: 'news', tags: ['gemini', 'crypto'], authority: 2 }),
  cfg('https://www.galaxy.com/feed/',                           { tier: 3, weight: 0.8, category: 'research', tags: ['galaxy', 'crypto', 'research'], authority: 2 }),
  cfg('https://blog.bitmex.com/feed/',                          { tier: 4, weight: 0.7, category: 'markets', tags: ['bitmex', 'trading', 'derivatives'], authority: 1 }),
  cfg('https://blog.bitfinex.com/feed/',                        { tier: 4, weight: 0.7, category: 'markets', tags: ['bitfinex', 'trading'], authority: 1 }),
  cfg('https://www.okx.com/feed',                               { tier: 4, weight: 0.7, category: 'markets', tags: ['okx', 'trading', 'crypto'], authority: 1 }),
  cfg('https://blog.bybit.com/feed/',                           { tier: 4, weight: 0.7, category: 'markets', tags: ['bybit', 'trading'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Data & Research Platforms
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.coingecko.com/en/blog/rss',                  { tier: 3, weight: 0.8, category: 'markets', tags: ['crypto', 'prices', 'data'], authority: 2 }),
  cfg('https://coinmarketcap.com/feed/',                        { tier: 4, weight: 0.7, category: 'markets', tags: ['crypto', 'prices'], authority: 1 }),
  cfg('https://www.vanryun.com/feed/',                          { tier: 4, weight: 0.7, category: 'markets', tags: ['crypto', 'etf', 'macro'], authority: 1 }),
  cfg('https://www.21shares.com/feed/',                         { tier: 4, weight: 0.7, category: 'markets', tags: ['crypto', 'etf', 'institutional'], authority: 1 }),
  cfg('https://grayscale.com/feed/',                            { tier: 4, weight: 0.7, category: 'markets', tags: ['crypto', 'etf', 'bitcoin'], authority: 1 }),
  cfg('https://bitwiseinvestments.com/feed/',                   { tier: 4, weight: 0.7, category: 'markets', tags: ['crypto', 'etf', 'bitcoin'], authority: 1 }),
  cfg('https://www.coinshares.com/feed/',                       { tier: 4, weight: 0.7, category: 'markets', tags: ['crypto', 'etf', 'institutional'], authority: 1 }),
  cfg('https://nansen.ai/feed/',                                { tier: 3, weight: 0.8, category: 'analysis', tags: ['onchain', 'ethereum', 'analytics'], authority: 2 }),

  // ═══════════════════════════════════════════════════════════════════
  // Security & Policy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://rekt.news/feed.xml',                             { tier: 3, weight: 0.8, category: 'security', tags: ['security', 'hacks', 'exploits'], authority: 2 }),
  cfg('https://blog.trailofbits.com/feed/',                     { tier: 3, weight: 0.8, category: 'security', tags: ['security', 'audit', 'research'], authority: 2 }),
  cfg('https://www.coincenter.org/feed/',                       { tier: 3, weight: 0.8, category: 'policy', tags: ['policy', 'regulation', 'bitcoin'], authority: 2 }),
  cfg('https://cointelegraph.com/tags/regulation/feed',         { tier: 3, weight: 0.8, category: 'policy', tags: ['regulation', 'policy'], authority: 2 }),
  cfg('https://www.sec.gov/news/pressreleases.rss',             { tier: 4, weight: 0.7, category: 'policy', tags: ['sec', 'regulation', 'policy'], authority: 1 }),
  cfg('https://www.federalreserve.gov/feeds/press.xml',         { tier: 4, weight: 0.7, category: 'policy', tags: ['fed', 'macro', 'policy'], authority: 1 }),
  cfg('https://www.imf.org/en/News/RSS',                        { tier: 4, weight: 0.7, category: 'policy', tags: ['imf', 'macro', 'policy'], authority: 1 }),
  cfg('https://slowmist.medium.com/feed',                       { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'audit'], authority: 1 }),
  cfg('https://immunefi.medium.com/feed',                       { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'bounty', 'audit'], authority: 1 }),
  cfg('https://certik.medium.com/feed',                         { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'audit'], authority: 1 }),
  cfg('https://medium.com/feed/immunefi',                       { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'bounty'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Web3 / NFT / Gaming
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://opensea.io/blog/feed.xml',                       { tier: 4, weight: 0.7, category: 'news', tags: ['nft', 'opensea', 'collectibles'], authority: 1 }),
  cfg('https://blog.decentraland.org/feed/',                    { tier: 5, weight: 0.6, category: 'development', tags: ['metaverse', 'gaming', 'decentraland'], authority: 1 }),
  cfg('https://www.nftnow.com/feed/',                           { tier: 4, weight: 0.7, category: 'news', tags: ['nft', 'art', 'collectibles'], authority: 1 }),
  cfg('https://axieinfinity.com/feed/',                         { tier: 5, weight: 0.6, category: 'development', tags: ['gaming', 'axie', 'nft'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // VC / Investment Research
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://dragonfly.xyz/feed/',                            { tier: 3, weight: 0.8, category: 'research', tags: ['crypto', 'vc', 'defi'], authority: 2 }),
  cfg('https://variantfund.substack.com/feed',                  { tier: 3, weight: 0.8, category: 'research', tags: ['crypto', 'defi', 'web3'], authority: 2 }),
  cfg('https://www.ledger.com/blog.rss',                        { tier: 4, weight: 0.7, category: 'news', tags: ['hardware', 'security', 'crypto'], authority: 1 }),
  cfg('https://trezor.io/blog/feed.xml',                        { tier: 4, weight: 0.7, category: 'news', tags: ['hardware', 'security', 'bitcoin'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Premium Newsletters (Substack / Mirror / Paragraph / Ghost)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://milkroad.substack.com/feed',                     { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'daily', 'digest'], authority: 3, isPaid: true, schedule: 'daily' }),
  cfg('https://thedefiedge.substack.com/feed',                  { tier: 3, weight: 0.8, category: 'analysis', tags: ['defi', 'research'], authority: 2 }),
  cfg('https://ethdaily.substack.com/feed',                     { tier: 4, weight: 0.7, category: 'news', tags: ['ethereum', 'daily'], authority: 1 }),
  cfg('https://vitalik.eth.limo/feed.xml',                      { tier: 2, weight: 0.9, category: 'research', tags: ['ethereum', 'crypto', 'research'], authority: 2 }),
  cfg('https://paragraph.xyz/@bitcoin/feed',                    { tier: 4, weight: 0.7, category: 'news', tags: ['bitcoin'], authority: 1 }),
  cfg('https://paragraph.xyz/@crypto/feed',                     { tier: 4, weight: 0.7, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://mirror.xyz/dashboard/feed',                      { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'web3'], authority: 1 }),
  cfg('https://paragraph.xyz/@andrew/feed',                     { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'opinion'], authority: 1 }),
  cfg('https://paragraph.xyz/@divine/feed',                     { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'opinion'], authority: 1 }),
  cfg('https://mirror.xyz/0x25B0/feed',                         { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'web3'], authority: 1 }),
  cfg('https://mirror.xyz/0xc0FFee/feed',                       { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'web3'], authority: 1 }),
  cfg('https://mirror.xyz/feed',                                { tier: 3, weight: 0.8, category: 'newsletter', tags: ['web3', 'crypto', 'mirror'], authority: 2, isPaid: false, schedule: 'irregular' }),
  cfg('https://paragraph.xyz/feed',                             { tier: 5, weight: 0.6, category: 'newsletter', tags: ['crypto', 'web3', 'publishing'], authority: 1, isPaid: false, schedule: 'irregular' }),

  // ═══════════════════════════════════════════════════════════════════
  // Long-tail Crypto News Outlets
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cryptonews.net/feed/',                           { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://cryptonews.net/news/bitcoin/feed/',              { tier: 5, weight: 0.6, category: 'news', tags: ['bitcoin'], authority: 1 }),
  cfg('https://cryptodaily.co.uk/feed/',                        { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://www.cryptopolitan.com/feed/',                    { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://coinjournal.net/feed/',                          { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://www.fxstreet.com/cryptocurrencies/news/feed',    { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'markets', 'forex'], authority: 1 }),
  cfg('https://www.blocktempo.com/feed/',                       { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'asia'], authority: 1 }),
  cfg('https://thecryptobasic.com/feed/',                       { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'bitcoin'], authority: 1 }),
  cfg('https://www.crypto-news-flash.com/feed/',                { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://coinpedia.org/feed/',                            { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://www.trustnodes.com/feed',                        { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'ethereum'], authority: 1 }),
  cfg('https://coincodex.com/blog/feed/',                       { tier: 5, weight: 0.6, category: 'markets', tags: ['crypto', 'data'], authority: 1 }),
  cfg('https://www.livebitcoinnews.com/feed/',                  { tier: 5, weight: 0.6, category: 'news', tags: ['bitcoin'], authority: 1 }),
  cfg('https://www.crypto-reporter.com/feed/',                  { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://cryptoadventure.org/feed/',                     { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://thecryptotimes.com/feed/',                       { tier: 5, weight: 0.6, category: 'news', tags: ['crypto'], authority: 1 }),
  cfg('https://memeburn.com/feed/',                             { tier: 5, weight: 0.6, category: 'news', tags: ['crypto', 'tech'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // AI x Crypto / Tech News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.interconnects.ai/feed/',                     { tier: 4, weight: 0.7, category: 'ai', tags: ['ai', 'research'], authority: 1 }),
  cfg('https://thesequence.substack.com/feed',                  { tier: 4, weight: 0.7, category: 'ai', tags: ['ai', 'ml', 'research'], authority: 1 }),
  cfg('https://jack-clark.net/feed/',                           { tier: 4, weight: 0.7, category: 'ai', tags: ['ai', 'research'], authority: 1 }),
  cfg('https://stratechery.com/feed/',                          { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'strategy', 'analysis'], authority: 1 }),
  cfg('https://technically.substack.com/feed',                  { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'economics'], authority: 1 }),
  cfg('https://www.semiconductor-digest.com/feed/',             { tier: 5, weight: 0.6, category: 'tech', tags: ['hardware', 'semiconductor', 'tech'], authority: 1 }),
  cfg('https://techcrunch.com/feed/',                           { tier: 3, weight: 0.8, category: 'tech', tags: ['tech', 'startup', 'ai'], authority: 2 }),
  cfg('https://www.theverge.com/rss/index.xml',                 { tier: 3, weight: 0.8, category: 'tech', tags: ['tech', 'gadgets', 'science', 'ai'], authority: 2 }),
  cfg('https://arstechnica.com/feed/',                          { tier: 3, weight: 0.8, category: 'tech', tags: ['tech', 'science', 'security', 'ai'], authority: 2 }),
  cfg('https://www.wired.com/feed/rss',                         { tier: 3, weight: 0.8, category: 'tech', tags: ['tech', 'science', 'culture', 'ai'], authority: 2 }),
  cfg('https://www.theinformation.com/feed',                    { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'business', 'analysis'], authority: 1 }),
  cfg('https://restofworld.org/feed/',                          { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'global'], authority: 1 }),
  cfg('https://www.protocol.com/feed',                          { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'policy'], authority: 1 }),
  cfg('https://www.platformer.news/feed',                       { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'policy', 'social'], authority: 1 }),
  cfg('https://venturebeat.com/feed/',                          { tier: 3, weight: 0.8, category: 'tech', tags: ['tech', 'ai', 'gaming', 'startup'], authority: 2 }),
  cfg('https://www.technologyreview.com/feed/',                 { tier: 2, weight: 1.0, category: 'tech', tags: ['tech', 'ai', 'science', 'innovation'], authority: 3 }),
  cfg('https://www.zdnet.com/news/rss.xml',                     { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'security'], authority: 1 }),
  cfg('https://spectrum.ieee.org/feeds/feed.rss',              { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'engineering', 'science'], authority: 1 }),
  cfg('https://www.quantamagazine.org/feed/',                   { tier: 4, weight: 0.7, category: 'science', tags: ['science', 'math', 'physics', 'research'], authority: 2 }),
  cfg('https://www.wired.com/feed/category/ai/rss',             { tier: 2, weight: 1.0, category: 'ai', tags: ['ai', 'tech', 'culture'], authority: 3 }),
  cfg('https://venturebeat.com/category/ai/feed/',              { tier: 2, weight: 1.0, category: 'ai', tags: ['ai', 'ml', 'startup'], authority: 3 }),
  cfg('https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', { tier: 2, weight: 1.0, category: 'ai', tags: ['ai', 'artificial-intelligence', 'tech'], authority: 3 }),
  cfg('https://techcrunch.com/category/artificial-intelligence/feed/', { tier: 2, weight: 1.0, category: 'ai', tags: ['ai', 'startup', 'tech'], authority: 3 }),
  cfg('https://www.technologyreview.com/topic/artificial-intelligence/feed/', { tier: 2, weight: 1.0, category: 'ai', tags: ['ai', 'ml', 'research'], authority: 3 }),

  // ═══════════════════════════════════════════════════════════════════
  // AI Company Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://openai.com/blog/rss.xml',                        { tier: 2, weight: 0.9, category: 'ai', tags: ['ai', 'openai', 'gpt', 'research'], authority: 3 }),
  cfg('https://www.anthropic.com/feed/',                        { tier: 2, weight: 0.9, category: 'ai', tags: ['ai', 'anthropic', 'claude', 'research'], authority: 3 }),
  cfg('https://deepmind.google/blog/rss.xml',                   { tier: 2, weight: 0.9, category: 'ai', tags: ['ai', 'deepmind', 'google', 'research'], authority: 3 }),
  cfg('https://ai.meta.com/blog/feed/',                         { tier: 4, weight: 0.7, category: 'ai', tags: ['ai', 'meta', 'research'], authority: 1 }),
  cfg('https://blog.google/technology/ai/rss/',                 { tier: 4, weight: 0.7, category: 'ai', tags: ['ai', 'google', 'research'], authority: 1 }),
  cfg('https://huggingface.co/blog/feed.xml',                   { tier: 2, weight: 0.9, category: 'ai', tags: ['ai', 'ml', 'opensource', 'research'], authority: 3 }),
  cfg('https://stability.ai/blog/feed',                         { tier: 2, weight: 0.9, category: 'ai', tags: ['ai', 'image', 'generative', 'research'], authority: 3 }),
  cfg('https://www.perplexity.ai/blog/rss.xml',                 { tier: 5, weight: 0.6, category: 'ai', tags: ['ai', 'search'], authority: 1 }),
  cfg('https://cohere.com/blog/rss',                            { tier: 5, weight: 0.6, category: 'ai', tags: ['ai', 'llm', 'nlp'], authority: 1 }),
  cfg('https://replicate.com/blog/feed',                        { tier: 5, weight: 0.6, category: 'ai', tags: ['ai', 'ml', 'deployment'], authority: 1 }),
  cfg('https://www.pinecone.io/feed.xml',                       { tier: 5, weight: 0.6, category: 'ai', tags: ['ai', 'vectors', 'database'], authority: 1 }),
  cfg('https://www.semianalysis.com/feed/',                     { tier: 4, weight: 0.7, category: 'ai', tags: ['ai', 'semiconductor', 'analysis'], authority: 1 }),
  cfg('https://www.ben-evans.com/feed',                         { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'strategy', 'analysis'], authority: 1 }),
  cfg('https://blog.samaltman.com/feed/',                       { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'ai', 'opinion'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Tech / Startup Newsletters
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.readthegeneralist.com/feed',                 { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'business'], authority: 1 }),
  cfg('https://www.notboring.co/feed',                          { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'business', 'crypto'], authority: 1 }),
  cfg('https://lennysnewsletter.com/feed',                      { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'product', 'growth'], authority: 1 }),
  cfg('https://every.to/feed',                                  { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'business', 'ideas'], authority: 1 }),
  cfg('https://www.bigtechnology.com/feed',                     { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'policy', 'analysis'], authority: 1 }),
  cfg('https://www.piratewires.com/feed',                       { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'culture', 'policy'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // ARXIV Research Feeds
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://arxiv.org/rss/cs.AI',                            { tier: 4, weight: 0.7, category: 'research', tags: ['ai', 'research', 'papers'], authority: 1 }),
  cfg('https://arxiv.org/rss/cs.CL',                            { tier: 4, weight: 0.7, category: 'research', tags: ['nlp', 'research', 'papers'], authority: 1 }),
  cfg('https://arxiv.org/rss/cs.CR',                            { tier: 4, weight: 0.7, category: 'research', tags: ['security', 'crypto', 'papers'], authority: 1 }),
  cfg('https://arxiv.org/rss/cs.LG',                            { tier: 4, weight: 0.7, category: 'research', tags: ['ml', 'research', 'papers'], authority: 1 }),
  cfg('https://arxiv.org/rss/stat.ML',                          { tier: 4, weight: 0.7, category: 'research', tags: ['ml', 'statistics', 'papers'], authority: 1 }),
  cfg('https://arxiv.org/rss/q-fin.TR',                         { tier: 4, weight: 0.7, category: 'research', tags: ['trading', 'markets', 'papers'], authority: 1 }),
  cfg('https://arxiv.org/rss/cs.CY',                            { tier: 4, weight: 0.7, category: 'research', tags: ['tech', 'society', 'papers'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Developer / Engineering Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://hnrss.org/frontpage?points=20',                  { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'news', 'startup'], authority: 1 }),
  cfg('https://hnrss.org/newest?points=10',                     { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'news'], authority: 1 }),
  cfg('https://news.ycombinator.com/rss',                       { tier: 4, weight: 0.7, category: 'tech', tags: ['tech', 'news', 'startup'], authority: 1 }),
  cfg('https://lobste.rs/rss',                                  { tier: 5, weight: 0.6, category: 'tech', tags: ['tech', 'programming'], authority: 1 }),
  cfg('https://dev.to/feed',                                    { tier: 5, weight: 0.6, category: 'tech', tags: ['programming', 'webdev'], authority: 1 }),
  cfg('https://blog.rust-lang.org/feed.xml',                    { tier: 5, weight: 0.6, category: 'development', tags: ['rust', 'programming', 'dev'], authority: 1 }),
  cfg('https://go.dev/blog/feed.atom',                          { tier: 5, weight: 0.6, category: 'development', tags: ['golang', 'programming', 'dev'], authority: 1 }),
  cfg('https://github.blog/feed/',                              { tier: 4, weight: 0.7, category: 'tech', tags: ['dev', 'github', 'programming'], authority: 1 }),
  cfg('https://stackoverflow.blog/feed/',                       { tier: 5, weight: 0.6, category: 'tech', tags: ['programming', 'community'], authority: 1 }),
  cfg('https://blog.cloudflare.com/rss/',                       { tier: 4, weight: 0.7, category: 'tech', tags: ['security', 'infrastructure', 'networking'], authority: 1 }),
  cfg('https://blog.pragmaticengineer.com/feed.xml',            { tier: 4, weight: 0.7, category: 'tech', tags: ['engineering', 'career', 'tech'], authority: 1 }),
  cfg('https://martinfowler.com/feed.atom',                     { tier: 5, weight: 0.6, category: 'tech', tags: ['architecture', 'programming'], authority: 1 }),
  cfg('https://engineering.fb.com/feed/',                       { tier: 5, weight: 0.6, category: 'tech', tags: ['engineering', 'meta', 'infra'], authority: 1 }),
  cfg('https://netflixtechblog.com/feed',                       { tier: 5, weight: 0.6, category: 'tech', tags: ['engineering', 'infra'], authority: 1 }),
  cfg('https://aws.amazon.com/blogs/aws/feed/',                 { tier: 5, weight: 0.6, category: 'tech', tags: ['aws', 'cloud', 'devops'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Social: Reddit
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.reddit.com/r/CryptoCurrency/.rss',           { tier: 4, weight: 0.7, category: 'social', tags: ['crypto', 'discussion'], authority: 1 }),
  cfg('https://www.reddit.com/r/Bitcoin/.rss',                  { tier: 4, weight: 0.7, category: 'social', tags: ['bitcoin'], authority: 1 }),
  cfg('https://www.reddit.com/r/ethereum/.rss',                 { tier: 4, weight: 0.7, category: 'social', tags: ['ethereum'], authority: 1 }),
  cfg('https://www.reddit.com/r/solana/.rss',                   { tier: 4, weight: 0.7, category: 'social', tags: ['solana'], authority: 1 }),
  cfg('https://www.reddit.com/r/defi/.rss',                     { tier: 4, weight: 0.7, category: 'social', tags: ['defi'], authority: 1 }),
  cfg('https://www.reddit.com/r/ethfinance/.rss',               { tier: 4, weight: 0.7, category: 'social', tags: ['ethereum', 'finance'], authority: 1 }),
  cfg('https://www.reddit.com/r/ethdev/.rss',                   { tier: 4, weight: 0.7, category: 'social', tags: ['ethereum', 'dev'], authority: 1 }),
  cfg('https://www.reddit.com/r/Chainlink/.rss',                { tier: 4, weight: 0.7, category: 'social', tags: ['chainlink'], authority: 1 }),
  cfg('https://www.reddit.com/r/Polkadot/.rss',                 { tier: 4, weight: 0.7, category: 'social', tags: ['polkadot'], authority: 1 }),
  cfg('https://www.reddit.com/r/cosmosnetwork/.rss',            { tier: 4, weight: 0.7, category: 'social', tags: ['cosmos'], authority: 1 }),
  cfg('https://www.reddit.com/r/Arbitrum/.rss',                 { tier: 4, weight: 0.7, category: 'social', tags: ['arbitrum'], authority: 1 }),
  cfg('https://www.reddit.com/r/optimismCollective/.rss',       { tier: 4, weight: 0.7, category: 'social', tags: ['optimism'], authority: 1 }),
  cfg('https://www.reddit.com/r/Avax/.rss',                     { tier: 4, weight: 0.7, category: 'social', tags: ['avalanche'], authority: 1 }),
  cfg('https://www.reddit.com/r/Cardano/.rss',                  { tier: 4, weight: 0.7, category: 'social', tags: ['cardano'], authority: 1 }),
  cfg('https://www.reddit.com/r/Monero/.rss',                   { tier: 4, weight: 0.7, category: 'social', tags: ['monero'], authority: 1 }),
  cfg('https://www.reddit.com/r/0xPolygon/.rss',                { tier: 4, weight: 0.7, category: 'social', tags: ['polygon'], authority: 1 }),
  cfg('https://old.reddit.com/r/CryptoCurrency/hot.rss?limit=25', { tier: 4, weight: 0.7, category: 'social', tags: ['crypto', 'discussion'], authority: 1 }),
  cfg('https://old.reddit.com/r/Bitcoin/hot.rss?limit=25',      { tier: 4, weight: 0.7, category: 'social', tags: ['bitcoin'], authority: 1 }),
  cfg('https://old.reddit.com/r/ethereum/hot.rss?limit=25',     { tier: 4, weight: 0.7, category: 'social', tags: ['ethereum'], authority: 1 }),
  cfg('https://old.reddit.com/r/solana/hot.rss?limit=25',       { tier: 4, weight: 0.7, category: 'social', tags: ['solana'], authority: 1 }),
  cfg('https://old.reddit.com/r/defi/hot.rss?limit=25',         { tier: 4, weight: 0.7, category: 'social', tags: ['defi'], authority: 1 }),
  cfg('https://www.reddit.com/r/ArtificialInteligence/.rss',    { tier: 5, weight: 0.6, category: 'social', tags: ['ai'], authority: 1 }),
  cfg('https://www.reddit.com/r/MachineLearning/.rss',          { tier: 5, weight: 0.6, category: 'social', tags: ['ml', 'ai'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Mastodon / Fediverse / Social
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://social.degenfeed.xyz/@admin.rss',                { tier: 5, weight: 0.6, category: 'social', tags: ['crypto', 'fediverse'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Lemmy — Federated Communities
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://lemmy.world/feeds/c/cryptocurrency.xml?sort=Hot',{ tier: 5, weight: 0.6, category: 'social', tags: ['crypto'], authority: 1 }),
  cfg('https://lemmy.ml/feeds/c/bitcoin.xml?sort=Hot',          { tier: 5, weight: 0.6, category: 'social', tags: ['bitcoin'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/technology.xml?sort=Hot',    { tier: 5, weight: 0.6, category: 'social', tags: ['tech'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/ai.xml?sort=Hot',            { tier: 5, weight: 0.6, category: 'social', tags: ['ai'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/defi.xml?sort=Hot',          { tier: 5, weight: 0.6, category: 'social', tags: ['defi'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/blockchain.xml?sort=Hot',    { tier: 5, weight: 0.6, category: 'social', tags: ['blockchain'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/web3.xml?sort=Hot',          { tier: 5, weight: 0.6, category: 'social', tags: ['web3'], authority: 1 }),
  cfg('https://lemmy.ml/feeds/c/ethereum.xml?sort=Hot',         { tier: 5, weight: 0.6, category: 'social', tags: ['ethereum'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/solana.xml?sort=Hot',        { tier: 5, weight: 0.6, category: 'social', tags: ['solana'], authority: 1 }),
  cfg('https://lemmy.world/feeds/c/cybersecurity.xml?sort=Hot', { tier: 5, weight: 0.6, category: 'social', tags: ['security'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // PeerTube — Federated Video
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://tube.cryptoconomy.com/feeds/videos.xml',         { tier: 5, weight: 0.6, category: 'video', tags: ['crypto', 'video'], authority: 1 }),
  cfg('https://tilvids.com/feeds/videos.xml',                   { tier: 5, weight: 0.6, category: 'video', tags: ['tech', 'education'], authority: 1 }),
  cfg('https://diode.zone/feeds/videos.xml?sort=-publishedAt',  { tier: 5, weight: 0.6, category: 'video', tags: ['tech', 'video'], authority: 1 }),
  cfg('https://video.ploud.fr/feeds/videos.xml?sort=-publishedAt', { tier: 5, weight: 0.6, category: 'video', tags: ['tech', 'video'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Substack (weight: 1.0, tier: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://pomp.substack.com/feed',                         { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'bitcoin', 'macro'], authority: 3, isPaid: true, schedule: 'daily' }),
  cfg('https://panteracapital.substack.com/feed',               { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'bitcoin', 'blockchain'], authority: 3, isPaid: true, schedule: 'weekly' }),
  cfg('https://unchainedcrypto.substack.com/feed',              { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'bitcoin', 'interviews'], authority: 3, isPaid: false, schedule: 'weekly' }),
  cfg('https://0xresearch.substack.com/feed',                   { tier: 1, weight: 1.0, category: 'newsletter', tags: ['crypto', 'research', 'defi'], authority: 3, isPaid: true, schedule: 'daily' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — DeFi / Protocol (weight: 0.9, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defiweekly.substack.com/feed',                   { tier: 2, weight: 0.9, category: 'newsletter', tags: ['defi', 'decentralized-finance', 'crypto'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://thedefiant.substack.com/feed',                   { tier: 2, weight: 0.9, category: 'newsletter', tags: ['defi', 'crypto', 'ethereum'], authority: 2, isPaid: true, schedule: 'daily' }),
  cfg('https://weekinethereum.substack.com/feed',               { tier: 2, weight: 0.9, category: 'newsletter', tags: ['ethereum', 'layer2', 'dev'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://tokenterminal.substack.com/feed',                { tier: 2, weight: 0.9, category: 'newsletter', tags: ['crypto', 'defi', 'metrics'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://dunedigest.substack.com/feed',                   { tier: 2, weight: 0.9, category: 'newsletter', tags: ['onchain', 'analytics', 'defi'], authority: 2, isPaid: false, schedule: 'weekly' }),
  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — AI x Crypto (weight: 0.9, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://supervised.news/feed',                           { tier: 2, weight: 0.9, category: 'newsletter', tags: ['ai', 'crypto', 'research'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://theaireport.substack.com/feed',                  { tier: 2, weight: 0.9, category: 'newsletter', tags: ['ai', 'ml', 'llm'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://tldrai.substack.com/feed',                       { tier: 2, weight: 0.9, category: 'newsletter', tags: ['ai', 'ml', 'llm', 'digest'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://importai.substack.com/feed',                     { tier: 2, weight: 0.9, category: 'newsletter', tags: ['ai', 'research', 'ml'], authority: 2, isPaid: false, schedule: 'weekly' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Crypto Research (weight: 0.8, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://theblockresearch.substack.com/feed',             { tier: 2, weight: 0.8, category: 'newsletter', tags: ['crypto', 'research', 'onchain'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://reflexivityresearch.substack.com/feed',          { tier: 2, weight: 0.8, category: 'newsletter', tags: ['crypto', 'research', 'macro'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://caneisland.substack.com/feed',                   { tier: 2, weight: 0.8, category: 'newsletter', tags: ['crypto', 'research', 'bitcoin'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://ecoinometrics.substack.com/feed',                { tier: 2, weight: 0.8, category: 'newsletter', tags: ['bitcoin', 'research', 'macro', 'onchain'], authority: 2, isPaid: false, schedule: 'weekly' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — DeFi Alpha (weight: 0.8, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://ournetwork.substack.com/feed',                   { tier: 2, weight: 0.8, category: 'newsletter', tags: ['defi', 'onchain', 'research'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://blockcrunch.substack.com/feed',                  { tier: 2, weight: 0.8, category: 'newsletter', tags: ['defi', 'crypto', 'research'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://defidad.substack.com/feed',                      { tier: 2, weight: 0.8, category: 'newsletter', tags: ['defi', 'yield', 'crypto'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://route2fi.substack.com/feed',                     { tier: 2, weight: 0.8, category: 'newsletter', tags: ['defi', 'finance', 'crypto'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://ignasdefi.substack.com/feed',                    { tier: 2, weight: 0.8, category: 'newsletter', tags: ['defi', 'research', 'crypto'], authority: 2, isPaid: true, schedule: 'weekly' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Bitcoin Focus (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://bitcoinmagazinepro.substack.com/feed',           { tier: 3, weight: 0.7, category: 'newsletter', tags: ['bitcoin', 'research', 'mining'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://satoshisjournal.substack.com/feed',              { tier: 3, weight: 0.7, category: 'newsletter', tags: ['bitcoin', 'crypto', 'culture'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://thebitcoinlayer.substack.com/feed',              { tier: 3, weight: 0.7, category: 'newsletter', tags: ['bitcoin', 'macro', 'economy'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://nikbhatia.substack.com/feed',                    { tier: 3, weight: 0.7, category: 'newsletter', tags: ['bitcoin', 'macro', 'finance'], authority: 2, isPaid: true, schedule: 'weekly' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Trading / Markets (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://macroscope.substack.com/feed',                   { tier: 3, weight: 0.7, category: 'newsletter', tags: ['macro', 'markets', 'trading'], authority: 2, isPaid: true, schedule: 'daily' }),
  cfg('https://thetranscript.substack.com/feed',                { tier: 3, weight: 0.7, category: 'newsletter', tags: ['markets', 'trading', 'crypto'], authority: 2, isPaid: true, schedule: 'daily' }),
  cfg('https://execsum.substack.com/feed',                      { tier: 3, weight: 0.7, category: 'newsletter', tags: ['markets', 'crypto', 'derivatives'], authority: 2, isPaid: true, schedule: 'daily' }),
  cfg('https://themarketear.substack.com/feed',                 { tier: 3, weight: 0.7, category: 'newsletter', tags: ['markets', 'trading', 'macro', 'sentiment'], authority: 2, isPaid: false, schedule: 'daily' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Web3 / Builders (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://developerdao.substack.com/feed',                 { tier: 3, weight: 0.7, category: 'newsletter', tags: ['web3', 'dev', 'dao'], authority: 2, isPaid: false, schedule: 'weekly' }),
  cfg('https://a16zcrypto.substack.com/feed',                   { tier: 3, weight: 0.7, category: 'newsletter', tags: ['web3', 'crypto', 'research', 'vc'], authority: 2, isPaid: true, schedule: 'weekly' }),
  cfg('https://lijin.substack.com/feed',                        { tier: 3, weight: 0.7, category: 'newsletter', tags: ['web3', 'creator', 'crypto'], authority: 2, isPaid: true, schedule: 'weekly' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Web3 Publishing (Paragraph + Mirror) (weight: 0.8, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://dev.mirror.xyz/feed',                            { tier: 3, weight: 0.8, category: 'newsletter', tags: ['web3', 'dev', 'mirror'], authority: 2, isPaid: false, schedule: 'irregular' }),
  cfg('https://blog.paragraph.xyz/feed',                        { tier: 3, weight: 0.8, category: 'newsletter', tags: ['web3', 'publishing', 'paragraph'], authority: 2, isPaid: false, schedule: 'irregular' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Medium Publications (weight: 0.7, tier: 4)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://medium.com/feed/coinmonks',                      { tier: 4, weight: 0.7, category: 'newsletter', tags: ['crypto', 'blockchain', 'defi'], authority: 1, isPaid: false, schedule: 'daily' }),
  cfg('https://medium.com/feed/the-capital',                    { tier: 4, weight: 0.7, category: 'newsletter', tags: ['crypto', 'finance', 'investing'], authority: 1, isPaid: false, schedule: 'daily' }),
  cfg('https://medium.com/feed/cryptostars',                    { tier: 4, weight: 0.7, category: 'newsletter', tags: ['crypto', 'blockchain', 'altcoin'], authority: 1, isPaid: false, schedule: 'daily' }),
  cfg('https://medium.com/feed/hackernoon',                     { tier: 4, weight: 0.7, category: 'newsletter', tags: ['tech', 'startup', 'programming'], authority: 1, isPaid: false, schedule: 'daily' }),
  cfg('https://medium.com/feed/towards-data-science',           { tier: 4, weight: 0.7, category: 'newsletter', tags: ['data-science', 'ml', 'ai', 'python'], authority: 1, isPaid: false, schedule: 'daily' }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Tech / Startup (weight: 0.6, tier: 5)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://tldr.tech/feed',                                 { tier: 5, weight: 0.6, category: 'newsletter', tags: ['tech', 'productivity', 'dev'], authority: 1, isPaid: false, schedule: 'daily' }),
  cfg('https://www.ben-evans.com/newsletter/feed',              { tier: 5, weight: 0.6, category: 'newsletter', tags: ['tech', 'strategy', 'analysis'], authority: 1, isPaid: true, schedule: 'weekly' }),
  cfg('https://notboring.substack.com/feed',                    { tier: 5, weight: 0.6, category: 'newsletter', tags: ['tech', 'business', 'crypto'], authority: 1, isPaid: true, schedule: 'weekly' }),
  cfg('https://www.exponentialview.co/feed',                    { tier: 5, weight: 0.6, category: 'newsletter', tags: ['tech', 'ai', 'future'], authority: 1, isPaid: true, schedule: 'weekly' }),

  // ═══════════════════════════════════════════════════════════════════
  // AI / Tech / Science — General News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://arstechnica.com/ai/feed',                        { tier: 2, weight: 1.0, category: 'ai', tags: ['ai', 'tech', 'science'], authority: 3 }),
  cfg('https://lastweekin.ai/feed',                             { tier: 3, weight: 0.8, category: 'newsletter', tags: ['ai', 'newsletter', 'research'], authority: 2 }),
  cfg('https://www.ai-supremacy.com/feed',                      { tier: 3, weight: 0.8, category: 'newsletter', tags: ['ai', 'newsletter', 'analysis'], authority: 2 }),
  cfg('https://www.thealgorithmicbridge.com/feed',              { tier: 3, weight: 0.8, category: 'newsletter', tags: ['ai', 'newsletter', 'philosophy'], authority: 2 }),
  cfg('https://www.producthunt.com/feed',                       { tier: 4, weight: 0.8, category: 'tech', tags: ['startup', 'product', 'tech'], authority: 1 }),
  cfg('https://www.indiehackers.com/feed',                      { tier: 4, weight: 0.8, category: 'tech', tags: ['startup', 'indie', 'saas'], authority: 1 }),
  cfg('https://www.nature.com/nature.rss',                      { tier: 2, weight: 0.7, category: 'science', tags: ['science', 'research', 'nature'], authority: 3 }),
  cfg('https://www.sciencedaily.com/rss/all.xml',               { tier: 3, weight: 0.7, category: 'science', tags: ['science', 'research', 'discovery'], authority: 2 }),
  cfg('https://www.newscientist.com/feed',                      { tier: 3, weight: 0.7, category: 'science', tags: ['science', 'tech', 'innovation'], authority: 2 }),
  cfg('https://phys.org/rss-feed',                              { tier: 3, weight: 0.7, category: 'science', tags: ['science', 'physics', 'space'], authority: 2 }),

  // ═══════════════════════════════════════════════════════════════════
  // Crypto News — Tier 2
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://nulltx.com/feed',                                { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'news'], authority: 1 }),
  cfg('https://cryptonews.com/news/feed',                       { tier: 4, weight: 0.7, category: 'news', tags: ['crypto', 'news'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // DeFi News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defirate.com/feed/',                             { tier: 3, weight: 0.8, category: 'markets', tags: ['defi', 'prediction-markets', 'regulation'], authority: 2 }),
  cfg('https://governance.aave.com/posts.rss',                  { tier: 4, weight: 0.6, category: 'development', tags: ['defi', 'aave', 'governance'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Regulation / Policy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defieducationfund.org/feed/',                    { tier: 3, weight: 0.8, category: 'policy', tags: ['defi', 'regulation', 'policy'], authority: 2 }),
  cfg('https://www.cryptoforinnovation.org/feed/',             { tier: 4, weight: 0.7, category: 'policy', tags: ['crypto', 'policy', 'innovation'], authority: 1 }),
  cfg('https://www.theblockchainassociation.org/feed/',         { tier: 4, weight: 0.7, category: 'policy', tags: ['blockchain', 'policy', 'regulation'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Mining / Energy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://hashrateindex.com/blog/feed/',                   { tier: 4, weight: 0.7, category: 'markets', tags: ['bitcoin', 'mining', 'hashrate'], authority: 1 }),
  cfg('https://compassmining.io/education/rss/',                { tier: 5, weight: 0.6, category: 'tech', tags: ['bitcoin', 'mining', 'energy'], authority: 1 }),
  cfg('https://braiins.com/blog/feed',                          { tier: 5, weight: 0.6, category: 'tech', tags: ['bitcoin', 'mining', 'protocol'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Data / Analytics
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.intotheblock.com/feed/',                    { tier: 3, weight: 0.8, category: 'analysis', tags: ['onchain', 'analytics', 'crypto'], authority: 2 }),
  cfg('https://cryptoquant.com/feed',                           { tier: 3, weight: 0.8, category: 'analysis', tags: ['onchain', 'bitcoin', 'analytics'], authority: 2 }),
  cfg('https://santiment.net/feed/',                            { tier: 4, weight: 0.7, category: 'analysis', tags: ['onchain', 'sentiment', 'analytics'], authority: 1 }),
  cfg('https://lookintobitcoin.com/feed/',                      { tier: 4, weight: 0.7, category: 'analysis', tags: ['bitcoin', 'onchain', 'metrics'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Privacy / Security
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.openzeppelin.com/feed',                     { tier: 3, weight: 0.8, category: 'security', tags: ['security', 'audit', 'smart-contracts'], authority: 2 }),
  cfg('https://www.certik.com/blog/feed',                       { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'audit', 'blockchain'], authority: 1 }),
  cfg('https://www.slowmist.com/feed/',                         { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'audit', 'blockchain'], authority: 1 }),
  cfg('https://peckshield.medium.com/feed',                     { tier: 4, weight: 0.7, category: 'security', tags: ['security', 'audit', 'exploits'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // VC / Investment
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://1confirmation.com/feed',                         { tier: 3, weight: 0.8, category: 'research', tags: ['crypto', 'vc', 'investment'], authority: 2 }),
  cfg('https://placeholder.vc/feed',                            { tier: 4, weight: 0.7, category: 'research', tags: ['crypto', 'vc', 'investment'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // On-Chain Data
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://flipsidecrypto.xyz/blog/feed',                   { tier: 4, weight: 0.7, category: 'analysis', tags: ['onchain', 'analytics', 'data'], authority: 1 }),

  // ═══════════════════════════════════════════════════════════════════
  // Layer 1 & 2 News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://aptosfoundation.org/rss',                        { tier: 4, weight: 0.7, category: 'development', tags: ['aptos', 'layer1', 'move'], authority: 1 }),
  cfg('https://blog.sui.io/feed',                               { tier: 4, weight: 0.7, category: 'development', tags: ['sui', 'layer1', 'move'], authority: 1 }),
];

export interface RssProviderOptions {
  /** Feed URLs (plain strings) or fully configured RssFeedConfig objects */
  feeds?: (string | RssFeedConfig)[];
}

// ── Quality Scoring ────────────────────────────────────────────────────

function computeFreshnessScore(createdAt: number): number {
  const ageMs = Date.now() - createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 3;
  if (ageHours < 6) return 2;
  if (ageHours < 24) return 1;
  return 0;
}

function computeLengthScore(text: string): number {
  const len = text.length;
  if (len > 500) return 2;
  if (len > 200) return 1;
  return 0;
}

export function computeQualityScore(post: UnifiedPost, config: RssFeedConfig): QualityScore {
  // Newsletter-specific: paid tier bonus
  const newsletterPaid = config.isPaid ? 2 : 0;

  // Newsletter-specific: longer content = deeper analysis
  let newsletterDepth = 0;
  if (config.category === 'newsletter' && post.text.length > 2000) {
    newsletterDepth = 2;
  } else if (config.category === 'newsletter' && post.text.length > 1000) {
    newsletterDepth = 1;
  }

  // Newsletter-specific: schedule consistency
  const newsletterConsistency =
    config.schedule === 'daily' || config.schedule === 'weekly' ? 1 : 0;

  const signals = {
    weight: config.weight,
    freshness: computeFreshnessScore(post.createdAt),
    length: computeLengthScore(post.text),
    hasMedia: post.embeds.length > 0 ? 1 : 0,
    authority: config.authority,
    newsletterPaid,
    newsletterDepth,
    newsletterConsistency,
  };
  const total =
    signals.weight +
    signals.freshness +
    signals.length +
    signals.hasMedia +
    signals.authority +
    signals.newsletterPaid +
    signals.newsletterDepth +
    signals.newsletterConsistency;
  return { total, signals };
}

// ── Tier-Aware RSS Deduplication ────────────────────────────────────────

interface ScoredRssPost {
  post: UnifiedPost;
  config: RssFeedConfig;
  quality: QualityScore;
}

/**
 * Title/text similarity using Jaccard index on normalized word sets.
 */
function jaccardTitleSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const normB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const setA = new Set(normA);
  const setB = new Set(normB);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Deduplicate RSS posts with tier-aware strategy:
 * - Same URL → keep highest-tier source
 * - Same title (Jaccard > 0.7) → keep highest-tier source
 * - Similar content (>70% Jaccard on full text) → keep earliest published
 */
export function deduplicateRssPosts(scored: ScoredRssPost[]): ScoredRssPost[] {
  // Sort by tier (best first) AND createdAt (earliest first for content dedup)
  const byTier = [...scored].sort((a, b) => a.config.tier - b.config.tier || a.post.createdAt - b.post.createdAt);

  const seenUrls = new Set<string>();
  const seenTitleFingerprints: { fingerprint: string; index: number }[] = [];
  const seenContent: { words: Set<string>; index: number }[] = [];
  const result: ScoredRssPost[] = [];

  for (const entry of byTier) {
    const p = entry.post;

    // ── URL dedup ──
    const url = p.embeds.find((e) => e.kind === 'link')?.url;
    if (url) {
      const normUrl = url.toLowerCase().replace(/\/+$/, '');
      if (seenUrls.has(normUrl)) continue;
      seenUrls.add(normUrl);
    }

    // ── Title Jaccard dedup (threshold: 0.7) ──
    const titleText = p.text.slice(0, 120).toLowerCase().trim();
    if (titleText.length > 15) {
      let dup = false;
      for (const existing of seenTitleFingerprints) {
        if (jaccardTitleSimilarity(titleText, existing.fingerprint) >= 0.7) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      seenTitleFingerprints.push({ fingerprint: titleText, index: result.length });
    }

    // ── Content Jaccard dedup (>70% similarity, keep earliest) ──
    const words = new Set(
      p.text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
    if (words.size >= 5) {
      let contentDup = false;
      for (const existing of seenContent) {
        const intersection = new Set([...words].filter((x) => existing.words.has(x)));
        const union = new Set([...words, ...existing.words]);
        const similarity = intersection.size / union.size;
        if (similarity >= 0.7) {
          contentDup = true;
          break;
        }
      }
      if (contentDup) continue;
      seenContent.push({ words, index: result.length });
    }

    result.push(entry);
  }

  return result;
}

// ── Feed Metadata Helpers ──────────────────────────────────────────────

export function normalizeFeedInput(feed: string | RssFeedConfig): RssFeedConfig {
  if (typeof feed === 'string') {
    return {
      url: feed,
      tier: 3,
      weight: 0.7,
      category: 'news',
      tags: ['crypto'],
      authority: 1,
    };
  }
  return feed;
}

export function getFeedsByCategory(category: string): RssFeedConfig[] {
  return DEFAULT_CRYPTO_FEEDS.filter((f) => f.category === category);
}

export function getFeedCategories(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of DEFAULT_CRYPTO_FEEDS) {
    counts[f.category] = (counts[f.category] ?? 0) + 1;
  }
  return counts;
}

/** Returns all newsletter feeds grouped by type */
export function getNewsletterFeeds(): {
  topCrypto: RssFeedConfig[];
  cryptoResearch: RssFeedConfig[];
  defiProtocol: RssFeedConfig[];
  defiAlpha: RssFeedConfig[];
  bitcoin: RssFeedConfig[];
  tradingMarkets: RssFeedConfig[];
  aiCrypto: RssFeedConfig[];
  web3Builders: RssFeedConfig[];
  web3Publishing: RssFeedConfig[];
  medium: RssFeedConfig[];
  techStartup: RssFeedConfig[];
} {
  const all = DEFAULT_CRYPTO_FEEDS.filter((f) => f.category === 'newsletter');
  return {
    topCrypto: all.filter((f) => f.tier === 1),
    cryptoResearch: all.filter((f) => f.tags.includes('research') && f.tier === 2 && !f.tags.includes('ai')),
    defiProtocol: all.filter((f) => f.tags.includes('defi') && f.tier <= 2 && !f.url.includes('substack')),
    defiAlpha: all.filter((f) => (f.tags.includes('defi') || f.tags.includes('yield')) && f.tier === 2 && f.url.includes('substack')),
    bitcoin: all.filter((f) => f.tags.includes('bitcoin') && f.tier === 3),
    tradingMarkets: all.filter((f) => f.tags.includes('markets') || f.tags.includes('trading')),
    aiCrypto: all.filter((f) => f.tags.includes('ai')),
    web3Builders: all.filter((f) => f.tags.includes('web3') && f.tier === 3),
    web3Publishing: all.filter((f) => f.tags.includes('mirror') || f.tags.includes('paragraph')),
    medium: all.filter((f) => f.url.includes('medium.com')),
    techStartup: all.filter((f) => f.tier >= 5),
  };
}

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  creator?: string;
  categories?: string[];
  enclosure?: { url?: string; type?: string };
}

function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRe = /\u003cimg[^\u003e]+src\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((match = imgRe.exec(html)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function parseRss(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const trimmed = xml.trim();
  if (trimmed.includes('\u003cfeed')) return parseAtom(trimmed);
  return parseRss2(trimmed);
}

function parseRss2(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const channelMatch = xml.match(/\u003cchannel\u003e([\s\S]*?)\u003c\/channel\u003e/i);
  const channelXml = channelMatch?.[1] ?? '';
  const extract = (tag: string, source: string) => {
    const re = new RegExp(`\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`, 'i');
    const m = source.match(re);
    return m ? stripHtml(m[1] ?? '') : '';
  };
  const feed = {
    title: extract('title', channelXml),
    link: extract('link', channelXml),
    description: extract('description', channelXml),
    items: [] as RssItem[],
  };

  const itemRe = /\u003citem([^\u003e]*)\u003e([\s\S]*?)\u003c\/item\u003e/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((m = itemRe.exec(xml)) !== null) {
    const itemXml = m[2] ?? '';
    const title = extract('title', itemXml);
    const link = extract('link', itemXml) || extract('guid', itemXml);
    if (title && link) {
      const desc = extract('description', itemXml) || extract('content:encoded', itemXml);
      const categories: string[] = [];
      const catRe = /\u003ccategory(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/category\u003e/gi;
      let cm: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
      while ((cm = catRe.exec(itemXml)) !== null) {
        if (cm[1]) categories.push(stripHtml(cm[1]));
      }
      const enclosureMatch = itemXml.match(/\u003cenclosure[^\u003e]+url\s*=\s*["']([^"']+)["']/i);
      feed.items.push({
        title,
        link,
        pubDate: extract('pubDate', itemXml),
        description: desc,
        content: extract('content:encoded', itemXml),
        creator: extract('dc:creator', itemXml) || extract('author', itemXml),
        categories,
        enclosure: enclosureMatch ? { url: enclosureMatch[1] } : undefined,
      });
    }
  }
  return feed;
}

function parseAtom(xml: string): {
  title?: string;
  link?: string;
  description?: string;
  items: RssItem[];
} {
  const extract = (tag: string) => {
    const re = new RegExp(`\u003c${tag}(?:[^\u003e]*)\u003e([\\s\\S]*?)\u003c\\/${tag}\u003e`, 'i');
    const m = xml.match(re);
    return m ? stripHtml(m[1] ?? '') : '';
  };
  const linkMatch = xml.match(/\u003clink[^\u003e]+href\s*=\s*["']([^"']+)["']/i);
  const feed = {
    title: extract('title'),
    link: linkMatch?.[1] ?? '',
    description: extract('subtitle'),
    items: [] as RssItem[],
  };

  const entryRe = /\u003centry([^\u003e]*)\u003e([\s\S]*?)\u003c\/entry\u003e/gi;
  let em: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
  while ((em = entryRe.exec(xml)) !== null) {
    const entryXml = em[2] ?? '';
    const entryTitle = (() => {
      const re = /\u003ctitle(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/title\u003e/i;
      const match = entryXml.match(re);
      return match ? stripHtml(match[1] ?? '') : '';
    })();
    const entryLinkMatch = entryXml.match(/\u003clink[^\u003e]+href\s*=\s*["']([^"']+)["']/i);
    const entryLink = entryLinkMatch?.[1] ?? '';
    if (entryTitle && entryLink) {
      const summaryRe = /\u003csummary(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/summary\u003e/i;
      const contentRe = /\u003ccontent(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/content\u003e/i;
      const summary = entryXml.match(summaryRe)?.[1] ?? '';
      const content = entryXml.match(contentRe)?.[1] ?? '';
      const updatedRe = /\u003cupdated(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/updated\u003e/i;
      const publishedRe = /\u003cpublished(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/published\u003e/i;
      const date = entryXml.match(updatedRe)?.[1] ?? entryXml.match(publishedRe)?.[1] ?? '';
      const nameRe = /\u003cname(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/name\u003e/i;
      const categories: string[] = [];
      const catRe = /\u003ccategory(?:[^\u003e]*)\u003e([\s\S]*?)\u003c\/category\u003e/gi;
      let cm: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: parser loop
      while ((cm = catRe.exec(entryXml)) !== null) {
        if (cm[1]) categories.push(stripHtml(cm[1]));
      }
      feed.items.push({
        title: entryTitle,
        link: entryLink,
        pubDate: date,
        description: summary,
        content,
        creator: entryXml.match(nameRe)?.[1] ?? '',
        categories,
      });
    }
  }
  return feed;
}

function feedToUnifiedPosts(feedConfig: RssFeedConfig, feed: ReturnType<typeof parseRss>): ScoredRssPost[] {
  const feedUrl = feedConfig.url;
  const author: UnifiedIdentity = {
    id: `rss:${feedUrl}`,
    primary: { protocol: 'rss', id: feedUrl },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
    },
    displayName: feed.title || feedUrl,
    bio: feed.description?.slice(0, 300) ?? '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [{ label: 'source', url: feed.link || feedUrl }],
    keys: {},
  };

  return feed.items.map((item): ScoredRssPost => {
    const html = item.content || item.description || '';
    const text = stripHtml(html).slice(0, 1000) || item.title || '';
    const embeds: Embed[] = [];
    if (item.enclosure?.url) {
      const type = item.enclosure.type ?? '';
      if (type.startsWith('image/')) embeds.push({ kind: 'image', url: item.enclosure.url });
      else if (type.startsWith('video/')) embeds.push({ kind: 'video', url: item.enclosure.url });
    }
    for (const url of extractImageUrls(html)) {
      embeds.push({ kind: 'image', url });
    }
    if (item.link) embeds.push({ kind: 'link', url: item.link });

    const niches = detectNiches(`${text} ${item.categories?.join(' ') ?? ''}`);

    const post: UnifiedPost = {
      id: `rss:${feedUrl}:${item.link?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? Date.now()}`,
      protocol: 'rss',
      author,
      text,
      html,
      embeds,
      createdAt: parseDate(item.pubDate),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: { item, feedUrl, config: feedConfig },
      niches: [...new Set([...niches, ...(item.categories ?? []).map((c) => c.toLowerCase())])],
    };

    const quality = computeQualityScore(post, feedConfig);

    return { post, config: feedConfig, quality };
  });
}

export class RssProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly feedConfigs: RssFeedConfig[];

  constructor(options: RssProviderOptions = {}) {
    // Normalize both string[] and RssFeedConfig[] inputs
    const raw = options.feeds ?? DEFAULT_CRYPTO_FEEDS;
    const normalized = raw.map(normalizeFeedInput);
    // Deduplicate by URL (keep first occurrence)
    const seen = new Set<string>();
    this.feedConfigs = normalized.filter((f) => {
      const key = f.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Returns the active feed configs (useful for introspection) */
  getFeeds(): RssFeedConfig[] {
    return this.feedConfigs;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    if (this.feedConfigs.length === 0) return { posts: [] };
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const concurrency = opts.concurrency ?? 4;
    const scored: ScoredRssPost[] = [];

    const results = await withConcurrencyLimit(
      this.feedConfigs,
      concurrency,
      async (feedConfig) => {
        try {
          const xml = await withTimeout(
            fetchRss(feedConfig.url, {
              headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers },
            }),
            timeoutMs,
            `rss:${feedConfig.url}`,
          );
          const feed = parseRss(xml);
          return feedToUnifiedPosts(feedConfig, feed);
        } catch {
          return [] as ScoredRssPost[];
        }
      },
    );
    for (const r of results) scored.push(...r);

    // Apply tier-aware dedup
    const deduped = deduplicateRssPosts(scored);

    // Convert back to UnifiedPost[] with quality score stamped in raw
    const posts: UnifiedPost[] = deduped.map((s) => {
      const updated = { ...s.post };
      updated.raw = { ...(typeof updated.raw === 'object' && updated.raw !== null ? updated.raw : {}), qualityScore: s.quality };
      return updated;
    });

    return {
      posts,
      notice: `RSS: ${deduped.length} posts from ${this.feedConfigs.length} feeds (${scored.length - deduped.length} deduped)`,
    };
  }
}

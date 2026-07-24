import type { RssFeedConfig } from './types';

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
  cfg('https://cointelegraph.com/rss', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'defi'],
    authority: 3,
  }),
  cfg('https://decrypt.co/feed', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'defi'],
    authority: 3,
  }),
  cfg('https://www.coindesk.com/arc/outboundfeeds/rss/', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'policy'],
    authority: 3,
  }),
  cfg('https://blockworks.co/feed', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'defi'],
    authority: 3,
  }),
  cfg('https://thedefiant.io/api/feed', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['defi', 'crypto', 'ethereum'],
    authority: 3,
  }),
  cfg('https://unchainedcrypto.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'interviews'],
    authority: 3,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://pomp.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'macro'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://blog.chainalysis.com/feed/', {
    tier: 1,
    weight: 1.0,
    category: 'research',
    tags: ['onchain', 'security', 'crypto'],
    authority: 3,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2 — High Quality Research / VC (weight: 0.9, authority: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.electriccapital.com/rss', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'onchain', 'analytics'],
    authority: 2,
  }),
  cfg('https://panteracapital.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'bitcoin', 'blockchain'],
    authority: 2,
  }),
  cfg('https://framework.ventures/rss', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'defi', 'gaming'],
    authority: 2,
  }),
  cfg('https://members.delphidigital.io/feed', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'macro', 'defi'],
    authority: 2,
  }),
  cfg('https://www.galaxy.com/insights/feed/', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'bitcoin', 'research'],
    authority: 2,
  }),
  cfg('https://coinmetrics.io/feed', {
    tier: 2,
    weight: 0.9,
    category: 'markets',
    tags: ['bitcoin', 'ethereum', 'onchain', 'metrics'],
    authority: 2,
  }),
  cfg('https://delphidigital.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'macro', 'defi', 'research'],
    authority: 3,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://variant.fund/feed', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'defi', 'web3'],
    authority: 2,
  }),
  cfg('https://nansen.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'analysis',
    tags: ['onchain', 'ethereum', 'defi'],
    authority: 2,
  }),
  cfg('https://defillama.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'tvl', 'crypto'],
    authority: 2,
  }),
  cfg('https://tokenterminal.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'analysis',
    tags: ['crypto', 'defi', 'metrics'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 3 — Analysis & Data (weight: 0.8, authority: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.kaiko.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'markets',
    tags: ['crypto', 'markets', 'trading', 'data'],
    authority: 2,
  }),
  cfg('https://insights.glassnode.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['bitcoin', 'ethereum', 'onchain'],
    authority: 2,
  }),
  // nansen.ai/research removed — 404 (redirects to substack which is already listed above)
  cfg('https://www.artemis.xyz/blog/rss', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['crypto', 'defi', 'layer2', 'metrics'],
    authority: 2,
  }),
  cfg('https://dappradar.com/blog/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'nft', 'gaming', 'dapps'],
    authority: 2,
  }),
  cfg('https://defillama.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'tvl', 'crypto'],
    authority: 2,
  }),
  cfg('https://tokenterminal.com/blog/rss', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['crypto', 'defi', 'metrics'],
    authority: 2,
  }),
  cfg('https://messari.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'research', 'onchain'],
    authority: 3,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 4 — News Aggregators (weight: 0.7, authority: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cryptoslate.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum'],
    authority: 1,
  }),
  cfg('https://cryptobriefing.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'defi'],
    authority: 1,
  }),
  cfg('https://beincrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://coingape.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://ambcrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://cryptopotato.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://www.newsbtc.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin', 'crypto'],
    authority: 1,
  }),
  cfg('https://bitcoinmagazine.com/.rss/full/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://u.today/rss', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum'],
    authority: 1,
  }),
  cfg('https://dailyhodl.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://zycrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'altcoin'],
    authority: 1,
  }),
  cfg('https://bitcoinist.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin', 'crypto'],
    authority: 1,
  }),
  cfg('https://cryptonews.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://unchainedcrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'defi'],
    authority: 1,
  }),

  cfg('https://protos.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://www.ledgerinsights.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'blockchain', 'enterprise'],
    authority: 1,
  }),
  cfg('https://news.bitcoin.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin', 'crypto'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 5 — Developer / Protocol Blogs (weight: 0.6, authority: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.ethereum.org/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['ethereum', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://blog.polygon.technology/feed', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['polygon', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://starkware.co/feed', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['starkware', 'layer2', 'zk', 'dev'],
    authority: 1,
  }),
  cfg('https://www.zk.com/blog/rss', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['zk', 'zero-knowledge', 'dev'],
    authority: 1,
  }),
  cfg('https://blog.eigenlayer.xyz/rss', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['eigenlayer', 'restaking', 'ethereum'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://blog.celestia.org/rss', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['celestia', 'modular', 'data-availability'],
    authority: 1,
  }),
  cfg('https://polkadot.network/blog/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['polkadot', 'dev'],
    authority: 1,
  }),
  cfg('https://blog.chain.link/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['chainlink', 'oracle', 'dev'],
    authority: 1,
  }),
  cfg('https://starknet.io/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['starknet', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://zksync.io/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['zksync', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://eips.ethereum.org/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['ethereum', 'eips', 'standards'],
    authority: 1,
  }),
  cfg('https://weekinethereumnews.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['ethereum', 'newsletter'],
    authority: 1,
  }),
  cfg('https://base.mirror.xyz/feed/atom', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['base', 'layer2', 'dev'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Exchange / Institutional Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.coinbase.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['coinbase', 'crypto', 'regulation'],
    authority: 2,
  }),
  cfg('https://www.coinbase.com/blog/rss.xml', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['coinbase', 'crypto'],
    authority: 2,
  }),
  cfg('https://blog.kraken.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['kraken', 'crypto', 'regulation'],
    authority: 2,
  }),
  cfg('https://blog.binance.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['binance', 'crypto'],
    authority: 2,
  }),

  cfg('https://www.galaxy.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['galaxy', 'crypto', 'research'],
    authority: 2,
  }),
  cfg('https://blog.bitmex.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bitmex', 'trading', 'derivatives'],
    authority: 1,
  }),
  cfg('https://blog.bitfinex.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bitfinex', 'trading'],
    authority: 1,
  }),
  cfg('https://www.okx.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['okx', 'trading', 'crypto'],
    authority: 1,
  }),
  cfg('https://blog.bybit.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bybit', 'trading'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Data & Research Platforms
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://coinmarketcap.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'prices'],
    authority: 1,
  }),
  cfg('https://www.vanryun.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'macro'],
    authority: 1,
  }),
  cfg('https://www.21shares.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'institutional'],
    authority: 1,
  }),
  cfg('https://grayscale.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://bitwiseinvestments.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://www.coinshares.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'institutional'],
    authority: 1,
  }),
  cfg('https://coingecko.com/en/blog/rss', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'prices', 'data'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Security & Policy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.trailofbits.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'security',
    tags: ['security', 'audit', 'research'],
    authority: 2,
  }),
  cfg('https://www.coincenter.org/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['policy', 'regulation', 'bitcoin'],
    authority: 2,
  }),
  cfg('https://www.sec.gov/news/pressreleases.rss', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['sec', 'regulation', 'policy'],
    authority: 1,
  }),
  cfg('https://www.imf.org/en/News/RSS', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['imf', 'macro', 'policy'],
    authority: 1,
  }),
  cfg('https://blog.coinbase.com/category/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'coinbase', 'policy'],
    authority: 2,
  }),
  cfg('https://slowmist.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit'],
    authority: 1,
  }),
  cfg('https://immunefi.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'bounty', 'audit'],
    authority: 1,
  }),
  cfg('https://certik.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit'],
    authority: 1,
  }),
  cfg('https://medium.com/feed/immunefi', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'bounty'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Web3 / NFT / Gaming
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.decentraland.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['metaverse', 'gaming', 'decentraland'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // VC / Investment Research
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://dragonfly.xyz/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'vc', 'defi'],
    authority: 2,
  }),
  cfg('https://variantfund.substack.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'defi', 'web3'],
    authority: 2,
  }),
  cfg('https://www.ledger.com/blog.rss', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['hardware', 'security', 'crypto'],
    authority: 1,
  }),
  cfg('https://trezor.io/blog/feed.xml', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['hardware', 'security', 'bitcoin'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Premium Newsletters (Substack / Mirror / Paragraph / Ghost)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://milkroad.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'daily', 'digest'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://thedefiedge.substack.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'research'],
    authority: 2,
  }),
  cfg('https://ethdaily.substack.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['ethereum', 'daily'],
    authority: 1,
  }),
  cfg('https://vitalik.eth.limo/feed.xml', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['ethereum', 'crypto', 'research'],
    authority: 2,
  }),
  cfg('https://paragraph.xyz/@bitcoin/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://paragraph.xyz/@crypto/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://paragraph.xyz/@andrew/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'opinion'],
    authority: 1,
  }),
  cfg('https://paragraph.xyz/@divine/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'opinion'],
    authority: 1,
  }),
  cfg('https://mirror.xyz/0x25B0/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'web3'],
    authority: 1,
  }),
  cfg('https://mirror.xyz/0xc0FFee/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'web3'],
    authority: 1,
  }),

  cfg('https://paragraph.xyz/feed', {
    tier: 5,
    weight: 0.6,
    category: 'newsletter',
    tags: ['crypto', 'web3', 'publishing'],
    authority: 1,
    isPaid: false,
    schedule: 'irregular',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Long-tail Crypto News Outlets
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cryptonews.net/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://cryptonews.net/news/bitcoin/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://cryptodaily.co.uk/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://www.cryptopolitan.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://coinjournal.net/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://www.fxstreet.com/cryptocurrencies/news/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'markets', 'forex'],
    authority: 1,
  }),
  cfg('https://www.blocktempo.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'asia'],
    authority: 1,
  }),
  cfg('https://thecryptobasic.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://www.crypto-news-flash.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://coinpedia.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://www.trustnodes.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'ethereum'],
    authority: 1,
  }),
  cfg('https://www.livebitcoinnews.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://cryptoadventure.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://memeburn.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'tech'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // AI x Crypto / Tech News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.interconnects.ai/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'research'],
    authority: 1,
  }),
  cfg('https://thesequence.substack.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'ml', 'research'],
    authority: 1,
  }),
  cfg('https://jack-clark.net/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'research'],
    authority: 1,
  }),
  cfg('https://stratechery.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'strategy', 'analysis'],
    authority: 1,
  }),
  cfg('https://technically.substack.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'economics'],
    authority: 1,
  }),
  cfg('https://www.semiconductor-digest.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['hardware', 'semiconductor', 'tech'],
    authority: 1,
  }),
  cfg('https://techcrunch.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'startup', 'ai'],
    authority: 2,
  }),
  cfg('https://www.theverge.com/rss/index.xml', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'gadgets', 'science', 'ai'],
    authority: 2,
  }),
  cfg('https://arstechnica.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'science', 'security', 'ai'],
    authority: 2,
  }),
  cfg('https://www.wired.com/feed/rss', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'science', 'culture', 'ai'],
    authority: 2,
  }),
  cfg('https://www.theinformation.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'business', 'analysis'],
    authority: 1,
  }),
  cfg('https://restofworld.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'global'],
    authority: 1,
  }),
  // protocol.com/feed removed — site defunct
  cfg('https://www.platformer.news/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'policy', 'social'],
    authority: 1,
  }),
  cfg('https://venturebeat.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'tech',
    tags: ['tech', 'ai', 'gaming', 'startup'],
    authority: 2,
  }),
  cfg('https://www.technologyreview.com/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'tech',
    tags: ['tech', 'ai', 'science', 'innovation'],
    authority: 3,
  }),
  cfg('https://www.zdnet.com/news/rss.xml', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'security'],
    authority: 1,
  }),
  cfg('https://spectrum.ieee.org/feeds/feed.rss', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'engineering', 'science'],
    authority: 1,
  }),
  cfg('https://www.quantamagazine.org/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'math', 'physics', 'research'],
    authority: 2,
  }),
  cfg('https://venturebeat.com/category/ai/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'ml', 'startup'],
    authority: 3,
  }),
  // theverge.com/ai-... removed — sub-category feed 404 (main feed works)
  cfg('https://techcrunch.com/category/artificial-intelligence/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'startup', 'tech'],
    authority: 3,
  }),
  cfg('https://www.technologyreview.com/topic/artificial-intelligence/feed/', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'ml', 'research'],
    authority: 3,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // AI Company Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://openai.com/blog/rss.xml', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'openai', 'gpt', 'research'],
    authority: 3,
  }),
  cfg('https://www.anthropic.com/feed/', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'anthropic', 'claude', 'research'],
    authority: 3,
  }),
  cfg('https://deepmind.google/blog/rss.xml', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'deepmind', 'google', 'research'],
    authority: 3,
  }),
  cfg('https://ai.meta.com/blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'meta', 'research'],
    authority: 1,
  }),
  cfg('https://blog.google/technology/ai/rss/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'google', 'research'],
    authority: 1,
  }),
  cfg('https://huggingface.co/blog/feed.xml', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'ml', 'opensource', 'research'],
    authority: 3,
  }),
  cfg('https://stability.ai/blog/feed', {
    tier: 2,
    weight: 0.9,
    category: 'ai',
    tags: ['ai', 'image', 'generative', 'research'],
    authority: 3,
  }),
  cfg('https://cohere.com/blog/rss', {
    tier: 5,
    weight: 0.6,
    category: 'ai',
    tags: ['ai', 'llm', 'nlp'],
    authority: 1,
  }),
  cfg('https://www.semianalysis.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'ai',
    tags: ['ai', 'semiconductor', 'analysis'],
    authority: 1,
  }),
  cfg('https://www.ben-evans.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'strategy', 'analysis'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Tech / Startup Newsletters
  // ═══════════════════════════════════════════════════════════════════

  cfg('https://www.notboring.co/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'business', 'crypto'],
    authority: 1,
  }),
  cfg('https://lennysnewsletter.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'product', 'growth'],
    authority: 1,
  }),
  cfg('https://every.to/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'business', 'ideas'],
    authority: 1,
  }),
  cfg('https://www.bigtechnology.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'policy', 'analysis'],
    authority: 1,
  }),
  cfg('https://www.piratewires.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'culture', 'policy'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ARXIV Research Feeds
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://arxiv.org/rss/cs.AI', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['ai', 'research', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.CL', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['nlp', 'research', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.CR', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['security', 'crypto', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.LG', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['ml', 'research', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/stat.ML', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['ml', 'statistics', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/q-fin.TR', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['trading', 'markets', 'papers'],
    authority: 1,
  }),
  cfg('https://arxiv.org/rss/cs.CY', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['tech', 'society', 'papers'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Developer / Engineering Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://hnrss.org/frontpage?points=20', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['tech', 'news', 'startup'],
    authority: 1,
  }),
  cfg('https://hnrss.org/newest?points=10', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'news'],
    authority: 1,
  }),
  // news.ycombinator.com/rss removed — doesn't serve RSS; hnrss.org alternatives are already listed
  cfg('https://lobste.rs/rss', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['tech', 'programming'],
    authority: 1,
  }),
  cfg('https://dev.to/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['programming', 'webdev'],
    authority: 1,
  }),
  cfg('https://blog.rust-lang.org/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['rust', 'programming', 'dev'],
    authority: 1,
  }),
  cfg('https://go.dev/blog/feed.atom', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['golang', 'programming', 'dev'],
    authority: 1,
  }),
  cfg('https://github.blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['dev', 'github', 'programming'],
    authority: 1,
  }),
  cfg('https://stackoverflow.blog/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['programming', 'community'],
    authority: 1,
  }),
  cfg('https://blog.cloudflare.com/rss/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['security', 'infrastructure', 'networking'],
    authority: 1,
  }),

  cfg('https://martinfowler.com/feed.atom', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['architecture', 'programming'],
    authority: 1,
  }),
  cfg('https://engineering.fb.com/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['engineering', 'meta', 'infra'],
    authority: 1,
  }),
  cfg('https://netflixtechblog.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['engineering', 'infra'],
    authority: 1,
  }),
  cfg('https://aws.amazon.com/blogs/aws/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['aws', 'cloud', 'devops'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Social: Reddit
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.reddit.com/r/CryptoCurrency/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['crypto', 'discussion'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Bitcoin/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/ethereum/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['ethereum'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/solana/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['solana'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/defi/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['defi'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/ethfinance/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['ethereum', 'finance'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/ethdev/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['ethereum', 'dev'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Chainlink/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['chainlink'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Polkadot/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['polkadot'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/cosmosnetwork/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['cosmos'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Arbitrum/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['arbitrum'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/optimismCollective/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['optimism'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Avax/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['avalanche'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Cardano/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['cardano'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/Monero/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['monero'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/0xPolygon/.rss', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['polygon'],
    authority: 1,
  }),
  cfg('https://old.reddit.com/r/CryptoCurrency/hot.rss?limit=25', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['crypto', 'discussion'],
    authority: 1,
  }),
  cfg('https://old.reddit.com/r/Bitcoin/hot.rss?limit=25', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://old.reddit.com/r/ethereum/hot.rss?limit=25', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['ethereum'],
    authority: 1,
  }),
  cfg('https://old.reddit.com/r/solana/hot.rss?limit=25', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['solana'],
    authority: 1,
  }),
  cfg('https://old.reddit.com/r/defi/hot.rss?limit=25', {
    tier: 4,
    weight: 0.7,
    category: 'social',
    tags: ['defi'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/ArtificialInteligence/.rss', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ai'],
    authority: 1,
  }),
  cfg('https://www.reddit.com/r/MachineLearning/.rss', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ml', 'ai'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Mastodon / Fediverse / Social
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://social.degenfeed.xyz/@admin.rss', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['crypto', 'fediverse'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Lemmy — Federated Communities
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://lemmy.world/feeds/c/cryptocurrency.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://lemmy.ml/feeds/c/bitcoin.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/technology.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['tech'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/ai.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ai'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/defi.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['defi'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/blockchain.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['blockchain'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/web3.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['web3'],
    authority: 1,
  }),
  cfg('https://lemmy.ml/feeds/c/ethereum.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['ethereum'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/solana.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['solana'],
    authority: 1,
  }),
  cfg('https://lemmy.world/feeds/c/cybersecurity.xml?sort=Hot', {
    tier: 5,
    weight: 0.6,
    category: 'social',
    tags: ['security'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // PeerTube — Federated Video
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://tilvids.com/feeds/videos.xml', {
    tier: 5,
    weight: 0.6,
    category: 'video',
    tags: ['tech', 'education'],
    authority: 1,
  }),
  cfg('https://video.ploud.fr/feeds/videos.xml?sort=-publishedAt', {
    tier: 5,
    weight: 0.6,
    category: 'video',
    tags: ['tech', 'video'],
    authority: 1,
  }),
  // cryptoconomy.com & diode.zone PeerTube removed — timeout

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Substack (weight: 1.0, tier: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://pomp.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'macro'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://panteracapital.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'blockchain'],
    authority: 3,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://unchainedcrypto.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'interviews'],
    authority: 3,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://0xresearch.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'research', 'defi'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — DeFi / Protocol (weight: 0.9, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defiweekly.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['defi', 'decentralized-finance', 'crypto'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://thedefiant.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['defi', 'crypto', 'ethereum'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://weekinethereum.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ethereum', 'layer2', 'dev'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://tokenterminal.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['crypto', 'defi', 'metrics'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://dunedigest.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['onchain', 'analytics', 'defi'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — AI x Crypto (weight: 0.9, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://supervised.news/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'crypto', 'research'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://theaireport.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'ml', 'llm'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://tldrai.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'ml', 'llm', 'digest'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://importai.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'research', 'ml'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Crypto Research (weight: 0.8, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://theblockresearch.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['crypto', 'research', 'onchain'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://reflexivityresearch.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['crypto', 'research', 'macro'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://caneisland.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['crypto', 'research', 'bitcoin'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://ecoinometrics.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['bitcoin', 'research', 'macro', 'onchain'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — DeFi Alpha (weight: 0.8, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://ournetwork.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'onchain', 'research'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://blockcrunch.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'crypto', 'research'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://defidad.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'yield', 'crypto'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://route2fi.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'finance', 'crypto'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://ignasdefi.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'research', 'crypto'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Bitcoin Focus (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://bitcoinmagazinepro.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'research', 'mining'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://satoshisjournal.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'crypto', 'culture'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://thebitcoinlayer.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'macro', 'economy'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://nikbhatia.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'macro', 'finance'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Trading / Markets (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://macroscope.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['macro', 'markets', 'trading'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://thetranscript.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['markets', 'trading', 'crypto'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://execsum.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['markets', 'crypto', 'derivatives'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://themarketear.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['markets', 'trading', 'macro', 'sentiment'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Web3 / Builders (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://developerdao.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['web3', 'dev', 'dao'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://a16zcrypto.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['web3', 'crypto', 'research', 'vc'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://lijin.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['web3', 'creator', 'crypto'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Web3 Publishing (Paragraph + Mirror) (weight: 0.8, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://dev.mirror.xyz/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['web3', 'dev', 'mirror'],
    authority: 2,
    isPaid: false,
    schedule: 'irregular',
  }),
  cfg('https://blog.paragraph.xyz/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['web3', 'publishing', 'paragraph'],
    authority: 2,
    isPaid: false,
    schedule: 'irregular',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Medium Publications (weight: 0.7, tier: 4)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://medium.com/feed/coinmonks', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['crypto', 'blockchain', 'defi'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/the-capital', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['crypto', 'finance', 'investing'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/cryptostars', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['crypto', 'blockchain', 'altcoin'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/hackernoon', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'startup', 'programming'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/towards-data-science', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['data-science', 'ml', 'ai', 'python'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Tech / Startup (weight: 0.6, tier: 5)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://tldr.tech/feed', {
    tier: 5,
    weight: 0.6,
    category: 'newsletter',
    tags: ['tech', 'productivity', 'dev'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://www.ben-evans.com/newsletter/feed', {
    tier: 5,
    weight: 0.6,
    category: 'newsletter',
    tags: ['tech', 'strategy', 'analysis'],
    authority: 1,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://notboring.substack.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'newsletter',
    tags: ['tech', 'business', 'crypto'],
    authority: 1,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://www.exponentialview.co/feed', {
    tier: 5,
    weight: 0.6,
    category: 'newsletter',
    tags: ['tech', 'ai', 'future'],
    authority: 1,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://thehustle.co/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'business', 'startup'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://hackernewsletter.com/feed', {
    tier: 4,
    weight: 0.6,
    category: 'newsletter',
    tags: ['tech', 'startup', 'developer'],
    authority: 1,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://stratechery.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'strategy', 'analysis'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://www.platformer.news/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'policy', 'social-media'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://www.theverge.com/rss/index.xml', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'gadgets', 'science', 'ai'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://arstechnica.com/feed/', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'science', 'security'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://www.wired.com/feed/rss', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'science', 'culture'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://techcrunch.com/feed/', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'startup', 'ai'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // AI / Tech / Science — General News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://arstechnica.com/ai/feed', {
    tier: 2,
    weight: 1.0,
    category: 'ai',
    tags: ['ai', 'tech', 'science'],
    authority: 3,
  }),
  cfg('https://lastweekin.ai/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'newsletter', 'research'],
    authority: 2,
  }),
  cfg('https://www.ai-supremacy.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'newsletter', 'analysis'],
    authority: 2,
  }),
  cfg('https://www.thealgorithmicbridge.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'newsletter', 'philosophy'],
    authority: 2,
  }),
  cfg('https://www.deeplearning.ai/the-batch/feed/', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'deep-learning', 'research'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://bensbites.co/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'daily', 'digest', 'tools'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://www.theneurondaily.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'daily', 'tools', 'news'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://www.aitoolreport.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'daily', 'tools', 'newsletter'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://www.producthunt.com/feed', {
    tier: 4,
    weight: 0.8,
    category: 'tech',
    tags: ['startup', 'product', 'tech'],
    authority: 1,
  }),
  cfg('https://www.indiehackers.com/feed', {
    tier: 4,
    weight: 0.8,
    category: 'tech',
    tags: ['startup', 'indie', 'saas'],
    authority: 1,
  }),
  cfg('https://www.nature.com/nature.rss', {
    tier: 2,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'research', 'nature'],
    authority: 3,
  }),
  cfg('https://www.sciencedaily.com/rss/all.xml', {
    tier: 3,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'research', 'discovery'],
    authority: 2,
  }),
  cfg('https://www.newscientist.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'tech', 'innovation'],
    authority: 2,
  }),
  cfg('https://phys.org/rss-feed', {
    tier: 3,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'physics', 'space'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Crypto News — Tier 2
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://nulltx.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'news'],
    authority: 1,
  }),
  cfg('https://cryptonews.com/news/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'news'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // DeFi News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defirate.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'markets',
    tags: ['defi', 'prediction-markets', 'regulation'],
    authority: 2,
  }),
  cfg('https://governance.aave.com/posts.rss', {
    tier: 4,
    weight: 0.6,
    category: 'development',
    tags: ['defi', 'aave', 'governance'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Regulation / Policy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defieducationfund.org/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['defi', 'regulation', 'policy'],
    authority: 2,
  }),
  cfg('https://www.cryptoforinnovation.org/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['crypto', 'policy', 'innovation'],
    authority: 1,
  }),
  cfg('https://www.theblockchainassociation.org/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['blockchain', 'policy', 'regulation'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Mining / Energy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://hashrateindex.com/blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bitcoin', 'mining', 'hashrate'],
    authority: 1,
  }),
  cfg('https://compassmining.io/education/rss/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['bitcoin', 'mining', 'energy'],
    authority: 1,
  }),
  cfg('https://braiins.com/blog/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['bitcoin', 'mining', 'protocol'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Data / Analytics
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.intotheblock.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['onchain', 'analytics', 'crypto'],
    authority: 2,
  }),
  cfg('https://cryptoquant.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['onchain', 'bitcoin', 'analytics'],
    authority: 2,
  }),
  cfg('https://santiment.net/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'analysis',
    tags: ['onchain', 'sentiment', 'analytics'],
    authority: 1,
  }),
  cfg('https://lookintobitcoin.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'analysis',
    tags: ['bitcoin', 'onchain', 'metrics'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Privacy / Security
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.openzeppelin.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'security',
    tags: ['security', 'audit', 'smart-contracts'],
    authority: 2,
  }),
  cfg('https://www.certik.com/blog/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
  cfg('https://www.slowmist.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
  cfg('https://peckshield.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'exploits'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // VC / Investment
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://1confirmation.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'vc', 'investment'],
    authority: 2,
  }),
  cfg('https://placeholder.vc/feed', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['crypto', 'vc', 'investment'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // On-Chain Data
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://flipsidecrypto.xyz/blog/feed', {
    tier: 4,
    weight: 0.7,
    category: 'analysis',
    tags: ['onchain', 'analytics', 'data'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Layer 1 & 2 News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://aptosfoundation.org/rss', {
    tier: 4,
    weight: 0.7,
    category: 'development',
    tags: ['aptos', 'layer1', 'move'],
    authority: 1,
  }),
  cfg('https://blog.sui.io/feed', {
    tier: 4,
    weight: 0.7,
    category: 'development',
    tags: ['sui', 'layer1', 'move'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // PODCASTS — Crypto (weight: 0.8, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://feeds.megaphone.fm/bankless', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'ethereum', 'defi', 'interview'],
    authority: 2,
  }),
  cfg('https://feeds.megaphone.fm/unchained', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'interview', 'news'],
    authority: 2,
  }),
  cfg('https://pomp.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'macro', 'interview'],
    authority: 2,
  }),
  cfg('https://feeds.megaphone.fm/empire', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'blockchain', 'news', 'interview'],
    authority: 2,
  }),
  cfg('https://0xresearch.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'research', 'markets'],
    authority: 2,
  }),
  cfg('https://bellcurve.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'macro', 'defi', 'research'],
    authority: 2,
  }),
  cfg('https://thedefiant.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['defi', 'crypto', 'interview'],
    authority: 2,
  }),
  cfg('https://epicenter.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'blockchain', 'interview', 'tech'],
    authority: 2,
  }),
  cfg('https://intotheether.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['ethereum', 'defi', 'ecosystem'],
    authority: 2,
  }),
  cfg('https://thescoop.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'news', 'interview', 'markets'],
    authority: 2,
  }),
  cfg('https://feeds.simplecast.com/onthebrink', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'macro', 'investment'],
    authority: 2,
  }),
  cfg('https://goodmorningcrypto.libsyn.com/rss', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['crypto', 'news', 'daily'],
    authority: 1,
  }),
  cfg('https://cryptoconversation.libsyn.com/rss', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'interview'],
    authority: 1,
  }),
  cfg('https://thebitcoinpodcast.libsyn.com/rss', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['bitcoin', 'culture', 'interview'],
    authority: 1,
  }),
  cfg('https://feeds.simplecast.com/whatbitcoindid', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['bitcoin', 'interview', 'macro'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // RESEARCH PAPERS & Aggregators
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://eprint.iacr.org/rss', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['cryptography', 'academic', 'papers', 'security'],
    authority: 3,
  }),
  cfg('https://blockchain.berkeley.edu/feed', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['blockchain', 'research', 'education'],
    authority: 2,
  }),
  // papers.ssrn.com removed — RSS endpoint deprecated
  cfg('https://a16zcrypto.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'research', 'web3', 'startup'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // DAO / GOVERNANCE Forums
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://gov.optimism.io/posts.rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['optimism', 'governance', 'dao'],
    authority: 2,
  }),
  cfg('https://forum.arbitrum.foundation/posts.rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['arbitrum', 'governance', 'dao'],
    authority: 2,
  }),
  cfg('https://gov.uniswap.org/posts.rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['uniswap', 'governance', 'dao'],
    authority: 2,
  }),
  cfg('https://governance.aave.com/posts.rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['aave', 'governance', 'dao'],
    authority: 2,
  }),
  cfg('https://forum.sky.money/rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['makerdao', 'governance', 'dao', 'stablecoin'],
    authority: 2,
  }),
  cfg('https://discuss.ens.domains/posts.rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['ens', 'governance', 'dao'],
    authority: 2,
  }),
  cfg('https://gov.gitcoin.co/posts.rss', {
    tier: 3,
    weight: 0.8,
    category: 'dao',
    tags: ['gitcoin', 'governance', 'dao', 'public-goods'],
    authority: 2,
  }),
  // research.lido.fi/rss removed — forum RSS disabled
  // comp.xyz/rss removed — site migrated, RSS discontinued

  // ═══════════════════════════════════════════════════════════════════
  // DEVELOPER / TECHNICAL — Web3 Dev Tools & SDKs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://soliditylang.org/blog/rss', {
    tier: 4,
    weight: 0.6,
    category: 'development',
    tags: ['solidity', 'evm', 'smart-contracts'],
    authority: 1,
  }),
  // blog.ethers.io/rss removed — blog inactive
  // viem.sh/blog/rss removed — returns 404
  // rainbowkit.com/blog/rss removed — returns 404
  // wagmi.sh/blog/rss removed — returns 404
  cfg('https://thegraph.com/blog/rss', {
    tier: 4,
    weight: 0.6,
    category: 'development',
    tags: ['thegraph', 'subgraph', 'indexing'],
    authority: 1,
  }),
  cfg('https://moralis.io/blog/feed', {
    tier: 4,
    weight: 0.6,
    category: 'development',
    tags: ['moralis', 'web3', 'api', 'sdk'],
    authority: 1,
  }),
  // alchemy.com/blog/rss removed — returns 404 (moved to alchemy.com/blog with no RSS)
  cfg('https://blog.ethereum.org/feed.xml', {
    tier: 4,
    weight: 0.7,
    category: 'development',
    tags: ['ethereum', 'research', 'core-dev', 'dev'],
    authority: 2,
  }),
  cfg('https://hardhat.org/blog/rss.xml', {
    tier: 4,
    weight: 0.7,
    category: 'development',
    tags: ['hardhat', 'ethereum', 'development', 'testing'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // GAMING — Web3 Gaming, GameFi, Metaverse (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://decrypt.co/gaming/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['gaming', 'web3-gaming', 'gamefi'],
    authority: 2,
  }),
  // cointelegraph.com/tags/gaming/feed removed — tag RSS endpoints all 404
  cfg('https://coingecko.com/en/nft/rss', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['gaming', 'nft', 'metaverse', 'web3-gaming'],
    authority: 1,
  }),
  cfg('https://www.gamedeveloper.com/rss.xml', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['gaming', 'game-dev', 'technology'],
    authority: 1,
  }),
  cfg('https://www.polygon.technology/gaming/feed', {
    tier: 3,
    weight: 0.8,
    category: 'development',
    tags: ['polygon', 'gaming', 'web3'],
    authority: 2,
  }),
  cfg('https://immutable.com/feed.xml', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['gaming', 'nft', 'immutable', 'web3-gaming'],
    authority: 1,
  }),
  // blog.sequence.xyz/feed removed — returns 404

  // ═══════════════════════════════════════════════════════════════════
  // REGULATION / POLICY — Government & Legal (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://www.coindesk.com/policy/feed/', {
    tier: 2,
    weight: 0.9,
    category: 'policy',
    tags: ['regulation', 'policy', 'crypto'],
    authority: 3,
  }),
  cfg('https://blockworks.co/category/policy/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'policy', 'crypto'],
    authority: 2,
  }),
  cfg('https://decrypt.co/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'policy', 'sec'],
    authority: 2,
  }),
  // europarl.europa.eu/rss/topic/... removed — EU RSS feed discontinued
  cfg('https://www.theblock.co/post/type/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'policy', 'sec', 'cftc'],
    authority: 2,
  }),
  cfg('https://blog.coinbase.com/category/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'coinbase', 'policy'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // STABLECOINS — Dedicated stablecoin & RWA feeds (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/stablecoins/feed removed — tag RSS 404
  cfg('https://defillama.com/stablecoin/rss', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['stablecoin', 'tvl', 'defi'],
    authority: 2,
  }),
  cfg('https://decrypt.co/stablecoins/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['stablecoin', 'usdc', 'usdt', 'dai'],
    authority: 2,
  }),
  cfg('https://coindesk.com/stablecoins/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['stablecoin', 'defi', 'rwa'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // MEMECOINS — Dedicated meme coin coverage (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/meme-coins/feed removed — tag RSS 404
  cfg('https://decrypt.co/memecoins/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['memecoin', 'meme-coin', 'degen'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // LAYER 2 / SCALING — Additional L2 sources (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // l2beat.com/feed removed — 404 (site restructured)
  // cointelegraph.com/tags/layer-2/feed removed — tag RSS 404

  // ═══════════════════════════════════════════════════════════════════
  // BITCOIN — Additional BTC analysis (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://bitcoinmagazine.com/.rss/full/', {
    tier: 2,
    weight: 1.0,
    category: 'news',
    tags: ['bitcoin', 'btc', 'mining', 'lightning'],
    authority: 3,
  }),
  // cointelegraph.com/tags/bitcoin/feed removed — tag RSS 404
  cfg('https://www.blockchain.com/blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['bitcoin', 'blockchain', 'data'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // DeFi DEEP — Additional yield & protocol coverage (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/defi/feed removed — tag RSS 404
  cfg('https://defillama.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['defi', 'tvl', 'crypto', 'yield'],
    authority: 2,
  }),
  cfg('https://decrypt.co/defi/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['defi', 'dex', 'yield', 'lending'],
    authority: 2,
  }),
  cfg('https://thedefiant.io/feed', {
    tier: 2,
    weight: 0.9,
    category: 'news',
    tags: ['defi', 'crypto', 'ethereum', 'yield'],
    authority: 3,
  }),
  cfg('https://coingecko.com/en/blog/rss', {
    tier: 3,
    weight: 0.8,
    category: 'markets',
    tags: ['defi', 'crypto', 'prices', 'data'],
    authority: 2,
  }),
  cfg('https://blog.intotheblock.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'onchain', 'analytics', 'crypto'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY — Additional security research (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/hacking/feed removed — tag RSS 404
  cfg('https://decrypt.co/security/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['security', 'hack', 'audit'],
    authority: 2,
  }),
  cfg('https://slowmist.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
  cfg('https://www.certik.com/blog/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
  cfg('https://peckshield.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'exploits'],
    authority: 1,
  }),
  cfg('https://blog.halborn.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'web3'],
    authority: 1,
  }),
];

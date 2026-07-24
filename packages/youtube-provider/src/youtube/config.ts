import type { YouTubeChannel } from './types';

// ─── Curated crypto YouTube channels ──────────────────────────────────
// Organized first by category, then by subcategory within each section.

export const CRYPTO_CHANNELS: YouTubeChannel[] = [
  // ═══════════════════════════════════════════════════════════════════
  //  MARKET ANALYSIS / DAILY NEWS  (weight: 1.0)
  // ═══════════════════════════════════════════════════════════════════

  // ── daily-news ─────────────────────────────────────────────────────
  {
    name: 'Coin Bureau',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw',
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    category: 'market_analysis',
    subcategory: 'daily-news',
    weight: 1.0,
    niches: ['crypto', 'defi', 'macro', 'bitcoin'],
  },
  {
    name: 'Altcoin Daily',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbLhGKVY-bJPcawebgtNfbw',
    channelId: 'UCbLhGKVY-bJPcawebgtNfbw',
    category: 'market_analysis',
    subcategory: 'daily-news',
    weight: 1.0,
    niches: ['crypto', 'altcoins', 'news'],
  },
  {
    name: 'Crypto Banter',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCN9Nj4tjXbVTLYWN0EKlylQ',
    channelId: 'UCN9Nj4tjXbVTLYWN0EKlylQ',
    category: 'market_analysis',
    subcategory: 'daily-news',
    weight: 0.9,
    niches: ['crypto', 'news', 'trading'],
  },
  {
    name: 'Cointelegraph',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCV0XLtgVhDYyFRB-HpHkXbQ',
    channelId: 'UCV0XLtgVhDYyFRB-HpHkXbQ',
    category: 'market_analysis',
    subcategory: 'daily-news',
    weight: 0.9,
    niches: ['crypto', 'news', 'bitcoin', 'regulation'],
  },
  {
    name: 'CoinDesk',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCeU2Fg3fDgQTMOdT6zRqL9g',
    channelId: 'UCeU2Fg3fDgQTMOdT6zRqL9g',
    category: 'market_analysis',
    subcategory: 'daily-news',
    weight: 0.9,
    niches: ['crypto', 'news', 'bitcoin', 'markets'],
  },

  // ── market-commentary ──────────────────────────────────────────────
  {
    name: 'Bankless',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA',
    channelId: 'UCAl9Ld79qaZxp9JzEOwd3aA',
    category: 'market_analysis',
    subcategory: 'market-commentary',
    weight: 1.0,
    niches: ['crypto', 'defi', 'macro', 'ethereum'],
  },
  {
    name: 'Benjamin Cowen',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCRvqjQPSeaWn-uEx-w0XOIg',
    channelId: 'UCRvqjQPSeaWn-uEx-w0XOIg',
    category: 'market_analysis',
    subcategory: 'market-commentary',
    weight: 1.0,
    niches: ['trading', 'bitcoin', 'macro', 'onchain'],
  },
  {
    name: 'InvestAnswers',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9z0i47pv7PvZz1W2mI_UiA',
    channelId: 'UC9z0i47pv7PvZz1W2mI_UiA',
    category: 'market_analysis',
    subcategory: 'market-commentary',
    weight: 0.9,
    niches: ['crypto', 'macro', 'trading', 'bitcoin'],
  },
  {
    name: 'DataDash',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCatR7nWbYrkVXdxXb4cGXw',
    channelId: 'UCCatR7nWbYrkVXdxXb4cGXw',
    category: 'market_analysis',
    subcategory: 'market-commentary',
    weight: 0.9,
    niches: ['crypto', 'macro', 'bitcoin', 'ethereum'],
  },
  {
    name: 'Into The Cryptoverse',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnC0j5jeEi8q7F0z_JyXbGw',
    channelId: 'UCnC0j5jeEi8q7F0z_JyXbGw',
    category: 'market_analysis',
    subcategory: 'market-commentary',
    weight: 0.8,
    niches: ['crypto', 'macro', 'trading'],
  },
  {
    name: 'Unchained Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWiiMnsnw5Isc2PP1to9nNw',
    channelId: 'UCWiiMnsnw5Isc2PP1to9nNw',
    category: 'market_analysis',
    subcategory: 'market-commentary',
    weight: 0.9,
    niches: ['crypto', 'news', 'interviews'],
  },

  // ── market-sentiment ───────────────────────────────────────────────
  {
    name: 'Lark Davis',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCk8ZW4PpRLtYk5Ro9d5I5Yg',
    channelId: 'UCk8ZW4PpRLtYk5Ro9d5I5Yg',
    category: 'market_analysis',
    subcategory: 'market-sentiment',
    weight: 0.8,
    niches: ['crypto', 'defi', 'news', 'altcoins'],
  },
  {
    name: 'Savvy Finance',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCkH2fkUhDjZ2o13TCFPYPXg',
    channelId: 'UCkH2fkUhDjZ2o13TCFPYPXg',
    category: 'market_analysis',
    subcategory: 'market-sentiment',
    weight: 0.7,
    niches: ['crypto', 'news', 'defi'],
  },
  {
    name: 'Miles Deutscher',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC4yQ6DlPjVJ-FnUa7SeSCjA',
    channelId: 'UC4yQ6DlPjVJ-FnUa7SeSCjA',
    category: 'market_analysis',
    subcategory: 'market-sentiment',
    weight: 0.8,
    niches: ['crypto', 'trading', 'altcoins', 'alpha'],
  },

  // ── interviews ────────────────────────────────────────────────────
  {
    name: 'Thinking Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1eRVoBfyUYQvsG8k42ksjQ',
    channelId: 'UC1eRVoBfyUYQvsG8k42ksjQ',
    category: 'market_analysis',
    subcategory: 'interviews',
    weight: 0.8,
    niches: ['crypto', 'news', 'interviews', 'regulation'],
  },
  {
    name: 'Anthony Pompliano',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6rD0j7TQ5Rg0zKjV1V6v2g',
    channelId: 'UC6rD0j7TQ5Rg0zKjV1V6v2g',
    category: 'market_analysis',
    subcategory: 'interviews',
    weight: 0.9,
    niches: ['macro', 'bitcoin', 'crypto', 'investing'],
  },

  // ── altcoin-research ──────────────────────────────────────────────
  {
    name: 'Chico Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC4w76QvEWXgVgRq2kH_VfQg',
    channelId: 'UC4w76QvEWXgVgRq2kH_VfQg',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.7,
    niches: ['crypto', 'investigative', 'scams', 'news'],
  },
  {
    name: 'Crypto Tips',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCavTvSwEoRABvnPtLg0e6LQ',
    channelId: 'UCavTvSwEoRABvnPtLg0e6LQ',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.7,
    niches: ['altcoins', 'reviews', 'crypto', 'news'],
  },
  {
    name: 'MMCrypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC2cWsRXbGt-58KlxpBjwSbg',
    channelId: 'UC2cWsRXbGt-58KlxpBjwSbg',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.7,
    niches: ['trading', 'altcoins', 'bitcoin', 'signals'],
  },
  {
    name: 'Ivan on Tech',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrYmtJBtLdtm2ov84ulV-yg',
    channelId: 'UCrYmtJBtLdtm2ov84ulV-yg',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.7,
    niches: ['crypto', 'blockchain', 'development', 'news'],
  },
  {
    name: 'Boxmining',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxODjeUwZHk3p-7TU-IsDOA',
    channelId: 'UCxODjeUwZHk3p-7TU-IsDOA',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.7,
    niches: ['crypto', 'altcoins', 'asia', 'news'],
  },
  {
    name: 'Crypto Capital Venture',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnMku7J_UtwlcSfZlIuQ3Kw',
    channelId: 'UCnMku7J_UtwlcSfZlIuQ3Kw',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.7,
    niches: ['trading', 'altcoins', 'bitcoin', 'technical-analysis'],
  },
  {
    name: 'Aaron Bennett',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC30PHvKU6DIo9Mn34LfSaYw',
    channelId: 'UC30PHvKU6DIo9Mn34LfSaYw',
    category: 'market_analysis',
    subcategory: 'altcoin-research',
    weight: 0.6,
    niches: ['crypto', 'altcoins', 'research', 'investing'],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  DeFi / PROTOCOL DEEP DIVES  (weight: 0.9)
  // ═══════════════════════════════════════════════════════════════════

  // ── protocol-deep-dives ────────────────────────────────────────────
  {
    name: 'Finematics',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCn2cHmXby69CRaR5eowM7lQ',
    channelId: 'UCn2cHmXby69CRaR5eowM7lQ',
    category: 'defi',
    subcategory: 'protocol-deep-dives',
    weight: 0.9,
    niches: ['defi', 'layer2', 'ethereum', 'tutorial'],
  },
  {
    name: 'a16z Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8gx6RzYYdqWB3K_dKsC6kQ',
    channelId: 'UC8gx6RzYYdqWB3K_dKsC6kQ',
    category: 'defi',
    subcategory: 'protocol-deep-dives',
    weight: 0.9,
    niches: ['crypto', 'defi', 'web3', 'vc'],
  },
  {
    name: 'The Defiant',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCL0iXkca1rL9K8Yf1Ae1EMg',
    channelId: 'UCL0iXkca1rL9K8Yf1Ae1EMg',
    category: 'defi',
    subcategory: 'protocol-deep-dives',
    weight: 0.8,
    niches: ['defi', 'news', 'ethereum', 'nft'],
  },
  {
    name: 'Thor Hartvigsen',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqUftnL8c1q0pLCKKRao4Mg',
    channelId: 'UCqUftnL8c1q0pLCKKRao4Mg',
    category: 'defi',
    subcategory: 'protocol-deep-dives',
    weight: 0.8,
    niches: ['defi', 'onchain', 'degen', 'alpha'],
  },
  {
    name: 'Drake on Digital',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCt7esZt_MwWXl9fgT0yO1eA',
    channelId: 'UCt7esZt_MwWXl9fgT0yO1eA',
    category: 'defi',
    subcategory: 'protocol-deep-dives',
    weight: 0.7,
    niches: ['defi', 'research', 'ethereum', 'web3'],
  },

  // ── yield-farming ──────────────────────────────────────────────────
  {
    name: 'DeFi Dad',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZRhDKYWrRiUTsY4Y3stYQA',
    channelId: 'UCZRhDKYWrRiUTsY4Y3stYQA',
    category: 'defi',
    subcategory: 'yield-farming',
    weight: 0.8,
    niches: ['defi', 'ethereum', 'yield', 'liquidity'],
  },
  {
    name: 'Taiki Maeda',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCS43gI19p2Mx8qKjM7Q2oXA',
    channelId: 'UCS43gI19p2Mx8qKjM7Q2oXA',
    category: 'defi',
    subcategory: 'yield-farming',
    weight: 0.7,
    niches: ['defi', 'yield', 'liquidity', 'trading'],
  },
  {
    name: 'Justin Bram',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCkMHO_hk_3NQ1rEQCpAEl_g',
    channelId: 'UCkMHO_hk_3NQ1rEQCpAEl_g',
    category: 'defi',
    subcategory: 'yield-farming',
    weight: 0.7,
    niches: ['defi', 'real-world-assets', 'tokenization'],
  },

  // ── defi-analysis ─────────────────────────────────────────────────
  {
    name: 'Whiteboard Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC5sYBAiOnT4v0QBseBRh_sg',
    channelId: 'UC5sYBAiOnT4v0QBseBRh_sg',
    category: 'defi',
    subcategory: 'defi-analysis',
    weight: 0.8,
    niches: ['crypto', 'defi', 'tutorial', 'blockchain'],
  },

  // ── defi-math ─────────────────────────────────────────────────────
  {
    name: 'The Calculator Guy',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCPIMrjFNbYwsbCuZdgEaqeA',
    channelId: 'UCPIMrjFNbYwsbCuZdgEaqeA',
    category: 'defi',
    subcategory: 'defi-math',
    weight: 0.7,
    niches: ['defi', 'yield', 'math', 'protocol-analysis'],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  TRADING / TECHNICAL ANALYSIS  (weight: 0.7)
  // ═══════════════════════════════════════════════════════════════════

  // ── technical-analysis ─────────────────────────────────────────────
  {
    name: 'CryptoCred',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCDz981NTNU4rkjqG8x7JfTA',
    channelId: 'UCDz981NTNU4rkjqG8x7JfTA',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.7,
    niches: ['trading', 'technical-analysis', 'bitcoin', 'futures'],
  },
  {
    name: 'Alessio Rastani',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCspSuakPflnSMJwBOm7Rvdw',
    channelId: 'UCspSuakPflnSMJwBOm7Rvdw',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.7,
    niches: ['trading', 'technical-analysis', 'macro', 'bitcoin'],
  },
  {
    name: 'The Trading Channel',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCz9x1ZMPnT5q8jIcLxTHW1g',
    channelId: 'UCz9x1ZMPnT5q8jIcLxTHW1g',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.7,
    niches: ['trading', 'technical-analysis', 'crypto', 'stocks'],
  },
  {
    name: 'Mitch Ray',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCd9FrBp7CV9ZRvqNtFgG5Uw',
    channelId: 'UCd9FrBp7CV9ZRvqNtFgG5Uw',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.6,
    niches: ['trading', 'technical-analysis', 'bitcoin', 'altcoins'],
  },
  {
    name: 'Virtual Bacon',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwCqdF7K_myWRTvGyg-Mn6g',
    channelId: 'UCwCqdF7K_myWRTvGyg-Mn6g',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.6,
    niches: ['trading', 'technical-analysis', 'bitcoin', 'onchain'],
  },
  {
    name: 'The Trading Parrot',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrqilwm_w0Jww188AyxBq7w',
    channelId: 'UCrqilwm_w0Jww188AyxBq7w',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.6,
    niches: ['trading', 'technical-analysis', 'crypto', 'education'],
  },
  {
    name: 'Crypto Face',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnpL_SpKLZpwAAIWmWpCIzQ',
    channelId: 'UCnpL_SpKLZpwAAIWmWpCIzQ',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.6,
    niches: ['trading', 'technical-analysis', 'live-trading', 'bitcoin'],
  },

  // ── swing-trading ──────────────────────────────────────────────────
  {
    name: 'Craig Percoco',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCUHDjihsY3-0hZrv4pkUndQ',
    channelId: 'UCUHDjihsY3-0hZrv4pkUndQ',
    category: 'trading',
    subcategory: 'swing-trading',
    weight: 0.6,
    niches: ['trading', 'swing-trading', 'technical-analysis', 'bitcoin'],
  },

  // ── futures-trading ────────────────────────────────────────────────
  {
    name: 'Folding Stock',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCw8mYhF2FmTz0jK0G8z1D0A',
    channelId: 'UCw8mYhF2FmTz0jK0G8z1D0A',
    category: 'trading',
    subcategory: 'futures-trading',
    weight: 0.7,
    niches: ['trading', 'options', 'bitcoin', 'ethereum'],
  },

  // ── crypto-gaming ──────────────────────────────────────────────────
  {
    name: 'EllioTrades',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCjD2WSsVDCnqVfhJTmBHGA',
    channelId: 'UCCjD2WSsVDCnqVfhJTmBHGA',
    category: 'trading',
    subcategory: 'crypto-gaming',
    weight: 0.6,
    niches: ['gaming', 'crypto', 'nft', 'metaverse'],
  },

  // ── altcoin-trading (informal) ─────────────────────────────────────
  {
    name: 'Crypto Zombie',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCiUnrCUGCJTCC7KjuW493Ww',
    channelId: 'UCiUnrCUGCJTCC7KjuW493Ww',
    category: 'trading',
    subcategory: 'technical-analysis',
    weight: 0.6,
    niches: ['trading', 'altcoins', 'technical-analysis', 'degen'],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  NFT / GAMING / WEB3  (weight: 0.6)
  // ═══════════════════════════════════════════════════════════════════

  // ── nft-market ─────────────────────────────────────────────────────
  {
    name: 'NFT Evening',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtMZnNQo4WnKs8o47QPCq4g',
    channelId: 'UCtMZnNQo4WnKs8o47QPCq4g',
    category: 'nft_gaming',
    subcategory: 'nft-market',
    weight: 0.5,
    niches: ['nft', 'news', 'collectibles', 'art'],
  },

  // ── nft-trading ────────────────────────────────────────────────────
  {
    name: 'Giancarlo',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCzV3OT7h55QD9q2QAgB1iOw',
    channelId: 'UCzV3OT7h55QD9q2QAgB1iOw',
    category: 'nft_gaming',
    subcategory: 'nft-trading',
    weight: 0.6,
    niches: ['nft', 'gaming', 'web3', 'metaverse'],
  },
  {
    name: 'Sheldon Evans',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCQ8q0L19AHZQ7bA7hr54lSg',
    channelId: 'UCQ8q0L19AHZQ7bA7hr54lSg',
    category: 'nft_gaming',
    subcategory: 'nft-trading',
    weight: 0.6,
    niches: ['nft', 'solana', 'collectibles', 'market-analysis'],
  },

  // ── nft-insights ───────────────────────────────────────────────────
  {
    name: 'Cirrus',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1ehVFaiXhBpYXYMu8YQmMQ',
    channelId: 'UC1ehVFaiXhBpYXYMu8YQmMQ',
    category: 'nft_gaming',
    subcategory: 'nft-insights',
    weight: 0.6,
    niches: ['nft', 'gaming', 'web3', 'metaverse'],
  },

  // ── nft-gaming ─────────────────────────────────────────────────────
  {
    name: 'Brypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UClqFuU6N_n6plK7w_wFkW_Q',
    channelId: 'UClqFuU6N_n6plK7w_wFkW_Q',
    category: 'nft_gaming',
    subcategory: 'nft-gaming',
    weight: 0.5,
    niches: ['nft', 'gaming', 'web3', 'reviews'],
  },
  {
    name: 'Brycent',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbboHvJxS-D30FUssheogAQ',
    channelId: 'UCbboHvJxS-D30FUssheogAQ',
    category: 'nft_gaming',
    subcategory: 'web3-gaming',
    weight: 0.6,
    niches: ['gaming', 'web3', 'nft', 'play-to-earn'],
  },

  // ── nft-education ──────────────────────────────────────────────────
  {
    name: 'NFT Simplified',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCW7EZ9sEIsyGqHlJFQx0Dag',
    channelId: 'UCW7EZ9sEIsyGqHlJFQx0Dag',
    category: 'nft_gaming',
    subcategory: 'nft-education',
    weight: 0.6,
    niches: ['nft', 'tutorial', 'collectibles', 'art'],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MACRO / BITCOIN  (weight: 0.8)
  // ═══════════════════════════════════════════════════════════════════

  // ── bitcoin-macro ──────────────────────────────────────────────────
  {
    name: 'Andrei Jikh',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCTZMRH9npOQxoKCeExhHZEA',
    channelId: 'UCTZMRH9npOQxoKCeExhHZEA',
    category: 'macro_bitcoin',
    subcategory: 'bitcoin-macro',
    weight: 0.8,
    niches: ['bitcoin', 'macro', 'personal-finance', 'investing'],
  },
  {
    name: 'Preston Pysh',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCLTdCY-fNXc1GqzIuflK-OQ',
    channelId: 'UCLTdCY-fNXc1GqzIuflK-OQ',
    category: 'macro_bitcoin',
    subcategory: 'bitcoin-macro',
    weight: 0.8,
    niches: ['bitcoin', 'macro', 'investing', 'value-investing'],
  },

  // ── macro-economics ────────────────────────────────────────────────
  {
    name: 'Mark Moss',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZO1Cs7iN3pZc6t5vM5J0EA',
    channelId: 'UCZO1Cs7iN3pZc6t5vM5J0EA',
    category: 'macro_bitcoin',
    subcategory: 'macro-economics',
    weight: 0.8,
    niches: ['macro', 'bitcoin', 'economy', 'investing'],
  },
  {
    name: 'British HODL',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCk3y2GtdStFaQcMkTpNjfIQ',
    channelId: 'UCk3y2GtdStFaQcMkTpNjfIQ',
    category: 'macro_bitcoin',
    subcategory: 'macro-economics',
    weight: 0.7,
    niches: ['bitcoin', 'macro', 'crypto', 'news'],
  },

  // ── bitcoin-philosophy ─────────────────────────────────────────────
  {
    name: 'Robert Breedlove',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UColPr0gDz5--4KhXiyzi6Bg',
    channelId: 'UColPr0gDz5--4KhXiyzi6Bg',
    category: 'macro_bitcoin',
    subcategory: 'bitcoin-philosophy',
    weight: 0.7,
    niches: ['bitcoin', 'philosophy', 'macro', 'austrian-economics'],
  },

  // ── bitcoin-education ──────────────────────────────────────────────
  {
    name: 'Bitcoin University',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6bLjiZqVHI4fJBswhcasgw',
    channelId: 'UC6bLjiZqVHI4fJBswhcasgw',
    category: 'macro_bitcoin',
    subcategory: 'bitcoin-education',
    weight: 0.7,
    niches: ['bitcoin', 'technical', 'education', 'protocol'],
  },

  // ── beginner-friendly ──────────────────────────────────────────────
  {
    name: 'Crypto Casey',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCW8zQLw5KQ3F4KgeJzxJ7jA',
    channelId: 'UCW8zQLw5KQ3F4KgeJzxJ7jA',
    category: 'macro_bitcoin',
    subcategory: 'beginner-friendly',
    weight: 0.8,
    niches: ['bitcoin', 'crypto', 'tutorial', 'passive-income'],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  SECURITY / TECHNICAL  (weight: 0.5)
  // ═══════════════════════════════════════════════════════════════════

  // ── scam-awareness ─────────────────────────────────────────────────
  {
    name: 'Coffeezilla',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCFQMnBA3CS502aghlcr0_aw',
    channelId: 'UCFQMnBA3CS502aghlcr0_aw',
    category: 'security_tech',
    subcategory: 'scam-awareness',
    weight: 0.8,
    niches: ['scams', 'investigative', 'crypto', 'fraud'],
  },

  // ── cybersecurity ──────────────────────────────────────────────────
  {
    name: 'John Hammond',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNcbElfFqNdiHISGcLlYwOw',
    channelId: 'UCNcbElfFqNdiHISGcLlYwOw',
    category: 'security_tech',
    subcategory: 'cybersecurity',
    weight: 0.6,
    niches: ['security', 'hacking', 'malware', 'cybersecurity'],
  },
  {
    name: 'NetworkChuck',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCi8w8ZzM2QFczjRxq0R_wjA',
    channelId: 'UCi8w8ZzM2QFczjRxq0R_wjA',
    category: 'security_tech',
    subcategory: 'cybersecurity',
    weight: 0.5,
    niches: ['networking', 'security', 'linux', 'tutorial'],
  },
  {
    name: 'SomeOrdinaryGamers',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtMVHI3AJD4Qk4hcbZnI9ZQ',
    channelId: 'UCtMVHI3AJD4Qk4hcbZnI9ZQ',
    category: 'security_tech',
    subcategory: 'cybersecurity',
    weight: 0.5,
    niches: ['security', 'hacking', 'tech-deep-dives', 'privacy'],
  },
  {
    name: 'Jim Browning',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCBNG0osIBAprVcZZ3ic84vw',
    channelId: 'UCBNG0osIBAprVcZZ3ic84vw',
    category: 'security_tech',
    subcategory: 'scam-awareness',
    weight: 0.6,
    niches: ['scams', 'investigative', 'security', 'tech-support-scams'],
  },

  // ── smart-contracts ───────────────────────────────────────────────
  {
    name: 'Smart Contract Programmer',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCJWh7F3AFyQ_x01VK6-7cZw',
    channelId: 'UCJWh7F3AFyQ_x01VK6-7cZw',
    category: 'security_tech',
    subcategory: 'smart-contracts',
    weight: 0.6,
    niches: ['solidity', 'smart-contracts', 'ethereum', 'security'],
  },
  {
    name: 'Dapp University',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6jH2FqQyN9x_4f7bK7Jvwg',
    channelId: 'UC6jH2FqQyN9x_4f7bK7Jvwg',
    category: 'security_tech',
    subcategory: 'blockchain-dev',
    weight: 0.6,
    niches: ['solidity', 'dapps', 'ethereum', 'tutorial'],
  },
  {
    name: 'Ethereum Foundation',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNOfzGXD_C9YMYmnefmPH0g',
    channelId: 'UCNOfzGXD_C9YMYmnefmPH0g',
    category: 'security_tech',
    subcategory: 'blockchain-dev',
    weight: 0.7,
    niches: ['ethereum', 'development', 'research', 'protocol'],
  },

  // ── web3-dev ───────────────────────────────────────────────────────
  {
    name: 'Nader Dabit',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC7mca3O0DmdSG2Cr80sOD7g',
    channelId: 'UC7mca3O0DmdSG2Cr80sOD7g',
    category: 'security_tech',
    subcategory: 'web3-dev',
    weight: 0.6,
    niches: ['web3', 'development', 'ethereum', 'polygon'],
  },
  {
    name: 'EatTheBlocks',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZM8XQjNOyG2ElPpEUtNasA',
    channelId: 'UCZM8XQjNOyG2ElPpEUtNasA',
    category: 'security_tech',
    subcategory: 'blockchain-dev',
    weight: 0.5,
    niches: ['solidity', 'blockchain', 'development', 'tutorial'],
  },
];

/** Map channel name → YouTubeChannel for O(1) lookups during filtering */
export const CHANNEL_BY_NAME: Record<string, YouTubeChannel> = {};
for (const ch of CRYPTO_CHANNELS) {
  CHANNEL_BY_NAME[ch.name] = ch;
}

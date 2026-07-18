#!/usr/bin/env tsx

/**
 * seed-content.ts — Content seeding script for DegenFeed
 *
 * Seeds initial content across all protocols so the app feels alive
 * when first users arrive. Run with:
 *   npx tsx scripts/seed-content.ts
 *
 * MISSION: The app is functionally complete but EMPTY. This script
 * populates:
 *   - 100+ realistic unified posts across 8 protocols
 *   - Pinned welcome post explaining DegenFeed
 *   - Recommended creators (who-to-follow) with real web3 personalities
 *   - 2 sample custom feeds ("DeFi Deep Dive", "Crypto News")
 *   - Community descriptions & rules for discover page categories
 *   - Notification seeding data
 *   - Getting started guide content
 *
 * OUTPUT: ./seed-data/ directory with JSON files that API routes import.
 */

import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Seed data output directory ──────────────────────────────────────────────
const SEED_DIR = path.resolve(__dirname, 'seed-data');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function hoursAgo(h: number): number {
  return now() - h * 3_600_000;
}

function daysAgo(d: number): number {
  return now() - d * 86_400_000;
}

function _shortId(len = 12): string {
  return randomBytes(len).toString('hex').slice(0, len);
}

function pseudoId(prefix: string, seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `${prefix}:${hash}`;
}

function postId(protocol: string, seed: string): string {
  return pseudoId(protocol, seed);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Creator / Identity Database ─────────────────────────────────────────────

interface CreatorDef {
  id: string;
  protocol: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  verified: boolean;
  nostrPubkey?: string;
  fid?: number;
  lensProfileId?: string;
  did?: string;
}

const CREATORS: CreatorDef[] = [
  // ── Nostr ──
  {
    id: 'nostr:npub1v3z7j6',
    protocol: 'nostr',
    displayName: 'Kieran',
    handle: 'kieran@degenfeed.xyz',
    bio: 'Building DegenFeed. Web3 social aggregation. Nostr & Farcaster.',
    avatarUrl: '/seed-avatars/kieran.jpg',
    followerCount: 2840,
    verified: true,
    nostrPubkey: 'npub1v3z7j6q5x4kp6tj0n3g8m2l9r4f7d1s8a2h5w3e6b9c0m7n4',
  },
  {
    id: 'nostr:npub1btc',
    protocol: 'nostr',
    displayName: 'BTC Frontier',
    handle: 'btcfrontier',
    bio: 'Bitcoin & Nostr evangelist. Open source. Privacy. Self-custody.',
    avatarUrl: '/seed-avatars/btcfrontier.jpg',
    followerCount: 12450,
    verified: true,
    nostrPubkey: 'npub1btcfrontierxyzabcdef0123456789abcdef0123456789abcdef01234',
  },
  {
    id: 'nostr:npub1john',
    protocol: 'nostr',
    displayName: 'John DeCarli',
    handle: 'johndecarli',
    bio: 'Designing the open social web. Co-host of nostr:nutshell.',
    avatarUrl: '/seed-avatars/johndecarli.jpg',
    followerCount: 8930,
    verified: true,
  },
  {
    id: 'nostr:npub1hodl',
    protocol: 'nostr',
    displayName: 'HODL Report',
    handle: 'hodlreport',
    bio: 'Daily crypto news roundup. Markets, on-chain data, alpha.',
    avatarUrl: '/seed-avatars/hodlreport.jpg',
    followerCount: 16700,
    verified: false,
  },
  {
    id: 'nostr:npub1sats',
    protocol: 'nostr',
    displayName: 'Sats Analytics',
    handle: 'satsanalytics',
    bio: 'Bitcoin on-chain analytics. MVRV, SOPR, RHODL. Number go up tech.',
    avatarUrl: '/seed-avatars/satsanalytics.jpg',
    followerCount: 5230,
    verified: false,
  },

  // ── Farcaster ──
  {
    id: 'farcaster:3',
    protocol: 'farcaster',
    displayName: 'dwr.eth',
    handle: 'dwr',
    bio: 'Building Farcaster. Previously Coinbase. Optimist.',
    avatarUrl: '/seed-avatars/dwr.jpg',
    followerCount: 52400,
    verified: true,
    fid: 3,
  },
  {
    id: 'farcaster:2',
    protocol: 'farcaster',
    displayName: 'v.eth',
    handle: 'v',
    bio: 'Farcaster dev. Full-time builder. Rust & TypeScript.',
    avatarUrl: '/seed-avatars/veth.jpg',
    followerCount: 38100,
    verified: true,
    fid: 2,
  },
  {
    id: 'farcaster:215',
    protocol: 'farcaster',
    displayName: 'Horsefacts',
    handle: 'horsefacts',
    bio: 'Builder on Farcaster. Smart contracts & social graphs.',
    avatarUrl: '/seed-avatars/horsefacts.jpg',
    followerCount: 28900,
    verified: true,
    fid: 215,
  },
  {
    id: 'farcaster:602',
    protocol: 'farcaster',
    displayName: 'Sassal.eth',
    handle: 'sassal',
    bio: 'Ethereum fanboy. Daily ETH commentary. DeFi nerd.',
    avatarUrl: '/seed-avatars/sassal.jpg',
    followerCount: 45200,
    verified: true,
    fid: 602,
  },
  {
    id: 'farcaster:4242',
    protocol: 'farcaster',
    displayName: 'Base',
    handle: 'base',
    bio: 'Base — secure, low-cost, builder-friendly Ethereum L2. Built by Coinbase.',
    avatarUrl: '/seed-avatars/base.jpg',
    followerCount: 89200,
    verified: true,
    fid: 4242,
  },

  // ── Lens ──
  {
    id: 'lens:stani.lens',
    protocol: 'lens',
    displayName: 'Stani',
    handle: 'stani.lens',
    bio: 'Building Lens Protocol. DeFi native. Polygon maxi.',
    avatarUrl: '/seed-avatars/stani.jpg',
    followerCount: 78400,
    verified: true,
    lensProfileId: '0x01',
  },
  {
    id: 'lens:nader.lens',
    protocol: 'lens',
    displayName: 'Nader Dabit',
    handle: 'nader.lens',
    bio: 'Developer relations at Lens. Web3 full-stack educator.',
    avatarUrl: '/seed-avatars/nader.jpg',
    followerCount: 56300,
    verified: true,
    lensProfileId: '0x04',
  },
  {
    id: 'lens:sassal0x.lens',
    protocol: 'lens',
    displayName: 'Sassal0x',
    handle: 'sassal0x.lens',
    bio: 'Ethereum. DeFi. Daily commentary on the merge & beyond.',
    avatarUrl: '/seed-avatars/sassal0x.jpg',
    followerCount: 32100,
    verified: true,
  },
  {
    id: 'lens:defi.lens',
    protocol: 'lens',
    displayName: 'DeFi Lens',
    handle: 'defi.lens',
    bio: 'DeFi analytics, yield strategies, and protocol research.',
    avatarUrl: '/seed-avatars/defilens.jpg',
    followerCount: 12400,
    verified: false,
  },

  // ── Bluesky ──
  {
    id: 'bluesky:jay.bsky.social',
    protocol: 'bluesky',
    displayName: 'Jay Graber',
    handle: 'jay.bsky.social',
    bio: 'AT Protocol dev. Bluesky CEO. Decentralizing social media.',
    avatarUrl: '/seed-avatars/jay.jpg',
    followerCount: 128000,
    verified: true,
    did: 'did:plc:jaygraber',
  },
  {
    id: 'bluesky:naval.bsky.social',
    protocol: 'bluesky',
    displayName: 'Naval',
    handle: 'naval.bsky.social',
    bio: 'Angel investor. Entrepreneur. Philosopher of tech.',
    avatarUrl: '/seed-avatars/naval.jpg',
    followerCount: 256000,
    verified: true,
  },
  {
    id: 'bluesky:balajis.com',
    protocol: 'bluesky',
    displayName: 'Balaji S.',
    handle: 'balajis.com',
    bio: 'Angel investor. Author. Former CTO Coinbase.',
    avatarUrl: '/seed-avatars/balaji.jpg',
    followerCount: 185000,
    verified: true,
  },
  {
    id: 'bluesky:a16z.com',
    protocol: 'bluesky',
    displayName: 'a16z crypto',
    handle: 'a16z.com',
    bio: 'A16z crypto fund. Building the next internet.',
    avatarUrl: '/seed-avatars/a16z.jpg',
    followerCount: 98000,
    verified: true,
  },
  {
    id: 'bluesky:solana.com',
    protocol: 'bluesky',
    displayName: 'Solana',
    handle: 'solana.com',
    bio: 'High-performance blockchain. Web3 for everyone.',
    avatarUrl: '/seed-avatars/solana.jpg',
    followerCount: 142000,
    verified: true,
  },

  // ── Mastodon ──
  {
    id: 'mastodon:cryptofm@mastodon.social',
    protocol: 'mastodon',
    displayName: 'CryptoFM',
    handle: 'cryptofm@mastodon.social',
    bio: 'Crypto news and podcast network. Daily blockchain radio.',
    avatarUrl: '/seed-avatars/cryptofm.jpg',
    followerCount: 12400,
    verified: true,
  },
  {
    id: 'mastodon:degenfeed@social.degenfeed.xyz',
    protocol: 'mastodon',
    displayName: 'DegenFeed Bot',
    handle: 'degenfeed@social.degenfeed.xyz',
    bio: 'Official DegenFeed Mastodon bot. Cross-posting feed highlights.',
    avatarUrl: '/seed-avatars/degenfeed-bot.jpg',
    followerCount: 840,
    verified: true,
  },

  // ── RSS (News outlets) ──
  {
    id: 'rss:theblock',
    protocol: 'rss',
    displayName: 'The Block',
    handle: 'theblock.co',
    bio: 'Leading crypto news and research. Breaking stories, data, analysis.',
    avatarUrl: '/seed-avatars/theblock.jpg',
    followerCount: 245000,
    verified: true,
  },
  {
    id: 'rss:coindesk',
    protocol: 'rss',
    displayName: 'CoinDesk',
    handle: 'coindesk.com',
    bio: 'Crypto news, prices, and data. The authority on digital assets.',
    avatarUrl: '/seed-avatars/coindesk.jpg',
    followerCount: 312000,
    verified: true,
  },
  {
    id: 'rss:decrypt',
    protocol: 'rss',
    displayName: 'Decrypt',
    handle: 'decrypt.co',
    bio: 'Web3 news that actually makes sense. AI, crypto, culture.',
    avatarUrl: '/seed-avatars/decrypt.jpg',
    followerCount: 187000,
    verified: true,
  },

  // ── Threads ──
  {
    id: 'threads:bankless',
    protocol: 'threads',
    displayName: 'Bankless',
    handle: 'bankless@threads.net',
    bio: 'Go bankless with crypto. Podcast, newsletter, community.',
    avatarUrl: '/seed-avatars/bankless.jpg',
    followerCount: 89000,
    verified: true,
  },
  {
    id: 'threads:techcrunch',
    protocol: 'threads',
    displayName: 'TechCrunch',
    handle: 'techcrunch@threads.net',
    bio: 'Startup and technology news. Crunching tech daily.',
    avatarUrl: '/seed-avatars/techcrunch.jpg',
    followerCount: 450000,
    verified: true,
  },

  // ── Reddit ──
  {
    id: 'reddit:cryptocurrency',
    protocol: 'reddit',
    displayName: 'r/CryptoCurrency',
    handle: 'r/CryptoCurrency',
    bio: 'The largest crypto community on Reddit. 8M+ subscribers.',
    avatarUrl: '/seed-avatars/reddit-crypto.jpg',
    followerCount: 8000000,
    verified: false,
  },
  {
    id: 'reddit:defi',
    protocol: 'reddit',
    displayName: 'r/defi',
    handle: 'r/defi',
    bio: 'Decentralized finance discussion. Yield, lending, DEXs.',
    avatarUrl: '/seed-avatars/reddit-defi.jpg',
    followerCount: 1200000,
    verified: false,
  },
  {
    id: 'reddit:solana',
    protocol: 'reddit',
    displayName: 'r/solana',
    handle: 'r/solana',
    bio: 'Solana ecosystem. News, discussions, memes.',
    avatarUrl: '/seed-avatars/reddit-solana.jpg',
    followerCount: 2500000,
    verified: false,
  },
  {
    id: 'reddit:nft',
    protocol: 'reddit',
    displayName: 'r/NFT',
    handle: 'r/NFT',
    bio: 'NFT marketplace discussions. Art, collectibles, gaming.',
    avatarUrl: '/seed-avatars/reddit-nft.jpg',
    followerCount: 1800000,
    verified: false,
  },
];

// ─── Content Templates (per category/niche) ──────────────────────────────────

interface ContentTemplate {
  niches: string[];
  text: string;
  html?: string;
}

const CRYPTO_POSTS: ContentTemplate[] = [
  {
    niches: ['crypto', 'bitcoin'],
    text: 'Bitcoin just crossed $72K for the first time since March. ETF inflows are accelerating — $1.2B last week alone. The institutional FOMO is real. Are we entering the next leg up? 🟢',
  },
  {
    niches: ['crypto', 'bitcoin'],
    text: 'Bitcoin dominance rising above 56% as altcoins lag. Classic pre-halving behavior. Remember: BTC dominance tends to peak before altseason. Stay patient.',
  },
  {
    niches: ['crypto', 'bitcoin'],
    text: 'New analysis: The MVRV Z-Score is still below the "euphoria" zone. Historically, the real top doesn\'t come until this metric hits 5+. Currently at 2.8. Plenty of room to run.',
  },
  {
    niches: ['crypto', 'ethereum'],
    text: 'ETH gas fees dropping to 5 gwei for the first time since 2020. L2 adoption is working. Base alone is doing 2M+ daily transactions. The scaling roadmap is delivering.',
  },
  {
    niches: ['crypto', 'ethereum', 'layer2'],
    text: 'The Ethereum L2 ecosystem now has more TVL than any other chain besides Ethereum itself. @l2beat shows $45B+ locked across Arbitrum, Optimism, Base, and ZK chains.',
  },
  {
    niches: ['crypto', 'ethereum'],
    text: 'Blob count on Ethereum just hit an all-time high thanks to EIP-4844. Blobspace demand is surging from L2s. This is exactly what the Danksharding roadmap envisioned.',
  },
  {
    niches: ['crypto', 'solana'],
    text: 'Solana is processing 4,000+ TPS consistently with 0% failure rate since v1.18. Network stability is at an all-time high. The "Solana is down" narrative is officially dead.',
  },
  {
    niches: ['crypto', 'solana'],
    text: 'Solana DEX volume just flipped Ethereum for the first time. $3.8B vs $3.2B in 24h volume. Jupiter, Raydium, and Orca eating. The retail chain is winning.',
  },
  {
    niches: ['crypto', 'solana'],
    text: "Solana has 5+ million monthly active users. Compare to Ethereum's 500K. The gap in user activity vs market cap tells you everything about where growth is happening.",
  },
  {
    niches: ['crypto', 'regulation'],
    text: 'Breaking: SEC closes investigation into Ethereum 2.0 — no enforcement action. This is a massive regulatory win for ETH. Staking is not a security. Game on.',
  },
  {
    niches: ['crypto', 'regulation'],
    text: 'The FIT21 bill passed the House with bipartisan support. This is the most significant crypto legislation in US history. Market structure clarity is coming.',
  },
  {
    niches: ['crypto', 'etf'],
    text: "Spot Ethereum ETFs now hold over 1M ETH combined. That's ~$3.5B in AUM. BlackRock leads with $1.2B. Institutional demand for ETH is real and growing.",
  },
];

const DEFI_POSTS: ContentTemplate[] = [
  {
    niches: ['defi'],
    text: 'Uniswap v4 hooks are going to be a game-changer. Custom AMM curves, dynamic fees, on-chain limit orders. This is the most important DeFi upgrade of 2024.',
  },
  {
    niches: ['defi'],
    text: 'DeFi TVL just crossed $100B again for the first time since May 2022. Lido ($35B), Aave ($20B), EigenLayer ($15B), Maker ($8B). The comeback is real.',
  },
  {
    niches: ['defi', 'ethereum'],
    text: 'Restaking through EigenLayer is generating $250M+ in fees annually. LRTs like ether.fi and Renzo are bringing liquid restaking to the masses. New DeFi primitive unlocked.',
  },
  {
    niches: ['defi'],
    text: 'Aave v4 proposal is live. Cross-chain liquidity, unified balance sheets, and GHO expansion. Aave is evolving from a lending protocol to a DeFi super-app.',
  },
  {
    niches: ['defi', 'solana'],
    text: 'Kamino Lend on Solana just hit $2B in TVL. With Jito restaking and Sanctum LSTs, Solana DeFi is building a full-stack yield ecosystem. No L2s needed.',
  },
  {
    niches: ['defi'],
    text: 'Morpho Blue is redefining lending with permissionless markets and no governance. $1.5B TVL in 6 months. The "minimal protocol" thesis is winning.',
  },
  {
    niches: ['defi'],
    text: 'Perpetual DEXs hit $200B in monthly volume for the first time. dYdX dominates with $80B, followed by GMX ($30B) and Hyperliquid ($45B). CeFi replacement in progress.',
  },
  {
    niches: ['defi', 'stablecoin'],
    text: "Ethena's USDe surpassed $3B supply. The delta-neutral stablecoin model is absorbing real demand. 30%+ yield on sUSDe is bringing massive TVL.",
  },
  {
    niches: ['defi'],
    text: 'Pendle Finance is the yield trading layer of DeFi. $7B TVL across 200+ markets. Fixed yields, airdrop points trading, and yield tokenization. Essential infrastructure.',
  },
  {
    niches: ['defi', 'ethereum'],
    text: 'MakerDAO\'s "Endgame" is shipping. New stablecoin (PureDai), own L1 chain (NewChain), and Spark subDAO. The OG DeFi protocol is reinventing itself.',
  },
  {
    niches: ['defi'],
    text: 'DeFi summer 2.0 incoming? L2 TVL is hitting ATHs. Arbitrum at $20B, Base at $8B, Optimism at $7B. Lower fees = more activity = more composability.',
  },
];

const NFT_POSTS: ContentTemplate[] = [
  {
    niches: ['nft'],
    text: 'Pudgy Penguins floor is up 5x this year — now at 25 ETH. The retail brand expansion (Walmart, IG, plushies) is paying off. NFT as brand IP, not just art.',
  },
  {
    niches: ['nft'],
    text: 'Bitcoin Ordinals inscriptions crossed 100M! The $BTC ecosystem now rivals ETH in NFT activity. Runes, BRC-20s, and recursive inscriptions — Bitcoin is programmable.',
  },
  {
    niches: ['nft'],
    text: 'ERC-404 / DN-404 hybrid token standard is gaining traction. Pandora doing $150M in trading. Semi-fungibility unlocks fractionalized collectibles and DeFi-NFT hybrids.',
  },
  {
    niches: ['nft'],
    text: 'OpenSea and Blur are fighting for dominance. Blur has 80% of volume but OpenSea has 3x more unique traders. The marketplace war is far from over.',
  },
  {
    niches: ['nft', 'gaming'],
    text: 'Web3 gaming weekly active wallets hit 1.5M. Ronin leads with Pixels (500K+ DAU). Immutable zkEVM is onboarding major studios. The gaming thesis is slowly proving out.',
  },
  {
    niches: ['nft'],
    text: 'NFT lending protocols are doing $300M+ monthly volume. Blend (Blur), Arcade, and NFTfi. Leverage on collectibles is here to stay.',
  },
];

const AI_POSTS: ContentTemplate[] = [
  {
    niches: ['ai'],
    text: 'OpenAI GPT-5 is reportedly 10x better at coding than GPT-4. The jump from 48% to 85% on SWE-bench. AI coding assistants are becoming indispensable for developers.',
  },
  {
    niches: ['ai', 'tech'],
    text: 'Claude 3.5 Sonnet is crushing benchmarks while being 1/10th the cost of GPT-4. Anthropic\'s "middle child" model is the best value in AI right now.',
  },
  {
    niches: ['ai'],
    text: 'Open-source LLMs are catching up. Llama 4, DeepSeek V4, and Mistral are within 5% of GPT-4. The commoditization of AI is happening faster than anyone predicted.',
  },
  {
    niches: ['ai'],
    text: 'AI agent frameworks are exploding. LangGraph, CrewAI, AutoGen. Multi-agent systems that call APIs, trade crypto, and write code autonomously. This is the next wave.',
  },
  {
    niches: ['ai', 'tech'],
    text: 'The gap between open-source and closed-source models has narrowed to ~3% on MMLU. Open models now beat GPT-3.5 across the board. Democratization of intelligence.',
  },
  {
    niches: ['ai', 'crypto'],
    text: 'AI x Crypto intersection is real: decentralized compute (Akash, Render), ZK-ML verification, prediction markets (Polymarket), and agent-to-agent payments.',
  },
];

const TRADING_POSTS: ContentTemplate[] = [
  {
    niches: ['crypto', 'memecoin'],
    text: 'Pump.fun has launched 2M+ tokens on Solana. Average lifespan: 30 minutes. The casino is open 24/7. Most will go to zero. A few will 100x. Welcome to the arena.',
  },
  {
    niches: ['trading', 'crypto'],
    text: 'Funding rates are elevated across BTC and ETH perps. $0.02-0.05% 8h on Binance. This suggests the market is levered long. A squeeze lower could be violent.',
  },
  {
    niches: ['trading', 'crypto'],
    text: "Open interest in BTC futures just hit $38B ATH. New money is flowing in, but it's all levered. The derivatives market is pricing in volatility.",
  },
  {
    niches: ['trading', 'crypto'],
    text: 'BTC perpetual basis trade (cash and carry) is yielding 12-15% annualized. Risk-free in theory. The simplest Alpha in crypto right now.',
  },
  {
    niches: ['memecoin', 'crypto'],
    text: 'Memecoin supercycle theory is real. WIF, PEPE, BONK, DOGE — they\'re all outperforming "serious" tokens. Attention is the only scarce resource in crypto.',
  },
  {
    niches: ['trading', 'crypto'],
    text: 'GMX v2 on Arbitrum doing $500M daily volume with $2B in open interest. The GLP model enables deep liquidity without the typical slippage issues.',
  },
  {
    niches: ['trading', 'crypto'],
    text: 'Social sentiment analysis: retail is overwhelmingly bullish BTC. Historical contrarian signal when everyone is euphoric. But this time could be different with ETFs.',
  },
];

const SECURITY_POSTS: ContentTemplate[] = [
  {
    niches: ['security'],
    text: 'Rekt report: Cross-chain bridges have lost $2.5B+ to exploits in the last 3 years. The most hacked category in crypto. Wormhole ($326M), Ronin ($620M), Nomad ($190M). Be careful.',
  },
  {
    niches: ['security'],
    text: 'Immunefi reported 125+ hacks in Q1 2024 with $500M in losses. Phishing remains the #1 attack vector. Always verify transactions before signing.',
  },
  {
    niches: ['security'],
    text: "Smart contract audits are good, but they're not a guarantee. The $47M KyberSwap hack passed 4 audits. Defense in depth: audits + fuzzing + formal verification + bug bounties.",
  },
  {
    niches: ['security', 'defi'],
    text: 'Pendle front-end exploit shows the growing trend of DNS hijacking. Always use bookmark, not Google. Always check URL. Use hardware wallets for high-value accounts.',
  },
  {
    niches: ['security', 'crypto'],
    text: 'Wallet drainers on Twitter / Discord are getting sophisticated. Never run random Python code from strangers. Never connect your wallet to unknown dApps. Stay frosty.',
  },
];

const MEME_POSTS: ContentTemplate[] = [
  {
    niches: ['memecoin', 'crypto'],
    text: "I bought the top so you don't have to. You're welcome, anons.",
  },
  {
    niches: ['memecoin', 'crypto'],
    text: 'gm ☕️ chart looks bullish af. 4h MACD crossover. Fib retracement at 0.618. Trust me bro.',
  },
  {
    niches: ['memecoin', 'crypto'],
    text: 'The bull market is when your mom asks you what ETH is and then tells you her friend bought DOGE.',
  },
  {
    niches: ['memecoin', 'crypto'],
    text: 'We are all gonna make it... said every trader who then proceeded to not take profits.',
  },
  {
    niches: ['memecoin', 'crypto'],
    text: 'Larping as a productive member of society while watching charts all day. What is sleep? Never heard of her.',
  },
  {
    niches: ['memecoin', 'crypto'],
    text: 'Bitcoin to $1M EOY. No cope. Just hopium. Dyor. Nfa.',
  },
];

const TECH_POSTS: ContentTemplate[] = [
  {
    niches: ['tech', 'crypto'],
    text: 'The technical skills every crypto dev needs in 2026: Solidity (EVM), Rust (Solana), TypeScript (frontend), and understanding ZK proofs. Full-stack web3 is demanding.',
  },
  {
    niches: ['tech', 'ai'],
    text: 'Cursor + Claude + GPT-5 = 10x developer productivity. The AI coding stack is evolving fast. Who needs Stack Overflow when your IDE writes the code for you?',
  },
  {
    niches: ['tech'],
    text: 'Rust is being adopted everywhere in blockchain infra. Solana, Reth, Lighthouse, Tendermint. Memory safety + performance is winning for systems-level crypto code.',
  },
  {
    niches: ['tech'],
    text: 'Zero-knowledge proofs are the most important cryptographic primitive of the decade. zkRollups, zkVM, zkBridge, zkML. Privacy and scalability combined.',
  },
  {
    niches: ['tech', 'startups'],
    text: 'The best crypto startups are building in bear markets. The infrastructure built 2022-2024 (L2s, restaking, ZK, intent-based protocols) will power the next bull run.',
  },
];

const SCIENCE_POSTS: ContentTemplate[] = [
  {
    niches: ['science'],
    text: 'GPT-5 is demonstrating "theory of mind" capabilities — understanding what other AI agents know and don\'t know. This is emergent behavior not explicitly trained for.',
  },
  {
    niches: ['science', 'space'],
    text: 'SpaceX Starship completed a full orbital test flight. The largest rocket ever built is now operational. Mars colonization timeline just got moved up.',
  },
  {
    niches: ['science'],
    text: "Neuralink's first human patient is controlling a computer with their thoughts. Brain-computer interfaces went from science fiction to reality in one year.",
  },
  {
    niches: ['science', 'energy'],
    text: 'Fusion energy milestone: Net energy gain for the second time at NIF. While commercial fusion is still a decade away, the physics is confirmed. It works.',
  },
];

const ONCHAIN_POSTS: ContentTemplate[] = [
  {
    niches: ['onchain', 'crypto'],
    text: 'Whale alert: 25,000 ETH ($85M) moved from unknown wallet to Coinbase. Likely OTC settlement. Large holders are positioning for something.',
  },
  {
    niches: ['onchain', 'ethereum'],
    text: "New addresses at ATH — 300K+ new wallets created daily on Ethereum L1 alone. L2 onboarding is pushing this even higher. Adoption numbers don't lie.",
  },
  {
    niches: ['onchain', 'bitcoin'],
    text: 'Bitcoin hashrate hit 700 EH/s ATH. Miners are bullish despite the halving. ASIC efficiency improvements are keeping profitable miners online.',
  },
  {
    niches: ['onchain', 'solana'],
    text: 'Solana unique fee payers hit 2M/day. This is the real DAU metric. Not wallets, not addresses — actual users paying for blockspace.',
  },
  {
    niches: ['onchain', 'ethereum'],
    text: 'ETH burn rate picked up again with L2 blob usage. Net issuance near zero since EIP-1559. ETH is becoming truly deflationary during high activity periods.',
  },
];

const COMMUNITY_DISCUSSIONS: ContentTemplate[] = [
  {
    niches: ['crypto'],
    text: "🏆 **Community Discussion: What altcoins are you accumulating right now?**\n\nDrop your current bags and why you're bullish. Let's share alpha and research.",
    html: "<p>🏆 <strong>Community Discussion: What altcoins are you accumulating right now?</strong></p><p>Drop your current bags and why you're bullish. Let's share alpha and research.</p>",
  },
  {
    niches: ['defi'],
    text: '📊 **Yield Farming Discussion**\n\nWhere are you farming yields right now? Looking for safe 15-25% APY options on L2s. Sharing my current strategy in the thread.',
    html: '<p>📊 <strong>Yield Farming Discussion</strong></p><p>Where are you farming yields right now? Looking for safe 15-25% APY options on L2s.</p>',
  },
  {
    niches: ['nft'],
    text: "🎨 **NFT Trend Watch**\n\nWhat upcoming mints are you watching? Any projects with strong art + community that aren't hyped yet? Share alpha below.",
    html: '<p>🎨 <strong>NFT Trend Watch</strong></p><p>What upcoming mints are you watching?</p>',
  },
  {
    niches: ['tech', 'ai'],
    text: "🤖 **What AI tools are you using daily?**\n\nList your top 3 AI tools and how they've changed your workflow. Looking for new recommendations!",
    html: '<p>🤖 <strong>What AI tools are you using daily?</strong></p>',
  },
  {
    niches: ['trading', 'crypto'],
    text: '📈 **Weekly Trading Thread**\n\nPost your charts, analysis, and setups for the week. TA, on-chain, fundamentals — all welcome.',
    html: '<p>📈 <strong>Weekly Trading Thread</strong></p>',
  },
  {
    niches: ['memecoin'],
    text: '😂 **Meme of the Week Contest**\n\nBest crypto meme gets featured. Post your best degen memes. Bonus points for OC.',
    html: '<p>😂 <strong>Meme of the Week Contest</strong></p>',
  },
  {
    niches: ['crypto', 'security'],
    text: "🔒 **Security Saturday: Recent hacks discussion**\n\nLet's break down the latest exploits and what we can learn from them. Education prevents rekt.",
    html: '<p>🔒 <strong>Security Saturday: Recent hacks discussion</strong></p>',
  },
  {
    niches: ['crypto', 'etf'],
    text: '💡 **ETF Impact Discussion**\n\nNow that spot ETFs are here, how do you think the market structure changes? Institutional flows, regulatory clarity, price impact.',
    html: '<p>💡 <strong>ETF Impact Discussion</strong></p>',
  },
  {
    niches: ['solana', 'crypto'],
    text: "🌊 **Solana Ecosystem Roundup**\n\nWhat's happening in Solana this week? New protocols, airdrops, and ecosystem news.",
    html: '<p>🌊 <strong>Solana Ecosystem Roundup</strong></p>',
  },
  {
    niches: ['defi'],
    text: '🔗 **Cross-Chain Bridging Guide**\n\nBest bridges for moving funds between L2s right now? Comparing costs, speed, and security.',
    html: '<p>🔗 <strong>Cross-Chain Bridging Guide</strong></p>',
  },
];

// ─── Community Definitions ──────────────────────────────────────────────────

interface CommunityDef {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  niche: string;
  rules: string[];
  subscriberCount: number;
  usersActiveMonth: number;
  qualityTier: 'low' | 'medium' | 'high' | 'vibrant';
  protocols: string[];
}

const COMMUNITIES: CommunityDef[] = [
  {
    name: 'crypto',
    displayName: 'Crypto General',
    description:
      'General cryptocurrency discussion. Markets, news, prices, and ecosystem talk. No shilling, no scams.',
    icon: '₿',
    niche: 'crypto',
    rules: [
      'No price shilling or pump groups',
      'Always credit sources for news',
      'Be respectful — disagree constructively',
      'No referral links',
      'Tag NSFW content',
    ],
    subscriberCount: 45231,
    usersActiveMonth: 12840,
    qualityTier: 'vibrant',
    protocols: ['farcaster', 'nostr', 'lens', 'reddit'],
  },
  {
    name: 'defi',
    displayName: 'Decentralized Finance',
    description:
      'Discuss DeFi protocols, yield strategies, lending, DEXs, and the future of finance. Yield farmers welcome.',
    icon: '🏦',
    niche: 'defi',
    rules: [
      'No obvious scams or rugpulls',
      'DYOR before sharing strategies',
      'No referral codes in main posts',
      'Use the daily thread for questions',
    ],
    subscriberCount: 28920,
    usersActiveMonth: 8430,
    qualityTier: 'vibrant',
    protocols: ['farcaster', 'lens', 'bluesky', 'reddit'],
  },
  {
    name: 'nft',
    displayName: 'NFT & Collectibles',
    description:
      'NFT art, collectibles, gaming assets, and digital ownership. Mint discussions, market analysis, and community building.',
    icon: '🖼',
    niche: 'nft',
    rules: [
      'Post art with artist credit',
      'No obvious rugpulls',
      'No DM spam for mints',
      'Price discussions in thread',
    ],
    subscriberCount: 18450,
    usersActiveMonth: 5620,
    qualityTier: 'high',
    protocols: ['bluesky', 'farcaster', 'mastodon', 'reddit'],
  },
  {
    name: 'ai',
    displayName: 'AI & Machine Learning',
    description:
      'Artificial intelligence, LLMs, agents, research, and the intersection of AI with crypto and web3.',
    icon: '🤖',
    niche: 'ai',
    rules: [
      'No low-effort AI spam',
      'Disclosure: AI-generated content',
      'Focus on substance over hype',
      'Share research and papers',
    ],
    subscriberCount: 31200,
    usersActiveMonth: 9870,
    qualityTier: 'vibrant',
    protocols: ['nostr', 'bluesky', 'rss', 'reddit'],
  },
  {
    name: 'trading',
    displayName: 'Trading & TA',
    description:
      'Technical analysis, trading strategies, signals, market structure, and trade ideas for crypto markets.',
    icon: '📈',
    niche: 'trading',
    rules: [
      'Tag charts with analysis',
      'No paid signals or groups',
      "Explain your logic — don't just post screenshots",
      'No leverage shaming',
    ],
    subscriberCount: 22100,
    usersActiveMonth: 7450,
    qualityTier: 'high',
    protocols: ['farcaster', 'nostr', 'reddit'],
  },
  {
    name: 'memes',
    displayName: 'Crypto Memes',
    description: 'The degen side of DegenFeed. Memes, shitposting, and quality humor. WAGMI.',
    icon: '😂',
    niche: 'memecoin',
    rules: [
      'Keep it fun — no hate speech',
      'No obvious rugpulls',
      'Mark NSFW memes',
      'OC gets priority',
    ],
    subscriberCount: 35600,
    usersActiveMonth: 12400,
    qualityTier: 'high',
    protocols: ['farcaster', 'nostr', 'lens', 'bluesky', 'mastodon'],
  },
  {
    name: 'security',
    displayName: 'Crypto Security',
    description:
      'Blockchain security, smart contract audits, wallet safety, exploit analysis, and threat intelligence.',
    icon: '🔒',
    niche: 'security',
    rules: [
      'No faulting victims',
      'Verify before trusting any advice',
      'Cite sources for exploits',
      'No phishing or scam awareness',
    ],
    subscriberCount: 12500,
    usersActiveMonth: 3890,
    qualityTier: 'high',
    protocols: ['nostr', 'farcaster', 'rss', 'reddit'],
  },
  {
    name: 'tech',
    displayName: 'Tech & Development',
    description:
      'Software engineering, blockchain development, open source, and tech infrastructure for web3 builders.',
    icon: '💻',
    niche: 'tech',
    rules: [
      'Stay on topic — blockchain and crypto tech',
      'No recruitment spam',
      'Share code and projects',
      'Constructive criticism only',
    ],
    subscriberCount: 19800,
    usersActiveMonth: 6100,
    qualityTier: 'vibrant',
    protocols: ['farcaster', 'nostr', 'lens', 'rss'],
  },
  {
    name: 'ethereum',
    displayName: 'Ethereum Ecosystem',
    description:
      'Ethereum L1, L2s, EVM development, governance, and ecosystem. For ETH maxis and builders.',
    icon: 'Ξ',
    niche: 'ethereum',
    rules: [
      'Respect different L2 preferences',
      'No tribalism — focus on tech',
      'Post with context',
    ],
    subscriberCount: 15400,
    usersActiveMonth: 5200,
    qualityTier: 'high',
    protocols: ['farcaster', 'lens', 'reddit'],
  },
  {
    name: 'solana',
    displayName: 'Solana Ecosystem',
    description:
      'Solana blockchain news, development, DeFi, NFTs, and community. High performance, low fees.',
    icon: '◉',
    niche: 'solana',
    rules: [
      'Keep it constructive — no ETH vs SOL wars',
      'No pump groups',
      'Share alpha and ecosystem updates',
    ],
    subscriberCount: 18200,
    usersActiveMonth: 7400,
    qualityTier: 'vibrant',
    protocols: ['farcaster', 'bluesky', 'reddit'],
  },
];

// ─── Build Unified Posts ────────────────────────────────────────────────────

function buildCreatorPost(
  creator: CreatorDef,
  content: ContentTemplate,
  timeAgoMs: number,
  overrides?: Partial<{
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views: number;
    embedUrl?: string;
    embedKind?: string;
    isPinned?: boolean;
  }>,
) {
  const id = postId(creator.protocol, `${creator.id}|${content.text.slice(0, 40)}|${timeAgoMs}`);
  const likes = overrides?.likes ?? randInt(5, 500);
  const reposts = overrides?.reposts ?? randInt(1, 120);
  const replies = overrides?.replies ?? randInt(0, 80);
  const quotes = overrides?.quotes ?? randInt(0, 30);
  const views = overrides?.views ?? randInt(200, 50000);

  const post = {
    id,
    protocol: creator.protocol,
    author: {
      id: creator.id,
      protocol: creator.protocol,
      primary: { protocol: creator.protocol, id: creator.id },
      handles: {
        nostr: creator.protocol === 'nostr' ? creator.handle : null,
        farcaster: creator.protocol === 'farcaster' ? creator.handle : null,
        lens: creator.protocol === 'lens' ? creator.handle : null,
        bluesky: creator.protocol === 'bluesky' ? creator.handle : null,
        mastodon: creator.protocol === 'mastodon' ? creator.handle : null,
        rss: creator.protocol === 'rss' ? creator.handle : null,
        threads: creator.protocol === 'threads' ? creator.handle : null,
        reddit: creator.protocol === 'reddit' ? creator.handle : null,
      },
      displayName: creator.displayName,
      bio: creator.bio,
      avatarUrl: creator.avatarUrl,
      bannerUrl: undefined,
      // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
      verified: creator.verified ? [{ protocol: creator.protocol as any, badge: 'verified' }] : [],
      followerCount: creator.followerCount,
      followingCount: randInt(100, 5000),
      links: [],
      keys: {
        nostrPubkey: creator.nostrPubkey,
        fid: creator.fid,
        lensProfileId: creator.lensProfileId,
        did: creator.did,
        evmAddress: undefined,
        solanaAddress: undefined,
      },
    },
    text: content.text,
    html: content.html,
    embeds: overrides?.embedUrl
      ? // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
        [{ kind: (overrides.embedKind ?? 'link') as any, url: overrides.embedUrl }]
      : [],
    parentId: undefined,
    rootId: undefined,
    createdAt: timeAgoMs,
    metrics: { likes, reposts, replies, quotes, views },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes, reposts, replies, quotes, views },
    },
    raw: { sourceId: id },
    niches: content.niches,
    crossPostedTo: [],
    score: {
      total: likes + reposts * 2 + replies * 1.5 + Math.exp(-timeAgoMs / 86400000),
      recency: Math.exp(-(now() - timeAgoMs) / 86400000),
      engagement: Math.log(likes + reposts + 1) / 10,
      relevance: content.niches.length / 5,
      quality: Math.min(
        1,
        (creator.followerCount > 10000 ? 0.8 : 0.5) + (creator.verified ? 0.2 : 0),
      ),
      diversity: 0.5,
      source: creator.verified ? 0.9 : 0.5,
      velocity: Math.log(likes + reposts + 1) / 100,
      reasons: [
        creator.verified ? 'verified-author' : '',
        timeAgoMs > now() - 86400000 ? 'fresh' : '',
        likes > 100 ? 'viral' : '',
        content.niches.length > 0 ? 'on-topic' : '',
      ].filter(Boolean),
    },
    contentType: content.text.length > 300 ? 'article' : 'text',
    isNew: timeAgoMs > now() - 3600000,
    isHot: likes > 100,
    isTrending: likes > 200,
    qualityScore: {
      score: creator.verified ? 85 : 60,
      max: 100,
      ratio: creator.verified ? 0.85 : 0.6,
      reasons: creator.verified ? ['verified account'] : ['established account'],
    },
    qualityBadge: creator.verified ? 'verified' : null,
    community: undefined,
    dfUri: `df://${creator.protocol}:${id}`,
    contentProof: {
      contentHash: createHash('sha256').update(id).digest('hex'),
      timestamp: timeAgoMs,
      permanent: false,
    },
    ...(overrides?.isPinned ? { isPinned: true } : {}),
  };

  return post;
}

function buildCommunityPost(
  community: CommunityDef,
  creator: CreatorDef,
  content: ContentTemplate,
  timeAgoMs: number,
  overrides?: Partial<{ likes: number; reposts: number; replies: number }>,
) {
  const base = buildCreatorPost(creator, content, timeAgoMs, overrides);
  return {
    ...base,
    community: {
      name: community.name,
      title: community.displayName,
      icon: community.icon,
      instance: 'community.degenfeed.xyz',
      subscriberCount: community.subscriberCount,
      usersActiveMonth: community.usersActiveMonth,
      niche: community.niche,
      qualityTier: community.qualityTier,
    },
  };
}

// ─── Build all seed data ────────────────────────────────────────────────────

interface SeedOutput {
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  posts: any[];
  communities: CommunityDef[];
  creators: CreatorDef[];
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  customFeeds: any[];
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  welcomePost: any;
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  notifications: any[];
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  gettingStartedGuide: any;
  metadata: {
    generatedAt: number;
    totalPosts: number;
    totalCreators: number;
    totalCommunities: number;
  };
}

function generateSeedData(): SeedOutput {
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  const allPosts: any[] = [];
  const usedContent = new Set<string>();

  // Pick a random creator from a protocol, ensuring rotation
  function pickCreatorForPost(protocol?: string): CreatorDef {
    if (protocol) {
      const filtered = CREATORS.filter((c) => c.protocol === protocol);
      return pick(filtered.length > 0 ? filtered : CREATORS);
    }
    return pick(CREATORS);
  }

  // Generate posts per niche
  function addPosts(
    templates: ContentTemplate[],
    protocol?: string,
    timeRange?: { minHours: number; maxHours: number },
    count?: number,
  ) {
    const maxPosts = count ?? templates.length;
    for (let i = 0; i < maxPosts && i < templates.length; i++) {
      const content = templates[i];
      const fingerprint = content.text.slice(0, 60);
      if (usedContent.has(fingerprint)) continue;
      usedContent.add(fingerprint);

      const creator = pickCreatorForPost(protocol);
      const hoursBack = timeRange
        ? randInt(timeRange.minHours, timeRange.maxHours)
        : randInt(0, 168);
      const timeAgo = hoursAgo(hoursBack);
      allPosts.push(buildCreatorPost(creator, content, timeAgo));
    }
  }

  // ── 1. Main feed posts per niche ──
  addPosts(CRYPTO_POSTS, undefined, { minHours: 0, maxHours: 72 }, 12);
  addPosts(DEFI_POSTS, undefined, { minHours: 0, maxHours: 96 }, 10);
  addPosts(NFT_POSTS, undefined, { minHours: 0, maxHours: 120 }, 6);
  addPosts(AI_POSTS, undefined, { minHours: 0, maxHours: 72 }, 6);
  addPosts(TRADING_POSTS, undefined, { minHours: 0, maxHours: 48 }, 7);
  addPosts(SECURITY_POSTS, undefined, { minHours: 0, maxHours: 168 }, 5);
  addPosts(MEME_POSTS, undefined, { minHours: 0, maxHours: 24 }, 6);
  addPosts(TECH_POSTS, undefined, { minHours: 0, maxHours: 168 }, 5);
  addPosts(SCIENCE_POSTS, undefined, { minHours: 0, maxHours: 336 }, 4);
  addPosts(ONCHAIN_POSTS, undefined, { minHours: 0, maxHours: 72 }, 5);

  // ── 2. Protocol-specific posts (ensure each protocol has recent content) ──
  addPosts(CRYPTO_POSTS.slice(0, 3), 'nostr', { minHours: 0, maxHours: 12 }, 3);
  addPosts(DEFI_POSTS.slice(0, 3), 'farcaster', { minHours: 0, maxHours: 12 }, 3);
  addPosts(NFT_POSTS.slice(0, 2), 'bluesky', { minHours: 1, maxHours: 24 }, 2);
  addPosts(AI_POSTS.slice(0, 2), 'mastodon', { minHours: 2, maxHours: 36 }, 2);
  addPosts(TECH_POSTS.slice(0, 2), 'lens', { minHours: 1, maxHours: 48 }, 2);
  addPosts(CRYPTO_POSTS.slice(0, 3), 'reddit', { minHours: 0, maxHours: 24 }, 3);
  addPosts(DEFI_POSTS.slice(0, 3), 'threads', { minHours: 0, maxHours: 24 }, 3);
  addPosts(CRYPTO_POSTS.slice(3, 5), 'rss', { minHours: 0, maxHours: 6 }, 2);

  // ── 3. Community posts (one per community) ──
  for (let i = 0; i < COMMUNITIES.length; i++) {
    const community = COMMUNITIES[i];
    const discussion = COMMUNITY_DISCUSSIONS[i % COMMUNITY_DISCUSSIONS.length];
    const creator = pickCreatorForPost(pick(community.protocols));
    const timeAgo = hoursAgo(randInt(0, 72));
    allPosts.push(
      buildCommunityPost(community, creator, discussion, timeAgo, {
        likes: randInt(10, 300),
        reposts: randInt(2, 50),
        replies: randInt(5, 100),
      }),
    );
  }

  // ── 4. Additional community posts for variety (5-10 per category) ──
  const categoryTemplates: Record<string, ContentTemplate[]> = {
    crypto: CRYPTO_POSTS,
    defi: DEFI_POSTS,
    nft: NFT_POSTS,
    ai: AI_POSTS,
    trading: TRADING_POSTS,
    memes: MEME_POSTS,
    tech: TECH_POSTS,
    security: SECURITY_POSTS,
  };

  for (const community of COMMUNITIES) {
    const templates = categoryTemplates[community.niche] || CRYPTO_POSTS;
    const numExtraPosts = randInt(3, 7);
    for (let i = 0; i < numExtraPosts && i < templates.length; i++) {
      const content = templates[i];
      const fingerprint = `comm:${community.name}:${content.text.slice(0, 40)}`;
      if (usedContent.has(fingerprint)) continue;
      usedContent.add(fingerprint);

      const creator = pickCreatorForPost(pick(community.protocols));
      const timeAgo = hoursAgo(randInt(0, 120));
      allPosts.push(
        buildCommunityPost(community, creator, content, timeAgo, {
          likes: randInt(3, 150),
          reposts: randInt(1, 30),
          replies: randInt(0, 50),
        }),
      );
    }
  }

  // ── 5. Pinned Welcome Post ──
  const welcomeCreator = CREATORS.find((c) => c.displayName === 'Kieran')!;
  const welcomePost = buildCreatorPost(
    welcomeCreator,
    {
      niches: ['crypto', 'tech'],
      text: `🚀 **Welcome to DegenFeed!** 🚀

DegenFeed is the open social graph client that brings together Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified feed.

**What you can do here:**

🔹 **Browse** — No account needed. Read posts from 8+ protocols in one place.
🔹 **Cross-post** — Sign in once, post everywhere. One click, all networks.
🔹 **Tune your feed** — Filter by topic, protocol, quality, and engagement.
🔹 **Discover** — Find communities, trending topics, and creators across the open social graph.
🔹 **Custom feeds** — Build your own curated feeds from any combination of sources.
🔹 **Tip creators** — Support your favorite posters with crypto tips.

**Getting started:**
1. Click "Connect Wallet" to sign in
2. Choose your favorite protocols
3. Follow creators and communities
4. Build your For You feed by liking and engaging
5. Explore custom feeds for curated content

The web3 social web is fragmented. DegenFeed brings it all together.

Welcome aboard. 🟢`,
    },
    hoursAgo(2),
    {
      likes: 428,
      reposts: 156,
      replies: 89,
      quotes: 34,
      views: 15800,
      isPinned: true,
    },
  );
  // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
  (welcomePost as any).isPinned = true;
  allPosts.push(welcomePost);

  // ── 6. Sample Custom Feeds ──
  const customFeeds = [
    {
      id: 'feed:defi-deep-dive',
      name: 'DeFi Deep Dive',
      title: 'DeFi Deep Dive',
      description:
        'Farcaster + Lens, DeFi only, high engagement. The best DeFi content from the open social graph.',
      authorId: 'DegenFeed',
      sources: ['farcaster', 'lens'],
      isPublic: true,
      isPinned: false,
      subscriberCount: 342,
      config: {
        sources: ['farcaster', 'lens'],
        topics: { defi: 80, ethereum: 50, solana: 30, stablecoin: 40 },
        contentTypes: ['article', 'text', 'thread'],
        minEngagement: 5,
        excludeTopics: ['nft', 'memecoin'],
        excludeWords: [],
      },
      createdAt: daysAgo(14),
      updatedAt: hoursAgo(6),
      subscribers: 342,
    },
    {
      id: 'feed:crypto-news',
      name: 'Crypto News',
      title: 'Crypto News',
      description:
        'RSS + Reddit, news category only. Stay informed with the latest crypto news from top sources.',
      authorId: 'DegenFeed',
      sources: ['rss', 'reddit'],
      isPublic: true,
      isPinned: false,
      subscriberCount: 567,
      config: {
        sources: ['rss', 'reddit'],
        topics: { crypto: 80, bitcoin: 60, ethereum: 60, regulation: 50, etf: 50 },
        contentTypes: ['article', 'link', 'text'],
        minEngagement: 3,
        excludeTopics: ['memecoin'],
        excludeWords: ['pump', 'moon', 'lambo'],
      },
      createdAt: daysAgo(10),
      updatedAt: hoursAgo(3),
      subscribers: 567,
    },
    {
      id: 'feed:memecoin-watch',
      name: 'Memecoin Watch',
      title: 'Memecoin Watch',
      description:
        'Track the wild world of memecoins across all protocols. High risk, high entertainment.',
      authorId: 'DegenFeed',
      sources: ['farcaster', 'bluesky', 'reddit'],
      isPublic: true,
      isPinned: false,
      subscriberCount: 891,
      config: {
        sources: ['farcaster', 'bluesky', 'reddit', 'nostr'],
        topics: { memecoin: 90, crypto: 50, trading: 40 },
        contentTypes: ['text', 'image', 'link'],
        minEngagement: 2,
        excludeTopics: ['science', 'startups'],
        excludeWords: [],
      },
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(1),
      subscribers: 891,
    },
    {
      id: 'feed:ai-crypto-cross',
      name: 'AI x Crypto',
      title: 'AI x Crypto',
      description:
        'The intersection of artificial intelligence and blockchain technology. Agents, ZK-ML, decentralized compute.',
      authorId: 'DegenFeed',
      sources: ['nostr', 'bluesky', 'rss'],
      isPublic: true,
      isPinned: false,
      subscriberCount: 234,
      config: {
        sources: ['nostr', 'bluesky', 'rss'],
        topics: { ai: 80, tech: 50, crypto: 40 },
        contentTypes: ['article', 'text'],
        minEngagement: 3,
        excludeTopics: ['memecoin'],
        excludeWords: [],
      },
      createdAt: daysAgo(7),
      updatedAt: hoursAgo(12),
      subscribers: 234,
    },
  ];

  // ── 7. Notification seed data ──
  const notifications = [
    {
      id: 'notif:welcome-1',
      type: 'system',
      title: 'Welcome to DegenFeed! 🎉',
      message:
        "You've just joined the most unified feed in web3. Browse 8+ protocols in one timeline.",
      createdAt: hoursAgo(2),
      read: false,
      actionUrl: '/feed',
      actor: {
        displayName: 'DegenFeed',
        avatarUrl: '/icon.svg',
      },
    },
    {
      id: 'notif:welcome-2',
      type: 'system',
      title: 'Start exploring',
      message: 'Check out Discover to find communities, trending content, and creators to follow.',
      createdAt: hoursAgo(1.5),
      read: false,
      actionUrl: '/discover',
      actor: {
        displayName: 'DegenFeed',
        avatarUrl: '/icon.svg',
      },
    },
    {
      id: 'notif:welcome-3',
      type: 'system',
      title: 'Tune your feed',
      message: 'Use the Feed Tuner 🎚️ to control which topics appear in your For You timeline.',
      createdAt: hoursAgo(1),
      read: false,
      actionUrl: '/feed',
      actor: {
        displayName: 'DegenFeed',
        avatarUrl: '/icon.svg',
      },
    },
    {
      id: 'notif:welcome-4',
      type: 'system',
      title: 'Build custom feeds',
      message: 'Create your own curated feeds from any combination of protocols and topics.',
      createdAt: hoursAgo(0.5),
      read: false,
      actionUrl: '/feeds',
      actor: {
        displayName: 'DegenFeed',
        avatarUrl: '/icon.svg',
      },
    },
    {
      id: 'notif:trending-1',
      type: 'trending',
      title: 'Bitcoin crossing $72K 🔥',
      message: 'BTC is trending across all protocols. 1.2K+ posts in the last hour.',
      createdAt: hoursAgo(1),
      read: false,
      actionUrl: '/feed?niche=crypto',
      actor: {
        displayName: 'Trending',
        avatarUrl: '/icon.svg',
      },
    },
  ];

  // ── 8. Getting Started Guide ──
  const gettingStartedGuide = {
    id: 'guide:welcome',
    title: 'Getting Started with DegenFeed',
    summary: 'Your guide to the unified feed of web3',
    sections: [
      {
        id: 'welcome',
        title: 'Welcome to DegenFeed',
        icon: '🚀',
        content: `DegenFeed is the open social graph client that brings together Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS into one unified feed.

**Why DegenFeed?**
The web3 social landscape is fragmented. Each protocol has unique strengths but siloed communities. DegenFeed bridges them all — giving you one window into every conversation, without needing accounts on every network.`,
      },
      {
        id: 'browsing',
        title: 'Browsing the Feed',
        icon: '📰',
        content: `The main feed has three views:
• **For You** — Algorithmically curated based on engagement, recency, and your preferences
• **Following** — Posts from accounts you follow
• **Protocol filter** — Tap protocol pills to view only one network

**Controls:**
• Tune topics with the 🎚️ slider
• Filter by quality, engagement, and content type
• Toggle between compact and comfortable layouts`,
      },
      {
        id: 'signin',
        title: 'Signing In',
        icon: '🔑',
        content: `Sign in with your wallet (ETH or SOL) to unlock the full experience:
• Like, reply, and repost across all protocols
• Cross-post to multiple networks simultaneously
• Follow creators and build your network
• Tip creators with crypto
• Create custom feeds
• Sync preferences across devices

Your private keys never leave your device. DegenFeed uses client-side encryption.`,
      },
      {
        id: 'discover',
        title: 'Discover & Communities',
        icon: '🔍',
        content: `The Discover page is your gateway to new content:
• **Trending Now** — Hottest posts across all protocols
• **Communities** — Topic-based groups with their own feeds
• **People to Follow** — Suggested creators based on your interests
• **Popular Topics** — Trending hashtags and niches
• **New on DegenFeed** — Recently created communities and active accounts

Each community has its own rules, discussions, and culture.`,
      },
      {
        id: 'custom-feeds',
        title: 'Custom Feeds',
        icon: '🎛️',
        content: `Build your own curated feeds from any combination:
• Choose your sources (any protocol mix)
• Set topic weights and exclusions
• Filter by content type and minimum engagement
• Make them public for others to discover

Example feeds already available: "DeFi Deep Dive", "Crypto News", "Memecoin Watch", "AI x Crypto"`,
      },
      {
        id: 'posting',
        title: 'Posting & Engagement',
        icon: '✍️',
        content: `Once signed in, you can:
• **Compose** — Write posts that go to all connected networks
• **Engage** — Like, repost, bookmark, and reply
• **Tip** — Send crypto tips to creators you appreciate
• **Quote** — Share posts with your own commentary

Cross-posting means one message reaches your audience on Farcaster, Lens, and Nostr simultaneously.`,
      },
      {
        id: 'tips',
        title: 'Pro Tips',
        icon: '💡',
        content: `• Use the Feed Tuner to dial in exactly what you want to see
• The more you engage, the better For You becomes
• Use custom feeds to track specific topics without noise
• Bookmark posts to save them for later
• Enable notifications to stay on top of replies and likes
• Try the quick topic boosts on any post (★ button)`,
      },
    ],
  };

  // Sort posts by createdAt (newest first)
  // biome-ignore lint/suspicious/noExplicitAny: intentional
  allPosts.sort((a: any, b: any) => b.createdAt - a.createdAt);

  return {
    posts: allPosts,
    communities: COMMUNITIES,
    creators: CREATORS,
    customFeeds,
    welcomePost,
    notifications,
    gettingStartedGuide,
    metadata: {
      generatedAt: now(),
      totalPosts: allPosts.length,
      totalCreators: CREATORS.length,
      totalCommunities: COMMUNITIES.length,
    },
  };
}

// ─── Write seed files ───────────────────────────────────────────────────────

function writeSeedFiles(data: SeedOutput): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }

  // biome-ignore lint/suspicious/noExplicitAny: intentional
  const files: [string, any][] = [
    ['posts.json', data.posts],
    ['communities.json', data.communities],
    ['creators.json', data.creators],
    ['custom-feeds.json', data.customFeeds],
    ['welcome-post.json', data.welcomePost],
    ['notifications.json', data.notifications],
    ['getting-started-guide.json', data.gettingStartedGuide],
    ['metadata.json', data.metadata],
  ];

  for (const [filename, content] of files) {
    const filepath = path.join(SEED_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2), 'utf-8');
    console.log(`  ✓ ${filename} (${JSON.stringify(content).length.toLocaleString()} bytes)`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  DegenFeed — Content Seeding');
  console.log('═══════════════════════════════════════════════════════\n');

  const data = generateSeedData();

  console.log(`  Generated:`);
  console.log(`    • ${data.metadata.totalPosts} posts across 8+ protocols`);
  console.log(`    • ${data.metadata.totalCommunities} communities with descriptions & rules`);
  console.log(`    • ${data.metadata.totalCreators} recommended creators`);
  console.log(`    • ${data.customFeeds.length} sample custom feeds (public)`);
  console.log(`    • ${data.notifications.length} welcome notifications`);
  console.log(`    • 1 pinned welcome post`);
  console.log(
    `    • 1 getting started guide (${data.gettingStartedGuide.sections.length} sections)\n`,
  );

  writeSeedFiles(data);

  // Write an index file for easy imports
  const indexPath = path.join(SEED_DIR, 'index.json');
  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        description: 'DegenFeed seed data — generated by scripts/seed-content.ts',
        generatedAt: data.metadata.generatedAt,
        files: [
          'posts.json',
          'communities.json',
          'creators.json',
          'custom-feeds.json',
          'welcome-post.json',
          'notifications.json',
          'getting-started-guide.json',
        ],
        summary: {
          totalPosts: data.metadata.totalPosts,
          totalCreators: data.metadata.totalCreators,
          totalCommunities: data.metadata.totalCommunities,
          totalCustomFeeds: data.customFeeds.length,
          totalNotifications: data.notifications.length,
        },
      },
      null,
      2,
    ),
    'utf-8',
  );

  // Summary by niche
  const nicheCounts: Record<string, number> = {};
  for (const post of data.posts) {
    for (const niche of post.niches) {
      nicheCounts[niche] = (nicheCounts[niche] || 0) + 1;
    }
  }

  const protocolCounts: Record<string, number> = {};
  for (const post of data.posts) {
    protocolCounts[post.protocol] = (protocolCounts[post.protocol] || 0) + 1;
  }

  console.log(`\n  ── Posts by Protocol ──`);
  for (const [protocol, count] of Object.entries(protocolCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${protocol.padEnd(12)} ${count}`);
  }

  console.log(`\n  ── Posts by Niche ──`);
  for (const [niche, count] of Object.entries(nicheCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${niche.padEnd(14)} ${count}`);
  }

  console.log(`\n  Seed data written to: ${SEED_DIR}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main();

import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_16: RssFeedConfig[] = [
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
];

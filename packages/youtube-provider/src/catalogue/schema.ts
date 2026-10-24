/**
 * Runtime allow-lists for catalogue rows. These mirror the `ChannelCategory` /
 * `ChannelSubcategory` unions in ../youtube/types — a row using an unknown value
 * is rejected at build time rather than silently mis-filed.
 */
import type { ChannelCategory, ChannelSubcategory } from '../youtube/types';

export const CATEGORIES: readonly ChannelCategory[] = [
  'market_analysis',
  'defi',
  'trading',
  'nft_gaming',
  'macro_bitcoin',
  'security_tech',
  'ai_ml',
  'general_tech',
  'science',
  'startups',
];

export const SUBCATEGORIES: readonly ChannelSubcategory[] = [
  'daily-news',
  'market-commentary',
  'interviews',
  'altcoin-research',
  'market-sentiment',
  'protocol-deep-dives',
  'yield-farming',
  'defi-alpha',
  'defi-analysis',
  'defi-math',
  'crypto-research',
  'technical-analysis',
  'trading-psychology',
  'algorithmic-trading',
  'futures-options',
  'nft-art',
  'nft-news',
  'blockchain-gaming',
  'metaverse',
  'bitcoin-maximalism',
  'macro-economics',
  'monetary-policy',
  'smart-contract-audits',
  'defi-hacks',
  'privacy-tech',
  'infrastructure',
  'layer2-scaling',
  'swing-trading',
  'futures-trading',
  'crypto-gaming',
  'nft-market',
  'nft-trading',
  'nft-insights',
  'nft-gaming',
  'web3-gaming',
  'nft-education',
  'bitcoin-macro',
  'bitcoin-philosophy',
  'bitcoin-education',
  'beginner-friendly',
  'scam-awareness',
  'cybersecurity',
  'smart-contracts',
  'blockchain-dev',
  'web3-dev',
  'ai-research',
  'ai-tools',
  'llm-benchmarks',
  'agent-dev',
  'startup-fundraising',
  'startup-interviews',
  'science-breakthroughs',
  'devops',
  'opensource-dev',
];

export const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);
export const SUBCATEGORY_SET: ReadonlySet<string> = new Set(SUBCATEGORIES);

/**
 * news-processor — News processing: entity extraction, sentiment,
 * scoring, dedup, clustering, and enrichment.
 *
 * Separated from news-aggregator.ts during de-godding.
 */

import type {

// ─── Entity Extraction ──────────────────────────────────────────────────

const TOKEN_PATTERNS = /\$([A-Z]{2,8})\b/g;
const KNOWN_TOKENS = new Set([
  'BTC',
  'ETH',
  'SOL',
  'USDT',
  'USDC',
  'BNB',
  'XRP',
  'ADA',
  'AVAX',
  'DOT',
  'LINK',
  'MATIC',
  'POL',
  'UNI',
  'AAVE',
  'COMP',
  'MKR',
  'CRV',
  'PEPE',
  'DOGE',
  'SHIB',
  'BONK',
  'WIF',
  'JUP',
  'RAY',
  'ORCA',
  'RUNE',
  'ATOM',
  'OSMO',
  'ARB',
  'OP',
  'STRK',
  'ZK',
  'BLAST',
  'BASE',
  'APT',
  'SUI',
  'SEI',
  'INJ',
  'STX',
  'FET',
  'AGIX',
  'OCEAN',
  'RNDR',
  'NEAR',
  'FIL',
  'ICP',
  'SAND',
  'MANA',
  'APE',
  'BLUR',
  'LOOKS',
  'GMX',
  'GNS',
  'ALICE',
  'YGG',
]);

const KNOWN_PROTOCOLS = [
  'uniswap',
  'aave',
  'compound',
  'makerdao',
  'lido',
  'rocketpool',
  'curve',
  'balancer',
  'pancakeswap',
  'jupiter',
  'raydium',
  'orca',
  'meteora',
  'opensea',
  'blur',
  'magiceden',
  'tensor',
  'sudoswap',
  'arbitrum',
  'optimism',
  'base',
  'polygon',
  'avalanche',
  'solana',
  'ethereum',
  'bitcoin',
  'cosmos',
  'near',
  'celestia',
  'chainlink',
  'thegraph',
  'arweave',
  'ipfs',
  'filecoin',
  'zksync',
  'scroll',
  'linea',
  'blast',
  'mantle',
  'mode',
];

const KNOWN_PEOPLE = [
  'vitalik buterin',
  'vitalik',
  'cz binance',
  'changpeng zhao',
  'brian armstrong',
  'sam bankman-fried',
  'sbf',
  'michael saylor',
  'barry silbert',
  'anatoly yakovenko',
  'raj gokal',
  'ryan selkis',
  'chris dixon',
  'gavin wood',
  'charles hoskinson',
  'justin sun',
  'andrew kang',
  'hayden adams',
  'stani kulechov',
  'sanderc botberg',
  'tim draper',
  'naval ravikant',
  'balaji srinivasan',
  'jack dorsey',
];

const KNOWN_COMPANIES = [
  'coinbase',
  'binance',
  'kraken',
  'gemini',
  'bitfinex',
  'okx',
  'bybit',
  'kucoin',
  'crypto.com',
  'robinhood',
  'paypal',
  'stripe',
  'visa',
  'mastercard',
  'blackrock',
  'fidelity',
  'grayscale',
  'microstrategy',
  'tesla',
  'a16z',
  'paradigm',
  'multicoin',
  'dragonfly',
  'pantera',
  'polychain',
  'sequoia',
  'union square',
  'electric capital',
  'variant',
  'circle',
  'tether',
  'ripple',
  'consensys',
  'opensea',
  'alchemy',
  'infura',
  'quicknode',
  'etherscan',
  'solscan',
  'dune analytics',
  'nansen',
  'glassnode',
  'chainalysis',
  'elliptic',
  'trmlabs',
];

const KNOWN_CHAINS = [
  'ethereum',
  'bitcoin',
  'solana',
  'avalanche',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'bnb chain',
  'cosmos',
  'near',
  'aptos',
  'sui',
  'ton',
  'tron',
  'ripple',
  'cardano',
  'polkadot',
  'zksync',
  'scroll',
  'linea',
  'blast',
  'mantle',
  'celestia',
  'injective',
  'sei',
];

const KNOWN_NFT_COLLECTIONS = [
  'bored ape',
  'cryptopunk',
  'pudgy penguin',
  'milady',
  'azuki',
  'deGods',
  'mad lad',
  'nouns',
  'art blocks',
  'chromie squiggle',
  'doodles',
  'clone x',
  'otherdeed',
  'proof collective',
  'bitcoin ordinals',
  'inscriptions',
  'runes',
];

export function extractEntities(text: string): StoryEntities {

// ─── Credibility Scoring ────────────────────────────────────────────────

export function computeCredibility(source: NewsSourceMeta, story: AggregatedStory): number {

// ─── Freshness / Breaking News ─────────────────────────────────────────

export function computeFreshness(
  publishedAt: number,
  now: number,
): { freshScore: number; isBreaking: boolean } {

export interface ArticleEnrichment {

/**
 * Estimate reading time from word count.
 */
function _estimateReadingTime(text: string): number {

/**
 * Lightweight fetch to extract og:image, meta description, and author
 * from an article page. Uses a streaming HTML parser approach.
 * Returns empty strings on failure.
 */
async function _enrichArticle(url: string, timeoutMs = 3000): Promise<ArticleEnrichment> {

// ─── Text Similarity (Jaccard) for Dedup ────────────────────────────────

export function jaccardSimilarity(a: string, b: string): number {

function _normalizeUrl(url: string): string {

function _clusterStories(stories: AggregatedStory[]): StoryCluster[] {

function countOverlap(a: string[], b: string[]): number {

// ═══════════════════════════════════════════════════════════════════════════
// TASK 4: ENHANCED DEDUP — Levenshtein + Content Hash + Story Merging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Levenshtein distance between two strings.
 * Used for title similarity comparison (>85% = duplicate).
 */
function levenshteinDistance(a: string, b: string): number {

/**
 * Compute normalized Levenshtein similarity (0–1).
 * 1 = identical, 0 = completely different.
 */
function _titleSimilarity(a: string, b: string): number {

/**
 * Generate a content hash from the first N characters of normalized text.
 * Used for detecting identical stories published across sources.
 */
function _contentHash(text: string, length = 500): string {

/**
 * Merge a duplicate story into the primary story.
 * Tracks "also reported by" across all covering sources.
 */
function _mergeStory(primary: AggregatedStory, duplicate: AggregatedStory): AggregatedStory {
// ─── Sentiment Analysis (keyword-based) ─────────────────────────────────

const BULLISH_TERMS = [
  'bullish',
  'surge',
  'soar',
  'rally',
  'breakthrough',
  'upgrade',
  'launch',
  'partnership',
  'adoption',
  'institutional',
  'approval',
  'etf',
  'all-time high',
  'ath',
  'breakout',
  'moon',
  'pump',
  'green',
  'profit',
  'growth',
  'positive',
  'mainnet',
  'integration',
  'listing',
  'accumulation',
  'whale buying',
];

const BEARISH_TERMS = [
  'bearish',
  'crash',
  'dump',
  'hack',
  'exploit',
  'vulnerability',
  'rug',
  'scam',
  'fraud',
  'decline',
  'plunge',
  'drop',
  'sell-off',
  'liquidation',
  'ban',
  'crackdown',
  'regulation',
  'fud',
  'fear',
  'uncertainty',
  'red',
  'loss',
  'bankrupt',
  'attack',
  'sanctions',
  'withdrawal halt',
  'freeze',
];

export function analyzeSentiment(text: string): SentimentResult {

// ═══════════════════════════════════════════════════════════════════════════
// Note: TOKEN_PATTERNS, KNOWN_TOKENS, KNOWN_PROTOCOLS, KNOWN_PEOPLE,
// KNOWN_COMPANIES, KNOWN_CHAINS, and KNOWN_NFT_COLLECTIONS are defined
// above (lines 18-243). The duplicate definitions below have been removed.
// ═══════════════════════════════════════════════════════════════════════════


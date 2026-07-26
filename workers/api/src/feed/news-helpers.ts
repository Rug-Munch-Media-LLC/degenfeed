/**
 * news-helpers — Helper functions and constants for the news pipeline.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * Contains: sentiment analysis, entity extraction, credibility/freshness
 * scoring, text similarity algorithms, and story merging.
 */

import { detectNiches } from '@degenfeed/feed-core';
import type { Protocol } from '@degenfeed/types';
import type { AggregatedStory, NewsSourceMeta, SentimentResult, StoryEntities } from './news-types';

// ─── Sentiment Analysis (keyword-based) ─────────────────────────────────

const BULLISH_TERMS = [
  'bullish', 'surge', 'soar', 'rally', 'breakthrough', 'upgrade', 'launch',
  'partnership', 'adoption', 'institutional', 'approval', 'etf',
  'all-time high', 'ath', 'breakout', 'moon', 'pump', 'green', 'profit',
  'growth', 'positive', 'mainnet', 'integration', 'listing', 'accumulation',
  'whale buying',
];

const BEARISH_TERMS = [
  'bearish', 'crash', 'dump', 'hack', 'exploit', 'vulnerability', 'rug',
  'scam', 'fraud', 'decline', 'plunge', 'drop', 'sell-off', 'liquidation',
  'ban', 'crackdown', 'regulation', 'fud', 'fear', 'uncertainty', 'red',
  'loss', 'bankrupt', 'attack', 'sanctions', 'withdrawal halt', 'freeze',
];

export function analyzeSentiment(text: string): SentimentResult {

// ─── Entity Extraction ──────────────────────────────────────────────────

const TOKEN_PATTERNS = /\$([A-Z]{2,8})\b/g;

const KNOWN_TOKENS = new Set([
  'BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT',
  'LINK', 'MATIC', 'POL', 'UNI', 'AAVE', 'COMP', 'MKR', 'CRV', 'PEPE',
  'DOGE', 'SHIB', 'BONK', 'WIF', 'JUP', 'RAY', 'ORCA', 'RUNE', 'ATOM',
  'OSMO', 'ARB', 'OP', 'STRK', 'ZK', 'BLAST', 'BASE', 'APT', 'SUI', 'SEI',
  'INJ', 'STX', 'FET', 'AGIX', 'OCEAN', 'RNDR', 'NEAR', 'FIL', 'ICP',
  'SAND', 'MANA', 'APE', 'BLUR', 'LOOKS', 'GMX', 'GNS', 'ALICE', 'YGG',
]);

const KNOWN_PROTOCOLS = [
  'uniswap', 'aave', 'compound', 'makerdao', 'lido', 'rocketpool', 'curve',
  'balancer', 'pancakeswap', 'jupiter', 'raydium', 'orca', 'meteora',
  'opensea', 'blur', 'magiceden', 'tensor', 'sudoswap', 'arbitrum',
  'optimism', 'base', 'polygon', 'avalanche', 'solana', 'ethereum', 'bitcoin',
  'cosmos', 'near', 'celestia', 'chainlink', 'thegraph', 'arweave', 'ipfs',
  'filecoin', 'zksync', 'scroll', 'linea', 'blast', 'mantle', 'mode',
];

const KNOWN_PEOPLE = [
  'vitalik buterin', 'vitalik', 'cz binance', 'changpeng zhao',
  'brian armstrong', 'sam bankman-fried', 'sbf', 'michael saylor',
  'barry silbert', 'anatoly yakovenko', 'raj gokal', 'ryan selkis',
  'chris dixon', 'gavin wood', 'charles hoskinson', 'justin sun',
  'andrew kang', 'hayden adams', 'stani kulechov', 'sanderc botberg',
  'tim draper', 'naval ravikant', 'balaji srinivasan', 'jack dorsey',
];

const KNOWN_COMPANIES = [
  'coinbase', 'binance', 'kraken', 'gemini', 'bitfinex', 'okx', 'bybit',
  'kucoin', 'crypto.com', 'robinhood', 'paypal', 'stripe', 'visa',
  'mastercard', 'blackrock', 'fidelity', 'grayscale', 'microstrategy',
  'tesla', 'a16z', 'paradigm', 'multicoin', 'dragonfly', 'pantera',
  'polychain', 'sequoia', 'union square', 'electric capital', 'variant',
  'circle', 'tether', 'ripple', 'consensys', 'opensea', 'alchemy',
  'infura', 'quicknode', 'etherscan', 'solscan', 'dune analytics',
  'nansen', 'glassnode', 'chainalysis', 'elliptic', 'trmlabs',
];

const KNOWN_CHAINS = [
  'ethereum', 'bitcoin', 'solana', 'avalanche', 'polygon', 'arbitrum',
  'optimism', 'base', 'bnb chain', 'cosmos', 'near', 'aptos', 'sui', 'ton',
  'tron', 'ripple', 'cardano', 'polkadot', 'zksync', 'scroll', 'linea',
  'blast', 'mantle', 'celestia', 'injective', 'sei',
];

const KNOWN_NFT_COLLECTIONS = [
  'bored ape', 'cryptopunk', 'pudgy penguin', 'milady', 'azuki', 'deGods',
  'mad lad', 'nouns', 'art blocks', 'chromie squiggle', 'doodles', 'clone x',
  'otherdeed', 'proof collective', 'bitcoin ordinals', 'inscriptions', 'runes',
];

export function extractEntities(text: string): StoryEntities {

// ─── Credibility Scoring ────────────────────────────────────────────────

export function computeCredibility(source: NewsSourceMeta, story: AggregatedStory): number {

// ─── Freshness / Breaking News ─────────────────────────────────────────

export function computeFreshness(
  publishedAt: number,
  now: number,
): { freshScore: number; isBreaking: boolean } {

// ─── Text Similarity (Jaccard + Levenshtein) ────────────────────────────

export function jaccardSimilarity(a: string, b: string): number {

export function normalizeUrl(url: string): string {

export function levenshteinDistance(a: string, b: string): number {

export function titleSimilarity(a: string, b: string): number {

export function contentHash(text: string, length = 500): string {

// ─── Story Merging ──────────────────────────────────────────────────────

export function mergeStory(primary: AggregatedStory, duplicate: AggregatedStory): AggregatedStory {

// ─── Misc Utilities ────────────────────────────────────────────────────

export function countOverlap(a: string[], b: string[]): number {

export function withConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {

export function decodeXmlEntities(str: string): string {

export function stripTags(html: string): string {

export function estimateReadingTime(text: string): number {

export function extractText(tag: string, xml: string): string {

export function extractAll(tag: string, xml: string): string[] {


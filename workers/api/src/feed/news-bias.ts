/**
 * news-bias — Political bias & factuality ratings for the news pipeline.
 *
 * Curated from AllSides/MBFC-style research (2026-08-04). Mirrors the
 * bridge's `providers/rss/rss-bias.ts` for the sources the worker actually
 * fetches (keyed by NewsSourceMeta.name). Ratings are informational
 * metadata for reader transparency — never used to censor or penalize.
 */

export type BiasLabel = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export type FactualityLabel = 'very-high' | 'high' | 'mixed' | 'low' | 'very-low';

/** Default numeric score per bias label: -1.0 (left) .. +1.0 (right). */
export const BIAS_LABEL_SCORE: Record<BiasLabel, number> = {
  left: -1.0,
  'center-left': -0.5,
  center: 0,
  'center-right': 0.5,
  right: 1.0,
};

/** 5-point political bias per source name (defaults to 'center'). */
export const SOURCE_BIAS: Record<string, BiasLabel> = {
  // Lean left — crypto media
  CoinDesk: 'center-left',
  Decrypt: 'center-left',
  'The Block': 'center-left',
  'The Defiant': 'center-left',
  TechCrunch: 'center-left',
  'The Verge': 'center-left',
  Wired: 'center-left',
  'Ars Technica': 'center-left',
  Engadget: 'center-left',
  'VentureBeat AI': 'center-left',
  // Left — legacy tech/culture
  Motherboard: 'left',
  Vice: 'left',
  // Center — crypto news & research
  CoinTelegraph: 'center',
  'CoinTelegraph Bitcoin': 'center',
  Blockworks: 'center',
  CryptoSlate: 'center',
  'Reuters Crypto': 'center',
  Reuters: 'center',
  AP: 'center',
  'Bloomberg Crypto': 'center',
  'FT Alphaville': 'center',
  'Messari': 'center',
  'Messari News': 'center',
  'Delphi Digital': 'center',
  'CoinMetrics': 'center',
  'Glassnode Insights': 'center',
  'DeFiLlama': 'center',
  'DeFiLlama Blog': 'center',
  Yearn: 'center',
  Curve: 'center',
  'Curve Finance': 'center',
  Aave: 'center',
  Lido: 'center',
  Uniswap: 'center',
  Bankless: 'center',
  CoinGecko: 'center',
  CoinMarketCap: 'center',
  'a16z Crypto': 'center',
  Paradigm: 'center',
  'Pantera Capital': 'center',
  'Galaxy Research': 'center',
  'Grayscale Research': 'center',
  'Kerman Kohli': 'center',
  'Alpha Please': 'center',
  'The Rollup': 'center',
  'DeFi Dad': 'center',
  '0x Research': 'center',
  'Milk Road': 'center',
  'Zora Mirror': 'center',
  'Public Assembly': 'center',
  Arkive: 'center',
  'CNBC Crypto': 'center',
  'Yahoo Finance Crypto': 'center',
  MarketWatch: 'center',
  'Financial Times Crypto': 'center',
  'The Economist Crypto': 'center',
  // Center-right — bitcoin/libertarian crypto
  'Bitcoin Magazine': 'center-right',
  Coinspeaker: 'center-right',
  'Bitcoin.com News': 'center-right',
  Bitcoinist: 'center-right',
  NewsBTC: 'center-right',
  'Daily Hodl': 'center-right',
  'Watcher.Guru': 'center-right',
  'WSJ Crypto': 'center-right',
  // Right — hard-right finance/macro
  ZeroHedge: 'right',
  'Zero Hedge Crypto': 'right',
  Breitbart: 'right',
};

/** Explicit numeric scores (override label default). */
export const SOURCE_BIAS_SCORE: Record<string, number> = {
  CoinDesk: -0.4,
  Decrypt: -0.35,
  'The Block': -0.35,
  'The Defiant': -0.4,
  CoinTelegraph: -0.1,
  Blockworks: 0.1,
  CryptoSlate: 0.0,
  'Bitcoin Magazine': 0.55,
  Coinspeaker: 0.45,
  'Bitcoin.com News': 0.5,
  Bitcoinist: 0.5,
  NewsBTC: 0.5,
  'Daily Hodl': 0.45,
  'Watcher.Guru': 0.5,
  ZeroHedge: 0.9,
  'Zero Hedge Crypto': 0.9,
  'WSJ Crypto': 0.35,
  Motherboard: -0.8,
  Vice: -0.7,
  'Reuters Crypto': 0.0,
  Reuters: 0.0,
  'FT Alphaville': 0.2,
  'Bloomberg Crypto': 0.1,
  'Financial Times Crypto': 0.15,
  'The Economist Crypto': 0.2,
};

/** Factuality per source (MBFC 5-point scale). */
export const SOURCE_FACTUALITY: Record<string, FactualityLabel> = {
  Reuters: 'very-high',
  'Reuters Crypto': 'very-high',
  AP: 'very-high',
  'Bloomberg Crypto': 'very-high',
  'FT Alphaville': 'very-high',
  'WSJ Crypto': 'very-high',
  'Financial Times Crypto': 'very-high',
  'The Economist Crypto': 'very-high',
  CoinDesk: 'high',
  Decrypt: 'high',
  'The Block': 'high',
  CoinTelegraph: 'high',
  'CoinTelegraph Bitcoin': 'high',
  Blockworks: 'high',
  Messari: 'high',
  'Messari News': 'high',
  'Delphi Digital': 'high',
  CoinMetrics: 'high',
  'Glassnode Insights': 'high',
  DeFiLlama: 'high',
  'DeFiLlama Blog': 'high',
  Yearn: 'high',
  Curve: 'high',
  'Curve Finance': 'high',
  Aave: 'high',
  Lido: 'high',
  Uniswap: 'high',
  CoinGecko: 'high',
  CoinMarketCap: 'high',
  'a16z Crypto': 'high',
  Paradigm: 'high',
  'Pantera Capital': 'high',
  'Galaxy Research': 'high',
  'Grayscale Research': 'high',
  TechCrunch: 'high',
  'The Verge': 'high',
  'Ars Technica': 'high',
  Wired: 'high',
  Engadget: 'high',
  Motherboard: 'high',
  CNBC: 'high',
  'CNBC Crypto': 'high',
  CryptoSlate: 'mixed',
  'The Defiant': 'mixed',
  Bankless: 'mixed',
  'Bitcoin Magazine': 'mixed',
  Coinspeaker: 'mixed',
  'Bitcoin.com News': 'mixed',
  Bitcoinist: 'mixed',
  NewsBTC: 'mixed',
  'Daily Hodl': 'mixed',
  'Watcher.Guru': 'low',
  ZeroHedge: 'mixed',
  'Zero Hedge Crypto': 'mixed',
  Vice: 'mixed',
  Gizmodo: 'mixed',
};

export function sourceBias(name: string | undefined): BiasLabel {
  if (!name) return 'center';
  return SOURCE_BIAS[name] ?? 'center';
}

export function sourceBiasScore(name: string | undefined): number {
  if (!name) return 0;
  const explicit = SOURCE_BIAS_SCORE[name];
  if (typeof explicit === 'number') return explicit;
  const label = SOURCE_BIAS[name];
  if (label) return BIAS_LABEL_SCORE[label];
  return 0;
}

export function sourceFactuality(name: string | undefined): FactualityLabel {
  if (!name) return 'high';
  return SOURCE_FACTUALITY[name] ?? 'high';
}

/** Map a 5-point bias label to the 3-bucket UI filter ('left' | 'center' | 'right'). */
export function biasBucket(label: BiasLabel | undefined): 'left' | 'center' | 'right' {
  if (label === 'left' || label === 'center-left') return 'left';
  if (label === 'right' || label === 'center-right') return 'right';
  return 'center';
}

/** Count stories by bias bucket for the meta biasDistribution payload. */
export function computeBiasDistribution(
  stories: Array<{ bias?: BiasLabel }>,
): Record<'left' | 'center' | 'right', number> {
  const counts: Record<'left' | 'center' | 'right', number> = { left: 0, center: 0, right: 0 };
  for (const s of stories) {
    const label = s.bias ?? 'center';
    counts[biasBucket(label)] += 1;
  }
  return counts;
}

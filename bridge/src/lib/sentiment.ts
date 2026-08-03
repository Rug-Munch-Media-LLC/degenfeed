/**
 * Sentiment analysis for news articles.
 *
 * Uses the zero-dependency AFINN-165 based `sentiment` npm package with a
 * crypto/DeFi-aware extension vocabulary. Runs fully locally — no external
 * API calls, no data leaves the bridge.
 */

import Sentiment from 'sentiment';

export interface SentimentResult {
  /** Raw AFINN score (sum of word scores, unbounded). */
  score: number;
  /** Score normalized by word count (roughly -5..+5). */
  comparative: number;
  /** Positive token list. */
  positive: string[];
  /** Negative token list. */
  negative: string[];
  /** Count of tokens scored. */
  tokens: number;
  /** Normalized -1..+1 value, NaN-safe. */
  normalized: number;
}

/**
 * Crypto/DeFi vocabulary additions to AFINN-165. AFINN scores words from
 * -5 (very negative) to +5 (very positive). Adding domain terms makes the
 * sentiment signal useful for crypto headlines (hack, exploit, rug vs.
 * surge, adoption, bullish).
 */
const CRYPTO_EXTRAS: Record<string, number> = {
  // Negative
  rug: -5,
  rugpull: -5,
  hacked: -4,
  hack: -3,
  exploit: -4,
  exploited: -4,
  breach: -4,
  breached: -4,
  drained: -4,
  drain: -3,
  exploiters: -4,
  scammed: -4,
  scam: -3,
  phishing: -3,
  ponzi: -4,
  fraud: -4,
  fraudulent: -4,
  insolvent: -4,
  bankruptcy: -4,
  bankrupt: -4,
  collapse: -4,
  collapsed: -4,
  crash: -3,
  crashed: -3,
  dumped: -3,
  dump: -2,
  liquidation: -3,
  liquidated: -3,
  bearish: -2,
  selloff: -3,
  withdrawal: -2,
  withdrawal_freeze: -4,
  frozen: -2,
  freeze: -2,
  penalty: -3,
  fined: -3,
  fine: -2,
  subpoena: -3,
  indicted: -4,
  indictment: -4,
  arrest: -3,
  arrested: -3,
  sanctions: -3,
  sanctioned: -3,
  ban: -3,
  banned: -3,
  delisted: -3,
  blacklisted: -3,
  vulnerability: -2,
  bug: -2,
  critical_bug: -3,
  // Positive
  bullish: 3,
  surge: 3,
  surged: 3,
  surging: 3,
  rally: 3,
  rallies: 3,
  rallied: 3,
  moon: 2,
  moonshot: 3,
  adoption: 3,
  adopted: 2,
  breakthrough: 3,
  milestone: 3,
  alltimehigh: 4,
  ath: 3,
  record: 2,
  inflow: 2,
  inflows: 2,
  approval: 3,
  approved: 3,
  approve: 2,
  partnership: 2,
  partnered: 2,
  integration: 2,
  integrated: 2,
  launch: 1,
  launched: 1,
  upgrade: 2,
  upgraded: 2,
  growth: 2,
  growing: 2,
  gains: 2,
  gain: 1,
  profit: 2,
  profitable: 3,
  revenue: 1,
  rebound: 2,
  rebounded: 2,
  recovery: 2,
  recovered: 2,
  bull: 2,
  optimism: 2,
  optimistic: 2,
  confidence: 2,
  institutional: 1,
  etf: 1,
  mainstream: 1,
  billion: 1,
  trillion: 2,
};

const analyzer = new Sentiment();

/**
 * Analyze the sentiment of an article title + description.
 * Never throws — malformed/empty input yields a neutral result.
 */
export function analyzeNewsSentiment(text: string): SentimentResult {
  const input = (text || '').slice(0, 4000);
  if (!input.trim()) {
    return { score: 0, comparative: 0, positive: [], negative: [], tokens: 0, normalized: 0 };
  }

  const result = analyzer.analyze(input, { extras: CRYPTO_EXTRAS });

  const score = Number.isFinite(result.score) ? result.score : 0;
  const comparative = Number.isFinite(result.comparative) ? result.comparative : 0;

  // Normalize comparative (roughly -5..+5) to -1..+1 with soft clamping
  let normalized = comparative / 5;
  normalized = Math.max(-1, Math.min(1, normalized));

  return {
    score,
    comparative: Math.round(comparative * 1000) / 1000,
    positive: (result.positive as string[]) || [],
    negative: (result.negative as string[]) || [],
    tokens: Array.isArray(result.tokens) ? result.tokens.length : 0,
    normalized: Math.round(normalized * 1000) / 1000,
  };
}

/** Map a normalized sentiment value to a coarse label. */
export function sentimentLabel(normalized: number): 'positive' | 'neutral' | 'negative' {
  if (normalized >= 0.05) return 'positive';
  if (normalized <= -0.05) return 'negative';
  return 'neutral';
}

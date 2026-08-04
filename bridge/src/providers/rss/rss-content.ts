export function guessNiches(text: string, baseNiches: string[]): string[] {
  const niches = new Set(baseNiches);
  const lower = text.toLowerCase();

  // Crypto-specific
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.add('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra|eip|erc)\b/.test(lower)) niches.add('ethereum');
  if (/\b(sol|solana|spl|jupiter|pyth)\b/.test(lower)) niches.add('solana');
  if (/\b(defi|liquidity|yield|farm|lp|stake|apy)\b/.test(lower)) niches.add('defi');
  if (/\b(stak|validator|delegat|restak|eigenlayer|ssv|lido|jito)\b/.test(lower))
    niches.add('staking');
  if (/\b(mev|sandwich|front.?run|back.?run|extractable)\b/.test(lower)) niches.add('mev');
  if (/\b(bridge|bridging|wormhole|layerzero|axelar|ibc|interoperab)\b/.test(lower))
    niches.add('bridges');
  if (/\b(zero.?knowledge|zk.?proof|validity.?proof|zkp|zksync|starknet|circom)\b/.test(lower))
    niches.add('zero-knowledge');
  if (/\b(nft|art|collectible|punk|ens|soulbound)\b/.test(lower)) niches.add('nft');
  if (/\b(ai|artificial|intelligence|llm|agent|gpt|transformer|neural)\b/.test(lower))
    niches.add('ai');
  if (
    /\b(ai.?agent|ai.?crypto|decentralized.?ai|compute.?marketplace|bittensor|fetch\.?ai)\b/.test(
      lower,
    )
  )
    niches.add('aicrypto');
  if (/\b(storage|filecoin|arweave|ipfs|datacap|decentralized.?storage|storj)\b/.test(lower))
    niches.add('storage');
  if (
    /\b(identity|did|verifiable.?credential|soulbound|worldcoin|proof.?of.?personhood)\b/.test(
      lower,
    )
  )
    niches.add('identity');
  if (/\b(social|farcaster|lens|bluesky|socialfi|content|creator.?economy|deso)\b/.test(lower))
    niches.add('social');
  if (/\b(insurance|underwrit|coverage|nexus.?mutual|cover)\b/.test(lower)) niches.add('insurance');
  if (/\b(carbon|offset|verra|gold.?standard|regen|toucan|moss|ecosystem.?credit)\b/.test(lower))
    niches.add('carbon');
  if (
    /\b(payment|remittance|payments|crypto.?pay|lightning|visa|mastercard|paypal|stripe)\b/.test(
      lower,
    )
  )
    niches.add('payments');
  if (/\b(rwa|real.?world.?asset|tokeniz|tokenization|syndicate|centrifuge)\b/.test(lower))
    niches.add('rwa');
  if (/\b(sec|regulation|etf|compliance|sec|cfpb|finra|oig)\b/.test(lower))
    niches.add('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|mew)\b/.test(lower)) niches.add('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|scroll|zksync)\b/.test(lower)) niches.add('layer2');
  if (/\b(security|hack|exploit|audit|vulnerability|bug)\b/.test(lower)) niches.add('security');
  if (/\b(oracle|chainlink|pyth|api3)\b/.test(lower)) niches.add('oracle');
  if (/\b(dao|treasury|proposal|snapshot|delegate|quorum)\b/.test(lower)) niches.add('dao');
  if (/\b(governance|vote|voting|proposal|constitution|parameter.?change)\b/.test(lower))
    niches.add('governance');
  if (/\b(gaming|gamefi|play-to-earn|metaverse)\b/.test(lower)) niches.add('gaming');
  if (/\b(token|airdrop|listing|binance|coinbase)\b/.test(lower)) niches.add('token');
  if (/\b(mobile|telegram|ton|crypto\s*pay)\b/.test(lower)) niches.add('mobile');
  if (/\b(dex|swap|amm|order.?book|perpetual)\b/.test(lower)) niches.add('dex');
  if (/\b(custody|wallet|self.?custody|hardware)\b/.test(lower)) niches.add('wallet');
  if (/\b(stablecoin|usdc|usdt|dai|fdusd)\b/.test(lower)) niches.add('stablecoin');
  if (/\b(privacy|monero|tornado|anonymity)\b/.test(lower)) niches.add('privacy');
  if (/\b(mining|miner|hashrate|asic|pool|proof.?of.?work|difficulty)\b/.test(lower))
    niches.add('mining');

  // World / science / business topics (topic expansion)
  if (
    /\b(climate|physics|biology|genome|space|nasa|quantum|dna|vaccine|neutron|telescope)\b/.test(
      lower,
    )
  )
    niches.add('science');
  if (
    /\b(war|sanction|diplomacy|nato|election|foreign|policy|geopolitic|treaty|summit)\b/.test(lower)
  )
    niches.add('geopolitics');
  if (
    /\b(economy|recession|inflation|gdp|fed|interest rate|tariff|trade war|unemployment|central bank|pmi|cpi|rate cut|hike)\b/.test(
      lower,
    )
  ) {
    niches.add('business');
    niches.add('macro');
  }

  // Add crypto as default if nothing matched and no base niches
  if (niches.size === 0) niches.add('crypto');
  return [...niches];
}

// ─── Price Impact & Trending Coins ──────────────────────────────────
// CryptoPanic-style "which coins are affected" tagging. Articles that
// mention the top coins by market cap get a price-impact annotation and a
// ranking boost. Simulated until real user votes arrive.

export interface PriceImpactEntry {
  symbol: string;
  weight: number;
}

/**
 * Top coins by market cap (non-stablecoin) used for price-impact tagging.
 * `weight` reflects market-cap influence (1.0 = most impactful).
 */
export const TOP_MARKET_CAP_COINS: ReadonlyArray<{
  symbol: string;
  names: readonly string[];
  weight: number;
}> = [
  { symbol: 'BTC', names: ['bitcoin', 'btc', 'satoshi'], weight: 1.0 },
  { symbol: 'ETH', names: ['ethereum', 'eth', 'ether'], weight: 0.95 },
  { symbol: 'BNB', names: ['bnb', 'binance coin', 'bsc'], weight: 0.85 },
  { symbol: 'SOL', names: ['solana', 'sol'], weight: 0.82 },
  { symbol: 'XRP', names: ['xrp', 'ripple'], weight: 0.75 },
  { symbol: 'DOGE', names: ['dogecoin', 'doge'], weight: 0.7 },
  { symbol: 'ADA', names: ['cardano', 'ada'], weight: 0.66 },
  { symbol: 'TRX', names: ['tron', 'trx'], weight: 0.62 },
  { symbol: 'TON', names: ['toncoin', 'ton'], weight: 0.6 },
  { symbol: 'AVAX', names: ['avalanche', 'avax'], weight: 0.58 },
];

const TICKER_TO_WEIGHT = new Map<string, number>(
  TOP_MARKET_CAP_COINS.map((c) => [c.symbol, c.weight]),
);

/** Escape regex special chars in a literal string. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract price-impact entries from article text: `$BTC`-style tickers and
 * coin-name mentions of the top market-cap coins. Returns deduplicated
 * `[{symbol, weight}]` sorted by weight (most impactful first).
 */
export function extractPriceImpact(text: string): PriceImpactEntry[] {
  if (!text) return [];
  const found = new Map<string, number>();

  // $TICKER mentions (e.g. "$BTC", "$SOL") — most explicit signal
  const tickerRe = /\$([A-Z]{2,10})\b/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
  while ((m = tickerRe.exec(text)) !== null) {
    const ticker = m[1];
    if (!ticker) continue;
    const sym = ticker.toUpperCase();
    const w = TICKER_TO_WEIGHT.get(sym);
    if (w !== undefined) found.set(sym, Math.max(found.get(sym) ?? 0, w));
  }

  // Coin-name mentions (bitcoin, ethereum, ...)
  const lower = text.toLowerCase();
  for (const coin of TOP_MARKET_CAP_COINS) {
    for (const name of coin.names) {
      if (new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(lower)) {
        found.set(coin.symbol, Math.max(found.get(coin.symbol) ?? 0, coin.weight));
        break;
      }
    }
  }

  return [...found.entries()]
    .map(([symbol, weight]) => ({ symbol, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Coins considered "trending" for the simulated community-vote signal.
 * Top majors + currently hot memecoins (matches the memecoin niche regex).
 */
export const TRENDING_COINS: ReadonlySet<string> = new Set([
  'BTC',
  'ETH',
  'SOL',
  'PEPE',
  'DOGE',
  'BONK',
  'WIF',
  'SHIB',
  'MEW',
]);

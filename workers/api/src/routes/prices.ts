import { type Env, jsonResponse } from '../index';

// Tick symbol to Coingecko ID mapping
const TICKER_TO_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche-2',
  MATIC: 'matic-network', DOT: 'polkadot', LINK: 'chainlink', ATOM: 'cosmos',
  OP: 'optimism', ARB: 'arbitrum', PEPE: 'pepe', DOGE: 'dogecoin',
  SHIB: 'shiba-inu', BONK: 'bonk', WIF: 'dogwifcoin', DEGEN: 'degen',
  UNI: 'uniswap', AAVE: 'aave', MKR: 'maker', COMP: 'compound',
  CRV: 'curve-dao-token', SUSHI: 'sushi', CAKE: 'pancakeswap-token',
  FTM: 'fantom', NEAR: 'near', APT: 'aptos', SUI: 'sui',
  SEI: 'sei-network', INJ: 'injective-protocol', RUNE: 'thorchain',
};

// In-memory cache
let priceCache: { data: Record<string, any>; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

export async function handlePrices(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tickersParam = url.searchParams.get('tickers') || '';
  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < CACHE_TTL) {
    const filtered: Record<string, any> = {};
    for (const t of tickers) {
      if (priceCache.data[t]) filtered[t] = priceCache.data[t];
    }
    if (Object.keys(filtered).length > 0) {
      return jsonResponse({ prices: filtered, cached: true });
    }
  }

  try {
    // Coingecko free API — no key needed for simple/price
    const ids = [...new Set(tickers.map(t => TICKER_TO_ID[t]).filter(Boolean))];
    if (ids.length === 0) {
      return jsonResponse({ prices: {}, error: 'No known tickers' });
    }

    const apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids.join(',') + '&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true&include_market_cap=true';
    
    const res = await fetch(apiUrl, {
      headers: { 'accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Return cached data if available
      if (priceCache) {
        return jsonResponse({ prices: priceCache.data, cached: true, note: 'Returning cached data (API error)' });
      }
      return jsonResponse({ prices: {}, error: 'Price API returned ' + res.status }, 502);
    }

    const data = await res.json() as Record<string, any>;
    
    // Map back to ticker symbols
    const idToTicker = Object.fromEntries(Object.entries(TICKER_TO_ID).map(([k, v]) => [v, k]));
    const prices: Record<string, any> = {};
    for (const [id, coinData] of Object.entries(data)) {
      const ticker = idToTicker[id];
      if (ticker && coinData) {
        prices[ticker] = {
          usd: coinData.usd,
          usd_24h_change: coinData.usd_24h_change,
          usd_7d_change: coinData.usd_7d_change,
          usd_30d_change: coinData.usd_30d_change,
          usd_market_cap: coinData.usd_market_cap,
        };
      }
    }

    // Update cache
    priceCache = { data: prices, timestamp: now };

    return jsonResponse({ prices, cached: false });
  } catch (err) {
    // Return cached on error
    if (priceCache) {
      return jsonResponse({ prices: priceCache.data, cached: true, note: 'Returning cached data' });
    }
    return jsonResponse({ prices: {}, error: String(err) }, 502);
  }
}

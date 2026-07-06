import { type Env, jsonResponse } from '../index';

// Tick symbol to API ID mappings
const TICKER_TO_CG_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche-2',
  MATIC: 'matic-network', DOT: 'polkadot', LINK: 'chainlink', ATOM: 'cosmos',
  OP: 'optimism', ARB: 'arbitrum', PEPE: 'pepe', DOGE: 'dogecoin',
  SHIB: 'shiba-inu', BONK: 'bonk', WIF: 'dogwifcoin', DEGEN: 'degen',
  UNI: 'uniswap', AAVE: 'aave', MKR: 'maker', COMP: 'compound',
  CRV: 'curve-dao-token', SUSHI: 'sushi', CAKE: 'pancakeswap-token',
  FTM: 'fantom', NEAR: 'near', APT: 'aptos', SUI: 'sui',
  SEI: 'sei-network', INJ: 'injective-protocol', RUNE: 'thorchain',
};

const TICKER_TO_CC_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche',
  MATIC: 'matic-network', DOT: 'polkadot', LINK: 'chainlink', ATOM: 'cosmos',
  OP: 'optimism', ARB: 'arbitrum', PEPE: 'pepe', DOGE: 'dogecoin',
  SHIB: 'shiba-inu', BONK: 'bonk', WIF: 'dogwifcoin', DEGEN: 'degen',
  UNI: 'uniswap', AAVE: 'aave', MKR: 'maker', COMP: 'compound-Compound',
  CRV: 'curve-dao-token', SUSHI: 'sushi', CAKE: 'pancakeswap',
  FTM: 'fantom', NEAR: 'near', APT: 'aptos', SUI: 'sui',
  SEI: 'sei', INJ: 'injective', RUNE: 'thorchain',
};

const ALL_ASSETS_URL = 'https://api.coincap.io/v2/assets';

// In-memory cache
let priceCache: { data: Record<string, any>; timestamp: number } | null = null;
const CACHE_TTL = 60000;

async function fetchCoingecko(ids: string[]): Promise<Record<string, any> | null> {
  try {
    const apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids.join(',') + '&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true&include_market_cap=true';
    const res = await fetch(apiUrl, {
      headers: { 'accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, any>;
  } catch { return null; }
}

async function fetchCoinCap(ids: string[]): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(ALL_ASSETS_URL, {
      headers: { 'accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data: any[] };
    const allAssets: Record<string, any> = {};
    for (const asset of data.data) {
      const ticker = Object.entries(TICKER_TO_CC_ID).find(([, v]) => v === asset.id)?.[0];
      if (ticker) {
        const price = parseFloat(asset.priceUsd);
        const change24h = parseFloat(asset.changePercent24Hr);
        allAssets[ticker] = {
          usd: price,
          usd_24h_change: change24h,
          usd_7d_change: asset.vwap24Hr ? ((price - parseFloat(asset.vwap24Hr)) / parseFloat(asset.vwap24Hr)) * 100 : null,
          usd_30d_change: null,
          usd_market_cap: asset.marketCapUsd ? parseFloat(asset.marketCapUsd) : null,
        };
      }
    }
    return allAssets;
  } catch { return null; }
}

function mapCgData(data: Record<string, any>): Record<string, any> {
  const idToTicker = Object.fromEntries(Object.entries(TICKER_TO_CG_ID).map(([k, v]) => [v, k]));
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
  return prices;
}

export async function handlePrices(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tickersParam = url.searchParams.get('tickers') || '';
  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

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
    const ids = [...new Set(tickers.map(t => TICKER_TO_CG_ID[t]).filter(Boolean))];
    if (ids.length === 0) {
      return jsonResponse({ prices: {}, error: 'No known tickers' });
    }

    // Try CoinGecko first, fallback to CoinCap
    let prices: Record<string, any> | null = null;
    const cgData = await fetchCoingecko(ids);
    if (cgData) {
      prices = mapCgData(cgData);
    } else {
      const ccData = await fetchCoinCap(ids);
      if (ccData) prices = ccData;
    }

    if (prices) {
      priceCache = { data: prices, timestamp: now };
      return jsonResponse({ prices, cached: false, source: cgData ? 'coingecko' : 'coincap' });
    }

    if (priceCache) {
      return jsonResponse({ prices: priceCache.data, cached: true, note: 'Returning cached data (API error)' });
    }
    return jsonResponse({ prices: {}, error: 'All price APIs unavailable' }, 502);
  } catch (err) {
    if (priceCache) {
      return jsonResponse({ prices: priceCache.data, cached: true, note: 'Returning cached data' });
    }
    return jsonResponse({ prices: {}, error: String(err) }, 502);
  }
}

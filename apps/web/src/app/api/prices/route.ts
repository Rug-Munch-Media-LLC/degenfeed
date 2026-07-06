import { NextResponse } from 'next/server';

const TICKER_TO_CG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche-2',
  MATIC: 'matic-network', DOT: 'polkadot', LINK: 'chainlink', ATOM: 'cosmos',
  OP: 'optimism', ARB: 'arbitrum', PEPE: 'pepe', DOGE: 'dogecoin',
  SHIB: 'shiba-inu', BONK: 'bonk', WIF: 'dogwifcoin', DEGEN: 'degen',
  UNI: 'uniswap', AAVE: 'aave', MKR: 'maker', COMP: 'compound',
  CRV: 'curve-dao-token', SUSHI: 'sushi', CAKE: 'pancakeswap-token',
  FTM: 'fantom', NEAR: 'near', APT: 'aptos', SUI: 'sui',
  SEI: 'sei-network', INJ: 'injective-protocol', RUNE: 'thorchain',
  XRP: 'ripple', ADA: 'cardano', LTC: 'litecoin', TRX: 'tron',
  FIL: 'filecoin', DOT: 'polkadot', ATOM: 'cosmos',
};

const TICKER_TO_KR: Record<string, string> = {
  BTC: 'XXBTZUSD', ETH: 'XETHZUSD', SOL: 'SOLUSD', XRP: 'XXRPZUSD',
  ADA: 'ADAUSD', DOT: 'DOTUSD', LINK: 'LINKUSD', LTC: 'XLTCZUSD',
  MATIC: 'MATICUSD', AVAX: 'AVAXUSD', TRX: 'TRXUSD',
  DOGE: 'XDGUSD', SHIB: 'SHIBUSD', UNI: 'UNIUSD', ATOM: 'ATOMUSD',
};

async function fetchCoingecko(ids: string[]) {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids.join(',') +
    '&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true&include_market_cap=true';
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  return res.json() as Record<string, any>;
}

async function fetchKraken(pairs: string[]) {
  const url = 'https://api.kraken.com/0/public/Ticker?pair=' + pairs.join(',');
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  return res.json() as Record<string, any>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickersParam = url.searchParams.get('tickers') || '';
  const requested = tickersParam.split(',').map((t: string) => t.trim().toUpperCase()).filter(Boolean);

  if (requested.length === 0) {
    return NextResponse.json({ prices: {}, error: 'No tickers provided' });
  }

  const cgIds = [...new Set(requested.map(t => TICKER_TO_CG[t]).filter(Boolean))];
  const krPairs = [...new Set(requested.map(t => TICKER_TO_KR[t]).filter(Boolean))];

  if (cgIds.length === 0 && krPairs.length === 0) {
    return NextResponse.json({ prices: {}, error: 'No known tickers' });
  }

  let prices: Record<string, any> = {};
  let source = '';

  try {
    if (cgIds.length > 0) {
      const cgData = await fetchCoingecko(cgIds);
      if (cgData) {
        const idToTicker = Object.fromEntries(Object.entries(TICKER_TO_CG).map(([k, v]) => [v, k]));
        for (const [id, data] of Object.entries(cgData)) {
          const ticker = idToTicker[id];
          if (ticker && data) {
            prices[ticker] = {
              usd: data.usd,
              usd_24h_change: data.usd_24h_change,
              usd_7d_change: data.usd_7d_change,
              usd_30d_change: data.usd_30d_change,
              usd_market_cap: data.usd_market_cap,
            };
          }
        }
        source = 'coingecko';
      }
    }

    if (Object.keys(prices).length === 0 && krPairs.length > 0) {
      const krData = await fetchKraken(krPairs);
      if (krData?.result) {
        const krakenSymbolMap: Record<string, string> = {
          XXBTZUSD: 'BTC', XETHZUSD: 'ETH', SOLUSD: 'SOL',
          XXRPZUSD: 'XRP', ADAUSD: 'ADA', DOTUSD: 'DOT',
          LINKUSD: 'LINK', XLTCZUSD: 'LTC', MATICUSD: 'MATIC',
          AVAXUSD: 'AVAX', TRXUSD: 'TRX', XDGUSD: 'DOGE',
          SHIBUSD: 'SHIB', UNIUSD: 'UNI', ATOMUSD: 'ATOM',
        };
        for (const [pair, data] of Object.entries(krData.result)) {
          const ticker = krakenSymbolMap[pair];
          if (ticker && data) {
            const tick = data as any;
            prices[ticker] = {
              usd: parseFloat(tick.c?.[0] || '0'),
              usd_24h_change: parseFloat(tick.p?.[1] || '0'),
            };
          }
        }
        source = 'kraken';
      }
    }

    if (Object.keys(prices).length > 0) {
      return NextResponse.json({ prices, source });
    }
    return NextResponse.json({ prices: {}, error: 'All price APIs unavailable' });
  } catch (e) {
    return NextResponse.json({ prices: {}, error: String(e) });
  }
}

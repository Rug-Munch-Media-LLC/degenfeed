import { NextResponse } from 'next/server';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/** Real price history point: [unix seconds, usd price] */
export type PriceHistoryPoint = [number, number];

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: { large?: string; small?: string; thumb?: string };
  description?: { en?: string };
  links?: { homepage?: string[] };
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    total_supply?: number;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    price_change_percentage_30d?: number;
  };
}

/** Map a UI timeframe label to a CoinGecko market_chart interval. */
function marketChartDays(timeframe: string): number {
  switch (timeframe) {
    case '1H':
      return 1;
    case '24H':
      return 1;
    case '7D':
      return 7;
    case '30D':
      return 30;
    default:
      return 365;
  }
}

/**
 * Fetch REAL historical price data from CoinGecko for the chart.
 * Returns `[]` on failure — the UI must render an empty/error chart,
 * NOT synthetic random data.
 */
async function fetchPriceHistory(
  coinId: string,
  timeframe: string,
): Promise<PriceHistoryPoint[]> {
  const days = marketChartDays(timeframe);
  const res = await fetch(
    `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { prices?: Array<[number, number]> };
  if (!Array.isArray(data.prices)) return [];
  // Downsample to at most 365 points so the client chart stays light.
  const step = Math.max(1, Math.ceil(data.prices.length / 365));
  return data.prices.filter((_, i) => i % step === 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toLowerCase().trim();
  const timeframe = searchParams.get('timeframe')?.toUpperCase() || '24H';

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  try {
    // Step 1: Search for the coin by symbol to get the CoinGecko coin ID
    const searchRes = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&symbols=${symbol}&order=market_cap_desc&per_page=1&page=1&sparkline=false`,
      { next: { revalidate: 60 } },
    );

    if (!searchRes.ok) {
      console.warn(`[creator-coin/info] CoinGecko markets search failed: ${searchRes.status}`);
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const markets: Array<{ id: string }> = await searchRes.json();

    if (!markets || markets.length === 0) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const coinId = markets[0]?.id;
    if (!coinId) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // Step 2: Get full coin details
    const detailRes = await fetch(
      `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
      { next: { revalidate: 60 } },
    );

    if (!detailRes.ok) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const coin: CoinGeckoCoin = await detailRes.json();
    const md = coin.market_data;

    // Real price history for the chart (empty array on failure — never fake)
    const priceHistory = await fetchPriceHistory(coin.id, timeframe);

    return NextResponse.json({
      found: true,
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image?.large || coin.image?.small || '',
      price: md?.current_price?.usd ?? 0,
      priceChange24h: md?.price_change_percentage_24h ?? 0,
      priceChange7d: md?.price_change_percentage_7d ?? 0,
      priceChange30d: md?.price_change_percentage_30d ?? 0,
      marketCap: md?.market_cap?.usd ?? 0,
      volume24h: md?.total_volume?.usd ?? 0,
      totalSupply: md?.total_supply ?? 0,
      description: coin.description?.en
        ? coin.description.en.replace(/<[^>]*>/g, '').slice(0, 300)
        : '',
      links:
        coin.links?.homepage?.filter(Boolean).map((url: string) => ({ label: 'Website', url })) ??
        [],
      // Real CoinGecko history — the client renders this instead of seeded random data
      priceHistory,
    });
  } catch (err) {
    console.error('[creator-coin/info] CoinGecko fetch failed:', err);
    return NextResponse.json({ error: 'Price data temporarily unavailable' }, { status: 503 });
  }
}

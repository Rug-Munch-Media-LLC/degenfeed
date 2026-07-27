import { NextResponse } from 'next/server';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toLowerCase().trim();

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

    const coinId = markets[0].id;

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
    });
  } catch (err) {
    console.error('[creator-coin/info] CoinGecko fetch failed:', err);
    return NextResponse.json({ error: 'Price data temporarily unavailable' }, { status: 503 });
  }
}

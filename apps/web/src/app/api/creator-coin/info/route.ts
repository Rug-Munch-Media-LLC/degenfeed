import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  // Mock response — in production, fetch from chain
  return NextResponse.json({
    address,
    name: 'Creator Coin',
    symbol: 'CRTR',
    price: '1000000000',
    totalSupply: '1000000000000000000000000000',
    totalRaised: '500000000000000000',
    uniqueBuyers: 42,
    graduated: false,
    decimals: 18,
    chain: 'solana',
    createdAt: Date.now() - 86400000,
    creator: 'placeholder_creator',
  });
}

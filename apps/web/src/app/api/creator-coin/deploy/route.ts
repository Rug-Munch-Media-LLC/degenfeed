import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {name, symbol, creator, chain, crossChain} =      body;

    if (!name || !symbol || !creator) {
      return NextResponse.json(
        { error: 'Missing required fields: name, symbol, creator' },
        { status: 400 },
      );
    }

    const mockAddress =
      chain === 'solana'
        ? `DeFi${symbol}${Date.now().toString(36).toUpperCase()}`
        : `0x${symbol.padEnd(40, '0')}`;

    return NextResponse.json({
      txHash: `0x${'0'.repeat(64)}`,
      primaryAddress: mockAddress,
      wrappedAddress: crossChain ? `0x${symbol.padEnd(40, 'W')}` : undefined,
      explorerUrl:
        chain === 'solana'
          ? `https://solscan.io/tx/placeholder`
          : `https://basescan.org/tx/placeholder`,
      zoraUrl: chain === 'base' ? `https://zora.co/coin/base:${mockAddress}` : undefined,
      totalSupply: '1000000000000000000000000000',
      chain,
    });
  } catch (err) {
    console.error('Deploy error:', err);
    return NextResponse.json({ error: 'Failed to deploy coin' }, { status: 500 });
  }
}

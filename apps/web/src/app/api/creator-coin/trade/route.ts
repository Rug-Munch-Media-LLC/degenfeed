import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {action, tokenAddress, chain, amountIn} = body;
    if (!action || !tokenAddress || !amountIn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const explorerUrl =
      chain === 'solana'
        ? `https://solscan.io/tx/placeholder_${Date.now()}`
        : `https://basescan.org/tx/placeholder_${Date.now()}`;

    return NextResponse.json({
      txHash: `placeholder_${Date.now()}`,
      tokensAmount: amountIn,
      explorerUrl,
      nativeAmount: amountIn,
    });
  } catch (err) {
    console.error('Trade error:', err);
    return NextResponse.json({ error: 'Trade failed' }, { status: 500 });
  }
}

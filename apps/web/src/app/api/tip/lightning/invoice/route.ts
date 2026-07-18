import { type NextRequest, NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pubkey = searchParams.get('pubkey');
    const amountStr = searchParams.get('amount');
    const comment = searchParams.get('comment') || 'Tip from DegenFeed';

    if (!pubkey || !amountStr) {
      return NextResponse.json(
        { error: 'Missing required params: pubkey, amount' },
        { status: 400 },
      );
    }

    const amount = Math.floor(Number.parseFloat(amountStr) * 100_000_000); // BTC to sats
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Generate a mock Lightning invoice
    const invoice = `lnbc${amount}n1p${Array.from({ length: 50 }, () =>
      'abcdefghijklmnopqrstuvwxyz023456789'.charAt(Math.floor(Math.random() * 32)),
    ).join('')}`;

    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry

    return NextResponse.json({
      invoice,
      amount,
      expiresAt,
      description: comment,
      pubkey,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}

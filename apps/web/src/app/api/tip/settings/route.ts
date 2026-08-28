import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate fields if present
    const validFields = [
      'identityId',
      'updatedAt',
      'evmAddress',
      'solanaAddress',
      'lightningAddress',
      'farcasterCustodyAddress',
      'lensProfile',
      'nostrPubkey',
      'preferredMethod',
    ];

    const unknownFields = Object.keys(body).filter((k) => !validFields.includes(k));
    if (unknownFields.length > 0) {
      return NextResponse.json(
        { error: `Unknown fields: ${unknownFields.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate address formats if provided
    const evmRe = /^0x[0-9a-fA-F]{40}$/;
    const solanaRe = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    if (body.evmAddress && !evmRe.test(body.evmAddress)) {
      return NextResponse.json({ error: 'Invalid EVM address format' }, { status: 400 });
    }
    if (body.solanaAddress && !solanaRe.test(body.solanaAddress)) {
      return NextResponse.json({ error: 'Invalid Solana address format' }, { status: 400 });
    }
    if (body.farcasterCustodyAddress && !evmRe.test(body.farcasterCustodyAddress)) {
      return NextResponse.json(
        { error: 'Invalid Farcaster custody address format' },
        { status: 400 },
      );
    }

    // Not yet implemented — see ROADMAP.md
    return NextResponse.json(
      { error: 'Tip settings not yet available', status: 501 },
      { status: 501 },
    );
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

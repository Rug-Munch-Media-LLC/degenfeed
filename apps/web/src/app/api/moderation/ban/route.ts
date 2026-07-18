import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    protocol?: string;
    reason?: string;
    walletAddress?: string;
  };

  if (!body.userId || !body.reason) {
    return NextResponse.json({ error: 'userId and reason are required' }, { status: 400 });
  }

  console.log(
    `[moderation] Banned user ${body.userId} on ${body.protocol || 'all'}: ${body.reason}`,
  );

  return NextResponse.json({ ok: true, userId: body.userId, protocol: body.protocol });
}

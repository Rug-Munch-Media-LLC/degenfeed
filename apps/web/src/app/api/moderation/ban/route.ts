import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

import { log } from '@/lib/log';

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

  log('info', `[moderation] Banned user ${body.userId} on ${body.protocol || 'all'}`, {
    reason: body.reason,
  });

  return NextResponse.json({ ok: true, userId: body.userId, protocol: body.protocol });
}

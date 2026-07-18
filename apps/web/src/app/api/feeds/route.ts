import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return await proxyGet('/api/custom-feeds', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await proxyPost('/api/custom-feeds', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: message, status: 400 }, { status: 400 });
  }
}

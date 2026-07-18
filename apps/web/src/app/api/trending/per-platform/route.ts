import { NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return await proxyGet('/api/trending/per-platform', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../_proxy';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cross-reply
 * Publish a cross-protocol reply.
 * Proxies to the worker backend at POST /api/cross-reply.
 */
export async function POST(request: NextRequest) {
  try {
    return await proxyPost('/api/cross-reply', request);
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

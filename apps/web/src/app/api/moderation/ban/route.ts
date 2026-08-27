import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { proxyPost } from '../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/moderation/ban
 *
 * Proxies to the feed-worker backend, which persists the ban in the REPORTS
 * KV namespace and makes it take effect in the feed pipeline (banned authors
 * are filtered on the next feed render).
 */
export async function POST(request: NextRequest) {
  try {
    return await proxyPost('/api/moderation/ban', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
